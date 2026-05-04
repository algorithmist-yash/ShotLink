const BILLING_PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceInPaise: 0,
    currency: "INR",
    intervalMonths: 0,
    linkLimit: 20,
    domainLimit: 0,
    features: [
      "Up to 20 active links",
      "Basic analytics",
      "QR codes",
      "No branded domain",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceInPaise: 49900,
    currency: "INR",
    intervalMonths: 1,
    linkLimit: 200,
    domainLimit: 1,
    features: [
      "Up to 200 active links",
      "1 branded domain",
      "Fallback routing",
      "Advanced analytics",
      "Priority email support",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    priceInPaise: 299900,
    currency: "INR",
    intervalMonths: 1,
    linkLimit: 5000,
    domainLimit: 5,
    features: [
      "Up to 5000 active links",
      "Up to 5 branded domains",
      "Team-ready workspace",
      "Campaign-friendly analytics",
      "Priority onboarding support",
    ],
  },
};

function getPlanDefinition(planId) {
  return BILLING_PLANS[planId] || null;
}

function listPublicPlans() {
  return Object.values(BILLING_PLANS).map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceInPaise: plan.priceInPaise,
    currency: plan.currency,
    intervalMonths: plan.intervalMonths,
    linkLimit: plan.linkLimit,
    domainLimit: plan.domainLimit,
    features: plan.features,
  }));
}

function addMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function resolveEffectivePlan(workspace) {
  const configuredPlan = getPlanDefinition(workspace?.plan) || BILLING_PLANS.free;
  if (configuredPlan.id === "free") {
    return BILLING_PLANS.free;
  }

  const currentPeriodEndsAt = workspace?.billing?.currentPeriodEndsAt;
  if (!currentPeriodEndsAt || new Date(currentPeriodEndsAt) <= new Date()) {
    return BILLING_PLANS.free;
  }

  return configuredPlan;
}

function serializeBillingSnapshot(workspace) {
  const effectivePlan = resolveEffectivePlan(workspace);

  return {
    configuredPlanId: workspace?.plan || "free",
    effectivePlanId: effectivePlan.id,
    effectivePlanName: effectivePlan.name,
    currentPeriodEndsAt: workspace?.billing?.currentPeriodEndsAt || null,
    billingStatus: workspace?.billing?.status || "inactive",
    lastPaymentAt: workspace?.billing?.lastPaymentAt || null,
    lastPaymentReference: workspace?.billing?.lastPaymentReference || "",
    linkLimit: effectivePlan.linkLimit,
    domainLimit: effectivePlan.domainLimit,
  };
}

module.exports = {
  BILLING_PLANS,
  addMonths,
  getPlanDefinition,
  listPublicPlans,
  resolveEffectivePlan,
  serializeBillingSnapshot,
};
