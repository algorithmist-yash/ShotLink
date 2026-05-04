# Launch Runbook

This is the shortest path from this repo to a paid, public product.

## 1. Accounts you need

- GitHub
- MongoDB Atlas
- Railway
- Vercel
- Razorpay
- A domain provider such as Namecheap, GoDaddy, Cloudflare, or Hostinger

## 2. Domain plan

Use one domain and three subdomains:

- `app.yourbrand.in` for the dashboard on Vercel
- `api.yourbrand.in` for authenticated backend APIs on Railway
- `go.yourbrand.in` for public short-link redirects on Railway

## 3. MongoDB Atlas

Create one cluster and one database user.

Use a database name like:

```text
url_shortener
```

In Network Access, allow Railway to connect. For the first launch, you can temporarily allow access from anywhere, then tighten it after your Railway service is stable.

Copy the connection string. It becomes:

```text
MONGO_URI=mongodb+srv://...
```

## 4. Railway backend

Create a new Railway service from GitHub.

Use these service settings:

- Root Directory: `/backend`
- Config File: `/backend/railway.toml`
- Start Command: leave blank if Railway reads the config file, or set `npm start`
- Healthcheck Path: `/health`

Set these variables:

```text
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/url_shortener?retryWrites=true&w=majority
BASE_URL=https://go.yourbrand.in
APP_BASE_URL=https://app.yourbrand.in
CUSTOM_DOMAIN_CNAME_TARGET=go.yourbrand.in
IP_HASH_SALT=make-this-long-random-and-private
ALLOWED_ORIGINS=https://app.yourbrand.in
RAZORPAY_KEY_ID=rzp_live_or_test_key
RAZORPAY_KEY_SECRET=razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
SUPPORT_EMAIL=founder@yourbrand.in
```

Add these Railway domains to the same backend service:

- `api.yourbrand.in`
- `go.yourbrand.in`

## 5. Vercel frontend

Create a new Vercel project from the same GitHub repo.

Use these project settings:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Set this variable:

```text
VITE_API_BASE_URL=https://api.yourbrand.in
```

Add this Vercel domain:

```text
app.yourbrand.in
```

## 6. Razorpay setup

Start in Razorpay Test Mode.

Create a webhook with this URL:

```text
https://api.yourbrand.in/api/v1/billing/webhooks/razorpay
```

Subscribe to these events:

- `payment_link.paid`
- `payment_link.cancelled`
- `payment_link.expired`
- `payment_link.partially_paid`

Copy the webhook secret into:

```text
RAZORPAY_WEBHOOK_SECRET=...
```

## 7. First live test

Run this checklist after deploy:

1. Open `https://app.yourbrand.in`.
2. Create a new account.
3. Create one short link.
4. Open the generated `https://go.yourbrand.in/...` short link.
5. Confirm the click appears in analytics.
6. Click the Pro plan.
7. Pay through Razorpay Test Mode.
8. Wait a few seconds and click Refresh Billing.
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
CNAME go.customerbrand.in -> go.yourbrand.in
TXT _urlshortener.go.customerbrand.in -> value shown inside the dashboard
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
