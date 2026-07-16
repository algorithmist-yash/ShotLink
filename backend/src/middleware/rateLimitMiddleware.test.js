const assert = require("node:assert/strict");
const test = require("node:test");

const RateLimitBucket = require("../models/RateLimitBucket");
const {
  consumeRateLimit,
  createRateLimiter,
} = require("./rateLimitMiddleware");

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

function createSharedConsumer() {
  const buckets = new Map();

  return async ({ bucketId }) => {
    const nextCount = (buckets.get(bucketId) || 0) + 1;
    buckets.set(bucketId, nextCount);
    return nextCount;
  };
}

test("rate limiter allows requests under the limit and blocks the next request", async () => {
  const limiter = createRateLimiter({
    windowMs: 1000,
    max: 2,
    keyPrefix: "test-limit",
    consume: createSharedConsumer(),
    clock: () => 10_500,
  });
  const req = { ip: "203.0.113.10" };
  let nextCount = 0;

  const firstResponse = createMockResponse();
  await limiter(req, firstResponse, () => {
    nextCount += 1;
  });
  await limiter(req, createMockResponse(), () => {
    nextCount += 1;
  });
  const blockedResponse = createMockResponse();
  await limiter(req, blockedResponse, () => {
    nextCount += 1;
  });

  assert.equal(nextCount, 2);
  assert.equal(firstResponse.headers["RateLimit-Remaining"], "1");
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(blockedResponse.headers["Retry-After"], "1");
});

test("separate limiter instances share counters and ignore spoofed forwarded IPs", async () => {
  const consume = createSharedConsumer();
  const options = {
    windowMs: 60_000,
    max: 1,
    keyPrefix: "test-shared",
    consume,
    clock: () => 120_000,
  };
  const firstInstance = createRateLimiter(options);
  const secondInstance = createRateLimiter(options);

  await firstInstance(
    {
      ip: "203.0.113.11",
      headers: { "x-forwarded-for": "198.51.100.1" },
    },
    createMockResponse(),
    () => {}
  );
  const blockedResponse = createMockResponse();
  await secondInstance(
    {
      ip: "203.0.113.11",
      headers: { "x-forwarded-for": "198.51.100.2" },
    },
    blockedResponse,
    () => {}
  );

  assert.equal(blockedResponse.statusCode, 429);
});

test("a new fixed window receives a new counter", async () => {
  const consume = createSharedConsumer();
  let now = 1_000;
  const limiter = createRateLimiter({
    windowMs: 1000,
    max: 1,
    keyPrefix: "test-window",
    consume,
    clock: () => now,
  });
  const req = { ip: "203.0.113.12" };

  await limiter(req, createMockResponse(), () => {});
  const blockedResponse = createMockResponse();
  await limiter(req, blockedResponse, () => {});
  assert.equal(blockedResponse.statusCode, 429);

  now = 2_000;
  const nextWindowResponse = createMockResponse();
  let nextCalled = false;
  await limiter(req, nextWindowResponse, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(nextWindowResponse.statusCode, 200);
});

test("MongoDB consumption uses an atomic increment and hashed bucket id", async (t) => {
  const originalFindOneAndUpdate = RateLimitBucket.findOneAndUpdate;
  let capturedCall;
  RateLimitBucket.findOneAndUpdate = async (...args) => {
    capturedCall = args;
    return { count: 3 };
  };
  t.after(() => {
    RateLimitBucket.findOneAndUpdate = originalFindOneAndUpdate;
  });

  const count = await consumeRateLimit({
    bucketId: "a".repeat(64),
    expiresAt: new Date("2026-07-16T12:00:00.000Z"),
  });

  assert.equal(count, 3);
  assert.deepEqual(capturedCall[0], { _id: "a".repeat(64) });
  assert.deepEqual(capturedCall[1].$inc, { count: 1 });
  assert.equal(capturedCall[2].upsert, true);
  assert.ok(
    RateLimitBucket.schema
      .indexes()
      .some(
        ([fields, options]) =>
          fields.expiresAt === 1 && options.expireAfterSeconds === 0
      )
  );
});

test("rate limiter fails closed when the shared store is unavailable", async (t) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalConsoleError;
  });
  const limiter = createRateLimiter({
    windowMs: 1000,
    max: 1,
    consume: async () => {
      throw new Error("database unavailable");
    },
  });
  const response = createMockResponse();
  let nextCalled = false;

  await limiter({ ip: "203.0.113.13" }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 503);
  assert.match(response.body.error, /temporarily unavailable/);
});
