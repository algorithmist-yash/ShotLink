const assert = require("node:assert/strict");
const test = require("node:test");

const UrlHealthJob = require("../models/UrlHealthJob");
const {
  claimUrlHealthJob,
  completeUrlHealthJob,
  deadLetterExpiredUrlHealthJob,
  enqueueUrlHealthRefresh,
  getRetryDelayMs,
  getUrlHealthQueueDepth,
  processClaimedUrlHealthJob,
  processNextUrlHealthJob,
  releaseFailedUrlHealthJob,
} = require("./urlHealthQueueService");

function createJob(overrides = {}) {
  return {
    _id: "health-job-1",
    urlId: "url-1",
    active: true,
    attempts: 1,
    status: "processing",
    ...overrides,
  };
}

test("health refresh requests atomically coalesce per URL inside the caller session", async () => {
  let call;
  const requestedAt = new Date("2026-07-20T10:00:00.000Z");
  const session = { id: "transaction-session" };

  await enqueueUrlHealthRefresh("url-1", {
    requestedAt,
    session,
    JobModel: {
      async findOneAndUpdate(filter, update, options) {
        call = { filter, update, options };
        return createJob();
      },
    },
  });

  assert.deepEqual(call.filter, { urlId: "url-1", active: true });
  assert.equal(call.update.$max.requestedAt, requestedAt);
  assert.equal(call.update.$setOnInsert.status, "pending");
  assert.equal(call.update.$setOnInsert.urlId, "url-1");
  assert.equal(call.options.session, session);
  assert.equal(call.options.upsert, true);
});

test("health claims are atomic, oldest-first, and recover expired processing leases", async () => {
  let call;
  const claimedJob = createJob();
  const result = await claimUrlHealthJob({
    clock: () => 1_000,
    leaseMs: 30_000,
    maxAttempts: 5,
    JobModel: {
      async findOneAndUpdate(filter, update, options) {
        call = { filter, update, options };
        return claimedJob;
      },
    },
  });

  assert.equal(result, claimedJob);
  assert.equal(call.filter.active, true);
  assert.deepEqual(call.filter.attempts, { $lt: 5 });
  assert.equal(call.filter.$or[1].leaseUntil.$lte.getTime(), 1_000);
  assert.equal(call.update.$inc.attempts, 1);
  assert.equal(call.update.$set.leaseUntil.getTime(), 31_000);
  assert.deepEqual(call.options.sort, { createdAt: 1 });
});

test("expired final leases become inactive dead letters without a sixth execution", async () => {
  let call;
  await deadLetterExpiredUrlHealthJob({
    clock: () => 10_000,
    maxAttempts: 5,
    deadRetentionMs: 30_000,
    JobModel: {
      async findOneAndUpdate(filter, update, options) {
        call = { filter, update, options };
        return createJob({ attempts: 5, status: "dead", active: false });
      },
    },
  });

  assert.deepEqual(call.filter.attempts, { $gte: 5 });
  assert.equal(call.filter.leaseUntil.$lte.getTime(), 10_000);
  assert.equal(call.update.$set.active, false);
  assert.equal(call.update.$set.status, "dead");
  assert.equal(call.update.$set.deleteAfter.getTime(), 40_000);
  assert.deepEqual(call.options.sort, { leaseUntil: 1 });
});

test("health completion requires lease ownership and applies TTL retention", async () => {
  let call;
  await completeUrlHealthJob(createJob({ attempts: 3 }), {
    clock: () => 10_000,
    completedRetentionMs: 60_000,
    JobModel: {
      async updateOne(filter, update) {
        call = { filter, update };
        return { matchedCount: 1 };
      },
    },
  });

  assert.deepEqual(call.filter, {
    _id: "health-job-1",
    active: true,
    attempts: 3,
    status: "processing",
  });
  assert.equal(call.update.$set.active, false);
  assert.equal(call.update.$set.status, "completed");
  assert.equal(call.update.$set.deleteAfter.getTime(), 70_000);
});

test("health retries use bounded jitter and dead-letter after the final attempt", async () => {
  const updates = [];
  const JobModel = {
    async updateOne(filter, update) {
      updates.push({ filter, update });
      return { matchedCount: 1 };
    },
  };

  assert.equal(getRetryDelayMs(1, () => 0), 500);
  assert.equal(getRetryDelayMs(2, () => 0.5), 1_500);
  assert.equal(getRetryDelayMs(99, () => 0.5), 45_000);

  await releaseFailedUrlHealthJob(createJob({ attempts: 2 }), new Error("temporary"), {
    JobModel,
    clock: () => 10_000,
    random: () => 0,
    maxAttempts: 5,
  });
  await releaseFailedUrlHealthJob(createJob({ attempts: 5 }), new Error("permanent"), {
    JobModel,
    clock: () => 10_000,
    maxAttempts: 5,
    deadRetentionMs: 30_000,
  });

  assert.equal(updates[0].update.$set.active, true);
  assert.equal(updates[0].update.$set.status, "pending");
  assert.equal(updates[0].update.$set.availableAt.getTime(), 11_000);
  assert.equal(updates[1].update.$set.active, false);
  assert.equal(updates[1].update.$set.status, "dead");
  assert.equal(updates[1].update.$set.deleteAfter.getTime(), 40_000);
});

test("claimed health work preserves URL leases and detects lost queue ownership", async () => {
  const events = [];
  const job = createJob();

  assert.equal(
    await processClaimedUrlHealthJob(job, {
      refresh: async (urlId) => {
        events.push(["refresh", urlId]);
        return true;
      },
      complete: async (completedJob) => {
        events.push(["complete", completedJob._id]);
        return { matchedCount: 1 };
      },
    }),
    true
  );
  assert.deepEqual(events, [["refresh", "url-1"], ["complete", "health-job-1"]]);

  await assert.rejects(
    processClaimedUrlHealthJob(job, { refresh: async () => false }),
    /lease is unavailable/
  );
  await assert.rejects(
    processClaimedUrlHealthJob(job, {
      refresh: async () => true,
      complete: async () => ({ matchedCount: 0 }),
    }),
    /ownership was lost/
  );
});

test("health processors report empty queues, successful work, and retryable failures", async () => {
  assert.equal(await processNextUrlHealthJob({ claim: async () => null }), false);

  const events = [];
  assert.equal(
    await processNextUrlHealthJob({
      claim: async () => createJob(),
      processClaimed: async () => {},
      logger: { info: (message) => events.push(JSON.parse(message).event), error() {} },
    }),
    true
  );
  assert.equal(
    await processNextUrlHealthJob({
      claim: async () => createJob({ attempts: 2 }),
      processClaimed: async () => { throw new Error("network failed"); },
      releaseFailed: async () => events.push("released"),
      logger: { info() {}, error: (message) => events.push(JSON.parse(message).event) },
    }),
    true
  );

  assert.deepEqual(events, [
    "url_health_job_completed",
    "released",
    "url_health_job_retry_scheduled",
  ]);
});

test("queue depth reads only bounded operational statuses", async () => {
  const filters = [];
  const depths = await getUrlHealthQueueDepth({
    JobModel: {
      async countDocuments(filter) {
        filters.push(filter);
        return { pending: 3, processing: 2, dead: 1 }[filter.status];
      },
    },
  });

  assert.deepEqual(depths, { pending: 3, processing: 2, dead: 1 });
  assert.deepEqual(filters, [{ status: "pending" }, { status: "processing" }, { status: "dead" }]);
});

test("queue depth queries have a database execution deadline", async () => {
  const timeouts = [];
  const depths = await getUrlHealthQueueDepth({
    queryTimeoutMs: 250,
    JobModel: {
      countDocuments() {
        return {
          maxTimeMS(timeout) {
            timeouts.push(timeout);
            return Promise.resolve(0);
          },
        };
      },
    },
  });

  assert.deepEqual(depths, { pending: 0, processing: 0, dead: 0 });
  assert.deepEqual(timeouts, [250, 250, 250]);
});

test("the health job model defines one active job, claim, recovery, and TTL indexes", () => {
  const indexes = UrlHealthJob.schema.indexes();
  const byName = Object.fromEntries(indexes.map(([keys, options]) => [options.name, { keys, options }]));

  assert.deepEqual(byName.url_health_jobs_one_active_per_url.keys, { urlId: 1 });
  assert.equal(byName.url_health_jobs_one_active_per_url.options.unique, true);
  assert.deepEqual(
    byName.url_health_jobs_one_active_per_url.options.partialFilterExpression,
    { active: true }
  );
  assert.deepEqual(byName.url_health_jobs_pending.keys, {
    status: 1,
    availableAt: 1,
    createdAt: 1,
  });
  assert.deepEqual(byName.url_health_jobs_expired_leases.keys, {
    status: 1,
    leaseUntil: 1,
    createdAt: 1,
  });
  assert.equal(byName.url_health_jobs_ttl.options.expireAfterSeconds, 0);
  assert.equal(indexes.length, 4);
});
