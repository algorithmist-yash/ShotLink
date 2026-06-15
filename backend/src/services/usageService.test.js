const test = require("node:test");
const assert = require("node:assert/strict");

const { buildUsageMetric, getUsagePeriodKey } = require("./usageService");

test("getUsagePeriodKey uses UTC year and month", () => {
  assert.equal(getUsagePeriodKey(new Date("2026-06-15T18:30:00.000Z")), "2026-06");
});

test("buildUsageMetric calculates remaining quota and caps percent", () => {
  assert.deepEqual(buildUsageMetric("clicks", 25, 100), {
    key: "clicks",
    used: 25,
    limit: 100,
    remaining: 75,
    percentUsed: 25,
  });

  assert.deepEqual(buildUsageMetric("apiRequests", 125, 100), {
    key: "apiRequests",
    used: 125,
    limit: 100,
    remaining: 0,
    percentUsed: 100,
  });
});
