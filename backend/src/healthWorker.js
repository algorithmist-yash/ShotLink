require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = require("../config/db");
const { validateWorkerEnv } = require("./config/env");
const { registerBackgroundProcessHandlers } = require("./config/lifecycle");
const { closeRedis, connectRedis } = require("./config/redis");
const { urlHealthWorker } = require("./services/urlHealthQueueService");

async function startHealthWorker({
  worker = urlHealthWorker,
  connect = connectDB,
  connectCache = connectRedis,
  env = process.env,
  logger = console,
  validateEnv = validateWorkerEnv,
} = {}) {
  validateEnv(env);
  await connect();

  try {
    await connectCache({ env, logger });
  } catch (error) {
    logger.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        event: "redis_startup_degraded",
        process: "url_health_worker",
        error: error.message,
      })
    );
  }

  worker.start();
  logger.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "url_health_worker_started",
    })
  );
  return worker;
}

async function stopHealthWorker({
  worker = urlHealthWorker,
  signal,
  disconnectCache = closeRedis,
  disconnect = () => mongoose.disconnect(),
  logger = console,
} = {}) {
  logger.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "url_health_worker_shutdown_started",
      signal,
    })
  );
  const failures = [];
  for (const close of [
    () => worker.stop(),
    () => disconnectCache(),
    () => disconnect(),
  ]) {
    try {
      await close();
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length) {
    throw new AggregateError(failures, "URL health worker shutdown failed");
  }

  logger.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "url_health_worker_shutdown_completed",
      signal,
    })
  );
}

if (require.main === module) {
  startHealthWorker()
    .then((worker) => {
      registerBackgroundProcessHandlers({
        shutdown: (options) => stopHealthWorker({ ...options, worker }),
      });
    })
    .catch((error) => {
      console.error("URL health worker startup failed:", error.message);
      process.exit(1);
    });
}

module.exports = { startHealthWorker, stopHealthWorker };
