import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { apiFetch } from "../apiClient";
import { BrandLogo } from "./BrandLogo";
import "./PublicMarketing.css";

const TEMPORARY_EXPIRY_OPTIONS = [
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
];

const CREATOR_PLANS = [
  {
    id: "free",
    label: "Start sharing",
    name: "Free",
    price: "₹0",
    description: "For testing ideas and occasional social posts.",
    features: ["10 active links", "5 QR codes", "Basic click analytics"],
  },
  {
    id: "pro",
    label: "For independent talent",
    name: "Creator Pro",
    price: "₹1,199 / month",
    description: "For influencers, models, photographers, and creators running regular campaigns.",
    features: ["500 active links", "250 campaign QR codes", "Branded domain + audience analytics"],
    featured: true,
  },
  {
    id: "business",
    label: "For managed talent",
    name: "Studio",
    price: "₹9,999 / month",
    description: "For agencies, studios, and managers coordinating multiple profiles and launches.",
    features: ["10,000 active links", "Team workspace", "Campaign exports + 10 domains"],
  },
];

const SECTORS = [
  {
    index: "01",
    name: "Higher education",
    title: "One governed link layer for every campus.",
    text: "Admissions, examinations, departments, faculty, and student services publish from one accountable workspace.",
    accent: "violet",
    example: "go.university.edu/admissions",
  },
  {
    index: "02",
    name: "Government & public sector",
    title: "Public information that stays official.",
    text: "Create recognisable short links for notices, citizen services, field campaigns, and emergency communication.",
    accent: "lime",
    example: "go.agency.gov.in/notice",
  },
  {
    index: "03",
    name: "Large enterprise",
    title: "Brand control without slowing teams down.",
    text: "Keep regional teams and business units inside one domain policy with measurable, resilient routing.",
    accent: "orange",
    example: "link.enterprise.com/launch",
  },
];

const CAPABILITIES = [
  {
    number: "001",
    title: "Institution domain governance",
    text: "Prove ownership with DNS once. After verification, staff cannot create unsanctioned Shotlink workspaces using the protected official email domain.",
    tags: ["DNS ownership", "Official email lock", "Admin provisioned", "Audit event"],
  },
  {
    number: "002",
    title: "Branded link infrastructure",
    text: "Connect a trusted short domain, verify it, choose the primary surface, and publish links that audiences recognise immediately.",
    tags: ["Custom domains", "Custom aliases", "QR codes", "Automatic expiry"],
  },
  {
    number: "003",
    title: "Continuity-aware routing",
    text: "Monitor a primary destination and ordered fallback pages so critical communication has a healthy path when a page fails.",
    tags: ["Health checks", "Fallback routes", "Manual disable", "Route telemetry"],
  },
  {
    number: "004",
    title: "Accountable measurement",
    text: "See clicks, devices, browsers, operating systems, referrers, route status, and recent events inside the owning workspace.",
    tags: ["Workspace scope", "Click analytics", "Role checks", "Audit logs"],
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Claim the institution",
    text: "An authorised administrator adds the official email domain and receives a unique DNS TXT record.",
  },
  {
    step: "02",
    title: "Verify ownership",
    text: "Shotlink confirms the TXT record. The domain becomes governed by that single institutional workspace.",
  },
  {
    step: "03",
    title: "Provision people centrally",
    text: "New self-service workspace creation on the protected domain is blocked and routed back to the institution administrator.",
  },
  {
    step: "04",
    title: "Publish with control",
    text: "Teams create branded links with expiry, fallback routing, analytics, and a traceable workspace record.",
  },
];

const FAQS = [
  {
    question: "Can anyone claim a university or government email domain?",
    answer:
      "No. The workspace must publish a unique DNS TXT record before the domain becomes governed. That proves control of the institution's DNS, not merely possession of one email address.",
  },
  {
    question: "What happens after an official email domain is verified?",
    answer:
      "New users with that domain cannot create separate, unsanctioned Shotlink workspaces. They are told to request administrator-provisioned access from the institution that owns the domain.",
  },
  {
    question: "Does Shotlink replace our official website domain?",
    answer:
      "No. It adds a controlled short-link layer. You can connect a dedicated branded subdomain such as go.university.edu while keeping your existing websites and systems unchanged.",
  },
  {
    question: "What happens when a destination page is unavailable?",
    answer:
      "A link can have ordered fallback destinations. Shotlink records route health and sends visitors to the healthiest available approved destination.",
  },
  {
    question: "Is link activity separated between institutions?",
    answer:
      "Yes. Link creation, inventory, analytics, domains, and audit events are scoped to the authenticated workspace and protected by workspace roles.",
  },
];

function Arrow({ diagonal = false }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}

function GovernanceConsole() {
  return (
    <div className="mk-console" aria-label="Institution governance preview">
      <div className="mk-console-bar">
        <div className="mk-console-dots" aria-hidden="true"><i /><i /><i /></div>
        <span>app.shotlink.in / governance</span>
        <span className="mk-console-live"><i /> policy live</span>
      </div>
      <div className="mk-console-body">
        <aside className="mk-console-rail" aria-hidden="true">
          <span className="is-active">SL</span><span>01</span><span>02</span><span>03</span><span>04</span>
        </aside>
        <div className="mk-console-main">
          <div className="mk-console-heading">
            <div><small>ACME UNIVERSITY</small><strong>Institution domains</strong></div>
            <button type="button" tabIndex={-1}>Claim domain +</button>
          </div>
          <div className="mk-domain-record">
            <div className="mk-domain-name"><span>AU</span><div><strong>@acmeuniversity.edu</strong><small>Official email identity</small></div></div>
            <span className="mk-verified"><i /> verified</span>
          </div>
          <div className="mk-policy-grid">
            <article><small>WORKSPACE POLICY</small><strong>Central provisioning</strong><span>New independent workspaces blocked</span></article>
            <article><small>LINK DOMAIN</small><strong>go.acmeuniversity.edu</strong><span>Verified · primary</span></article>
            <article><small>ROUTE HEALTH</small><strong>All systems normal</strong><span>2 fallback paths ready</span></article>
          </div>
          <div className="mk-console-log">
            <div><span>10:42</span><strong>institution_domain.verified</strong><small>DNS ownership confirmed</small></div>
            <div><span>10:44</span><strong>link.created</strong><small>/admissions-2027</small></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRemainingTime(milliseconds) {
  if (milliseconds <= 0) return "Expired";
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function TemporaryLinkStudio({ onStart }) {
  const [destination, setDestination] = useState("");
  const [expiryMinutes, setExpiryMinutes] = useState(15);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [result, setResult] = useState(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!result?.expiresAt) return undefined;

    const updateRemaining = () => {
      setRemainingMs(Math.max(new Date(result.expiresAt).getTime() - Date.now(), 0));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [result]);

  const createTemporaryLink = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!policyAccepted) {
      setError("Confirm that you are authorised to share this destination.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch("/api/v1/links/guest", {
        method: "POST",
        body: JSON.stringify({
          originalUrl: destination,
          expiresInMinutes: expiryMinutes,
          compliance: {
            destinationAuthorityAccepted: true,
            securityScanAccepted: true,
            abusePolicyAccepted: true,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not create the temporary link");
      }

      setResult(data.link);
      setMessage("Your temporary short link and QR code are ready.");
    } catch (requestError) {
      setError(requestError.message || "Could not create the temporary link");
    } finally {
      setSubmitting(false);
    }
  };

  const copyShortLink = async () => {
    if (!result?.shortUrl || remainingMs <= 0) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setMessage("Short link copied.");
    } catch {
      setError("Copy was blocked by the browser. Select the link and copy it manually.");
    }
  };

  const downloadQr = () => {
    const qrCanvas = document.getElementById("mk-temporary-qr");
    if (!(qrCanvas instanceof HTMLCanvasElement) || remainingMs <= 0) return;

    const download = document.createElement("a");
    download.download = `shotlink-${result.shortCode}.png`;
    download.href = qrCanvas.toDataURL("image/png");
    download.click();
    setMessage("QR code downloaded.");
  };

  return (
    <section className="mk-quick mk-section" id="create">
      <div className="mk-section-heading mk-section-heading-row">
        <div><p>Instant share tool</p><h2>Short link and QR.<br />Live for up to 30 minutes.</h2></div>
        <span>Create one disposable link without an account. Upgrade when the campaign needs persistence, branding, or analytics.</span>
      </div>

      <div className="mk-quick-grid">
        <form className="mk-quick-form" onSubmit={createTemporaryLink}>
          <div className="mk-quick-form-top">
            <span>01 / Create</span>
            <small>5 temporary links per 10 minutes</small>
          </div>
          <label className="mk-quick-field">
            <span>Destination URL</span>
            <input
              type="url"
              value={destination}
              placeholder="https://instagram.com/p/your-post"
              onChange={(event) => setDestination(event.target.value)}
              required
            />
          </label>
          <label className="mk-quick-field">
            <span>Automatic expiry</span>
            <select
              value={expiryMinutes}
              onChange={(event) => setExpiryMinutes(Number(event.target.value))}
            >
              {TEMPORARY_EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="mk-quick-consent">
            <input
              type="checkbox"
              checked={policyAccepted}
              onChange={(event) => setPolicyAccepted(event.target.checked)}
            />
            <span>I am authorised to share this destination and accept anti-abuse checks.</span>
          </label>
          {error ? <p className="mk-quick-feedback is-error" role="alert">{error}</p> : null}
          {message ? <p className="mk-quick-feedback" role="status">{message}</p> : null}
          <button className="mk-quick-submit" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create short link + QR"} <Arrow />
          </button>
          <p className="mk-quick-terms">Temporary links expire automatically. Persistent links require a Shotlink workspace.</p>
        </form>

        <aside className={`mk-quick-result ${result ? "has-result" : ""}`} aria-live="polite">
          <div className="mk-quick-result-top">
            <span>02 / Share</span>
            <strong>{result ? formatRemainingTime(remainingMs) : "30:00 max"}</strong>
          </div>
          {result ? (
            <>
              <div className="mk-quick-qr-shell">
                <QRCodeCanvas
                  id="mk-temporary-qr"
                  value={result.shortUrl}
                  size={190}
                  includeMargin
                  aria-label={`QR code for ${result.shortUrl}`}
                />
              </div>
              <div className="mk-quick-link-block">
                <small>Temporary Shotlink</small>
                <a href={result.shortUrl} target="_blank" rel="noreferrer">{result.shortUrl}</a>
                <span>Expires {new Date(result.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="mk-quick-result-actions">
                <button type="button" onClick={copyShortLink} disabled={remainingMs <= 0}>Copy link</button>
                <button type="button" onClick={downloadQr} disabled={remainingMs <= 0}>Download QR</button>
              </div>
            </>
          ) : (
            <div className="mk-quick-placeholder">
              <div aria-hidden="true"><i /><i /><i /></div>
              <h3>Your QR appears here.</h3>
              <p>Paste a post, portfolio, event, or campaign URL. The short link stops working automatically at the selected time.</p>
            </div>
          )}
          <button type="button" className="mk-quick-upgrade" onClick={onStart}>
            Need a permanent link? Create a workspace <Arrow diagonal />
          </button>
        </aside>
      </div>
    </section>
  );
}

function CreatorPlans({ onStart }) {
  return (
    <section className="mk-creators mk-section" id="creators">
      <div className="mk-section-heading mk-section-heading-row">
        <div><p>Built for public profiles</p><h2>From one post<br />to every campaign.</h2></div>
        <span>Creators can start free, then subscribe when they need permanent links, branded domains, more QR codes, and deeper audience insight.</span>
      </div>
      <div className="mk-creator-plan-grid">
        {CREATOR_PLANS.map((plan) => (
          <article key={plan.id} className={plan.featured ? "is-featured" : ""}>
            <div className="mk-creator-plan-top"><span>{plan.label}</span>{plan.featured ? <b>Most popular</b> : null}</div>
            <h3>{plan.name}</h3>
            <p className="mk-creator-price">{plan.price}</p>
            <p className="mk-creator-description">{plan.description}</p>
            <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            <button type="button" onClick={() => onStart(plan.id)}>
              {plan.id === "free" ? "Create a free workspace" : `Choose ${plan.name}`} <Arrow />
            </button>
          </article>
        ))}
      </div>
      <p className="mk-creator-note">Paid subscriptions are activated securely from the workspace billing panel after account creation.</p>
    </section>
  );
}

export function PublicHeader({ onLogin, onStart }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="mk-header">
      <a className="mk-header-logo" href="/" aria-label="Shotlink home" onClick={closeMenu}>
        <BrandLogo />
      </a>
      <nav className="mk-desktop-nav" aria-label="Primary navigation">
        <a href="/#create">Create</a>
        <a href="/#creators">Creators</a>
        <a href="/#solutions">Institutions</a>
        <a href="/pricing">Pricing</a>
      </nav>
      <div className="mk-header-actions">
        <button type="button" className="mk-login-button" onClick={onLogin}>Sign in</button>
        <button type="button" className="mk-nav-cta" onClick={onStart}>Create workspace <Arrow /></button>
      </div>
      <button
        type="button"
        className="mk-menu-button"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span /><span /><span />
      </button>
      {menuOpen ? (
        <nav className="mk-mobile-menu" aria-label="Mobile navigation">
          <a href="/#create" onClick={closeMenu}>Create a link</a>
          <a href="/#creators" onClick={closeMenu}>Creators</a>
          <a href="/#solutions" onClick={closeMenu}>Institutions</a>
          <a href="/pricing" onClick={closeMenu}>Pricing</a>
          <button type="button" onClick={() => { closeMenu(); onLogin(); }}>Sign in</button>
          <button type="button" className="mk-mobile-cta" onClick={() => { closeMenu(); onStart(); }}>
            Create workspace <Arrow />
          </button>
        </nav>
      ) : null}
    </header>
  );
}

export function PublicLanding({ onStart }) {
  const [activeCapability, setActiveCapability] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="mk-page">
      <section className="mk-hero">
        <div className="mk-hero-grid" aria-hidden="true" />
        <div className="mk-orbit mk-orbit-one" aria-hidden="true" />
        <div className="mk-orbit mk-orbit-two" aria-hidden="true" />
        <div className="mk-hero-topline">
          <span>Link infrastructure for every public profile</span>
          <span>Creators · Models · Universities · Government</span>
        </div>
        <div className="mk-hero-copy">
          <p className="mk-kicker"><i /> Fast to share. Built to govern.</p>
          <h1>One link layer.<br /><em>Every audience.</em></h1>
          <div className="mk-hero-bottom">
            <p>
              Make a 30-minute short link and QR instantly. Upgrade for permanent creator
              campaigns, branded domains, audience analytics, or institution-wide governance.
            </p>
            <div className="mk-hero-actions">
              <a className="mk-primary-button" href="#create">
                Create a free link <Arrow />
              </a>
              <a className="mk-secondary-button" href="#creators">
                Explore creator plans <Arrow diagonal />
              </a>
            </div>
          </div>
        </div>
        <GovernanceConsole />
        <div className="mk-hero-footnote">
          <span>Instant QR generation</span><span>Automatic expiry</span><span>Governed workspaces</span>
        </div>
      </section>

      <TemporaryLinkStudio onStart={onStart} />
      <CreatorPlans onStart={onStart} />

      <section className="mk-statement mk-section" id="solutions">
        <div className="mk-statement-label"><span>Why Shotlink</span><strong>01 / 05</strong></div>
        <div className="mk-statement-copy">
          <h2>Turn every official URL into <em>accountable infrastructure.</em></h2>
          <p>
            Public links are small pieces of critical infrastructure. Shotlink gives institutions
            one governed place to create them, brand them, measure them, and keep them available.
          </p>
        </div>
      </section>

      <section className="mk-sector-section mk-section">
        <div className="mk-section-heading mk-section-heading-row">
          <div><p>Built for public trust</p><h2>Three institutions.<br />One control plane.</h2></div>
          <span>Designed for organisations where ownership, continuity, and accountability matter.</span>
        </div>
        <div className="mk-sector-grid">
          {SECTORS.map((sector) => (
            <article key={sector.name} className={`mk-sector-card is-${sector.accent}`}>
              <div className="mk-sector-top"><span>{sector.index}</span><small>{sector.name}</small></div>
              <div className="mk-sector-art" aria-hidden="true">
                <i /><i /><i /><b>{sector.example}</b>
              </div>
              <h3>{sector.title}</h3>
              <p>{sector.text}</p>
              <a href="/register">Explore the workflow <Arrow diagonal /></a>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-capabilities mk-section" id="governance">
        <div className="mk-section-heading mk-section-heading-row">
          <div><p>What the platform governs</p><h2>Control without<br />the bottleneck.</h2></div>
          <span>Four connected layers keep identity, publishing, routing, and evidence together.</span>
        </div>
        <div className="mk-capability-list">
          {CAPABILITIES.map((capability, index) => {
            const isActive = activeCapability === index;
            return (
              <article key={capability.number} className={isActive ? "is-active" : ""}>
                <button
                  type="button"
                  aria-expanded={isActive}
                  onClick={() => setActiveCapability(index)}
                >
                  <span>{capability.number}</span><strong>{capability.title}</strong><i aria-hidden="true">{isActive ? "−" : "+"}</i>
                </button>
                <div className="mk-capability-body">
                  <p>{capability.text}</p>
                  <div>{capability.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mk-workflow mk-section">
        <div className="mk-workflow-intro">
          <p>Domain-lock workflow</p>
          <h2>Your official email domain becomes a policy boundary.</h2>
          <span>
            A DNS record proves institutional ownership. Shotlink then prevents new shadow
            workspaces from being created with protected official email addresses.
          </span>
        </div>
        <div className="mk-workflow-steps">
          {WORKFLOW.map((item) => (
            <article key={item.step}>
              <span>{item.step}</span><div><h3>{item.title}</h3><p>{item.text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-proof mk-section" id="security">
        <div className="mk-proof-copy">
          <p>Operational trust</p>
          <h2>Proof lives in the product.</h2>
          <span>
            The platform already enforces secure browser sessions, CSRF protection, workspace
            roles, destination authority consent, DNS verification, and audit events.
          </span>
          <a href="/trust">Open the trust center <Arrow diagonal /></a>
        </div>
        <div className="mk-proof-grid">
          <article><strong>01</strong><h3>Identity boundary</h3><p>Verified email domains stop unmanaged workspace creation.</p></article>
          <article><strong>02</strong><h3>Workspace boundary</h3><p>Links, analytics, domains, and events remain scoped to the owning workspace.</p></article>
          <article><strong>03</strong><h3>Routing boundary</h3><p>Only verified branded domains can publish institution-facing links.</p></article>
          <article><strong>04</strong><h3>Evidence boundary</h3><p>Administrative changes and link actions create traceable audit events.</p></article>
        </div>
      </section>

      <section className="mk-cta-panel mk-section">
        <div>
          <p>Institutional onboarding</p>
          <h2>Bring your official domain.<br />We’ll build the control plane.</h2>
        </div>
        <button type="button" onClick={onStart}>Book a governance briefing <Arrow /></button>
      </section>

      <section className="mk-faq mk-section">
        <div className="mk-section-heading mk-section-heading-row">
          <div><p>FAQ</p><h2>The questions<br />procurement will ask.</h2></div>
          <span>Clear answers for institutional IT, communications, security, and leadership teams.</span>
        </div>
        <div className="mk-faq-list">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <article key={faq.question} className={isOpen ? "is-open" : ""}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? -1 : index)}>
                  <span>{String(index + 1).padStart(2, "0")}</span><strong>{faq.question}</strong><i>{isOpen ? "−" : "+"}</i>
                </button>
                <p>{faq.answer}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function PublicFooter({ onStart }) {
  return (
    <footer className="mk-footer">
      <div className="mk-footer-top">
        <div className="mk-footer-title"><BrandLogo /><h2>Links people can trust.</h2></div>
        <button type="button" onClick={onStart}>Start for free <Arrow /></button>
      </div>
      <div className="mk-footer-main">
        <div className="mk-footer-brand">
          <p>Short links and QR campaigns for creators, talent teams, universities, public agencies, and large enterprises.</p>
          <a href="mailto:support@shotlink.in">support@shotlink.in</a>
        </div>
        <div className="mk-footer-column">
          <strong>Platform</strong><a href="/#create">Quick link</a><a href="/#creators">Creators</a><a href="/#governance">Governance</a><a href="/pricing">Pricing</a>
        </div>
        <div className="mk-footer-column">
          <strong>Trust</strong><a href="/trust">Security controls</a><a href="/trust">Privacy</a><a href="/trust">Acceptable use</a><a href="/trust">Report abuse</a>
        </div>
        <div className="mk-footer-column">
          <strong>Organisation</strong><button type="button" onClick={onStart}>Book a briefing</button><a href="mailto:support@shotlink.in">Contact</a><a href="/login">Sign in</a>
        </div>
      </div>
      <div className="mk-footer-bottom">
        <span>© 2026 Shotlink. All rights reserved.</span><span>Built in India for creators and institutions everywhere.</span>
      </div>
    </footer>
  );
}
