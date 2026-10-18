const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { startIntegrationEnvironment } = require("./harness");
const redirect = require("../../migrations/20260720-redirect-event-outbox");
const health = require("../../migrations/20260720-health-refresh-queue");
const retention = require("../../migrations/20260721-analytics-retention");

test("deployment migrations rerun against runtime indexes without altering existing retention", { timeout: 120000 }, async () => {
  const environment = await startIntegrationEnvironment({ databaseName: "shotlink_deploy_migrations" });
  try {
    const db = mongoose.connection.db;
    const clickedAt = new Date();
    const existingExpiry = new Date(clickedAt.getTime() + 180 * 86400000);
    // Raw legacy records deliberately omit fields required by today's schema.
    await db.collection("clickevents").insertMany([
      { shortCode: "legacy-missing", clickedAt },
      { shortCode: "legacy-existing", clickedAt, expiresAt: existingExpiry },
    ]);
    for (let run = 0; run < 2; run++) {
      await redirect.up(db);
      await health.up(db);
      await retention.up({ env: { LEGACY_ANALYTICS_RETENTION_DAYS: "90" } });
    }
    const legacy = await db.collection("clickevents").findOne({ shortCode: "legacy-missing" });
    const existing = await db.collection("clickevents").findOne({ shortCode: "legacy-existing" });
    assert.equal(legacy.expiresAt.getTime(), clickedAt.getTime() + 90 * 86400000);
    assert.equal(existing.expiresAt.toISOString(), existingExpiry.toISOString());
    const indexes = await db.collection("clickevents").indexes();
    assert.ok(indexes.some(index => index.name === "click_event_ingestion_unique" && index.unique));
    assert.ok(indexes.some(index => index.name === "click_events_ttl" && index.expireAfterSeconds === 0));
  } finally {
    await environment.stop();
  }
});
