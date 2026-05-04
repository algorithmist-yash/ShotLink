const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPlanDefinition,
  resolveEffectivePlan,
  serializeBillingSnapshot,
} = require("./billingPlans");

test("getPlanDefinition returns known plans and null for unknown values", () => {
  assert.equal(getPlanDefinition("pro").name, "Pro");
  assert.equal(getPlanDefinition("unknown"), null);
});

test("resolveEffectivePlan downgrades expired paid plans to free", () => {
  assert.equal(
    resolveEffectivePlan({
      plan: "business",
      billing: {
        currentPeriodEndsAt: new Date(Date.now() - 60000).toISOString(),
      },
    }).id,
    "free"
  );

  assert.equal(
    resolveEffectivePlan({
      plan: "business",
      billing: {
        currentPeriodEndsAt: new Date(Date.now() + 60000).toISOString(),
      },
    }).id,
    "business"
  );
});

test("serializeBillingSnapshot exposes link limits for the effective plan", () => {
  const snapshot = serializeBillingSnapshot({
    plan: "pro",
    billing: {
      status: "active",
      currentPeriodEndsAt: new Date(Date.now() + 3600000).toISOString(),
      lastPaymentReference: "BILL-123",
    },
  });

  assert.equal(snapshot.effectivePlanId, "pro");
  assert.equal(snapshot.linkLimit, 200);
  assert.equal(snapshot.domainLimit, 1);
  assert.equal(snapshot.lastPaymentReference, "BILL-123");
});
