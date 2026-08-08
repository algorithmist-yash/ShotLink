const crypto = require("node:crypto");

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest();
}

function getBearerToken(req) {
  const authorization =
    typeof req.get === "function" ? req.get("authorization") : req.headers?.authorization;

  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

function createMetricsAuth({ env = process.env } = {}) {
  return (req, res, next) => {
    const expectedToken = String(env.METRICS_TOKEN || "").trim();

    if (!expectedToken) {
      return res.status(404).json({
        error: "Route not found",
        requestId: req.id || null,
      });
    }

    const providedToken = getBearerToken(req);
    const isAuthorized =
      providedToken &&
      crypto.timingSafeEqual(hashToken(providedToken), hashToken(expectedToken));

    if (!isAuthorized) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="metrics"');
      return res.status(401).json({
        error: "Authentication required",
        requestId: req.id || null,
      });
    }

    return next();
  };
}

module.exports = {
  createMetricsAuth,
  getBearerToken,
  metricsAuth: createMetricsAuth(),
};
