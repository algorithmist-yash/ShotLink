function normalizeHostname(value) {
  const rawValue = String(value || "").trim().toLowerCase();
  if (!rawValue) return "";

  let hostCandidate = rawValue.split("/")[0];
  if (rawValue.includes("://")) {
    try {
      hostCandidate = new URL(rawValue).hostname;
    } catch {
      return "";
    }
  }

  return hostCandidate.replace(/:\d+$/, "").replace(/\.$/, "");
}

function isIpAddress(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function isLocalHostname(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function isValidCustomHostname(hostname) {
  if (!hostname || hostname.length > 253 || isIpAddress(hostname) || isLocalHostname(hostname)) {
    return false;
  }

  const labels = hostname.split(".");
  if (labels.length < 2) return false;

  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}

function getHostnameFromUrl(value) {
  try {
    return normalizeHostname(new URL(value).hostname);
  } catch {
    return normalizeHostname(value);
  }
}

function getDefaultCnameTarget() {
  const configuredTarget = normalizeHostname(process.env.CUSTOM_DOMAIN_CNAME_TARGET);
  if (configuredTarget) return configuredTarget;

  const baseUrlHost = getHostnameFromUrl(process.env.BASE_URL || "");
  return baseUrlHost || "go.yourbrand.in";
}

function getTxtRecordName(hostname) {
  return `_urlshortener.${normalizeHostname(hostname)}`;
}

function getRequestHostname(req) {
  return normalizeHostname(req.hostname || req.get?.("host") || "");
}

module.exports = {
  getDefaultCnameTarget,
  getHostnameFromUrl,
  getRequestHostname,
  getTxtRecordName,
  isLocalHostname,
  isValidCustomHostname,
  normalizeHostname,
};
