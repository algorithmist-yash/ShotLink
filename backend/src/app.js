const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const { getLivenessResponse, getReadinessResponse } = require("./config/readiness");
const { getRedisState } = require("./config/redis");
const { getTrustProxySetting } = require("./config/proxy");
const { noStore } = require("./middleware/cacheControlMiddleware");
const { errorHandler, notFoundHandler } = require("./middleware/errorMiddleware");
const { metricsAuth } = require("./middleware/metricsAuthMiddleware");
const { requestMetrics } = require("./middleware/metricsMiddleware");
const { requestContext } = require("./middleware/requestContextMiddleware");
const { requestLogger } = require("./middleware/requestLoggerMiddleware");
const authRoutes = require("./routes/authRoutes");
const billingRoutes = require("./routes/billingRoutes");
const linkRoutes = require("./routes/linkRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const urlRoutes = require("./routes/urlRoutes");
const { metricsRegistry } = require("./services/metricsService");
const { getRedirectEventQueueDepth } = require("./services/redirectEventService");
const { getUrlHealthQueueDepth } = require("./services/urlHealthQueueService");

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

app.disable("x-powered-by");
app.use(requestContext);
app.use(requestLogger);
app.use(requestMetrics);
app.use(["/api", "/health", "/live", "/metrics"], noStore);
app.use(
  "/api/v1/billing/webhooks/razorpay",
  express.raw({ type: "application/json", limit: "256kb" })
);

const allowedOrigins = [
  ...String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean),
  normalizeOrigin(process.env.APP_BASE_URL),
  normalizeOrigin(process.env.FRONTEND_URL),
].filter(Boolean);
const allowOpenCorsInDevelopment =
  process.env.NODE_ENV !== "production" && allowedOrigins.length === 0;

app.set("trust proxy", getTrustProxySetting());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (
        !origin ||
        allowOpenCorsInDevelopment ||
        allowedOrigins.includes(normalizeOrigin(origin))
      ) {
        return callback(null, true);
      }

      const error = new Error("CORS origin not allowed");
      error.status = 403;
      error.expose = true;
      return callback(error);
    },
  })
);
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  next();
});
app.use(express.json({ limit: "32kb" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/links", linkRoutes);
app.use("/api/v1/workspace", workspaceRoutes);

app.get("/", (req, res) => {
  res.json({ status: "API running", service: "shotlink" });
});

app.get("/health", (req, res) => {
  const readiness = getReadinessResponse(
    mongoose.connection.readyState,
    new Date(),
    getRedisState()
  );

  res.status(readiness.statusCode).json(readiness.body);
});

app.get("/live", (req, res) => {
  const liveness = getLivenessResponse();

  res.status(liveness.statusCode).json(liveness.body);
});

app.get("/metrics", metricsAuth, async (req, res) => {
  for (const [queue, getDepth] of [
    ["redirect_event", getRedirectEventQueueDepth],
    ["url_health", getUrlHealthQueueDepth],
  ]) {
    try {
      const queueDepth = await getDepth();
      for (const [status, value] of Object.entries(queueDepth)) {
        metricsRegistry.setQueueDepth({ queue, status, value });
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          event: `${queue}_queue_metrics_failed`,
          error: error.message,
        })
      );
    }
  }

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(metricsRegistry.render());
});

app.use("/", urlRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
