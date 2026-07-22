const assert = require("node:assert/strict");
const test = require("node:test");

const { createMetricsAuth } = require("./metricsAuthMiddleware");

function runAuth({ configuredToken, providedToken }) {
  const headers = {};
  const res = {
    body: null,
    statusCode: 200,
    setHeader(name, value) {
      headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;
  const req = {
    id: "metrics-request",
    get(name) {
      return name === "authorization" && providedToken
        ? `Bearer ${providedToken}`
        : undefined;
    },
  };

  createMetricsAuth({ env: { METRICS_TOKEN: configuredToken } })(req, res, () => {
    nextCalled = true;
  });

  return { headers, nextCalled, res };
}

test("metrics endpoint remains hidden when no token is configured", () => {
  const result = runAuth({ configuredToken: "", providedToken: "anything" });

  assert.equal(result.res.statusCode, 404);
  assert.equal(result.res.body.error, "Route not found");
  assert.equal(result.nextCalled, false);
});

test("metrics endpoint rejects an invalid bearer token", () => {
  const result = runAuth({ configuredToken: "correct-token", providedToken: "wrong-token" });

  assert.equal(result.res.statusCode, 401);
  assert.equal(result.headers["WWW-Authenticate"], 'Bearer realm="metrics"');
  assert.equal(result.nextCalled, false);
});

test("metrics endpoint accepts the configured bearer token", () => {
  const result = runAuth({
    configuredToken: "correct-token",
    providedToken: "correct-token",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.res.statusCode, 200);
});
