# Contributing

## Development setup

Use Node.js 24.18.0 from `.nvmrc`, then install reproducibly from the lockfiles:

```bash
nvm use
npm --prefix backend ci
npm --prefix frontend ci
```

Copy environment examples locally and never commit real credentials or `.env` files.

## Required checks

Run these before opening a pull request:

```bash
npm --prefix backend run check
npm --prefix backend run test:coverage
npm --prefix backend run test:integration
npm --prefix backend run test:coverage:controllers
npm --prefix backend run test:contracts
npm --prefix backend run test:load
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

The integration suite uses an isolated disposable MongoDB replica set and must
remain independent of developer databases, production credentials, and public
network availability.

Install the pinned browser once with `npm --prefix frontend run
test:e2e:install`. The Playwright suite uses the same disposable MongoDB test
stack and must remain deterministic, browser-realistic, and free of production
or developer data.

The load smoke test is a local regression gate, not production capacity proof.
Run `performance/shotlink.k6.js` against an approved staging deployment before a
release that changes redirect, database, cache, or queue behavior.

## Change discipline

- Keep each pull request focused on one problem or a tightly related set of changes.
- Preserve API compatibility unless the pull request explicitly documents a versioned breaking change.
- Add or update tests for behavior changes and regression fixes.
- Do not weaken authentication, authorization, validation, rate limiting, health checks, or security headers to make a test pass.
- Document new environment variables in the examples and deployment runbooks.
- Include a forward migration and rollback plan for database schema or index changes.
- Do not log request bodies, credentials, tokens, payment data, or unnecessary personal data.
- Include accessibility and responsive checks for user-interface changes.

Report security defects privately according to `SECURITY.md`.
