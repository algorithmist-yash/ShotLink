const assert = require("node:assert/strict");
const test = require("node:test");

const { createRateLimiter } = require("./rateLimitMiddleware");

function createMockResponse() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    set(name, value) {
      this.headers[name] = value;
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
}

test("rate limiter allows requests under the limit", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, keyPrefix: "test-allow" });
  const req = { ip: "203.0.113.10" };
  const res = createMockResponse();
  let nextCount = 0;

  limiter(req, res, () => {
    nextCount += 1;
  });

  assert.equal(nextCount, 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["RateLimit-Limit"], "2");
});

test("rate limiter blocks requests after the limit", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 1, keyPrefix: "test-block" });
  const req = { ip: "203.0.113.11" };

  limiter(req, createMockResponse(), () => {});
  const blockedResponse = createMockResponse();
  let nextCalled = false;

  limiter(req, blockedResponse, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(blockedResponse.statusCode, 429);
  assert.match(blockedResponse.body.error, /Too many requests/);
});
