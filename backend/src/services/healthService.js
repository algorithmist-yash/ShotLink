const dns = require("node:dns").promises;
const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

const { isBlockedHostname } = require("../utils/urlUtils");
const Url = require("../models/Url");
const { invalidateUrlRoute } = require("./cacheInvalidationService");

const HEALTH_TTL_MS = 5 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 2500;
const HEALTH_REFRESH_LEASE_MS = 2 * 60 * 1000;

function isHealthyStatusCode(statusCode) {
  if (!statusCode) return false;
  if (statusCode >= 200 && statusCode < 400) return true;
  if (statusCode === 401 || statusCode === 403) return true;

  return false;
}

function createPinnedLookup(addresses) {
  return (_hostname, options, callback) => {
    const normalizedOptions =
      typeof options === "object" && options !== null ? options : { family: options };
    const requestedFamily =
      normalizedOptions.family === "IPv4"
        ? 4
        : normalizedOptions.family === "IPv6"
          ? 6
          : Number(normalizedOptions.family) || 0;
    const eligibleAddresses = requestedFamily
      ? addresses.filter((result) => result.family === requestedFamily)
      : addresses;

    if (!eligibleAddresses.length) {
      const error = new Error("No validated destination address matches the requested family");
      error.code = "ENOTFOUND";
      callback(error);
      return;
    }

    if (normalizedOptions.all) {
      callback(
        null,
        eligibleAddresses.map(({ address, family }) => ({ address, family }))
      );
      return;
    }

    callback(null, eligibleAddresses[0].address, eligibleAddresses[0].family);
  };
}

function requestDestination(targetUrl, method, addresses, requestImpl) {
  const parsed = new URL(targetUrl);
  const request = requestImpl || (parsed.protocol === "https:" ? https.request : http.request);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };

    const outgoingRequest = request(
      parsed,
      {
        agent: false,
        method,
        lookup: createPinnedLookup(addresses),
      },
      (response) => {
        const statusCode = response.statusCode;
        response.destroy();
        finish(resolve, statusCode);
      }
    );

    outgoingRequest.once("error", (error) => finish(reject, error));
    timeout = setTimeout(() => {
      const error = new Error("Timed out");
      error.name = "TimeoutError";
      outgoingRequest.destroy(error);
    }, HEALTH_TIMEOUT_MS);
    timeout.unref?.();
    outgoingRequest.end();
  });
}

async function checkDestinationHealth(targetUrl, dependencies = {}) {
  const checkedAt = new Date();

  try {
    const addresses = await validatePublicDestination(
      targetUrl,
      dependencies.lookup || dns.lookup
    );

    let statusCode = await requestDestination(
      targetUrl,
      "HEAD",
      addresses,
      dependencies.request
    );

    if (statusCode === 405 || statusCode === 501) {
      statusCode = await requestDestination(
        targetUrl,
        "GET",
        addresses,
        dependencies.request
      );
    }

    const healthy = isHealthyStatusCode(statusCode);

    return {
      status: healthy ? "healthy" : "unhealthy",
      statusCode,
      checkedAt,
      failureReason: healthy ? "" : `HTTP ${statusCode}`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      statusCode: null,
      checkedAt,
      failureReason: error.name === "TimeoutError" ? "Timed out" : error.message,
    };
  }
}

async function validatePublicDestination(targetUrl, lookup = dns.lookup) {
  const parsed = new URL(targetUrl);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  if (isBlockedHostname(hostname)) {
    throw new Error("Destination uses a private or local network address");
  }

  if (net.isIP(hostname)) {
    return [{ address: hostname, family: net.isIP(hostname) }];
  }

  const results = await lookup(hostname, { all: true, verbatim: true });
  const addresses = Array.isArray(results) ? results : [results];

  if (!addresses.length) {
    throw new Error("Destination hostname did not resolve");
  }

  if (
    addresses.some(
      (result) =>
        !result ||
        !net.isIP(result.address) ||
        (result.family !== 4 && result.family !== 6) ||
        isBlockedHostname(result.address)
    )
  ) {
    throw new Error("Destination resolves to a private or local network address");
  }

  return addresses.map(({ address, family }) => ({ address, family }));
}

function needsHealthRefresh(url) {
  const checkedAt = url.primaryHealth?.lastCheckedAt;
  if (!checkedAt) return true;

  return Date.now() - new Date(checkedAt).getTime() >= HEALTH_TTL_MS;
}

function applyPrimaryHealth(url, snapshot) {
  url.primaryHealth.status = snapshot.status;
  url.primaryHealth.lastStatusCode = snapshot.statusCode;
  url.primaryHealth.lastCheckedAt = snapshot.checkedAt;
  url.primaryHealth.lastFailureReason = snapshot.failureReason;
}

function applyFallbackHealth(fallback, snapshot) {
  fallback.lastStatus = snapshot.status;
  fallback.lastStatusCode = snapshot.statusCode;
  fallback.lastCheckedAt = snapshot.checkedAt;
  fallback.lastFailureReason = snapshot.failureReason;
}

async function refreshUrlHealth(url, dependencies = {}) {
  const checkHealth = dependencies.checkHealth || checkDestinationHealth;
  const invalidateRoute = dependencies.invalidateRoute || invalidateUrlRoute;
  const primarySnapshot = await checkHealth(url.originalUrl);
  applyPrimaryHealth(url, primarySnapshot);

  const fallbackSnapshots = await Promise.all(
    (url.fallbackUrls || []).map((fallback) => checkHealth(fallback.url))
  );

  fallbackSnapshots.forEach((snapshot, index) => {
    applyFallbackHealth(url.fallbackUrls[index], snapshot);
  });

  await url.save();
  await invalidateRoute(url);

  return url;
}

async function refreshUrlHealthWithLease(urlId, dependencies = {}) {
  const now = dependencies.now ? dependencies.now() : new Date();
  const leaseToken = dependencies.createLeaseToken
    ? dependencies.createLeaseToken()
    : crypto.randomUUID();
  const claimLease =
    dependencies.claimLease ||
    ((filter, update, options) => Url.findOneAndUpdate(filter, update, options));
  const releaseLease =
    dependencies.releaseLease ||
    ((filter, update) => Url.updateOne(filter, update));
  const refresh = dependencies.refresh || refreshUrlHealth;
  const leasedUrl = await claimLease(
    {
      _id: urlId,
      $or: [
        { "healthRefreshLease.expiresAt": null },
        { "healthRefreshLease.expiresAt": { $lte: now } },
      ],
    },
    {
      $set: {
        "healthRefreshLease.token": leaseToken,
        "healthRefreshLease.expiresAt": new Date(
          now.getTime() + HEALTH_REFRESH_LEASE_MS
        ),
      },
    },
    { returnDocument: "after" }
  );

  if (!leasedUrl) return false;

  try {
    await refresh(leasedUrl);
    return true;
  } finally {
    await releaseLease(
      {
        _id: urlId,
        "healthRefreshLease.token": leaseToken,
      },
      {
        $set: {
          "healthRefreshLease.token": "",
          "healthRefreshLease.expiresAt": null,
        },
      }
    );
  }
}

function getDestinationSummaries(url) {
  const primary = {
    label: "Primary destination",
    kind: "primary",
    url: url.originalUrl,
    status: url.primaryHealth?.status || "unknown",
    lastStatusCode: url.primaryHealth?.lastStatusCode || null,
    lastCheckedAt: url.primaryHealth?.lastCheckedAt || null,
  };

  const fallbacks = (url.fallbackUrls || [])
    .filter((fallback) => fallback.isActive)
    .sort((left, right) => left.priority - right.priority)
    .map((fallback) => ({
      label: fallback.label,
      kind: "fallback",
      url: fallback.url,
      status: fallback.lastStatus || "unknown",
      lastStatusCode: fallback.lastStatusCode || null,
      lastCheckedAt: fallback.lastCheckedAt || null,
    }));

  return [primary, ...fallbacks];
}

function selectRedirectTarget(url) {
  const primaryStatus = url.primaryHealth?.status || "unknown";

  if (primaryStatus !== "unhealthy") {
    return {
      kind: "primary",
      label: "Primary destination",
      url: url.originalUrl,
      status: primaryStatus,
    };
  }

  const activeFallbacks = (url.fallbackUrls || [])
    .filter((fallback) => fallback.isActive)
    .sort((left, right) => left.priority - right.priority);

  const healthyFallback =
    activeFallbacks.find((fallback) => fallback.lastStatus === "healthy") ||
    activeFallbacks.find((fallback) => fallback.lastStatus !== "unhealthy");

  if (!healthyFallback) {
    return null;
  }

  return {
    kind: "fallback",
    label: healthyFallback.label,
    url: healthyFallback.url,
    status: healthyFallback.lastStatus,
  };
}

module.exports = {
  HEALTH_REFRESH_LEASE_MS,
  HEALTH_TTL_MS,
  checkDestinationHealth,
  getDestinationSummaries,
  needsHealthRefresh,
  refreshUrlHealth,
  refreshUrlHealthWithLease,
  selectRedirectTarget,
  validatePublicDestination,
};
