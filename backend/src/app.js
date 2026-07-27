const express = require("express");
const cors = require("cors");

const app = express();
const authRoutes = require("./routes/authRoutes");
const billingRoutes = require("./routes/billingRoutes");
const linkRoutes = require("./routes/linkRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const urlRoutes = require("./routes/urlRoutes");

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

app.disable("x-powered-by");
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

app.set("trust proxy", true);
app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowOpenCorsInDevelopment ||
        allowedOrigins.includes(normalizeOrigin(origin))
      ) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
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
  res.json({
    status: "ok",
    service: "shotlink",
    timestamp: new Date().toISOString(),
  });
});

app.use("/", urlRoutes);

module.exports = app;
