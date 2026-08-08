# Performance and Capacity SLOs

These objectives are release gates, not guarantees from local measurements.

## Service-level objectives

- Public redirects: monthly availability at least 99.95%, p95 server latency below 250 ms, and p99 below 750 ms.
- Authenticated API: monthly availability at least 99.9% and p95 server latency below 500 ms, excluding third-party billing calls.
- Error budget: non-user-caused 5xx responses below 0.5% over 30 days.
- Queue freshness: 99% of redirect analytics jobs complete within 60 seconds; no dead job remains uninvestigated for more than 24 hours.
- Recovery: RPO at most 15 minutes and RTO at most 2 hours after the provider configuration and restore drill are proven.

## Verification

Run the deterministic pre-merge smoke gate:

```powershell
npm.cmd --prefix backend run test:load
```

Run the production-like capacity scenario against a dedicated non-production environment with a seeded, disposable link:

```powershell
k6 run -e BASE_URL=https://staging-api.example.com -e TEST_SHORT_CODE=load-test -e REQUEST_RATE=100 performance/shotlink.k6.js
```

Increase arrival rate in controlled stages until a threshold fails. Record the tested deployment revision, infrastructure size, database tier, Redis tier, traffic profile, p95/p99 latency, error rate, queue lag, CPU, memory, and database utilization. Never load-test production redirects without an approved traffic window and a non-customer link.

The CI smoke gate detects severe regressions. Only the staged k6 scenario establishes real capacity because local MongoDB and CI runners do not match production infrastructure.
