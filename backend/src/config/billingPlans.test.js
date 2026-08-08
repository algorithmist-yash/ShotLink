const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPlanDefinition,
  resolveEffectivePlan,
  serializeBillingSnapshot,
} = require("./billingPlans");

test("getPlanDefinition returns known plans and null for unknown values", () => {
  assert.equal(getPlanDefinition("pro").name, "Creator Pro");
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
  assert.equal(snapshot.linkLimit, 500);
  assert.equal(snapshot.clickLimit, 25000);
  assert.equal(snapshot.domainLimit, 1);
  assert.equal(snapshot.teamMemberLimit, 3);
  assert.equal(snapshot.apiCallLimit, 10000);
  assert.equal(snapshot.qrCodeLimit, 250);
  assert.equal(snapshot.lastPaymentReference, "BILL-123");
});

test("listPublicPlans exposes paid usage meters without provider internals", () => {
  const pro = getPlanDefinition("pro");

  assert.equal(pro.razorpayPlanIdEnvKey, "RAZORPAY_PLAN_ID_PRO_MONTHLY");
  assert.equal(pro.apiCallLimit, 10000);
  assert.equal(pro.qrCodeLimit, 250);
});
