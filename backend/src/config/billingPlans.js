const BILLING_PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceInPaise: 0,
    currency: "INR",
    intervalMonths: 0,
    linkLimit: 10,
    clickLimit: 500,
    domainLimit: 0,
    teamMemberLimit: 1,
    apiCallLimit: 0,
    qrCodeLimit: 5,
    analyticsRetentionDays: 90,
    features: [
      "Up to 10 active links",
      "Basic click analytics",
      "Shotlink-branded QR codes",
      "No branded domain",
    ],
  },
  pro: {
    id: "pro",
    name: "Creator Pro",
    priceInPaise: 119900,
    currency: "INR",
    intervalMonths: 1,
    linkLimit: 500,
    clickLimit: 25000,
    domainLimit: 1,
    teamMemberLimit: 3,
    apiCallLimit: 10000,
    qrCodeLimit: 250,
    analyticsRetentionDays: 180,
    razorpayPlanIdEnvKey: "RAZORPAY_PLAN_ID_PRO_MONTHLY",
    features: [
      "Up to 500 active campaign and bio links",
      "1 branded domain",
      "250 campaign QR codes",
      "Audience, device, and referrer analytics",
      "Editable destinations and fallback routing",
      "Priority email support",
    ],
  },
  business: {
    id: "business",
    name: "Studio",
    priceInPaise: 999900,
    currency: "INR",
    intervalMonths: 1,
    linkLimit: 10000,
    clickLimit: 500000,
    domainLimit: 10,
    teamMemberLimit: 25,
    apiCallLimit: 250000,
    qrCodeLimit: 5000,
    analyticsRetentionDays: 400,
    razorpayPlanIdEnvKey: "RAZORPAY_PLAN_ID_BUSINESS_MONTHLY",
    features: [
      "Up to 10,000 active campaign links",
      "Up to 10 branded domains",
      "Team workspaces for talent and campaign managers",
      "5,000 campaign QR codes",
      "Campaign analytics and exports",
      "Priority onboarding support",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceInPaise: 0,
    currency: "INR",
    intervalMonths: 0,
    linkLimit: 1000000,
    clickLimit: 100000000,
    domainLimit: 100,
    teamMemberLimit: 1000,
    apiCallLimit: 10000000,
    qrCodeLimit: 100000,
    analyticsRetentionDays: 730,
    features: [
      "Custom link and click volume",
      "Verified institution email-domain governance",
      "Workspace roles and audit logs",
      "Dedicated success and security review",
      "Custom SLA and procurement support",
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
    clickLimit: plan.clickLimit,
    domainLimit: plan.domainLimit,
    teamMemberLimit: plan.teamMemberLimit,
    apiCallLimit: plan.apiCallLimit,
    qrCodeLimit: plan.qrCodeLimit,
    analyticsRetentionDays: plan.analyticsRetentionDays,
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
    clickLimit: effectivePlan.clickLimit,
    domainLimit: effectivePlan.domainLimit,
    teamMemberLimit: effectivePlan.teamMemberLimit,
    apiCallLimit: effectivePlan.apiCallLimit,
    qrCodeLimit: effectivePlan.qrCodeLimit,
    analyticsRetentionDays: effectivePlan.analyticsRetentionDays,
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
