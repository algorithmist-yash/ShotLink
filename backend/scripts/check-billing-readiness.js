// Read-only: validates configuration and optionally fetches provider plan definitions.
require("dotenv").config({ quiet: true });
const { getCheckoutAvailability } = require("../src/controllers/billingController");
const { BILLING_PLANS } = require("../src/config/billingPlans");
const { getRazorpayBasicAuthHeader } = require("../src/utils/razorpayUtils");

async function main() {
  const availability = getCheckoutAvailability();
  const keys = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_PLAN_ID_PRO_MONTHLY", "RAZORPAY_PLAN_ID_BUSINESS_MONTHLY"];
  const missing = keys.filter(key => !String(process.env[key] || "").trim());
  console.log(JSON.stringify({ checkout: availability, missing }, null, 2));
  if (missing.length) { process.exitCode = 1; return; }
  if (!process.argv.includes("--provider")) return;
  for (const plan of [BILLING_PLANS.pro, BILLING_PLANS.business]) {
    const response = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(process.env[plan.razorpayPlanIdEnvKey])}`, {
      headers: { Authorization: getRazorpayBasicAuthHeader() },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`${plan.id}: provider plan lookup failed (HTTP ${response.status})`);
    const remote = await response.json();
    if (remote.period !== "monthly" || remote.interval !== 1 ||
        remote.item?.amount !== plan.priceInPaise || remote.item?.currency !== plan.currency) {
      throw new Error(`${plan.id}: provider price, currency or billing interval does not match Shotlink`);
    }
    console.log(`${plan.id}: provider amount, currency and monthly interval match`);
  }
}
main().catch(() => {
  // Do not print provider bodies, headers or credentials.
  console.error("Billing verification failed. Check credential access and provider plan prices/intervals.");
  process.exitCode = 1;
});
