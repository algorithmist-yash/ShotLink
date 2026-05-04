const express = require("express");
const cors = require("cors");

const app = express();
const authRoutes = require("./routes/authRoutes");
const billingRoutes = require("./routes/billingRoutes");
const linkRoutes = require("./routes/linkRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const urlRoutes = require("./routes/urlRoutes");

app.disable("x-powered-by");
app.use(
  "/api/v1/billing/webhooks/razorpay",
  express.raw({ type: "application/json" })
);

const allowedOrigins = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", true);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    },
  })
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.json());
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/links", linkRoutes);
app.use("/api/v1/workspace", workspaceRoutes);

app.get("/", (req, res) => {
  res.json({ status: "API running", service: "url-shortener" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "url-shortener",
    timestamp: new Date().toISOString(),
  });
});

app.use("/", urlRoutes);

module.exports = app;
