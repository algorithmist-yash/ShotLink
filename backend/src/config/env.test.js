const assert = require("node:assert/strict");
const test = require("node:test");

const { REQUIRED_PRODUCTION_ENV, validateProductionEnv } = require("./env");

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
