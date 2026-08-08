const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getEmailDomain,
  getInstitutionTxtRecordName,
  isInstitutionalEmailDomain,
} = require("./institutionDomainUtils");

test("institutional email domains are normalized and public inbox providers are rejected", () => {
  assert.equal(getEmailDomain(" Registrar@University.EDU.IN "), "university.edu.in");
  assert.equal(getEmailDomain("missing-domain"), "");
  assert.equal(isInstitutionalEmailDomain("university.edu.in"), true);
  assert.equal(isInstitutionalEmailDomain("gmail.com"), false);
  assert.equal(isInstitutionalEmailDomain("localhost"), false);
});

test("institution ownership uses a dedicated DNS verification record", () => {
  assert.equal(
    getInstitutionTxtRecordName("University.EDU.IN"),
    "_shotlink-access.university.edu.in"
  );
});
