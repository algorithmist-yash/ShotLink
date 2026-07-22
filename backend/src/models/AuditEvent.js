const mongoose = require("mongoose");

const auditEventSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
      immutable: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      immutable: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      default: null,
      immutable: true,
    },
    action: { type: String, required: true, index: true, immutable: true },
    targetType: { type: String, required: true, immutable: true },
    targetId: { type: String, default: "", immutable: true },
    outcome: {
      type: String,
      enum: ["success", "denied", "failure"],
      default: "success",
      immutable: true,
    },
    requestId: { type: String, default: "", immutable: true },
    ipHash: { type: String, default: "", immutable: true },
    userAgent: { type: String, default: "", immutable: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
    expiresAt: { type: Date, required: true, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditEventSchema.index({ workspaceId: 1, createdAt: -1 });
auditEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "audit_events_ttl" });

module.exports = mongoose.model("AuditEvent", auditEventSchema);
