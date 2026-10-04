import mongoose from "mongoose";
const { Schema, model } = mongoose;

const pricingSchema = new Schema(
  { hourly: Number, daily: Number, weekly: Number, monthly: Number },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: true,
    },
    passwordHash: { type: String, required: true, select: false },
    passwordSalt: { type: String, required: true, select: false },
    passwordChangedAt: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenSalt: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    verificationTokenHash: { type: String, select: false },
    verificationTokenSalt: { type: String, select: false },
    verificationTokenExpiresAt: { type: Date, select: false },
    emailVerified: { type: Boolean, default: false },
    loginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
    lastLoginAt: Date,
    name: { type: String, trim: true },
    mobile: String,
    company: String,
    gstin: String,
    billingAddress: String,
    role: {
      type: String,
      enum: ["customer", "super_admin"],
      default: "customer",
      index: true,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, required: true },
    type: {
      type: String,
      enum: [
        "hot_desk",
        "dedicated_desk",
        "private_cabin",
        "meeting_room",
        "conference_room",
        "phone_booth",
      ],
      index: true,
    },
    floor: { type: String, index: true },
    zone: String,
    capacity: Number,
    description: String,
    image: String,
    amenities: [String],
    pricing: pricingSchema,
    allowedDurations: [
      { type: String, enum: ["hourly", "daily", "weekly", "monthly"] },
    ],
    status: {
      type: String,
      enum: ["active", "maintenance", "blocked", "inactive"],
      default: "active",
      index: true,
    },
    bookable: { type: Boolean, default: true },
    map: { x: Number, y: Number, width: Number, height: Number },
  },
  { timestamps: true },
);

const seatSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    number: { type: String, required: true },
    floor: { type: String, index: true },
    zone: String,
    status: {
      type: String,
      enum: ["active", "maintenance", "blocked", "inactive"],
      default: "active",
      index: true,
    },
    bookable: { type: Boolean, default: true },
    map: { x: Number, y: Number, rotation: Number },
  },
  { timestamps: true },
);
seatSchema.index({ workspace: 1, number: 1 }, { unique: true });

const holdSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    seat: { type: Schema.Types.ObjectId, ref: "Seat" },
    seats: [{ type: Schema.Types.ObjectId, ref: "Seat" }],
    startAt: Date,
    endAt: Date,
    durationType: String,
    requestedCapacity: Number,
    quote: { base: Number, tax: Number, discount: Number, total: Number },
    status: {
      type: String,
      enum: ["active", "converted", "expired", "released"],
      default: "active",
    },
    expiresAt: { type: Date, index: { expires: 0 } },
  },
  { timestamps: true },
);

// One unique lock per resource and 15-minute slot is the database-level race barrier.
const lockSchema = new Schema(
  {
    resourceKey: { type: String, required: true },
    slotStart: { type: Date, required: true },
    hold: { type: Schema.Types.ObjectId, ref: "Hold" },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    maintenance: { type: Schema.Types.ObjectId, ref: "Maintenance" },
    expiresAt: { type: Date, index: { expires: 0 } },
  },
  { timestamps: true },
);
lockSchema.index({ resourceKey: 1, slotStart: 1 }, { unique: true });

const bookingSchema = new Schema(
  {
    bookingId: { type: String, unique: true, index: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    seat: { type: Schema.Types.ObjectId, ref: "Seat" },
    seats: [{ type: Schema.Types.ObjectId, ref: "Seat" }],
    hold: { type: Schema.Types.ObjectId, ref: "Hold" },
    source: { type: String, enum: ["online", "walk_in"], default: "online" },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    durationType: String,
    requestedCapacity: Number,
    amount: Number,
    tax: Number,
    discount: { type: Number, default: 0 },
    total: Number,
    couponCode: String,
    payment: {
      provider: String,
      orderId: String,
      paymentId: String,
      method: String,
      status: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
        default: "pending",
      },
      refundId: String,
      refundAmount: Number,
      refundStatus: String,
    },
    status: {
      type: String,
      enum: [
        "pending_payment",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "no_show",
      ],
      default: "pending_payment",
      index: true,
    },
    customer: {
      name: String,
      email: String,
      mobile: String,
      company: String,
      gstin: String,
    },
    checkInTokenHash: String,
    checkedInAt: Date,
    cancellation: {
      reason: String,
      requestedAt: Date,
      requestedBy: Schema.Types.ObjectId,
      status: {
        type: String,
        enum: ["requested", "approved", "rejected", "refunded"],
      },
      reviewedAt: Date,
      reviewedBy: Schema.Types.ObjectId,
      adminNote: String,
      refundStatus: {
        type: String,
        enum: ["pending", "not_required", "completed"],
      },
      refundCompletedAt: Date,
      cancelledAt: Date,
      cancelledBy: Schema.Types.ObjectId,
    },
    rescheduledAt: Date,
    rescheduledBy: Schema.Types.ObjectId,
    reminderSentAt: Date,
  },
  { timestamps: true },
);
bookingSchema.index({ workspace: 1, startAt: 1, endAt: 1, status: 1 });

const maintenanceSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    seat: { type: Schema.Types.ObjectId, ref: "Seat" },
    reason: { type: String, required: true },
    notes: String,
    startAt: Date,
    endAt: Date,
    status: {
      type: String,
      enum: ["scheduled", "active", "completed", "cancelled"],
      default: "scheduled",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
maintenanceSchema.index({ workspace: 1, seat: 1, startAt: 1, endAt: 1 });

const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, unique: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    subtotal: Number,
    tax: Number,
    total: Number,
    issuedAt: Date,
  },
  { timestamps: true },
);

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, index: true },
    entityId: Schema.Types.ObjectId,
    metadata: Schema.Types.Mixed,
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
);

const paymentEventSchema = new Schema(
  {
    eventId: { type: String, unique: true, sparse: true },
    eventType: String,
    orderId: { type: String, index: true },
    verified: Boolean,
    processedAt: Date,
  },
  { timestamps: true },
);

const couponSchema = new Schema(
  {
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      required: true,
    },
    name: { type: String, required: true },
    discountType: {
      type: String,
      enum: ["percent", "fixed"],
      default: "percent",
    },
    value: { type: Number, min: 0, required: true },
    active: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
    usageLimit: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

const notificationSchema = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    audience: {
      type: String,
      enum: ["customers", "admins", "all", "selected_customers"],
      default: "customers",
      index: true,
    },
    recipients: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    kind: {
      type: String,
      enum: [
        "announcement",
        "account",
        "booking",
        "cancellation",
        "refund",
        "system",
      ],
      default: "announcement",
      index: true,
    },
    booking: { type: Schema.Types.ObjectId, ref: "Booking" },
    status: {
      type: String,
      enum: ["draft", "sent"],
      default: "draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    sentAt: Date,
  },
  { timestamps: true },
);

const siteContentSchema = new Schema(
  {
    key: { type: String, unique: true, trim: true, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    published: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const enquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    seats: { type: Number, min: 1 },
    preferredDate: Date,
    workspaceType: {
      type: String,
      enum: [
        "hot_desk",
        "dedicated_desk",
        "private_cabin",
        "meeting_room",
        "conference_room",
        "phone_booth",
        "lease",
        "not_sure",
      ],
      default: "not_sure",
    },
    leaseDetails: {
      workspace: { type: Schema.Types.ObjectId, ref: "Workspace" },
      workspaceName: String,
      durationMonths: { type: Number, min: 1 },
      startDate: Date,
      endDateLabel: String,
      paymentFrequency: {
        type: String,
        enum: ["monthly", "quarterly", "half_yearly", "yearly"],
      },
      occupantCount: { type: Number, min: 1 },
      occupantNames: String,
      purpose: {
        type: String,
        enum: [
          "company_office",
          "branch_office",
          "startup_team",
          "commercial",
          "other",
        ],
      },
    },
    message: { type: String, trim: true },
    consent: { type: Boolean, required: true },
    source: { type: String, default: "website" },
    status: {
      type: String,
      enum: ["new", "contacted", "closed"],
      default: "new",
      index: true,
    },
    adminNote: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
  },
  { timestamps: true },
);

const leaseSchema = new Schema(
  {
    leaseId: { type: String, unique: true, required: true, index: true },
    enquiry: { type: Schema.Types.ObjectId, ref: "Enquiry" },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, lowercase: true, trim: true },
      mobile: String,
      company: String,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    durationMonths: { type: Number, min: 1, required: true },
    monthlyRent: { type: Number, min: 0, required: true },
    securityDeposit: { type: Number, min: 0, default: 0 },
    maintenanceCharges: { type: Number, min: 0, default: 0 },
    paymentFrequency: {
      type: String,
      enum: ["monthly", "quarterly", "half_yearly", "yearly"],
      default: "monthly",
    },
    noticePeriodMonths: { type: Number, min: 0, default: 0 },
    lockInMonths: { type: Number, min: 0, default: 0 },
    occupants: {
      count: { type: Number, min: 1, required: true },
      names: [String],
    },
    purpose: {
      type: String,
      enum: [
        "company_office",
        "branch_office",
        "startup_team",
        "commercial",
        "other",
      ],
      default: "company_office",
    },
    expectedMoveInDate: Date,
    amountPaid: { type: Number, min: 0, default: 0 },
    paymentDate: Date,
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    transactionReference: { type: String, trim: true },
    nextPaymentDate: Date,
    documents: {
      leaseAgreementUrl: { type: String, trim: true },
      signedAgreementUrl: { type: String, trim: true },
      paymentReceiptUrl: { type: String, trim: true },
      verificationStatus: {
        type: String,
        enum: ["not_started", "pending", "verified", "rejected"],
        default: "not_started",
      },
      agreementStatus: {
        type: String,
        enum: ["draft", "sent", "signed", "active", "expired", "terminated"],
        default: "draft",
      },
    },
    status: {
      type: String,
      enum: [
        "proposal",
        "agreement_pending",
        "active",
        "notice_period",
        "completed",
        "terminated",
      ],
      default: "proposal",
      index: true,
    },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
leaseSchema.index({ startDate: 1, endDate: 1, status: 1 });

export const User = model("User", userSchema);
export const Workspace = model("Workspace", workspaceSchema);
export const Seat = model("Seat", seatSchema);
export const Hold = model("Hold", holdSchema);
export const ResourceLock = model("ResourceLock", lockSchema);
export const Booking = model("Booking", bookingSchema);
export const Maintenance = model("Maintenance", maintenanceSchema);
export const Invoice = model("Invoice", invoiceSchema);
export const AuditLog = model("AuditLog", auditLogSchema);
export const PaymentEvent = model("PaymentEvent", paymentEventSchema);
export const Coupon = model("Coupon", couponSchema);
export const Notification = model("Notification", notificationSchema);
export const SiteContent = model("SiteContent", siteContentSchema);
export const Enquiry = model("Enquiry", enquirySchema);
export const Lease = model("Lease", leaseSchema);
