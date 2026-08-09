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

test("Render trusts its managed proxy chain", () => {
  assert.equal(
    getTrustProxySetting({ RENDER: "true", RENDER_SERVICE_ID: "service-1" }),
    true
  );
});

test("explicit trusted proxy CIDRs override deployment defaults", () => {
  assert.deepEqual(
    getTrustProxySetting({
      RAILWAY_ENVIRONMENT: "production",
      RENDER: "true",
      TRUST_PROXY_CIDRS: "loopback, 203.0.113.0/24",
    }),
    ["loopback", "203.0.113.0/24"]
  );
});
