# Shotlink

Shotlink is a full-stack URL shortener with authenticated workspaces, link expiry, custom aliases,
fallback destinations, click analytics, QR codes, custom domains, and Razorpay-backed billing.

## Stack

- Frontend: React, Vite, qrcode.react
- Backend: Node.js, Express, MongoDB, Mongoose, Redis
- Contracts: OpenAPI 3.1 (`docs/openapi.json`)
- Tests: Node's built-in test runner, Vitest, Playwright, axe, and k6

## Project Structure

```text
shotlink/
  backend/
    config/db.js
    src/
      app.js
      server.js
      config/
      controllers/
      middleware/
      models/
      routes/
      services/
      utils/
  frontend/
    index.html
    src/App.jsx
    src/index.css
```

## Environment

Backend variables:

```text
PORT=5000
MONGO_URI=your_mongodb_connection_string
REDIS_URL=redis://localhost:6379
BASE_URL=http://localhost:5000
APP_BASE_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
IP_HASH_SALT=replace_me
CSRF_SECRET=replace_with_a_different_long_random_secret
TRUST_PROXY_CIDRS=
RAZORPAY_KEY_ID=replace_me
RAZORPAY_KEY_SECRET=replace_me
RAZORPAY_WEBHOOK_SECRET=replace_me
RAZORPAY_PLAN_ID_PRO_MONTHLY=replace_me
RAZORPAY_PLAN_ID_BUSINESS_MONTHLY=replace_me
METRICS_TOKEN=replace_with_a_long_random_monitoring_token
AUDIT_RETENTION_DAYS=730
LEGACY_ANALYTICS_RETENTION_DAYS=90
```

Frontend variables:

```text
VITE_API_BASE_URL=http://localhost:5000
```

Browser authentication uses a host-only `HttpOnly` session cookie. The frontend
sends requests with credentials enabled and returns the `csrfToken` from the
authentication response in the `X-CSRF-Token` header for `POST`, `PUT`, `PATCH`,
and `DELETE` requests. Non-browser API clients remain compatible with
`Authorization: Bearer <session-token>` and do not use the browser CSRF flow.

Redirect analytics use a durable MongoDB outbox. The API acknowledges one queued
event before responding, while a leased background worker commits the click
event, URL counter, usage counter, and job completion in one transaction. Use a
MongoDB replica set or sharded cluster (MongoDB Atlas satisfies this requirement),
then apply the queue and analytics-retention migrations once per environment:

```bash
npm --prefix backend run migrate:redirect-outbox
npm --prefix backend run migrate:health-queue
npm --prefix backend run migrate:analytics-retention
```

Stale redirect health checks are handed off from the redirect outbox transaction
to a durable, coalescing MongoDB queue. Run `npm --prefix backend run
worker:health` as a separate, non-public worker service. Claims use leases,
bounded jittered retries, crash recovery, and retained dead letters; the API
process never performs this network work after sending a redirect.

Public redirects use Redis as a non-authoritative read-through cache for compact
route, custom-domain, workspace-entitlement, and current-usage snapshots. Cache
keys are versioned and hashed, active-route TTLs never outlive link expiry, and
all reads fail open to MongoDB. `REDIS_URL` is optional for local development and
required in production. `/health` reports `degraded` with HTTP 200 if Redis drops
after startup because MongoDB can still serve correct redirects; alert on this
state because latency and database load will increase.

## Run Locally

Use the repository's pinned Node.js version:

```bash
nvm use
```

Install dependencies in both apps if needed:

```bash
npm --prefix backend install
npm --prefix frontend install
```

Start the backend:

```bash
npm --prefix backend run dev
```

In a second terminal, start the URL-health worker:

```bash
npm --prefix backend run worker:health
```

Start the frontend:

```bash
npm --prefix frontend run dev
```

For a production-like local stack with MongoDB, Redis, the API, worker, and
frontend proxy, run `docker compose up --build`. The containers use non-root
runtime users and health checks. Do not reuse the example Compose credentials in
a shared environment.

## Useful Commands

```bash
npm --prefix backend test
npm --prefix backend run test:coverage
npm --prefix backend run test:integration
npm --prefix backend run test:coverage:controllers
npm --prefix backend run test:contracts
npm --prefix backend run test:load
npm --prefix backend audit --omit=dev
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:e2e:install
npm --prefix frontend run test:e2e
```

`test:integration` starts a disposable MongoDB 8.2.6 WiredTiger replica set and
the real Express application on an ephemeral local port. It verifies actual
indexes, cookie sessions, CSRF, link creation, redirect outbox persistence,
transaction commit/rollback, analytics, and workspace isolation. Destination
health probes alone are replaced with a deterministic test implementation so
the suite never depends on the public internet. The first run may take longer
while the pinned MongoDB test binary is downloaded and cached.

`test:e2e` starts the same isolated MongoDB-backed Express test stack plus Vite,
then runs Playwright against desktop Chromium and a 390px mobile viewport. It
verifies public navigation, form validation, required consent, registration,
cookie restoration, link creation, a real 302 redirect, asynchronous analytics,
logout, responsive overflow, runtime errors, and WCAG A/AA rules. Run
`test:e2e:install` once after installing or upgrading Playwright; CI installs
Chromium automatically and retains the HTML report and failure artifacts.
On Windows, `test:e2e:running` can target already-started E2E API and Vite
processes without asking Playwright to manage their process trees.

## Main API Routes

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/links`
- `POST /api/v1/links`
- `GET /api/v1/links/:shortCode/analytics`
- `GET /api/v1/links/:shortCode/events`
- `PATCH /api/v1/links/:shortCode/expire`
- `POST /api/v1/links/:shortCode/health-check`
- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/summary`
- `GET /api/v1/workspace/audit-events`
- `POST /api/v1/billing/subscriptions`
- `POST /api/v1/billing/subscriptions/cancel`
- `POST /api/v1/billing/webhooks/razorpay`
- `GET /live`
- `GET /health`
- `GET /metrics` with the configured bearer token
- `GET /:shortCode`

## Notes

- Link creation requires a signed-in user and required compliance consent fields.
- Direct private/local IP destinations are rejected.
- Health checks also reject hostnames that resolve to private or local network addresses.
- Railway proxy ranges are trusted automatically. On other proxy deployments, set `TRUST_PROXY_CIDRS` to the exact proxy CIDRs; never use a blanket `true` trust setting.
- Keep `.env` files out of version control.
- Alert on nonzero dead jobs and sustained pending growth for both the
  `redirect_event` and `url_health` queues.
- Follow [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) for backup policy, rollback, restore, and drill procedures.
- Follow [CONTRIBUTING.md](./CONTRIBUTING.md) for required checks and change discipline.
- Report vulnerabilities privately according to [SECURITY.md](./SECURITY.md).
