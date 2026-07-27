const buckets = new Map();

function getHeader(req, name) {
  if (typeof req.get === "function") {
    return req.get(name);
  }

  return req.headers?.[name.toLowerCase()];
}

function getClientKey(req, keyPrefix) {
  const forwardedFor = String(getHeader(req, "x-forwarded-for") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const ip = req.ip || forwardedFor[0] || req.socket?.remoteAddress || "unknown";

  return `${keyPrefix}:${ip}`;
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

function createRateLimiter({ windowMs, max, keyPrefix = "global" }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = getClientKey(req, keyPrefix);
    const currentBucket = buckets.get(key) || [];
    const freshHits = currentBucket.filter((timestamp) => now - timestamp < windowMs);
    const resetAt = freshHits[0] ? freshHits[0] + windowMs : now + windowMs;

    setResponseHeader(res, "RateLimit-Limit", String(max));
    setResponseHeader(res, "RateLimit-Remaining", String(Math.max(max - freshHits.length, 0)));
    setResponseHeader(res, "RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

    if (freshHits.length >= max) {
      buckets.set(key, freshHits);
      return res.status(429).json({
        error: "Too many requests. Please wait a moment and try again.",
      });
    }

    freshHits.push(now);
    buckets.set(key, freshHits);

    if (buckets.size > 10000) {
      for (const [bucketKey, timestamps] of buckets.entries()) {
        if (!timestamps.some((timestamp) => now - timestamp < windowMs)) {
          buckets.delete(bucketKey);
        }
      }
    }

    return next();
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
  createRateLimiter,
  writeRateLimit,
};
