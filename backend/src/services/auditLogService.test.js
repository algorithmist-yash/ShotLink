const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getAuditRetentionDays,
  recordAuditEvent,
  sanitizeMetadata,
} = require("./auditLogService");

test("audit retention configuration is bounded", () => {
  assert.equal(getAuditRetentionDays({}), 730);
  assert.equal(getAuditRetentionDays({ AUDIT_RETENTION_DAYS: "365" }), 365);
  assert.equal(getAuditRetentionDays({ AUDIT_RETENTION_DAYS: "2" }), 730);
  assert.equal(getAuditRetentionDays({ AUDIT_RETENTION_DAYS: "99999" }), 730);
});

test("audit metadata strips secret-like fields and bounds untrusted strings", () => {
  const sanitized = sanitizeMetadata({
    actionNote: "x".repeat(800),
    password: "do-not-store",
    nested: { csrfToken: "do-not-store", safe: true },
  });
  assert.equal(sanitized.actionNote.length, 500);
  assert.equal("password" in sanitized, false);
  assert.deepEqual(sanitized.nested, { safe: true });
});

test("audit writes immutable actor and request evidence with an expiry", async () => {
  let created;
  const clock = Date.parse("2026-07-21T00:00:00.000Z");
  const request = {
    id: "request-1",
    ip: "203.0.113.5",
    socket: {},
    auth: {
      workspace: { _id: "507f1f77bcf86cd799439011" },
      user: { _id: "507f191e810c19729de860ea" },
      session: { _id: "507f191e810c19729de860eb" },
    },
    get(name) { return name === "user-agent" ? "Audit Test" : ""; },
  };
  const result = await recordAuditEvent(
    request,
    {
      action: "link.expired",
      targetType: "link",
      targetId: "507f191e810c19729de860ec",
      metadata: { shortCode: "launch" },
    },
    {
      AuditEventModel: { async create(value) { created = value; } },
      clock: () => clock,
      env: { AUDIT_RETENTION_DAYS: "365", IP_HASH_SALT: "test-audit-salt" },
    }
  );
  assert.equal(result, true);
  assert.equal(created.action, "link.expired");
  assert.equal(created.requestId, "request-1");
  assert.notEqual(created.ipHash, "203.0.113.5");
  assert.equal(created.expiresAt.toISOString(), "2027-07-21T00:00:00.000Z");
});
