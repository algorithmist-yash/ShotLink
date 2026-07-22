const { createClient } = require("redis");

const MAX_RECONNECT_DELAY_MS = 3000;
const REDIS_CONNECT_TIMEOUT_MS = 5000;
const REDIS_STARTUP_WAIT_MS = 5000;

let redisClient = null;
let redisConfigured = false;

function getReconnectDelay(retries, random = Math.random) {
  const jitter = Math.floor(random() * 100);
  return Math.min(2 ** Math.max(retries, 0) * 50, MAX_RECONNECT_DELAY_MS) + jitter;
}

function buildRedisOptions(url) {
  return {
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: (retries) => getReconnectDelay(retries),
    },
  };
}

function logRedisEvent(logger, level, event, details = {}) {
  const log = logger[level] || logger.info || console.log;
  log.call(
    logger,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...details,
    })
  );
}

async function connectRedis({
  env = process.env,
  logger = console,
  createClientImpl = createClient,
  startupWaitMs = REDIS_STARTUP_WAIT_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const url = String(env.REDIS_URL || "").trim();
  redisConfigured = Boolean(url);

  if (!url) {
    redisClient = null;
    return false;
  }

  if (redisClient?.isReady) {
    return true;
  }

  const client = createClientImpl(buildRedisOptions(url));
  client.on("error", (error) => {
    logRedisEvent(logger, "error", "redis_connection_error", {
      error: error.message,
    });
  });
  client.on("reconnecting", () => {
    logRedisEvent(logger, "info", "redis_reconnecting");
  });
  client.on("ready", () => {
    logRedisEvent(logger, "info", "redis_connected");
  });

  redisClient = client;
  const connection = Promise.resolve()
    .then(() => client.connect())
    .then(() => true)
    .catch((error) => {
      logRedisEvent(logger, "error", "redis_initial_connection_failed", {
        error: error.message,
      });
      return false;
    });
  let timeout;
  const startupDeadline = new Promise((resolve) => {
    timeout = setTimer(() => resolve(false), startupWaitMs);
    timeout.unref?.();
  });
  const connected = await Promise.race([connection, startupDeadline]);
  clearTimer(timeout);

  if (!connected) {
    logRedisEvent(logger, "warn", "redis_startup_degraded", {
      startupWaitMs,
    });
  }

  return connected;
}

async function closeRedis() {
  const client = redisClient;
  redisClient = null;

  if (!client?.isOpen) {
    return;
  }

  await client.close();
}

function getRedisClient() {
  return redisClient;
}

function getRedisState() {
  if (!redisConfigured) return "disabled";
  if (redisClient?.isReady) return "connected";
  if (redisClient?.isOpen) return "connecting";
  return "disconnected";
}

function resetRedisForTests() {
  redisClient = null;
  redisConfigured = false;
}

module.exports = {
  MAX_RECONNECT_DELAY_MS,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_STARTUP_WAIT_MS,
  buildRedisOptions,
  closeRedis,
  connectRedis,
  getReconnectDelay,
  getRedisClient,
  getRedisState,
  resetRedisForTests,
};
