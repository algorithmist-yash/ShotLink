const { performance } = require("node:perf_hooks");

function getSafeRequestPath(req) {
  const requestPath = req.originalUrl || req.path || req.url || "/";
  return String(requestPath).split("?", 1)[0];
}

function createRequestLogger({
  logger = console,
  clock = () => performance.now(),
  timestamp = () => new Date().toISOString(),
} = {}) {
  return (req, res, next) => {
    const startedAt = clock();
    let logged = false;

    const writeLog = (event, statusCode) => {
      if (logged) {
        return;
      }

      logged = true;
      const durationMs = Math.max(0, clock() - startedAt);

      logger.info(
        JSON.stringify({
          timestamp: timestamp(),
          level: "info",
          event,
          requestId: req.id || null,
          method: req.method,
          path: getSafeRequestPath(req),
          statusCode,
          durationMs: Number(durationMs.toFixed(2)),
        })
      );
    };

    res.once("finish", () => writeLog("http_request", res.statusCode));
    res.once("close", () => {
      if (!res.writableEnded) {
        writeLog("http_request_aborted", null);
      }
    });

    next();
  };
}

module.exports = {
  createRequestLogger,
  getSafeRequestPath,
  requestLogger: createRequestLogger(),
};
