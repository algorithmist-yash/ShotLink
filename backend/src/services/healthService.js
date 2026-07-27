const HEALTH_TTL_MS = 5 * 60 * 1000;

function isHealthyStatusCode(statusCode) {
  if (!statusCode) return false;
  if (statusCode >= 200 && statusCode < 400) return true;
  if (statusCode === 401 || statusCode === 403) return true;

  return false;
}

async function checkDestinationHealth(targetUrl) {
  const checkedAt = new Date();

  try {
    let response = await fetch(targetUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(2500),
    });

    if (response.status === 405 || response.status === 501) {
      response = await fetch(targetUrl, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(2500),
      });
    }

    const healthy = isHealthyStatusCode(response.status);

    return {
      status: healthy ? "healthy" : "unhealthy",
      statusCode: response.status,
      checkedAt,
      failureReason: healthy ? "" : `HTTP ${response.status}`,
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

async function refreshUrlHealth(url) {
  const primarySnapshot = await checkDestinationHealth(url.originalUrl);
  applyPrimaryHealth(url, primarySnapshot);

  const fallbackSnapshots = await Promise.all(
    (url.fallbackUrls || []).map((fallback) => checkDestinationHealth(fallback.url))
  );

  fallbackSnapshots.forEach((snapshot, index) => {
    applyFallbackHealth(url.fallbackUrls[index], snapshot);
  });

  await url.save();

  return url;
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
  HEALTH_TTL_MS,
  checkDestinationHealth,
  getDestinationSummaries,
  needsHealthRefresh,
  refreshUrlHealth,
  selectRedirectTarget,
};
