const { extractClientIp, hashIp } = require("./deviceInfo");

const ACCOUNT_POLICY_VERSION = "2026-08-09";
const LINK_POLICY_VERSION = "2026-08-09";

const REQUIRED_ACCOUNT_CONSENTS = [
  "ageConfirmed",
  "termsAccepted",
  "privacyAccepted",
  "analyticsAccepted",
  "lawfulUseAccepted",
];

const REQUIRED_LINK_CONSENTS = [
  "destinationAuthorityAccepted",
  "securityScanAccepted",
  "abusePolicyAccepted",
];

function isAffirmative(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

function getConsentSource(body = {}) {
  return body.consents && typeof body.consents === "object" ? body.consents : body;
}

function getLinkConsentSource(body = {}) {
  return body.compliance && typeof body.compliance === "object" ? body.compliance : body;
}

function validateAccountConsents(body = {}) {
  const consents = getConsentSource(body);
  const missing = REQUIRED_ACCOUNT_CONSENTS.filter((field) => !isAffirmative(consents[field]));

  return {
    ok: missing.length === 0,
    missing,
    consents,
  };
}

function validateLinkConsents(body = {}) {
  const consents = getLinkConsentSource(body);
  const missing = REQUIRED_LINK_CONSENTS.filter((field) => !isAffirmative(consents[field]));

  return {
    ok: missing.length === 0,
    missing,
    consents,
  };
}

function buildAccountComplianceRecord(req, consents) {
  const acceptedAt = new Date();

  return {
    policyVersion: ACCOUNT_POLICY_VERSION,
    termsAcceptedAt: acceptedAt,
    privacyAcceptedAt: acceptedAt,
    analyticsAcceptedAt: acceptedAt,
    lawfulUseAcceptedAt: acceptedAt,
    ageConfirmedAt: acceptedAt,
    marketingOptIn: isAffirmative(consents.marketingOptIn),
    marketingOptInAt: isAffirmative(consents.marketingOptIn) ? acceptedAt : null,
    consentIpHash: hashIp(extractClientIp(req)),
    consentUserAgent: req.get("user-agent") || "",
  };
}

function buildLinkComplianceRecord(req, userId) {
  const acceptedAt = new Date();

  return {
    policyVersion: LINK_POLICY_VERSION,
    acceptedAt,
    acceptedBy: userId,
    destinationAuthorityAcceptedAt: acceptedAt,
    securityScanAcceptedAt: acceptedAt,
    abusePolicyAcceptedAt: acceptedAt,
    consentIpHash: hashIp(extractClientIp(req)),
    consentUserAgent: req.get("user-agent") || "",
  };
}

module.exports = {
  ACCOUNT_POLICY_VERSION,
  LINK_POLICY_VERSION,
  REQUIRED_ACCOUNT_CONSENTS,
  REQUIRED_LINK_CONSENTS,
  buildAccountComplianceRecord,
  buildLinkComplianceRecord,
  isAffirmative,
  validateAccountConsents,
  validateLinkConsents,
};
