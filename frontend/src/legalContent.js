export const POLICY_EFFECTIVE_DATE = "9 August 2026";

export const OPERATOR_NOTICE =
  "Shotlink is a digital service operated by Yash Raj under the brand name Shotlink as an individual/unregistered business in India.";

export const LEGAL_PAGE_CONTENT = Object.freeze({
  trust: {
    eyebrow: "Trust centre",
    title: "Clear rules for a link people can trust.",
    lead:
      "Review how Shotlink handles acceptable use, personal information, digital delivery, cancellations, refunds, and support.",
    sections: [
      {
        title: "Safety and acceptable use",
        paragraphs: [
          "Only create or share links when you own the destination or are authorised to distribute it. Phishing, malware, spam, impersonation, unlawful content, deceptive redirects, and attempts to evade platform safeguards are prohibited.",
          "We may disable links or accounts, preserve evidence, and cooperate with lawful requests when necessary to protect users, institutions, or the public.",
        ],
      },
      {
        title: "Privacy by design",
        paragraphs: [
          "Shotlink separates customer workspaces, uses secure browser sessions, records administrative activity, and limits analytics to information needed to operate and protect the service.",
        ],
      },
      {
        title: "Payments are not live yet",
        paragraphs: [
          "Paid plans are displayed for product planning, but real-money checkout remains disabled while Razorpay Live Mode approval is pending. You can use the free plan without entering payment details.",
        ],
      },
      {
        title: "Policy library",
        links: [
          { label: "Terms and Conditions", href: "/terms" },
          { label: "Privacy Policy", href: "/privacy" },
          { label: "Digital Delivery / Shipping Policy", href: "/shipping-policy" },
          { label: "Cancellation and Refund Policy", href: "/refund-policy" },
          { label: "Contact Us", href: "/contact" },
        ],
      },
    ],
  },
  terms: {
    eyebrow: "Terms and Conditions",
    title: "The agreement for using Shotlink.",
    lead:
      "These terms apply when you visit Shotlink, create a temporary link, register a workspace, or use a paid plan after live billing becomes available.",
    sections: [
      {
        title: "1. Who may use Shotlink",
        paragraphs: [
          "You must be at least 18 years old, or otherwise legally capable of entering this agreement. If you use Shotlink for an organisation, you confirm that you are authorised to act for that organisation.",
        ],
      },
      {
        title: "2. Accounts and workspaces",
        paragraphs: [
          "Provide accurate information, protect your sign-in credentials, and promptly notify support if you suspect unauthorised access. You are responsible for activity performed through your account and for assigning appropriate workspace roles.",
          "An institution may prove control of an official email domain through DNS. Once verified, Shotlink may prevent separate workspaces from being created with that domain and require access to be provisioned by the verified institution administrator.",
        ],
      },
      {
        title: "3. Links, destinations, and QR codes",
        paragraphs: [
          "You retain responsibility for every destination, alias, fallback route, QR code, and campaign you create. You must have the right to share the destination and must keep its content lawful, accurate, and safe.",
          "Temporary links expire automatically. Permanent links and workspace features are subject to plan limits, technical safeguards, and abuse controls.",
        ],
      },
      {
        title: "4. Prohibited use",
        bullets: [
          "Phishing, credential theft, malware, spam, or unsolicited bulk messaging.",
          "Impersonation, deceptive redirects, fraud, harassment, or infringement of third-party rights.",
          "Illegal content or activity, including attempts to bypass sanctions, court orders, or regulatory restrictions.",
          "Automated activity that disrupts the service, probes other accounts, defeats rate limits, or interferes with security controls.",
          "Resale or access sharing that exceeds the purchased plan or a written enterprise agreement.",
        ],
      },
      {
        title: "5. Plans and billing",
        paragraphs: [
          "The free plan may have limits on active links, clicks, domains, members, API requests, and QR codes. Paid-plan prices, taxes, billing intervals, and included limits are shown before checkout.",
          "Real payments are accepted only after Shotlink enables Razorpay Live Mode. Until then, paid-plan buttons are disabled and no test checkout should be treated as a purchase.",
          "When recurring billing is live, you authorise the payment provider to charge the displayed subscription amount at the stated interval until cancellation. Access may be restricted if a payment is overdue, reversed, disputed, or fraudulent.",
        ],
      },
      {
        title: "6. Cancellation, delivery, and refunds",
        paragraphs: [
          "Paid subscriptions can be scheduled to cancel at the end of the current billing period. Digital access is delivered after the payment provider confirms payment. Refund eligibility is governed by the Cancellation and Refund Policy.",
        ],
        links: [
          { label: "Read the Cancellation and Refund Policy", href: "/refund-policy" },
          { label: "Read the Digital Delivery Policy", href: "/shipping-policy" },
        ],
      },
      {
        title: "7. Availability and changes",
        paragraphs: [
          "We work to keep Shotlink available and secure, but do not promise uninterrupted or error-free operation. Maintenance, provider failures, legal requirements, abuse response, or events outside reasonable control may affect availability.",
          "Features, limits, and these terms may change. Material changes will be posted on this page with a revised effective date. Continued use after a change takes effect means you accept the updated terms.",
        ],
      },
      {
        title: "8. Intellectual property",
        paragraphs: [
          "You keep ownership of your destination content and brand materials. You give Shotlink the limited permission needed to store, process, display, and route the information you submit in order to provide the service. Shotlink software, branding, and documentation remain protected by applicable intellectual-property laws.",
        ],
      },
      {
        title: "9. Suspension and termination",
        paragraphs: [
          "We may suspend or terminate access, disable a link, or preserve relevant records when reasonably necessary for security, non-payment, prohibited use, legal compliance, or protection of users. You may stop using the service and request account closure by contacting support.",
        ],
      },
      {
        title: "10. Liability and governing law",
        paragraphs: [
          "To the extent permitted by law, Shotlink is provided on an as-available basis. The operator is not liable for indirect, incidental, special, or consequential loss, lost profit, or loss caused by third-party destinations. Nothing in these terms excludes a right or liability that cannot lawfully be excluded.",
          "These terms are governed by the laws of India. Disputes that cannot be resolved through support will be subject to courts of competent jurisdiction in India.",
        ],
      },
      {
        title: "11. Contact",
        paragraphs: [
          "Questions about these terms, abuse reports, and legal notices can be sent through the Contact Us page.",
        ],
        links: [{ label: "Contact Shotlink", href: "/contact" }],
      },
    ],
  },
  privacy: {
    eyebrow: "Privacy Policy",
    title: "How Shotlink handles personal information.",
    lead:
      "This policy explains what information Shotlink processes, why it is used, when it is shared, and the choices available to you.",
    sections: [
      {
        title: "1. Information you provide",
        bullets: [
          "Account information such as your name, email address, workspace name, and consent records.",
          "Link information such as destination URLs, aliases, fallback routes, expiry settings, custom domains, and QR-code activity.",
          "Support messages, abuse reports, and information you choose to include in them.",
          "Billing contact information and provider references. Card, UPI, or bank credentials are handled by Razorpay and are not stored by Shotlink.",
        ],
      },
      {
        title: "2. Information collected during use",
        bullets: [
          "Session, security, request, and audit information needed to sign you in and protect workspaces.",
          "For link visits: time, referring page when supplied, device category, browser, operating system, route status, and a one-way hashed network identifier used for analytics and abuse prevention.",
          "Operational logs, rate-limit counters, error details, and service-health information.",
        ],
      },
      {
        title: "3. How information is used",
        bullets: [
          "Provide, secure, troubleshoot, and improve the link-routing service.",
          "Show workspace analytics and enforce plan limits.",
          "Verify custom domains and institutional email-domain governance.",
          "Process subscriptions, reconcile payment events, and respond to billing questions.",
          "Detect abuse, investigate incidents, comply with law, and protect users and the public.",
        ],
      },
      {
        title: "4. Legal grounds and consent",
        paragraphs: [
          "Depending on the context, processing is based on providing the service you request, your consent, compliance with legal obligations, and legitimate interests in security, fraud prevention, analytics, and service reliability. You can withdraw optional marketing consent without affecting core service use.",
        ],
      },
      {
        title: "5. Sharing and service providers",
        paragraphs: [
          "Information is shared only as needed with infrastructure, database, hosting, security, email, analytics, and payment providers that help operate Shotlink. Razorpay independently processes payment information under its own terms and privacy notice.",
          "Information may also be disclosed when required by law, to respond to valid legal process, to investigate abuse or fraud, or to protect rights and safety. Shotlink does not sell personal information.",
        ],
      },
      {
        title: "6. Cookies and local storage",
        paragraphs: [
          "Shotlink uses essential browser cookies and related storage for secure sessions, CSRF protection, user preferences, and core application behaviour. The service does not require third-party advertising cookies.",
        ],
      },
      {
        title: "7. Retention",
        paragraphs: [
          "Information is retained for as long as needed to provide the service, maintain security and audit records, resolve disputes, enforce agreements, and meet legal or accounting obligations. Expired links may be retained in a disabled state for security, support, and abuse-response purposes before deletion or de-identification.",
        ],
      },
      {
        title: "8. Security",
        paragraphs: [
          "Shotlink uses controls including encrypted transport, one-way password protection, secure browser sessions, CSRF safeguards, role checks, DNS verification, rate limits, and audit events. No system can guarantee absolute security; report suspected compromise immediately.",
        ],
      },
      {
        title: "9. Your choices and requests",
        paragraphs: [
          "You may request access, correction, deletion, or export of personal information associated with your account. Some information may be retained where necessary for legal compliance, billing records, security, fraud prevention, or the rights of others.",
          "To make a request, email support@shotlink.in from the address connected to your account and describe the request. We may need to verify your identity before acting.",
        ],
      },
      {
        title: "10. Children and international processing",
        paragraphs: [
          "Shotlink is not intended for children under 18. Service providers may process information in locations outside your state or country, subject to contractual and technical protections appropriate to the service.",
        ],
      },
      {
        title: "11. Changes and contact",
        paragraphs: [
          "Material changes will be posted here with a revised effective date. Privacy questions or complaints can be sent through the Contact Us page.",
        ],
        links: [{ label: "Contact Shotlink", href: "/contact" }],
      },
    ],
  },
  refund: {
    eyebrow: "Cancellation and Refund Policy",
    title: "Straightforward cancellation for a digital subscription.",
    lead:
      "This policy applies once Shotlink enables live recurring payments. No real-money checkout is currently available while Razorpay activation is pending.",
    sections: [
      {
        title: "Cancel a subscription",
        paragraphs: [
          "A workspace owner can schedule cancellation from the Billing panel or contact support@shotlink.in. Unless a different date is required by law or confirmed by support, cancellation takes effect at the end of the current paid billing period and paid access remains available until then.",
          "Cancelling a subscription does not automatically delete the account or links. After the paid period ends, the workspace returns to applicable free-plan limits and features above those limits may be restricted.",
        ],
      },
      {
        title: "Refund eligibility",
        paragraphs: [
          "Because Shotlink supplies digital access immediately after payment confirmation, subscription charges are normally non-refundable once a billing period begins. We will review refund requests for a duplicate or incorrect charge, a paid plan that could not be activated because of a verified Shotlink error, an unauthorised charge reported promptly, or any refund required by applicable law.",
          "Submit the request within 7 calendar days of the charge. Include the account email, workspace name, payment reference, charge date, amount, and reason. Do not send card, UPI PIN, OTP, or banking credentials.",
        ],
      },
      {
        title: "Review and processing",
        paragraphs: [
          "We will investigate the request and may ask for information needed to match the payment. If approved, the refund is sent to the original payment method through Razorpay. Bank or payment-network processing times vary and are outside Shotlink's control.",
          "A chargeback or payment dispute may temporarily restrict paid features while the provider investigates it. This policy does not limit rights that cannot be excluded under applicable law.",
        ],
      },
      {
        title: "Request support",
        links: [
          { label: "Email support@shotlink.in", href: "mailto:support@shotlink.in?subject=Shotlink%20refund%20request" },
          { label: "Open Contact Us", href: "/contact" },
        ],
      },
    ],
  },
  delivery: {
    eyebrow: "Digital Delivery / Shipping Policy",
    title: "Shotlink is delivered online—nothing is physically shipped.",
    lead:
      "This policy explains how free and paid digital access is provided and what to do if activation is delayed.",
    sections: [
      {
        title: "Digital service only",
        paragraphs: [
          "Shotlink provides online software for short links, QR codes, analytics, branded domains, and workspace governance. No physical product is sold, packed, couriered, or shipped. Shipping charges and physical delivery timelines do not apply.",
        ],
      },
      {
        title: "Free access",
        paragraphs: [
          "A temporary guest link is delivered on screen after a valid request is accepted. A registered free workspace is available after successful account creation and sign-in, subject to security checks and plan limits.",
        ],
      },
      {
        title: "Paid-plan activation",
        paragraphs: [
          "When live billing becomes available, paid features are activated electronically after Razorpay confirms a successful payment or active subscription. Activation is normally reflected in the Billing panel within a few minutes. Provider delays, webhook retries, fraud checks, or account review may take longer.",
          "If paid access is not visible within 24 hours of a confirmed charge, contact support with the account email, workspace name, and payment reference. Do not send card numbers, UPI PINs, OTPs, or banking credentials.",
        ],
      },
      {
        title: "Delivery destination",
        paragraphs: [
          "Access is delivered to the Shotlink workspace associated with the email address used during checkout. Customers are responsible for entering the correct account and billing information.",
        ],
      },
      {
        title: "Delivery support",
        links: [
          { label: "Email support@shotlink.in", href: "mailto:support@shotlink.in?subject=Shotlink%20delivery%20support" },
          { label: "Open Contact Us", href: "/contact" },
        ],
      },
    ],
  },
  contact: {
    eyebrow: "Contact Us",
    title: "Talk to the person operating Shotlink.",
    lead:
      "Use these verified channels for account help, billing questions, privacy requests, institutional onboarding, and abuse reports.",
    contactRows: [
      { label: "Brand", value: "Shotlink" },
      { label: "Operator", value: "Yash Raj — Individual / Unregistered Business" },
      { label: "Support email", value: "support@shotlink.in", href: "mailto:support@shotlink.in" },
      { label: "Support phone", value: "+91 87970 53635", href: "tel:+918797053635" },
      { label: "Website", value: "https://www.shotlink.in", href: "https://www.shotlink.in" },
      { label: "Country of operation", value: "India" },
    ],
    sections: [
      {
        title: "What to include",
        paragraphs: [
          "For account or billing help, include your account email, workspace name, and any non-secret reference shown in Shotlink. For an abuse report, include the short link, the reason for concern, and supporting details.",
          "Never send passwords, API secrets, card numbers, CVV, UPI PINs, OTPs, Aadhaar numbers, or other authentication credentials by email or phone.",
        ],
      },
      {
        title: "Dedicated subjects",
        links: [
          { label: "Account and billing support", href: "mailto:support@shotlink.in?subject=Shotlink%20account%20support" },
          { label: "Report abuse or phishing", href: "mailto:support@shotlink.in?subject=Shotlink%20abuse%20report" },
          { label: "Privacy request", href: "mailto:support@shotlink.in?subject=Shotlink%20privacy%20request" },
          { label: "Institutional onboarding", href: "mailto:support@shotlink.in?subject=Shotlink%20institutional%20onboarding" },
        ],
      },
    ],
  },
});
