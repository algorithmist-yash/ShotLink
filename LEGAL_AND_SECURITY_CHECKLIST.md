# Legal and Security Launch Checklist

This is an engineering checklist, not legal advice. Before taking paid customers, ask a qualified Indian startup lawyer or compliance consultant to review your final Terms, Privacy Notice, refund policy, and grievance process.

## What is now built into the product

- Account signup requires consent to Terms, Privacy Notice, link analytics, lawful use, and age/legal-capacity confirmation.
- Marketing email opt-in is separate and optional.
- Consent evidence is stored with policy version, timestamp, user agent, and hashed IP address.
- Every new short link requires the owner to confirm destination authority, automated health-check consent, and anti-abuse policy acceptance.
- Link compliance evidence is stored on the URL record with policy version, timestamp, user, user agent, and hashed IP address.
- The backend blocks obvious private/local destinations such as `localhost`, `127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, private IPv6, and `.local` hosts.
- API security headers, production HSTS, tighter CORS, JSON body limits, and stricter signup password rules are enabled.

## Do before public launch

- Replace placeholder support details with a real business email such as `legal@shotlink.in` and `abuse@shotlink.in`.
- Publish standalone Terms of Service, Privacy Notice, Acceptable Use Policy, Refund/Cancellation Policy, and Grievance/Abuse reporting page.
- Put the same policy version/date in the public documents and in `ACCOUNT_POLICY_VERSION` / `LINK_POLICY_VERSION`.
- Configure `ALLOWED_ORIGINS` on Railway with only your real frontend URL, for example `https://shotlink.in,https://www.shotlink.in`.
- Use a production `SESSION_SECRET`, MongoDB Atlas least-privilege database user, and Razorpay live keys only in Railway/Vercel environment variables.
- Turn on MongoDB Atlas alerts, Railway deploy alerts, and Razorpay webhook failure alerts.
- Create an abuse takedown workflow: verify report, disable link, retain evidence, and respond to the reporter.
- Decide log retention with a lawyer. CERT-In directions can require security logs to be retained for Indian compliance contexts.

## Policy text your lawyer should finalize

- What personal data is collected: name, email, workspace, billing status, support requests, short links, click time, device type, browser, OS, referrer, redirect target, and hashed IP.
- Why it is collected: account management, billing, analytics, fraud prevention, abuse handling, security, and customer support.
- Data sharing: MongoDB Atlas, Railway, Vercel, Razorpay, email/support tools, and any analytics/monitoring tools.
- User rights: access, correction, deletion, consent withdrawal, grievance redressal, and contact method.
- Prohibited uses: phishing, malware, spam, unlawful content, impersonation, deceptive redirects, scraping, platform abuse, and links without authority.
- Enforcement rights: suspend, expire, or remove abusive links and accounts.
- Payment terms: prices, taxes, refunds, cancellations, failed payments, and plan limits.
