# Shotlink institutional product and website audit

Date: 2026-08-08
Scope: public website, authentication, workspace boundaries, domain ownership, link creation, analytics, responsive UI, metadata, automated tests, and production-readiness constraints.

## Executive outcome

Shotlink already had a credible full-stack core: cookie sessions, CSRF protection, workspace role checks, custom-domain DNS verification, link expiry, fallback routing, click analytics, audit events, rate limits, and billing controls. The largest commercial gap was not the routing engine. It was the mismatch between the public website and the institutional buyer.

The website has been repositioned from a generic startup URL shortener to governed link infrastructure for universities, public agencies, and large enterprises. The visual system now follows the useful principles of the Nixtio reference—editorial typography, full-bleed dark presentation, disciplined spacing, focused motion, project-like solution cards, and strong section pacing—without copying its identity, assets, or copy.

An enforceable institutional ownership control was also added. Enterprise administrators can claim an official email domain, prove ownership with a dedicated DNS TXT record, and prevent new independent Shotlink workspaces from being created with addresses on that verified domain.

## Findings and remediation

### 1. Critical positioning mismatch — resolved

The previous landing page targeted broad marketing and sales teams, led with a free plan, and presented the product as another general-purpose shortener. That framing does not support government, university, or enterprise procurement.

The new public experience leads with institutional ownership, branded publishing, continuity-aware routing, workspace isolation, and auditable evidence. Higher education, government, and enterprise use cases now have specific workflows and realistic examples.

### 2. Unsupported marketing proof — resolved

The previous page displayed very large usage statistics, review proof, and third-party integrations without evidence in the repository. Those claims were removed. The new proof section references controls that exist in the codebase.

The Enterprise plan also advertised SSO and SCIM even though those capabilities are not implemented. The plan now lists verified institution email-domain governance, workspace roles, audit logs, dedicated review, SLA, and procurement support.

### 3. No institutional email-domain boundary — resolved for Shotlink self-service

Previously, every valid email address could create an independent workspace. This made it possible for multiple people using the same official institution domain to create fragmented, unmanaged Shotlink environments.

The new model adds a unique `managedEmailDomains` collection to workspaces. Enterprise administrators can:

- add an official email domain;
- receive a unique `_shotlink-access.<domain>` TXT record;
- verify DNS ownership;
- see ownership changes in the workspace audit log;
- release the domain when required.

After verification, registration with that email domain returns `INSTITUTION_DOMAIN_MANAGED` and directs the user to the institution administrator. Public inbox providers such as Gmail, Outlook, Yahoo, and Proton cannot be claimed.

### 4. Important limit of the requested guarantee

No website can technically prevent an individual from using a different URL-shortening provider. Shotlink can enforce ownership and provisioning inside Shotlink. To make Shotlink the exclusive institutional link layer, the institution must also adopt an organisational policy and normally connect SSO/SCIM or an invitation lifecycle, route official short domains through Shotlink, and restrict competing services at the organisation level.

The current implementation blocks shadow Shotlink workspaces safely. It does not yet include email verification, invitation delivery, SSO, or SCIM. Automatic enrolment based only on an entered email address was intentionally not implemented because that would let an attacker impersonate an institution user without proving mailbox ownership.

### 5. Public UX and accessibility — improved

The redesigned experience now includes:

- one clear institutional primary action;
- semantic heading order and labelled navigation;
- keyboard-accessible mobile navigation, capability accordions, and FAQ controls;
- visible focus handling inherited from the global design system;
- responsive layouts verified at desktop and mobile widths;
- reduced-motion handling for animated visual elements;
- honest, product-specific content rather than generic feature language;
- updated canonical, Open Graph, X, description, and page-title metadata;
- a purpose-built `og.png` social card aligned with the finished brand direction.

### 6. Application security and isolation — strong foundation

Verified controls in the repository include:

- host-scoped secure session cookies in production;
- session rotation and expiry;
- CSRF checks for unsafe cookie-authenticated requests;
- owner, admin, and member workspace role enforcement;
- request contracts and bounded request bodies;
- shared rate limits;
- DNS and destination validation against private-network targets;
- custom-domain ownership verification;
- workspace-scoped link, analytics, domain, and audit queries;
- sanitised audit metadata with retention;
- health-aware redirect routing and durable background queues.

## Verification evidence

- Frontend production build: passed.
- Frontend workflow tests: 7 passed.
- Frontend lint: passed.
- Backend tests: 172 passed.
- Backend source syntax check: 118 files passed.
- Desktop homepage review: passed at 1440 × 1000.
- Mobile homepage and menu review: passed at 390 × 844.
- Institutional onboarding CTA: opens `/register` and renders the expected account flow.
- Generated social preview: visually inspected; required text is correct and legible.

The live npm advisory refresh was not performed because it would transmit dependency metadata to the external npm audit service and that external disclosure was not authorised in the managed environment. Local builds, tests, lint, contracts, and source checks all passed.

## Production work still requiring external configuration

- Deploy the frontend with `VITE_API_BASE_URL=https://api.shotlink.in`.
- Deploy the API, redirect service, MongoDB, and Redis-compatible cache using the Free Render validation Blueprint and launch runbook; add the health worker before an institutional pilot depends on automatic failover.
- Add the production frontend origin to backend CORS configuration.
- Run the documented production migrations.
- Configure Razorpay production credentials and webhook delivery.
- Configure `shotlink.in`, `api.shotlink.in`, and `go.shotlink.in` DNS and TLS.
- Add institution invitation or SSO provisioning before enabling broad end-user access on a governed domain.
- Complete provider-environment smoke tests, manual assistive-technology review, and a live advisory scan before launch.

## Recommended next product increment

Build administrator invitations and verified-email acceptance first. Then add SAML/OIDC SSO and SCIM for customers that require automatic joiner, mover, and leaver controls. That is the path from the current safe domain lock to a complete institution-wide identity lifecycle.
