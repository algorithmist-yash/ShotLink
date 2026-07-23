const DEFAULT_DURATION_BUCKETS_MS = Object.freeze([
  50,
  100,
  250,
  500,
  1000,
  2500,
  5000,
]);

const ALLOWED_HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
const ALLOWED_CACHE_NAMES = new Set(["route", "domain", "entitlement", "usage"]);
const ALLOWED_CACHE_RESULTS = new Set([
  "hit",
  "miss",
  "write",
  "invalidate",
  "error",
  "bypass",
]);
const ALLOWED_QUEUE_NAMES = new Set(["redirect_event", "url_health"]);
const ALLOWED_QUEUE_STATUSES = new Set(["pending", "processing", "dead"]);

function normalizeHttpMethod(method) {
  const normalized = String(method || "").toUpperCase();
  return ALLOWED_HTTP_METHODS.has(normalized) ? normalized : "OTHER";
}

function getStatusClass(statusCode, aborted) {
  if (aborted) {
    return "aborted";
  }

  const numericStatus = Number(statusCode);
  return Number.isInteger(numericStatus) && numericStatus >= 100 && numericStatus <= 599
    ? `${Math.floor(numericStatus / 100)}xx`
    : "unknown";
}

function createMetricsRegistry({
  bucketsMs = DEFAULT_DURATION_BUCKETS_MS,
  runtime = process,
} = {}) {
  const requestCounts = new Map();
  const durationStats = new Map();
  const cacheCounts = new Map();
  const queueDepths = new Map();

  function observeHttpRequest({ method, statusCode, durationMs, aborted = false }) {
    const normalizedMethod = normalizeHttpMethod(method);
    const statusClass = getStatusClass(statusCode, aborted);
    const countKey = `${normalizedMethod}:${statusClass}`;
    const normalizedDuration =
      Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;

    requestCounts.set(countKey, (requestCounts.get(countKey) || 0) + 1);

    const stats = durationStats.get(normalizedMethod) || {
      count: 0,
      sumMs: 0,
      buckets: bucketsMs.map(() => 0),
    };

    stats.count += 1;
    stats.sumMs += normalizedDuration;
    bucketsMs.forEach((bucket, index) => {
      if (normalizedDuration <= bucket) {
        stats.buckets[index] += 1;
      }
    });
    durationStats.set(normalizedMethod, stats);
  }

  function observeCacheOperation({ cache, result }) {
    const normalizedCache = ALLOWED_CACHE_NAMES.has(cache) ? cache : "other";
    const normalizedResult = ALLOWED_CACHE_RESULTS.has(result) ? result : "other";
    const key = `${normalizedCache}:${normalizedResult}`;
    cacheCounts.set(key, (cacheCounts.get(key) || 0) + 1);
  }

  function setQueueDepth({ queue, status, value }) {
    const normalizedQueue = ALLOWED_QUEUE_NAMES.has(queue) ? queue : "other";
    const normalizedStatus = ALLOWED_QUEUE_STATUSES.has(status) ? status : "other";
    const normalizedValue = Number.isFinite(Number(value))
      ? Math.max(Number(value), 0)
      : 0;
    queueDepths.set(`${normalizedQueue}:${normalizedStatus}`, normalizedValue);
  }

  function render() {
    const lines = [
      "# HELP shotlink_http_requests_total Completed and aborted HTTP requests.",
      "# TYPE shotlink_http_requests_total counter",
    ];

    for (const key of [...requestCounts.keys()].sort()) {
      const [method, statusClass] = key.split(":");
      lines.push(
        `shotlink_http_requests_total{method="${method}",status_class="${statusClass}"} ${requestCounts.get(key)}`
      );
    }

    lines.push(
      "# HELP shotlink_http_request_duration_seconds HTTP request duration in seconds.",
      "# TYPE shotlink_http_request_duration_seconds histogram"
    );

    for (const method of [...durationStats.keys()].sort()) {
      const stats = durationStats.get(method);
      bucketsMs.forEach((bucket, index) => {
        lines.push(
          `shotlink_http_request_duration_seconds_bucket{method="${method}",le="${bucket / 1000}"} ${stats.buckets[index]}`
        );
      });
      lines.push(
        `shotlink_http_request_duration_seconds_bucket{method="${method}",le="+Inf"} ${stats.count}`,
        `shotlink_http_request_duration_seconds_sum{method="${method}"} ${stats.sumMs / 1000}`,
        `shotlink_http_request_duration_seconds_count{method="${method}"} ${stats.count}`
      );
    }

    lines.push(
      "# HELP shotlink_cache_operations_total Cache reads, writes, invalidations, and failures.",
      "# TYPE shotlink_cache_operations_total counter"
    );
    for (const key of [...cacheCounts.keys()].sort()) {
      const [cache, result] = key.split(":");
      lines.push(
        `shotlink_cache_operations_total{cache="${cache}",result="${result}"} ${cacheCounts.get(key)}`
      );
    }

    lines.push(
      "# HELP shotlink_background_queue_depth Current durable background queue depth by state.",
      "# TYPE shotlink_background_queue_depth gauge"
    );
    for (const key of [...queueDepths.keys()].sort()) {
      const [queue, status] = key.split(":");
      lines.push(
        `shotlink_background_queue_depth{queue="${queue}",status="${status}"} ${queueDepths.get(key)}`
      );
    }

    const memory = runtime.memoryUsage();
    lines.push(
      "# HELP shotlink_process_uptime_seconds Process uptime in seconds.",
      "# TYPE shotlink_process_uptime_seconds gauge",
      `shotlink_process_uptime_seconds ${runtime.uptime()}`,
      "# HELP shotlink_process_resident_memory_bytes Resident memory size in bytes.",
      "# TYPE shotlink_process_resident_memory_bytes gauge",
      `shotlink_process_resident_memory_bytes ${memory.rss}`,
      "# HELP shotlink_process_heap_used_bytes JavaScript heap used in bytes.",
      "# TYPE shotlink_process_heap_used_bytes gauge",
      `shotlink_process_heap_used_bytes ${memory.heapUsed}`
    );

    return `${lines.join("\n")}\n`;
  }

  return {
    observeCacheOperation,
    observeHttpRequest,
    render,
    setQueueDepth,
  };
}

module.exports = {
  createMetricsRegistry,
  DEFAULT_DURATION_BUCKETS_MS,
  getStatusClass,
  metricsRegistry: createMetricsRegistry(),
  normalizeHttpMethod,
};
