const mongoose = require("mongoose");

const redirectEventJobSchema = new mongoose.Schema(
  {
    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Url",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    shortCode: { type: String, required: true },
    clickedAt: { type: Date, required: true },
    deviceType: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "bot", "unknown"],
      default: "unknown",
    },
    browser: { type: String, default: "Unknown" },
    os: { type: String, default: "Unknown" },
    userAgent: { type: String, default: "" },
    referrer: { type: String, default: "" },
    ipHash: { type: String, default: "" },
    redirectTarget: { type: String, default: "" },
    redirectTargetKind: {
      type: String,
      enum: ["primary", "fallback", "none"],
      default: "none",
    },
    redirectStatus: { type: Number, required: true },
    healthRefreshRequested: { type: Boolean, default: false },
    analyticsRetentionDays: { type: Number, min: 1, max: 3650, default: 90 },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "dead"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    availableAt: { type: Date, default: Date.now, index: true },
    leaseUntil: { type: Date, default: null },
    lastError: { type: String, default: "" },
    completedAt: { type: Date, default: null },
    deleteAfter: { type: Date, default: null },
  },
  { timestamps: true }
);

redirectEventJobSchema.index(
  { status: 1, availableAt: 1, createdAt: 1 },
  { name: "redirect_jobs_available" }
);
redirectEventJobSchema.index(
  { deleteAfter: 1 },
  { expireAfterSeconds: 0, name: "redirect_jobs_ttl" }
);

module.exports = mongoose.model("RedirectEventJob", redirectEventJobSchema);
