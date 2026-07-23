const assert = require("node:assert/strict");
const test = require("node:test");

const { getLivenessResponse, getReadinessResponse } = require("./readiness");

const FIXED_TIME = new Date("2026-07-20T10:00:00.000Z");

test("readiness succeeds only when MongoDB is connected", () => {
  const response = getReadinessResponse(1, FIXED_TIME);

  assert.deepEqual(response, {
    statusCode: 200,
    body: {
      status: "ok",
      service: "shotlink",
      timestamp: FIXED_TIME.toISOString(),
      dependencies: {
        mongodb: "connected",
        redis: "disabled",
      },
    },
  });
});

test("readiness reports Redis loss as degraded while MongoDB fallback is available", () => {
  const response = getReadinessResponse(1, FIXED_TIME, "reconnecting");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "degraded");
  assert.equal(response.body.dependencies.mongodb, "connected");
  assert.equal(response.body.dependencies.redis, "reconnecting");
});

test("readiness fails while MongoDB is unavailable", () => {
  for (const [readyState, expectedState] of [
    [0, "disconnected"],
    [2, "connecting"],
    [3, "disconnecting"],
    [99, "uninitialized"],
    [-1, "unknown"],
  ]) {
    const response = getReadinessResponse(readyState, FIXED_TIME);

    assert.equal(response.statusCode, 503);
    assert.equal(response.body.status, "unavailable");
    assert.equal(response.body.dependencies.mongodb, expectedState);
    assert.equal(response.body.dependencies.redis, "disabled");
  }
});

test("liveness reports that the process can serve requests independently of MongoDB", () => {
  assert.deepEqual(getLivenessResponse(FIXED_TIME), {
    statusCode: 200,
    body: {
      status: "ok",
      service: "shotlink",
      timestamp: FIXED_TIME.toISOString(),
    },
  });
});
