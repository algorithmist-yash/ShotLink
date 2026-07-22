const assert = require("node:assert/strict");
const test = require("node:test");

const {
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
} = require("./sessionCookieUtils");

test("session cookies are host-prefixed and secure in production", () => {
  const expiresAt = new Date("2026-08-20T00:00:00.000Z");
  const options = getSessionCookieOptions(expiresAt, { NODE_ENV: "production" });

  assert.equal(getSessionCookieName({ NODE_ENV: "production" }), PRODUCTION_SESSION_COOKIE);
  assert.deepEqual(options, {
    expires: expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  assert.equal("domain" in options, false);
});

test("local session cookies remain usable over the development HTTP server", () => {
  assert.equal(
    getSessionCookieName({ NODE_ENV: "development" }),
    DEVELOPMENT_SESSION_COOKIE
  );
  assert.equal(
    getSessionCookieOptions(new Date(), { NODE_ENV: "development" }).secure,
    false
  );
});

test("session cookies are set and cleared with the same security scope", () => {
  const calls = [];
  const response = {
    cookie(...args) {
      calls.push(["set", ...args]);
    },
    clearCookie(...args) {
      calls.push(["clear", ...args]);
    },
  };
  const env = { NODE_ENV: "production" };
  const expiresAt = new Date("2026-08-20T00:00:00.000Z");

  setSessionCookie(response, "session-token", expiresAt, env);
  clearSessionCookie(response, env);

  assert.equal(calls[0][1], PRODUCTION_SESSION_COOKIE);
  assert.equal(calls[0][2], "session-token");
  assert.equal(calls[0][3].httpOnly, true);
  assert.equal(calls[1][1], PRODUCTION_SESSION_COOKIE);
  assert.deepEqual(calls[1][2], {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
});

test("cookie parsing tolerates encoded and malformed values", () => {
  assert.deepEqual(parseCookieHeader("one=hello%20world; broken; two=a%ZZ"), {
    one: "hello world",
    two: "a%ZZ",
  });

  const request = {
    get(name) {
      return name === "cookie" ? `${DEVELOPMENT_SESSION_COOKIE}=cookie-token` : "";
    },
  };

  assert.equal(
    getSessionCookieToken(request, { NODE_ENV: "development" }),
    "cookie-token"
  );
});

test("CSRF tokens are deterministic, session-bound, and compared safely", () => {
  const env = { NODE_ENV: "production", CSRF_SECRET: "a-long-test-secret" };
  const first = deriveCsrfToken("session-one", env);
  const repeated = deriveCsrfToken("session-one", env);
  const second = deriveCsrfToken("session-two", env);

  assert.equal(first, repeated);
  assert.notEqual(first, second);
  assert.equal(isCsrfTokenValid(first, repeated), true);
  assert.equal(isCsrfTokenValid(second, repeated), false);
  assert.equal(isCsrfTokenValid("", repeated), false);
  assert.throws(
    () => deriveCsrfToken("session", { NODE_ENV: "production" }),
    /CSRF_SECRET is required/
  );
});

test("CSRF protection applies only to unsafe methods", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(requiresCsrfProtection(method), false);
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(requiresCsrfProtection(method), true);
  }
});
