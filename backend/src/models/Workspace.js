const mongoose = require("mongoose");

const workspaceMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const customDomainSchema = new mongoose.Schema(
  {
    hostname: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ["pending", "verified", "disabled"],
      default: "pending",
    },
    verificationToken: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    lastCheckedAt: { type: Date, default: null },
    lastVerificationError: { type: String, default: "" },
  },
  { _id: false }
);

const managedEmailDomainSchema = new mongoose.Schema(
  {
    hostname: { type: String, required: true, trim: true, lowercase: true },
    status: {
      type: String,
      enum: ["pending", "verified", "disabled"],
      default: "pending",
    },
    verificationToken: { type: String, required: true },
    verifiedAt: { type: Date, default: null },
    lastCheckedAt: { type: Date, default: null },
    lastVerificationError: { type: String, default: "" },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, index: true },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspaceType: {
      type: String,
      enum: ["creator", "institution"],
      default: "creator",
      index: true,
    },
    plan: {
      type: String,
      enum: ["free", "pro", "business", "enterprise"],
      default: "free",
    },
    billing: {
      status: {
        type: String,
        enum: ["inactive", "pending", "active", "past_due"],
        default: "inactive",
      },
      currentPeriodEndsAt: { type: Date, default: null },
      lastPaymentAt: { type: Date, default: null },
      lastPaymentReference: { type: String, default: "" },
      billingEmail: { type: String, default: "" },
      provider: { type: String, default: "" },
      providerCustomerId: { type: String, default: "" },
      providerSubscriptionId: { type: String, default: "" },
      cancelAtCycleEnd: { type: Boolean, default: false },
      subscriptionCreationReference: { type: String, default: "" },
      subscriptionCreationPlanId: {
        type: String,
        enum: ["", "pro", "business"],
        default: "",
      },
      subscriptionCreationStartedAt: { type: Date, default: null },
      linkCreationVersion: { type: Number, default: 0, min: 0 },
    },
    members: {
      type: [workspaceMemberSchema],
      default: [],
    },
    customDomains: {
      type: [customDomainSchema],
      default: [],
    },
    managedEmailDomains: {
      type: [managedEmailDomainSchema],
      default: [],
    },
  },
  { timestamps: true }
);

workspaceSchema.index({ "customDomains.hostname": 1 }, { unique: true, sparse: true });
workspaceSchema.index(
  { "managedEmailDomains.hostname": 1 },
  { unique: true, sparse: true }
);

workspaceSchema.post("save", async function invalidateCachedEntitlement(workspace) {
  const { invalidateWorkspaceEntitlement } = require("../services/cacheInvalidationService");
  await invalidateWorkspaceEntitlement(workspace._id);
});

module.exports = mongoose.model("Workspace", workspaceSchema);
