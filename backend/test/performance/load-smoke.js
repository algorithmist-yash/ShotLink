const { performance } = require("node:perf_hooks");

const { HttpTestClient, startIntegrationEnvironment } = require("../integration/harness");

const REQUEST_COUNT = Number(process.env.LOAD_REQUEST_COUNT || 120);
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY || 20);
const MAX_P95_MS = Number(process.env.LOAD_MAX_P95_MS || 750);
const MAX_ERROR_RATE = Number(process.env.LOAD_MAX_ERROR_RATE || 0.01);
const MIN_REQUESTS_PER_SECOND = Number(process.env.LOAD_MIN_RPS || 25);

const ACCOUNT_CONSENTS = {
  ageConfirmed: true,
  analyticsAccepted: true,
  lawfulUseAccepted: true,
  privacyAccepted: true,
  termsAccepted: true,
};
const LINK_COMPLIANCE = {
  abusePolicyAccepted: true,
  destinationAuthorityAccepted: true,
  securityScanAccepted: true,
};

function percentile(values, quantile) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(Math.ceil(quantile * sorted.length) - 1, sorted.length - 1);
  return sorted[Math.max(index, 0)] || 0;
}

async function runBoundedLoad(makeRequest) {
  const results = new Array(REQUEST_COUNT);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < REQUEST_COUNT) {
      const index = nextIndex;
      nextIndex += 1;
      const startedAt = performance.now();
      try {
        const response = await makeRequest(index);
        results[index] = {
          durationMs: performance.now() - startedAt,
          ok: response.status >= 200 && response.status < 400,
          status: response.status,
        };
      } catch (error) {
        results[index] = {
          durationMs: performance.now() - startedAt,
          error: error.message,
          ok: false,
          status: 0,
        };
      }
    }
  }

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { elapsedMs: performance.now() - startedAt, results };
}

async function main() {
  const environment = await startIntegrationEnvironment({ databaseName: "shotlink_load_smoke" });
  try {
    const client = new HttpTestClient(environment.baseUrl);
    const registration = await client.request("/api/v1/auth/register", {
      method: "POST",
      body: {
        name: "Load Test Owner",
        email: `load-${Date.now()}@integration.test`,
        password: "StrongPass123",
        workspaceName: "Load Test Workspace",
        consents: ACCOUNT_CONSENTS,
      },
    });
    if (registration.status !== 201) throw new Error("Load fixture registration failed");

    const link = await client.request("/api/v1/links", {
      method: "POST",
      headers: { "X-CSRF-Token": registration.body.csrfToken },
      body: {
        originalUrl: "https://example.com/load-target",
        customAlias: "load-smoke",
        expiresInMinutes: 60,
        compliance: LINK_COMPLIANCE,
      },
    });
    if (link.status !== 201) throw new Error("Load fixture link creation failed");

    const load = await runBoundedLoad((index) =>
      fetch(`${environment.baseUrl}${index % 4 === 0 ? "/live" : "/load-smoke"}`, {
        redirect: "manual",
      })
    );
    const durations = load.results.map((result) => result.durationMs);
    const failed = load.results.filter((result) => !result.ok);
    const summary = {
      concurrency: CONCURRENCY,
      errorRate: failed.length / REQUEST_COUNT,
      p50Ms: Number(percentile(durations, 0.5).toFixed(2)),
      p95Ms: Number(percentile(durations, 0.95).toFixed(2)),
      p99Ms: Number(percentile(durations, 0.99).toFixed(2)),
      requestCount: REQUEST_COUNT,
      requestsPerSecond: Number((REQUEST_COUNT / (load.elapsedMs / 1000)).toFixed(2)),
    };
    console.log(JSON.stringify({ event: "load_smoke_result", ...summary }));

    const violations = [];
    if (summary.p95Ms > MAX_P95_MS) violations.push(`p95 ${summary.p95Ms}ms > ${MAX_P95_MS}ms`);
    if (summary.errorRate > MAX_ERROR_RATE) violations.push(`error rate ${summary.errorRate} > ${MAX_ERROR_RATE}`);
    if (summary.requestsPerSecond < MIN_REQUESTS_PER_SECOND) {
      violations.push(`throughput ${summary.requestsPerSecond}rps < ${MIN_REQUESTS_PER_SECOND}rps`);
    }
    if (violations.length) throw new Error(`Load SLO failed: ${violations.join(", ")}`);
  } finally {
    await environment.stop();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
