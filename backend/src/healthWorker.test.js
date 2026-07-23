const assert = require("node:assert/strict");
const test = require("node:test");

const { startHealthWorker, stopHealthWorker } = require("./healthWorker");

test("health workers validate configuration, connect dependencies, and start", async () => {
  const events = [];
  const worker = { start: () => events.push("worker-started") };
  const env = { NODE_ENV: "production" };

  const result = await startHealthWorker({
    worker,
    env,
    validateEnv(receivedEnv) {
      assert.equal(receivedEnv, env);
      events.push("validated");
    },
    connect: async () => events.push("database-connected"),
    connectCache: async () => events.push("cache-connected"),
    logger: { info: () => events.push("logged"), warn() {} },
  });

  assert.equal(result, worker);
  assert.deepEqual(events, [
    "validated",
    "database-connected",
    "cache-connected",
    "worker-started",
    "logged",
  ]);
});

test("health workers remain available when optional Redis startup is degraded", async () => {
  const events = [];
  await startHealthWorker({
    worker: { start: () => events.push("worker-started") },
    validateEnv() {},
    connect: async () => events.push("database-connected"),
    connectCache: async () => { throw new Error("redis unavailable"); },
    logger: {
      info() {},
      warn(message) {
        const log = JSON.parse(message);
        events.push(log.event);
        assert.equal(log.process, "url_health_worker");
      },
    },
  });

  assert.deepEqual(events, [
    "database-connected",
    "redis_startup_degraded",
    "worker-started",
  ]);
});

test("health worker shutdown drains work before closing Redis and MongoDB", async () => {
  const events = [];
  await stopHealthWorker({
    signal: "SIGTERM",
    worker: { stop: async () => events.push("worker-stopped") },
    disconnectCache: async () => events.push("cache-disconnected"),
    disconnect: async () => events.push("database-disconnected"),
    logger: { info: () => events.push("logged") },
  });

  assert.deepEqual(events, [
    "logged",
    "worker-stopped",
    "cache-disconnected",
    "database-disconnected",
    "logged",
  ]);
});

test("health worker shutdown closes every dependency after an earlier failure", async () => {
  const events = [];
  await assert.rejects(
    stopHealthWorker({
      worker: {
        async stop() {
          events.push("worker-stopped");
          throw new Error("drain failed");
        },
      },
      disconnectCache: async () => events.push("cache-disconnected"),
      disconnect: async () => events.push("database-disconnected"),
      logger: { info() {} },
    }),
    /URL health worker shutdown failed/
  );

  assert.deepEqual(events, [
    "worker-stopped",
    "cache-disconnected",
    "database-disconnected",
  ]);
});
