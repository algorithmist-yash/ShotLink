const mongoose = require("mongoose");

const usageCounterSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    periodKey: { type: String, required: true, index: true },
    linksCreated: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    qrCodesCreated: { type: Number, default: 0 },
    apiRequests: { type: Number, default: 0 },
    webhookDeliveries: { type: Number, default: 0 },
  },
  { timestamps: true }
);

usageCounterSchema.index({ workspaceId: 1, periodKey: 1 }, { unique: true });

module.exports = mongoose.model("UsageCounter", usageCounterSchema);
