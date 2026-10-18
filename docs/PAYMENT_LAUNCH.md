# Payment launch status — 18 October 2026

Live checkout remains unavailable: the public billing endpoint reports Razorpay Test
Mode, and the owner has not confirmed account activation. No real payment, refund,
provider subscription, DNS change or live credential change was performed.

## Completed engineering work

- Checkout availability now requires credentials; production also requires both monthly
  plan IDs and the webhook secret, in addition to a live key.
- Unsupported signed webhook events are ignored instead of resetting billing status.
- Older webhook timestamps and activation after a terminal checkout state are ignored.
- Mismatched subscription/plan IDs and unpaid activations are rejected.
- Events for an old subscription cannot replace a workspace's newer subscription.
- Provider calls have a 15-second timeout. Ambiguous subscription creation errors,
  including HTTP 5xx and incomplete responses, retain the creation claim so a customer
  cannot accidentally create a second subscription by retrying.
- Enterprise cannot be purchased as a zero-price payment link.
- Added `npm run check:billing` and `npm run check:billing -- --provider`. These read
  environment configuration and optionally fetch plan definitions; they never create
  charges or print credentials. Provider checks compare amount, INR currency and a
  one-month interval against Shotlink's plan definitions.

This does not prove real Razorpay payment delivery. Signed local fixtures and mocked
provider responses test application behavior, not the merchant's account activation,
bank settlement, live webhooks or customer payment methods.

## Owner account setup

1. Sign in to the intended Razorpay merchant account and inspect activation status.
   Complete the account's requested business/KYC and settlement-bank verification.
   Resolve any dashboard restrictions on Subscriptions before enabling paid plans.
2. Keep `BILLING_CHECKOUT_ENABLED=false` in the production backend while setting up.
3. Create or select monthly plans in the correct mode:
   - Creator Pro: INR 1,199/month; API amount **119900 paise**.
   - Studio: INR 9,999/month; API amount **999900 paise**.
   Both use monthly interval 1. Review whether these prices suit your users before
   creating live plans. Test plan IDs and live plan IDs are separate.
4. Save `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_PLAN_ID_PRO_MONTHLY`, `RAZORPAY_PLAN_ID_BUSINESS_MONTHLY` and
   `RAZORPAY_WEBHOOK_SECRET` in backend hosting secrets. Never put them in frontend
   `VITE_*` variables, Git, screenshots or chat. Preserve the existing webhook secret
   while old deliveries are being retried.
5. Configure the Razorpay webhook URL:
   `https://api.shotlink.in/api/v1/billing/webhooks/razorpay`.
   Subscribe to `subscription.authenticated`, `subscription.activated`,
   `subscription.charged`, `subscription.pending`, `subscription.halted`,
   `subscription.cancelled`, `subscription.completed`, `subscription.expired` and
   `invoice.paid`. Legacy payment-link support also accepts `payment_link.paid`,
   `payment_link.cancelled`, `payment_link.expired`, `payment_link.partially_paid`.
6. Set `APP_BASE_URL=https://www.shotlink.in`. In a backend environment with the
   secrets already loaded, run `npm run check:billing -- --provider` from `backend/`.
   Correct mismatched plan prices/currency/intervals before proceeding.

## Test before enabling live checkout

Use an isolated staging backend/database, test keys/plans and a test-mode webhook;
do not make test subscriptions in the live customer database. The production API
deliberately rejects paid checkout with test keys.

- Complete verified signup, start each plan, finish a test payment, and confirm the
  workspace receives the correct limits only after a paid cycle.
- Close the checkout, decline a test payment, retry, and confirm no paid access.
- Redeliver a webhook, deliver an older event, and confirm entitlement dates do not
  regress or create extra subscriptions.
- Test a missed webhook and use **Verify payment** in Billing to reconcile it.
- Schedule cancellation and confirm access lasts through the already-paid period,
  followed by free limits after expiry. Verify renewal and failed-renewal behavior.
- Confirm Razorpay's webhook logs show successful delivery with signature validation.
- Review displayed prices, operator identity/contact details, supported features,
  subscription/cancellation terms and refund process before selling.

After these tests and account activation, set `BILLING_CHECKOUT_ENABLED=true` with live
credentials. Perform one owner-controlled live purchase, verify webhook-driven
activation and the receipt, then test the documented cancellation/refund procedure
through the merchant dashboard. Refund automation is not implemented by this task.
Only the account owner can settle activation/KYC and confirm money movement.

## Other remaining launch tasks

Search Console verification and sitemap submission, analytics enablement, real-email
delivery verification and user recruitment still need account configuration or real
participants. See `TRAFFIC_MEASUREMENT_SETUP.md`. These were not completed or claimed
as part of the payment changes.

Sources: [Razorpay webhook validation, duplicate delivery and event ordering](https://razorpay.com/docs/webhooks/validate-test/),
[Razorpay Subscriptions documentation](https://razorpay.com/docs/payments/subscriptions/).
