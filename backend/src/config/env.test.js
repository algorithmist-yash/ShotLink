const assert = require("node:assert/strict");
const test = require("node:test");

const {
  REQUIRED_PRODUCTION_ENV,
  REQUIRED_WORKER_ENV,
  isDeployedEnvironment,
  validateProductionEnv,
  validateRuntimeEnv,
  validateWorkerEnv,
} = require("./env");

test("validateProductionEnv skips checks outside production", () => {
  assert.deepEqual(validateProductionEnv({ NODE_ENV: "development" }), []);
});

test("validateProductionEnv throws when production secrets are missing", () => {
  assert.throws(
    () => validateProductionEnv({ NODE_ENV: "production" }),
    /Missing production environment variables/
  );
});

test("validateProductionEnv accepts a fully configured production environment", () => {
  const env = REQUIRED_PRODUCTION_ENV.reduce(
    (currentEnv, key) => ({
      ...currentEnv,
      [key]: "configured",
    }),
    { NODE_ENV: "production" }
  );

  assert.deepEqual(validateProductionEnv(env), []);
});

test("deployment metadata is detected independently of NODE_ENV", () => {
  assert.equal(isDeployedEnvironment({ RAILWAY_ENVIRONMENT: "production" }), true);
  assert.equal(isDeployedEnvironment({ RAILWAY_PROJECT_ID: "project-1" }), true);
  assert.equal(isDeployedEnvironment({ RENDER: "true" }), true);
  assert.equal(isDeployedEnvironment({ RENDER_SERVICE_ID: "service-1" }), true);
  assert.equal(isDeployedEnvironment({}), false);
});

test("deployed environments fail closed unless production mode is enabled", () => {
  assert.throws(
    () =>
      validateRuntimeEnv({
        PORT: "5000",
        RAILWAY_ENVIRONMENT: "production",
      }),
    /NODE_ENV must be production/
  );
});

test("runtime validation rejects ports that cannot be safely listened on", () => {
  for (const port of [undefined, "", "0", "65536", "5000.5", "not-a-port"]) {
    assert.throws(
      () => validateRuntimeEnv({ NODE_ENV: "development", PORT: port }),
      /PORT must be an integer between 1 and 65535/
    );
  }
});

test("runtime validation returns a normalized numeric port", () => {
  assert.deepEqual(
    validateRuntimeEnv({ NODE_ENV: "development", PORT: "5000" }),
    { port: 5000 }
  );
});

test("worker validation requires production configuration but no HTTP port", () => {
  const env = REQUIRED_WORKER_ENV.reduce(
    (currentEnv, key) => ({ ...currentEnv, [key]: "configured" }),
    { NODE_ENV: "production", RAILWAY_SERVICE_ID: "worker-service" }
  );

  assert.deepEqual(validateWorkerEnv(env), {});
  assert.equal("PORT" in env, false);
  assert.equal("RAZORPAY_KEY_SECRET" in env, false);
});

test("production workers fail closed when a worker dependency is missing", () => {
  assert.throws(
    () => validateWorkerEnv({ NODE_ENV: "production", MONGO_URI: "configured" }),
    /Missing production worker environment variables: REDIS_URL/
  );
});

test("runtime validation accepts a fully configured Railway production service", () => {
  const env = REQUIRED_PRODUCTION_ENV.reduce(
    (currentEnv, key) => ({
      ...currentEnv,
      [key]: "configured",
    }),
    {
      NODE_ENV: "production",
      PORT: "5000",
      RAILWAY_ENVIRONMENT: "production",
    }
  );

  assert.deepEqual(validateRuntimeEnv(env), { port: 5000 });
});

test("runtime validation accepts a fully configured Render production service", () => {
  const env = REQUIRED_PRODUCTION_ENV.reduce(
    (currentEnv, key) => ({
      ...currentEnv,
      [key]: "configured",
    }),
    {
      NODE_ENV: "production",
      PORT: "10000",
      RENDER: "true",
      RENDER_SERVICE_ID: "service-1",
    }
  );

  assert.deepEqual(validateRuntimeEnv(env), { port: 10000 });
});
