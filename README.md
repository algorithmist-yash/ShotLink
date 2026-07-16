# Shotlink

Shotlink is a full-stack URL shortener with authenticated workspaces, link expiry, custom aliases,
fallback destinations, click analytics, QR codes, custom domains, and Razorpay-backed billing.

## Stack

- Frontend: React, Vite, qrcode.react
- Backend: Node.js, Express, MongoDB, Mongoose
- Tests: Node's built-in test runner

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
BASE_URL=http://localhost:5000
APP_BASE_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
IP_HASH_SALT=replace_me
TRUST_PROXY_CIDRS=
RAZORPAY_KEY_ID=replace_me
RAZORPAY_KEY_SECRET=replace_me
RAZORPAY_WEBHOOK_SECRET=replace_me
RAZORPAY_PLAN_ID_PRO_MONTHLY=replace_me
RAZORPAY_PLAN_ID_BUSINESS_MONTHLY=replace_me
```

Frontend variables:

```text
VITE_API_BASE_URL=http://localhost:5000
```

## Run Locally

Install dependencies in both apps if needed:

```bash
npm --prefix backend install
npm --prefix frontend install
```

Start the backend:

```bash
npm --prefix backend run dev
```

Start the frontend:

```bash
npm --prefix frontend run dev
```

## Useful Commands

```bash
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

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
- `POST /api/v1/billing/subscriptions`
- `POST /api/v1/billing/subscriptions/cancel`
- `POST /api/v1/billing/webhooks/razorpay`
- `GET /:shortCode`

## Notes

- Link creation requires a signed-in user and required compliance consent fields.
- Direct private/local IP destinations are rejected.
- Health checks also reject hostnames that resolve to private or local network addresses.
- Railway proxy ranges are trusted automatically. On other proxy deployments, set `TRUST_PROXY_CIDRS` to the exact proxy CIDRs; never use a blanket `true` trust setting.
- Keep `.env` files out of version control.
