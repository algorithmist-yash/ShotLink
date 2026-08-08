const { deleteKeys } = require("./cacheService");
const {
  domainCacheKey,
  entitlementCacheKey,
  routeCacheKey,
  usageCacheKey,
} = require("./redirectCacheKeys");
const { getUsagePeriodKey } = require("./usageServiceHelpers");

async function invalidateUrlRoute(url, dependencies = {}) {
  const shortCode = url?.shortCode;
  if (!shortCode) return false;

  const keys = [routeCacheKey("default", shortCode)];
  if (url.customDomainHost) {
    keys.push(routeCacheKey(url.customDomainHost, shortCode));
  }

  return (dependencies.deleteKeys || deleteKeys)("route", keys, dependencies);
}

async function invalidateCustomDomain(hostname, dependencies = {}) {
  if (!hostname) return false;
  return (dependencies.deleteKeys || deleteKeys)(
    "domain",
    [domainCacheKey(hostname)],
    dependencies
  );
}

async function invalidateWorkspaceEntitlement(workspaceId, dependencies = {}) {
  if (!workspaceId) return false;
  return (dependencies.deleteKeys || deleteKeys)(
    "entitlement",
    [entitlementCacheKey(workspaceId)],
    dependencies
  );
}

async function invalidateUsageCounter(workspaceId, date = new Date(), dependencies = {}) {
  if (!workspaceId) return false;
  return (dependencies.deleteKeys || deleteKeys)(
    "usage",
    [usageCacheKey(workspaceId, getUsagePeriodKey(date))],
    dependencies
  );
}

module.exports = {
  invalidateCustomDomain,
  invalidateUrlRoute,
  invalidateUsageCounter,
  invalidateWorkspaceEntitlement,
};
