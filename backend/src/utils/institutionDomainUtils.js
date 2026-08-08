const { isValidCustomHostname, normalizeHostname } = require("./domainUtils");

const PUBLIC_EMAIL_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mail.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "rediffmail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yandex.com",
  "zoho.com",
]);

function getEmailDomain(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const separatorIndex = normalizedEmail.lastIndexOf("@");

  if (separatorIndex <= 0 || separatorIndex === normalizedEmail.length - 1) {
    return "";
  }

  return normalizeHostname(normalizedEmail.slice(separatorIndex + 1));
}

function isInstitutionalEmailDomain(hostname) {
  const normalized = normalizeHostname(hostname);
  return Boolean(
    normalized &&
      isValidCustomHostname(normalized) &&
      !PUBLIC_EMAIL_DOMAINS.has(normalized)
  );
}

function getInstitutionTxtRecordName(hostname) {
  return `_shotlink-access.${normalizeHostname(hostname)}`;
}

module.exports = {
  PUBLIC_EMAIL_DOMAINS,
  getEmailDomain,
  getInstitutionTxtRecordName,
  isInstitutionalEmailDomain,
};
