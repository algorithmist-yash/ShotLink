const REQUIRED_PRODUCTION_ENV = [
  "MONGO_URI",
  "REDIS_URL",
  "BASE_URL",
  "SHORTLINK_BASE_URL",
  "APP_BASE_URL",
  "IP_HASH_SALT",
  "CSRF_SECRET",
  "ALLOWED_ORIGINS",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_PLAN_ID_PRO_MONTHLY",
  "RAZORPAY_PLAN_ID_BUSINESS_MONTHLY",
];

const REQUIRED_WORKER_ENV = ["MONGO_URI", "REDIS_URL"];

const DEPLOYMENT_ENV_MARKERS = [
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_PROJECT_ID",
  "RAILWAY_SERVICE_ID",
  "RENDER",
  "RENDER_SERVICE_ID",
];

function isDeployedEnvironment(env = process.env) {
  return DEPLOYMENT_ENV_MARKERS.some((key) => String(env[key] || "").trim());
}

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

function validateRuntimeEnv(env = process.env) {
  validateDeploymentMode(env);
  validateProductionEnv(env);

  const rawPort = String(env.PORT || "").trim();
  const port = Number(rawPort);

  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return { port };
}

function validateDeploymentMode(env = process.env) {
  if (isDeployedEnvironment(env) && env.NODE_ENV !== "production") {
    throw new Error("NODE_ENV must be production in a deployed environment");
  }
}

function validateWorkerEnv(env = process.env) {
  validateDeploymentMode(env);

  if (env.NODE_ENV !== "production") return {};

  const missing = REQUIRED_WORKER_ENV.filter(
    (key) => !String(env[key] || "").trim()
  );
  if (missing.length) {
    throw new Error(
      `Missing production worker environment variables: ${missing.join(", ")}`
    );
  }

  return {};
}

module.exports = {
  DEPLOYMENT_ENV_MARKERS,
  REQUIRED_PRODUCTION_ENV,
  REQUIRED_WORKER_ENV,
  isDeployedEnvironment,
  validateProductionEnv,
  validateRuntimeEnv,
  validateWorkerEnv,
};
