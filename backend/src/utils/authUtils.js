const crypto = require("node:crypto");

const SESSION_TTL_DAYS = 30;
const MIN_PASSWORD_LENGTH = 8;

function derivePasswordKey(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = (await derivePasswordKey(password, salt)).toString("hex");

  return `${salt}:${derivedKey}`;
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split(":");
  if (
    parts.length !== 2 ||
    !/^[a-f0-9]{32}$/i.test(parts[0]) ||
    !/^[a-f0-9]{128}$/i.test(parts[1])
  ) {
    return false;
  }

  const [salt, hash] = parts;
  const derivedKey = await derivePasswordKey(password, salt);
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
