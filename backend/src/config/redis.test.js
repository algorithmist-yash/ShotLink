const assert = require("node:assert/strict");
const test = require("node:test");
const { EventEmitter } = require("node:events");

const {
  MAX_RECONNECT_DELAY_MS,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_STARTUP_WAIT_MS,
  closeRedis,
  connectRedis,
  getReconnectDelay,
  getRedisClient,
  getRedisState,
  resetRedisForTests,
} = require("./redis");

test("Redis reconnect delays are bounded and jittered", () => {
  assert.equal(getReconnectDelay(0, () => 0), 50);
  assert.equal(getReconnectDelay(3, () => 0.5), 450);
  assert.equal(
    getReconnectDelay(100, () => 0.99),
    MAX_RECONNECT_DELAY_MS + 99
  );
});

test("Redis stays disabled when no URL is configured", async (t) => {
  t.after(resetRedisForTests);
  let created = false;

  assert.equal(
    await connectRedis({
      env: {},
      createClientImpl() {
        created = true;
      },
    }),
    false
  );
  assert.equal(created, false);
  assert.equal(getRedisState(), "disabled");
});

test("Redis connects once, reports readiness, and closes cleanly", async (t) => {
  t.after(resetRedisForTests);
  const events = [];
  class FakeClient extends EventEmitter {
    isOpen = false;
    isReady = false;

    async connect() {
      this.isOpen = true;
      this.isReady = true;
      this.emit("ready");
    }

    async close() {
      events.push("closed");
      this.isOpen = false;
      this.isReady = false;
    }
  }

  let options;
  const logger = { info() {}, error() {} };
  assert.equal(
    await connectRedis({
      env: { REDIS_URL: "rediss://cache.example.test:6379" },
      logger,
      createClientImpl(receivedOptions) {
        options = receivedOptions;
        return new FakeClient();
      },
    }),
    true
  );

  assert.equal(options.url, "rediss://cache.example.test:6379");
  assert.equal(options.disableOfflineQueue, true);
  assert.equal(options.socket.connectTimeout, REDIS_CONNECT_TIMEOUT_MS);
  assert.equal(REDIS_STARTUP_WAIT_MS, 5000);
  assert.equal(typeof options.socket.reconnectStrategy, "function");
  assert.equal(getRedisState(), "connected");
  assert.equal(getRedisClient().isReady, true);

  await closeRedis();
  assert.deepEqual(events, ["closed"]);
  assert.equal(getRedisState(), "disconnected");
});

test("Redis startup returns degraded after a bounded wait while reconnecting continues", async (t) => {
  t.after(resetRedisForTests);
  let triggerDeadline;
  const client = new EventEmitter();
  client.isOpen = true;
  client.isReady = false;
  client.connect = () => new Promise(() => {});
  const messages = [];

  const connecting = connectRedis({
    env: { REDIS_URL: "redis://cache.example.test:6379" },
    logger: {
      info() {},
      error() {},
      warn(message) { messages.push(JSON.parse(message)); },
    },
    createClientImpl: () => client,
    startupWaitMs: 25,
    setTimer(callback) {
      triggerDeadline = callback;
      return { unref() {} };
    },
    clearTimer() {},
  });

  await Promise.resolve();
  triggerDeadline();
  assert.equal(await connecting, false);
  assert.equal(getRedisState(), "connecting");
  assert.equal(messages[0].event, "redis_startup_degraded");
});
