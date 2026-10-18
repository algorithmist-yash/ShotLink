# Enable and verify website measurement

This change continues the existing Vercel frontend setup. Cloudflare migration is paused. The source is prepared locally; production analytics and Search Console have not been enabled or verified by this task.

## What is implemented

- Three static, indexable guides: `/google-forms-qr-code`, `/event-qr-codes`, `/expiring-links`. They have distinct content, initial HTML, canonical metadata, homepage/footer links, and sitemap entries. Vercel rewrites precede the short-link proxy and the backend reserves their aliases.
- The homepage presents the link tool before the demonstration dashboard. Creator workspace name is optional; existing backend defaults supply a name. Required consent remains intact.
- Copy now states actual limits: guest links up to 30 minutes; workspace links up to seven days. An expired route does not use a fallback or revoke access to the destination.
- Vercel's official Web Analytics package is installed. Collection requires a production build with `VITE_ENABLE_WEB_ANALYTICS=true`; it is off by default and during tests/development.

## Enable in the current Vercel project

1. Open the project's Web Analytics tab and enable it. Confirm the current plan's allowance; custom events may require a supported paid plan. Do not buy an upgrade just to activate this code without checking its value and cost.
2. Add the production environment variable `VITE_ENABLE_WEB_ANALYTICS=true`. Redeploy the frontend, including the existing routing fixes. This is a Vite build-time flag, so changing a runtime environment alone is insufficient.
3. Visit the public homepage and one guide with an ordinary browser. Verify `/_vercel/insights/script.js` loads and page views appear in the account. Source code tests do not establish live ingestion. Ad blockers can suppress measurement.
4. Complete a controlled test registration, email verification and first-link journey. Compare the events below with the actions taken. Keep test activity separate when interpreting early small totals.

The script and ingestion use Vercel's same-origin endpoints; existing CSP permits them. No wildcard script/connect allowance was added. Unknown nested URLs are not rewritten to the SPA, so Vercel's reserved analytics endpoints are not swallowed by a catch-all.

Official instructions: [Vercel Web Analytics setup](https://vercel.com/docs/analytics/quickstart), [custom events](https://vercel.com/docs/analytics/custom-events), [beforeSend configuration](https://vercel.com/docs/analytics/package).

## Metrics and interpretation

| Signal | Meaning |
|---|---|
| Public page view | A view of an allowed public/auth page; authenticated dashboard restores are excluded |
| signup_started | A registration submission attempt, not merely opening the form |
| signup_completed | Registration API succeeded |
| email_verified | Verification API succeeded |
| workspace_link_created | A workspace link was created; not necessarily the user's first link |
| guest_link_created / guest_link_failed | Guest creation API success/failure |
| guest_link_copied | Browser clipboard write succeeded |
| guest_qr_downloaded | Download was initiated; it cannot prove the file was saved |

Events have fixed names and no custom personal properties. Query strings and fragments are removed from analytics page URLs; unknown short-code paths and password-reset pages are excluded. Verification events use a sanitized registration URL. Destination URLs, workspace IDs, form values and action tokens are not attached as custom properties. Vercel still processes its normal request metadata under its service/privacy terms. There are no custom persistent visitor IDs added by Shotlink.

Because query parameters are removed, this implementation does not provide arbitrary UTM campaign attribution. Use available referrer reports and Search Console query/page data. These are aggregate events, not a person-level cohort database; cross-device visits and blocker use can prevent a strict funnel calculation. Actual external short-link clicks remain in Shotlink's separate product analytics.

## Search Console

Use the existing verified property if available. Verify domain ownership through the account's recommended method if not. Submit `https://www.shotlink.in/sitemap.xml` after deployment. Inspect the homepage and all three guide URLs: successful fetch, initial content, indexability, and matching Google-selected canonical. Request indexing when useful; submission does not guarantee indexing or rankings.

Review the last 28 days of search impressions, clicks, query terms and landing pages. Compare those with public visits and registration/verification events. This establishes whether the next problem is discovery, search click-through, registration effort or account activation.

## Remaining work and limits

No rankings or visitor volume is promised by adding pages. Use actual user feedback to improve these guides. First recruit a small group with a real short-lived sharing task, observe where they struggle, and publish genuine examples only with permission. No outreach messages or account changes were sent by this task.

The audit's earlier references to persistent free-workspace routes were too generous: backend validation caps current workspace links at seven days. The new guides and corrected copy reflect the implementation rather than that earlier assumption.
