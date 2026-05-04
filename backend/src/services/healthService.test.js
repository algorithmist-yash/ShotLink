const test = require("node:test");
const assert = require("node:assert/strict");

const {
  HEALTH_TTL_MS,
  needsHealthRefresh,
  selectRedirectTarget,
} = require("./healthService");

test("selectRedirectTarget prefers a healthy primary destination", () => {
  const selection = selectRedirectTarget({
    originalUrl: "https://primary.example.com",
    primaryHealth: { status: "healthy" },
    fallbackUrls: [
      { url: "https://backup.example.com", label: "Fallback 1", priority: 0, isActive: true, lastStatus: "healthy" },
    ],
  });

  assert.equal(selection.kind, "primary");
  assert.equal(selection.url, "https://primary.example.com");
});

test("selectRedirectTarget falls back when the primary is unhealthy", () => {
  const selection = selectRedirectTarget({
    originalUrl: "https://primary.example.com",
    primaryHealth: { status: "unhealthy" },
    fallbackUrls: [
      { url: "https://backup-1.example.com", label: "Fallback 1", priority: 0, isActive: true, lastStatus: "healthy" },
      { url: "https://backup-2.example.com", label: "Fallback 2", priority: 1, isActive: true, lastStatus: "unknown" },
    ],
  });

  assert.equal(selection.kind, "fallback");
  assert.equal(selection.url, "https://backup-1.example.com");
});

test("needsHealthRefresh returns true when no recent primary health check exists", () => {
  assert.equal(needsHealthRefresh({ primaryHealth: { lastCheckedAt: null } }), true);
  assert.equal(
    needsHealthRefresh({
      primaryHealth: { lastCheckedAt: new Date(Date.now() - HEALTH_TTL_MS - 1000).toISOString() },
    }),
    true
  );
  assert.equal(
    needsHealthRefresh({
      primaryHealth: { lastCheckedAt: new Date().toISOString() },
    }),
    false
  );
});
