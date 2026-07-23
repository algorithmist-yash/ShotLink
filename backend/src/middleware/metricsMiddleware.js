const { performance } = require("node:perf_hooks");

const { metricsRegistry } = require("../services/metricsService");

function createMetricsMiddleware({
  registry = metricsRegistry,
  clock = () => performance.now(),
} = {}) {
  return (req, res, next) => {
    const startedAt = clock();
    let observed = false;

    const observe = ({ aborted, statusCode }) => {
      if (observed) {
        return;
      }

      observed = true;
      registry.observeHttpRequest({
        method: req.method,
        statusCode,
        durationMs: Math.max(0, clock() - startedAt),
        aborted,
      });
    };

    res.once("finish", () => observe({ aborted: false, statusCode: res.statusCode }));
    res.once("close", () => {
      if (!res.writableEnded) {
        observe({ aborted: true, statusCode: null });
      }
    });

    next();
  };
}

module.exports = {
  createMetricsMiddleware,
  requestMetrics: createMetricsMiddleware(),
};
