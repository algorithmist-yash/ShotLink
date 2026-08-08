const Url = require("../models/Url");
const UsageCounter = require("../models/UsageCounter");
const Workspace = require("../models/Workspace");
const { resolveEffectivePlan } = require("../config/billingPlans");
const {
  getHostnameFromUrl,
  getRequestHostname,
  isLocalHostname,
} = require("../utils/domainUtils");
const { getJson, setJson } = require("./cacheService");
const {
  domainCacheKey,
  entitlementCacheKey,
  routeCacheKey,
  usageCacheKey,
} = require("./redirectCacheKeys");
const { getUsagePeriodKey } = require("./usageServiceHelpers");

const ROUTE_TTL_SECONDS = 60;
const EXPIRED_ROUTE_TTL_SECONDS = 15;
const NEGATIVE_TTL_SECONDS = 5;
const DOMAIN_TTL_SECONDS = 60;
const ENTITLEMENT_TTL_SECONDS = 30;
const USAGE_TTL_SECONDS = 5;
const inFlightLoads = new Map();

function isDefaultRedirectHost(hostname, env = process.env) {
  const defaultHosts = [env.SHORTLINK_BASE_URL, env.BASE_URL, env.APP_BASE_URL]
    .map((value) => getHostnameFromUrl(value || ""))
    .filter(Boolean);
  return !hostname || isLocalHostname(hostname) || defaultHosts.includes(hostname);
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function serializeUrlSnapshot(url) {
  return {
    _id: String(url._id),
    workspaceId: url.workspaceId ? String(url.workspaceId) : null,
    shortCode: url.shortCode,
    customDomainHost: url.customDomainHost || "",
    originalUrl: url.originalUrl,
    expiresAt: new Date(url.expiresAt).toISOString(),
    isActive: Boolean(url.isActive),
    primaryHealth: {
      status: url.primaryHealth?.status || "unknown",
      lastStatusCode: url.primaryHealth?.lastStatusCode ?? null,
      lastCheckedAt: url.primaryHealth?.lastCheckedAt || null,
      lastFailureReason: url.primaryHealth?.lastFailureReason || "",
    },
    fallbackUrls: (url.fallbackUrls || []).map((fallback) => ({
      url: fallback.url,
      label: fallback.label,
      priority: fallback.priority,
      isActive: Boolean(fallback.isActive),
      lastStatus: fallback.lastStatus || "unknown",
      lastStatusCode: fallback.lastStatusCode ?? null,
      lastCheckedAt: fallback.lastCheckedAt || null,
      lastFailureReason: fallback.lastFailureReason || "",
    })),
  };
}

function hydrateUrlSnapshot(snapshot) {
  return {
    ...snapshot,
    expiresAt: toDate(snapshot.expiresAt),
    primaryHealth: {
      ...snapshot.primaryHealth,
      lastCheckedAt: toDate(snapshot.primaryHealth?.lastCheckedAt),
    },
    fallbackUrls: (snapshot.fallbackUrls || []).map((fallback) => ({
      ...fallback,
      lastCheckedAt: toDate(fallback.lastCheckedAt),
    })),
  };
}

function getRouteTtlSeconds(url, now = Date.now()) {
  const remainingMs = new Date(url.expiresAt).getTime() - now;
  if (remainingMs <= 0) return EXPIRED_ROUTE_TTL_SECONDS;

  return Math.min(ROUTE_TTL_SECONDS, Math.floor(remainingMs / 1000));
}

async function resolveQuery(query, projection) {
  let resolvedQuery = query;
  if (projection && typeof resolvedQuery?.select === "function") {
    resolvedQuery = resolvedQuery.select(projection);
  }
  if (typeof resolvedQuery?.lean === "function") {
    resolvedQuery = resolvedQuery.lean();
  }
  return resolvedQuery;
}

async function singleFlight(key, load) {
  const existing = inFlightLoads.get(key);
  if (existing) return existing;

  const loading = Promise.resolve()
    .then(load)
    .finally(() => inFlightLoads.delete(key));
  inFlightLoads.set(key, loading);
  return loading;
}

async function getCachedRoute(hostname, shortCode, cache = { getJson }) {
  const result = await cache.getJson("route", routeCacheKey(hostname, shortCode));
  if (!result.hit) return { cached: false, url: null };
  if (!result.value?.found) return { cached: true, url: null };

  return {
    cached: true,
    url: hydrateUrlSnapshot(result.value.url),
  };
}

async function cacheRoute(
  hostname,
  shortCode,
  url,
  cache = { setJson },
  now = Date.now()
) {
  const key = routeCacheKey(hostname, shortCode);
  if (!url) {
    return cache.setJson("route", key, { found: false }, NEGATIVE_TTL_SECONDS);
  }

  const ttlSeconds = getRouteTtlSeconds(url, now);
  if (ttlSeconds < 1) return false;
  return cache.setJson(
    "route",
    key,
    { found: true, url: serializeUrlSnapshot(url) },
    ttlSeconds
  );
}

async function loadDefaultRoute(shortCode, dependencies) {
  const { UrlModel, cache, now } = dependencies;
  const hostname = "default";
  const cached = await getCachedRoute(hostname, shortCode, cache);
  if (cached.cached) return cached.url;

  const flightKey = routeCacheKey(hostname, shortCode);
  return singleFlight(flightKey, async () => {
    const url = await resolveQuery(UrlModel.findOne({ shortCode }));
    await cacheRoute(hostname, shortCode, url, cache, now());
    return url;
  });
}

async function getCustomDomainWorkspaceId(hostname, dependencies) {
  const { WorkspaceModel, cache } = dependencies;
  const key = domainCacheKey(hostname);
  const cached = await cache.getJson("domain", key);
  if (cached.hit) {
    return cached.value?.found ? cached.value.workspaceId : null;
  }

  return singleFlight(key, async () => {
    const workspace = await resolveQuery(
      WorkspaceModel.findOne({
        customDomains: {
          $elemMatch: { hostname, status: "verified" },
        },
      }),
      "_id"
    );
    const workspaceId = workspace?._id ? String(workspace._id) : null;
    await cache.setJson(
      "domain",
      key,
      workspaceId ? { found: true, workspaceId } : { found: false },
      workspaceId ? DOMAIN_TTL_SECONDS : NEGATIVE_TTL_SECONDS
    );
    return workspaceId;
  });
}

async function loadCustomDomainRoute(hostname, shortCode, dependencies) {
  const workspaceId = await getCustomDomainWorkspaceId(hostname, dependencies);
  if (!workspaceId) return null;

  const { UrlModel, cache, now } = dependencies;
  const cached = await getCachedRoute(hostname, shortCode, cache);
  if (cached.cached) return cached.url;

  const flightKey = routeCacheKey(hostname, shortCode);
  return singleFlight(flightKey, async () => {
    const url = await resolveQuery(
      UrlModel.findOne({
        shortCode,
        workspaceId,
        customDomainHost: hostname,
      })
    );
    await cacheRoute(hostname, shortCode, url, cache, now());
    return url;
  });
}

async function resolveUrlForRequest(
  req,
  shortCode,
  {
    UrlModel = Url,
    WorkspaceModel = Workspace,
    cache = { getJson, setJson },
    env = process.env,
    now = Date.now,
  } = {}
) {
  const requestHost = getRequestHostname(req);
  const dependencies = { UrlModel, WorkspaceModel, cache, now };

  if (isDefaultRedirectHost(requestHost, env)) {
    return loadDefaultRoute(shortCode, dependencies);
  }

  return loadCustomDomainRoute(requestHost, shortCode, dependencies);
}

async function getWorkspaceEntitlement(workspaceId, dependencies) {
  const { WorkspaceModel, cache } = dependencies;
  const key = entitlementCacheKey(workspaceId);
  const cached = await cache.getJson("entitlement", key);
  let snapshot;

  if (cached.hit) {
    snapshot = cached.value?.found ? cached.value.workspace : null;
  } else {
    snapshot = await singleFlight(key, async () => {
      const workspace = await resolveQuery(
        WorkspaceModel.findById(workspaceId),
        "plan billing.status billing.currentPeriodEndsAt"
      );
      const compactWorkspace = workspace
        ? {
            plan: workspace.plan,
            billing: {
              status: workspace.billing?.status || "inactive",
              currentPeriodEndsAt: workspace.billing?.currentPeriodEndsAt || null,
            },
          }
        : null;
      await cache.setJson(
        "entitlement",
        key,
        compactWorkspace ? { found: true, workspace: compactWorkspace } : { found: false },
        compactWorkspace ? ENTITLEMENT_TTL_SECONDS : NEGATIVE_TTL_SECONDS
      );
      return compactWorkspace;
    });
  }

  return snapshot ? resolveEffectivePlan(snapshot) : null;
}

async function getWorkspaceUsage(workspaceId, date, dependencies) {
  const { UsageCounterModel, cache } = dependencies;
  const periodKey = getUsagePeriodKey(date);
  const key = usageCacheKey(workspaceId, periodKey);
  const cached = await cache.getJson("usage", key);
  if (cached.hit) return cached.value;

  return singleFlight(key, async () => {
    const counter = await UsageCounterModel.findOneAndUpdate(
      { workspaceId, periodKey },
      { $setOnInsert: { workspaceId, periodKey } },
      { returnDocument: "after", upsert: true }
    );
    const usage = { clicks: Math.max(Number(counter?.clicks) || 0, 0), periodKey };
    await cache.setJson("usage", key, usage, USAGE_TTL_SECONDS);
    return usage;
  });
}

async function getRedirectEntitlement(
  workspaceId,
  date = new Date(),
  {
    WorkspaceModel = Workspace,
    UsageCounterModel = UsageCounter,
    cache = { getJson, setJson },
  } = {}
) {
  const dependencies = { WorkspaceModel, UsageCounterModel, cache };
  const [plan, usage] = await Promise.all([
    getWorkspaceEntitlement(workspaceId, dependencies),
    getWorkspaceUsage(workspaceId, date, dependencies),
  ]);

  return plan ? { plan, usage } : null;
}

function resetRedirectResolutionForTests() {
  inFlightLoads.clear();
}

module.exports = {
  DOMAIN_TTL_SECONDS,
  ENTITLEMENT_TTL_SECONDS,
  EXPIRED_ROUTE_TTL_SECONDS,
  NEGATIVE_TTL_SECONDS,
  ROUTE_TTL_SECONDS,
  USAGE_TTL_SECONDS,
  cacheRoute,
  getRedirectEntitlement,
  getRouteTtlSeconds,
  hydrateUrlSnapshot,
  isDefaultRedirectHost,
  resetRedirectResolutionForTests,
  resolveUrlForRequest,
  serializeUrlSnapshot,
};
