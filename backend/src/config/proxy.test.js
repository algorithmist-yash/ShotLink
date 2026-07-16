const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RAILWAY_TRUSTED_PROXY_RANGES,
  getTrustProxySetting,
} = require("./proxy");

test("proxy trust is disabled by default instead of trusting forwarded headers", () => {
  assert.equal(getTrustProxySetting({}), false);
});

test("Railway uses its documented internal proxy ranges", () => {
  assert.deepEqual(
    getTrustProxySetting({ RAILWAY_ENVIRONMENT: "production" }),
    RAILWAY_TRUSTED_PROXY_RANGES
  );
});

test("explicit trusted proxy CIDRs override deployment defaults", () => {
  assert.deepEqual(
    getTrustProxySetting({
      RAILWAY_ENVIRONMENT: "production",
      TRUST_PROXY_CIDRS: "loopback, 203.0.113.0/24",
    }),
    ["loopback", "203.0.113.0/24"]
  );
});
