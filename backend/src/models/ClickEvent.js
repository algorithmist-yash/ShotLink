const mongoose = require("mongoose");

const clickEventSchema = new mongoose.Schema(
  {
    ingestionKey: { type: String },
    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Url",
      required: true,
      index: true,
    },
    shortCode: { type: String, required: true, index: true },
    clickedAt: { type: Date, default: Date.now, index: true },
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
    redirectStatus: { type: Number, default: 302 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

clickEventSchema.index({ urlId: 1, clickedAt: -1 });
clickEventSchema.index({ shortCode: 1, clickedAt: -1 });
clickEventSchema.index(
  { ingestionKey: 1 },
  { unique: true, sparse: true, name: "click_event_ingestion_unique" }
);
clickEventSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "click_events_ttl" }
);

module.exports = mongoose.model("ClickEvent", clickEventSchema);
