const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const { createRequestLogger } = require("./requestLoggerMiddleware");

function createResponse() {
  const response = new EventEmitter();
  response.statusCode = 200;
  response.writableEnded = false;
  return response;
}

test("request logger emits sanitized structured completion data", () => {
  const messages = [];
  const times = [100, 112.5];
  const req = {
    id: "request-123",
    method: "GET",
    originalUrl: "/api/v1/links?token=secret",
  };
  const res = createResponse();
  res.statusCode = 201;
  let nextCalled = false;

  createRequestLogger({
    logger: { info: (message) => messages.push(message) },
    clock: () => times.shift(),
    timestamp: () => "2026-07-20T10:00:00.000Z",
  })(req, res, () => {
    nextCalled = true;
  });
  res.writableEnded = true;
  res.emit("finish");

  assert.equal(nextCalled, true);
  assert.deepEqual(JSON.parse(messages[0]), {
    timestamp: "2026-07-20T10:00:00.000Z",
    level: "info",
    event: "http_request",
    requestId: "request-123",
    method: "GET",
    path: "/api/v1/links",
    statusCode: 201,
    durationMs: 12.5,
  });
  assert.equal(messages[0].includes("secret"), false);
});

test("request logger records aborted connections once", () => {
  const messages = [];
  const times = [10, 15];
  const res = createResponse();

  createRequestLogger({
    logger: { info: (message) => messages.push(message) },
    clock: () => times.shift(),
  })(
    { id: "request-456", method: "POST", path: "/api/v1/links" },
    res,
    () => {}
  );

  res.emit("close");
  res.emit("finish");

  assert.equal(messages.length, 1);
  assert.equal(JSON.parse(messages[0]).event, "http_request_aborted");
  assert.equal(JSON.parse(messages[0]).statusCode, null);
});
