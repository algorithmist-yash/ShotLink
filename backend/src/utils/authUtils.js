const crypto = require("crypto");

const SESSION_TTL_DAYS = 30;
const MIN_PASSWORD_LENGTH = 8;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");
  if (!salt || !hash) return false;

  const derivedKey = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, "hex");

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, derivedKey);
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function isStrongEnoughPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= MIN_PASSWORD_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}

module.exports = {
  SESSION_TTL_DAYS,
  MIN_PASSWORD_LENGTH,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isStrongEnoughPassword,
  isValidEmail,
  verifyPassword,
};
