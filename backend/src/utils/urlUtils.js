const net = require("net");

const VALID_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_FALLBACK_URLS = 5;
const DEFAULT_EXPIRY_MINUTES = 30;
const MAX_EXPIRY_MINUTES = 60 * 24 * 7;
const MIN_CUSTOM_ALIAS_LENGTH = 3;
const MAX_CUSTOM_ALIAS_LENGTH = 48;
const RESERVED_SHORT_CODES = new Set([
  "api",
  "admin",
  "analytics",
  "auth",
  "billing",
  "dashboard",
  "docs",
  "health",
  "live",
  "login",
  "metrics",
  "pricing",
  "register",
  "settings",
  "support",
  "trust",
  "workspace",
]);
const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function isReservedShortCode(value) {
  return RESERVED_SHORT_CODES.has(String(value || "").toLowerCase());
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6(hostname) {
  const normalized = hostname.toLowerCase();
  const ipv4MappedAddress = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);

  if (ipv4MappedAddress) {
    return isPrivateIpv4(ipv4MappedAddress[1]);
  }

  return (
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isBlockedHostname(hostname) {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  if (!normalized) return true;
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  if (normalized.endsWith(".localhost") || normalized.endsWith(".local")) return true;

  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);

  return false;
}

function normalizeUrl(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (!VALID_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    if (isBlockedHostname(parsed.hostname)) {
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

function normalizeCustomAlias(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") return null;

  const alias = value.trim().toLowerCase();
  if (!alias) return "";

  const isValid =
    alias.length >= MIN_CUSTOM_ALIAS_LENGTH &&
    alias.length <= MAX_CUSTOM_ALIAS_LENGTH &&
    /^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(alias) &&
    !alias.includes("--") &&
    !alias.includes("__") &&
    !isReservedShortCode(alias);

  return isValid ? alias : null;
}

function validateShortenPayload(body = {}) {
  const originalUrl = normalizeUrl(body.originalUrl);
  const expiryMinutes = parseExpiryMinutes(body.expiresInMinutes);
  const customAlias = normalizeCustomAlias(body.customAlias);
  const errors = [];

  if (!originalUrl) {
    errors.push("A valid original URL is required");
  }

  if (customAlias === null) {
    errors.push(
      `Custom alias must be ${MIN_CUSTOM_ALIAS_LENGTH}-${MAX_CUSTOM_ALIAS_LENGTH} characters, use letters, numbers, hyphens, or underscores, and start and end with a letter or number`
    );
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
    customAlias,
  };
}

module.exports = {
  DEFAULT_EXPIRY_MINUTES,
  MAX_EXPIRY_MINUTES,
  MAX_FALLBACK_URLS,
  MAX_CUSTOM_ALIAS_LENGTH,
  MIN_CUSTOM_ALIAS_LENGTH,
  isBlockedHostname,
  isReservedShortCode,
  normalizeCustomAlias,
  normalizeUrl,
  normalizeFallbackUrls,
  parseExpiryMinutes,
  validateShortenPayload,
};
