# Launch Runbook

This is the shortest path from this repo to a paid, public product.

## 1. Accounts you need

- GitHub
- MongoDB Atlas
- Railway
- Railway Redis
- Vercel
- Razorpay
- A domain provider such as Namecheap, GoDaddy, Cloudflare, or Hostinger

## 2. Domain plan

Use one domain and three subdomains:

- `shotlink.in` for the dashboard on Vercel
- `api.shotlink.in` for authenticated backend APIs on Railway
- `go.shotlink.in` for public short-link redirects on Railway

## 3. MongoDB Atlas

Create one cluster and one database user.

Use a database name like:

```text
shotlink
```

In Network Access, allow Railway to connect. For the first launch, you can temporarily allow access from anywhere, then tighten it after your Railway service is stable.

Copy the connection string. It becomes:

```text
MONGO_URI=mongodb+srv://...
```

## 4. Railway backend

Add a Redis database to the Railway project, then create a new backend service
from GitHub. In the backend service, add a reference variable named `REDIS_URL`
with value `${{Redis.REDIS_URL}}` (use the actual Redis service name if you named
it differently).

Use these service settings:

- Root Directory: `/backend`
- Config File: `/backend/railway.toml`
- Start Command: leave blank if Railway reads the config file, or set `npm start`
- Healthcheck Path: `/health`

Set these variables:

```text
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/shotlink?retryWrites=true&w=majority
REDIS_URL=${{Redis.REDIS_URL}}
BASE_URL=https://go.shotlink.in
APP_BASE_URL=https://shotlink.in
CUSTOM_DOMAIN_CNAME_TARGET=go.shotlink.in
IP_HASH_SALT=make-this-long-random-and-private
CSRF_SECRET=generate-a-different-long-random-secret
ALLOWED_ORIGINS=https://shotlink.in
RAZORPAY_KEY_ID=rzp_live_or_test_key
RAZORPAY_KEY_SECRET=razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_PLAN_ID_PRO_MONTHLY=plan_live_or_test_id
RAZORPAY_PLAN_ID_BUSINESS_MONTHLY=plan_live_or_test_id
SUPPORT_EMAIL=support@shotlink.in
METRICS_TOKEN=generate-a-long-random-monitoring-token
RAILWAY_DEPLOYMENT_DRAINING_SECONDS=15
```

Add these Railway domains to the same backend service:

- `api.shotlink.in`
- `go.shotlink.in`

Before directing production traffic to this release, run the durable redirect
outbox, URL-health queue, and analytics-retention migrations once from the Railway backend shell:

```text
npm run migrate:redirect-outbox
npm run migrate:health-queue
npm run migrate:analytics-retention
```

Create a second Railway service from the same repository for URL-health work:

- Root Directory: `/backend`
- Config File: `/backend/railway.health-worker.toml`
- Start Command: leave blank if Railway reads the config file, or set `npm run worker:health`
- Public domain: none
- Variables: `NODE_ENV=production` plus references to the backend's `MONGO_URI` and `REDIS_URL`

Deploy at least one worker replica. Scale worker replicas independently from API
replicas; the queue and URL-level leases coordinate concurrent workers.

After deploy, verify `/health` reports both `mongodb: connected` and
`redis: connected`. A `degraded` response remains HTTP 200 so redirects can fall
back to MongoDB, but it is an operational alert and must not be left unresolved.
Also scrape `/metrics` and alert on sustained
`shotlink_cache_operations_total{result="error"}` or `{result="bypass"}` growth,
nonzero redirect-event or URL-health dead letters, and continuously growing pending queues.
Activate the scraper, dashboard, rules, and test-alert procedure in
`ops/monitoring/README.md` before accepting production traffic.

Enable managed point-in-time backups and complete an isolated restore rehearsal
using `ops/backup/backup.ps1` and `ops/backup/restore-drill.ps1`. Record the
achieved RPO/RTO and evidence according to `DISASTER_RECOVERY.md`; merely enabling
snapshots is not a completed recovery test.

## 5. Vercel frontend

Create a new Vercel project from the same GitHub repo.

Use these project settings:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Set this variable:

```text
VITE_API_BASE_URL=https://api.shotlink.in
```

Add this Vercel domain:

```text
shotlink.in
```

## 6. Razorpay setup

Start in Razorpay Test Mode.

Create a webhook with this URL:

```text
https://api.shotlink.in/api/v1/billing/webhooks/razorpay
```

Subscribe to these events:

- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.pending`
- `subscription.halted`
- `subscription.cancelled`
- `subscription.completed`
- `subscription.expired`
- `invoice.paid`

Copy the webhook secret into:

```text
RAZORPAY_WEBHOOK_SECRET=...
```

## 7. First live test

Run this checklist after deploy:

1. Open `https://shotlink.in`.
2. Create a new account.
3. Create one short link.
4. Open the generated `https://go.shotlink.in/...` short link.
5. Confirm the click appears in analytics.
6. Click the Pro plan.
7. Pay through Razorpay Test Mode.
8. Wait a few seconds and click Verify Payment if billing is still pending.
9. Confirm the workspace plan upgrades.

## 8. Going live

After the test mode flow works:

1. Switch Razorpay keys from test to live.
2. Recreate or update the live Razorpay webhook.
3. Update Railway variables with live keys and the live webhook secret.
4. Redeploy Railway.
5. Make one real low-value payment to confirm the production flow.

## 9. Branded customer domains

For each paid customer domain, ask them to create:

```text
CNAME go.customerbrand.in -> go.shotlink.in
TXT _shotlink.go.customerbrand.in -> value shown inside the dashboard
```

Also add `go.customerbrand.in` as a custom domain on the Railway backend service:

1. Open Railway.
2. Open the backend service.
3. Go to Settings -> Networking -> Public Networking.
4. Add `go.customerbrand.in` as a custom domain.
5. Add any Railway-provided DNS verification records if Railway shows them.
6. Wait until Railway shows the domain as verified with SSL.

Then open the workspace dashboard, click Verify on that domain, and create links using that branded domain in the link builder.

Later, automate this with Railway's Domains API so customers can add domains without you manually opening Railway.

## 10. First money plan

Sell setup before you wait for self-serve signups.

Offer:

- Rs. 499/month for Pro
- Rs. 2,999/month for Business
- Rs. 1,999 one-time setup
- Rs. 4,999 branded short-link setup

Pitch:

```text
I built a short-link and fallback-routing tool for Indian campaigns. It gives branded links, QR downloads, click analytics, and backup destinations if your landing page goes down. I can set it up for your brand this week.
```

Message 50 people manually before building another major feature.
