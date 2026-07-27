import { useCallback, useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(
  /\/$/,
  ""
);
const STORAGE_KEY = "url-shortener-session-token";
const ACCOUNT_POLICY_VERSION = "2026-05-19";
const LINK_POLICY_VERSION = "2026-05-19";
const BRAND_LOGO_SRC = "/shotlink-logo.png";
const BRAND_SYMBOL_SRC = "/shotlink-symbol.png";

const PUBLIC_NAV_ITEMS = [
  { id: "home", label: "Platform", href: "#" },
  { id: "pricing", label: "Pricing", href: "#pricing" },
  { id: "docs", label: "Resources", href: "#docs" },
  { id: "legal", label: "Trust", href: "#legal" },
];

const DASHBOARD_NAV_ITEMS = [
  { id: "builder-panel", label: "Create" },
  { id: "analytics-panel", label: "Analytics" },
  { id: "billing-panel", label: "Billing" },
  { id: "domains-panel", label: "Domains" },
  { id: "docs-panel", label: "Docs" },
];

const HOME_FEATURES = [
  "Short links",
  "Custom aliases",
  "QR codes",
  "Analytics",
];

const DOC_SECTIONS = [
  {
    title: "Create links",
    body: "Sign in, paste a destination URL, choose expiry, then create a Shotlink.",
  },
  {
    title: "Track results",
    body: "Open the analytics panel to monitor clicks, devices, referrers, and route health.",
  },
  {
    title: "Use domains",
    body: "Connect a branded domain with CNAME and TXT records, then verify it in the dashboard.",
  },
  {
    title: "Handle billing",
    body: "Upgrade from the billing panel and wait for the payment webhook to update your plan.",
  },
];

const LEGAL_SECTIONS = [
  {
    title: "Terms",
    body: "Use Shotlink only for destinations you own or are authorized to share.",
  },
  {
    title: "Privacy",
    body: "We process account, billing, and link analytics data to operate the service.",
  },
  {
    title: "Abuse",
    body: "Phishing, malware, spam, impersonation, and illegal content are not allowed.",
  },
  {
    title: "Support",
    body: "For help, takedowns, or privacy requests, contact support@shotlink.in.",
  },
];

const LANDING_METRICS = [
  { label: "Avg. redirect target", value: "<50ms", hint: "cache-first architecture" },
  { label: "Route checks", value: "24/7", hint: "health-aware fallbacks" },
  { label: "Data captured", value: "9+", hint: "device, referrer, geo signals" },
  { label: "Launch region", value: "India", hint: "built for local teams first" },
];

const PRODUCT_FEATURES = [
  {
    title: "URL shortener",
    body: "Paste a destination, reserve a readable alias, and publish a short link in seconds.",
    signal: "Shorten",
  },
  {
    title: "Branded links",
    body: "Use verified domains and human-friendly paths that customers can recognize.",
    signal: "Brand",
  },
  {
    title: "Analytics",
    body: "Track clicks, scans, devices, referrers, route health, and campaign performance.",
    signal: "Insights",
  },
  {
    title: "QR codes",
    body: "Generate a scannable QR code for every active short link and download it instantly.",
    signal: "Scan",
  },
];

const TRUST_SIGNALS = [
  "Encrypted account sessions",
  "Abuse policy and takedown flow",
  "Fallback destinations",
  "Consent-backed analytics",
];

const API_SNIPPET_LINES = [
  "POST /api/v1/links",
  "Authorization: Bearer sk_live_...",
  "{",
  '  "originalUrl": "https://example.com/campaign",',
  '  "customAlias": "summer-sale",',
  '  "fallbackUrls": ["https://backup.example.com"],',
  '  "expiresInMinutes": 10080',
  "}",
];

const REQUIRED_AUTH_CONSENTS = [
  {
    id: "ageConfirmed",
    label: "I confirm I am 18+ or legally allowed to use this service.",
  },
  {
    id: "termsAccepted",
    label: "I agree to the Terms of Service and paid-plan rules.",
  },
  {
    id: "privacyAccepted",
    label: "I have read the Privacy Notice for account, billing, and support data.",
  },
  {
    id: "analyticsAccepted",
    label:
      "I understand link visits collect time, device type, browser, OS, referrer, and hashed IP for analytics, security, and abuse prevention.",
  },
  {
    id: "lawfulUseAccepted",
    label:
      "I agree not to use this service for spam, phishing, malware, impersonation, illegal content, or misleading links.",
  },
];

function createDefaultConsents() {
  return {
    ageConfirmed: false,
    termsAccepted: false,
    privacyAccepted: false,
    analyticsAccepted: false,
    lawfulUseAccepted: false,
    marketingOptIn: false,
  };
}

const EXPIRY_OPTIONS = [
  { label: "5 minutes", value: 5 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1 day", value: 1440 },
  { label: "7 days", value: 10080 },
];

const DEFAULT_PUBLIC_PLANS = [
  {
    id: "free",
    name: "Free",
    priceInPaise: 0,
    currency: "INR",
    intervalMonths: 0,
    linkLimit: 10,
    clickLimit: 500,
    domainLimit: 0,
    teamMemberLimit: 1,
    apiCallLimit: 0,
    qrCodeLimit: 5,
    features: [
      "Up to 10 active links",
      "Basic click analytics",
      "Shotlink-branded QR codes",
      "No branded domain",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceInPaise: 119900,
    currency: "INR",
    intervalMonths: 1,
    linkLimit: 500,
    clickLimit: 25000,
    domainLimit: 1,
    teamMemberLimit: 3,
    apiCallLimit: 10000,
    qrCodeLimit: 250,
    features: [
      "Up to 500 active links",
      "1 branded domain",
      "Editable destinations and fallback routing",
      "Advanced analytics",
      "Priority email support",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceInPaise: 999900,
    currency: "INR",
    intervalMonths: 1,
    linkLimit: 10000,
    clickLimit: 500000,
    domainLimit: 10,
    teamMemberLimit: 25,
    apiCallLimit: 250000,
    qrCodeLimit: 5000,
    features: [
      "Up to 10000 active links",
      "Up to 10 branded domains",
      "Team workspaces",
      "Campaign analytics and exports",
      "Priority onboarding support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceInPaise: 0,
    currency: "INR",
    intervalMonths: 0,
    linkLimit: 1000000,
    clickLimit: 100000000,
    domainLimit: 100,
    teamMemberLimit: 1000,
    apiCallLimit: 10000000,
    qrCodeLimit: 100000,
    features: [
      "Custom link and click volume",
      "SSO, SCIM, RBAC, and audit logs",
      "Dedicated success and security review",
      "Custom SLA and procurement support",
    ],
  },
];

function formatPriceInInr(amountInPaise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInPaise / 100);
}

function formatPlanPrice(plan) {
  if (plan?.id === "enterprise") return "Custom";
  if (!plan?.priceInPaise) return "Free";

  const suffix =
    plan.intervalMonths === 1
      ? "/month"
      : plan.intervalMonths
        ? `/${plan.intervalMonths} months`
        : "";

  return `${formatPriceInInr(plan.priceInPaise)}${suffix}`;
}

function formatUsageNumber(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getUsageLabel(key) {
  const labels = {
    links: "Links",
    clicks: "Clicks",
    domains: "Domains",
    teamMembers: "Team members",
    apiRequests: "API requests",
    qrCodes: "QR codes",
  };

  return labels[key] || formatLabel(key);
}

function formatLabel(value) {
  return String(value || "")
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value) {
  if (!value) return "Not available yet";

  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusPill({ label, tone = "neutral" }) {
  const tones = {
    healthy: { background: "rgba(16, 185, 129, 0.16)", color: "#bbf7d0" },
    warning: { background: "rgba(245, 158, 11, 0.18)", color: "#fde68a" },
    danger: { background: "rgba(239, 68, 68, 0.16)", color: "#fecaca" },
    neutral: { background: "rgba(255, 255, 255, 0.08)", color: "#f8fafc" },
    accent: { background: "rgba(37, 99, 235, 0.18)", color: "#dbeafe" },
  };

  const palette = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: palette.background,
        color: palette.color,
      }}
    >
      {label}
    </span>
  );
}

function DeviceBar({ item, total }) {
  const width = total ? `${Math.round((item.count / total) * 100)}%` : "0%";

  return (
    <div style={styles.deviceBar}>
      <div style={styles.deviceBarHeader}>
        <span style={styles.deviceBarLabel}>{item.deviceType}</span>
        <span style={styles.deviceBarCount}>{item.count}</span>
      </div>
      <div style={styles.deviceBarTrack}>
        <div style={{ ...styles.deviceBarFill, width }} />
      </div>
    </div>
  );
}

function UsageBar({ metric }) {
  if (!metric) return null;

  return (
    <div style={styles.usageBar}>
      <div style={styles.usageBarHeader}>
        <span style={styles.usageBarLabel}>{getUsageLabel(metric.key)}</span>
        <span style={styles.usageBarCount}>
          {formatUsageNumber(metric.used)} / {formatUsageNumber(metric.limit)}
        </span>
      </div>
      <div style={styles.usageBarTrack}>
        <div
          style={{
            ...styles.usageBarFill,
            width: `${metric.percentUsed || 0}%`,
            background:
            metric.percentUsed >= 90
                ? designTokens.colors.danger
                : metric.percentUsed >= 70
                  ? designTokens.colors.yellow
                  : designTokens.colors.blue,
          }}
        />
      </div>
      <p style={styles.miniHelperText}>{formatUsageNumber(metric.remaining)} remaining</p>
    </div>
  );
}

function ConsentCheckbox({ checked, onChange, children }) {
  return (
    <label style={styles.checkboxRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={styles.checkboxInput}
      />
      <span>{children}</span>
    </label>
  );
}

function BrandLogo({ compact = false, style }) {
  return (
    <img
      src={compact ? BRAND_SYMBOL_SRC : BRAND_LOGO_SRC}
      alt="Shotlink"
      style={{
        display: "block",
        objectFit: "contain",
        width: compact ? 58 : 220,
        height: compact ? 58 : 54,
        ...style,
      }}
    />
  );
}

function ShortenerPreview() {
  return (
    <div className="sl-lift" style={styles.shortenerPreviewCard}>
      <div style={styles.previewHeader}>
        <StatusPill label="Start now" tone="accent" />
        <span style={styles.previewDomain}>shot.link/summer-sale</span>
      </div>

      <div style={styles.previewForm}>
        <label style={styles.previewLabel}>
          Destination
          <div style={styles.previewInput}>https://brand.com/campaign/summer-launch</div>
        </label>
        <label style={styles.previewLabel}>
          Custom alias
          <div style={styles.previewAliasRow}>
            <span>shot.link/</span>
            <strong>summer-sale</strong>
          </div>
        </label>
        <button style={styles.previewButton}>Shorten URL</button>
      </div>

      <div style={styles.previewResultGrid}>
        <div style={styles.previewQr}>
          <QRCodeCanvas value="https://shot.link/summer-sale" size={92} includeMargin />
        </div>
        <div>
          <p style={styles.mutedLabel}>Ready to share</p>
          <p style={styles.previewShortLink}>shot.link/summer-sale</p>
          <div style={styles.inlineActions}>
            <span style={styles.previewMiniButton}>Copy</span>
            <span style={styles.previewMiniButton}>QR code</span>
            <span style={styles.previewMiniButton}>Analytics</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniTrafficChart() {
  const bars = [32, 52, 44, 78, 62, 91, 72, 96, 84, 104, 92, 116];

  return (
    <div style={styles.chartPreview} aria-label="Traffic chart preview">
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="sl-chart-bar"
          style={{ ...styles.chartBar, height }}
        />
      ))}
    </div>
  );
}

function getPublicPageFromHash() {
  const pageId = String(window.location.hash || "")
    .replace("#", "")
    .trim()
    .toLowerCase();

  return PUBLIC_NAV_ITEMS.some((item) => item.id === pageId) ? pageId : "home";
}

function getHealthTone(status) {
  if (status === "healthy") return "healthy";
  if (status === "unhealthy") return "danger";
  return "warning";
}

function getActiveTone(link) {
  if (!link) return "neutral";
  return link.isActive ? "healthy" : "danger";
}

function getPlanTone(planId) {
  if (planId === "business") return "healthy";
  if (planId === "pro") return "accent";
  return "neutral";
}

function getBillingTone(status) {
  if (status === "active") return "healthy";
  if (status === "pending" || status === "partially_paid") return "warning";
  if (status === "past_due" || status === "cancelled" || status === "expired") return "danger";
  return "neutral";
}

function scrollToDashboardSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function isUsableLink(link) {
  if (!link?.isActive) return false;
  if (!link.expiresAt) return true;
  return new Date(link.expiresAt).getTime() > Date.now();
}

export default function App() {
  const [authMode, setAuthMode] = useState("register");
  const [publicPage, setPublicPage] = useState(() => getPublicPageFromHash());
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [session, setSession] = useState(null);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    workspaceName: "",
    consents: createDefaultConsents(),
  });
  const [authLoading, setAuthLoading] = useState(Boolean(localStorage.getItem(STORAGE_KEY)));
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [links, setLinks] = useState([]);
  const [selectedShortCode, setSelectedShortCode] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [url, setUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [fallbackInput, setFallbackInput] = useState("");
  const [expiry, setExpiry] = useState(30);
  const [loading, setLoading] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [publicPlans, setPublicPlans] = useState(DEFAULT_PUBLIC_PLANS);
  const [billingSummary, setBillingSummary] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [checkoutLoadingPlanId, setCheckoutLoadingPlanId] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [domainMessage, setDomainMessage] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState("");
  const [selectedDomainHost, setSelectedDomainHost] = useState("");
  const [linkComplianceAccepted, setLinkComplianceAccepted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [colorMode, setColorMode] = useState(() => localStorage.getItem("shotlink-color-mode") || "light");
  const [showDocsPanel, setShowDocsPanel] = useState(false);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken("");
    setSession(null);
    setLinks([]);
    setSelectedShortCode("");
    setAnalytics(null);
    setBillingSummary(null);
    setBillingMessage("");
    setBillingLoading(false);
    setCheckoutLoadingPlanId("");
    setCustomDomainInput("");
    setDomainMessage("");
    setDomainSaving(false);
    setDomainVerifying("");
    setSelectedDomainHost("");
    setLinkComplianceAccepted(false);
  }, []);

  const authorizedFetch = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        clearSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      return response;
    },
    [clearSession, token]
  );

  const fetchBillingSummary = useCallback(async () => {
    const response = await authorizedFetch("/api/v1/billing/summary");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load billing");
    }

    return data;
  }, [authorizedFetch]);

  const applyBillingSummary = useCallback((data) => {
    setBillingSummary(data);
    if (data.plans?.length) {
      setPublicPlans(data.plans);
    }
    setSession((currentSession) =>
      currentSession
        ? {
            ...currentSession,
            workspace: {
              ...currentSession.workspace,
              plan: data.currentPlan?.configuredPlanId || currentSession.workspace.plan,
              billing: data.currentPlan || currentSession.workspace.billing,
            },
          }
        : currentSession
    );
  }, []);

  const applyWorkspaceSettings = useCallback((data) => {
    if (!data.workspace) return;

    setSession((currentSession) =>
      currentSession
        ? {
            ...currentSession,
            workspace: {
              ...currentSession.workspace,
              ...data.workspace,
            },
          }
        : currentSession
    );
  }, []);

  useEffect(() => {
    const updatePublicPage = () => setPublicPage(getPublicPageFromHash());
    updatePublicPage();
    window.addEventListener("hashchange", updatePublicPage);
    return () => window.removeEventListener("hashchange", updatePublicPage);
  }, []);

  useEffect(() => {
    document.title = publicPage === "home" ? "Shotlink" : `Shotlink | ${formatLabel(publicPage)}`;
  }, [publicPage]);

  useEffect(() => {
    const updateLayout = () => setIsMobile(window.innerWidth < 1080);
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    localStorage.setItem("shotlink-color-mode", colorMode);
    document.documentElement.dataset.shotlinkTheme = colorMode;
  }, [colorMode]);

  useEffect(() => {
    let cancelled = false;

    const loadPublicPlans = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/billing/plans`);
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setPublicPlans(data.plans?.length ? data.plans : DEFAULT_PUBLIC_PLANS);
        }
      } catch {
        // The default catalog is enough if billing is not reachable yet.
      }
    };

    const currentUrl = new URL(window.location.href);
    const referenceId = currentUrl.searchParams.get("billing_reference");
    const planId = currentUrl.searchParams.get("plan");

    if (referenceId) {
      setBillingMessage(
        `${formatLabel(planId || "payment")} checkout returned with reference ${referenceId}. Refresh billing in a few seconds to confirm payment.`
      );
      currentUrl.searchParams.delete("billing_reference");
      currentUrl.searchParams.delete("plan");
      const cleanedSearch = currentUrl.searchParams.toString();
      window.history.replaceState(
        {},
        "",
        `${currentUrl.pathname}${cleanedSearch ? `?${cleanedSearch}` : ""}${currentUrl.hash}`
      );
    }

    loadPublicPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!analytics?.expiresAt) {
      setCountdown("");
      return undefined;
    }

    const interval = setInterval(() => {
      const diff = new Date(analytics.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Expired");
        setAnalytics((currentAnalytics) =>
          currentAnalytics?.isActive ? { ...currentAnalytics, isActive: false } : currentAnalytics
        );
        setLinks((currentLinks) =>
          currentLinks.map((link) =>
            link.shortCode === selectedShortCode && link.isActive
              ? { ...link, isActive: false }
              : link
          )
        );
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(hours ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [analytics, selectedShortCode]);

  useEffect(() => {
    if (!token) {
      setSession(null);
      setAuthLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadSession = async () => {
      setAuthLoading(true);

      try {
        const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const data = await response.json();
        if (!cancelled) {
          setSession(data);
          setError("");
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [clearSession, token]);

  useEffect(() => {
    if (!session || !token) {
      setLinks([]);
      setSelectedShortCode("");
      setAnalytics(null);
      return undefined;
    }

    let cancelled = false;

    const loadLinks = async () => {
      setWorkspaceLoading(true);

      try {
        const response = await authorizedFetch("/api/v1/links");
        const data = await response.json();

        if (!cancelled) {
          const incomingLinks = data.links || [];
          const firstActiveShortCode = incomingLinks.find(isUsableLink)?.shortCode || "";

          setLinks(incomingLinks);
          setSelectedShortCode((currentSelected) => {
            if (!currentSelected) {
              return firstActiveShortCode;
            }

            if (currentSelected && incomingLinks.some((link) => link.shortCode === currentSelected && isUsableLink(link))) {
              return currentSelected;
            }

            return firstActiveShortCode;
          });
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || "Could not load links");
        }
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    };

    loadLinks();

    return () => {
      cancelled = true;
    };
  }, [authorizedFetch, session, token]);

  useEffect(() => {
    if (!links.length) return;

    const activeLinks = links.filter(isUsableLink);
    if (selectedShortCode && activeLinks.some((link) => link.shortCode === selectedShortCode)) {
      return;
    }

    const nextShortCode = activeLinks[0]?.shortCode || "";
    setSelectedShortCode(nextShortCode);

    if (!nextShortCode) {
      setAnalytics(null);
    }
  }, [links, selectedShortCode]);

  useEffect(() => {
    if (!selectedShortCode || !token) {
      setAnalytics(null);
      return undefined;
    }

    let cancelled = false;

    const loadAnalytics = async () => {
      try {
        const response = await authorizedFetch(`/api/v1/links/${selectedShortCode}/analytics`);
        const data = await response.json();
        if (!cancelled) {
          setAnalytics(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || "Could not load analytics");
        }
      }
    };

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [authorizedFetch, selectedShortCode, token]);

  useEffect(() => {
    const verifiedDomains = (session?.workspace?.customDomains || []).filter(
      (domain) => domain.status === "verified"
    );

    setSelectedDomainHost((currentHost) => {
      if (currentHost && verifiedDomains.some((domain) => domain.hostname === currentHost)) {
        return currentHost;
      }

      return verifiedDomains.find((domain) => domain.isPrimary)?.hostname || "";
    });
  }, [session?.workspace?.customDomains]);

  const refreshBillingSummary = async (message = "") => {
    setBillingLoading(true);
    setError("");

    try {
      const data = await fetchBillingSummary();
      applyBillingSummary(data);

      if (message) {
        setBillingMessage(message);
      }

      return data;
    } catch (requestError) {
      setError(requestError.message || "Could not load billing");
      return null;
    } finally {
      setBillingLoading(false);
    }
  };

  const startPlanCheckout = async (plan) => {
    if (!plan) return;

    if (plan.id === "enterprise") {
      const supportEmail = billingSummary?.supportEmail || "support@shotlink.in";
      window.location.href = `mailto:${supportEmail}?subject=Shotlink Enterprise plan`;
      return;
    }

    if (!plan.priceInPaise) {
      setBillingMessage("You are already on the free plan. Choose Pro or Business to upgrade.");
      return;
    }

    setCheckoutLoadingPlanId(plan.id);
    setBillingMessage("");
    setError("");

    try {
      const response = await authorizedFetch("/api/v1/billing/subscriptions", {
        method: "POST",
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not start checkout");
      }

      if (!data.subscriptionShortUrl) {
        throw new Error("Subscription checkout link was not returned by billing");
      }

      setBillingMessage(`Opening ${data.plan?.name || plan.name} subscription for ${data.amountLabel}.`);
      window.location.href = data.subscriptionShortUrl;
    } catch (requestError) {
      setError(requestError.message || "Could not start checkout");
    } finally {
      setCheckoutLoadingPlanId("");
    }
  };

  const cancelCurrentSubscription = async () => {
    setBillingLoading(true);
    setBillingMessage("");
    setError("");

    try {
      const response = await authorizedFetch("/api/v1/billing/subscriptions/cancel", {
        method: "POST",
        body: JSON.stringify({ cancelAtCycleEnd: true }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not cancel subscription");
      }

      await refreshBillingSummary(data.message || "Subscription cancellation scheduled.");
    } catch (requestError) {
      setError(requestError.message || "Could not cancel subscription");
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setBillingSummary(null);
      setBillingLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadBillingSummary = async () => {
      setBillingLoading(true);

      try {
        const data = await fetchBillingSummary();
        if (!cancelled) {
          applyBillingSummary(data);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || "Could not load billing");
        }
      } finally {
        if (!cancelled) {
          setBillingLoading(false);
        }
      }
    };

    loadBillingSummary();

    return () => {
      cancelled = true;
    };
  }, [applyBillingSummary, fetchBillingSummary, token]);

  const parseFallbackUrls = () =>
    fallbackInput
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

  const upsertLink = (incomingLink) => {
    setLinks((currentLinks) => {
      const remaining = currentLinks.filter((item) => item.shortCode !== incomingLink.shortCode);
      return [incomingLink, ...remaining];
    });
  };

  const renderPublicPricing = ({ compact = false } = {}) => (
    <div
      style={{
        ...styles.planGrid,
        gridTemplateColumns: isMobile || compact ? "1fr" : "repeat(3, minmax(0, 1fr))",
      }}
    >
      {publicPlans.map((plan) => (
        <div
          key={plan.id}
          className="sl-lift"
          style={plan.id === "pro" ? { ...styles.planCard, ...styles.planCardFeatured } : styles.planCard}
        >
          <div style={styles.planHeader}>
            <strong style={styles.planName}>{plan.name}</strong>
            <StatusPill
              label={plan.id === "enterprise" ? "Custom volume" : `${plan.linkLimit} links`}
              tone={getPlanTone(plan.id)}
            />
          </div>
          <p style={styles.planPrice}>{formatPlanPrice(plan)}</p>
          <div style={styles.planFeatureList}>
            {plan.features.slice(0, compact ? 3 : plan.features.length).map((feature) => (
              <p key={feature} style={styles.planFeatureItem}>
                {feature}
              </p>
            ))}
          </div>
          {!compact ? (
            <button
              style={styles.primaryButton}
              onClick={() => {
                setPublicPage("home");
                window.location.hash = "";
                setAuthMode("register");
              }}
            >
              Start with {plan.name}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );

  const renderPublicContent = () => {
    if (publicPage === "pricing") {
      return (
        <section className="sl-reveal" style={styles.publicPageCard}>
          <p style={styles.sectionEyebrow}>Pricing</p>
          <h1 style={styles.publicTitle}>Infrastructure pricing without enterprise fog.</h1>
          <p style={styles.publicLead}>
            Start with a real short-link stack today. Upgrade when branded domains, richer analytics,
            and campaign scale matter.
          </p>
          {renderPublicPricing()}
        </section>
      );
    }

    if (publicPage === "docs") {
      return (
        <section className="sl-reveal" style={styles.publicPageCard}>
          <p style={styles.sectionEyebrow}>Documentation</p>
          <h1 style={styles.publicTitle}>Build on the Shotlink routing layer.</h1>
          <p style={styles.publicLead}>
            A concise operator guide for links, analytics, domains, billing, and API-ready workflows.
          </p>
          <div style={styles.docGrid}>
            {DOC_SECTIONS.map((section) => (
              <article key={section.title} className="sl-lift" style={styles.docCard}>
                <h2 style={styles.docTitle}>{section.title}</h2>
                <p style={styles.helperText}>{section.body}</p>
              </article>
            ))}
          </div>
          <div style={styles.codePanel}>
            <p style={styles.mutedLabel}>API shape</p>
            {API_SNIPPET_LINES.map((line) => (
              <code key={line} style={styles.codeRow}>
                {line}
              </code>
            ))}
          </div>
        </section>
      );
    }

    if (publicPage === "legal") {
      return (
        <section className="sl-reveal" style={styles.publicPageCard}>
          <p style={styles.sectionEyebrow}>Legal</p>
          <h1 style={styles.publicTitle}>Trust rules for public link infrastructure.</h1>
          <p style={styles.publicLead}>
            Shotlink is designed for lawful routing, transparent analytics, and fast abuse response.
          </p>
          <div style={styles.docGrid}>
            {LEGAL_SECTIONS.map((section) => (
              <article key={section.title} className="sl-lift" style={styles.docCard}>
                <h2 style={styles.docTitle}>{section.title}</h2>
                <p style={styles.helperText}>{section.body}</p>
              </article>
            ))}
          </div>
          <p style={styles.legalFinePrint}>
            Policy version {ACCOUNT_POLICY_VERSION}. Replace this short summary with lawyer-reviewed
            public documents before accepting large paid customers.
          </p>
        </section>
      );
    }

    return (
      <div className="sl-reveal" style={styles.homeStack}>
        <section style={styles.heroPanel}>
          <div style={styles.heroCopy}>
            <BrandLogo style={styles.heroLogo} />
            <StatusPill label="Intelligent routing infrastructure" tone="accent" />
            <h1 style={styles.title}>High-speed links for serious internet teams.</h1>
            <p style={styles.subtitle}>
              Shotlink turns every short URL into a measurable, branded, fallback-aware route.
            </p>
            <div style={styles.heroActions}>
              <button className="sl-action" style={styles.primaryButton} onClick={() => setAuthMode("register")}>
                Start routing
              </button>
              <a className="sl-action-secondary" href="#docs" style={styles.secondaryLinkButton}>
                View docs
              </a>
            </div>
            <div style={styles.compactFeatureGrid}>
              {HOME_FEATURES.map((feature) => (
                <div key={feature} className="sl-lift" style={styles.compactFeatureCard}>
                  {feature}
                </div>
              ))}
            </div>
          </div>
          <ShortenerPreview />
        </section>

        <section style={styles.metricStrip}>
          {LANDING_METRICS.map((metric) => (
            <article key={metric.label} className="sl-lift" style={styles.metricStripCard}>
              <p style={styles.metricLabel}>{metric.label}</p>
              <strong style={styles.metricStripValue}>{metric.value}</strong>
              <span style={styles.metricHint}>{metric.hint}</span>
            </article>
          ))}
        </section>

        <section style={styles.showcaseGrid}>
          {PRODUCT_FEATURES.map((feature) => (
            <article key={feature.title} className="sl-lift" style={styles.showcaseCard}>
              <span style={styles.signalBadge}>{feature.signal}</span>
              <h2 style={styles.showcaseTitle}>{feature.title}</h2>
              <p style={styles.featureText}>{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="sl-lift" style={styles.analyticsPreviewCard}>
          <div>
            <p style={styles.sectionEyebrow}>Analytics preview</p>
            <h2 style={styles.publicSectionTitle}>Traffic intelligence, not vanity clicks.</h2>
            <p style={styles.helperText}>
              Read device mix, route health, and click velocity from one control surface.
            </p>
          </div>
          <MiniTrafficChart />
        </section>

        <section className="sl-lift" style={styles.apiPreviewCard}>
          <div>
            <p style={styles.sectionEyebrow}>Developer API</p>
            <h2 style={styles.publicSectionTitle}>Designed for automation.</h2>
          </div>
          <div style={styles.codePanel}>
            {API_SNIPPET_LINES.slice(0, 5).map((line) => (
              <code key={line} style={styles.codeRow}>
                {line}
              </code>
            ))}
          </div>
        </section>

        <section style={styles.trustGrid}>
          {TRUST_SIGNALS.map((signal) => (
            <span key={signal} style={styles.trustPill}>
              {signal}
            </span>
          ))}
        </section>
      </div>
    );
  };

  const updateAuthConsent = (field, checked) => {
    setAuthForm((current) => ({
      ...current,
      consents: {
        ...current.consents,
        [field]: checked,
      },
    }));
  };

  const submitAuth = async () => {
    setAuthSubmitting(true);
    setError("");

    try {
      const { consents, ...registerFields } = authForm;
      const payload =
        authMode === "register"
          ? { ...registerFields, consents }
          : { email: authForm.email, password: authForm.password };

      const response = await fetch(`${API_BASE}/api/v1/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      localStorage.setItem(STORAGE_KEY, data.token);
      setToken(data.token);
      setSession({ user: data.user, workspace: data.workspace });
      setAuthForm({
        name: "",
        email: authForm.email,
        password: "",
        workspaceName: "",
        consents: createDefaultConsents(),
      });
    } catch (requestError) {
      setError(requestError.message || "Authentication failed");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await authorizedFetch("/api/v1/auth/logout", { method: "POST" });
      }
    } catch {
      // The local session cleanup below is enough for the UI.
    } finally {
      clearSession();
    }
  };

  const addCustomDomain = async () => {
    if (!customDomainInput.trim()) {
      setError("Enter a domain before adding it.");
      return;
    }

    setDomainSaving(true);
    setError("");
    setDomainMessage("");

    try {
      const response = await authorizedFetch("/api/v1/workspace/domains", {
        method: "POST",
        body: JSON.stringify({ hostname: customDomainInput }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not add domain");
      }

      applyWorkspaceSettings(data);
      setCustomDomainInput("");
      setDomainMessage("Domain added. Add the DNS records below, then verify it.");
    } catch (requestError) {
      setError(requestError.message || "Could not add domain");
    } finally {
      setDomainSaving(false);
    }
  };

  const verifyCustomDomain = async (hostname) => {
    setDomainVerifying(hostname);
    setError("");
    setDomainMessage("");

    try {
      const response = await authorizedFetch(
        `/api/v1/workspace/domains/${encodeURIComponent(hostname)}/verify`,
        {
          method: "POST",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        if (data.workspace) {
          applyWorkspaceSettings({ workspace: data.workspace });
        }
        throw new Error(data.error || "Could not verify domain");
      }

      applyWorkspaceSettings(data);
      setDomainMessage(`${hostname} is verified and ready for branded links.`);
    } catch (requestError) {
      setError(requestError.message || "Could not verify domain");
    } finally {
      setDomainVerifying("");
    }
  };

  const setPrimaryCustomDomain = async (hostname) => {
    setDomainVerifying(hostname);
    setError("");

    try {
      const response = await authorizedFetch(
        `/api/v1/workspace/domains/${encodeURIComponent(hostname)}/primary`,
        {
          method: "PATCH",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not set primary domain");
      }

      applyWorkspaceSettings(data);
      setSelectedDomainHost(hostname);
      setDomainMessage(`${hostname} is now the default branded domain.`);
    } catch (requestError) {
      setError(requestError.message || "Could not set primary domain");
    } finally {
      setDomainVerifying("");
    }
  };

  const removeCustomDomain = async (hostname) => {
    setDomainVerifying(hostname);
    setError("");

    try {
      const response = await authorizedFetch(
        `/api/v1/workspace/domains/${encodeURIComponent(hostname)}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not remove domain");
      }

      applyWorkspaceSettings(data);
      setDomainMessage(`${hostname} removed from this workspace.`);
    } catch (requestError) {
      setError(requestError.message || "Could not remove domain");
    } finally {
      setDomainVerifying("");
    }
  };

  const refreshAnalytics = async (shortCodeToLoad = selectedShortCode) => {
    if (!shortCodeToLoad) return;

    const response = await authorizedFetch(`/api/v1/links/${shortCodeToLoad}/analytics`);
    const data = await response.json();
    setAnalytics(data);
  };

  const createLink = async () => {
    if (!url.trim()) {
      setError("Please enter a valid destination URL.");
      return;
    }

    if (!linkComplianceAccepted) {
      setError("Please confirm the destination authority and anti-abuse consent before creating this link.");
      return;
    }

    setLoading(true);
    setError("");
    setCopied("");

    try {
      const response = await authorizedFetch("/api/v1/links", {
        method: "POST",
        body: JSON.stringify({
          originalUrl: url,
          customAlias,
          expiresInMinutes: expiry,
          fallbackUrls: parseFallbackUrls(),
          customDomainHost: selectedDomainHost,
          compliance: {
            destinationAuthorityAccepted: true,
            securityScanAccepted: true,
            abusePolicyAccepted: true,
            policyVersion: LINK_POLICY_VERSION,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not create link");
      }

      upsertLink(data.link);
      setSelectedShortCode(data.link.shortCode);
      setUrl("");
      setCustomAlias("");
      setFallbackInput("");
      setExpiry(30);
      setLinkComplianceAccepted(false);
      await refreshAnalytics(data.link.shortCode);
      await refreshBillingSummary();
    } catch (requestError) {
      setError(requestError.message || "Could not create link");
    } finally {
      setLoading(false);
    }
  };

  const expireCurrentLink = async () => {
    if (!selectedShortCode) return;

    const shortCodeToExpire = selectedShortCode;

    await authorizedFetch(`/api/v1/links/${selectedShortCode}/expire`, {
      method: "PATCH",
    });

    await refreshBillingSummary();
    const updatedLinks = links.map((link) =>
      link.shortCode === shortCodeToExpire ? { ...link, isActive: false } : link
    );
    const nextShortCode = updatedLinks.find(isUsableLink)?.shortCode || "";

    setLinks(updatedLinks);
    setSelectedShortCode(nextShortCode);
    if (!nextShortCode) {
      setAnalytics(null);
    }
  };

  const refreshHealth = async () => {
    if (!selectedShortCode) return;

    setRefreshingHealth(true);

    try {
      const response = await authorizedFetch(
        `/api/v1/links/${selectedShortCode}/health-check`,
        {
          method: "POST",
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Health refresh failed");
      }

      upsertLink(data.link);
      await refreshAnalytics(selectedShortCode);
    } catch (requestError) {
      setError(requestError.message || "Health refresh failed");
    } finally {
      setRefreshingHealth(false);
    }
  };

  const copyShortUrl = async () => {
    if (!analytics?.shortUrl) return;

    await navigator.clipboard.writeText(analytics.shortUrl);
    setCopied("Short URL copied");
    window.setTimeout(() => setCopied(""), 1800);
  };

  const downloadQR = () => {
    const canvas = document.getElementById("qr-code");
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL();
    link.download = "short-url-qr.png";
    link.click();
  };

  const totalDeviceClicks =
    analytics?.deviceBreakdown?.reduce((sum, item) => sum + item.count, 0) || 0;
  const currentPlan = billingSummary?.currentPlan || session?.workspace?.billing || {
    configuredPlanId: session?.workspace?.plan || "free",
    effectivePlanId: session?.workspace?.plan || "free",
    effectivePlanName: formatLabel(session?.workspace?.plan || "free"),
    currentPeriodEndsAt: null,
    billingStatus: "inactive",
    lastPaymentAt: null,
    lastPaymentReference: "",
    linkLimit: 10,
    clickLimit: 500,
    domainLimit: 0,
    teamMemberLimit: 1,
    apiCallLimit: 0,
    qrCodeLimit: 5,
    usage: {},
  };
  const billingRecords = billingSummary?.recentPayments || [];
  const customDomains = session?.workspace?.customDomains || [];
  const verifiedDomains = customDomains.filter((domain) => domain.status === "verified");
  const domainLimit = currentPlan.domainLimit ?? 0;
  const cnameTarget = session?.workspace?.domainSetup?.cnameTarget || "go.shotlink.in";
  const activeLinks = links.filter(isUsableLink);
  const expiredLinkCount = Math.max(links.length - activeLinks.length, 0);
  const activeLinkCount =
    billingSummary?.currentPlan?.linkCountUsed ?? activeLinks.length;
  const activeLinkLimit = currentPlan.linkLimit || 20;
  const remainingLinkSlots =
    billingSummary?.currentPlan?.linkCountRemaining ??
    Math.max(activeLinkLimit - activeLinkCount, 0);
  const requiredAccountConsentsAccepted = REQUIRED_AUTH_CONSENTS.every(
    (item) => authForm.consents[item.id]
  );
  const authSubmitDisabled =
    authSubmitting || (authMode === "register" && !requiredAccountConsentsAccepted);
  const linkSubmitDisabled = loading || remainingLinkSlots <= 0 || !linkComplianceAccepted;
  const modeStyles = colorMode === "light" ? lightModeStyles : darkModeStyles;

  if (authLoading) {
    return (
      <div className="sl-page" style={styles.page}>
        <div className="sl-grid-overlay" style={styles.backgroundGrid} />
        <div className="sl-glow sl-glow-top" style={styles.backgroundGlowTop} />
        <div className="sl-glow sl-glow-bottom" style={styles.backgroundGlowBottom} />
        <div style={styles.loadingShell}>
          <BrandLogo compact style={styles.loadingLogo} />
          <h1 style={styles.loadingTitle}>Loading workspace...</h1>
          <p style={styles.loadingText}>Restoring your session and link inventory.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="sl-page" style={styles.page}>
        <div className="sl-grid-overlay" style={styles.backgroundGrid} />
        <div className="sl-glow sl-glow-top" style={styles.backgroundGlowTop} />
        <div className="sl-glow sl-glow-bottom" style={styles.backgroundGlowBottom} />

        <div style={styles.publicShell}>
          <header style={styles.publicNav}>
            <a href="#" style={styles.brandLink} aria-label="Shotlink home">
              <BrandLogo style={styles.navLogo} />
            </a>
            <nav style={styles.publicNavLinks} aria-label="Public pages">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  style={
                    publicPage === item.id
                      ? { ...styles.publicNavLink, ...styles.publicNavLinkActive }
                      : styles.publicNavLink
                  }
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </header>

          <div
            style={{
              ...styles.publicContentGrid,
              gridTemplateColumns: isMobile
                ? "1fr"
                : publicPage === "home"
                  ? "minmax(0, 1fr) minmax(320px, 420px)"
                  : "minmax(0, 1fr) minmax(300px, 380px)",
            }}
          >
            {renderPublicContent()}

          <section style={styles.authCard}>
            <div style={styles.authTabs}>
              <button
                style={authMode === "register" ? styles.authTabActive : styles.authTab}
                onClick={() => setAuthMode("register")}
              >
                Create account
              </button>
              <button
                style={authMode === "login" ? styles.authTabActive : styles.authTab}
                onClick={() => setAuthMode("login")}
              >
                Sign in
              </button>
            </div>

            <div style={styles.authBody}>
              <BrandLogo compact style={styles.authLogo} />
              <h2 style={styles.authTitle}>
                {authMode === "register" ? "Create account" : "Sign in"}
              </h2>
              <p style={styles.authSubtitle}>
                {authMode === "register"
                  ? "Start using Shotlink in under a minute."
                  : "Continue to your Shotlink dashboard."}
              </p>

              {authMode === "register" ? (
                <label style={styles.label}>
                  Full name
                  <input
                    style={styles.input}
                    value={authForm.name}
                    onChange={(event) =>
                      setAuthForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Enter your full name"
                  />
                </label>
              ) : null}

              <label style={styles.label}>
                Email
                <input
                  style={styles.input}
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="Enter your email address"
                />
              </label>

              <label style={styles.label}>
                Password
                <input
                  style={styles.input}
                  type="password"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Create a strong password"
                />
              </label>

              {authMode === "register" ? (
                <label style={styles.label}>
                  Workspace name
                  <input
                    style={styles.input}
                    value={authForm.workspaceName}
                    onChange={(event) =>
                      setAuthForm((current) => ({
                        ...current,
                        workspaceName: event.target.value,
                      }))
                    }
                    placeholder="Enter your workspace or company name"
                  />
                </label>
              ) : null}

              {authMode === "register" ? (
                <div style={styles.consentBox}>
                  <div>
                    <p style={styles.sectionEyebrow}>Required consent</p>
                    <p style={styles.consentIntro}>
                      We keep a timestamped consent record for security and compliance.
                    </p>
                  </div>

                  {REQUIRED_AUTH_CONSENTS.map((item) => (
                    <ConsentCheckbox
                      key={item.id}
                      checked={Boolean(authForm.consents[item.id])}
                      onChange={(checked) => updateAuthConsent(item.id, checked)}
                    >
                      {item.label}
                    </ConsentCheckbox>
                  ))}

                  <ConsentCheckbox
                    checked={Boolean(authForm.consents.marketingOptIn)}
                    onChange={(checked) => updateAuthConsent("marketingOptIn", checked)}
                  >
                    Optional: send me product updates and launch offers by email.
                  </ConsentCheckbox>
                </div>
              ) : null}

              {error ? <p style={styles.error}>{error}</p> : null}

              <button
                style={
                  authSubmitDisabled
                    ? { ...styles.primaryButton, opacity: 0.6, cursor: "not-allowed" }
                    : styles.primaryButton
                }
                onClick={submitAuth}
                disabled={authSubmitDisabled}
              >
                {authSubmitting
                  ? "Working..."
                  : authMode === "register"
                    ? "Create workspace"
                    : "Sign in"}
              </button>
            </div>
          </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sl-page" style={{ ...styles.page, ...modeStyles.page }}>
      <div className="sl-grid-overlay" style={{ ...styles.backgroundGrid, ...modeStyles.backgroundGrid }} />
      <div className="sl-glow sl-glow-top" style={{ ...styles.backgroundGlowTop, ...modeStyles.backgroundGlowTop }} />
      <div className="sl-glow sl-glow-bottom" style={{ ...styles.backgroundGlowBottom, ...modeStyles.backgroundGlowBottom }} />

      <div style={styles.dashboardShell}>
        <header style={{ ...styles.headerBar, ...modeStyles.headerBar }}>
          <div style={styles.dashboardBrandBlock}>
            <BrandLogo compact style={styles.dashboardLogo} />
            <div>
              <p style={styles.sectionEyebrow}>Workspace</p>
              <h1 style={styles.dashboardTitle}>{session.workspace.name}</h1>
              <p style={styles.workspaceMeta}>
                {session.user.name} - {currentPlan.effectivePlanName} plan - {session.workspace.slug}
              </p>
            </div>
          </div>
          <div style={styles.headerActions}>
            <StatusPill label={`${activeLinkCount}/${activeLinkLimit} active links`} tone="accent" />
            <StatusPill
              label={formatLabel(currentPlan.billingStatus)}
              tone={getBillingTone(currentPlan.billingStatus)}
            />
            <button
              style={{ ...styles.navActionButton, ...modeStyles.billingButton }}
              onClick={() => scrollToDashboardSection("billing-panel")}
            >
              Billing
            </button>
            <button
              style={{ ...styles.navActionButton, ...modeStyles.docsButton }}
              onClick={() => {
                setShowDocsPanel(true);
                window.setTimeout(() => scrollToDashboardSection("docs-panel"), 50);
              }}
            >
              Docs
            </button>
            <button
              style={{ ...styles.navActionButton, ...modeStyles.themeButton }}
              onClick={() => setColorMode((currentMode) => (currentMode === "dark" ? "light" : "dark"))}
            >
              {colorMode === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button style={styles.secondaryButton} onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        <section style={styles.commandStrip}>
          <article className="sl-lift" style={{ ...styles.commandCard, ...modeStyles.commandCard }}>
            <p style={styles.metricLabel}>Routing layer</p>
            <strong style={styles.commandValue}>Active</strong>
            <span style={styles.metricHint}>Mongo-backed route registry</span>
          </article>
          <article className="sl-lift" style={{ ...styles.commandCard, ...modeStyles.commandCard }}>
            <p style={styles.metricLabel}>Tracked clicks</p>
            <strong style={styles.commandValue}>{analytics?.clicks ?? 0}</strong>
            <span style={styles.metricHint}>selected link telemetry</span>
          </article>
          <article className="sl-lift" style={{ ...styles.commandCard, ...modeStyles.commandCard }}>
            <p style={styles.metricLabel}>Domains</p>
            <strong style={styles.commandValue}>{customDomains.length}/{domainLimit}</strong>
            <span style={styles.metricHint}>branded link surfaces</span>
          </article>
        </section>

        <div
          style={{
            ...styles.dashboardGrid,
            gridTemplateColumns: isMobile ? "1fr" : "minmax(230px, 300px) minmax(460px, 600px) minmax(300px, 1fr)",
          }}
        >
          <aside style={{ ...styles.sidebarCard, ...modeStyles.sidebarCard }}>
            <nav style={styles.dashboardNavCard} aria-label="Workspace navigation">
              <p style={styles.mutedLabel}>Workspace menu</p>
              {DASHBOARD_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  style={styles.dashboardNavItem}
                  onClick={() => {
                    if (item.id === "docs-panel") {
                      setShowDocsPanel(true);
                      window.setTimeout(() => scrollToDashboardSection(item.id), 50);
                      return;
                    }
                    scrollToDashboardSection(item.id);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div id="billing-panel" style={{ ...styles.panelCard, ...modeStyles.panelCard }}>
              <div style={styles.panelTitleRow}>
                <div>
                  <p style={styles.sectionEyebrow}>Billing</p>
                  <h2 style={styles.panelTitle}>Active subscription</h2>
                </div>
                <button
                  style={{
                    ...styles.secondaryButton,
                    opacity: billingLoading ? 0.7 : 1,
                    cursor: billingLoading ? "progress" : "pointer",
                  }}
                  onClick={() => refreshBillingSummary("Billing status refreshed.")}
                  disabled={billingLoading}
                >
                  {billingLoading ? "Refreshing..." : "Refresh billing"}
                </button>
              </div>

              <div style={{ ...styles.subscriptionCard, ...modeStyles.subscriptionCard }}>
                <div>
                  <p style={styles.mutedLabel}>Current subscription</p>
                  <h3 style={styles.subscriptionTitle}>{currentPlan.effectivePlanName}</h3>
                </div>
                <StatusPill
                  label={formatLabel(currentPlan.billingStatus)}
                  tone={getBillingTone(currentPlan.billingStatus)}
                />
                <p style={styles.helperText}>
                  {activeLinkCount}/{activeLinkLimit} active links used. {remainingLinkSlots} slots
                  still available.
                </p>
                <p style={styles.miniHelperText}>
                  {currentPlan.currentPeriodEndsAt
                    ? `Renews or ends ${formatDate(currentPlan.currentPeriodEndsAt)}`
                    : "Free tier subscription"}
                </p>
              </div>

              <div style={styles.paymentCard}>
                <div>
                  <p style={styles.mutedLabel}>Upgrade subscription</p>
                  <p style={styles.helperText}>
                    Choose a paid plan to open Razorpay checkout. Your workspace updates after the
                    payment webhook confirms the transaction.
                  </p>
                </div>
                <div style={styles.compactPlanGrid}>
                  {publicPlans
                    .filter((plan) => plan.id !== "free")
                    .map((plan) => {
                      const isCurrentPlan = currentPlan.effectivePlanId === plan.id;
                      const isCheckoutLoading = checkoutLoadingPlanId === plan.id;

                      return (
                        <div key={plan.id} style={styles.compactPlanCard}>
                          <div style={styles.planHeader}>
                            <strong style={styles.planName}>{plan.name}</strong>
                            <span style={styles.compactPlanPrice}>{formatPlanPrice(plan)}</span>
                          </div>
                          <p style={styles.miniHelperText}>
                            {plan.id === "enterprise"
                              ? "Custom security, support, and scale."
                              : `${plan.linkLimit} links and ${plan.domainLimit} branded ${
                                  plan.domainLimit === 1 ? "domain" : "domains"
                                }.`}
                          </p>
                          <button
                            style={
                              isCurrentPlan || isCheckoutLoading
                                ? { ...styles.secondaryButton, opacity: 0.65, cursor: "not-allowed" }
                                : styles.primaryButton
                            }
                            onClick={() => startPlanCheckout(plan)}
                            disabled={isCurrentPlan || Boolean(checkoutLoadingPlanId)}
                          >
                            {isCurrentPlan
                              ? "Current plan"
                              : isCheckoutLoading
                                ? "Opening..."
                                : plan.id === "enterprise"
                                  ? "Contact sales"
                                  : `Upgrade to ${plan.name}`}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div style={styles.billingStatsGrid}>
                <div style={styles.billingStatCard}>
                  <p style={styles.billingStatLabel}>Current plan</p>
                  <p style={styles.billingStatValue}>{currentPlan.effectivePlanName}</p>
                </div>
                <div style={styles.billingStatCard}>
                  <p style={styles.billingStatLabel}>Slots left</p>
                  <p style={styles.billingStatValue}>{remainingLinkSlots}</p>
                </div>
                <div style={styles.billingStatCard}>
                  <p style={styles.billingStatLabel}>Billing status</p>
                  <p style={styles.billingStatValueSmall}>{formatLabel(currentPlan.billingStatus)}</p>
                </div>
                <div style={styles.billingStatCard}>
                  <p style={styles.billingStatLabel}>Current period</p>
                  <p style={styles.billingStatValueSmall}>
                    {currentPlan.currentPeriodEndsAt
                      ? formatDate(currentPlan.currentPeriodEndsAt)
                      : "Free tier"}
                  </p>
                </div>
              </div>

              <div style={styles.paymentCard}>
                <div style={styles.planHeader}>
                  <div>
                    <p style={styles.mutedLabel}>Usage</p>
                    <p style={styles.helperText}>
                      Monthly quotas reset with your billing cycle.
                    </p>
                  </div>
                  <StatusPill
                    label={currentPlan.usagePeriodKey || "Current month"}
                    tone="neutral"
                  />
                </div>
                <div style={styles.usageGrid}>
                  {Object.values(currentPlan.usage || {}).map((metric) => (
                    <UsageBar key={metric.key} metric={metric} />
                  ))}
                </div>
              </div>

              <div style={styles.paymentCard}>
                <div style={styles.planHeader}>
                  <div>
                    <p style={styles.mutedLabel}>Invoices</p>
                    <p style={styles.helperText}>Recent Razorpay subscription and invoice events.</p>
                  </div>
                  {currentPlan.effectivePlanId !== "free" ? (
                    <button
                      style={{
                        ...styles.secondaryButton,
                        opacity: billingLoading ? 0.65 : 1,
                        cursor: billingLoading ? "not-allowed" : "pointer",
                      }}
                      onClick={cancelCurrentSubscription}
                      disabled={billingLoading}
                    >
                      Cancel at renewal
                    </button>
                  ) : null}
                </div>
                <div style={styles.invoiceList}>
                  {billingRecords.length ? (
                    billingRecords.slice(0, 5).map((record) => (
                      <div key={record.id} style={styles.invoiceRow}>
                        <div>
                          <strong style={styles.planName}>{record.planName}</strong>
                          <p style={styles.miniHelperText}>
                            {formatLabel(record.status)} - {formatDate(record.createdAt)}
                          </p>
                        </div>
                        {record.invoiceUrl || record.paymentLinkUrl ? (
                          <a
                            href={record.invoiceUrl || record.paymentLinkUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.inlineLink}
                          >
                            Open
                          </a>
                        ) : (
                          <span style={styles.miniHelperText}>{formatPriceInInr(record.amountInPaise)}</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p style={styles.helperText}>Invoices appear after your first subscription event.</p>
                  )}
                </div>
              </div>

              {billingMessage ? <p style={styles.success}>{billingMessage}</p> : null}
            </div>

            <div id="domains-panel" style={{ ...styles.panelCard, ...modeStyles.panelCard }}>
              <div style={styles.panelTitleRow}>
                <div>
                  <p style={styles.sectionEyebrow}>Domains</p>
                  <h2 style={styles.panelTitle}>Branded customer links</h2>
                </div>
                <StatusPill
                  label={`${customDomains.length}/${domainLimit} domains`}
                  tone={domainLimit ? "accent" : "neutral"}
                />
              </div>

              <div style={styles.inlineForm}>
                <input
                  style={styles.input}
                  placeholder="Enter your branded domain, e.g. go.yourcompany.in"
                  value={customDomainInput}
                  onChange={(event) => setCustomDomainInput(event.target.value)}
                  disabled={domainSaving || customDomains.length >= domainLimit}
                />
                <button
                  style={
                    domainSaving || customDomains.length >= domainLimit
                      ? { ...styles.secondaryButton, opacity: 0.6, cursor: "not-allowed" }
                      : styles.primaryButton
                  }
                  onClick={addCustomDomain}
                  disabled={domainSaving || customDomains.length >= domainLimit}
                >
                  {domainSaving ? "Adding..." : "Add"}
                </button>
              </div>

              {domainLimit === 0 ? (
                <p style={styles.helperText}>
                  Upgrade to Pro or Business to sell branded short links on customer domains.
                </p>
              ) : null}

              {domainMessage ? <p style={styles.success}>{domainMessage}</p> : null}

              {customDomains.length ? (
                <div style={styles.domainList}>
                  {customDomains.map((domain) => (
                    <div key={domain.hostname} style={styles.domainCard}>
                      <div style={styles.planHeader}>
                        <strong style={styles.planName}>{domain.hostname}</strong>
                        <StatusPill
                          label={domain.isPrimary ? `${domain.status} primary` : domain.status}
                          tone={domain.status === "verified" ? "healthy" : "warning"}
                        />
                      </div>

                      <div style={styles.dnsGrid}>
                        <div>
                          <p style={styles.mutedLabel}>CNAME</p>
                          <p style={styles.codeLine}>{domain.hostname} to {cnameTarget}</p>
                        </div>
                        <div>
                          <p style={styles.mutedLabel}>TXT</p>
                          <p style={styles.codeLine}>{domain.dns?.txtName}</p>
                          <p style={styles.codeLine}>{domain.dns?.txtValue}</p>
                        </div>
                      </div>

                      {domain.lastVerificationError ? (
                        <p style={styles.error}>{domain.lastVerificationError}</p>
                      ) : null}

                      <div style={styles.inlineActions}>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => verifyCustomDomain(domain.hostname)}
                          disabled={domainVerifying === domain.hostname}
                        >
                          {domainVerifying === domain.hostname ? "Checking..." : "Verify"}
                        </button>
                        {domain.status === "verified" && !domain.isPrimary ? (
                          <button
                            style={styles.secondaryButton}
                            onClick={() => setPrimaryCustomDomain(domain.hostname)}
                            disabled={domainVerifying === domain.hostname}
                          >
                            Make primary
                          </button>
                        ) : null}
                        <button
                          style={styles.secondaryButton}
                          onClick={() =>
                            window.confirm("Remove this domain from the workspace?") &&
                            removeCustomDomain(domain.hostname)
                          }
                          disabled={domainVerifying === domain.hostname}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={styles.emptyState}>
                  Add a customer subdomain, publish the DNS records, then verify it here.
                </p>
              )}
            </div>

            <div style={styles.panelTitleRow}>
              <div>
                <h2 style={styles.panelTitle}>Active links</h2>
                {expiredLinkCount ? (
                  <p style={styles.miniHelperText}>{expiredLinkCount} expired link{expiredLinkCount === 1 ? "" : "s"} hidden</p>
                ) : null}
              </div>
              <StatusPill label={workspaceLoading ? "syncing" : "live"} tone="accent" />
            </div>

            {activeLinks.length ? (
              <div style={styles.linkList}>
                {activeLinks.map((link) => (
                  <button
                    key={link.shortCode}
                    style={
                      link.shortCode === selectedShortCode
                        ? styles.linkListItemActive
                        : styles.linkListItem
                    }
                    onClick={() => setSelectedShortCode(link.shortCode)}
                  >
                    <div style={styles.linkListTopRow}>
                      <span style={styles.linkShortCode}>{link.shortCode}</span>
                      <StatusPill
                        label={link.isActive ? "active" : "expired"}
                        tone={getActiveTone(link)}
                      />
                    </div>
                    {link.customDomainHost ? (
                      <p style={styles.mutedLabel}>{link.customDomainHost}</p>
                    ) : null}
                    <p style={styles.linkOriginal}>{link.originalUrl}</p>
                    <div style={styles.linkListFooter}>
                      <span>{link.clicks} clicks</span>
                      <span>{formatDate(link.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p style={styles.emptyState}>
                No links yet. Create your first resilient short link from the builder.
              </p>
            )}

            {showDocsPanel ? (
              <div id="docs-panel" style={{ ...styles.docsQuickPanel, ...modeStyles.docsQuickPanel }}>
                <div style={styles.panelTitleRow}>
                  <div>
                    <p style={styles.sectionEyebrow}>Docs</p>
                    <h2 style={styles.panelTitle}>Quick operator guide</h2>
                  </div>
                  <button style={styles.secondaryButton} onClick={() => setShowDocsPanel(false)}>
                    Hide
                  </button>
                </div>
                <div style={styles.docsQuickList}>
                  {DOC_SECTIONS.slice(0, 3).map((section) => (
                    <div key={section.title} style={styles.docsQuickItem}>
                      <strong>{section.title}</strong>
                      <span>{section.body}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <section id="builder-panel" style={{ ...styles.builderCard, ...modeStyles.builderCard }}>
            <div style={styles.panelTitleRow}>
              <div>
                <p style={styles.sectionEyebrow}>Shorten</p>
                <h2 style={styles.panelTitle}>Create a short link</h2>
              </div>
              <StatusPill label={currentPlan.effectivePlanName} tone={getPlanTone(currentPlan.effectivePlanId)} />
            </div>

            <p style={styles.helperText}>
              {remainingLinkSlots > 0
                ? `${remainingLinkSlots} active link slots remaining on the ${currentPlan.effectivePlanName} plan.`
                : `You have used all ${activeLinkLimit} active-link slots on the ${currentPlan.effectivePlanName} plan. Upgrade billing to create more links.`}
            </p>

            <label style={styles.label}>
              Short link domain
              <select
                style={styles.select}
                value={selectedDomainHost}
                onChange={(event) => setSelectedDomainHost(event.target.value)}
              >
                <option value="">Default redirect domain</option>
                {verifiedDomains.map((domain) => (
                  <option key={domain.hostname} value={domain.hostname}>
                    {domain.hostname}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Primary destination
              <input
                style={styles.input}
                placeholder="Paste a long URL, e.g. https://example.com/summer-campaign"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>

            <label style={styles.label}>
              Custom alias
              <div style={styles.aliasInputGroup}>
                <span style={styles.aliasPrefix}>
                  {selectedDomainHost || "shot.link"}/
                </span>
                <input
                  style={{ ...styles.input, ...styles.aliasInput }}
                  placeholder="summer-sale"
                  value={customAlias}
                  onChange={(event) => setCustomAlias(event.target.value)}
                />
              </div>
              <span style={styles.miniHelperText}>
                Optional. Use 3-48 letters, numbers, hyphens, or underscores.
              </span>
            </label>

            <label style={styles.label}>
              Fallback destinations
              <textarea
                style={styles.textarea}
                placeholder={"Optional: paste backup URLs, one per line\nhttps://backup-1.yourcompany.in\nhttps://backup-2.yourcompany.in"}
                value={fallbackInput}
                onChange={(event) => setFallbackInput(event.target.value)}
              />
            </label>

            <label style={styles.label}>
              Link expiry
              <select
                style={styles.select}
                value={expiry}
                onChange={(event) => setExpiry(Number(event.target.value))}
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.consentBox}>
              <p style={styles.consentIntro}>
                Link policy version {LINK_POLICY_VERSION}. Required for every link so abusive or
                illegal destinations can be suspended with a clear audit trail.
              </p>
              <ConsentCheckbox
                checked={linkComplianceAccepted}
                onChange={setLinkComplianceAccepted}
              >
                I have authority to share these destinations, consent to automated health checks,
                and will not use this link for phishing, malware, spam, impersonation, or unlawful
                content.
              </ConsentCheckbox>
            </div>

            <button
              style={
                linkSubmitDisabled
                  ? { ...styles.primaryButton, opacity: 0.6, cursor: "not-allowed" }
                  : styles.primaryButton
              }
              onClick={createLink}
              disabled={linkSubmitDisabled}
            >
              {loading
                ? "Creating link..."
                  : remainingLinkSlots <= 0
                    ? "Upgrade to create more links"
                  : !linkComplianceAccepted
                    ? "Accept link policy to create"
                  : "Shorten URL"}
            </button>

            {error ? <p style={styles.error}>{error}</p> : null}
            {copied ? <p style={styles.success}>{copied}</p> : null}

            {analytics?.shortUrl && analytics.isActive ? (
              <div style={{ ...styles.resultCard, ...modeStyles.panelCard }}>
                <div style={styles.resultTopRow}>
                  <div>
                    <p style={styles.mutedLabel}>Selected short URL</p>
                    <a href={analytics.shortUrl} target="_blank" rel="noreferrer" style={styles.link}>
                      {analytics.shortUrl}
                    </a>
                  </div>
                  <div style={styles.inlineActions}>
                    <button style={styles.secondaryButton} onClick={copyShortUrl}>
                      Copy
                    </button>
                    <button style={styles.secondaryButton} onClick={downloadQR}>
                      QR
                    </button>
                  </div>
                </div>

                <div style={styles.qrPanel}>
                  <QRCodeCanvas id="qr-code" value={analytics.shortUrl} size={132} includeMargin />
                  <div style={styles.qrText}>
                    <p style={styles.mutedLabel}>Routing behavior</p>
                    <p style={styles.qrHeadline}>
                      {analytics.currentTarget
                        ? `Currently sending traffic to ${analytics.currentTarget.label}`
                        : "No healthy destination available"}
                    </p>
                    <p style={styles.qrDescription}>
                      Refresh route health after destination deploys, incidents, or domain fixes.
                    </p>
                    <button
                      style={styles.secondaryButton}
                      onClick={refreshHealth}
                      disabled={refreshingHealth}
                    >
                      {refreshingHealth ? "Refreshing..." : "Refresh route health"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section id="analytics-panel" style={styles.analyticsPanel}>
            <div style={styles.analyticsHeader}>
              <div>
                <p style={styles.sectionEyebrow}>Analytics console</p>
                <h2 style={styles.panelTitle}>Protected workspace analytics</h2>
              </div>
              <StatusPill
                label={analytics?.isActive ? "active" : selectedShortCode ? "expired" : "waiting"}
                tone={analytics?.isActive ? "healthy" : selectedShortCode ? "danger" : "neutral"}
              />
            </div>

            <div style={styles.metricsGrid}>
              <div style={{ ...styles.metricCard, ...modeStyles.metricCard }}>
                <p style={styles.metricLabel}>Total clicks</p>
                <p style={styles.metricValue}>{analytics?.clicks ?? 0}</p>
              </div>
              <div style={{ ...styles.metricCard, ...modeStyles.metricCard }}>
                <p style={styles.metricLabel}>Last click</p>
                <p style={styles.metricValueSmall}>{formatDate(analytics?.lastClickedAt)}</p>
              </div>
              <div style={{ ...styles.metricCard, ...modeStyles.metricCard }}>
                <p style={styles.metricLabel}>Expires in</p>
                <p style={styles.metricValueSmall}>{countdown || "Not started"}</p>
              </div>
              <div style={{ ...styles.metricCard, ...modeStyles.metricCard }}>
                <p style={styles.metricLabel}>Current target</p>
                <p style={styles.metricValueSmall}>
                  {analytics?.currentTarget?.kind === "fallback"
                    ? analytics.currentTarget.label
                    : analytics?.currentTarget
                      ? "Primary destination"
                      : "Unavailable"}
                </p>
              </div>
            </div>

            <div style={{ ...styles.panelCard, ...modeStyles.panelCard }}>
              <div style={styles.panelTitleRow}>
                <h3 style={styles.panelTitle}>Destination health</h3>
                {analytics?.primaryHealth ? (
                  <StatusPill
                    label={analytics.primaryHealth.status}
                    tone={getHealthTone(analytics.primaryHealth.status)}
                  />
                ) : null}
              </div>

              <div style={styles.routeList}>
                <div style={styles.routeCard}>
                  <div>
                    <p style={styles.routeLabel}>Primary</p>
                    <p style={styles.routeUrl}>
                      {analytics?.originalUrl || "Select a link to inspect route health"}
                    </p>
                  </div>
                  <div style={styles.routeMeta}>
                    <StatusPill
                      label={analytics?.primaryHealth?.status || "unknown"}
                      tone={getHealthTone(analytics?.primaryHealth?.status)}
                    />
                    <span style={styles.routeTime}>
                      {analytics?.primaryHealth?.lastCheckedAt
                        ? formatDate(analytics.primaryHealth.lastCheckedAt)
                        : "Not checked yet"}
                    </span>
                  </div>
                </div>

                {(analytics?.fallbackUrls || []).map((fallback) => (
                  <div key={fallback.url} style={styles.routeCard}>
                    <div>
                      <p style={styles.routeLabel}>{fallback.label}</p>
                      <p style={styles.routeUrl}>{fallback.url}</p>
                    </div>
                    <div style={styles.routeMeta}>
                      <StatusPill
                        label={fallback.lastStatus}
                        tone={getHealthTone(fallback.lastStatus)}
                      />
                      <span style={styles.routeTime}>
                        {fallback.lastCheckedAt
                          ? formatDate(fallback.lastCheckedAt)
                          : "Not checked yet"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...styles.panelCard, ...modeStyles.panelCard }}>
              <div style={styles.panelTitleRow}>
                <h3 style={styles.panelTitle}>Device mix</h3>
                <span style={styles.metricHint}>{totalDeviceClicks} tracked events</span>
              </div>

              {analytics?.deviceBreakdown?.length ? (
                analytics.deviceBreakdown.map((item) => (
                  <DeviceBar key={item.deviceType} item={item} total={totalDeviceClicks} />
                ))
              ) : (
                <p style={styles.emptyState}>
                  Clicks will appear here after people open the selected short URL.
                </p>
              )}
            </div>

            <div style={{ ...styles.panelCard, ...modeStyles.panelCard }}>
              <div style={styles.panelTitleRow}>
                <h3 style={styles.panelTitle}>Recent click events</h3>
                {selectedShortCode ? (
                  <button style={styles.secondaryButton} onClick={() => refreshAnalytics()}>
                    Refresh analytics
                  </button>
                ) : null}
              </div>

              {analytics?.recentEvents?.length ? (
                <div style={styles.eventList}>
                  {analytics.recentEvents.map((event, index) => (
                    <div key={`${event.clickedAt}-${index}`} style={styles.eventCard}>
                      <div style={styles.eventTopRow}>
                        <strong style={styles.eventTitle}>
                          {event.deviceType} on {event.browser}
                        </strong>
                        <StatusPill
                          label={event.redirectTargetKind}
                          tone={event.redirectTargetKind === "fallback" ? "warning" : "accent"}
                        />
                      </div>
                      <p style={styles.eventMeta}>
                        {event.os} - {formatDate(event.clickedAt)}
                      </p>
                      <p style={styles.eventTarget}>
                        {event.redirectTarget || "No redirect target available"}
                      </p>
                      <p style={styles.eventReferrer}>
                        Referrer: {event.referrer || "Direct / unknown"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={styles.emptyState}>
                  No click events yet. Open the selected short URL from another tab to populate this
                  feed.
                </p>
              )}
            </div>

            {analytics?.isActive ? (
              <button
                style={styles.dangerButton}
                onClick={() => window.confirm("Expire this short link now?") && expireCurrentLink()}
              >
                Expire this short link
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

const designTokens = {
  colors: {
    ink: "#17233c",
    text: "#34405c",
    muted: "#667085",
    black: "#0b1736",
    night: "#17233c",
    panel: "#ffffff",
    panelStrong: "#ffffff",
    border: "#d9dee8",
    borderBright: "#2a5bd7",
    blue: "#2a5bd7",
    blueHot: "#1741a6",
    green: "#008a5b",
    yellow: "#f5b700",
    orange: "#ff5b22",
    orangeHot: "#e54810",
    white: "#ffffff",
    ice: "#f7f9fc",
    cyan: "#2a5bd7",
    success: "#008a5b",
    danger: "#d92d20",
  },
  shadows: {
    blueGlow: "0 12px 28px rgba(42, 91, 215, 0.16)",
    panel: "0 18px 50px rgba(23, 35, 60, 0.10)",
    lift: "0 16px 42px rgba(23, 35, 60, 0.12)",
  },
};

const darkModeStyles = {
  page: {
    background:
      "radial-gradient(circle at 10% 8%, rgba(37, 99, 235, 0.30), transparent 30%), radial-gradient(circle at 88% 16%, rgba(16, 185, 129, 0.18), transparent 28%), radial-gradient(circle at 72% 86%, rgba(245, 197, 66, 0.10), transparent 30%), linear-gradient(155deg, #05070b 0%, #101827 48%, #05070b 100%)",
  },
  backgroundGrid: {
    opacity: 0.52,
  },
  backgroundGlowTop: {
    background: "rgba(37, 99, 235, 0.22)",
  },
  backgroundGlowBottom: {
    background: "rgba(16, 185, 129, 0.14)",
  },
  headerBar: {
    background:
      "linear-gradient(135deg, rgba(8, 13, 22, 0.94), rgba(5, 7, 11, 0.88))",
    border: "1px solid rgba(148, 163, 184, 0.22)",
  },
  commandCard: {
    background:
      "linear-gradient(145deg, rgba(8, 13, 22, 0.88), rgba(5, 7, 11, 0.80))",
    border: "1px solid rgba(148, 163, 184, 0.18)",
  },
  sidebarCard: {
    background: "rgba(5, 7, 11, 0.26)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
  },
  builderCard: {
    background:
      "linear-gradient(155deg, rgba(8, 13, 22, 0.94), rgba(5, 7, 11, 0.90))",
    border: "1px solid rgba(37, 99, 235, 0.48)",
  },
  panelCard: {
    background:
      "linear-gradient(150deg, rgba(8, 13, 22, 0.88), rgba(5, 7, 11, 0.80))",
    border: "1px solid rgba(148, 163, 184, 0.16)",
  },
  subscriptionCard: {
    borderLeft: "4px solid #2563eb",
  },
  metricCard: {
    background:
      "linear-gradient(145deg, rgba(8, 13, 22, 0.88), rgba(5, 7, 11, 0.82))",
    border: "1px solid rgba(148, 163, 184, 0.16)",
  },
  compactPlanCard: {
    borderLeft: "4px solid #f5c542",
  },
  docsQuickPanel: {
    borderLeft: "4px solid #10b981",
  },
  billingButton: {
    background: "#f5c542",
    color: "#05070b",
    borderColor: "rgba(245, 197, 66, 0.55)",
  },
  docsButton: {
    background: "#10b981",
    color: "#03120d",
    borderColor: "rgba(16, 185, 129, 0.55)",
  },
  themeButton: {
    background: "rgba(37, 99, 235, 0.18)",
    color: "#dbeafe",
    borderColor: "rgba(37, 99, 235, 0.42)",
  },
};

const lightModeStyles = {
  page: {
    background: "#f7f9fc",
    color: designTokens.colors.ink,
  },
  backgroundGrid: {
    opacity: 0,
  },
  backgroundGlowTop: {
    background: "transparent",
  },
  backgroundGlowBottom: {
    background: "transparent",
  },
  headerBar: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: designTokens.shadows.panel,
  },
  commandCard: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    color: designTokens.colors.ink,
  },
  sidebarCard: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
  },
  builderCard: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: designTokens.shadows.panel,
  },
  panelCard: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    color: designTokens.colors.ink,
  },
  subscriptionCard: {
    background: "#fff5ef",
    border: "1px solid #ffd4c2",
    borderLeft: `4px solid ${designTokens.colors.orange}`,
    color: designTokens.colors.ink,
  },
  metricCard: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    color: designTokens.colors.ink,
  },
  compactPlanCard: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    borderLeft: `4px solid ${designTokens.colors.blue}`,
    color: designTokens.colors.ink,
  },
  docsQuickPanel: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    borderLeft: `4px solid ${designTokens.colors.green}`,
    color: designTokens.colors.ink,
  },
  billingButton: {
    background: "#ffffff",
    color: designTokens.colors.blue,
    borderColor: designTokens.colors.border,
  },
  docsButton: {
    background: "#ffffff",
    color: designTokens.colors.blue,
    borderColor: designTokens.colors.border,
  },
  themeButton: {
    background: designTokens.colors.blue,
    color: "#ffffff",
    borderColor: designTokens.colors.blue,
  },
};

const styles = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflowX: "hidden",
    background: "#f7f9fc",
    color: designTokens.colors.ink,
    padding: "20px 18px 44px",
    fontFamily:
      "'Inter Tight', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  backgroundGrid: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: 0,
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -160,
    left: "8%",
    width: 420,
    height: 420,
    background: "transparent",
    filter: "blur(86px)",
    pointerEvents: "none",
  },
  backgroundGlowBottom: {
    position: "absolute",
    right: "-7%",
    bottom: "-12%",
    width: 520,
    height: 520,
    background: "transparent",
    filter: "blur(104px)",
    pointerEvents: "none",
  },
  publicShell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1260,
    margin: "0 auto",
    display: "grid",
    gap: 34,
  },
  publicNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
    padding: "10px 0 18px",
  },
  brandLink: {
    display: "inline-flex",
    alignItems: "center",
    textDecoration: "none",
  },
  navLogo: {
    width: 184,
    height: 46,
  },
  publicNavLinks: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    padding: 4,
    borderRadius: 8,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: "0 10px 28px rgba(23, 35, 60, 0.06)",
  },
  publicNavLink: {
    padding: "9px 13px",
    borderRadius: 6,
    color: designTokens.colors.ink,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 700,
    transition: "background 180ms ease, color 180ms ease, transform 180ms ease",
  },
  publicNavLinkActive: {
    color: designTokens.colors.white,
    background: designTokens.colors.blue,
    boxShadow: "none",
  },
  publicContentGrid: {
    display: "grid",
    gap: 24,
    alignItems: "start",
  },
  authShell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gap: 24,
    alignItems: "start",
  },
  dashboardShell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1440,
    margin: "0 auto",
    display: "grid",
    gap: 22,
  },
  loadingShell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 640,
    margin: "12vh auto 0",
    padding: 32,
    borderRadius: 30,
    background: designTokens.colors.panelStrong,
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: designTokens.shadows.panel,
    textAlign: "center",
  },
  loadingLogo: {
    margin: "0 auto 16px",
  },
  loadingTitle: {
    margin: 0,
    fontSize: "2.2rem",
  },
  loadingText: {
    margin: "12px 0 0",
    color: "#cbd5e1",
  },
  heroPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 24,
    alignItems: "center",
    paddingTop: 8,
  },
  homeStack: {
    display: "grid",
    gap: 18,
  },
  heroCopy: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },
  heroLogo: {
    width: "min(430px, 88vw)",
    height: "auto",
    filter: "drop-shadow(0 0 34px rgba(76, 85, 255, 0.16))",
  },
  title: {
    margin: "4px 0",
    fontSize: "clamp(2.8rem, 5vw, 5.6rem)",
    lineHeight: 0.94,
    letterSpacing: 0,
    maxWidth: 760,
    color: designTokens.colors.ink,
    textShadow: "none",
  },
  subtitle: {
    margin: 0,
    maxWidth: 610,
    fontSize: "clamp(1rem, 1.5vw, 1.22rem)",
    lineHeight: 1.65,
    color: designTokens.colors.text,
  },
  heroActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  secondaryLinkButton: {
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: 8,
    padding: "15px 18px",
    fontSize: 15,
    fontWeight: 800,
    background: "#ffffff",
    color: designTokens.colors.blue,
    cursor: "pointer",
    textDecoration: "none",
    boxShadow: "0 10px 24px rgba(23, 35, 60, 0.06)",
  },
  compactFeatureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },
  compactFeatureCard: {
    padding: "14px 16px",
    borderRadius: 8,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    color: designTokens.colors.ink,
    fontWeight: 800,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  },
  publicPageCard: {
    display: "grid",
    gap: 20,
    padding: "clamp(22px, 4vw, 42px)",
    borderRadius: 12,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: designTokens.shadows.panel,
  },
  publicTitle: {
    margin: 0,
    fontSize: "clamp(2.35rem, 5vw, 5rem)",
    lineHeight: 0.94,
    letterSpacing: 0,
    color: designTokens.colors.ink,
  },
  publicLead: {
    margin: 0,
    maxWidth: 720,
    color: designTokens.colors.text,
    lineHeight: 1.7,
    fontSize: "1.04rem",
  },
  publicSectionTitle: {
    margin: "8px 0 10px",
    fontSize: "clamp(1.35rem, 2.3vw, 2.1rem)",
    lineHeight: 1,
    letterSpacing: "-0.04em",
    color: designTokens.colors.white,
  },
  docGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  docCard: {
    display: "grid",
    gap: 8,
    padding: 18,
    borderRadius: 22,
    background: "rgba(3, 4, 10, 0.58)",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  },
  docTitle: {
    margin: 0,
    fontSize: "1rem",
  },
  transmissionCard: {
    position: "relative",
    overflow: "hidden",
    minHeight: 372,
    padding: 22,
    borderRadius: 12,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: designTokens.shadows.panel,
  },
  shortenerPreviewCard: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 12,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: designTokens.shadows.panel,
  },
  previewHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  previewDomain: {
    color: designTokens.colors.blue,
    fontWeight: 900,
    fontSize: 14,
  },
  previewForm: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 8,
    background: "#f7f9fc",
    border: `1px solid ${designTokens.colors.border}`,
  },
  previewLabel: {
    display: "grid",
    gap: 8,
    color: designTokens.colors.ink,
    fontSize: 13,
    fontWeight: 800,
  },
  previewInput: {
    minHeight: 46,
    display: "flex",
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: 8,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    color: designTokens.colors.text,
    wordBreak: "break-all",
  },
  previewAliasRow: {
    minHeight: 46,
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "12px 14px",
    borderRadius: 8,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    color: designTokens.colors.text,
  },
  previewButton: {
    border: "none",
    borderRadius: 8,
    minHeight: 48,
    background: designTokens.colors.orange,
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(255, 91, 34, 0.22)",
  },
  previewResultGrid: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 16,
    alignItems: "center",
  },
  previewQr: {
    padding: 10,
    borderRadius: 8,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
  },
  previewShortLink: {
    margin: "4px 0 12px",
    color: designTokens.colors.blue,
    fontSize: "1.25rem",
    fontWeight: 950,
    wordBreak: "break-all",
  },
  previewMiniButton: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "7px 10px",
    borderRadius: 8,
    background: "#eef3ff",
    color: designTokens.colors.blue,
    fontSize: 12,
    fontWeight: 900,
  },
  visualHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    position: "relative",
    zIndex: 1,
  },
  visualDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: designTokens.colors.blue,
    boxShadow: "0 0 22px rgba(76, 85, 255, 0.9)",
  },
  visualLabel: {
    flex: 1,
    color: designTokens.colors.text,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  routeCanvas: {
    position: "relative",
    height: 220,
    margin: "28px 0 22px",
    borderRadius: 12,
    background:
      "linear-gradient(180deg, #f7f9fc, #ffffff), linear-gradient(90deg, rgba(42,91,215,0.08) 1px, transparent 1px), linear-gradient(0deg, rgba(42,91,215,0.08) 1px, transparent 1px)",
    backgroundSize: "auto, 34px 34px, 34px 34px",
    border: `1px solid ${designTokens.colors.border}`,
    overflow: "hidden",
  },
  routeNode: {
    position: "absolute",
    zIndex: 2,
    width: 68,
    height: 68,
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.08em",
    color: designTokens.colors.white,
    background: designTokens.colors.blue,
    border: `1px solid ${designTokens.colors.blue}`,
    boxShadow: designTokens.shadows.blueGlow,
  },
  routeNodeSource: {
    left: 24,
    top: 76,
  },
  routeNodeEdge: {
    left: "calc(50% - 34px)",
    top: 26,
    background: "linear-gradient(135deg, rgba(76, 85, 255, 0.95), rgba(9, 12, 28, 0.92))",
  },
  routeNodeTarget: {
    right: 24,
    bottom: 34,
  },
  latencyGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    position: "relative",
    zIndex: 1,
  },
  latencyCard: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255, 255, 255, 0.045)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  latencyValue: {
    color: designTokens.colors.white,
    fontSize: "1.55rem",
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  latencyLabel: {
    color: designTokens.colors.muted,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  metricStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },
  metricStripCard: {
    display: "grid",
    gap: 8,
    padding: 18,
    borderRadius: 22,
    background: "rgba(7, 9, 20, 0.76)",
    border: `1px solid ${designTokens.colors.border}`,
  },
  metricStripValue: {
    color: designTokens.colors.white,
    fontSize: "1.8rem",
    lineHeight: 1,
    letterSpacing: "-0.05em",
  },
  showcaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  showcaseCard: {
    display: "grid",
    gap: 12,
    padding: 20,
    borderRadius: 26,
    minHeight: 190,
    background:
      "linear-gradient(145deg, rgba(12, 15, 31, 0.82), rgba(3, 4, 10, 0.72))",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  },
  signalBadge: {
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(76, 85, 255, 0.14)",
    color: designTokens.colors.ice,
    border: "1px solid rgba(76, 85, 255, 0.28)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  showcaseTitle: {
    margin: 0,
    color: designTokens.colors.white,
    fontSize: "1.25rem",
    letterSpacing: "-0.035em",
  },
  analyticsPreviewCard: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, rgba(76, 85, 255, 0.18), rgba(6, 8, 18, 0.86))",
    border: `1px solid ${designTokens.colors.borderBright}`,
    boxShadow: designTokens.shadows.panel,
  },
  chartPreview: {
    height: 160,
    display: "flex",
    gap: 8,
    alignItems: "end",
    padding: 16,
    borderRadius: 22,
    background: "rgba(3, 4, 10, 0.54)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  chartBar: {
    flex: 1,
    minWidth: 8,
    borderRadius: "999px 999px 6px 6px",
    background: "linear-gradient(180deg, #ffffff 0%, #4c55ff 52%, #151cff 100%)",
    boxShadow: "0 0 20px rgba(76, 85, 255, 0.32)",
  },
  apiPreviewCard: {
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 28,
    background: "rgba(5, 7, 16, 0.82)",
    border: `1px solid ${designTokens.colors.border}`,
  },
  codePanel: {
    display: "grid",
    gap: 6,
    padding: 18,
    borderRadius: 22,
    background: "rgba(0, 0, 0, 0.42)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    overflowX: "auto",
  },
  codeRow: {
    display: "block",
    color: designTokens.colors.ice,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: "pre",
  },
  trustGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  trustPill: {
    padding: "10px 13px",
    borderRadius: 999,
    color: designTokens.colors.text,
    background: "rgba(255, 255, 255, 0.045)",
    border: `1px solid ${designTokens.colors.border}`,
    fontSize: 13,
    fontWeight: 800,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  featureCard: {
    padding: 18,
    borderRadius: 20,
    background: "rgba(15, 23, 42, 0.76)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
  },
  featureTitle: {
    margin: "0 0 8px",
    fontSize: "1rem",
  },
  featureText: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
  pricingPreview: {
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 24,
    background: "rgba(15, 23, 42, 0.76)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
  },
  authCard: {
    position: "sticky",
    top: 22,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: designTokens.shadows.panel,
  },
  authTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    borderBottom: `1px solid ${designTokens.colors.border}`,
  },
  authTab: {
    border: "none",
    background: "transparent",
    color: designTokens.colors.text,
    padding: "16px 18px",
    fontWeight: 700,
    cursor: "pointer",
  },
  authTabActive: {
    border: "none",
    background: "#eef3ff",
    color: designTokens.colors.blue,
    padding: "16px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
  authBody: {
    display: "grid",
    gap: 16,
    padding: 24,
  },
  authLogo: {
    width: 62,
    height: 62,
  },
  authTitle: {
    margin: 0,
    fontSize: "1.7rem",
    letterSpacing: "-0.04em",
  },
  authSubtitle: {
    margin: "4px 0 4px",
    color: designTokens.colors.text,
    lineHeight: 1.6,
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 12,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  },
  dashboardBrandBlock: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  },
  dashboardLogo: {
    width: 58,
    height: 58,
    flex: "0 0 auto",
  },
  dashboardTitle: {
    margin: "8px 0 0",
    fontSize: "clamp(1.8rem, 3vw, 3.2rem)",
    lineHeight: 0.96,
    letterSpacing: 0,
    color: designTokens.colors.ink,
  },
  workspaceMeta: {
    margin: "8px 0 0",
    color: designTokens.colors.text,
  },
  headerActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  navActionButton: {
    border: "1px solid transparent",
    borderRadius: 8,
    padding: "10px 14px",
    minHeight: 42,
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.35)",
    transition: "transform 180ms ease, filter 180ms ease, box-shadow 180ms ease",
  },
  dashboardGrid: {
    display: "grid",
    gap: 20,
    alignItems: "start",
  },
  commandStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  commandCard: {
    display: "grid",
    gap: 8,
    padding: 18,
    borderRadius: 8,
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  },
  commandValue: {
    color: designTokens.colors.ink,
    fontSize: "1.65rem",
    lineHeight: 1,
    letterSpacing: 0,
  },
  sidebarCard: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: 12,
    padding: 20,
    display: "grid",
    gap: 16,
  },
  builderCard: {
    background: "#ffffff",
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: 12,
    padding: 22,
    display: "grid",
    gap: 18,
    boxShadow: designTokens.shadows.panel,
  },
  analyticsPanel: {
    display: "grid",
    gap: 18,
    alignContent: "start",
  },
  analyticsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  sectionEyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: 0,
    textTransform: "uppercase",
    color: designTokens.colors.blue,
    fontWeight: 900,
  },
  panelTitle: {
    margin: "6px 0 0",
    fontSize: "1.15rem",
    letterSpacing: 0,
    color: designTokens.colors.ink,
  },
  panelTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  label: {
    display: "grid",
    gap: 10,
    fontSize: 14,
    fontWeight: 700,
    color: designTokens.colors.ink,
  },
  input: {
    width: "100%",
    borderRadius: 8,
    border: `1px solid ${designTokens.colors.border}`,
    background: "#ffffff",
    color: designTokens.colors.ink,
    padding: "15px 16px",
    outline: "none",
    fontSize: 15,
    transition: "border-color 180ms ease, box-shadow 180ms ease, background 180ms ease",
  },
  aliasInputGroup: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    alignItems: "stretch",
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: 8,
    overflow: "hidden",
    background: "#ffffff",
  },
  aliasPrefix: {
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    background: "#eef3ff",
    color: designTokens.colors.blue,
    borderRight: `1px solid ${designTokens.colors.border}`,
    fontWeight: 900,
    fontSize: 14,
    whiteSpace: "nowrap",
  },
  aliasInput: {
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
  },
  textarea: {
    width: "100%",
    minHeight: 110,
    resize: "vertical",
    borderRadius: 8,
    border: `1px solid ${designTokens.colors.border}`,
    background: "#ffffff",
    color: designTokens.colors.ink,
    padding: "15px 16px",
    outline: "none",
    fontSize: 15,
    fontFamily: "inherit",
    transition: "border-color 180ms ease, box-shadow 180ms ease, background 180ms ease",
  },
  select: {
    width: "100%",
    borderRadius: 8,
    border: `1px solid ${designTokens.colors.border}`,
    background: "#ffffff",
    color: designTokens.colors.ink,
    padding: "15px 16px",
    outline: "none",
    fontSize: 15,
  },
  primaryButton: {
    border: "none",
    borderRadius: 8,
    padding: "15px 18px",
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: 0,
    background: designTokens.colors.orange,
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(255, 91, 34, 0.22)",
    transition: "transform 180ms ease, box-shadow 180ms ease, filter 180ms ease",
  },
  secondaryButton: {
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 800,
    background: "#ffffff",
    color: designTokens.colors.blue,
    cursor: "pointer",
    transition: "transform 180ms ease, border-color 180ms ease, background 180ms ease",
  },
  dangerButton: {
    border: "none",
    borderRadius: 8,
    padding: "14px 18px",
    fontSize: 15,
    fontWeight: 800,
    background: designTokens.colors.danger,
    color: "#fff7ed",
    cursor: "pointer",
  },
  error: {
    margin: 0,
    color: "#fca5a5",
  },
  success: {
    margin: 0,
    color: "#86efac",
  },
  helperText: {
    margin: 0,
    color: designTokens.colors.text,
    lineHeight: 1.6,
  },
  miniHelperText: {
    margin: "6px 0 0",
    color: designTokens.colors.muted,
    fontSize: 12,
    lineHeight: 1.4,
  },
  legalCard: {
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 24,
    background: "rgba(6, 78, 59, 0.24)",
    border: "1px solid rgba(45, 212, 191, 0.18)",
  },
  legalList: {
    display: "grid",
    gap: 10,
  },
  legalNoticeItem: {
    margin: 0,
    color: "#d1fae5",
    lineHeight: 1.65,
  },
  legalFinePrint: {
    margin: 0,
    color: "#a7f3d0",
    fontSize: 13,
    lineHeight: 1.6,
  },
  legalLinkRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  },
  consentBox: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    background: "rgba(2, 6, 23, 0.52)",
    border: "1px solid rgba(45, 212, 191, 0.18)",
  },
  consentIntro: {
    margin: 0,
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.6,
  },
  checkboxRow: {
    display: "grid",
    gridTemplateColumns: "20px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    color: "#e2e8f0",
    fontSize: 13,
    lineHeight: 1.5,
    cursor: "pointer",
  },
  checkboxInput: {
    width: 16,
    height: 16,
    marginTop: 2,
    accentColor: designTokens.colors.blue,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 14,
  },
  metricCard: {
    background:
      "linear-gradient(145deg, rgba(12, 15, 31, 0.86), rgba(4, 6, 14, 0.78))",
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: 22,
    padding: 18,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  },
  metricLabel: {
    margin: 0,
    color: designTokens.colors.muted,
    fontSize: 13,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    fontWeight: 800,
  },
  metricValue: {
    margin: "12px 0 0",
    fontSize: "2.2rem",
    fontWeight: 900,
    lineHeight: 1,
    color: designTokens.colors.white,
  },
  metricValueSmall: {
    margin: "12px 0 0",
    fontSize: "1rem",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  metricHint: {
    color: designTokens.colors.muted,
    fontSize: 13,
  },
  resultCard: {
    display: "grid",
    gap: 18,
    padding: 20,
    borderRadius: 22,
    background: "rgba(3, 4, 10, 0.68)",
    border: `1px solid ${designTokens.colors.border}`,
  },
  resultTopRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  mutedLabel: {
    margin: "0 0 8px",
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: designTokens.colors.muted,
  },
  link: {
    color: designTokens.colors.cyan,
    fontWeight: 700,
    textDecoration: "none",
    wordBreak: "break-all",
  },
  inlineActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  inlineForm: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
  },
  qrPanel: {
    display: "flex",
    gap: 18,
    alignItems: "center",
    flexWrap: "wrap",
  },
  qrText: {
    flex: 1,
    minWidth: 220,
  },
  qrHeadline: {
    margin: "0 0 6px",
    fontSize: "1.05rem",
    fontWeight: 800,
  },
  qrDescription: {
    margin: "0 0 14px",
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
  linkList: {
    display: "grid",
    gap: 10,
  },
  linkListItem: {
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: 18,
    background: "rgba(3, 4, 10, 0.62)",
    color: designTokens.colors.ink,
    padding: 16,
    textAlign: "left",
    cursor: "pointer",
    transition: "transform 180ms ease, border-color 180ms ease, background 180ms ease",
  },
  linkListItemActive: {
    border: `1px solid ${designTokens.colors.borderBright}`,
    borderRadius: 18,
    background: "linear-gradient(135deg, rgba(76, 85, 255, 0.22), rgba(3, 4, 10, 0.82))",
    color: designTokens.colors.ink,
    padding: 16,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: designTokens.shadows.blueGlow,
  },
  linkListTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  linkShortCode: {
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: "0.03em",
  },
  linkOriginal: {
    margin: "10px 0",
    color: "#cbd5e1",
    lineHeight: 1.55,
    wordBreak: "break-word",
  },
  linkListFooter: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#94a3b8",
    fontSize: 12,
    flexWrap: "wrap",
  },
  panelCard: {
    background:
      "linear-gradient(150deg, rgba(12, 15, 31, 0.82), rgba(4, 6, 14, 0.76))",
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: 26,
    padding: 20,
    display: "grid",
    gap: 16,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  },
  docsQuickPanel: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 22,
    background:
      "linear-gradient(150deg, rgba(6, 78, 59, 0.24), rgba(8, 13, 22, 0.76))",
    border: `1px solid ${designTokens.colors.border}`,
  },
  docsQuickList: {
    display: "grid",
    gap: 10,
  },
  docsQuickItem: {
    display: "grid",
    gap: 5,
    padding: 12,
    borderRadius: 14,
    background: "rgba(255, 255, 255, 0.045)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    color: designTokens.colors.text,
    fontSize: 13,
    lineHeight: 1.45,
  },
  subscriptionCard: {
    display: "grid",
    gap: 10,
    padding: 16,
    borderRadius: 18,
    background:
      "linear-gradient(145deg, rgba(37, 99, 235, 0.16), rgba(16, 185, 129, 0.08))",
    border: `1px solid ${designTokens.colors.border}`,
  },
  subscriptionTitle: {
    margin: 0,
    color: designTokens.colors.white,
    fontSize: "1.65rem",
    lineHeight: 1,
    fontWeight: 950,
  },
  billingStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  billingStatCard: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(3, 4, 10, 0.58)",
    border: `1px solid ${designTokens.colors.border}`,
  },
  billingStatLabel: {
    margin: 0,
    color: designTokens.colors.muted,
    fontSize: 12,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  billingStatValue: {
    margin: "10px 0 0",
    fontSize: "1.35rem",
    fontWeight: 800,
    lineHeight: 1.2,
  },
  billingStatValueSmall: {
    margin: "10px 0 0",
    fontSize: "0.95rem",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  planGrid: {
    display: "grid",
    gap: 12,
  },
  compactPlanGrid: {
    display: "grid",
    gap: 10,
  },
  planCard: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(150deg, rgba(10, 13, 28, 0.82), rgba(3, 4, 10, 0.74))",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  },
  compactPlanCard: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background:
      "linear-gradient(150deg, rgba(10, 13, 28, 0.80), rgba(3, 4, 10, 0.70))",
    border: `1px solid ${designTokens.colors.border}`,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  },
  planCardFeatured: {
    border: `1px solid ${designTokens.colors.borderBright}`,
    boxShadow: "0 22px 70px rgba(76, 85, 255, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
  },
  planHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  planName: {
    fontSize: "1rem",
  },
  planPrice: {
    margin: 0,
    fontSize: "1.7rem",
    fontWeight: 900,
    lineHeight: 1,
    color: designTokens.colors.white,
  },
  compactPlanPrice: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 900,
    lineHeight: 1.1,
    color: designTokens.colors.white,
  },
  planFeatureList: {
    display: "grid",
    gap: 8,
  },
  planFeatureItem: {
    margin: 0,
    color: designTokens.colors.text,
    lineHeight: 1.5,
  },
  paymentCard: {
    display: "grid",
    gap: 8,
    padding: 16,
    borderRadius: 18,
    background: "rgba(3, 4, 10, 0.58)",
    border: `1px solid ${designTokens.colors.border}`,
  },
  usageGrid: {
    display: "grid",
    gap: 12,
  },
  usageBar: {
    display: "grid",
    gap: 8,
  },
  usageBarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  usageBarLabel: {
    color: designTokens.colors.text,
    fontSize: 13,
    fontWeight: 800,
  },
  usageBarCount: {
    color: designTokens.colors.muted,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  usageBarTrack: {
    height: 8,
    borderRadius: 999,
    background: "rgba(148, 163, 184, 0.16)",
    overflow: "hidden",
  },
  usageBarFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 180ms ease",
  },
  invoiceList: {
    display: "grid",
    gap: 10,
  },
  invoiceRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    background: "rgba(255, 255, 255, 0.04)",
    border: `1px solid ${designTokens.colors.border}`,
  },
  inlineLink: {
    color: designTokens.colors.ice,
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
  },
  domainList: {
    display: "grid",
    gap: 12,
  },
  domainCard: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    background: "rgba(3, 4, 10, 0.58)",
    border: `1px solid ${designTokens.colors.border}`,
  },
  dnsGrid: {
    display: "grid",
    gap: 10,
  },
  codeLine: {
    margin: "4px 0 0",
    padding: "8px 10px",
    borderRadius: 10,
    background: "rgba(0, 0, 0, 0.42)",
    color: designTokens.colors.ice,
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: 12,
    lineHeight: 1.5,
    wordBreak: "break-all",
  },
  routeList: {
    display: "grid",
    gap: 12,
  },
  routeCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 18,
    background: "rgba(3, 4, 10, 0.58)",
    border: `1px solid ${designTokens.colors.border}`,
  },
  routeLabel: {
    margin: "0 0 6px",
    fontSize: 13,
    fontWeight: 800,
    color: "#e2e8f0",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },
  routeUrl: {
    margin: 0,
    color: "#cbd5e1",
    wordBreak: "break-all",
  },
  routeMeta: {
    display: "grid",
    gap: 8,
    justifyItems: "end",
  },
  routeTime: {
    fontSize: 12,
    color: "#94a3b8",
  },
  deviceBar: {
    display: "grid",
    gap: 8,
  },
  deviceBarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deviceBarLabel: {
    fontWeight: 700,
    textTransform: "capitalize",
  },
  deviceBarCount: {
    color: "#cbd5e1",
  },
  deviceBarTrack: {
    height: 10,
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.07)",
    overflow: "hidden",
  },
  deviceBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #ffffff 0%, #4c55ff 70%, #79e6ff 100%)",
    boxShadow: "0 0 18px rgba(76, 85, 255, 0.35)",
  },
  eventList: {
    display: "grid",
    gap: 12,
  },
  eventCard: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(3, 4, 10, 0.58)",
    border: `1px solid ${designTokens.colors.border}`,
  },
  eventTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  eventTitle: {
    fontSize: 15,
  },
  eventMeta: {
    margin: "8px 0 6px",
    color: "#cbd5e1",
  },
  eventTarget: {
    margin: "0 0 6px",
    color: "#7dd3fc",
    wordBreak: "break-all",
  },
  eventReferrer: {
    margin: 0,
    color: "#94a3b8",
    wordBreak: "break-word",
  },
  emptyState: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
};
