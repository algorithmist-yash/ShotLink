function createPollingWorker({
  processNext,
  logger = console,
  workerName,
  batchSize = 50,
  pollIntervalMs = 1000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  if (typeof processNext !== "function") {
    throw new TypeError("processNext must be a function");
  }
  if (!workerName) {
    throw new TypeError("workerName is required");
  }

  let activeRun = null;
  let started = false;
  let timer = null;
  let wakeRequested = false;

  const schedule = (delayMs) => {
    if (!started || timer) return;

    timer = setTimer(() => {
      timer = null;
      run();
    }, delayMs);
    timer.unref?.();
  };

  const run = () => {
    if (!started) return Promise.resolve();
    if (activeRun) {
      wakeRequested = true;
      return activeRun;
    }

    wakeRequested = false;
    activeRun = (async () => {
      for (let processed = 0; started && processed < batchSize; processed += 1) {
        const foundJob = await processNext({ logger });
        if (!foundJob) break;
      }
    })()
      .catch((error) => {
        logger.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            event: `${workerName}_worker_failed`,
            error: error.message,
          })
        );
      })
      .finally(() => {
        activeRun = null;
        if (started) schedule(wakeRequested ? 0 : pollIntervalMs);
      });

    return activeRun;
  };

  return {
    isStarted() {
      return started;
    },
    start() {
      if (started) return;
      started = true;
      schedule(0);
    },
    async stop() {
      started = false;
      if (timer) {
        clearTimer(timer);
        timer = null;
      }
      if (activeRun) await activeRun;
    },
    wake() {
      if (!started) return;
      wakeRequested = true;
      if (timer) {
        clearTimer(timer);
        timer = null;
      }
      run();
    },
  };
}

module.exports = { createPollingWorker };
