import { useMemo, useState } from "react";
import { BrandLogo } from "./BrandLogo";
import "./PublicMarketing.css";

const BENEFITS = [
  { icon: "∞", title: "Free forever plan", text: "Up to 1,000 branded links" },
  { icon: "◎", title: "Custom domain support", text: "Use your own domain name" },
  { icon: "▣", title: "No credit card required", text: "Start creating links instantly" },
  { icon: "▥", title: "Rich analytics included", text: "Track clicks and performance" },
];

const INDUSTRIES = [
  { icon: "▰", label: "Transportation & Logistics" },
  { icon: "◩", label: "Retail & E-commerce" },
  { icon: "◆", label: "Technology & AI" },
  { icon: "◒", label: "Food & Hospitality" },
  { icon: "▱", label: "Government & Public Sector" },
  { icon: "▶", label: "Media & Entertainment" },
  { icon: "◫", label: "Finance & Banking" },
  { icon: "✚", label: "Healthcare & Pharma" },
];

const FEATURES = [
  {
    icon: "↗",
    title: "Advanced analytics",
    text: "Track clicks, conversions, and user behavior with detailed insights and real-time reporting.",
    href: "/docs",
    tone: "mint",
  },
  {
    icon: "◎",
    title: "Custom domains",
    text: "Use your own branded domain to create professional short links that build trust.",
    href: "/docs",
    tone: "blue",
  },
  {
    icon: "♧",
    title: "Team collaboration",
    text: "Work together with your team, manage permissions, and share link analytics.",
    href: "/docs",
    tone: "violet",
  },
  {
    icon: "▦",
    title: "QR codes",
    text: "Generate dynamic QR codes that can be edited anytime without reprinting.",
    href: "/docs",
    tone: "amber",
  },
  {
    icon: "{ }",
    title: "API access",
    text: "Integrate Shotlink into your applications with our reliable, versioned REST API.",
    href: "/docs",
    tone: "rose",
  },
  {
    icon: "☷",
    title: "Link management",
    text: "Organize, edit, and manage thousands of links with bulk operations and tags.",
    href: "/docs",
    tone: "cyan",
  },
];

const PRODUCT_STEPS = [
  {
    id: "01",
    title: "Shorten links instantly",
    text: "Create branded short links in seconds with custom aliases and domains.",
  },
  {
    id: "02",
    title: "Track performance",
    text: "Monitor clicks, locations, devices, and referrers in real time.",
  },
  {
    id: "03",
    title: "Route around failures",
    text: "Keep campaigns online with ordered, health-aware fallback destinations.",
  },
  {
    id: "04",
    title: "Collaborate with teams",
    text: "Share workspaces, set permissions, and work together seamlessly.",
  },
];

const INTEGRATIONS = [
  { mark: "Z", name: "Zapier", tone: "orange" },
  { mark: "#", name: "Slack", tone: "violet" },
  { mark: "G", name: "Google Analytics", tone: "amber" },
  { mark: "M", name: "Meta Pixel", tone: "blue" },
  { mark: "M", name: "Mailchimp", tone: "yellow" },
  { mark: "A", name: "Google Ads", tone: "green" },
  { mark: "●", name: "Google Chrome", tone: "multi" },
  { mark: "W", name: "WordPress", tone: "navy" },
  { mark: "i", name: "iOS app", tone: "black" },
  { mark: "M", name: "Make", tone: "purple" },
  { mark: "A", name: "Android app", tone: "lime" },
  { mark: "S", name: "Segment", tone: "charcoal" },
];

const TEAMS = [
  {
    name: "Marketing teams",
    title: "Campaign insights without spreadsheet chaos",
    text: "Track campaign performance and optimize conversions from one live view.",
    points: ["Campaign tracking", "A/B testing", "ROI measurement", "Conversion optimization"],
  },
  {
    name: "Sales teams",
    title: "Links your entire revenue team can trust",
    text: "Give every rep branded routes with clear engagement and attribution.",
    points: ["Branded outreach", "Regional routing", "Lead attribution", "Shared workspaces"],
  },
  {
    name: "Infrastructure teams",
    title: "Reliable routing controls for critical traffic",
    text: "Operate domains, redirects, API workflows, and fallbacks at scale.",
    points: ["Health-aware routing", "Domain controls", "API automation", "Abuse protection"],
  },
];

const STATS = [
  { value: "13B+", label: "Links created" },
  { value: "100B+", label: "Clicks tracked" },
  { value: "1.2M+", label: "Active users" },
  { value: "10+", label: "Years of link expertise" },
];

const FAQS = [
  {
    question: "How do I get started with Shotlink?",
    answer:
      "Create a free workspace, paste your destination, choose an optional custom alias, and publish your first link.",
  },
  {
    question: "Can I use my own domain?",
    answer:
      "Yes. Paid workspaces can connect and verify branded domains with the DNS records shown in the dashboard.",
  },
  {
    question: "What analytics are available?",
    answer:
      "Track clicks, devices, browsers, operating systems, referrers, recent events, and route health.",
  },
  {
    question: "Is there an API available?",
    answer:
      "Yes. Shotlink provides a versioned API for creating links and integrating link workflows into your products.",
  },
  {
    question: "How secure are my links?",
    answer:
      "Account sessions are encrypted, write actions are CSRF protected, and abusive destinations can be suspended.",
  },
  {
    question: "What is included in the free plan?",
    answer:
      "The free plan includes active short links, QR codes, and basic click analytics without a credit card.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes. Cancellation can be scheduled from Billing and access continues through the paid billing period.",
  },
  {
    question: "What is smart fallback routing?",
    answer:
      "You can add ordered backup destinations so traffic can continue when a primary campaign page is unavailable.",
  },
];

function ArrowIcon() {
  return <span aria-hidden="true">→</span>;
}

function LandingShortener({ onStart }) {
  const [longUrl, setLongUrl] = useState("");
  const [shortCode, setShortCode] = useState("summer-sale");

  const shortUrl = useMemo(() => `shot.link/${shortCode}`, [shortCode]);

  const createPreview = (event) => {
    event.preventDefault();
    if (!longUrl.trim()) {
      onStart();
      return;
    }

    try {
      const hostname = new URL(longUrl).hostname.replace(/^www\./, "").split(".")[0];
      const normalized = hostname.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 18);
      setShortCode(normalized ? `${normalized}-link` : "smart-link");
    } catch {
      setShortCode("smart-link");
    }
  };

  return (
    <form className="mk-shortener-card" onSubmit={createPreview}>
      <div className="mk-shortener-heading">
        <span className="mk-link-glyph" aria-hidden="true">↗</span>
        <h2>Shorten your link</h2>
      </div>
      <div className="mk-shortener-row">
        <label className="mk-visually-hidden" htmlFor="marketing-url">
          Paste your long URL
        </label>
        <input
          id="marketing-url"
          type="url"
          value={longUrl}
          placeholder="Paste your long URL here..."
          onChange={(event) => setLongUrl(event.target.value)}
        />
        <button type="submit">Shorten <ArrowIcon /></button>
      </div>
      <div className="mk-shortener-result" aria-live="polite">
        <div>
          <span>Your short link:</span>
          <strong>https://{shortUrl}</strong>
        </div>
        <button type="button" className="mk-customize-button" onClick={onStart}>
          ✎ Customize
        </button>
      </div>
      <p className="mk-domain-prompt">
        <span aria-hidden="true">◎</span>
        Want your own domain?
        <button type="button" onClick={onStart}>Create free account</button>
      </p>
    </form>
  );
}

function DashboardPreview({ activeStep }) {
  return (
    <div className="mk-dashboard-window" aria-label={`${activeStep.title} product preview`}>
      <div className="mk-window-topbar">
        <div className="mk-window-dots"><span /><span /><span /></div>
        <span>app.shotlink.in</span>
        <span className="mk-window-avatar">YS</span>
      </div>
      <div className="mk-window-body">
        <aside className="mk-window-sidebar">
          <BrandLogo compact />
          <span className="is-active">⌂</span>
          <span>↗</span>
          <span>▥</span>
          <span>◎</span>
          <span>⚙</span>
        </aside>
        <div className="mk-window-content">
          <div className="mk-window-content-head">
            <div>
              <small>Workspace overview</small>
              <strong>{activeStep.title}</strong>
            </div>
            <button type="button">Create link</button>
          </div>
          <div className="mk-window-metrics">
            <article><span>Total clicks</span><strong>24,892</strong><small>+18.4%</small></article>
            <article><span>Active links</span><strong>1,248</strong><small>+8.2%</small></article>
            <article><span>Conversion</span><strong>12.8%</strong><small>+3.1%</small></article>
          </div>
          <div className="mk-window-lower">
            <div className="mk-window-chart">
              <div className="mk-chart-header"><strong>Click activity</strong><span>Last 30 days</span></div>
              <div className="mk-chart-grid">
                {[36, 52, 44, 68, 58, 81, 66, 88, 72, 96, 84, 104].map((height, index) => (
                  <i key={`${height}-${index}`} style={{ height }} />
                ))}
              </div>
            </div>
            <div className="mk-window-links">
              <strong>Top links</strong>
              <p><span>shot.link/launch</span><b>8.2k</b></p>
              <p><span>shot.link/summer</span><b>6.7k</b></p>
              <p><span>shot.link/product</span><b>4.1k</b></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicHeader({ onLogin, onStart }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="mk-header">
      <a className="mk-header-logo" href="/" aria-label="Shotlink home">
        <BrandLogo />
      </a>
      <nav className="mk-desktop-nav" aria-label="Primary navigation">
        <a href="/pricing">Pricing</a>
        <a href="/#features">Features</a>
        <a href="/#integrations">Integrations</a>
        <a href="/#enterprise">Enterprise</a>
        <a href="/docs">Tools <span aria-hidden="true">⌄</span></a>
        <a href="/docs">Blog</a>
        <a href="/docs">Help</a>
      </nav>
      <div className="mk-header-actions">
        <button type="button" className="mk-language-button" aria-label="Change language">
          <span aria-hidden="true">◎</span> EN <span aria-hidden="true">⌄</span>
        </button>
        <button type="button" className="mk-login-button" onClick={onLogin}>Sign in</button>
        <button type="button" className="mk-nav-cta" onClick={onStart}>Get started</button>
      </div>
      <button
        type="button"
        className="mk-menu-button"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      {menuOpen ? (
        <nav className="mk-mobile-menu" aria-label="Mobile navigation">
          <a href="/pricing">Pricing</a>
          <a href="/#features">Features</a>
          <a href="/#integrations">Integrations</a>
          <a href="/#enterprise">Enterprise</a>
          <a href="/docs">Tools</a>
          <a href="/docs">Help</a>
          <button type="button" onClick={onLogin}>Sign in</button>
          <button type="button" className="mk-mobile-cta" onClick={onStart}>Get started</button>
        </nav>
      ) : null}
    </header>
  );
}

export function PublicLanding({ onStart }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const activeStep = PRODUCT_STEPS[activeStepIndex];
  const activeTeam = TEAMS[activeTeamIndex];

  return (
    <div className="mk-page">
      <section className="mk-hero">
        <div className="mk-hero-grid">
          <div className="mk-hero-copy">
            <p className="mk-kicker">Free plan available <span>•</span> No credit card required</p>
            <h1>URL shortener with <em>smart fallback routing</em></h1>
            <p className="mk-hero-lead">
              Create branded short links with your custom domain or use ours. Track every click,
              generate QR codes, and keep campaigns online with intelligent backup destinations.
            </p>
            <div className="mk-hero-actions">
              <button type="button" className="mk-primary-button" onClick={onStart}>
                Create free account <ArrowIcon />
              </button>
              <a className="mk-secondary-button" href="#product-demo">
                View demo <span className="mk-play-icon" aria-hidden="true">▷</span>
              </a>
            </div>
            <div className="mk-trustpilot" aria-label="Excellent rating">
              <div>
                <strong>Excellent</strong>
                <span className="mk-stars">★★★★★</span>
              </div>
              <p><u>86 reviews on</u> <b>★</b> Trustpilot</p>
            </div>
          </div>
          <LandingShortener onStart={onStart} />
        </div>
      </section>

      <section className="mk-benefits" aria-label="Free plan benefits">
        {BENEFITS.map((benefit) => (
          <article key={benefit.title}>
            <span className="mk-benefit-icon" aria-hidden="true">{benefit.icon}</span>
            <div><strong>{benefit.title}</strong><p>{benefit.text}</p></div>
          </article>
        ))}
      </section>

      <section className="mk-industry-band" aria-label="Customer industries">
        <p>
          Used by ambitious companies and startups worldwide
          <span>Client confidentiality</span>
        </p>
        <div className="mk-industry-track">
          {INDUSTRIES.map((industry) => (
            <div key={industry.label}>
              <span aria-hidden="true">{industry.icon}</span>
              <strong>{industry.label}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section mk-features" id="features">
        <div className="mk-section-heading">
          <h2>Everything you need to manage links</h2>
          <p>Advanced link management tools that help you track performance and optimize campaigns.</p>
        </div>
        <div className="mk-feature-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="mk-feature-card">
              <span className={`mk-feature-icon is-${feature.tone}`} aria-hidden="true">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
              <a href={feature.href}>Learn more <ArrowIcon /></a>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section mk-product" id="product-demo">
        <div className="mk-section-heading">
          <h2>See Shotlink in action</h2>
          <p>Discover how easy it is to create, manage, and track your links.</p>
        </div>
        <div className="mk-product-grid">
          <div className="mk-product-tabs" role="tablist" aria-label="Product capabilities">
            {PRODUCT_STEPS.map((step, index) => (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={activeStepIndex === index}
                className={activeStepIndex === index ? "is-active" : ""}
                onClick={() => setActiveStepIndex(index)}
              >
                <span>{step.id}</span>
                <div><strong>{step.title}</strong><p>{step.text}</p></div>
              </button>
            ))}
          </div>
          <DashboardPreview activeStep={activeStep} />
        </div>
      </section>

      <section className="mk-section mk-integrations" id="integrations">
        <div className="mk-section-heading">
          <h2>Connect with your favorite tools</h2>
          <p>Connect Shotlink to your existing tools with ready-made integrations and API access.</p>
        </div>
        <div className="mk-integration-grid">
          {INTEGRATIONS.map((integration) => (
            <article key={integration.name}>
              <span className={`is-${integration.tone}`}>{integration.mark}</span>
              <strong>{integration.name}</strong>
            </article>
          ))}
        </div>
        <a className="mk-outline-link" href="/docs">View all integrations <ArrowIcon /></a>
      </section>

      <section className="mk-section mk-teams" id="enterprise">
        <div className="mk-section-heading">
          <h2>Built for every team</h2>
          <p>See how different teams use Shotlink to achieve their goals.</p>
        </div>
        <div className="mk-team-tabs" role="tablist" aria-label="Teams">
          {TEAMS.map((team, index) => (
            <button
              key={team.name}
              type="button"
              role="tab"
              aria-selected={activeTeamIndex === index}
              className={activeTeamIndex === index ? "is-active" : ""}
              onClick={() => setActiveTeamIndex(index)}
            >
              {team.name}
            </button>
          ))}
        </div>
        <div className="mk-team-panel">
          <div className="mk-team-visual" aria-hidden="true">
            <div className="mk-team-chart">
              <div><span>Campaign activity</span><strong>32.4k</strong></div>
              <div className="mk-team-line">
                {[22, 30, 28, 48, 42, 64, 58, 76, 70, 88].map((value, index) => (
                  <i key={`${value}-${index}`} style={{ height: value }} />
                ))}
              </div>
            </div>
            <div className="mk-floating-stat"><span>Conversion</span><strong>+18.4%</strong></div>
          </div>
          <div className="mk-team-copy">
            <span className="mk-team-badge">{activeTeam.name}</span>
            <h3>{activeTeam.title}</h3>
            <p>{activeTeam.text}</p>
            <ul>
              {activeTeam.points.map((point) => <li key={point}>✓ {point}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="mk-stats">
        <div className="mk-section-heading">
          <h2>Trusted at scale</h2>
          <p>Marketing teams, developers, and businesses rely on Shotlink to track what matters.</p>
        </div>
        <div className="mk-stat-grid">
          {STATS.map((stat) => (
            <article key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></article>
          ))}
        </div>
      </section>

      <section className="mk-section mk-testimonial">
        <div className="mk-section-heading">
          <h2>Loved by teams worldwide</h2>
          <p>See what campaign teams have to say about resilient short links.</p>
        </div>
        <article className="mk-quote-card">
          <div className="mk-quote-stars">★★★★★</div>
          <blockquote>
            “Shotlink gives us a clean way to manage campaign URLs, understand where clicks come
            from, and keep traffic moving when a destination needs attention.”
          </blockquote>
          <div className="mk-quote-author">
            <span>YM</span>
            <div><strong>Growth operations lead</strong><small>Digital commerce team</small></div>
          </div>
        </article>
      </section>

      <section className="mk-section mk-faq">
        <div className="mk-section-heading">
          <h2>Frequently asked questions</h2>
          <p>Can’t find what you’re looking for? <a href="mailto:support@shotlink.in">Contact support</a>.</p>
        </div>
        <div className="mk-faq-list">
          {FAQS.map((item) => (
            <details key={item.question}>
              <summary>{item.question}<span aria-hidden="true">+</span></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mk-final-cta">
        <div className="mk-cta-orb is-one" />
        <div className="mk-cta-orb is-two" />
        <div className="mk-cta-content">
          <h2>Ready to get started?</h2>
          <p>Join modern teams creating measurable, resilient links with Shotlink.</p>
          <div>
            <button type="button" className="mk-primary-button" onClick={onStart}>
              Get started for free <ArrowIcon />
            </button>
            <a className="mk-secondary-button" href="#product-demo">View demo <span aria-hidden="true">▷</span></a>
          </div>
          <ul>
            <li>✓ No credit card required</li>
            <li>✓ Free plan forever</li>
            <li>✓ Upgrade anytime</li>
            <li>✓ Fast support response</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export function PublicFooter({ onStart }) {
  return (
    <footer className="mk-footer">
      <div className="mk-footer-main">
        <div className="mk-footer-brand">
          <BrandLogo />
          <p>Branded short links, QR codes, analytics, and resilient routing for modern teams.</p>
          <a href="mailto:support@shotlink.in">support@shotlink.in</a>
        </div>
        <div className="mk-footer-column">
          <strong>Product</strong>
          <a href="/#features">Features</a>
          <a href="/#integrations">Apps and integrations</a>
          <a href="/pricing">Pricing</a>
          <button type="button" onClick={onStart}>Create account</button>
        </div>
        <div className="mk-footer-column">
          <strong>Resources</strong>
          <a href="/docs">API for developers</a>
          <a href="/docs">Documentation</a>
          <a href="/trust">System status</a>
          <a href="/trust">Trust center</a>
        </div>
        <div className="mk-footer-column">
          <strong>Company</strong>
          <a href="/trust">About Shotlink</a>
          <a href="mailto:support@shotlink.in">Contact us</a>
          <a href="/trust">Report abuse</a>
          <a href="/trust">Privacy</a>
        </div>
      </div>
      <div className="mk-footer-bottom">
        <span>© 2026 Shotlink. All rights reserved.</span>
        <div><a href="/trust">Terms & conditions</a><a href="/trust">Privacy policy</a></div>
      </div>
    </footer>
  );
}
