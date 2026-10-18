# Reliability follow-up — 19 October 2026

## Completed in source

- Repaired two invalid UTF-8 bytes in the signup separator and onboarding apostrophe.
- Bounded Resend HTTPS requests to 15 seconds. Signup and password recovery no longer
  wait indefinitely for an unresponsive email provider. Existing controller error
  handling and retry actions remain in place.
- Added a real MongoDB integration test that runs the three Render build migrations
  twice against runtime-created indexes. It verifies that missing legacy expiry is
  backfilled while existing retention dates and required indexes are preserved.

Validation: 204 backend unit tests, 5 database-backed integration tests, source syntax,
frontend production build and the 12 marketing-page checks pass locally. This does not
establish that production database permissions, networking or secrets are correct.

## Account-dependent work still pending

| Item | Evidence | Required action |
|---|---|---|
| Render backend release | GitHub marks deployment `7156369953` for commit `1f06ddd97f146a466b092cf53b3d32a97e4ec843` failed. API health still responds. | Read the Render build/runtime logs; correct the actual error, then redeploy and confirm the served commit. |
| Visitor analytics | `https://www.shotlink.in/_vercel/insights/script.js` returns 404. | Enable Web Analytics in the intended Vercel project, set production `VITE_ENABLE_WEB_ANALYTICS=true`, redeploy and verify ingestion. Check feature/plan cost before any upgrade. |
| Canonical redirect | Apex domain previously returned 307 to www despite permanent source redirect configuration. | Inspect Vercel Domains configuration, set permanent redirect and verify 301/308 while preserving path/query. |
| Live email | Local provider behavior is tested; no real inbox delivery was performed. | Verify Resend sender/domain status and complete verification/recovery using an owner-controlled test account. |
| Search visibility | No Search Console account is connected. | Verify domain ownership, submit sitemap and inspect selected canonicals/indexing. |
| Paid launch | Live public API reports checkout disabled and Razorpay Test Mode. | Complete merchant activation and the payment checklist; do not enable checkout prematurely. |

No Render, Vercel or Resend API credential is available in the current shell. The
Render dashboard opens at sign-in, so private failure logs are not accessible yet.
The owner was asked to sign in or provide the failed build log. Do not infer a specific
failure cause from a healthy old release or from successful local migration tests.

Render failure details:
https://dashboard.render.com/web/srv-d9s1negn74is73fpaj8g/deploys/dep-dbae0irrjlhs73cgno80

## How to finish the deployment diagnosis

Inspect the first failed command in the linked deployment log. If failure occurs in
`npm ci`, inspect the package lock and supported Node version. If it occurs in a migration,
inspect its exact MongoDB error and required permissions/network access; preserve
existing collections and do not drop indexes or open database access globally as a
shortcut. If startup fails, inspect the named missing environment keys, configured port,
MongoDB connectivity and health-check response. Keep secret values out of public logs.

After correction, redeploy the intended main commit and require a successful Render
deployment plus `/health` HTTP 200. Then verify signup/email, recovery and redirect
behavior on production with a controlled account. Account activation and real email
delivery cannot be established by mocked local providers.

Link lifetime, pricing and consent policy were not changed without usage evidence.
Observe a few real sharing tasks and review funnel data before changing these product
rules. Existing seven-day limits remain clearly stated in the product and guides.
