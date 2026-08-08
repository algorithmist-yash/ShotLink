const mongoose = require("mongoose");

const urlHealthJobSchema = new mongoose.Schema(
  {
    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Url",
      required: true,
    },
    active: { type: Boolean, default: true, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "dead"],
      default: "pending",
      required: true,
    },
    attempts: { type: Number, default: 0 },
    requestedAt: { type: Date, default: Date.now },
    availableAt: { type: Date, default: Date.now },
    leaseUntil: { type: Date, default: null },
    lastError: { type: String, default: "" },
    completedAt: { type: Date, default: null },
    deleteAfter: { type: Date, default: null },
  },
  { timestamps: true }
);

urlHealthJobSchema.index(
  { urlId: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: "url_health_jobs_one_active_per_url",
  }
);
urlHealthJobSchema.index(
  { status: 1, availableAt: 1, createdAt: 1 },
  { name: "url_health_jobs_pending" }
);
urlHealthJobSchema.index(
  { status: 1, leaseUntil: 1, createdAt: 1 },
  { name: "url_health_jobs_expired_leases" }
);
urlHealthJobSchema.index(
  { deleteAfter: 1 },
  { expireAfterSeconds: 0, name: "url_health_jobs_ttl" }
);

module.exports = mongoose.model("UrlHealthJob", urlHealthJobSchema);
