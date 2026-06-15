const REQUIRED_PRODUCTION_ENV = [
  "MONGO_URI",
  "BASE_URL",
  "APP_BASE_URL",
  "IP_HASH_SALT",
  "ALLOWED_ORIGINS",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_PLAN_ID_PRO_MONTHLY",
  "RAZORPAY_PLAN_ID_BUSINESS_MONTHLY",
];

function validateProductionEnv(env = process.env) {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !String(env[key] || "").trim());

  if (missing.length) {
    throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  }

  return [];
}

module.exports = {
  REQUIRED_PRODUCTION_ENV,
  validateProductionEnv,
};
