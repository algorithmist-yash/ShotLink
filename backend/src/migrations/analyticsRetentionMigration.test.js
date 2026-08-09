const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_RETENTION_DAYS,
  getLegacyRetentionDays,
  up,
} = require("../../migrations/20260721-analytics-retention");

test("uses the default retention period for invalid configuration", () => {
  assert.equal(getLegacyRetentionDays({}), DEFAULT_RETENTION_DAYS);
  assert.equal(
    getLegacyRetentionDays({ LEGACY_ANALYTICS_RETENTION_DAYS: "0" }),
    DEFAULT_RETENTION_DAYS
  );
});

test("enables updatePipeline for the analytics retention backfill", async () => {
  let received;
  const ClickEventModel = {
    updateMany(filter, update, options) {
      received = { filter, update, options };
      return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
    },
  };

  await up({
    ClickEventModel,
    env: { LEGACY_ANALYTICS_RETENTION_DAYS: "120" },
  });

  assert.deepEqual(received.filter, { expiresAt: { $exists: false } });
  assert.equal(received.update[0].$set.expiresAt.$dateAdd.amount, 120);
  assert.deepEqual(received.options, { updatePipeline: true });
});
