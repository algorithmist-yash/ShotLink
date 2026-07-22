const assert = require("node:assert/strict");
const test = require("node:test");

const { createPollingWorker } = require("./pollingWorker");

test("polling workers require a processor and a stable worker name", () => {
  assert.throws(() => createPollingWorker({ workerName: "test" }), /processNext/);
  assert.throws(() => createPollingWorker({ processNext() {} }), /workerName/);
});

test("polling workers drain bounded batches and stop cleanly", async () => {
  const scheduled = [];
  const cleared = [];
  let calls = 0;
  const worker = createPollingWorker({
    workerName: "test",
    batchSize: 2,
    processNext: async () => {
      calls += 1;
      return calls < 2;
    },
    setTimer(callback, delay) {
      const timer = { callback, delay, unref() {} };
      scheduled.push(timer);
      return timer;
    },
    clearTimer(timer) {
      cleared.push(timer);
    },
  });

  worker.start();
  assert.equal(worker.isStarted(), true);
  assert.equal(scheduled[0].delay, 0);
  scheduled[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  await worker.stop();

  assert.equal(calls, 2);
  assert.equal(worker.isStarted(), false);
  assert.equal(cleared.length, 1);
});

test("polling workers contain processor failures and emit bounded structured logs", async () => {
  const scheduled = [];
  const messages = [];
  const worker = createPollingWorker({
    workerName: "test_queue",
    processNext: async () => {
      throw new Error("processor failed");
    },
    logger: {
      error(message) {
        messages.push(JSON.parse(message));
      },
    },
    setTimer(callback) {
      const timer = { callback, unref() {} };
      scheduled.push(timer);
      return timer;
    },
    clearTimer() {},
  });

  worker.start();
  scheduled[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  await worker.stop();

  assert.equal(messages.length, 1);
  assert.equal(messages[0].event, "test_queue_worker_failed");
  assert.equal(messages[0].error, "processor failed");
});
