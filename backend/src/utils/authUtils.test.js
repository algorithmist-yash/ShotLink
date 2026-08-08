const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isStrongEnoughPassword,
  isValidEmail,
  verifyPassword,
} = require("./authUtils");

test("password hashes verify correctly without changing their stored format", async () => {
  const password = "super-secret-password";
  const hashOperation = hashPassword(password);

  assert.equal(typeof hashOperation.then, "function");

  const hash = await hashOperation;
  assert.match(hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("asynchronous verification accepts hashes created by the legacy implementation", async () => {
  const legacyHash =
    "00112233445566778899aabbccddeeff:091338895ff97473d7ce0a0599386110fb117e340ea299cab2b8d56cf1a92bba8fe6bb9a4cd5eed30b3e5a4273397a8191774834ead60cd1ba2051cb0ea82ff3";

  assert.equal(await verifyPassword("LegacyPassword123", legacyHash), true);
  assert.equal(await verifyPassword("WrongPassword123", legacyHash), false);
});

test("concurrent password work remains asynchronous and rejects malformed hashes", async () => {
  const operations = [
    hashPassword("ConcurrentPassword1"),
    hashPassword("ConcurrentPassword2"),
    hashPassword("ConcurrentPassword3"),
  ];

  assert.ok(operations.every((operation) => typeof operation.then === "function"));

  const hashes = await Promise.all(operations);
  assert.equal(new Set(hashes).size, hashes.length);
  assert.equal(await verifyPassword("password", "malformed"), false);
  assert.equal(await verifyPassword("password", "bad-salt:bad-hash"), false);
});

test("session tokens hash deterministically and are non-empty", () => {
  const token = generateSessionToken();

  assert.equal(typeof token, "string");
  assert.ok(token.length > 20);
  assert.equal(hashSessionToken(token), hashSessionToken(token));
});

test("email and password validators enforce the minimum rules", () => {
  assert.equal(isValidEmail("founder@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isStrongEnoughPassword("Stronger123"), true);
  assert.equal(isStrongEnoughPassword("12345678"), false);
  assert.equal(isStrongEnoughPassword("short"), false);
});
