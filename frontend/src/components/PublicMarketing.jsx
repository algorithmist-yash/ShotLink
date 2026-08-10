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

const CREATOR_TYPES = [
  {
    index: "01",
    name: "Influencers & UGC creators",
    title: "One campaign link for every placement.",
    text: "Share a clean link across bios, stories, captions, brand briefs, and creator collaborations without losing the campaign signal.",
    accent: "violet",
    example: "shotlink.in/summer-drop",
  },
  {
    index: "02",
    name: "Models & photographers",
    title: "Share portfolios without the messy URL.",
    text: "Give casting teams, clients, and collaborators a memorable route to your latest portfolio, booking page, or campaign gallery.",
    accent: "lime",
    example: "shotlink.in/portfolio",
  },
  {
    index: "03",
    name: "Streamers, musicians & podcasters",
    title: "Launch once. Learn from every click.",
    text: "Route audiences to a new release, live stream, episode, ticket page, or sponsor offer and see which channel sends them.",
    accent: "orange",
    example: "shotlink.in/new-release",
  },
];

const INSTITUTION_FEATURES = [
  {
    index: "01",
    title: "Resource-aware publishing",
    text: "Recognise Google Sheets, forms, Drive documents, YouTube, Vimeo, Loom, and direct video files before an official link is published.",
    tag: "Sheets / Forms / Video",
  },
  {
    index: "02",
    title: "Official identity control",
    text: "Connect a verified link domain and, on the Institution plan, claim the university or organisation email domain for governed onboarding.",
    tag: "Domain governance",
  },
  {
    index: "03",
    title: "Expiry and fallback routes",
    text: "Time-limit admission notices, event forms, circulars, or recordings and send visitors to a safe fallback when a resource closes.",
    tag: "Lifecycle control",
  },
  {
    index: "04",
    title: "Roles and audit history",
    text: "Keep publishing actions inside a controlled workspace with owner, administrator, publisher, analyst, and viewer responsibilities.",
    tag: "Accountability",
  },
];

const CAPABILITIES = [
  {
    number: "001",
    title: "Creator campaign links",
    text: "Turn long post, shop, portfolio, booking, and sponsor URLs into clean links that are easier to remember and safer to share.",
    tags: ["Custom aliases", "Campaign labels", "Automatic expiry", "Fallback routes"],
  },
  {
    number: "002",
    title: "Branded creator identity",
    text: "Connect a branded domain on a paid plan so every campaign link feels like part of your public profile, not a random redirect.",
    tags: ["Custom domains", "Recognisable links", "Profile consistency", "Workspace control"],
  },
  {
    number: "003",
    title: "QR-ready launches",
    text: "Generate a QR code with the same short link for posters, event screens, product packaging, portfolios, and in-person collaborations.",
    tags: ["Instant QR", "Downloadable asset", "Online + offline", "Shared analytics"],
  },
  {
    number: "004",
    title: "Audience signals",
    text: "See clicks, devices, browsers, operating systems, referrers, and recent activity so the next post starts with better evidence.",
    tags: ["Click analytics", "Referrers", "Device mix", "Campaign exports"],
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Paste your destination",
    text: "Start with a post, video, portfolio, store, ticket, booking, episode, or sponsor URL you are authorised to share.",
  },
  {
    step: "02",
    title: "Make the short link + QR",
    text: "Choose an expiry for a quick link, or create a workspace for a permanent campaign link and downloadable QR code.",
  },
  {
    step: "03",
    title: "Share it everywhere",
    text: "Use the same campaign route across bios, stories, captions, DMs, print, event screens, and collaboration briefs.",
  },
  {
    step: "04",
    title: "Learn and improve",
    text: "Read click and referrer signals, protect the route with fallbacks, and carry what worked into the next launch.",
  },
];

const FAQS = [
  {
    question: "Can I try Shotlink without paying?",
    answer:
      "Yes. You can create a temporary short link and QR code from the homepage, or register a free workspace for up to 10 active links and basic analytics. Live paid checkout is not enabled yet.",
  },
  {
    question: "How long can a temporary link stay active?",
    answer:
      "You can choose 5, 10, 15, or 30 minutes. The link and its QR code stop routing automatically when that time ends. Use a workspace when a campaign needs a permanent route.",
  },
  {
    question: "Can I use the QR code offline?",
    answer:
      "Yes. Download it for portfolios, event screens, posters, packaging, or media kits. It opens the same destination and follows the same expiry rules as the short link.",
  },
  {
    question: "What audience insights will I see?",
    answer:
      "Workspace analytics can show clicks, device categories, browsers, operating systems, referrers, route status, and recent activity for your links.",
  },
  {
    question: "Is Studio meant for a talent manager or creator team?",
    answer:
      "Yes. Studio is designed for managers, agencies, photographers, and small creator teams coordinating multiple profiles, branded domains, QR assets, and campaign exports.",
  },
  {
    question: "Do universities and institutions get the creator dashboard?",
    answer:
      "No. Institution workspaces use a separate official-publishing interface with resource recognition, link lifecycle controls, identity-domain governance, roles, and audit history.",
  },
];

function Arrow({ diagonal = false }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}

function CreatorConsole() {
  return (
    <div className="mk-console" aria-label="Creator campaign preview">
      <div className="mk-console-bar">
        <div className="mk-console-dots" aria-hidden="true"><i /><i /><i /></div>
        <span>app.shotlink.in / campaigns</span>
        <span className="mk-console-live"><i /> campaign live</span>
      </div>
      <div className="mk-console-body">
        <aside className="mk-console-rail" aria-hidden="true">
          <span className="is-active">SL</span><span>01</span><span>02</span><span>03</span><span>04</span>
        </aside>
        <div className="mk-console-main">
          <div className="mk-console-heading">
            <div><small>SUMMER DROP</small><strong>Campaign overview</strong></div>
            <button type="button" tabIndex={-1}>New link +</button>
          </div>
          <div className="mk-domain-record">
            <div className="mk-domain-name"><span>IG</span><div><strong>@yourprofile</strong><small>Creator workspace</small></div></div>
            <span className="mk-verified"><i /> live</span>
          </div>
          <div className="mk-policy-grid">
            <article><small>CAMPAIGN LINK</small><strong>shotlink.in/summer</strong><span>Primary route active</span></article>
            <article><small>AUDIENCE SIGNALS</small><strong>12.8K clicks</strong><span>Instagram leads today</span></article>
            <article><small>QR KIT</small><strong>Ready to share</strong><span>Print asset downloaded</span></article>
          </div>
          <div className="mk-console-log">
            <div><span>10:42</span><strong>campaign.clicked</strong><small>instagram.com / mobile</small></div>
            <div><span>10:44</span><strong>link.created</strong><small>/summer-drop</small></div>
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

function InstitutionWorkspace({ onStart }) {
  return (
    <section className="mk-institutions mk-section" id="institutions">
      <div className="mk-institution-intro">
        <div>
          <p>University and institution workspace</p>
          <h2>Official resources need<br />official controls.</h2>
        </div>
        <div>
          <span>
            This is not a creator dashboard with different wording. It is a separate publishing
            workflow for universities, government teams, and larger organisations.
          </span>
          <button type="button" onClick={() => onStart("institution")}>
            Create an institution workspace <Arrow />
          </button>
        </div>
      </div>
      <div className="mk-institution-grid">
        {INSTITUTION_FEATURES.map((feature) => (
          <article key={feature.index}>
            <div><span>{feature.index}</span><small>{feature.tag}</small></div>
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
          </article>
        ))}
      </div>
      <div className="mk-institution-resource-strip" aria-label="Recognised institution resource types">
        <span>Google Sheets</span><span>Google Forms</span><span>Drive documents</span>
        <span>YouTube</span><span>Vimeo</span><span>Loom</span>
      </div>
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
        <a href="/#institutions">Institutions</a>
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
          <a href="/#institutions" onClick={closeMenu}>Institutions</a>
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
          <span>Two purpose-built link workspaces</span>
          <span>Creators · Universities · Institutions</span>
        </div>
        <div className="mk-hero-copy">
          <p className="mk-kicker"><i /> Built for public campaigns and official resources.</p>
          <h1>One link platform.<br /><em>Two different workspaces.</em></h1>
          <div className="mk-hero-bottom">
            <p>
              Creators get campaign links, QR assets, and audience signals. Universities and
              institutions get official resource publishing, destination recognition, governance,
              expiry, and audit controls.
            </p>
            <div className="mk-hero-actions">
              <a className="mk-primary-button" href="#create">
                Create a free link <Arrow />
              </a>
              <a className="mk-secondary-button" href="#creators">
                Compare workspaces <Arrow diagonal />
              </a>
            </div>
          </div>
        </div>
        <CreatorConsole />
        <div className="mk-hero-footnote">
          <span>Instant QR generation</span><span>Automatic expiry</span><span>Destination-aware publishing</span>
        </div>
      </section>

      <TemporaryLinkStudio onStart={onStart} />
      <CreatorPlans onStart={onStart} />
      <InstitutionWorkspace onStart={onStart} />

      <section className="mk-statement mk-section" id="solutions">
        <div className="mk-statement-label"><span>Why Shotlink</span><strong>01 / 05</strong></div>
        <div className="mk-statement-copy">
          <h2>Give every shared destination <em>the right publishing workflow.</em></h2>
          <p>
            Creator links are organised around campaigns and audiences. Institution links are
            organised around official resources, identity, expiry, roles, and accountability.
          </p>
        </div>
      </section>

      <section className="mk-sector-section mk-section">
        <div className="mk-section-heading mk-section-heading-row">
          <div><p>Made for creator work</p><h2>Every format.<br />One campaign layer.</h2></div>
          <span>Designed for people building an audience across more than one platform.</span>
        </div>
        <div className="mk-sector-grid">
          {CREATOR_TYPES.map((sector) => (
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

      <section className="mk-capabilities mk-section" id="features">
        <div className="mk-section-heading mk-section-heading-row">
          <div><p>What creators get</p><h2>Publish fast.<br />Learn what travels.</h2></div>
          <span>Four connected tools take a destination from first share to measurable campaign.</span>
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
          <p>Post-to-performance workflow</p>
          <h2>From long URL to useful audience signal.</h2>
          <span>
            Use one repeatable workflow for a quick post, a portfolio handoff, a brand
            collaboration, a product drop, or a full creator campaign.
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
          <p>Creator-safe by design</p>
          <h2>Your audience deserves a link they can trust.</h2>
          <span>
            The platform already enforces secure browser sessions, CSRF protection, workspace
            roles, destination authority consent, branded-domain verification, and audit events.
          </span>
          <a href="/trust">Open the trust center <Arrow diagonal /></a>
        </div>
        <div className="mk-proof-grid">
          <article><strong>01</strong><h3>Destination consent</h3><p>Every creator confirms they are authorised to share the destination.</p></article>
          <article><strong>02</strong><h3>Private workspace</h3><p>Links, analytics, domains, and events stay scoped to the owning account.</p></article>
          <article><strong>03</strong><h3>Trusted routing</h3><p>HTTPS links and verified branded domains give audiences a consistent route.</p></article>
          <article><strong>04</strong><h3>Traceable actions</h3><p>Workspace and link changes create an activity record for safer teamwork.</p></article>
        </div>
      </section>

      <section className="mk-cta-panel mk-section">
        <div>
          <p>Your next campaign</p>
          <h2>Bring the destination.<br />Shotlink makes it shareable.</h2>
        </div>
        <button type="button" onClick={onStart}>Create your free workspace <Arrow /></button>
      </section>

      <section className="mk-faq mk-section">
        <div className="mk-section-heading mk-section-heading-row">
          <div><p>FAQ</p><h2>Before your<br />first campaign.</h2></div>
          <span>Clear answers for creators, talent teams, universities, agencies, and institutions.</span>
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
          <p>Purpose-built creator campaigns and official institution resource links on one secure routing platform.</p>
          <a href="mailto:support@shotlink.in">support@shotlink.in</a>
          <a href="tel:+918797053635">+91 87970 53635</a>
        </div>
        <div className="mk-footer-column">
          <strong>Platform</strong><a href="/#create">Quick link</a><a href="/#creators">Creators</a><a href="/#institutions">Institutions</a><a href="/pricing">Pricing</a>
        </div>
        <div className="mk-footer-column">
          <strong>Legal</strong><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/shipping-policy">Digital delivery</a><a href="/refund-policy">Cancellations &amp; refunds</a>
        </div>
        <div className="mk-footer-column">
          <strong>Shotlink</strong><button type="button" onClick={onStart}>Create workspace</button><a href="/trust">Trust centre</a><a href="/contact">Contact</a><a href="/login">Sign in</a>
        </div>
      </div>
      <div className="mk-footer-bottom">
        <span>© 2026 Shotlink. All rights reserved.</span><span>Built in India for creators and institutions.</span>
      </div>
    </footer>
  );
}
