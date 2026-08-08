const assert = require("node:assert/strict");
const test = require("node:test");

const {
  EXPIRED_ROUTE_TTL_SECONDS,
  NEGATIVE_TTL_SECONDS,
  getRedirectEntitlement,
  getRouteTtlSeconds,
  hydrateUrlSnapshot,
  isDefaultRedirectHost,
  resetRedirectResolutionForTests,
  resolveUrlForRequest,
  serializeUrlSnapshot,
} = require("./redirectResolutionService");

test("the public shotlink.in domain is always treated as a default redirect host", () => {
  const env = {
    APP_BASE_URL: "https://shotlink.in",
    BASE_URL: "https://go.shotlink.in",
    SHORTLINK_BASE_URL: "https://shotlink.in",
  };

  assert.equal(isDefaultRedirectHost("shotlink.in", env), true);
  assert.equal(isDefaultRedirectHost("go.shotlink.in", env), true);
  assert.equal(isDefaultRedirectHost("go.customer.example", env), false);
});

function createMemoryCache() {
  const values = new Map();
  const writes = [];
  return {
    values,
    writes,
    async getJson(_cache, key) {
      return values.has(key)
        ? { hit: true, value: values.get(key) }
        : { hit: false, value: null };
    },
    async setJson(cache, key, value, ttlSeconds) {
      writes.push({ cache, key, value, ttlSeconds });
      values.set(key, value);
      return true;
    },
  };
}

function createUrl(overrides = {}) {
  return {
    _id: "url-1",
    workspaceId: "workspace-1",
    shortCode: "launch",
    customDomainHost: "",
    originalUrl: "https://destination.example.com/path",
    expiresAt: new Date("2026-07-20T12:01:00.000Z"),
    isActive: true,
    primaryHealth: {
      status: "healthy",
      lastStatusCode: 200,
      lastCheckedAt: new Date("2026-07-20T11:59:00.000Z"),
      lastFailureReason: "",
    },
    fallbackUrls: [
      {
        url: "https://fallback.example.com",
        label: "Fallback",
        priority: 1,
        isActive: true,
        lastStatus: "healthy",
        lastStatusCode: 204,
        lastCheckedAt: new Date("2026-07-20T11:59:30.000Z"),
        lastFailureReason: "",
      },
    ],
    ...overrides,
  };
}

test("compact route snapshots preserve the dates used by redirect logic", () => {
  const original = createUrl();
  const snapshot = serializeUrlSnapshot(original);
  const hydrated = hydrateUrlSnapshot(snapshot);

  assert.equal(snapshot.clicks, undefined);
  assert.equal(snapshot.compliance, undefined);
  assert.equal(typeof snapshot.expiresAt, "string");
  assert.ok(hydrated.expiresAt instanceof Date);
  assert.ok(hydrated.primaryHealth.lastCheckedAt instanceof Date);
  assert.ok(hydrated.fallbackUrls[0].lastCheckedAt instanceof Date);
  assert.equal(hydrated.originalUrl, original.originalUrl);
});

test("active route TTL never outlives link expiry", () => {
  const now = new Date("2026-07-20T12:00:00.000Z").getTime();
  assert.equal(getRouteTtlSeconds(createUrl(), now), 60);
  assert.equal(
    getRouteTtlSeconds(
      createUrl({ expiresAt: new Date("2026-07-20T12:00:09.900Z") }),
      now
    ),
    9
  );
  assert.equal(
    getRouteTtlSeconds(
      createUrl({ expiresAt: new Date("2026-07-20T11:59:59.000Z") }),
      now
    ),
    EXPIRED_ROUTE_TTL_SECONDS
  );
});

test("default redirects read MongoDB once and then use the route cache", async (t) => {
  t.after(resetRedirectResolutionForTests);
  const cache = createMemoryCache();
  const url = createUrl();
  let databaseReads = 0;
  const UrlModel = {
    async findOne(filter) {
      databaseReads += 1;
      assert.deepEqual(filter, { shortCode: "launch" });
      return url;
    },
  };
  const request = { hostname: "localhost", headers: {}, get() { return ""; } };
  const options = {
    UrlModel,
    WorkspaceModel: {},
    cache,
    env: {},
    now: () => new Date("2026-07-20T12:00:00.000Z").getTime(),
  };

  const first = await resolveUrlForRequest(request, "launch", options);
  const second = await resolveUrlForRequest(request, "launch", options);

  assert.equal(first, url);
  assert.equal(second.originalUrl, url.originalUrl);
  assert.ok(second.expiresAt instanceof Date);
  assert.equal(databaseReads, 1);
  assert.equal(cache.writes[0].cache, "route");
});

test("missing default routes are negatively cached for a short interval", async (t) => {
  t.after(resetRedirectResolutionForTests);
  const cache = createMemoryCache();
  let databaseReads = 0;
  const options = {
    UrlModel: { async findOne() { databaseReads += 1; return null; } },
    WorkspaceModel: {},
    cache,
    env: {},
  };
  const request = { hostname: "localhost", headers: {}, get() { return ""; } };

  assert.equal(await resolveUrlForRequest(request, "missing", options), null);
  assert.equal(await resolveUrlForRequest(request, "missing", options), null);
  assert.equal(databaseReads, 1);
  assert.equal(cache.writes[0].ttlSeconds, NEGATIVE_TTL_SECONDS);
  assert.deepEqual(cache.writes[0].value, { found: false });
});

test("custom domains cache verified ownership and scoped route resolution", async (t) => {
  t.after(resetRedirectResolutionForTests);
  const cache = createMemoryCache();
  const url = createUrl({ customDomainHost: "go.example.com" });
  let workspaceReads = 0;
  let urlReads = 0;
  const options = {
    WorkspaceModel: {
      async findOne() {
        workspaceReads += 1;
        return { _id: "workspace-1" };
      },
    },
    UrlModel: {
      async findOne(filter) {
        urlReads += 1;
        assert.deepEqual(filter, {
          shortCode: "launch",
          workspaceId: "workspace-1",
          customDomainHost: "go.example.com",
        });
        return url;
      },
    },
    cache,
    env: { BASE_URL: "https://s.example.com" },
    now: () => new Date("2026-07-20T12:00:00.000Z").getTime(),
  };
  const request = {
    hostname: "go.example.com",
    headers: {},
    get() { return ""; },
  };

  await resolveUrlForRequest(request, "launch", options);
  await resolveUrlForRequest(request, "launch", options);

  assert.equal(workspaceReads, 1);
  assert.equal(urlReads, 1);
  assert.deepEqual(cache.writes.map(({ cache: name }) => name), ["domain", "route"]);
});

test("workspace plan and usage snapshots are cached independently", async (t) => {
  t.after(resetRedirectResolutionForTests);
  const cache = createMemoryCache();
  let workspaceReads = 0;
  let usageReads = 0;
  const options = {
    cache,
    WorkspaceModel: {
      async findById() {
        workspaceReads += 1;
        return {
          plan: "pro",
          billing: {
            status: "active",
            currentPeriodEndsAt: new Date("2026-08-20T00:00:00.000Z"),
          },
        };
      },
    },
    UsageCounterModel: {
      async findOneAndUpdate() {
        usageReads += 1;
        return { clicks: 125 };
      },
    },
  };

  const first = await getRedirectEntitlement(
    "workspace-1",
    new Date("2026-07-20T12:00:00.000Z"),
    options
  );
  const second = await getRedirectEntitlement(
    "workspace-1",
    new Date("2026-07-20T12:00:01.000Z"),
    options
  );

  assert.equal(first.plan.id, "pro");
  assert.equal(first.usage.clicks, 125);
  assert.equal(second.plan.id, "pro");
  assert.equal(workspaceReads, 1);
  assert.equal(usageReads, 1);
  assert.deepEqual(
    cache.writes.map(({ cache: name }) => name).sort(),
    ["entitlement", "usage"]
  );
});
