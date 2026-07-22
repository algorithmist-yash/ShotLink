const DATABASE_STATE_NAMES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
  99: "uninitialized",
};

function getReadinessResponse(
  databaseReadyState,
  now = new Date(),
  redisState = "disabled"
) {
  const isReady = databaseReadyState === 1;
  const isDegraded = isReady && !["connected", "disabled"].includes(redisState);

  return {
    statusCode: isReady ? 200 : 503,
    body: {
      status: isReady ? (isDegraded ? "degraded" : "ok") : "unavailable",
      service: "shotlink",
      timestamp: now.toISOString(),
      dependencies: {
        mongodb: DATABASE_STATE_NAMES[databaseReadyState] || "unknown",
        redis: redisState,
      },
    },
  };
}

function getLivenessResponse(now = new Date()) {
  return {
    statusCode: 200,
    body: {
      status: "ok",
      service: "shotlink",
      timestamp: now.toISOString(),
    },
  };
}

module.exports = { getLivenessResponse, getReadinessResponse };
