const assert = require("node:assert/strict");
const test = require("node:test");

const {
  deleteKeys,
  getJson,
  resetCacheErrorLogsForTests,
  setJson,
} = require("./cacheService");

function createMetrics() {
  const observations = [];
  return {
    observations,
    observeCacheOperation(observation) {
      observations.push(observation);
    },
  };
}

test("cache JSON operations use Redis only while the client is ready", async () => {
  const values = new Map();
  const metrics = createMetrics();
  const client = {
    isReady: true,
    async get(key) {
      return values.get(key) ?? null;
    },
    async setEx(key, ttl, value) {
      assert.equal(ttl, 30);
      values.set(key, value);
    },
    async del(keys) {
      keys.forEach((key) => values.delete(key));
    },
  };

  assert.deepEqual(await getJson("route", "route-key", { client, metrics }), {
    hit: false,
    value: null,
  });
  assert.equal(
    await setJson("route", "route-key", { found: true }, 30, { client, metrics }),
    true
  );
  assert.deepEqual(await getJson("route", "route-key", { client, metrics }), {
    hit: true,
    value: { found: true },
  });
  assert.equal(
    await deleteKeys("route", ["route-key", "route-key"], { client, metrics }),
    true
  );
  assert.deepEqual(
    metrics.observations.map(({ result }) => result),
    ["miss", "write", "hit", "invalidate"]
  );
});

test("cache errors fail open and never expose cache keys in logs", async (t) => {
  t.after(resetCacheErrorLogsForTests);
  const messages = [];
  const metrics = createMetrics();
  const logger = { warn(message) { messages.push(message); } };
  const client = {
    isReady: true,
    async get() {
      throw new Error("cache offline");
    },
  };

  assert.deepEqual(
    await getJson("route", "sensitive-key", { client, logger, metrics }),
    { hit: false, value: null }
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].includes("sensitive-key"), false);
  assert.equal(metrics.observations[0].result, "error");
});

test("an unavailable client bypasses cache commands", async () => {
  const metrics = createMetrics();
  const result = await getJson("route", "key", {
    client: { isReady: false },
    metrics,
  });

  assert.deepEqual(result, { hit: false, value: null });
  assert.equal(metrics.observations[0].result, "bypass");
});
