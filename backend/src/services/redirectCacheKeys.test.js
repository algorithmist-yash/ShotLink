const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CACHE_NAMESPACE,
  domainCacheKey,
  entitlementCacheKey,
  routeCacheKey,
  usageCacheKey,
} = require("./redirectCacheKeys");

test("cache keys are versioned, deterministic, and bounded", () => {
  const longValue = "x".repeat(10_000);
  const keys = [
    routeCacheKey(longValue, longValue),
    domainCacheKey(longValue),
    entitlementCacheKey(longValue),
    usageCacheKey(longValue, longValue),
  ];

  assert.equal(routeCacheKey("go.example.com", "launch"), routeCacheKey("go.example.com", "launch"));
  assert.notEqual(routeCacheKey("go.example.com", "launch"), routeCacheKey("go.example.com", "other"));
  assert.ok(keys.every((key) => key.startsWith(CACHE_NAMESPACE)));
  assert.ok(keys.every((key) => key.length < 100));
  assert.ok(keys.every((key) => !key.includes(longValue)));
});
