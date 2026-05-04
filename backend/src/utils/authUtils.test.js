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

test("password hashes verify correctly", () => {
  const password = "super-secret-password";
  const hash = hashPassword(password);

  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("wrong-password", hash), false);
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
  assert.equal(isStrongEnoughPassword("12345678"), true);
  assert.equal(isStrongEnoughPassword("short"), false);
});
