const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectBrowser,
  detectDeviceType,
  detectOs,
  extractClientIp,
} = require("./deviceInfo");

test("detectDeviceType classifies bots, mobile devices, and desktops", () => {
  assert.equal(detectDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit"), "mobile");
  assert.equal(detectDeviceType("curl/8.7.1"), "bot");
  assert.equal(
    detectDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123"),
    "desktop"
  );
});

test("detectBrowser and detectOs infer common platforms", () => {
  assert.equal(
    detectBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/123"),
    "Chrome"
  );
  assert.equal(detectBrowser("Mozilla/5.0 Firefox/124.0"), "Firefox");
  assert.equal(detectOs("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit"), "Android");
  assert.equal(detectOs("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit"), "macOS");
});

test("extractClientIp ignores client-supplied forwarding headers", () => {
  assert.equal(
    extractClientIp(
      {
        ip: "203.0.113.10",
        headers: { "x-forwarded-for": "198.51.100.20" },
        socket: { remoteAddress: "192.0.2.30" },
      },
      {}
    ),
    "203.0.113.10"
  );
});

test("extractClientIp uses Railway's documented real IP header on Railway", () => {
  assert.equal(
    extractClientIp(
      {
        ip: "10.0.0.5",
        headers: { "x-real-ip": "203.0.113.44" },
      },
      { RAILWAY_ENVIRONMENT: "production" }
    ),
    "203.0.113.44"
  );
});
