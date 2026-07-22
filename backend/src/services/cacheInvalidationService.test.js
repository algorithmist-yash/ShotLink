const assert = require("node:assert/strict");
const test = require("node:test");

const {
  invalidateCustomDomain,
  invalidateUrlRoute,
  invalidateUsageCounter,
  invalidateWorkspaceEntitlement,
} = require("./cacheInvalidationService");
const {
  domainCacheKey,
  entitlementCacheKey,
  routeCacheKey,
  usageCacheKey,
} = require("./redirectCacheKeys");

test("URL invalidation clears both default and branded route keys", async () => {
  let deletion;
  await invalidateUrlRoute(
    { shortCode: "launch", customDomainHost: "go.example.com" },
    { deleteKeys: async (cache, keys) => { deletion = { cache, keys }; } }
  );

  assert.deepEqual(deletion, {
    cache: "route",
    keys: [
      routeCacheKey("default", "launch"),
      routeCacheKey("go.example.com", "launch"),
    ],
  });
});

test("domain, entitlement, and usage invalidations target exact keys", async () => {
  const deletions = [];
  const dependencies = {
    deleteKeys: async (cache, keys) => deletions.push({ cache, keys }),
  };
  const date = new Date("2026-07-20T12:00:00.000Z");

  await invalidateCustomDomain("go.example.com", dependencies);
  await invalidateWorkspaceEntitlement("workspace-1", dependencies);
  await invalidateUsageCounter("workspace-1", date, dependencies);

  assert.deepEqual(deletions, [
    { cache: "domain", keys: [domainCacheKey("go.example.com")] },
    { cache: "entitlement", keys: [entitlementCacheKey("workspace-1")] },
    { cache: "usage", keys: [usageCacheKey("workspace-1", "2026-07")] },
  ]);
});
