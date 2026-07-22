const assert = require("node:assert/strict");
const test = require("node:test");

const {
  closeHttpServer,
  gracefullyShutdown,
  normalizeFatalError,
  registerBackgroundProcessHandlers,
  registerProcessHandlers,
  registerShutdownHandlers,
} = require("./lifecycle");

const silentLogger = {
  info() {},
  error() {},
};

test("graceful shutdown drains HTTP traffic before disconnecting MongoDB", async () => {
  const events = [];
  const server = {
    close(callback) {
      events.push("http-closing");
      callback();
    },
  };

  await gracefullyShutdown({
    server,
    signal: "SIGTERM",
    disconnect: async () => events.push("database-disconnected"),
    logger: silentLogger,
  });

  assert.deepEqual(events, ["http-closing", "database-disconnected"]);
});

test("graceful shutdown stops background jobs before disconnecting MongoDB", async () => {
  const events = [];
  const server = {
    close(callback) {
      events.push("http-closed");
      callback();
    },
  };

  await gracefullyShutdown({
    server,
    signal: "SIGTERM",
    stopBackground: async () => events.push("worker-stopped"),
    disconnectCache: async () => events.push("cache-disconnected"),
    disconnect: async () => events.push("database-disconnected"),
    logger: silentLogger,
  });

  assert.deepEqual(events, [
    "http-closed",
    "worker-stopped",
    "cache-disconnected",
    "database-disconnected",
  ]);
});

test("HTTP shutdown is bounded and force-closes lingering connections", async () => {
  let triggerTimeout;
  let forceCloseCalled = false;
  const server = {
    close() {},
    closeAllConnections() {
      forceCloseCalled = true;
    },
  };

  const closing = closeHttpServer(server, {
    timeoutMs: 25,
    setTimer(callback) {
      triggerTimeout = callback;
      return { unref() {} };
    },
    clearTimer() {},
  });

  triggerTimeout();

  await assert.rejects(closing, /did not close within 25ms/);
  assert.equal(forceCloseCalled, true);
});

test("shutdown signal handling is idempotent", async () => {
  const listeners = {};
  const exitCodes = [];
  let shutdownCalls = 0;
  let finishShutdown;
  const shutdownFinished = new Promise((resolve) => {
    finishShutdown = resolve;
  });
  const processRef = {
    once(signal, listener) {
      listeners[signal] = listener;
    },
    exit(code) {
      exitCodes.push(code);
    },
  };

  registerShutdownHandlers({
    server: {},
    processRef,
    logger: silentLogger,
    shutdown: async () => {
      shutdownCalls += 1;
      await shutdownFinished;
    },
  });

  listeners.SIGTERM();
  listeners.SIGINT();
  finishShutdown();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(shutdownCalls, 1);
  assert.deepEqual(exitCodes, [0]);
});

test("fatal process errors shut down once and exit unsuccessfully", async () => {
  const listeners = {};
  const exitCodes = [];
  const messages = [];
  const shutdownSignals = [];
  const processRef = {
    once(event, listener) {
      listeners[event] = listener;
    },
    exit(code) {
      exitCodes.push(code);
    },
  };

  registerProcessHandlers({
    server: {},
    processRef,
    logger: {
      info() {},
      error(message) {
        messages.push(JSON.parse(message));
      },
    },
    shutdown: async ({ signal }) => shutdownSignals.push(signal),
  });

  listeners.uncaughtException(new Error("fatal test error"));
  listeners.unhandledRejection("second failure");
  listeners.SIGTERM();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(shutdownSignals, ["uncaughtException"]);
  assert.deepEqual(exitCodes, [1]);
  assert.equal(messages[0].event, "fatal_process_error");
  assert.equal(messages[0].errorMessage, "fatal test error");
});

test("non-Error promise rejections are normalized for structured logs", () => {
  assert.deepEqual(normalizeFatalError("promise failed"), {
    errorName: "NonErrorRejection",
    errorMessage: "promise failed",
    stack: null,
  });
});

test("background worker signals drain once and preserve fatal exit codes", async () => {
  const listeners = {};
  const exitCodes = [];
  const signals = [];
  const processRef = {
    once(event, listener) {
      listeners[event] = listener;
    },
    exit(code) {
      exitCodes.push(code);
    },
  };

  registerBackgroundProcessHandlers({
    processRef,
    logger: silentLogger,
    shutdown: async ({ signal }) => signals.push(signal),
  });

  listeners.unhandledRejection(new Error("worker failure"));
  listeners.SIGTERM();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(signals, ["unhandledRejection"]);
  assert.deepEqual(exitCodes, [1]);
});
