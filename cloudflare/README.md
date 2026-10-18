# Shotlink Cloudflare migration

Status: migration source prepared; Worker dry-run bundling and routing tests pass. Container image build and real-account deployment are not yet verified. No DNS cutover has occurred.

## Architecture

One Cloudflare Worker serves the built frontend and forwards API/short-link traffic to a Cloudflare Container running the existing Node application. The API and destination-health worker share the process when RUN_HEALTH_WORKER=true. MongoDB and Redis remain external and retain existing records. This moves frontend/backend hosting, not database hosting.

The container uses one instance initially. A five-minute scheduled readiness request keeps background consumers active through quiet periods; idle timeout is 15 minutes. This incurs ongoing container runtime cost and is not a zero-cost/serverless-idle configuration. Verify the account's Containers availability, plan, and budget before deployment. Cron execution is not an uptime guarantee. Monitor readiness, restart behavior, queue depth, and redirect latency.

Official references: [Containers setup](https://developers.cloudflare.com/containers/get-started/), [runtime secrets](https://developers.cloudflare.com/containers/examples/env-vars-and-secrets/), [container lifecycle](https://developers.cloudflare.com/containers/reference/container-class/), [WAF](https://developers.cloudflare.com/waf/).

## Required setup

1. Start Docker Desktop and verify its engine is available. Sign into the intended Cloudflare account with `pnpm exec wrangler login` from this folder. Do not paste credentials into a task message.
2. Store a JSON object of backend environment string values in the Worker secret `BACKEND_ENV_JSON`, using `pnpm exec wrangler secret put BACKEND_ENV_JSON`. Source the existing production configuration through the owner's secure environment management. Do not commit it or write it to the public frontend build.
3. Include all fields required by `backend/src/config/env.js`: MONGO_URI, REDIS_URL, BASE_URL, SHORTLINK_BASE_URL, APP_BASE_URL, IP_HASH_SALT, CSRF_SECRET, ALLOWED_ORIGINS, payment and email configuration. Preserve existing salts/secrets unless intentionally rotating them. Include any operational overrides in current production. NODE_ENV, PORT, CLOUDFLARE_CONTAINER and RUN_HEALTH_WORKER are controlled by the container adapter.
4. For final production use APP_BASE_URL=https://www.shotlink.in, SHORTLINK_BASE_URL=https://shotlink.in and the existing intended API BASE_URL. Include both public origins in ALLOWED_ORIGINS where needed. For staging, use isolated credentials/data and the actual staging origin. Verify database-provider network rules allow the container's outbound connection using the provider's supported secure access arrangement; do not broadly open network rules as a shortcut.
5. Build the frontend with the matching VITE_API_BASE_URL. A same-origin API build is supported by the Worker and avoids cross-origin requests; a production api.shotlink.in build also routes correctly after that hostname moves. Review cookie/session behavior using the selected topology.

## Validation and deployment

From frontend: regenerate policy pages, then build. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm exec wrangler deploy --dry-run
pnpm exec wrangler deploy
```

Use an account-owned preview before production domains. The checked-in config deliberately has no custom domain routes, so it cannot automatically take over the live domain. A full dry run requires Docker; `--containers-rollout=none` validates the Worker only and does not validate the image.

Before cutover, verify backend /health, email verification, reset-password navigation, guest link creation, expiry, QR download, authenticated creation, click recording, queue processing, and billing webhooks using controlled test data. Auth/session APIs and redirects must never be cached by an override rule. Test a container restart and confirm queued jobs recover.

After staging verification, attach shotlink.in, www.shotlink.in, and api.shotlink.in as custom domains to the Worker in the intended account, resolving existing DNS records with the owner. Preserve email MX/TXT records. Re-test direct verification/reset URLs and the canonical host redirect. Configure WAF/rate limits to preserve normal link redirects, email action links, and verified payment webhooks. Retain app-level consent, CSRF, session, authorization, URL validation, and abuse controls.

Keep old hosts available during the observation period and record their original DNS values. Roll back hostname routing if readiness, sessions, redirect accuracy, or job processing regress. Do not retire old services or duplicate their background workers indefinitely before confirming the replacement.

## Remaining traffic work

Account-action routing, public rendering, canonical metadata, reserved aliases, and initial marketing copy have been corrected locally. Acquisition analytics, Search Console verification, use-case landing pages, and a measured signup/distribution experiment remain. Migration alone does not deliver visitors or enable WAF rules. A Cloudflare analytics site token/account setup is needed before verifying real traffic measurement.
