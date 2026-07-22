const crypto = require("node:crypto");

const CACHE_NAMESPACE = "shotlink:v1";

function digest(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function routeCacheKey(hostname, shortCode) {
  return `${CACHE_NAMESPACE}:route:${digest(`${hostname || "default"}\n${shortCode}`)}`;
}

function domainCacheKey(hostname) {
  return `${CACHE_NAMESPACE}:domain:${digest(String(hostname || "").toLowerCase())}`;
}

function entitlementCacheKey(workspaceId) {
  return `${CACHE_NAMESPACE}:entitlement:${digest(workspaceId)}`;
}

function usageCacheKey(workspaceId, periodKey) {
  return `${CACHE_NAMESPACE}:usage:${digest(`${workspaceId}\n${periodKey}`)}`;
}

module.exports = {
  CACHE_NAMESPACE,
  domainCacheKey,
  entitlementCacheKey,
  routeCacheKey,
  usageCacheKey,
};
