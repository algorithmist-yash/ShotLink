# Shotlink preview audit — 30 September 2026

## Main conclusion

The most urgent problem is a real creator-dashboard layout defect, followed by a mismatch between a quick-link task and the amount of interface presented before that task. The product has useful working foundations, but currently asks new users to understand too much before receiving value. Link lifetime and paid-feature promises also need to match the intended use cases.

This is a heuristic audit with browser observations and source inspection, not a study of actual users. Attention, abandonment, willingness to pay, and conversion effects below are hypotheses to validate. No claim that these issues explain all missing traffic is justified without acquisition data.

## Scope and limits

- Inspected the local frontend with an isolated in-memory test database at localhost:4173 and localhost:5001.
- Browser inspection covered desktop 1366×768 and mobile 390×844: homepage, temporary-link result, pricing, registration, sign-in, password-recovery form, creator dashboard, institution dashboard, support, trust, documentation, and the Google Forms guide.
- Created disposable creator/institution fixtures; signed into both. Guest link creation and creator link creation succeeded. Creator creation succeeded after switching to mobile layout; the collapsed desktop form was not reliably operable.
- Inspected link library, analytics empty/populated states, Social Publisher controls, domain gates, billing, and operator guide. Did not publish social posts, change real DNS, submit a real payment, or create production accounts.
- Test harness auto-verifies email and simulates destination health. Those operations are not evidence of working real email delivery or health probes.
- Other policy/guide pages share templates and received source review; they were not each exhaustively interaction-tested. Actual email delivery, paid accounts, live subscriptions, long-term retention, production performance, screen-reader behavior, and every error branch remain unverified.
- The local branch already contains earlier unpublished changes. This report is about that preview, not a claim that production has the same version.

## Confirmed defects and immediate corrections

| ID | Finding and evidence | Impact | Correction/status |
|---|---|---|---|
| B1 | At 1366px the creator builder measured about 109px wide. Computed grid columns were `0px 360px 0px 925.2px`. `index.css` overrode the correct inline grid but omitted the `social` area. Institution builder was about 709px. | Creator publishing controls clip into a narrow strip; much of the screen becomes empty. | Added the missing desktop `social social` row. Verified creator width about 709px at 1366, 985px at 1024, and 351px at 390; desktop link creation succeeded. |
| B2 | Builder helper text retained dark inline colors such as RGB(71,85,105) and RGB(63,75,95) on the dark panel. | Limits, instructions and policy explanations are difficult to read. | Added scoped high-contrast helper/consent styles without changing the light result card. |
| B3 | A functioning new Free workspace is labeled `Inactive` in the header, overview and billing. | Users can reasonably infer that signup failed or the account requires activation/payment. | Free accounts without a subscription now say `Free plan · no subscription`; pending/paid states remain distinct. |
| B4 | At 390px the explicit `Campaign preview · sample data` label is hidden by CSS while sample click counts remain. | Demo numbers may be mistaken for actual usage evidence. | Kept the sample-data label on mobile and hid the redundant campaign indicator instead. |
| B5 | Billing says monthly quotas reset with the billing cycle; backend keys usage by UTC calendar month. | Customers may misunderstand when capacity returns. | Corrected copy to the first day of the month, with active-link/domain limits distinguished. |
| B6 | Dashboard copy action awaits the clipboard without catching rejection. Guest copy already has a fallback. | A blocked clipboard gives no useful recovery in the dashboard. | Added a manual-copy error message. |
| B7 | Paid feature lists promise editable destinations; link routes expose create/read/expire/health-check but no destination-edit workflow. Static pricing also promises team capacity/exports beyond available UI. | Paying users may expect capabilities they cannot use. | Removed editable-destination and static export/team promises from the audited feature lists. Broader product copy still needs periodic consistency review. |
| B8 | Public API example omits the required link compliance object. | Following the example produces a validation failure. | Added the required fields; replaced webhook jargon in billing help with a user action. Authentication/token acquisition still needs fuller documentation. |
| B9 | Active navigation button is white-on-dark at the parent, but its child label retains RGB(51,65,85). | The selected task is difficult to read. | Child labels now inherit the button color; verified white text in preview. |
| B10 | Section navigation uses a fixed 94px scroll margin while two sticky bars cover about 184px. | Section titles are partially hidden after navigation. | Scrolling now measures sticky elements, adds spacing and respects reduced motion. Verified section top about 198px below a navigation bottom of 184px. |

Evidence locations: `frontend/src/index.css` (desktop dashboard grid and builder colors), `frontend/src/styles.js` (inline grid), `frontend/src/App.jsx` (status, copy, docs, billing), `frontend/src/components/PublicMarketing.css` (mobile preview label), `backend/src/routes/linkRoutes.js`, `backend/src/services/usageServiceHelpers.js`, and `backend/src/config/billingPlans.js`.

## Attention and first impression

**Observed:** At 1366×768, the homepage URL field begins approximately 993px down the document. Homepage height was approximately 11,419px. At 390×844, the field begins approximately 1,268px down and the page is approximately 18,539px tall. These are local-layout measurements, not performance measurements.

**Interpretation:** The headline now explains the basic utility clearly, but the next action competes with workspace creation, comparisons, segmentation, and a large visual presentation. A visitor arriving to shorten a URL must scroll or follow an anchor before entering anything. Repeated campaign/workspace language makes a simple tool sound more involved.

**Recommended change:** Put destination entry, clear expiry, and one primary create action in the first useful screen. Follow the result with a relevant invitation to save/manage links. Move creator/institution detail and long feature explanations to focused pages. Do not remove the actual expiry warning to make the page appear simpler.

**Acceptance:** In a short unprompted test, users can explain the product, locate the input, and predict when their link will stop working. Measure successful creation and copy/QR download, not merely hero-button clicks.

## Product fit and useful lifetime

**Observed:** Guest expiry is 5–30 minutes; workspace form defaults to 30 minutes and offers at most seven days. Backend clamps workspace expiry to seven days. Marketing names portfolios, packaging, campaigns, university resources and printed QR codes.

**Risk:** Many of those jobs need longer-lived routes. Unexpected expiry can damage trust after the user has distributed a link or printed a QR. Better visual design cannot solve a service that expires before the task ends.

**Decision needed:** Either focus positioning on temporary sharing or implement durable links with an explicit retention/abuse policy. Until then, keep the limits visible in pricing, creation and export. Choose defaults based on the declared use case; show the exact expiry date/time before creation and beside the QR download.

## Registration and authentication

**Observed:** Registration has name, email, password, workspace choice/name, five required consent choices and one optional marketing checkbox. On desktop the submit button was around 1,382px down a 1,722px document. There are no policy links inside the form; the documents are in the footer. Password fields have autocomplete hints, which is helpful. Recovery is discoverable from sign-in.

**Interpretation:** Users are asked for considerable commitment before seeing a saved-link benefit. A large decorative preview competes with the form. Policy text is harder to inspect at the moment of agreement.

**Recommended change:** Add policy links beside the relevant checkbox text, clear password requirements and a show-password control. Keep optional marketing separate and unchecked. Consider asking workspace details after basic account creation. Any consolidation of required acknowledgments needs a deliberate policy review; do not silently precheck or remove them. Carry the guest's destination forward when they choose signup, with a clear explanation of what will be saved.

**Verify separately:** Real verification email delivery, resend throttling, expired/reused tokens, reset-email delivery, session expiry and recovery after opening email links in another browser.

## Creator dashboard

**Observed:** A large welcome banner and four overview cards occupy most of the opening desktop screen. Creation, analytics, library, Social Publisher, domains and billing live in one long document. The form begins with domain/expiry and template fields before the destination. The default type is Video, even for an ordinary website. Free accounts display zero domain/API allowances. Analytics overview describes selected-link telemetry rather than all workspace clicks.

**Recommended change:** Make destination the first input. Put alias, templates, domain and fallback choices behind a clearly labeled optional section. Use a compact welcome/usage strip. Show a concise first-link empty state; progressively introduce analytics once a link exists. Label selected-link metrics explicitly so they are not mistaken for workspace totals. A task-oriented navigation structure should preserve draft input when switching sections.

**Success state:** Place copied link, QR download, expiry and destination together. Include a test-link action and a next step. Preserve user input on errors and explain duplicate-alias recovery. Avoid turning every empty panel into an upgrade advertisement.

## Institution dashboard

**Observed:** The desktop grid did not show the creator collapse because it has no Social Publisher. It uses a distinct blue theme and structured resource fields. Domain governance is gated by the Institution plan; onboarding is via email. The header still says Create link while navigation says Publish resource. Free institution accounts expose many disabled governance controls.

**Recommended change:** Use consistent publishing terminology and explain which controls are available now versus activated through onboarding. Present a concrete onboarding sequence: contact, ownership verification, activation, supported provisioning process. Do not imply self-service invitations or automated resource discovery when unavailable. Default expiry needs particular care for semester resources and official notices.

## Pricing, payment and trust

**Observed:** Public marketing, static HTML, runtime pricing, legal copy and backend plan definitions have separate feature descriptions. The test server enables checkout in nonproduction, so enabled preview buttons do not establish live-payment readiness. Trust copy states real payments are not live.

**Recommended change:** Use one source for plan capabilities and availability. Describe the actual purchase outcome, renewal period, usage-reset boundary, limits, cancellation/access-end behavior and support route before checkout. Show unavailable plans as unavailable consistently. Avoid inventing testimonials, customer counts, security certifications or uptime guarantees.

**Payment work still outstanding from code audit:** atomic durable webhook deduplication; handling delayed events from old subscriptions; recovery of uncertain subscription creation; conflicts between legacy payment links and subscriptions; preservation of scheduled cancellation; provider timeouts; a payment/invoice ledger; refund/dispute handling; and production configuration validation. Existing billing unit tests passed earlier but do not cover all these failure modes. Do not enable real charges merely by changing the live key.

## Social publishing, domains and help

- Social Publisher prepares/copies a package and opens a platform. It does not publish directly. The explanatory note is good; use a label such as Prepare social post to avoid implying scheduling or automatic posting. Verify each platform handoff without posting in production.
- Domain setup should show concrete DNS record examples, expected verification state and a retry/recovery explanation. Actual DNS verification was not attempted in this audit.
- The Google Forms guide is more task-oriented than the main landing page: it explains respondent permissions, expiry and testing the final QR. Preserve this approach and link it contextually from the form.
- `/docs` mixes beginner help with a developer request example. Separate a short user guide from complete API authentication, constraints, errors and examples.
- Support identifies the operator and provides specific contact subjects. Add an honest response window only if it can be met. Email-only onboarding needs a visible expectation for what happens next.

## Accessibility and recovery

- Fix the confirmed layout/contrast problems before decorative changes. Browser dimensions alone are not a complete WCAG assessment.
- Keep demo disclosures, limits and critical instructions visible at every breakpoint. Test keyboard focus, zoom/reflow, screen readers and reduced motion in a dedicated pass.
- Desktop and mobile header/navigation consume significant space while scrolling. Check that anchor targets and focused controls are not obscured by sticky layers.
- Mobile homepage and tested dashboard did not show document-wide horizontal overflow at the sampled width; navigation has its own horizontal scrolling. That does not prove every state is overflow-free.
- Expired/missing short URLs currently return plain messages in the backend. Add a branded, accessible explanation, preserve correct 410/404 status, and offer an appropriate support/home route. Do not automatically send an expired link to an unrelated destination.
- Expiring a link has a confirmation prompt. Improve it by naming the selected link and stating that its QR also stops routing; do not imply undo unless implemented.

## Measurement and validation plan

Measure acquisition separately from usability. Track aggregate landing → successful creation → copy/download → signup → verification → saved-link creation, with no destination URLs, tokens or personal form values in analytics. The current analytics module is explicitly off unless the production flag is enabled. It is not evidence that production collection is active.

Run task sessions with representative quick-link users, creators and institution operators. Ask them to create and share a link, explain its expiry, recover from a mistake, locate an existing link, and describe what a paid plan includes. Record completion, hesitation, errors and misunderstandings. Test improvements in small batches; do not infer conversion lift from this audit alone.

## Order of work

1. Repair and browser-verify confirmed functional/layout defects and misleading copy.
2. Decide the supported link-lifetime promise and make it consistent across the product.
3. Simplify first creation and signup while preserving meaningful consent and limits.
4. Complete billing recovery and test the payment lifecycle before real charges.
5. Verify deployment, email, DNS, monitoring, accessibility and acquisition measurement.
6. Test the revised journeys with users, then prioritize remaining design work from evidence.

## Verification of this correction batch

- Frontend: 30 tests passed; App.jsx lint passed; production build passed.
- Backend: four billing-plan tests passed after correcting feature descriptions.
- Browser: creator desktop link creation succeeded; desktop builder restored to approximately 709px at 1366px viewport, 985px at 1024px, and 351px at 390px. Institution desktop builder remained approximately 709px. Mobile sample-data disclosure is visible. Active navigation text is white and section scrolling clears the sticky bars.
- Screenshot: `desktop-dashboard-fixed.jpg` in the repository root.
- Changes are local and unpublished. Payment recovery, real email/DNS checks, and the larger UX recommendations above remain outstanding. This is not a complete production certification or a full automated accessibility audit.

## Sources for the evaluation method

The recommendations use visibility of system status, familiar language, error recovery and reduced recall burden as evaluation principles, not guaranteed conversion formulas: [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/). Showing essential controls first and optional detail later follows [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/). Payment event ordering and duplicate handling follow [Razorpay webhook guidance](https://razorpay.com/docs/webhooks/validate-test/).

## First-creation simplification follow-up

- Reduced the homepage hero and placed the guest creation tool directly beneath it. Destination field now starts approximately 433px from the document top at 1366px width and 541px at 390px width (previous audit: roughly 993px and 1268px).
- Dashboard creation now presents destination and expiry before a native Advanced options disclosure containing domain, template, custom alias and fallback controls. Expiry consequences remain visible.
- Reduced dashboard overview and builder padding. Institution destination still starts around 820px from the document top; further above-the-fold work remains possible.
- Browser checked desktop and mobile homepage without document-wide horizontal overflow; institution advanced options expand/collapse correctly.
- Frontend 30 tests and lint passed. Production build rechecked after final CSS edits. Screenshot: first-link-desktop.jpg.
- Local and unpublished. The initial static HTML shell still uses the earlier hero before JavaScript loads; align it in the next consistency pass. Signup clarity, lifetime policy and payment recovery remain outstanding.

## Loading and signup clarity follow-up

- Replaced the old oversized static hero and sample dashboard with compact matching messaging and an explicit creator-loading state, plus a JavaScript-disabled explanation.
- Exposed the backend password requirements during signup/reset and added native pattern validation; login does not impose new-password rules. Password field retains a short accessible label and separate description.
- Added terms/privacy links beside their consent statements, opening in a new tab to preserve the form. Required versus optional consent is explicit; no consent defaults changed.
- Validation: frontend lint, all 30 tests and production build passed. Browser connection repeatedly timed out before interaction, so this batch still needs visual preview verification. No screenshot or live signup was completed.
- Local and unpublished. Next: visually verify this batch, then payment recovery and lifecycle tests.
