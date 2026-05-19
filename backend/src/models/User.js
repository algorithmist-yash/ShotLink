const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    defaultWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    lastLoginAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    compliance: {
      policyVersion: { type: String, default: "" },
      termsAcceptedAt: { type: Date, default: null },
      privacyAcceptedAt: { type: Date, default: null },
      analyticsAcceptedAt: { type: Date, default: null },
      lawfulUseAcceptedAt: { type: Date, default: null },
      ageConfirmedAt: { type: Date, default: null },
      marketingOptIn: { type: Boolean, default: false },
      marketingOptInAt: { type: Date, default: null },
      consentIpHash: { type: String, default: "" },
      consentUserAgent: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
