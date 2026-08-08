const assert = require("node:assert/strict");
const test = require("node:test");

const {
  claimRedirectEventJob,
  createRedirectEventWorker,
  enqueueRedirectEvent,
  getRedirectEventQueueDepth,
  getRetryDelayMs,
  persistRedirectEvent,
  processClaimedRedirectEvent,
  processNextRedirectEventJob,
  releaseFailedRedirectEvent,
} = require("./redirectEventService");

function createJob(overrides = {}) {
  return {
    _id: "job-1",
    attempts: 1,
    status: "processing",
    urlId: "url-1",
    workspaceId: "workspace-1",
    shortCode: "launch",
    clickedAt: new Date("2026-07-20T10:00:00.000Z"),
    deviceType: "mobile",
    browser: "Chrome",
    os: "Android",
    userAgent: "test-agent",
    referrer: "https://referrer.example",
    ipHash: "hashed-ip",
    redirectTarget: "https://destination.example/path",
    redirectTargetKind: "primary",
    redirectStatus: 302,
    ...overrides,
  };
}

test("redirect requests enqueue one durable pending job", async () => {
  let created = null;
  const event = createJob();
  delete event._id;
  delete event.attempts;
  delete event.status;

  const result = await enqueueRedirectEvent(event, {
    JobModel: {
      async create(job) {
        created = job;
        return { _id: "queued-job", ...job };
      },
    },
  });

  assert.equal(result._id, "queued-job");
  assert.equal(created.status, "pending");
  assert.equal(created.attempts, 0);
  assert.ok(created.availableAt instanceof Date);
  assert.equal(created.redirectTarget, event.redirectTarget);
});

test("queue claims are atomic, oldest-first, and lease expired work", async () => {
  let call = null;
  const claimedJob = createJob();
  const JobModel = {
    async findOneAndUpdate(filter, update, options) {
      call = { filter, update, options };
      return claimedJob;
    },
  };

  const result = await claimRedirectEventJob({
    JobModel,
    clock: () => 1_000,
    leaseMs: 30_000,
    maxAttempts: 5,
  });

  assert.equal(result, claimedJob);
  assert.deepEqual(call.filter.attempts, { $lt: 5 });
  assert.equal(call.filter.$or[0].status, "pending");
  assert.equal(call.filter.$or[1].status, "processing");
  assert.equal(call.update.$inc.attempts, 1);
  assert.equal(call.update.$set.leaseUntil.getTime(), 31_000);
  assert.deepEqual(call.options.sort, { createdAt: 1 });
});

test("a claimed redirect is persisted atomically with idempotency and usage period", async () => {
  const operations = [];
  const job = createJob();
  const session = { id: "transaction-session" };
  const JobModel = {
    findOne(filter) {
      operations.push(["load", filter]);
      return {
        async session(receivedSession) {
          assert.equal(receivedSession, session);
          return job;
        },
      };
    },
    async updateOne(filter, update, options) {
      operations.push(["complete", filter, update, options]);
      return { modifiedCount: 1 };
    },
  };
  const ClickEventModel = {
    async updateOne(filter, update, options) {
      operations.push(["event", filter, update, options]);
      return { upsertedCount: 1 };
    },
  };
  const UrlModel = {
    async updateOne(filter, update, options) {
      operations.push(["url", filter, update, options]);
      return { modifiedCount: 1 };
    },
  };
  const UsageCounterModel = {
    async findOneAndUpdate(filter, update, options) {
      operations.push(["usage", filter, update, options]);
      return { clicks: 1 };
    },
  };

  const processed = await persistRedirectEvent(job, {
    session,
    JobModel,
    ClickEventModel,
    UrlModel,
    UsageCounterModel,
    clock: () => Date.parse("2026-07-20T10:01:00.000Z"),
    completedRetentionMs: 60_000,
  });

  assert.equal(processed, true);
  assert.deepEqual(
    operations.map(([name]) => name),
    ["load", "event", "url", "usage", "complete"]
  );
  assert.deepEqual(operations[1][1], { ingestionKey: "job-1" });
  assert.equal(operations[1][2].$setOnInsert.shortCode, "launch");
  assert.equal(
    operations[1][2].$setOnInsert.expiresAt.toISOString(),
    "2026-10-18T10:00:00.000Z"
  );
  assert.deepEqual(operations[2][2], {
    $inc: { clicks: 1 },
    $max: { lastClickedAt: job.clickedAt },
  });
  assert.equal(operations[3][1].periodKey, "2026-07");
  assert.equal(operations[4][2].$set.status, "completed");
  assert.equal(
    operations[4][2].$set.deleteAfter.toISOString(),
    "2026-07-20T10:02:00.000Z"
  );
  for (const operation of operations.slice(1)) {
    assert.equal(operation.at(-1).session, session);
  }
});

test("unavailable redirects record events and usage without incrementing URL clicks", async () => {
  const operations = [];
  const job = createJob({ redirectStatus: 502, redirectTarget: "", redirectTargetKind: "none" });
  const JobModel = {
    findOne() {
      return { async session() { return job; } };
    },
    async updateOne() {
      operations.push("complete");
    },
  };

  await persistRedirectEvent(job, {
    session: {},
    JobModel,
    ClickEventModel: { async updateOne() { operations.push("event"); } },
    UrlModel: { async updateOne() { operations.push("url"); } },
    UsageCounterModel: { async findOneAndUpdate() { operations.push("usage"); } },
  });

  assert.deepEqual(operations, ["event", "usage", "complete"]);
});

test("stale redirects transactionally hand off durable health work before completion", async () => {
  const operations = [];
  const session = { id: "health-handoff-session" };
  const job = createJob({ healthRefreshRequested: true });
  const JobModel = {
    findOne() {
      operations.push("load");
      return { async session() { return job; } };
    },
    async updateOne(filter, update, options) {
      operations.push("complete");
      assert.equal(options.session, session);
      return { modifiedCount: 1 };
    },
  };

  await persistRedirectEvent(job, {
    session,
    JobModel,
    ClickEventModel: { async updateOne() { operations.push("event"); } },
    UrlModel: { async updateOne() { operations.push("url"); } },
    UsageCounterModel: { async findOneAndUpdate() { operations.push("usage"); } },
    enqueueHealthRefresh: async (urlId, options) => {
      operations.push("health");
      assert.equal(urlId, "url-1");
      assert.equal(options.requestedAt, job.clickedAt);
      assert.equal(options.session, session);
    },
  });

  assert.deepEqual(operations, ["load", "event", "url", "usage", "health", "complete"]);
});

test("claimed jobs commit through a transaction and always end their session", async () => {
  const events = [];
  const job = createJob({ workspaceId: null });
  const session = {
    async withTransaction(callback) {
      events.push("transaction-started");
      await callback();
      events.push("transaction-committed");
    },
    async endSession() {
      events.push("session-ended");
    },
  };
  const JobModel = {
    findOne() {
      return { async session() { return job; } };
    },
    async updateOne() {
      events.push("job-completed");
    },
  };

  const processed = await processClaimedRedirectEvent(job, {
    startSession: async () => session,
    JobModel,
    ClickEventModel: { async updateOne() { events.push("event-written"); } },
    UrlModel: { async updateOne() { events.push("url-counted"); } },
    UsageCounterModel: { async findOneAndUpdate() { events.push("usage-counted"); } },
  });

  assert.equal(processed, true);
  assert.deepEqual(events, [
    "transaction-started",
    "event-written",
    "url-counted",
    "job-completed",
    "transaction-committed",
    "session-ended",
  ]);
});

test("committed workspace usage invalidates its cache after the session ends", async () => {
  const events = [];
  const job = createJob({ workspaceId: "workspace-1" });
  const session = {
    async withTransaction(callback) {
      await callback();
      events.push("transaction-committed");
    },
    async endSession() {
      events.push("session-ended");
    },
  };
  const JobModel = {
    findOne() {
      return { async session() { return job; } };
    },
    async updateOne() {},
  };

  await processClaimedRedirectEvent(job, {
    startSession: async () => session,
    JobModel,
    ClickEventModel: { async updateOne() {} },
    UrlModel: { async updateOne() {} },
    UsageCounterModel: { async findOneAndUpdate() {} },
    invalidateUsage: async (workspaceId, clickedAt) => {
      assert.equal(workspaceId, "workspace-1");
      assert.equal(clickedAt, job.clickedAt);
      events.push("usage-cache-invalidated");
    },
  });

  assert.deepEqual(events, [
    "transaction-committed",
    "session-ended",
    "usage-cache-invalidated",
  ]);
});

test("failed jobs back off and become dead after the bounded attempt count", async () => {
  const updates = [];
  const JobModel = {
    async updateOne(filter, update) {
      updates.push({ filter, update });
      return { modifiedCount: 1 };
    },
  };

  await releaseFailedRedirectEvent(createJob({ attempts: 2 }), new Error("temporary"), {
    JobModel,
    clock: () => 10_000,
    maxAttempts: 5,
  });
  await releaseFailedRedirectEvent(createJob({ attempts: 5 }), new Error("permanent"), {
    JobModel,
    clock: () => 10_000,
    maxAttempts: 5,
    deadRetentionMs: 30_000,
  });

  assert.equal(getRetryDelayMs(2), 2000);
  assert.equal(updates[0].update.$set.status, "pending");
  assert.equal(updates[0].update.$set.availableAt.getTime(), 12_000);
  assert.equal(updates[1].update.$set.status, "dead");
  assert.equal(updates[1].update.$set.deleteAfter.getTime(), 40_000);
});

test("the queue processor reports empty queues and safely releases failures", async () => {
  assert.equal(
    await processNextRedirectEventJob({ claim: async () => null }),
    false
  );

  const events = [];
  const processed = await processNextRedirectEventJob({
    claim: async () => createJob(),
    processClaimed: async () => {
      throw new Error("transaction failed");
    },
    releaseFailed: async (job, error) => events.push(["released", job._id, error.message]),
    logger: {
      error(message) {
        events.push(["logged", JSON.parse(message).event]);
      },
    },
  });

  assert.equal(processed, true);
  assert.deepEqual(events, [
    ["released", "job-1", "transaction failed"],
    ["logged", "redirect_event_job_failed"],
  ]);
});

test("redirect queue depth reads bounded operational statuses with deadlines", async () => {
  const filters = [];
  const timeouts = [];
  const depths = await getRedirectEventQueueDepth({
    queryTimeoutMs: 250,
    JobModel: {
      countDocuments(filter) {
        filters.push(filter);
        return {
          maxTimeMS(timeout) {
            timeouts.push(timeout);
            return Promise.resolve({ pending: 4, processing: 2, dead: 1 }[filter.status]);
          },
        };
      },
    },
  });

  assert.deepEqual(depths, { pending: 4, processing: 2, dead: 1 });
  assert.deepEqual(filters, [{ status: "pending" }, { status: "processing" }, { status: "dead" }]);
  assert.deepEqual(timeouts, [250, 250, 250]);
});

test("the worker drains on startup and stops without leaving a timer", async () => {
  let scheduledCallback = null;
  let processCalls = 0;
  let clearedTimers = 0;
  const worker = createRedirectEventWorker({
    processNext: async () => {
      processCalls += 1;
      return false;
    },
    setTimer(callback) {
      scheduledCallback = callback;
      return { unref() {} };
    },
    clearTimer() {
      clearedTimers += 1;
    },
  });

  worker.start();
  assert.equal(worker.isStarted(), true);
  scheduledCallback();
  await new Promise((resolve) => setImmediate(resolve));
  await worker.stop();

  assert.equal(processCalls, 1);
  assert.equal(worker.isStarted(), false);
  assert.equal(clearedTimers, 1);
});
