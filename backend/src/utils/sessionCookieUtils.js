const crypto = require("node:crypto");

const DEVELOPMENT_SESSION_COOKIE = "shotlink_session";
const PRODUCTION_SESSION_COOKIE = "__Host-shotlink_session";
const LOCAL_CSRF_SECRET = "shotlink-local-development-csrf-secret";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getSessionCookieName(env = process.env) {
  return env.NODE_ENV === "production"
    ? PRODUCTION_SESSION_COOKIE
    : DEVELOPMENT_SESSION_COOKIE;
}

function parseCookieHeader(header) {
  return String(header || "")
    .split(";")
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex < 1) return cookies;

      const name = part.slice(0, separatorIndex).trim();
      const encodedValue = part.slice(separatorIndex + 1).trim();

      try {
        cookies[name] = decodeURIComponent(encodedValue);
      } catch {
        cookies[name] = encodedValue;
      }

      return cookies;
    }, {});
}

function getRequestHeader(req, name) {
  if (typeof req.get === "function") {
    return req.get(name) || "";
  }

  return req.headers?.[String(name).toLowerCase()] || "";
}

function getSessionCookieToken(req, env = process.env) {
  const cookies = parseCookieHeader(getRequestHeader(req, "cookie"));
  return cookies[getSessionCookieName(env)] || "";
}

function getSessionCookieOptions(expiresAt, env = process.env) {
  return {
    expires: new Date(expiresAt),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  };
}

function setSessionCookie(res, token, expiresAt, env = process.env) {
  res.cookie(
    getSessionCookieName(env),
    token,
    getSessionCookieOptions(expiresAt, env)
  );
}

function clearSessionCookie(res, env = process.env) {
  const options = getSessionCookieOptions(new Date(0), env);
  delete options.expires;
  res.clearCookie(getSessionCookieName(env), options);
}

function getCsrfSecret(env = process.env) {
  const configuredSecret = String(env.CSRF_SECRET || "").trim();

  if (configuredSecret) return configuredSecret;
  if (env.NODE_ENV === "production") {
    throw new Error("CSRF_SECRET is required in production");
  }

  return LOCAL_CSRF_SECRET;
}

function deriveCsrfToken(sessionToken, env = process.env) {
  if (!sessionToken) return "";

  return crypto
    .createHmac("sha256", getCsrfSecret(env))
    .update(`shotlink-session:${sessionToken}`)
    .digest("base64url");
}

function isCsrfTokenValid(providedToken, expectedToken) {
  const provided = Buffer.from(String(providedToken || ""));
  const expected = Buffer.from(String(expectedToken || ""));

  return (
    provided.length > 0 &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected)
  );
}

function requiresCsrfProtection(method) {
  return !SAFE_METHODS.has(String(method || "GET").toUpperCase());
}

module.exports = {
  DEVELOPMENT_SESSION_COOKIE,
  PRODUCTION_SESSION_COOKIE,
  clearSessionCookie,
  deriveCsrfToken,
  getSessionCookieName,
  getSessionCookieOptions,
  getSessionCookieToken,
  isCsrfTokenValid,
  parseCookieHeader,
  requiresCsrfProtection,
  setSessionCookie,
};
