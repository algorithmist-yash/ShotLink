const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const { createMetricsMiddleware } = require("./metricsMiddleware");

function createResponse() {
  const response = new EventEmitter();
  response.statusCode = 200;
  response.writableEnded = false;
  return response;
}

test("metrics middleware observes a completed request once", () => {
  const observations = [];
  const times = [10, 25];
  const res = createResponse();
  let nextCalled = false;

  createMetricsMiddleware({
    registry: { observeHttpRequest: (observation) => observations.push(observation) },
    clock: () => times.shift(),
  })({ method: "POST" }, res, () => {
    nextCalled = true;
  });

  res.statusCode = 201;
  res.writableEnded = true;
  res.emit("finish");
  res.emit("close");

  assert.equal(nextCalled, true);
  assert.deepEqual(observations, [
    {
      method: "POST",
      statusCode: 201,
      durationMs: 15,
      aborted: false,
    },
  ]);
});

test("metrics middleware distinguishes an aborted request", () => {
  const observations = [];
  const times = [5, 9];
  const res = createResponse();

  createMetricsMiddleware({
    registry: { observeHttpRequest: (observation) => observations.push(observation) },
    clock: () => times.shift(),
  })({ method: "GET" }, res, () => {});
  res.emit("close");

  assert.deepEqual(observations, [
    {
      method: "GET",
      statusCode: null,
      durationMs: 4,
      aborted: true,
    },
  ]);
});
