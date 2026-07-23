const { getRedisClient } = require("../config/redis");
const { metricsRegistry } = require("./metricsService");

const CACHE_COMMAND_TIMEOUT_MS = 150;
const ERROR_LOG_INTERVAL_MS = 30_000;
const lastErrorLogs = new Map();

function withTimeout(promise, timeoutMs = CACHE_COMMAND_TIMEOUT_MS) {
  let timeout;
  const deadline = new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new Error(`Cache command exceeded ${timeoutMs}ms`);
      error.code = "CACHE_TIMEOUT";
      reject(error);
    }, timeoutMs);
    timeout.unref?.();
  });

  return Promise.race([promise, deadline]).finally(() => clearTimeout(timeout));
}

function observe(metrics, cache, result) {
  metrics.observeCacheOperation?.({ cache, result });
}

function logCacheError(logger, cache, operation, error, now = Date.now()) {
  const logKey = `${cache}:${operation}`;
  const lastLoggedAt = lastErrorLogs.get(logKey) || 0;
  if (now - lastLoggedAt < ERROR_LOG_INTERVAL_MS) return;

  lastErrorLogs.set(logKey, now);
  const log = logger.warn || logger.error || console.warn;
  log.call(
    logger,
    JSON.stringify({
      timestamp: new Date(now).toISOString(),
      level: "warn",
      event: "cache_operation_failed",
      cache,
      operation,
      error: error.message,
    })
  );
}

function getReadyClient(client) {
  return client?.isReady ? client : null;
}

async function getJson(
  cache,
  key,
  {
    client = getRedisClient(),
    logger = console,
    metrics = metricsRegistry,
    timeoutMs = CACHE_COMMAND_TIMEOUT_MS,
  } = {}
) {
  const readyClient = getReadyClient(client);
  if (!readyClient) {
    observe(metrics, cache, "bypass");
    return { hit: false, value: null };
  }

  try {
    const rawValue = await withTimeout(readyClient.get(key), timeoutMs);
    if (rawValue === null) {
      observe(metrics, cache, "miss");
      return { hit: false, value: null };
    }

    const value = JSON.parse(rawValue);
    observe(metrics, cache, "hit");
    return { hit: true, value };
  } catch (error) {
    observe(metrics, cache, "error");
    logCacheError(logger, cache, "get", error);
    return { hit: false, value: null };
  }
}

async function setJson(
  cache,
  key,
  value,
  ttlSeconds,
  {
    client = getRedisClient(),
    logger = console,
    metrics = metricsRegistry,
    timeoutMs = CACHE_COMMAND_TIMEOUT_MS,
  } = {}
) {
  const readyClient = getReadyClient(client);
  if (!readyClient || !Number.isInteger(ttlSeconds) || ttlSeconds < 1) {
    observe(metrics, cache, "bypass");
    return false;
  }

  try {
    await withTimeout(
      readyClient.setEx(key, ttlSeconds, JSON.stringify(value)),
      timeoutMs
    );
    observe(metrics, cache, "write");
    return true;
  } catch (error) {
    observe(metrics, cache, "error");
    logCacheError(logger, cache, "set", error);
    return false;
  }
}

async function deleteKeys(
  cache,
  keys,
  {
    client = getRedisClient(),
    logger = console,
    metrics = metricsRegistry,
    timeoutMs = CACHE_COMMAND_TIMEOUT_MS,
  } = {}
) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  const readyClient = getReadyClient(client);
  if (!readyClient || !uniqueKeys.length) {
    observe(metrics, cache, "bypass");
    return false;
  }

  try {
    await withTimeout(readyClient.del(uniqueKeys), timeoutMs);
    observe(metrics, cache, "invalidate");
    return true;
  } catch (error) {
    observe(metrics, cache, "error");
    logCacheError(logger, cache, "delete", error);
    return false;
  }
}

function resetCacheErrorLogsForTests() {
  lastErrorLogs.clear();
}

module.exports = {
  CACHE_COMMAND_TIMEOUT_MS,
  ERROR_LOG_INTERVAL_MS,
  deleteKeys,
  getJson,
  resetCacheErrorLogsForTests,
  setJson,
  withTimeout,
};
