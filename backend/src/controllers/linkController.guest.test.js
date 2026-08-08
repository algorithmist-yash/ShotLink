const assert = require("node:assert/strict");
const test = require("node:test");

const Url = require("../models/Url");
const { createGuestLink } = require("./linkController");

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest(body) {
  return {
    body,
    protocol: "https",
    ip: "203.0.113.42",
    headers: {},
    get(name) {
      if (name === "host") return "api.shotlink.in";
      if (name === "user-agent") return "Shotlink guest test";
      return "";
    },
  };
}

const compliance = {
  destinationAuthorityAccepted: true,
  securityScanAccepted: true,
  abusePolicyAccepted: true,
};

test("guest link creation is capped at 30 minutes", async () => {
  const response = createResponse();
  await createGuestLink(
    createRequest({
      originalUrl: "https://example.com/campaign",
      expiresInMinutes: 31,
      compliance,
    }),
    response
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /between 1 and 30 minutes/);
});

test("guest link creation returns a temporary short URL without a workspace", async (t) => {
  const originalExists = Url.exists;
  const originalCreate = Url.create;
  const originalShortlinkBaseUrl = process.env.SHORTLINK_BASE_URL;
  let createdAttributes;

  process.env.SHORTLINK_BASE_URL = "https://shotlink.in";

  Url.exists = async () => false;
  Url.create = async (attributes) => {
    createdAttributes = attributes;
    return {
      _id: "guest-url-1",
      ...attributes,
      createdAt: new Date(),
      customDomainHost: "",
      lastClickedAt: null,
      primaryHealth: {
        status: "unknown",
        lastStatusCode: null,
        lastCheckedAt: null,
        lastFailureReason: "",
      },
    };
  };

  t.after(() => {
    Url.exists = originalExists;
    Url.create = originalCreate;
    if (originalShortlinkBaseUrl === undefined) {
      delete process.env.SHORTLINK_BASE_URL;
    } else {
      process.env.SHORTLINK_BASE_URL = originalShortlinkBaseUrl;
    }
  });

  const startedAt = Date.now();
  const response = createResponse();
  await createGuestLink(
    createRequest({
      originalUrl: "https://example.com/creator-post",
      expiresInMinutes: 15,
      compliance,
    }),
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.limits.maxExpiryMinutes, 30);
  assert.match(response.body.link.shortUrl, /^https:\/\/shotlink\.in\//);
  assert.equal(createdAttributes.workspaceId, null);
  assert.equal(createdAttributes.createdBy, null);
  assert.equal(createdAttributes.compliance.acceptedBy, null);
  assert.equal(createdAttributes.originalUrl, "https://example.com/creator-post");
  assert.ok(createdAttributes.expiresAt.getTime() >= startedAt + 15 * 60 * 1000);
  assert.ok(createdAttributes.expiresAt.getTime() <= Date.now() + 15 * 60 * 1000);
});

test("guest links require destination authority and anti-abuse consent", async () => {
  const response = createResponse();
  await createGuestLink(
    createRequest({
      originalUrl: "https://example.com/post",
      expiresInMinutes: 10,
      compliance: {},
    }),
    response
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body.missingConsents, [
    "destinationAuthorityAccepted",
    "securityScanAccepted",
    "abusePolicyAccepted",
  ]);
});
