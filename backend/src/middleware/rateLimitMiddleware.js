const crypto = require("node:crypto");

const RateLimitBucket = require("../models/RateLimitBucket");
const { extractClientIp } = require("../utils/deviceInfo");

function buildBucketId(keyPrefix, clientIp, windowStartedAt) {
  const salt = process.env.IP_HASH_SALT || "local-development-salt";

  return crypto
    .createHash("sha256")
    .update(`${salt}:${keyPrefix}:${clientIp || "unknown"}:${windowStartedAt}`)
    .digest("hex");
}

async function consumeRateLimit({ bucketId, expiresAt }) {
  const bucket = await RateLimitBucket.findOneAndUpdate(
    { _id: bucketId },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt },
    },
    {
      returnDocument: "after",
      setDefaultsOnInsert: false,
      upsert: true,
    }
  );

  return Number(bucket.count);
}

function setResponseHeader(res, name, value) {
  if (typeof res.set === "function") {
    res.set(name, value);
    return;
  }

  if (typeof res.setHeader === "function") {
    res.setHeader(name, value);
  }
}

function createRateLimiter({
  windowMs,
  max,
  keyPrefix = "global",
  consume = consumeRateLimit,
  clock = Date.now,
}) {
  return async (req, res, next) => {
    const now = clock();
    const windowStartedAt = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStartedAt + windowMs;
    const bucketId = buildBucketId(
      keyPrefix,
      extractClientIp(req),
      windowStartedAt
    );

    try {
      const count = await consume({
        bucketId,
        expiresAt: new Date(resetAt + windowMs),
      });
      if (!Number.isFinite(count) || count < 1) {
        throw new Error("Rate limit store returned an invalid count");
      }
      const remaining = Math.max(max - count, 0);

      setResponseHeader(res, "RateLimit-Limit", String(max));
      setResponseHeader(res, "RateLimit-Remaining", String(remaining));
      setResponseHeader(res, "RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

      if (count > max) {
        setResponseHeader(
          res,
          "Retry-After",
          String(Math.max(Math.ceil((resetAt - now) / 1000), 1))
        );
        return res.status(429).json({
          error: "Too many requests. Please wait a moment and try again.",
        });
      }

      return next();
    } catch (error) {
      console.error("Rate limit store failed:", error.message);
      return res.status(503).json({
        error: "Request protection is temporarily unavailable. Please try again shortly.",
      });
    }
  };
}

const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  keyPrefix: "auth",
});

const writeRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  keyPrefix: "write",
});

module.exports = {
  authRateLimit,
  buildBucketId,
  consumeRateLimit,
  createRateLimiter,
  writeRateLimit,
};
