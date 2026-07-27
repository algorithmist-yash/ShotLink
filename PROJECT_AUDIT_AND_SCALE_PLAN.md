# Shotlink Project Audit and Scale Plan

## 1. Executive Summary

This repository is a good MVP for demonstrating the basic Shotlink flow:

- create a short link
- redirect to the original URL
- track aggregate click count
- support expiry
- manually disable a link
- show a small frontend dashboard

It is not yet production-ready for a startup-scale product. The current implementation is best described as a portfolio/demo application, not a service that can safely support large-scale traffic, customer analytics, or enterprise reliability.

The biggest product opportunity in your idea is not "just another shortener". It is:

- reliable redirection with fallback behavior
- actionable analytics per click, not only a total counter
- India-focused reliability, affordability, and distribution
- B2B/B2C link infrastructure for creators, sellers, campaigns, WhatsApp sharing, and SMB growth funnels

## 2. Current Architecture

### Frontend

- React + Vite single-page UI
- Mostly one-component implementation in `frontend/src/App.jsx`
- Inline styles, no reusable design system
- QR generation and basic analytics display

### Backend

- Node.js + Express
- MongoDB via Mongoose
- Single route module and mostly single controller file
- Short link persistence in one `Url` collection

### Current Data Model

The `Url` model currently stores:

- `originalUrl`
- `shortCode`
- `clicks`
- `expiresAt`
- `isActive`
- timestamps

This is enough for aggregate reporting, but not enough for per-click analytics, fallback routing, abuse detection, or customer-level reporting.

## 3. Codebase Findings

### What already works

- Basic short URL creation exists in [backend/src/controllers/urlController.js](/C:/Users/KIIT0001/Documents/Codex/2026-04-26/https-github-com-algorithmist-yash-url/backend/src/controllers/urlController.js:6)
- Redirect flow exists in [backend/src/controllers/urlController.js](/C:/Users/KIIT0001/Documents/Codex/2026-04-26/https-github-com-algorithmist-yash-url/backend/src/controllers/urlController.js:44)
- Aggregate click count exists in [backend/src/models/Url.js](/C:/Users/KIIT0001/Documents/Codex/2026-04-26/https-github-com-algorithmist-yash-url/backend/src/models/Url.js:7)
- Analytics endpoint exists in [backend/src/controllers/urlController.js](/C:/Users/KIIT0001/Documents/Codex/2026-04-26/https-github-com-algorithmist-yash-url/backend/src/controllers/urlController.js:61)
- Manual expiration exists in [backend/src/controllers/urlController.js](/C:/Users/KIIT0001/Documents/Codex/2026-04-26/https-github-com-algorithmist-yash-url/backend/src/controllers/urlController.js:80)
- UI creates links and fetches analytics in [frontend/src/App.jsx](/C:/Users/KIIT0001/Documents/Codex/2026-04-26/https-github-com-algorithmist-yash-url/frontend/src/App.jsx:48)

### Core technical weaknesses

1. No URL validation

- `originalUrl` is only checked for presence, not format.
- Bad URLs can enter the database and break redirect behavior.

2. Click analytics are too shallow

- Redirect only increments `clicks` and saves the `Url` document.
- There is no storage for click timestamp, device type, IP hash, referrer, browser, OS, country, or bot classification.

3. Redirect path is synchronous and tightly coupled to MongoDB writes

- Every redirect updates the primary document directly.
- At scale, redirect latency and write contention will increase.

4. No fallback / alternative URL strategy

- If the primary destination is down, the product currently returns the original URL anyway and hopes the target works.
- Your idea of "provide alternatives to the URLs which have issues from server ends" does not exist yet.

5. No user or tenant model

- No accounts, teams, organizations, API keys, plans, billing, roles, or ownership.
- This prevents SaaS growth.

6. No security controls

- No authentication
- No authorization
- No rate limiting
- No abuse prevention
- No suspicious-domain checks
- No admin moderation

7. No production-grade observability

- No structured logging
- No metrics
- No tracing
- No alerting
- No audit trail

8. No test coverage

- There are no unit tests, integration tests, redirect behavior tests, or load tests.

9. Repository structure is inconsistent

- There is an `app.js` and a `server.js`, but `server.js` recreates app bootstrapping instead of importing `app.js`.
- There is also a separate `analyticsController.js`, but routing uses `getAnalytics` from `urlController.js`, so the extra controller appears unused and creates drift risk.
- Root `package.json` mirrors backend dependencies and scripts, which is confusing for deployment and onboarding.

10. Frontend is MVP-only

- All UI logic is in one file.
- No routing, no state architecture, no component library, no design system, no accessibility pass, no authenticated dashboard flows.

## 4. Important Product Reality Check

You already have "count clicks", but only as a single integer. That is not enough for a competitive analytics product.

To make analytics useful, each click event should capture at least:

- `urlId`
- `shortCode`
- `clickedAt`
- `deviceType` such as `mobile`, `desktop`, `tablet`, `bot`
- `os`
- `browser`
- `referrer`
- `country`
- `region`
- `city` if privacy policy allows
- `ipHash` instead of raw IP for privacy
- `userAgent`
- `isBot`
- `responseStatus`
- `redirectTargetUsed`

## 5. Feature Design for Your Requested Ideas

### A. Count clicks with time and device type

Recommended design:

- Keep `Url.clicks` as a fast aggregate counter.
- Add a `ClickEvent` collection for event-level analytics.
- Record event asynchronously so redirect remains fast.

Suggested collections:

#### `urls`

- `_id`
- `workspaceId`
- `originalUrl`
- `fallbackUrls[]`
- `shortCode`
- `status`
- `expiresAt`
- `isActive`
- `clicks`
- `lastClickedAt`
- `createdBy`
- `tags[]`
- timestamps

#### `click_events`

- `_id`
- `urlId`
- `shortCode`
- `clickedAt`
- `deviceType`
- `browser`
- `os`
- `userAgent`
- `referrer`
- `ipHash`
- `countryCode`
- `region`
- `city`
- `isBot`
- `redirectStatus`
- `redirectTarget`
- `latencyMs`

Indexes:

- `urlId + clickedAt`
- `shortCode + clickedAt`
- `clickedAt`
- `countryCode + clickedAt` if geo reporting is needed

### B. Provide alternative URLs when the primary target has server issues

This feature can become a real differentiator if done carefully.

Recommended behavior:

1. User creates a short URL with:
- one primary destination
- zero or more fallback destinations

2. Redirect service checks health policy:
- passive failures from prior recent redirects
- optional active health checks run by background workers

3. If primary is marked unhealthy:
- route to best healthy fallback
- log which target was chosen
- expose this in analytics and alerts

4. If all targets are unhealthy:
- show branded interstitial page with retry, mirror links, and contact CTA

Important warning:

Do not perform a fresh server-side health check during every user redirect. That would make redirects slow and fragile. Health checks should be background-driven and cached.

Suggested extra collection:

#### `target_health_snapshots`

- `_id`
- `urlId`
- `targetUrl`
- `status`
- `httpStatus`
- `checkedAt`
- `latencyMs`
- `failureReason`
- `consecutiveFailures`

## 6. Production HLD

### Phase 1: Strong MVP

- React web app
- Node.js API
- MongoDB
- Redis for caching and counters
- Background worker for click event ingestion and health checks
- Object storage for exports if needed

### HLD Components

1. Web App
- public landing pages
- authenticated dashboard
- analytics pages

2. API Gateway / Backend API
- auth
- link CRUD
- analytics queries
- account and billing endpoints

3. Redirect Service
- ultra-fast path for `GET /:shortCode`
- cache-first lookup
- async event publishing

4. Click Event Pipeline
- queue or stream
- worker enrichment for geo/device parsing
- writes to analytics store

5. Health Check Service
- periodic checks for primary and fallback URLs
- target ranking

6. Data Stores
- PostgreSQL for accounts, billing, plans, workspaces, entitlements
- Redis for cache, rate limits, hot counters, short-code resolution
- MongoDB or ClickHouse for high-volume event analytics

### HLD Recommendation

If you are serious about building a startup product, the best medium-term architecture is:

- PostgreSQL for transactional business data
- Redis for redirect cache and rate limiting
- ClickHouse for analytics events at scale

MongoDB is okay for the current MVP, but it is not the best long-term single database for both SaaS transactions and high-volume event analytics.

## 7. Production LLD

### Redirect flow

1. Client hits `GET /:shortCode`
2. Redirect service checks Redis cache for short-code mapping
3. If cache miss, load from primary DB and backfill cache
4. Validate:
- link exists
- link active
- not expired
- not blocked

5. Choose target:
- primary if healthy
- else highest-priority healthy fallback
- else interstitial failure page

6. Respond with `302` or `307`
7. Publish click event to queue
8. Increment aggregate counter asynchronously

### URL creation flow

1. Validate URL and ownership context
2. Generate collision-safe short code
3. Store primary and fallback targets
4. Cache short-code resolution in Redis
5. Enqueue initial health checks

### Analytics flow

1. Redirect publishes raw click event
2. Worker enriches device and geo metadata
3. Worker writes event into analytics store
4. Aggregation jobs build hourly/daily summaries
5. Dashboard reads mostly from summaries, with drill-down to raw events

## 8. API Design Recommendation

### Public / redirect

- `GET /:shortCode`

### Link management

- `POST /api/v1/links`
- `GET /api/v1/links/:id`
- `PATCH /api/v1/links/:id`
- `DELETE /api/v1/links/:id`
- `POST /api/v1/links/:id/expire`

### Analytics

- `GET /api/v1/links/:id/analytics/summary`
- `GET /api/v1/links/:id/analytics/events`
- `GET /api/v1/links/:id/analytics/devices`
- `GET /api/v1/links/:id/analytics/timeseries`
- `GET /api/v1/links/:id/analytics/referrers`

### Health / fallbacks

- `POST /api/v1/links/:id/fallbacks`
- `PATCH /api/v1/links/:id/fallbacks/:fallbackId`
- `GET /api/v1/links/:id/health`

## 9. Security and Compliance Requirements

Before launch, add:

- JWT or session auth
- hashed API keys
- rate limiting per IP, user, and workspace
- bot filtering
- malicious URL validation
- DNS / domain allow-block lists
- CSRF protection if cookie auth is used
- input schema validation
- secrets management
- HTTPS everywhere
- audit logs

For India-focused growth, also think early about:

- privacy policy
- consent language for analytics cookies where applicable
- data retention policy
- legal handling of abusive / phishing links

## 10. Scale Strategy for Exponential User Growth

### Stage 0: Demo to early beta

- single API service
- MongoDB
- no queue yet
- simple click event collection

Target:

- up to low thousands of daily active users

### Stage 1: Production beta

- separate redirect service from dashboard API
- Redis cache
- background worker
- event queue
- managed observability

Target:

- tens of thousands of DAU
- traffic spikes from campaigns and social sharing

### Stage 2: Startup growth

- multi-region CDN + edge redirects
- read-heavy redirect tier
- analytics pipeline with ClickHouse
- customer workspaces, billing, APIs, branded domains

Target:

- hundreds of thousands to millions of daily redirects

### Stage 3: Serious market attack

- edge key-value resolution
- active-active regional routing
- event streaming
- plan-based SLAs
- branded enterprise link infrastructure

Target:

- national-scale campaign traffic
- agency and creator ecosystems

## 11. India Market Strategy

To beat TinyURL in India, do not compete only on "short URL". Compete on local use cases:

- WhatsApp-first sharing for sellers and creators
- fast mobile analytics
- QR campaigns for offline-to-online businesses
- multilingual landing/interstitial support
- affordable plans in INR
- strong uptime for campaign links
- branded domains for D2C brands, coaching centers, events, and influencers

Best early customer segments:

- Instagram and YouTube creators
- small e-commerce sellers
- education/coaching businesses
- local agencies
- events and wedding planners
- real estate lead funnels
- restaurants and cafes using QR promotions

## 12. Recommended Monetization

### Free

- limited links
- limited analytics retention
- basic QR

### Pro

- custom aliases
- advanced analytics
- fallback routing
- branded domain
- longer retention

### Business

- team seats
- API access
- campaign dashboards
- exports
- SLA support

### Enterprise

- dedicated domains
- compliance options
- SSO
- custom retention
- higher redirect throughput

## 13. Concrete Engineering Roadmap

### Sprint 1

- Refactor backend structure
- add request validation
- normalize app/server bootstrapping
- add tests for create, redirect, expire, analytics

### Sprint 2

- add `ClickEvent` model
- capture timestamp, user agent, device type
- split aggregate analytics from event analytics

### Sprint 3

- add fallback URL model and health policy
- background worker for health checks
- fallback-aware redirect engine

### Sprint 4

- auth, workspaces, ownership
- dashboard redesign
- filtering and time-series analytics

### Sprint 5

- Redis cache
- queue-based event ingestion
- rate limiting
- observability

### Sprint 6

- custom domains
- billing
- API keys
- production deployment and load testing

## 14. Priority Technical Changes in This Repo

The first changes I would make in this exact codebase are:

1. Replace duplicate backend entry patterns so `server.js` imports `app.js`
2. Remove or merge the unused `analyticsController.js`
3. Add schema validation for request bodies
4. Add `ClickEvent` storage with device/time capture
5. Add `fallbackUrls` to the `Url` model
6. Move redirect analytics writes off the critical path
7. Add tests
8. Split frontend into components and dashboard views

## 15. Final Recommendation

Your idea is viable if you position it as a reliable link infrastructure and analytics product, not only a Shotlink.

The smartest build order is:

1. make the current MVP technically solid
2. add per-click analytics
3. add fallback routing and health-aware redirects
4. add auth, workspaces, and billing
5. harden for production scale

If we continue from here, the best next implementation step is to build the first real backend upgrade:

- event-level click tracking with timestamp and device type
- fallback URL support in the data model and APIs
- a cleaned-up backend structure that can evolve into the larger architecture above
