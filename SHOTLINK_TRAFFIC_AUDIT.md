# Shotlink traffic and conversion audit

Completed 15 September 2026. Initial live observations were collected during the preceding session; homepage and authentication-route HTTP checks were repeated on resumption.

## Main conclusion

Shotlink has working public infrastructure and an accessible search result, but little dedicated content for acquiring search traffic. Its homepage emphasizes internal product categories instead of a clear task visitors want to complete. Separately, production authentication routes are broken and the signup flow requires substantial effort. These can damage activation and repeat usage even if people visit.

Actual traffic volume and the relative contribution of each problem cannot be established without Search Console, acquisition analytics, and signup/activation counts. No claim of zero visits, a Google penalty, zero backlinks, or a specific ranking is justified by this audit.

## Scope and verification

- Read local frontend, marketing components, routing, metadata, sitemap, robots rules, API client, session loading, email links, billing configuration, and deployment configuration.
- Inspected public search results, live homepage and registration UI, public HTTP responses, deployed JavaScript assets, API health, CORS, and checkout status.
- Built the existing frontend successfully using `node node_modules/vite/bin/vite.js build --configLoader runner` and opened its local production preview on port 4175. The system npm launcher was broken; invoking Vite directly succeeded. The policy-generation prebuild step was not rerun.
- Local preview rendered the marketing page. This was a frontend smoke check, not a full local database-backed end-to-end test.
- No production account was created, emails sent, payment attempted, or production configuration modified. No real-user performance dataset, Search Console account, backlink database, or private analytics was available.
- A mobile viewport screenshot was attempted, but its presentation was insufficient for a reliable mobile-layout verdict. No mobile pass or fail is asserted.

## 1. Production account-action routes return 404 — critical activation defect

Direct requests to these URLs return HTTP 404 with `Short URL not found`:

- https://www.shotlink.in/verify-email
- https://www.shotlink.in/reset-password
- https://www.shotlink.in/forgot-password

`frontend/vercel.json` explicitly rewrites login and registration to the application, then sends single-segment paths matching `[A-Za-z0-9_-]{3,48}` to the short-link backend. All three action paths match that rule and have no preceding application rewrite.

`backend/src/services/emailService.js` constructs verification and reset links with these paths. Tokens are in the fragment; a fragment does not change server routing. `frontend/src/App.jsx` disables workspace link creation without email verification, and backend authentication middleware also checks verification.

Impact: if production emails use this public application host, newly registered users cannot reach the verification UI from their email. Password recovery also fails on direct navigation. The actual production APP_BASE_URL and email delivery were not inspected, so the precise email-host dependency remains to verify.

Fix: add explicit application rewrites for all authentication-action routes before the short-code rewrite. Reserve application paths against short-code collisions. Verify fresh navigation and reload on deployed routes, then test a real verification and password-recovery journey with a test account. Local Vite SPA fallback alone will not catch this Vercel defect.

This explains lost activations, not a lack of initial homepage visits.

## 2. Visitor measurement is unverified

No GA4, Google Tag Manager, Plausible, PostHog, Clarity, or Vercel Analytics integration was found in the inspected frontend source or deployed homepage assets. Hosting-side or externally configured measurement may still exist.

Shotlink's product dashboard counts visits to a selected short link. It is not a count of people visiting the marketing homepage. Its zero-click value cannot establish zero website visitors. The 12.8K figure in the homepage campaign preview is hardcoded demonstration content, not account traffic.

Set up or verify three separate measurements:

1. Search discovery: Search Console impressions, clicks, queries, landing pages, indexed URLs, and selected canonicals.
2. Marketing acquisition: human sessions by source/medium, landing page, device, and campaign.
3. Product activation: signup started, signup completed, email verified, first link created, first external link click, and returning active workspaces.

Choose a measurement provider before implementing tracking. The current Content Security Policy permits scripts from self and API connections to the Shotlink API; a third-party analytics installation needs narrowly scoped CSP adjustments. Do not send destination URLs, email tokens, or personal data as generic event properties.

## 3. Search landing-page coverage is small

The sitemap has nine URLs: home, pricing, docs, trust, terms, privacy, shipping, refunds, and contact. Most are support, commercial, or policy pages. There are no dedicated acquisition pages for the main use cases in this repository. Creators and institutions are fragment sections of one homepage, not separate indexable landing pages.

The title and H1 emphasize workspaces and audience categories. They do not immediately explain the core task as directly as “Free URL shortener and QR code generator.” A prospective user is more likely to describe a task than search for Shotlink's internal product vocabulary. This is a positioning inference; keyword demand was not quantified.

Candidate pages to validate with search data and user interviews:

- URL shortener with QR codes.
- Google Forms short links and QR sharing.
- Links for college events and official notices.
- Expiring links and fallback destinations.
- Creator campaign tracking.

Publish useful, distinct pages with a working example, actual supported features, screenshots, limitations, and relevant internal links. Avoid many near-duplicate keyword pages. Add explicit route handling before the short-code catch-all, unique server-delivered metadata, and sitemap entries for the chosen canonical URLs.

Public searches surfaced the homepage but did not establish broad visibility for acquisition terms. Search-result sampling is not a complete Google index audit or a backlink count.

## 4. Canonical signals disagree

Observed: `https://shotlink.in/` returns a temporary 307 redirect to `https://www.shotlink.in/`. The www page declares `https://shotlink.in/` as canonical. Sitemap URLs and metadata generation also use the apex host.

This creates conflicting preferred-host signals. It does not prove that Google cannot index the site. Choose either hostname, use a permanent 301/308 redirect from the alternative, and align HTML canonicals, sitemap URLs, Open Graph URLs, and internal links. Inspect Google's selected canonical in Search Console afterward.

Google documents redirects, sitemap membership, and canonical annotations as canonicalization signals: [Google canonicalization guidance](https://developers.google.com/search/docs/crawling-indexing/canonicalization).

## 5. Unknown nested paths return the homepage with HTTP 200

The sampled `/nonexistent-audit-page/test` returned the homepage with status 200. The final catch-all rewrite routes unknown nested URLs to the application, which defaults to home.

This creates a soft-404 risk and confusing invalid-link behavior. Return real 404s for unknown public content while explicitly supporting legitimate application routes and real short links. See [Google JavaScript troubleshooting](https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript).

## 6. Public content waits for authentication

`frontend/src/main.jsx` hides the static HTML shell when JavaScript starts. `frontend/src/App.jsx` initially renders a loading screen, awaits `/api/v1/auth/me`, and only afterward shows the public page to a logged-out visitor. `apiClient.js` has no explicit fetch timeout.

The live audit browser displayed the loading screen across observations but eventually rendered the homepage and registration page. This is not evidence of a permanent outage or a measured Core Web Vitals failure. Direct API checks returned a normal unauthenticated 401, and CORS allowed the www origin. API health reported MongoDB and Redis connected.

Render marketing content independently of session restoration; bound session-request delays and load account-only code when needed. Preserve useful initial HTML until the public interface is ready.

The local build emits about 331 KB of main JavaScript before compression (97 KB gzip), plus QR and React chunks, and roughly 73 KB CSS (14 KB gzip). Ten font weights across two families are imported. These are optimization opportunities, not proof that speed is the primary traffic bottleneck. Measure mobile LCP, INP, CLS and real user data before claiming performance impact.

## 7. Homepage clarity and product fit

The desktop design has a clear visual identity. The main issue is the hierarchy of information: a large workspace explanation and campaign mockup precede the useful input. Creators and institutions have different needs, trust requirements, and buying processes.

Suggested experiment: lead with a simple task-based heading, place the URL field near the top, explain free-account limits alongside it, and offer distinct creator and institution journeys. Example heading: “Shorten links. Create QR codes. Track clicks.” State that anonymous links expire within 30 minutes and that a free account supports longer-lived use where the product allows it.

Thirty-minute anonymous links are useful for disposable sharing, but poorly matched to printed posters, packaging, portfolios, and campaigns that last days or weeks. The default is 15 minutes. Keep temporary sharing as an explicit use case and make the durable free-account route easy to understand. Do not imply that all persistent links require payment when a free workspace is available.

## 8. Registration friction and trust

The inspected signup screen requests name, email, password, workspace type, workspace name, five required acknowledgements, and an optional marketing choice. Email verification follows before workspace link creation.

This is substantial effort before first value. Measure abandonment by stage, consider deferring optional workspace setup, and simplify repetitive explanation while retaining necessary informed consent. Do not assume particular consent controls are legally unnecessary.

The campaign mockup contains a fixed 12.8K click count and an app subdomain label. Label sample data clearly. The reviewed homepage does not offer substantiated customer case studies or named customer results. Demonstrate real supported workflows, then add genuine proof with permission.

## 9. Deployed product claims differ from local copy

The live JavaScript contains Studio claims about team workspaces and campaign exports. Local marketing copy has been revised to list higher domain and QR limits, and its FAQ explicitly says multi-user invitations and downloadable exports are not enabled.

This confirms a content mismatch between deployed assets and the local build. It does not establish which Git commit is deployed. Check deployment provenance and synchronize truthful feature descriptions across homepage, static fallback HTML, pricing, FAQ, and onboarding. The static homepage still includes team/export claims even where React copy was revised.

The public billing API reports checkout disabled and Razorpay test mode. Pricing cards and subscription language can therefore promise a next step visitors cannot complete. Present paid availability consistently and use an honest interest/onboarding action while unavailable. This affects purchase conversion, not initial discovery.

## 10. Acquisition strategy

Generic URL shortening has established alternatives; [Bitly](https://bitly.com/) already presents shortening, QR codes, and related tools. Feature presence alone is unlikely to be a compelling switching reason. This audit did not establish that Shotlink lacks promotion or backlinks; no campaign history was supplied.

Pick one initial segment where the founder can reach users and observe a real workflow. College event teams or departments are a plausible starting hypothesis given the institution feature set; validate this against creator users rather than assuming demand.

Suggested experiment: recruit 5–10 relevant pilot users, observe a complete sharing task, record first-link success and seven-day return usage, and document one substantiated result. Publish helpful demonstrations in communities where such posts are welcome. Tag acquisition links and compare activated workspaces by source. Short-link redirect traffic does not automatically become marketing-page traffic because visitors are forwarded to the destination.

## Prioritized action plan

| Order | Action | Acceptance evidence |
|---|---|---|
| 1 | Fix deployed authentication routing | Direct email-verification and reset URLs reach the correct UI; complete test-account activation |
| 2 | Verify measurement | Known test visit and each activation event appear in the right reports |
| 3 | Decouple public rendering from session checks | Homepage stays useful when the auth API is slow or unavailable |
| 4 | Align canonical host and invalid-path handling | Permanent host redirect, matching canonicals/sitemap, real unknown-page 404s |
| 5 | Align claims and simplify first use | Accurate paid availability, clear temporary/free-account distinction, measured signup funnel |
| 6 | Create a few useful acquisition pages | Distinct public pages with server metadata, crawlable links, and validated user intent |
| 7 | Run focused distribution pilots | Track qualified visits, activation, first real clicks, and returning users by source |

For the first week, prioritize functionality and measurement. During the following weeks, test clearer messaging, a small set of useful pages, and focused user recruitment. These are experiments, not a promised traffic timeline. Structured data, image tuning, or a cosmetic redesign should not displace activation fixes and acquisition work.

## Data needed to settle the traffic diagnosis

Provide the last 28 days of Search Console clicks/impressions, acquisition sessions, and counts of registrations, verified accounts, and first links created, plus launch date and promotion history. High impressions with few clicks points toward rankings/snippets; few impressions points toward discovery/indexing/demand; visits without registration points toward relevance or friction; registrations without verification points toward activation. These are diagnostic starting points, not mutually exclusive causes.
