import { Router } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID as uuid } from "crypto";
import {
  AuditLog,
  Booking,
  Coupon,
  Enquiry,
  Invoice,
  Lease,
  Maintenance,
  Notification,
  ResourceLock,
  Seat,
  SiteContent,
  User,
  Workspace,
} from "../models.js";
import { authenticate, authorize, validate } from "../middleware.js";
import {
  audit,
  bookingReference,
  calculateQuote,
  createCustomerNotification,
  hashValue,
  notifyBooking,
  randomToken,
  refundPayment,
  resourceKey,
  slotsBetween,
} from "../services.js";

const router = Router();
router.use(authenticate, authorize("super_admin"));
const indiaDayBounds = (value = new Date()) => {
  const india = new Date(value.getTime() + 330 * 60000),
    start = new Date(
      Date.UTC(
        india.getUTCFullYear(),
        india.getUTCMonth(),
        india.getUTCDate(),
      ) -
        330 * 60000,
    );
  return [start, new Date(start.getTime() + 86400000)];
};
const reportBounds = (fromValue, toValue) => [
  fromValue
    ? new Date(`${fromValue}T00:00:00+05:30`)
    : new Date(Date.now() - 30 * 86400000),
  toValue ? new Date(`${toValue}T23:59:59.999+05:30`) : new Date(),
];
router.post(
  "/uploads/workspace-image",
  validate(
    z.object({ name: z.string().max(180), data: z.string().max(7_000_000) }),
  ),
  async (req, res, next) => {
    try {
      const match = req.validated.data.match(
        /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/,
      );
      if (!match)
        return res
          .status(422)
          .json({ message: "Choose a JPG, PNG, WEBP, or GIF image." });
      const extensions = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif",
        },
        buffer = Buffer.from(match[2], "base64");
      if (buffer.length > 5 * 1024 * 1024)
        return res
          .status(413)
          .json({ message: "Image must be smaller than 5 MB." });
      const directory = path.resolve("uploads");
      await mkdir(directory, { recursive: true });
      const filename = `workspace-${Date.now()}-${uuid().slice(0, 8)}.${extensions[match[1]]}`;
      await writeFile(path.join(directory, filename), buffer, { flag: "wx" });
      res.status(201).json({
        url: `${req.protocol}://${req.get("host")}/uploads/${filename}`,
      });
    } catch (error) {
      next(error);
    }
  },
);
router.get("/dashboard", async (req, res, next) => {
  try {
    const [day, tomorrow] = indiaDayBounds();
    const currentSlot = new Date(Math.floor(Date.now() / 900000) * 900000);
    const [
      workspaceCount,
      seatCount,
      maintenance,
      bookings,
      revenue,
      checkIns,
      cancellations,
      unavailableKeys,
      customers,
      successfulPayments,
      paidRevenue,
    ] = await Promise.all([
      Workspace.countDocuments({ bookable: true, status: { $ne: "inactive" } }),
      Seat.countDocuments({ bookable: true, status: { $ne: "inactive" } }),
      Maintenance.countDocuments({
        status: { $in: ["scheduled", "active"] },
        startAt: { $lt: tomorrow },
        endAt: { $gt: day },
      }),
      Booking.countDocuments({ createdAt: { $gte: day, $lt: tomorrow } }),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: day, $lt: tomorrow },
            "payment.status": "paid",
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Booking.countDocuments({ checkedInAt: { $gte: day, $lt: tomorrow } }),
      Booking.countDocuments({
        "cancellation.cancelledAt": { $gte: day, $lt: tomorrow },
      }),
      ResourceLock.distinct("resourceKey", { slotStart: currentSlot }),
      User.countDocuments({ role: "customer" }),
      Booking.countDocuments({ "payment.status": "paid" }),
      Booking.aggregate([
        { $match: { "payment.status": "paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);
    res.json({
      total: workspaceCount + seatCount,
      available: Math.max(
        0,
        workspaceCount + seatCount - unavailableKeys.length,
      ),
      occupied: bookings,
      maintenance,
      customers,
      successfulPayments,
      paidRevenue: paidRevenue[0]?.total || 0,
      today: {
        revenue: revenue[0]?.total || 0,
        bookings,
        checkIns,
        cancellations,
      },
    });
  } catch (e) {
    next(e);
  }
});

const leaseFields = z
  .object({
    enquiryId: z.string().optional().nullable(),
    workspaceId: z.string(),
    customer: z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().max(160),
      mobile: z.string().trim().min(7).max(20),
      company: z.string().trim().max(100).optional().or(z.literal("")),
    }),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    durationMonths: z.number().int().min(1).max(120),
    monthlyRent: z.number().min(0),
    securityDeposit: z.number().min(0).default(0),
    maintenanceCharges: z.number().min(0).default(0),
    paymentFrequency: z
      .enum(["monthly", "quarterly", "half_yearly", "yearly"])
      .default("monthly"),
    noticePeriodMonths: z.number().int().min(0).max(36).default(0),
    lockInMonths: z.number().int().min(0).max(120).default(0),
    occupants: z.object({
      count: z.number().int().min(1).max(500),
      names: z.array(z.string().trim().min(1).max(80)).max(500).default([]),
    }),
    purpose: z
      .enum([
        "company_office",
        "branch_office",
        "startup_team",
        "commercial",
        "other",
      ])
      .default("company_office"),
    expectedMoveInDate: z.coerce.date().optional().nullable(),
    amountPaid: z.number().min(0).default(0),
    paymentDate: z.coerce.date().optional().nullable(),
    paymentStatus: z
      .enum(["pending", "paid", "failed", "refunded"])
      .default("pending"),
    transactionReference: z
      .string()
      .trim()
      .max(160)
      .optional()
      .or(z.literal("")),
    nextPaymentDate: z.coerce.date().optional().nullable(),
    documents: z
      .object({
        leaseAgreementUrl: z
          .string()
          .trim()
          .max(500)
          .optional()
          .or(z.literal("")),
        signedAgreementUrl: z
          .string()
          .trim()
          .max(500)
          .optional()
          .or(z.literal("")),
        paymentReceiptUrl: z
          .string()
          .trim()
          .max(500)
          .optional()
          .or(z.literal("")),
        verificationStatus: z
          .enum(["not_started", "pending", "verified", "rejected"])
          .default("not_started"),
        agreementStatus: z
          .enum(["draft", "sent", "signed", "active", "expired", "terminated"])
          .default("draft"),
      })
      .default({}),
    status: z
      .enum([
        "proposal",
        "agreement_pending",
        "active",
        "notice_period",
        "completed",
        "terminated",
      ])
      .default("proposal"),
    notes: z.string().trim().max(1200).optional().or(z.literal("")),
  })
  .refine((value) => value.endDate > value.startDate, {
    message: "Lease end date must be after the start date.",
    path: ["endDate"],
  });
router.get("/leases", async (req, res, next) => {
  try {
    res.json({
      items: await Lease.find()
        .populate("workspace", "name type zone capacity")
        .populate("enquiry")
        .sort({ createdAt: -1 })
        .limit(250)
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
router.post("/leases", validate(leaseFields), async (req, res, next) => {
  try {
    const { workspaceId, enquiryId, ...data } = req.validated,
      item = await Lease.create({
        ...data,
        workspace: workspaceId,
        enquiry: enquiryId || undefined,
        leaseId: `LEASE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
    if (enquiryId)
      await Enquiry.findByIdAndUpdate(enquiryId, {
        status: "closed",
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
      });
    await audit(req, "lease.created", "Lease", item._id, {
      leaseId: item.leaseId,
    });
    req.app.get("io").emit("operations:update", {
      resource: "lease",
      action: "created",
      id: item._id,
    });
    res.status(201).json({ item: await item.populate("workspace") });
  } catch (e) {
    next(e);
  }
});
router.patch("/leases/:id", validate(leaseFields), async (req, res, next) => {
  try {
    const { workspaceId, enquiryId, ...data } = req.validated,
      item = await Lease.findByIdAndUpdate(
        req.params.id,
        {
          ...data,
          workspace: workspaceId,
          enquiry: enquiryId || undefined,
          updatedBy: req.user._id,
        },
        { new: true, runValidators: true },
      ).populate("workspace");
    if (!item)
      return res.status(404).json({ message: "Lease record not found." });
    await audit(req, "lease.updated", "Lease", item._id, {
      leaseId: item.leaseId,
      status: item.status,
      amountPaid: item.amountPaid,
    });
    req.app.get("io").emit("operations:update", {
      resource: "lease",
      action: "updated",
      id: item._id,
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

const walkInInput = z
  .object({
    workspaceId: z.string(),
    seatId: z.string().optional().nullable(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    durationType: z.enum(["hourly", "daily", "weekly", "monthly"]),
    customer: z.object({
      name: z.string().min(2),
      email: z
        .string()
        .email()
        .transform((v) => v.toLowerCase()),
      mobile: z.string().min(7),
      company: z.string().optional(),
      gstin: z.string().optional(),
    }),
    paymentMethod: z.enum(["cash", "card", "upi", "pay_later"]).default("cash"),
  })
  .refine((data) => data.startAt >= new Date(Date.now() - 60_000), {
    message: "The booking start time cannot be in the past.",
    path: ["startAt"],
  })
  .refine((data) => data.endAt > data.startAt, {
    message: "End time must be after start time.",
    path: ["endAt"],
  });
router.post(
  "/bookings/walk-in",
  validate(walkInInput),
  async (req, res, next) => {
    let booking;
    try {
      const input = req.validated,
        workspace = await Workspace.findById(input.workspaceId);
      if (!workspace?.bookable || workspace.status !== "active")
        return res.status(409).json({ message: "Workspace is not bookable." });
      if (
        input.seatId &&
        !(await Seat.exists({
          _id: input.seatId,
          workspace: workspace._id,
          bookable: true,
          status: "active",
        }))
      )
        return res.status(409).json({ message: "Seat is not bookable." });
      let user = await User.findOne({ email: input.customer.email });
      if (!user) {
        const temporary = hashValue(randomToken());
        user = await User.create({
          email: input.customer.email,
          name: input.customer.name,
          mobile: input.customer.mobile,
          passwordHash: temporary.hash,
          passwordSalt: temporary.salt,
        });
      }
      const quote = calculateQuote(
        workspace,
        input.durationType,
        input.startAt,
        input.endAt,
      );
      booking = await Booking.create({
        bookingId: bookingReference(),
        user: user._id,
        workspace: workspace._id,
        seat: input.seatId || undefined,
        source: "walk_in",
        startAt: input.startAt,
        endAt: input.endAt,
        durationType: input.durationType,
        amount: quote.base,
        tax: quote.tax,
        discount: quote.discount,
        total: quote.total,
        customer: input.customer,
        status:
          input.paymentMethod === "pay_later" ? "pending_payment" : "confirmed",
        payment: {
          provider: "offline",
          method: input.paymentMethod,
          status: input.paymentMethod === "pay_later" ? "pending" : "paid",
          paymentId: `offline_${Date.now()}`,
        },
      });
      await ResourceLock.insertMany(
        slotsBetween(input.startAt, input.endAt).map((slotStart) => ({
          resourceKey: resourceKey(workspace._id, input.seatId),
          slotStart,
          booking: booking._id,
        })),
        { ordered: true },
      );
      if (booking.payment.status === "paid")
        await Invoice.findOneAndUpdate(
          { booking: booking._id },
          {
            $setOnInsert: {
              invoiceNumber: `INV-${booking.bookingId}`,
              booking: booking._id,
              user: user._id,
              subtotal: booking.amount,
              tax: booking.tax,
              total: booking.total,
              issuedAt: new Date(),
            },
          },
          { upsert: true },
        );
      await createCustomerNotification(user._id, {
        title:
          booking.status === "confirmed"
            ? "Booking confirmed"
            : "Booking created",
        message: `Your booking ${booking.bookingId} was created by TWS. Open My Bookings to review its status and schedule.`,
        kind: "booking",
        booking: booking._id,
      });
      await audit(req, "booking.walk_in_created", "Booking", booking._id, {
        paymentMethod: input.paymentMethod,
      });
      req.app.get("io").emit("availability:update", {
        workspaceId: workspace._id,
        seatId: input.seatId,
        reason: "walk_in",
      });
      req.app.get("io").emit("operations:update", {
        resource: "booking",
        action: "walk_in_created",
        id: booking._id,
      });
      notifyBooking(booking, "confirmed").catch(() => {});
      res
        .status(201)
        .json({ item: await booking.populate("workspace seat user") });
    } catch (e) {
      if (booking) {
        await ResourceLock.deleteMany({ booking: booking._id });
        await Booking.findByIdAndDelete(booking._id);
      }
      next(e);
    }
  },
);

const bookingStatusInput = z
  .object({
    status: z.enum(["confirmed", "completed", "cancelled", "no_show"]),
    reason: z.string().trim().max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.status === "cancelled" &&
      (!value.reason || value.reason.length < 5)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Give a clear reason before unbooking.",
      });
  });
router.patch(
  "/bookings/:id/status",
  validate(bookingStatusInput),
  async (req, res, next) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking)
        return res.status(404).json({ message: "Booking not found." });
      booking.status = req.validated.status;
      if (req.validated.status === "cancelled") {
        booking.cancellation = {
          reason: req.validated.reason,
          cancelledAt: new Date(),
          cancelledBy: req.user._id,
        };
        await ResourceLock.deleteMany({ booking: booking._id });
      }
      await booking.save();
      await audit(req, "booking.status_changed", "Booking", booking._id, {
        status: booking.status,
        reason: req.validated.reason,
      });
      req.app.get("io").emit("availability:update", {
        workspaceId: booking.workspace,
        seatId: booking.seat,
        reason: "admin_unbook",
      });
      req.app.get("io").emit("operations:update", {
        resource: "booking",
        action: "status_changed",
        id: booking._id,
      });
      if (booking.status === "cancelled") {
        await createCustomerNotification(booking.user, {
          title: "Booking cancelled by TWS",
          message: `Booking ${booking.bookingId} was released by the administrator. Reason: ${req.validated.reason}`,
          kind: "cancellation",
          booking: booking._id,
        });
        notifyBooking(booking, "cancelled").catch(() => {});
      }
      res.json({ item: booking });
    } catch (e) {
      next(e);
    }
  },
);
router.get("/cancellation-requests", async (req, res, next) => {
  try {
    const items = await Booking.find({
      "cancellation.status": {
        $in: ["requested", "approved", "rejected", "refunded"],
      },
    })
      .populate("workspace seat seats user")
      .sort({ "cancellation.requestedAt": -1 })
      .limit(200)
      .lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});
const cancellationAction = z.object({
  action: z.enum(["approve", "reject", "mark_refunded"]),
  note: z.string().trim().max(300).optional(),
});
router.patch(
  "/bookings/:id/cancellation",
  validate(cancellationAction),
  async (req, res, next) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking?.cancellation?.status)
        return res
          .status(404)
          .json({ message: "Cancellation request not found." });
      const { action, note } = req.validated,
        now = new Date();
      if (action === "approve") {
        if (booking.cancellation.status !== "requested")
          return res
            .status(409)
            .json({ message: "Only a pending request can be approved." });
        booking.status = "cancelled";
        booking.cancellation.status = "approved";
        booking.cancellation.reviewedAt = now;
        booking.cancellation.reviewedBy = req.user._id;
        booking.cancellation.adminNote = note;
        booking.cancellation.cancelledAt = now;
        booking.cancellation.cancelledBy = req.user._id;
        booking.cancellation.refundStatus =
          booking.payment.status === "paid" ? "pending" : "not_required";
        await ResourceLock.deleteMany({ booking: booking._id });
        await createCustomerNotification(booking.user, {
          title: "Cancellation approved",
          message: `Your cancellation for ${booking.bookingId} was approved.${booking.payment.status === "paid" ? " The refund is pending completion." : ""}`,
          kind: "cancellation",
          booking: booking._id,
        });
      } else if (action === "reject") {
        if (booking.cancellation.status !== "requested")
          return res
            .status(409)
            .json({ message: "Only a pending request can be rejected." });
        booking.cancellation.status = "rejected";
        booking.cancellation.reviewedAt = now;
        booking.cancellation.reviewedBy = req.user._id;
        booking.cancellation.adminNote = note;
        await createCustomerNotification(booking.user, {
          title: "Cancellation request reviewed",
          message: `Your cancellation request for ${booking.bookingId} was not approved.${note ? ` ${note}` : ""}`,
          kind: "cancellation",
          booking: booking._id,
        });
      } else {
        if (
          booking.cancellation.status !== "approved" ||
          booking.cancellation.refundStatus !== "pending"
        )
          return res
            .status(409)
            .json({ message: "This booking has no approved pending refund." });
        booking.cancellation.status = "refunded";
        booking.cancellation.refundStatus = "completed";
        booking.cancellation.refundCompletedAt = now;
        booking.payment.status = "refunded";
        booking.payment.refundAmount = booking.total;
        booking.payment.refundStatus = "SUCCESS";
        booking.payment.refundId =
          booking.payment.refundId || `manual_${Date.now()}`;
        await createCustomerNotification(booking.user, {
          title: "Refund completed",
          message: `The refund for booking ${booking.bookingId} has been marked completed by TWS.`,
          kind: "refund",
          booking: booking._id,
        });
      }
      await booking.save();
      await audit(
        req,
        `booking.cancellation_${action}`,
        "Booking",
        booking._id,
        { note },
      );
      req.app.get("io").emit("availability:update", {
        workspaceId: booking.workspace,
        seatId: booking.seat,
        reason: `cancellation_${action}`,
      });
      req.app.get("io").emit("operations:update", {
        resource: "cancellation",
        action,
        id: booking._id,
      });
      res.json({ item: booking });
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  "/bookings/:id/reschedule",
  validate(
    z
      .object({ startAt: z.coerce.date(), endAt: z.coerce.date() })
      .refine((data) => data.startAt >= new Date(Date.now() - 60_000), {
        message: "The new booking time cannot be in the past.",
        path: ["startAt"],
      })
      .refine((data) => data.endAt > data.startAt, {
        message: "End time must be after start time.",
        path: ["endAt"],
      }),
  ),
  async (req, res, next) => {
    try {
      const booking = await Booking.findById(req.params.id).populate(
        "workspace",
      );
      if (
        !booking ||
        !["confirmed", "pending_payment"].includes(booking.status)
      )
        return res
          .status(409)
          .json({ message: "Booking cannot be rescheduled." });
      const oldLocks = await ResourceLock.find({ booking: booking._id }).lean(),
        seatIds = booking.seats?.length
          ? booking.seats.map(String)
          : booking.seat
            ? [String(booking.seat)]
            : [],
        keys = seatIds.length
          ? seatIds.map((id) => resourceKey(booking.workspace._id, id))
          : [resourceKey(booking.workspace._id)];
      await ResourceLock.deleteMany({ booking: booking._id });
      try {
        const slots = slotsBetween(req.validated.startAt, req.validated.endAt);
        await ResourceLock.insertMany(
          keys.flatMap((key) =>
            slots.map((slotStart) => ({
              resourceKey: key,
              slotStart,
              booking: booking._id,
            })),
          ),
          { ordered: true },
        );
      } catch (error) {
        if (oldLocks.length)
          await ResourceLock.insertMany(
            oldLocks.map(({ _id, createdAt, updatedAt, ...lock }) => lock),
            { ordered: false },
          );
        throw Object.assign(
          new Error(
            "The new time conflicts with another booking or maintenance window.",
          ),
          { status: 409 },
        );
      }
      const unitQuote = calculateQuote(
          booking.workspace,
          booking.durationType,
          req.validated.startAt,
          req.validated.endAt,
        ),
        quantity = Math.max(1, seatIds.length),
        quote = {
          base: unitQuote.base * quantity,
          tax: unitQuote.tax * quantity,
          total: unitQuote.total * quantity,
        };
      booking.startAt = req.validated.startAt;
      booking.endAt = req.validated.endAt;
      booking.amount = quote.base;
      booking.tax = quote.tax;
      booking.total = quote.total;
      booking.rescheduledAt = new Date();
      booking.rescheduledBy = req.user._id;
      await booking.save();
      await audit(req, "booking.rescheduled", "Booking", booking._id);
      req.app.get("io").emit("availability:update", {
        workspaceId: booking.workspace._id,
        seatIds,
        reason: "rescheduled",
      });
      req.app.get("io").emit("operations:update", {
        resource: "booking",
        action: "rescheduled",
        id: booking._id,
      });
      notifyBooking(booking, "rescheduled").catch(() => {});
      res.json({ item: booking });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/bookings/:id/refund",
  authorize("super_admin"),
  validate(z.object({ amount: z.number().positive().optional() })),
  async (req, res, next) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (
        !booking ||
        !["paid", "partially_refunded"].includes(booking.payment.status)
      )
        return res
          .status(409)
          .json({ message: "This booking has no refundable payment." });
      const already = booking.payment.refundAmount || 0,
        amount = req.validated.amount || booking.total - already;
      if (amount <= 0 || already + amount > booking.total)
        return res.status(422).json({ message: "Refund amount is invalid." });
      const result = await refundPayment(booking, amount);
      booking.payment.refundId = String(result.refundId);
      booking.payment.refundAmount = already + amount;
      booking.payment.refundStatus = result.status;
      booking.payment.status =
        booking.payment.refundAmount >= booking.total
          ? "refunded"
          : "partially_refunded";
      await booking.save();
      await audit(req, "booking.refund_created", "Booking", booking._id, {
        amount,
        status: result.status,
      });
      req.app.get("io").emit("operations:update", {
        resource: "booking",
        action: "refunded",
        id: booking._id,
      });
      notifyBooking(booking, "refunded").catch(() => {});
      res.json({ item: booking, refund: result });
    } catch (e) {
      next(e);
    }
  },
);

router.get("/reports", async (req, res, next) => {
  try {
    const [from, to] = reportBounds(req.query.from, req.query.to),
      match = { createdAt: { $gte: from, $lte: to } };
    const [summary, daily, spaces] = await Promise.all([
      Booking.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            bookings: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [{ $eq: ["$payment.status", "paid"] }, "$total", 0],
              },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
            },
          },
        },
      ]),
      Booking.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Asia/Kolkata",
              },
            },
            bookings: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [{ $eq: ["$payment.status", "paid"] }, "$total", 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Booking.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$workspace",
            bookings: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [{ $eq: ["$payment.status", "paid"] }, "$total", 0],
              },
            },
          },
        },
        { $sort: { bookings: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "workspaces",
            localField: "_id",
            foreignField: "_id",
            as: "workspace",
          },
        },
        { $unwind: "$workspace" },
        { $project: { name: "$workspace.name", bookings: 1, revenue: 1 } },
      ]),
    ]);
    res.json({
      from,
      to,
      summary: summary[0] || { bookings: 0, revenue: 0, cancelled: 0 },
      daily,
      spaces,
    });
  } catch (e) {
    next(e);
  }
});
router.get("/reports.csv", async (req, res, next) => {
  try {
    const from = req.query.from
        ? new Date(req.query.from)
        : new Date(Date.now() - 30 * 86400000),
      to = req.query.to ? new Date(req.query.to) : new Date();
    to.setHours(23, 59, 59, 999);
    const items = await Booking.find({ createdAt: { $gte: from, $lte: to } })
      .populate("workspace")
      .sort({ createdAt: -1 })
      .lean();
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      [
        "Booking ID",
        "Created",
        "Customer",
        "Email",
        "Workspace",
        "Start",
        "End",
        "Total",
        "Payment",
        "Status",
      ],
      ...items.map((item) => [
        item.bookingId,
        item.createdAt.toISOString(),
        item.customer?.name,
        item.customer?.email,
        item.workspace?.name,
        item.startAt.toISOString(),
        item.endAt.toISOString(),
        item.total,
        item.payment?.status,
        item.status,
      ]),
    ];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="workspace-report.csv"',
    );
    res.send(rows.map((row) => row.map(quote).join(",")).join("\n"));
  } catch (e) {
    next(e);
  }
});
router.get("/reports.pdf", async (req, res, next) => {
  try {
    const from = req.query.from
        ? new Date(req.query.from)
        : new Date(Date.now() - 30 * 86400000),
      to = req.query.to ? new Date(req.query.to) : new Date();
    to.setHours(23, 59, 59, 999);
    const match = { createdAt: { $gte: from, $lte: to } },
      [items, summary, daily, spaces] = await Promise.all([
        Booking.find(match)
          .populate("workspace")
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
        Booking.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              bookings: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [{ $eq: ["$payment.status", "paid"] }, "$total", 0],
                },
              },
              cancelled: {
                $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
              },
            },
          },
        ]),
        Booking.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              revenue: {
                $sum: {
                  $cond: [{ $eq: ["$payment.status", "paid"] }, "$total", 0],
                },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Booking.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$workspace",
              bookings: { $sum: 1 },
              revenue: {
                $sum: {
                  $cond: [{ $eq: ["$payment.status", "paid"] }, "$total", 0],
                },
              },
            },
          },
          { $sort: { bookings: -1 } },
          { $limit: 8 },
          {
            $lookup: {
              from: "workspaces",
              localField: "_id",
              foreignField: "_id",
              as: "workspace",
            },
          },
          { $unwind: "$workspace" },
          { $project: { name: "$workspace.name", bookings: 1, revenue: 1 } },
        ]),
      ]),
      totals = summary[0] || { bookings: 0, revenue: 0, cancelled: 0 };
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="TWS-report-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.pdf"`,
    );
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      info: { Title: "TWS Operations Report" },
    });
    doc.pipe(res);
    const green = "#123b35",
      orange = "#e78545",
      ink = "#17211f",
      muted = "#69746f",
      cream = "#f5f1e9",
      page = doc.page.width,
      usable = page - 84,
      moneyText = (value) =>
        `INR ${Number(value || 0).toLocaleString("en-IN")}`;
    doc.rect(0, 0, page, 124).fill("#090909");
    doc
      .font("Helvetica-Bold")
      .fontSize(28)
      .fillColor(orange)
      .text("TWS", 42, 34);
    doc
      .fontSize(19)
      .fillColor("#fff")
      .text("OPERATIONS REPORT", page - 270, 38, {
        width: 228,
        align: "right",
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#aaa")
      .text(
        `${from.toLocaleDateString("en-IN")} to ${to.toLocaleDateString("en-IN")}`,
        page - 270,
        67,
        { width: 228, align: "right" },
      );
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(green)
      .text("Performance summary", 42, 154);
    const cards = [
      ["BOOKINGS", totals.bookings],
      ["PAID REVENUE", moneyText(totals.revenue)],
      ["CANCELLED", totals.cancelled],
      [
        "SUCCESS RATE",
        `${Math.round(((totals.bookings - totals.cancelled) / Math.max(1, totals.bookings)) * 100)}%`,
      ],
    ];
    cards.forEach(([label, value], index) => {
      const x = 42 + index * (usable / 4);
      doc
        .roundedRect(x, 180, usable / 4 - 8, 70, 8)
        .fill(index === 1 ? "#fff0e5" : cream);
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(muted)
        .text(label, x + 12, 195);
      doc
        .font("Helvetica-Bold")
        .fontSize(index === 1 ? 12 : 17)
        .fillColor(index === 1 ? orange : ink)
        .text(String(value), x + 12, 216, { width: usable / 4 - 32 });
    });
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(green)
      .text("Revenue trend", 42, 282);
    const chartY = 315,
      chartH = 125,
      max = Math.max(1, ...daily.map((day) => day.revenue)),
      barW = Math.max(
        8,
        Math.min(26, (usable - 20) / Math.max(1, daily.length) - 5),
      );
    doc
      .moveTo(42, chartY + chartH)
      .lineTo(page - 42, chartY + chartH)
      .strokeColor("#d8ddd9")
      .stroke();
    daily.slice(-31).forEach((day, index) => {
      const height = Math.max(2, (day.revenue / max) * (chartH - 24)),
        x =
          48 +
          index * ((usable - 12) / Math.max(1, Math.min(31, daily.length)));
      doc
        .rect(x, chartY + chartH - height, barW, height)
        .fill(index % 2 ? green : orange);
      if (daily.length <= 16)
        doc
          .font("Helvetica")
          .fontSize(5.5)
          .fillColor(muted)
          .text(day._id.slice(5), x - 3, chartY + chartH + 5, {
            width: barW + 8,
            align: "center",
          });
    });
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(green)
      .text("Most booked workspaces", 42, 480);
    let y = 510;
    spaces.forEach((space, index) => {
      if (index % 2 === 0) doc.rect(42, y - 7, usable, 31).fill("#faf9f6");
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(ink)
        .text(`${index + 1}. ${space.name}`, 52, y, { width: 250 });
      doc
        .font("Helvetica")
        .fillColor(muted)
        .text(`${space.bookings} bookings`, 320, y, { width: 90 });
      doc
        .font("Helvetica-Bold")
        .fillColor(orange)
        .text(moneyText(space.revenue), 420, y, { width: 90, align: "right" });
      y += 31;
    });
    doc.addPage();
    doc.rect(0, 0, page, 78).fill("#090909");
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#fff")
      .text("Booking details", 42, 29);
    y = 105;
    const headers = ["BOOKING", "CUSTOMER", "WORKSPACE", "TOTAL", "STATUS"],
      widths = [82, 120, 145, 72, 80],
      xs = widths.reduce(
        (all, width, index) => [...all, index ? all[index - 1] + width : 42],
        [],
      );
    headers.forEach((header, index) =>
      doc
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor(muted)
        .text(header, xs[index], y, { width: widths[index] - 5 }),
    );
    y += 18;
    items.forEach((item, index) => {
      if (y > 750) {
        doc.addPage();
        y = 55;
      }
      if (index % 2 === 0) doc.rect(42, y - 7, usable, 31).fill("#faf9f6");
      const values = [
        item.bookingId,
        item.customer?.name || "—",
        item.workspace?.name || "—",
        moneyText(item.total),
        String(item.status).replaceAll("_", " "),
      ];
      values.forEach((value, index) =>
        doc
          .font(index === 0 ? "Helvetica-Bold" : "Helvetica")
          .fontSize(7)
          .fillColor(ink)
          .text(String(value), xs[index], y, {
            width: widths[index] - 5,
            ellipsis: true,
          }),
      );
      y += 31;
    });
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index++) {
      doc.switchToPage(index);
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#888")
        .text(
          `TWS · The Work Suites · Page ${index + 1} of ${range.count}`,
          42,
          812,
          { width: usable, align: "center" },
        );
    }
    doc.end();
  } catch (e) {
    next(e);
  }
});
router.get("/audit", authorize("super_admin"), async (req, res, next) => {
  try {
    res.json({
      items: await AuditLog.find()
        .populate("actor", "name email role")
        .sort({ createdAt: -1 })
        .limit(250)
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
router.get("/payments", async (req, res, next) => {
  try {
    const items = await Booking.find()
      .select("bookingId customer total payment status createdAt")
      .sort({ createdAt: -1 })
      .limit(250)
      .lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

const couponBase = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(80),
  discountType: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  active: z.boolean().default(true),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  usageLimit: z.number().int().min(0).default(0),
});
const couponInput = couponBase
  .refine((value) => value.discountType !== "percent" || value.value <= 100, {
    message: "Percentage discount cannot exceed 100%.",
    path: ["value"],
  })
  .refine(
    (value) =>
      !value.startsAt || !value.endsAt || value.endsAt > value.startsAt,
    { message: "End date must be after start date.", path: ["endsAt"] },
  );
const couponUpdate = couponBase.partial().superRefine((value, ctx) => {
  if (value.discountType === "percent" && value.value > 100)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "Percentage discount cannot exceed 100%.",
    });
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "End date must be after start date.",
    });
});
router.get("/coupons", async (req, res, next) => {
  try {
    res.json({ items: await Coupon.find().sort({ createdAt: -1 }).lean() });
  } catch (e) {
    next(e);
  }
});
router.post("/coupons", validate(couponInput), async (req, res, next) => {
  try {
    const item = await Coupon.create(req.validated);
    await audit(req, "coupon.created", "Coupon", item._id, { code: item.code });
    res.status(201).json({ item });
  } catch (e) {
    next(e);
  }
});
router.patch("/coupons/:id", validate(couponUpdate), async (req, res, next) => {
  try {
    const item = await Coupon.findByIdAndUpdate(req.params.id, req.validated, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ message: "Offer not found." });
    await audit(req, "coupon.updated", "Coupon", item._id, { code: item.code });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});
router.delete("/coupons/:id", async (req, res, next) => {
  try {
    const item = await Coupon.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Offer not found." });
    await audit(req, "coupon.deleted", "Coupon", item._id, { code: item.code });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

const notificationInput = z
  .object({
    title: z.string().trim().min(2).max(100),
    message: z.string().trim().min(3).max(600),
    delivery: z
      .enum(["all_customers", "selected_customers"])
      .default("all_customers"),
    recipientIds: z.array(z.string()).max(200).default([]),
    status: z.enum(["draft", "sent"]).default("draft"),
  })
  .superRefine((value, ctx) => {
    if (value.delivery === "selected_customers" && !value.recipientIds.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientIds"],
        message: "Select at least one customer.",
      });
  });
router.get("/notifications", async (req, res, next) => {
  try {
    res.json({
      items: await Notification.find()
        .populate("createdBy", "name email")
        .populate("recipients", "name email")
        .sort({ createdAt: -1 })
        .limit(250)
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  "/notifications",
  validate(notificationInput),
  async (req, res, next) => {
    try {
      const { delivery, recipientIds, status, ...content } = req.validated,
        recipients = delivery === "selected_customers" ? recipientIds : [],
        item = await Notification.create({
          ...content,
          audience: delivery,
          recipients,
          kind: "announcement",
          status,
          createdBy: req.user._id,
          sentAt: status === "sent" ? new Date() : undefined,
        });
      await audit(req, "notification.created", "Notification", item._id, {
        audience: item.audience,
        recipients: recipients.length,
        status: item.status,
      });
      req.app.get("io").emit("operations:update", {
        resource: "notification",
        action: item.status,
      });
      res.status(201).json({ item });
    } catch (e) {
      next(e);
    }
  },
);
router.patch("/notifications/:id/send", async (req, res, next) => {
  try {
    const item = await Notification.findByIdAndUpdate(
      req.params.id,
      { status: "sent", sentAt: new Date() },
      { new: true },
    );
    if (!item)
      return res.status(404).json({ message: "Notification not found." });
    await audit(req, "notification.sent", "Notification", item._id, {
      audience: item.audience,
    });
    req.app
      .get("io")
      .emit("operations:update", { resource: "notification", action: "sent" });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});
router.delete("/notifications/:id", async (req, res, next) => {
  try {
    const item = await Notification.findOneAndDelete({
      _id: req.params.id,
      status: "draft",
    });
    if (!item)
      return res
        .status(409)
        .json({ message: "Only draft notifications can be removed." });
    await audit(req, "notification.deleted", "Notification", item._id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.get("/content", async (req, res, next) => {
  try {
    res.json({ items: await SiteContent.find().sort({ key: 1 }).lean() });
  } catch (e) {
    next(e);
  }
});
router.put(
  "/content/:key",
  validate(
    z.object({
      title: z.string().trim().min(2).max(120),
      body: z.string().trim().min(3).max(2000),
      published: z.boolean().default(true),
    }),
  ),
  async (req, res, next) => {
    try {
      const item = await SiteContent.findOneAndUpdate(
        { key: req.params.key },
        { ...req.validated, key: req.params.key, updatedBy: req.user._id },
        { upsert: true, new: true, runValidators: true },
      );
      await audit(req, "content.updated", "SiteContent", item._id, {
        key: item.key,
        published: item.published,
      });
      res.json({ item });
    } catch (e) {
      next(e);
    }
  },
);

router.get("/admins", async (req, res, next) => {
  try {
    res.json({
      items: await User.find({ role: "super_admin" })
        .sort({ createdAt: -1 })
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  "/admins",
  validate(
    z.object({
      name: z.string().trim().min(2).max(80),
      email: z
        .string()
        .email()
        .transform((value) => value.toLowerCase()),
      password: z.string().min(8).max(128),
    }),
  ),
  async (req, res, next) => {
    try {
      if (await User.exists({ email: req.validated.email }))
        return res
          .status(409)
          .json({ message: "An account already exists with this email." });
      const credentials = hashValue(req.validated.password);
      const item = await User.create({
        name: req.validated.name,
        email: req.validated.email,
        passwordHash: credentials.hash,
        passwordSalt: credentials.salt,
        role: "super_admin",
        emailVerified: true,
      });
      await audit(req, "admin.created", "User", item._id, {
        email: item.email,
      });
      res.status(201).json({ item });
    } catch (e) {
      next(e);
    }
  },
);
router.get("/workspaces", async (req, res, next) => {
  try {
    res.json({
      items: await Workspace.find().sort({ floor: 1, name: 1 }).lean(),
    });
  } catch (e) {
    next(e);
  }
});

router.get("/maintenance", async (req, res, next) => {
  try {
    res.json({
      items: await Maintenance.find({
        status: { $in: ["scheduled", "active"] },
        endAt: { $gt: new Date() },
      })
        .populate("workspace seat createdBy")
        .sort({ startAt: 1 })
        .limit(200)
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
const maintenanceInput = z
  .object({
    workspaceId: z.string(),
    seatIds: z.array(z.string()).optional(),
    reason: z.string().min(3),
    notes: z.string().optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  })
  .refine((d) => d.startAt >= new Date(Date.now() - 60_000), {
    message: "Maintenance cannot start in the past.",
    path: ["startAt"],
  })
  .refine((d) => d.endAt > d.startAt, {
    message: "Maintenance end time must be after its start time.",
    path: ["endAt"],
  });
router.post(
  "/maintenance",
  validate(maintenanceInput),
  async (req, res, next) => {
    const created = [];
    try {
      const seatIds = req.validated.seatIds?.length
        ? req.validated.seatIds
        : [null];
      for (const seatId of seatIds) {
        const maintenance = await Maintenance.create({
          workspace: req.validated.workspaceId,
          seat: seatId || undefined,
          reason: req.validated.reason,
          notes: req.validated.notes,
          startAt: req.validated.startAt,
          endAt: req.validated.endAt,
          createdBy: req.user._id,
        });
        try {
          await ResourceLock.insertMany(
            slotsBetween(req.validated.startAt, req.validated.endAt).map(
              (slotStart) => ({
                resourceKey: resourceKey(req.validated.workspaceId, seatId),
                slotStart,
                maintenance: maintenance._id,
              }),
            ),
          );
          created.push(maintenance);
        } catch (error) {
          await Maintenance.findByIdAndDelete(maintenance._id);
          throw Object.assign(
            new Error(
              "A booking or hold conflicts with this maintenance window.",
            ),
            { status: 409 },
          );
        }
      }
      req.app.get("io").emit("availability:update", {
        workspaceId: req.validated.workspaceId,
        reason: "maintenance_created",
      });
      req.app.get("io").emit("operations:update", {
        resource: "maintenance",
        action: "created",
      });
      res.status(201).json({ items: created });
    } catch (e) {
      next(e);
    }
  },
);
router.patch("/maintenance/:id/cancel", async (req, res, next) => {
  try {
    const item = await Maintenance.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { new: true },
    );
    if (!item)
      return res.status(404).json({ message: "Maintenance record not found." });
    await ResourceLock.deleteMany({ maintenance: item._id });
    req.app.get("io").emit("availability:update", {
      workspaceId: item.workspace,
      seatId: item.seat,
      reason: "maintenance_cancelled",
    });
    req.app.get("io").emit("operations:update", {
      resource: "maintenance",
      action: "cancelled",
      id: item._id,
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});
router.get("/users", async (req, res, next) => {
  try {
    res.json({
      items: await User.find({ role: { $in: ["customer", "super_admin"] } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    });
  } catch (e) {
    next(e);
  }
});
router.patch(
  "/users/:id/active",
  authorize("super_admin"),
  validate(z.object({ active: z.boolean() })),
  async (req, res, next) => {
    try {
      if (String(req.user._id) === req.params.id && !req.validated.active)
        return res
          .status(409)
          .json({ message: "You cannot deactivate your own account." });
      const item = await User.findByIdAndUpdate(
        req.params.id,
        { active: req.validated.active },
        { new: true },
      );
      await audit(req, "user.active_changed", "User", item?._id, {
        active: req.validated.active,
      });
      req.app.get("io").emit("operations:update", {
        resource: "user",
        action: "active_changed",
        id: item?._id,
      });
      res.json({ item });
    } catch (e) {
      next(e);
    }
  },
);
router.get("/seats", async (req, res, next) => {
  try {
    const items = await Seat.find()
      .populate("workspace")
      .sort({ floor: 1, number: 1 })
      .lean();
    const currentSlot = new Date(Math.floor(Date.now() / 900000) * 900000);
    const resourceKeys = [
      ...items.map((item) => `seat:${item._id}`),
      ...new Set(
        items
          .map((item) => item.workspace?._id)
          .filter(Boolean)
          .map((workspaceId) => `workspace:${workspaceId}`),
      ),
    ];
    const locks = await ResourceLock.find({
      resourceKey: { $in: resourceKeys },
      slotStart: currentSlot,
    })
      .populate(
        "booking",
        "bookingId customer startAt endAt total payment status",
      )
      .lean();
    const live = new Map(
      locks.map((lock) => [
        lock.resourceKey,
        {
          availability: lock.maintenance
            ? "maintenance"
            : lock.hold
              ? "held"
              : lock.booking
                ? "booked"
                : "blocked",
          booking: lock.booking || undefined,
        },
      ]),
    );
    res.json({
      items: items.map((item) => {
        const seatState = live.get(`seat:${item._id}`),
          workspaceState = live.get(`workspace:${item.workspace?._id}`),
          state = seatState || workspaceState,
          workspaceStatus = item.workspace?.status;
        return {
          ...item,
          availability:
            workspaceStatus && workspaceStatus !== "active"
              ? workspaceStatus
              : item.status !== "active"
                ? item.status
                : state?.availability || "available",
          booking: state?.booking,
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  "/seats",
  validate(
    z.object({
      workspaceId: z.string(),
      number: z.string().min(1),
      floor: z.string().min(1),
      zone: z.string().optional(),
      status: z
        .enum(["active", "maintenance", "blocked", "inactive"])
        .default("active"),
      bookable: z.boolean().default(true),
    }),
  ),
  async (req, res, next) => {
    try {
      const { workspaceId, ...data } = req.validated;
      const item = await Seat.create({ ...data, workspace: workspaceId });
      await audit(req, "seat.created", "Seat", item._id);
      req.app.get("io").emit("operations:update", {
        resource: "seat",
        action: "created",
        id: item._id,
      });
      res.status(201).json({ item });
    } catch (e) {
      next(e);
    }
  },
);
router.patch("/seats/:id", async (req, res, next) => {
  try {
    const item = await Seat.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    await audit(req, "seat.updated", "Seat", item?._id, req.body);
    req.app.get("io").emit("availability:update", {
      workspaceId: item?.workspace,
      seatId: item?._id,
      reason: "seat_updated",
    });
    req.app.get("io").emit("operations:update", {
      resource: "seat",
      action: "updated",
      id: item?._id,
    });
    res.json({ item });
  } catch (e) {
    next(e);
  }
});
export default router;
