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
- Billing: Razorpay
- Domains:
  - `app.yourbrand.in`
  - `api.yourbrand.in`
  - `go.yourbrand.in`

## 3. What each domain does

- `app.yourbrand.in` hosts the dashboard
- `api.yourbrand.in` serves authenticated API requests
- `go.yourbrand.in` handles public redirects

This keeps the system cleaner and makes future scaling easier.

## 4. Backend deployment on Railway

Deploy the `backend` folder as a service.

Recommended Railway settings:

- Root Directory: `/backend`
- Config File: `/backend/railway.toml`
- Start Command: `npm start`
- Healthcheck Path: `/health`

Environment variables:

- `PORT=5000`
- `NODE_ENV=production`
- `MONGO_URI=...`
- `BASE_URL=https://go.yourbrand.in`
- `APP_BASE_URL=https://app.yourbrand.in`
- `CUSTOM_DOMAIN_CNAME_TARGET=go.yourbrand.in`
- `IP_HASH_SALT=...`
- `ALLOWED_ORIGINS=https://app.yourbrand.in`
- `RAZORPAY_KEY_ID=...`
- `RAZORPAY_KEY_SECRET=...`
- `RAZORPAY_WEBHOOK_SECRET=...`
- `SUPPORT_EMAIL=...`

After deploy:

- add `api.yourbrand.in` as a custom domain
- add `go.yourbrand.in` as another custom domain

## 5. Frontend deployment on Vercel

Deploy the `frontend` folder as a Vite project.

Recommended Vercel settings:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

Environment variable:

- `VITE_API_BASE_URL=https://api.yourbrand.in`

After deploy:

- add `app.yourbrand.in` as a custom domain

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
- backend creates a Razorpay Payment Link
- user pays on Razorpay hosted page
- Razorpay webhook calls your backend
- backend upgrades the workspace plan automatically

Webhook URL:

- `https://api.yourbrand.in/api/v1/billing/webhooks/razorpay`

Webhook events:

- `payment_link.paid`
- `payment_link.cancelled`
- `payment_link.expired`
- `payment_link.partially_paid`

## 7.1. Branded customer domain setup

For each customer branded domain:

1. Add the customer hostname to the Railway backend service as a custom domain.
2. Ask the customer to create `CNAME go.customerbrand.in -> go.yourbrand.in`.
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
