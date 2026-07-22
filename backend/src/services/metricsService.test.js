const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createMetricsRegistry,
  getStatusClass,
  normalizeHttpMethod,
} = require("./metricsService");

test("metrics use bounded method and status labels", () => {
  assert.equal(normalizeHttpMethod("get"), "GET");
  assert.equal(normalizeHttpMethod("attacker-controlled-method"), "OTHER");
  assert.equal(getStatusClass(204, false), "2xx");
  assert.equal(getStatusClass(503, false), "5xx");
  assert.equal(getStatusClass(null, true), "aborted");
});

test("metrics render Prometheus counters, histograms, and process gauges", () => {
  const registry = createMetricsRegistry({
    bucketsMs: [50, 250],
    runtime: {
      uptime: () => 123.5,
      memoryUsage: () => ({ rss: 2048, heapUsed: 1024 }),
    },
  });

  registry.observeHttpRequest({ method: "GET", statusCode: 200, durationMs: 40 });
  registry.observeHttpRequest({ method: "GET", statusCode: 503, durationMs: 200 });
  registry.observeHttpRequest({ method: "CUSTOM", durationMs: 10, aborted: true });
  registry.observeCacheOperation({ cache: "route", result: "hit" });
  registry.observeCacheOperation({ cache: "attacker-input", result: "unknown" });
  registry.setQueueDepth({ queue: "url_health", status: "pending", value: 7 });
  registry.setQueueDepth({ queue: "redirect_event", status: "dead", value: 2 });
  registry.setQueueDepth({ queue: "attacker-input", status: "unknown", value: -4 });

  const output = registry.render();

  assert.match(
    output,
    /shotlink_http_requests_total\{method="GET",status_class="2xx"\} 1/
  );
  assert.match(
    output,
    /shotlink_http_requests_total\{method="OTHER",status_class="aborted"\} 1/
  );
  assert.match(
    output,
    /shotlink_http_request_duration_seconds_bucket\{method="GET",le="0.05"\} 1/
  );
  assert.match(
    output,
    /shotlink_http_request_duration_seconds_bucket\{method="GET",le="0.25"\} 2/
  );
  assert.match(output, /shotlink_process_uptime_seconds 123.5/);
  assert.match(output, /shotlink_process_resident_memory_bytes 2048/);
  assert.match(
    output,
    /shotlink_cache_operations_total\{cache="route",result="hit"\} 1/
  );
  assert.match(
    output,
    /shotlink_cache_operations_total\{cache="other",result="other"\} 1/
  );
  assert.match(
    output,
    /shotlink_background_queue_depth\{queue="url_health",status="pending"\} 7/
  );
  assert.match(
    output,
    /shotlink_background_queue_depth\{queue="redirect_event",status="dead"\} 2/
  );
  assert.match(
    output,
    /shotlink_background_queue_depth\{queue="other",status="other"\} 0/
  );
  assert.equal(output.includes("shortCode"), false);
  assert.equal(output.endsWith("\n"), true);
});
