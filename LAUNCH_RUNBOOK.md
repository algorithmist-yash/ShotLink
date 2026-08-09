# Launch Runbook

This is the shortest path from this repo to a paid, public product.

## 1. Accounts you need

- GitHub
- MongoDB Atlas
- Render
- Render Key Value
- Vercel
- Razorpay
- A domain provider such as Namecheap, GoDaddy, Cloudflare, or Hostinger

## 2. Domain plan

Use one domain and three subdomains:

- `shotlink.in` for the website, dashboard, and every default public short link
- `api.shotlink.in` for authenticated backend APIs on Render
- `go.shotlink.in` as the direct Render redirect origin and customer-domain CNAME target

Vercel proxies single-segment short codes such as `shotlink.in/abc123` to the
Render backend. The reserved website routes continue to serve the frontend.

## 3. MongoDB Atlas

Create one cluster and one database user.

Use a database name like:

```text
shotlink
```

In Network Access, allow Render to connect. Without Render Dedicated IPs, the
first launch can temporarily allow `0.0.0.0/0`; keep the application user
least-privileged and replace the broad rule if you later purchase fixed outbound
IPs or a private connection.

Copy the connection string. It becomes:

```text
MONGO_URI=mongodb+srv://...
```

## 4. Render backend

The repository root contains `render.yaml`. Create a Render Blueprint from the
GitHub repository to provision these Singapore-region resources together:

- `shotlink-api`: Starter web service
- `shotlink-health-worker`: Starter background worker
- `shotlink-cache`: Free Render Key Value for the initial beta

The initial beta profile is approximately two Starter compute instances. Render
does not offer Free background workers, and Render explicitly does not recommend
Free web or Key Value instances for production. Upgrade Key Value to a persistent
paid plan before treating cache continuity as an availability guarantee. Shotlink
keeps authoritative links, queues, and usage data in MongoDB, so a cache restart
does not erase those records.

During the first Blueprint sync, Render asks for the variables marked
`sync: false`. Enter them in the Render dashboard, never in Git or chat:

```text
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/shotlink?retryWrites=true&w=majority
RAZORPAY_KEY_ID=rzp_live_or_test_key
RAZORPAY_KEY_SECRET=razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_PLAN_ID_PRO_MONTHLY=plan_live_or_test_id
RAZORPAY_PLAN_ID_BUSINESS_MONTHLY=plan_live_or_test_id
```

The Blueprint generates the session, IP-hashing, and monitoring secrets, shares
the internal Key Value connection with both services, runs all three database
migrations before each API deploy, and adds these domains to `shotlink-api`:

- `api.shotlink.in`
- `go.shotlink.in`

The worker has no public domain. Scale it independently from the API; the queue
and URL-level leases coordinate concurrent workers.

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
4. Open the generated `https://shotlink.in/...` short link.
5. Confirm the click appears in analytics.
6. Click the Pro plan.
7. Pay through Razorpay Test Mode.
8. Wait a few seconds and click Verify Payment if billing is still pending.
9. Confirm the workspace plan upgrades.

## 8. Going live

After the test mode flow works:

1. Switch Razorpay keys from test to live.
2. Recreate or update the live Razorpay webhook.
3. Update Render variables with live keys and the live webhook secret.
4. Redeploy the Render services.
5. Make one real low-value payment to confirm the production flow.

## 9. Branded customer domains

For each paid customer domain, ask them to create:

```text
CNAME go.customerbrand.in -> go.shotlink.in
TXT _shotlink.go.customerbrand.in -> value shown inside the dashboard
```

Also add `go.customerbrand.in` as a custom domain on the Render API web service:

1. Open Render.
2. Open `shotlink-api`.
3. Go to Settings -> Custom Domains.
4. Add `go.customerbrand.in` as a custom domain.
5. Add any Render-provided DNS verification records if Render shows them.
6. Wait until Render shows the domain as verified with TLS.

Then open the workspace dashboard, click Verify on that domain, and create links using that branded domain in the link builder.

Later, automate this with Render's Custom Domains API so customers can add domains without you manually opening Render.

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
