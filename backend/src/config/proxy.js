const RAILWAY_TRUSTED_PROXY_RANGES = [
  "loopback",
  "linklocal",
  "uniquelocal",
  "100.0.0.0/8",
];

function parseTrustedProxyRanges(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTrustProxySetting(env = process.env) {
  const configuredRanges = parseTrustedProxyRanges(env.TRUST_PROXY_CIDRS);
  if (configuredRanges.length) return configuredRanges;

  if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID) {
    return RAILWAY_TRUSTED_PROXY_RANGES;
  }

  if (env.RENDER === "true" || env.RENDER_SERVICE_ID) {
    return true;
  }

  return false;
}

module.exports = {
  RAILWAY_TRUSTED_PROXY_RANGES,
  getTrustProxySetting,
  parseTrustedProxyRanges,
};
