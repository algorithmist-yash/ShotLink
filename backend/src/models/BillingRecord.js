const mongoose = require("mongoose");

const billingRecordSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: { type: String, required: true, index: true },
    planName: { type: String, required: true },
    amountInPaise: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "cancelled", "expired", "failed", "partially_paid"],
      default: "created",
      index: true,
    },
    provider: { type: String, default: "razorpay" },
    paymentLinkId: { type: String, default: "", index: true },
    paymentLinkUrl: { type: String, default: "" },
    paymentId: { type: String, default: "" },
    orderId: { type: String, default: "" },
    referenceId: { type: String, required: true, unique: true, index: true },
    callbackUrl: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    rawLastEvent: { type: String, default: "" },
    webhookEventIds: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BillingRecord", billingRecordSchema);
