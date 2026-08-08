const assert = require("node:assert/strict");
const test = require("node:test");

const { startServer } = require("./server");

function createApplication(events) {
  return {
    listen(port, host, callback) {
      events.push(["listen", port, host]);
      callback();
      return { port, host };
    },
  };
}

test("startServer waits for MongoDB before accepting traffic", async () => {
  const events = [];
  let finishConnecting;
  const connection = new Promise((resolve) => {
    finishConnecting = () => {
      events.push(["connected"]);
      resolve();
    };
  });

  const starting = startServer({
    application: createApplication(events),
    connect: () => connection,
    connectCache: async () => events.push(["cache-connected"]),
    configureServer: (server) => server,
    env: { PORT: "3000" },
    validateEnv: () => events.push(["validated"]),
  });

  await Promise.resolve();
  assert.deepEqual(events, [["validated"]]);

  finishConnecting();
  const server = await starting;

  assert.deepEqual(events, [
    ["validated"],
    ["connected"],
    ["cache-connected"],
    ["listen", 3000, "0.0.0.0"],
  ]);
  assert.deepEqual(server, { port: 3000, host: "0.0.0.0" });
});

test("startServer does not accept traffic when MongoDB connection fails", async () => {
  const events = [];
  const connectionError = new Error("database unavailable");

  await assert.rejects(
    startServer({
      application: createApplication(events),
      connect: async () => {
        throw connectionError;
      },
      connectCache: async () => events.push(["cache-connected"]),
      env: { PORT: "3000" },
      validateEnv: () => events.push(["validated"]),
    }),
    connectionError
  );

  assert.deepEqual(events, [["validated"]]);
});

test("startServer rejects a missing port before connecting", async () => {
  let connectionAttempted = false;

  await assert.rejects(
    startServer({
      application: createApplication([]),
      connect: async () => {
        connectionAttempted = true;
      },
      connectCache: async () => {},
      env: {},
      validateEnv: () => {},
    }),
    /PORT must be an integer between 1 and 65535/
  );

  assert.equal(connectionAttempted, false);
});

test("startServer accepts traffic in degraded mode when cache startup fails", async () => {
  const events = [];
  const cacheError = new Error("cache unavailable");
  const warnings = [];

  const server = await startServer({
    application: createApplication(events),
    connect: async () => events.push(["database-connected"]),
    connectCache: async () => {
      throw cacheError;
    },
    configureServer: (value) => value,
    env: { PORT: "3000" },
    logger: { warn(message) { warnings.push(JSON.parse(message)); } },
    validateEnv: () => events.push(["validated"]),
  });

  assert.deepEqual(events, [
    ["validated"],
    ["database-connected"],
    ["listen", 3000, "0.0.0.0"],
  ]);
  assert.deepEqual(server, { port: 3000, host: "0.0.0.0" });
  assert.equal(warnings[0].event, "redis_startup_degraded");
});
