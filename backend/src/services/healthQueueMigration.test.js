const assert = require("node:assert/strict");
const test = require("node:test");

const { down, up } = require("../../migrations/20260720-health-refresh-queue");

test("the health queue migration creates and rolls back production indexes", async () => {
  const created = [];
  const dropped = [];
  const collection = {
    async createIndex(keys, options) {
      created.push({ keys, options });
    },
    async dropIndex(name) {
      dropped.push(name);
    },
  };
  const db = { collection: (name) => {
    assert.equal(name, "urlhealthjobs");
    return collection;
  } };

  await up(db);
  await down(db);

  assert.deepEqual(created.map(({ options }) => options.name), [
    "url_health_jobs_one_active_per_url",
    "url_health_jobs_pending",
    "url_health_jobs_expired_leases",
    "url_health_jobs_ttl",
  ]);
  assert.deepEqual(created[0].options.partialFilterExpression, { active: true });
  assert.equal(created[0].options.unique, true);
  assert.equal(created[3].options.expireAfterSeconds, 0);
  assert.deepEqual(dropped, created.map(({ options }) => options.name));
});
