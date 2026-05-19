const mongoose = require("mongoose");

const fallbackUrlSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    label: { type: String, required: true },
    priority: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    lastStatus: {
      type: String,
      enum: ["unknown", "healthy", "unhealthy"],
      default: "unknown",
    },
    lastStatusCode: { type: Number, default: null },
    lastCheckedAt: { type: Date, default: null },
    lastFailureReason: { type: String, default: "" },
  },
  { _id: false }
);

const urlSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    originalUrl: { type: String, required: true },
    shortCode: { type: String, required: true, unique: true },
    customDomainHost: { type: String, default: "", trim: true, lowercase: true, index: true },
    clicks: { type: Number, default: 0 },
    lastClickedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    primaryHealth: {
      status: {
        type: String,
        enum: ["unknown", "healthy", "unhealthy"],
        default: "unknown",
      },
      lastStatusCode: { type: Number, default: null },
      lastCheckedAt: { type: Date, default: null },
      lastFailureReason: { type: String, default: "" },
    },
    fallbackUrls: {
      type: [fallbackUrlSchema],
      default: [],
    },
    compliance: {
      policyVersion: { type: String, default: "" },
      acceptedAt: { type: Date, default: null },
      acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      destinationAuthorityAcceptedAt: { type: Date, default: null },
      securityScanAcceptedAt: { type: Date, default: null },
      abusePolicyAcceptedAt: { type: Date, default: null },
      consentIpHash: { type: String, default: "" },
      consentUserAgent: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

urlSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model("Url", urlSchema);
