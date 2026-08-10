const { isPlainObject } = require("../middleware/requestContractMiddleware");

function optionalString(maxLength) {
  return (value) =>
    value === undefined || (typeof value === "string" && value.length <= maxLength)
      ? ""
      : `must be a string no longer than ${maxLength} characters`;
}

function booleanLike(value) {
  return [true, false, "true", "false", "on", "off", 1, 0, "1", "0"].includes(value)
    ? ""
    : "must be a boolean";
}

function optionalConsentObject(fields) {
  return (value) => {
    if (value === undefined) return "";
    if (!isPlainObject(value)) return "must be an object";
    for (const field of fields) {
      if (field in value && booleanLike(value[field])) {
        return `${field} must be a boolean`;
      }
    }
    return "";
  };
}

function optionalExpiry(value) {
  if (value === undefined) return "";
  if (typeof value !== "number" && typeof value !== "string") {
    return "must be a number of minutes";
  }
  return String(value).length <= 12 ? "" : "must be a number of minutes";
}

function optionalFallbacks(value) {
  if (value === undefined) return "";
  if (!Array.isArray(value)) return "must be an array";
  if (value.length > 5) return "must contain at most 5 destinations";
  const valid = value.every(
    (item) =>
      (typeof item === "string" && item.length <= 4096) ||
      (isPlainObject(item) &&
        typeof item.url === "string" &&
        item.url.length <= 4096 &&
        (item.label === undefined ||
          (typeof item.label === "string" && item.label.length <= 100)))
  );
  return valid ? "" : "must contain URL strings or URL objects";
}

const accountConsentFields = [
  "ageConfirmed",
  "termsAccepted",
  "privacyAccepted",
  "analyticsAccepted",
  "lawfulUseAccepted",
  "marketingOptIn",
];

const linkConsentFields = [
  "destinationAuthorityAccepted",
  "securityScanAccepted",
  "abusePolicyAccepted",
];

const registerContract = {
  name: optionalString(100),
  email: optionalString(254),
  password: optionalString(128),
  workspaceName: optionalString(100),
  workspaceType: optionalString(32),
  consents: optionalConsentObject(accountConsentFields),
};

const loginContract = {
  email: optionalString(254),
  password: optionalString(128),
};

const createLinkContract = {
  originalUrl: optionalString(4096),
  customAlias: optionalString(48),
  customDomainHost: optionalString(253),
  expiresInMinutes: optionalExpiry,
  fallbackUrls: optionalFallbacks,
  compliance: optionalConsentObject(linkConsentFields),
};

const customDomainContract = { hostname: optionalString(253) };
const planContract = { planId: optionalString(32) };
const cancelSubscriptionContract = {
  cancelAtCycleEnd: (value) => (value === undefined ? "" : booleanLike(value)),
};

module.exports = {
  cancelSubscriptionContract,
  createLinkContract,
  customDomainContract,
  loginContract,
  planContract,
  registerContract,
};
