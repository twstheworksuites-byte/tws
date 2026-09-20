import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { AuditLog, Enquiry, Notification } from "../models.js";
import { authenticate, authorize, validate } from "../middleware.js";
import { config } from "../config.js";

const router = Router();
const leaseDetails = z.object({
  workspaceId: z.string().regex(/^[a-f\d]{24}$/i),
  workspaceName: z.string().trim().min(2).max(120),
  durationMonths: z.number().int().min(1).max(120),
  startDate: z.coerce.date(),
  endDate: z.string().trim().max(40),
  paymentFrequency: z.enum(["monthly", "quarterly", "half_yearly", "yearly"]),
  occupantCount: z.number().int().min(1).max(100),
  occupantNames: z.string().trim().max(500).optional().or(z.literal("")),
  purpose: z.enum([
    "company_office",
    "branch_office",
    "startup_team",
    "commercial",
    "other",
  ]),
});
const todayUtc = () => {
  const value = new Date();
  value.setUTCHours(0, 0, 0, 0);
  return value;
};
const input = z.object({
  name: z.string().trim().min(2).max(80),
  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .transform((value) => value.toLowerCase()),
  mobile: z.string().trim().min(7).max(20),
  company: z.string().trim().max(100).optional().or(z.literal("")),
  seats: z.number().int().min(1).max(100).optional(),
  preferredDate: z.coerce.date().optional(),
  workspaceType: z
    .enum([
      "hot_desk",
      "dedicated_desk",
      "private_cabin",
      "meeting_room",
      "conference_room",
      "phone_booth",
      "lease",
      "not_sure",
    ])
    .default("not_sure"),
  leaseDetails: leaseDetails.optional(),
  message: z.string().trim().max(800).optional().or(z.literal("")),
  consent: z.literal(true),
}).superRefine((value, context) => {
  if (value.preferredDate && value.preferredDate < todayUtc()) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Visit date cannot be in the past.", path: ["preferredDate"] });
  }
  if (value.leaseDetails?.startDate && value.leaseDetails.startDate < todayUtc()) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Lease move-in date cannot be in the past.", path: ["leaseDetails", "startDate"] });
  }
});
const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env !== "production",
});

router.post("/", limiter, validate(input), async (req, res, next) => {
  try {
    const data = { ...req.validated };
    if (data.leaseDetails) {
      data.leaseDetails = {
        ...data.leaseDetails,
        workspace: data.leaseDetails.workspaceId,
        endDateLabel: data.leaseDetails.endDate,
      };
      delete data.leaseDetails.workspaceId;
      delete data.leaseDetails.endDate;
    }
    const item = await Enquiry.create(data);
    await Notification.create({
      title:
        item.workspaceType === "lease"
          ? "New lease request"
          : "New workspace enquiry",
      message: `${item.name} asked about ${item.workspaceType.replaceAll("_", " ")}${item.seats ? ` for ${item.seats} seat${item.seats === 1 ? "" : "s"}` : ""}.`,
      audience: "admins",
      kind: "system",
      status: "sent",
      sentAt: new Date(),
    });
    req.app
      .get("io")
      .emit("operations:update", {
        resource: "enquiry",
        action: "created",
        id: item._id,
      });
    res
      .status(201)
      .json({
        message: "Enquiry received.",
        item: { _id: item._id, createdAt: item.createdAt },
      });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate, authorize("super_admin"));
router.get("/", async (req, res, next) => {
  try {
    res.json({
      items: await Enquiry.find()
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(250)
        .lean(),
    });
  } catch (error) {
    next(error);
  }
});
router.patch(
  "/:id",
  validate(
    z.object({
      status: z.enum(["new", "contacted", "closed"]),
      adminNote: z.string().trim().max(500).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const item = await Enquiry.findByIdAndUpdate(
        req.params.id,
        { ...req.validated, reviewedBy: req.user._id, reviewedAt: new Date() },
        { new: true, runValidators: true },
      );
      if (!item) return res.status(404).json({ message: "Enquiry not found." });
      await AuditLog.create({
        actor: req.user._id,
        action: "enquiry.updated",
        entityType: "Enquiry",
        entityId: item._id,
        metadata: { status: item.status },
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
      req.app
        .get("io")
        .emit("operations:update", {
          resource: "enquiry",
          action: "updated",
          id: item._id,
        });
      res.json({ item });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
