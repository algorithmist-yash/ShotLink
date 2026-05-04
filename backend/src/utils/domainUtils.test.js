const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getTxtRecordName,
  isValidCustomHostname,
  normalizeHostname,
} = require("./domainUtils");

test("normalizeHostname accepts raw domains and URLs", () => {
  assert.equal(normalizeHostname("HTTPS://Go.Brand.IN/path?x=1"), "go.brand.in");
  assert.equal(normalizeHostname("links.example.com:443"), "links.example.com");
});

test("isValidCustomHostname rejects local hosts and invalid labels", () => {
  assert.equal(isValidCustomHostname("links.example.com"), true);
  assert.equal(isValidCustomHostname("localhost"), false);
  assert.equal(isValidCustomHostname("127.0.0.1"), false);
  assert.equal(isValidCustomHostname("-bad.example.com"), false);
});

test("getTxtRecordName returns the expected ownership record", () => {
  assert.equal(getTxtRecordName("Links.Example.com"), "_urlshortener.links.example.com");
});
