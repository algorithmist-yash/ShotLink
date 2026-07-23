# Deploy And Sell

## 1. What to do first

If your goal is money fast, do not wait for a perfect startup.

Use this in two tracks:

1. Deploy the product publicly so it looks real.
2. Sell it as a service to real people while the startup grows.

Best early customers in India:

- Instagram creators
- local agencies
- D2C brands
- coaching centers
- event marketers
- real estate lead funnels

## 2. The simplest production stack

- Frontend: Vercel
- Backend: Railway
- Database: MongoDB Atlas
- Redirect cache: Railway Redis
- Background URL-health worker: separate Railway service
- Billing: Razorpay
- Domains:
  - `shotlink.in`
  - `api.shotlink.in`
  - `go.shotlink.in`

## 3. What each domain does

- `shotlink.in` hosts the dashboard
- `api.shotlink.in` serves authenticated API requests
- `go.shotlink.in` handles public redirects

This keeps the system cleaner and makes future scaling easier.

## 4. Backend deployment on Railway

Deploy the `backend` folder as a service.

Add a Redis database in the same Railway project first. Set the backend's
`REDIS_URL` to a reference variable for that service, such as
`${{Redis.REDIS_URL}}`, so traffic stays on Railway's internal network.

Recommended Railway settings:

- Root Directory: `/backend`
- Config File: `/backend/railway.toml`
- Start Command: `npm start`
- Healthcheck Path: `/health`

Create a second service with Root Directory `/backend`, Config File
`/backend/railway.health-worker.toml`, no public domain, and the same production
`MONGO_URI` and `REDIS_URL` references. Set `NODE_ENV=production`; the worker
does not need API-only billing or session secrets. Its start command is `npm run
worker:health`.

Environment variables:

- `PORT=5000`
- `NODE_ENV=production`
- `MONGO_URI=...`
- `REDIS_URL=${{Redis.REDIS_URL}}`
- `BASE_URL=https://go.shotlink.in`
- `APP_BASE_URL=https://shotlink.in`
- `CUSTOM_DOMAIN_CNAME_TARGET=go.shotlink.in`
- `IP_HASH_SALT=...`
- `CSRF_SECRET=...`
- `ALLOWED_ORIGINS=https://shotlink.in`
- `RAZORPAY_KEY_ID=...`
- `RAZORPAY_KEY_SECRET=...`
- `RAZORPAY_WEBHOOK_SECRET=...`
- `RAZORPAY_PLAN_ID_PRO_MONTHLY=...`
- `RAZORPAY_PLAN_ID_BUSINESS_MONTHLY=...`
- `SUPPORT_EMAIL=...`
- `METRICS_TOKEN=...`
- `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=15`

After deploy:

- run `npm run migrate:redirect-outbox` and `npm run migrate:health-queue` once
- add `api.shotlink.in` as a custom domain
- add `go.shotlink.in` as another custom domain
- confirm `/health` reports MongoDB and Redis as connected
- alert on a `degraded` health body and cache `error`/`bypass` metrics
- alert on URL-health dead letters or sustained pending-queue growth

## 5. Frontend deployment on Vercel

Deploy the `frontend` folder as a Vite project.

Recommended Vercel settings:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variable:

- `VITE_API_BASE_URL=https://api.shotlink.in`

After deploy:

- add `shotlink.in` as a custom domain

## 6. MongoDB Atlas

Create a cluster, create a database user, and allow your backend to connect.

You need:

- cluster connection string
- database user password
- network access configured for your deployment host

## 7. Billing strategy that gets money fast

Do not build full complex billing first.

Start in this order:

1. Razorpay Payment Links
2. Manual onboarding for first customers
3. Razorpay Subscriptions in-product after first paid users

For the current codebase, this is how billing works:

- logged-in workspace owner clicks a paid plan
- backend creates a Razorpay Subscription checkout
- user pays on Razorpay hosted page
- Razorpay webhook calls your backend
- backend upgrades the workspace plan automatically
- an owner can use Verify Payment to reconcile a delayed or missed webhook

Webhook URL:

- `https://api.shotlink.in/api/v1/billing/webhooks/razorpay`

Webhook events:

- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.pending`
- `subscription.halted`
- `subscription.cancelled`
- `subscription.completed`
- `subscription.expired`
- `invoice.paid`

## 7.1. Branded customer domain setup

For each customer branded domain:

1. Add the customer hostname to the Railway backend service as a custom domain.
2. Ask the customer to create `CNAME go.customerbrand.in -> go.shotlink.in`.
3. Ask the customer to create the dashboard-provided TXT verification record.
4. Wait for Railway SSL/domain verification.
5. Click Verify in this app's workspace dashboard.
6. Create customer links using that branded domain.

Why:

- fastest to start charging
- less engineering risk
- lets you learn what customers actually want

## 8. Simple pricing to start

### Free

- up to 20 links
- limited analytics retention
- no custom domain

### Pro

- `Rs. 499/month`
- fallback URLs
- advanced analytics
- QR downloads
- more links

### Business

- `Rs. 2,999/month`
- team access
- exports
- priority support
- higher usage limits

If customers hesitate, sell setup packages:

- `Rs. 1,999` one-time setup
- `Rs. 4,999` branded domain setup + migration
- `Rs. 9,999+` campaign setup for agencies

## 9. Fastest path to first money

Do this before chasing big traffic:

1. Deploy the product.
2. Record a short demo video.
3. Message 50 potential users directly.
4. Offer setup + support, not just software.

Pitch:

"I built a short-link and fallback-routing tool for campaigns. It gives click analytics, QR links, and backup destinations if your main page is down. I can set it up for your brand this week."

## 10. Where to find first customers

- LinkedIn search for small agencies
- Instagram creators with link-in-bio usage
- local business owners
- coaching institutes
- startup founders with active campaigns

## 11. What to say to customers

Short version:

"I help brands and creators track clicks, use branded short links, and avoid losing campaign traffic when landing pages fail."

Outcome-based version:

"If your campaign link breaks or loads badly, you lose paid traffic. This tool lets you switch traffic to backup links and see who clicked from mobile or desktop."

## 12. What not to do

- do not wait 6 months before selling
- do not build 20 extra features before first users
- do not copy Bitly feature-for-feature first
- do not depend only on SEO traffic

## 13. What to build next after deployment

1. Password reset
2. Email verification
3. Invite teammates to workspace
4. Razorpay subscriptions
5. Downloadable analytics exports
6. Team roles and workspace invites

## 14. Personal reality check

If you need money quickly, the fastest route is usually:

- deploy this
- use it as proof of skill
- sell implementation/setup/support
- take freelance or agency-style work around it

Startup revenue often takes longer than service revenue.

That is not failure. It is the practical path.
