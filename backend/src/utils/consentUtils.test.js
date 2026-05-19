const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACCOUNT_POLICY_VERSION,
  LINK_POLICY_VERSION,
  buildAccountComplianceRecord,
  buildLinkComplianceRecord,
  validateAccountConsents,
  validateLinkConsents,
} = require("./consentUtils");

function createRequest() {
  return {
    ip: "203.0.113.10",
    get(name) {
      return name.toLowerCase() === "user-agent" ? "node-test-agent" : "";
    },
  };
}

test("account consent validation requires every mandatory consent", () => {
  const result = validateAccountConsents({
    consents: {
      ageConfirmed: true,
      termsAccepted: true,
      privacyAccepted: true,
      analyticsAccepted: true,
      lawfulUseAccepted: false,
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["lawfulUseAccepted"]);
});

test("account compliance record stores versioned consent evidence", () => {
  const result = validateAccountConsents({
    consents: {
      ageConfirmed: true,
      termsAccepted: true,
      privacyAccepted: true,
      analyticsAccepted: true,
      lawfulUseAccepted: true,
      marketingOptIn: true,
    },
  });
  const record = buildAccountComplianceRecord(createRequest(), result.consents);

  assert.equal(result.ok, true);
  assert.equal(record.policyVersion, ACCOUNT_POLICY_VERSION);
  assert.equal(record.marketingOptIn, true);
  assert.equal(record.consentUserAgent, "node-test-agent");
  assert.ok(record.consentIpHash);
  assert.ok(record.termsAcceptedAt instanceof Date);
});

test("link consent validation and record are versioned", () => {
  const result = validateLinkConsents({
    compliance: {
      destinationAuthorityAccepted: true,
      securityScanAccepted: true,
      abusePolicyAccepted: true,
    },
  });
  const record = buildLinkComplianceRecord(createRequest(), "user-1");

  assert.equal(result.ok, true);
  assert.equal(record.policyVersion, LINK_POLICY_VERSION);
  assert.equal(record.acceptedBy, "user-1");
  assert.ok(record.acceptedAt instanceof Date);
});
