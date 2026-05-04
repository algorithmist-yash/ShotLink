const VALID_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_FALLBACK_URLS = 5;
const DEFAULT_EXPIRY_MINUTES = 30;
const MAX_EXPIRY_MINUTES = 60 * 24 * 7;

function normalizeUrl(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (!VALID_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeFallbackUrls(input, primaryUrl) {
  const items = Array.isArray(input) ? input : [];
  const seen = new Set([primaryUrl]);
  const fallbacks = [];

  for (const item of items) {
    const rawUrl =
      typeof item === "string" ? item : typeof item?.url === "string" ? item.url : "";
    const normalizedUrl = normalizeUrl(rawUrl);

    if (!normalizedUrl || seen.has(normalizedUrl)) {
      continue;
    }

    seen.add(normalizedUrl);

    fallbacks.push({
      url: normalizedUrl,
      label:
        typeof item?.label === "string" && item.label.trim()
          ? item.label.trim()
          : `Fallback ${fallbacks.length + 1}`,
      priority: fallbacks.length,
      isActive: true,
      lastStatus: "unknown",
      lastStatusCode: null,
      lastCheckedAt: null,
      lastFailureReason: "",
    });

    if (fallbacks.length >= MAX_FALLBACK_URLS) {
      break;
    }
  }

  return fallbacks;
}

function parseExpiryMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_EXPIRY_MINUTES;
  }

  return Math.min(Math.floor(numeric), MAX_EXPIRY_MINUTES);
}

function validateShortenPayload(body = {}) {
  const originalUrl = normalizeUrl(body.originalUrl);
  const expiryMinutes = parseExpiryMinutes(body.expiresInMinutes);
  const errors = [];

  if (!originalUrl) {
    errors.push("A valid original URL is required");
  }

  const fallbackUrls = originalUrl
    ? normalizeFallbackUrls(body.fallbackUrls, originalUrl)
    : [];

  if (Array.isArray(body.fallbackUrls) && body.fallbackUrls.length > MAX_FALLBACK_URLS) {
    errors.push(`You can add up to ${MAX_FALLBACK_URLS} fallback URLs`);
  }

  return {
    errors,
    originalUrl,
    expiryMinutes,
    fallbackUrls,
  };
}

module.exports = {
  DEFAULT_EXPIRY_MINUTES,
  MAX_EXPIRY_MINUTES,
  MAX_FALLBACK_URLS,
  normalizeUrl,
  normalizeFallbackUrls,
  parseExpiryMinutes,
  validateShortenPayload,
};
