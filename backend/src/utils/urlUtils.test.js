const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isBlockedHostname,
  normalizeUrl,
  validateShortenPayload,
} = require("./urlUtils");

test("normalizeUrl accepts http and https URLs", () => {
  assert.equal(normalizeUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(normalizeUrl("http://example.com"), "http://example.com/");
});

test("normalizeUrl rejects unsupported protocols", () => {
  assert.equal(normalizeUrl("ftp://example.com/file"), null);
  assert.equal(normalizeUrl("not-a-url"), null);
});

test("normalizeUrl blocks private and local network destinations", () => {
  assert.equal(normalizeUrl("http://localhost:3000"), null);
  assert.equal(normalizeUrl("http://127.0.0.1/admin"), null);
  assert.equal(normalizeUrl("http://10.0.0.2/admin"), null);
  assert.equal(normalizeUrl("http://192.168.1.10/router"), null);
  assert.equal(normalizeUrl("http://[::1]/admin"), null);
  assert.equal(isBlockedHostname("example.com"), false);
});

test("validateShortenPayload sanitizes fallback URLs and deduplicates primary URL", () => {
  const payload = validateShortenPayload({
    originalUrl: "https://primary.example.com",
    expiresInMinutes: 60,
    fallbackUrls: [
      "https://backup-1.example.com",
      "https://primary.example.com",
      "https://backup-1.example.com",
      "https://backup-2.example.com",
    ],
  });

  assert.deepEqual(payload.errors, []);
  assert.equal(payload.expiryMinutes, 60);
  assert.equal(payload.fallbackUrls.length, 2);
  assert.deepEqual(
    payload.fallbackUrls.map((item) => item.url),
    ["https://backup-1.example.com/", "https://backup-2.example.com/"]
  );
});
