import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(
  /\/$/,
  ""
);
const STORAGE_KEY = "url-shortener-session-token";
const ACCOUNT_POLICY_VERSION = "2026-05-19";
const LINK_POLICY_VERSION = "2026-05-19";

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

const LEGAL_NOTICES = [
  "Privacy: account data, billing records, support messages, and link analytics are used to run the service, prevent abuse, and provide reports.",
  "Acceptable use: no phishing, malware, spam, unlawful content, impersonation, deceptive redirects, or links you do not have authority to share.",
  "Grievance: publish a real support/grievance email before launch and respond to serious abuse/privacy complaints quickly.",
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

const PLAN_ORDER = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

const DEFAULT_PUBLIC_PLANS = [
  {
    id: "free",
    name: "Free",
    priceInPaise: 0,
    currency: "INR",
    intervalMonths: 0,
    linkLimit: 20,
    domainLimit: 0,
    features: [
      "Up to 20 active links",
      "Basic analytics",
      "QR codes",
      "No branded domain",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceInPaise: 49900,
    currency: "INR",
    intervalMonths: 1,
    linkLimit: 200,
    domainLimit: 1,
    features: [
      "Up to 200 active links",
      "1 branded domain",
      "Fallback routing",
      "Advanced analytics",
      "Priority email support",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceInPaise: 299900,
    currency: "INR",
    intervalMonths: 1,
    linkLimit: 5000,
    domainLimit: 5,
    features: [
      "Up to 5000 active links",
      "Up to 5 branded domains",
      "Team-ready workspace",
      "Campaign-friendly analytics",
      "Priority onboarding support",
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
  if (!plan?.priceInPaise) return "Free";

  const suffix =
    plan.intervalMonths === 1
      ? "/month"
      : plan.intervalMonths
        ? `/${plan.intervalMonths} months`
        : "";

  return `${formatPriceInInr(plan.priceInPaise)}${suffix}`;
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
    healthy: { background: "rgba(34, 197, 94, 0.16)", color: "#bbf7d0" },
    warning: { background: "rgba(251, 191, 36, 0.18)", color: "#fde68a" },
    danger: { background: "rgba(248, 113, 113, 0.18)", color: "#fecaca" },
    neutral: { background: "rgba(148, 163, 184, 0.18)", color: "#e2e8f0" },
    accent: { background: "rgba(56, 189, 248, 0.18)", color: "#bae6fd" },
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

export default function App() {
  const [authMode, setAuthMode] = useState("register");
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
  const [fallbackInput, setFallbackInput] = useState("");
  const [expiry, setExpiry] = useState(30);
  const [loading, setLoading] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [publicPlans, setPublicPlans] = useState(DEFAULT_PUBLIC_PLANS);
  const [supportEmail, setSupportEmail] = useState("support@shotlink.in");
  const [billingSummary, setBillingSummary] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSubmittingPlan, setBillingSubmittingPlan] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [domainMessage, setDomainMessage] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState("");
  const [selectedDomainHost, setSelectedDomainHost] = useState("");
  const [linkComplianceAccepted, setLinkComplianceAccepted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateLayout = () => setIsMobile(window.innerWidth < 1080);
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPublicPlans = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/billing/plans`);
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setPublicPlans(data.plans?.length ? data.plans : DEFAULT_PUBLIC_PLANS);
          setSupportEmail(data.supportEmail || "support@shotlink.in");
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
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(hours ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [analytics]);

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
  }, [token]);

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
          setLinks(data.links || []);
          setSelectedShortCode((currentSelected) => {
            if (!currentSelected && data.links?.length) {
              return data.links[0].shortCode;
            }

            if (currentSelected && data.links?.some((link) => link.shortCode === currentSelected)) {
              return currentSelected;
            }

            return data.links?.[0]?.shortCode || "";
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
  }, [session, token]);

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
  }, [selectedShortCode, token]);

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

  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken("");
    setSession(null);
    setLinks([]);
    setSelectedShortCode("");
    setAnalytics(null);
    setBillingSummary(null);
    setBillingMessage("");
    setBillingLoading(false);
    setBillingSubmittingPlan("");
    setCustomDomainInput("");
    setDomainMessage("");
    setDomainSaving(false);
    setDomainVerifying("");
    setSelectedDomainHost("");
    setLinkComplianceAccepted(false);
  };

  const authorizedFetch = async (path, options = {}) => {
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
  };

  const fetchBillingSummary = async () => {
    const response = await authorizedFetch("/api/v1/billing/summary");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not load billing");
    }

    return data;
  };

  const applyBillingSummary = (data) => {
    setBillingSummary(data);
    if (data.supportEmail) {
      setSupportEmail(data.supportEmail);
    }
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
  };

  const applyWorkspaceSettings = (data) => {
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
  };

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
  }, [token]);

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

  const startPlanCheckout = async (planId) => {
    setBillingSubmittingPlan(planId);
    setError("");

    try {
      const response = await authorizedFetch("/api/v1/billing/payment-links", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not open checkout");
      }

      setBillingMessage(`Opening Razorpay checkout for the ${data.plan.name} plan.`);

      if (!data.paymentLinkUrl) {
        throw new Error("Razorpay did not return a payment link");
      }

      window.location.href = data.paymentLinkUrl;
    } catch (requestError) {
      setError(requestError.message || "Could not open checkout");
    } finally {
      setBillingSubmittingPlan("");
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

    await authorizedFetch(`/api/v1/links/${selectedShortCode}/expire`, {
      method: "PATCH",
    });

    await refreshAnalytics(selectedShortCode);
    await refreshBillingSummary();
    setLinks((currentLinks) =>
      currentLinks.map((link) =>
        link.shortCode === selectedShortCode ? { ...link, isActive: false } : link
      )
    );
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
    linkLimit: 20,
    domainLimit: 0,
  };
  const customDomains = session?.workspace?.customDomains || [];
  const verifiedDomains = customDomains.filter((domain) => domain.status === "verified");
  const domainLimit = currentPlan.domainLimit ?? 0;
  const cnameTarget = session?.workspace?.domainSetup?.cnameTarget || "go.shotlink.in";
  const activeLinkCount =
    billingSummary?.currentPlan?.linkCountUsed ?? links.filter((link) => link.isActive).length;
  const activeLinkLimit = currentPlan.linkLimit || 20;
  const remainingLinkSlots =
    billingSummary?.currentPlan?.linkCountRemaining ??
    Math.max(activeLinkLimit - activeLinkCount, 0);
  const currentPlanRank = PLAN_ORDER[currentPlan.effectivePlanId] ?? 0;
  const latestPayment = billingSummary?.recentPayments?.[0] || null;
  const requiredAccountConsentsAccepted = REQUIRED_AUTH_CONSENTS.every(
    (item) => authForm.consents[item.id]
  );
  const authSubmitDisabled =
    authSubmitting || (authMode === "register" && !requiredAccountConsentsAccepted);
  const linkSubmitDisabled = loading || remainingLinkSlots <= 0 || !linkComplianceAccepted;

  if (authLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.backgroundGlowTop} />
        <div style={styles.backgroundGlowBottom} />
        <div style={styles.loadingShell}>
          <h1 style={styles.loadingTitle}>Loading workspace...</h1>
          <p style={styles.loadingText}>Restoring your session and link inventory.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.backgroundGlowTop} />
        <div style={styles.backgroundGlowBottom} />

        <div
          style={{
            ...styles.authShell,
            gridTemplateColumns: isMobile ? "1fr" : "minmax(380px, 540px) minmax(320px, 420px)",
          }}
        >
          <section style={styles.heroPanel}>
            <StatusPill label="Shotlink for India" tone="accent" />
            <h1 style={styles.title}>Shotlink turns every campaign URL into a resilient business link.</h1>
            <p style={styles.subtitle}>
              Teams get branded short links on shotlink.in, protected analytics, session-based
              auth, and health-aware failover routing for campaigns that cannot afford dead URLs.
            </p>

            <div style={styles.featureGrid}>
              <div style={styles.featureCard}>
                <h3 style={styles.featureTitle}>Workspace-owned links</h3>
                <p style={styles.featureText}>
                  Every short URL now belongs to an account and workspace instead of floating
                  anonymously.
                </p>
              </div>
              <div style={styles.featureCard}>
                <h3 style={styles.featureTitle}>Protected analytics</h3>
                <p style={styles.featureText}>
                  Event telemetry stays behind auth while redirects remain public and fast.
                </p>
              </div>
              <div style={styles.featureCard}>
                <h3 style={styles.featureTitle}>Failover routing</h3>
                <p style={styles.featureText}>
                  Primary links can fall back to healthy alternates when campaign pages fail.
                </p>
              </div>
              <div style={styles.featureCard}>
                <h3 style={styles.featureTitle}>Scale-friendly direction</h3>
                <p style={styles.featureText}>
                  This lays the groundwork for teams, billing, API keys, and async ingestion.
                </p>
              </div>
            </div>

            <div style={styles.pricingPreview}>
              <div style={styles.panelTitleRow}>
                <div>
                  <p style={styles.sectionEyebrow}>Pricing</p>
                  <h2 style={styles.panelTitle}>Plans you can start selling right away</h2>
                </div>
                <a href={`mailto:${supportEmail}`} style={styles.link}>
                  Need launch help?
                </a>
              </div>

              <div
                style={{
                  ...styles.planGrid,
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                }}
              >
                {publicPlans.map((plan) => (
                  <div key={plan.id} style={styles.planCard}>
                    <div style={styles.planHeader}>
                      <strong style={styles.planName}>{plan.name}</strong>
                      <StatusPill
                        label={`${plan.linkLimit} active links`}
                        tone={getPlanTone(plan.id)}
                      />
                    </div>
                    <p style={styles.planPrice}>{formatPlanPrice(plan)}</p>
                    <div style={styles.planFeatureList}>
                      {plan.features.map((feature) => (
                        <p key={feature} style={styles.planFeatureItem}>
                          {feature}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.legalCard}>
              <div>
                <p style={styles.sectionEyebrow}>Legal basics</p>
                <h2 style={styles.panelTitle}>Consent and abuse controls are built in</h2>
              </div>
              <div style={styles.legalList}>
                {LEGAL_NOTICES.map((notice) => (
                  <p key={notice} style={styles.legalNoticeItem}>
                    {notice}
                  </p>
                ))}
              </div>
              <p style={styles.legalFinePrint}>
                Policy version {ACCOUNT_POLICY_VERSION}. Replace placeholder brand/contact details
                with your real business name, address, grievance email, refund policy, and lawyer
                reviewed Terms before accepting paid customers.
              </p>
              <div style={styles.legalLinkRow}>
                <a href={`mailto:${supportEmail}`} style={styles.link}>
                  Contact support
                </a>
                <a href={`mailto:${supportEmail}?subject=Abuse%20report`} style={styles.link}>
                  Report abuse
                </a>
              </div>
            </div>
          </section>

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
              <h2 style={styles.authTitle}>
                {authMode === "register" ? "Launch your workspace" : "Welcome back"}
              </h2>
              <p style={styles.authSubtitle}>
                {authMode === "register"
                  ? "Create the first owner account and a default workspace."
                  : "Open your workspace dashboard and manage live short links."}
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
                    placeholder="Yash Raj"
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
                    placeholder="founder@shotlink.in"
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
                  placeholder="8+ chars with uppercase, lowercase, and a number"
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
                    placeholder="Shotlink Growth Team"
                  />
                </label>
              ) : null}

              {authMode === "register" ? (
                <div style={styles.consentBox}>
                  <div>
                    <p style={styles.sectionEyebrow}>Required consent</p>
                    <p style={styles.consentIntro}>
                      We store this consent record with a hashed IP, user agent, and timestamp so
                      the business has evidence of what the user accepted.
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
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowTop} />
      <div style={styles.backgroundGlowBottom} />

      <div style={styles.dashboardShell}>
        <header style={styles.headerBar}>
          <div>
            <p style={styles.sectionEyebrow}>Workspace</p>
            <h1 style={styles.dashboardTitle}>{session.workspace.name}</h1>
            <p style={styles.workspaceMeta}>
              {session.user.name} - {currentPlan.effectivePlanName} plan - {session.workspace.slug}
            </p>
          </div>
          <div style={styles.headerActions}>
            <StatusPill label={`${activeLinkCount}/${activeLinkLimit} active links`} tone="accent" />
            <StatusPill
              label={formatLabel(currentPlan.billingStatus)}
              tone={getBillingTone(currentPlan.billingStatus)}
            />
            <button style={styles.secondaryButton} onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        <div
          style={{
            ...styles.dashboardGrid,
            gridTemplateColumns: isMobile ? "1fr" : "minmax(280px, 340px) minmax(360px, 520px) minmax(320px, 460px)",
          }}
        >
          <aside style={styles.sidebarCard}>
            <div style={styles.panelCard}>
              <div style={styles.panelTitleRow}>
                <div>
                  <p style={styles.sectionEyebrow}>Billing</p>
                  <h2 style={styles.panelTitle}>Plan, usage, and upgrades</h2>
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

              {billingMessage ? <p style={styles.success}>{billingMessage}</p> : null}

              {latestPayment ? (
                <div style={styles.paymentCard}>
                  <div style={styles.planHeader}>
                    <strong style={styles.planName}>Latest payment</strong>
                    <StatusPill
                      label={formatLabel(latestPayment.status)}
                      tone={getBillingTone(latestPayment.status)}
                    />
                  </div>
                  <p style={styles.helperText}>
                    {latestPayment.planName} - {formatPriceInInr(latestPayment.amountInPaise)}
                  </p>
                  <p style={styles.helperText}>
                    {latestPayment.paidAt
                      ? `Paid on ${formatDate(latestPayment.paidAt)}`
                      : `Created on ${formatDate(latestPayment.createdAt)}`}
                  </p>
                  <p style={styles.helperText}>Reference: {latestPayment.referenceId}</p>
                  {latestPayment.paymentLinkUrl && latestPayment.status !== "paid" ? (
                    <a href={latestPayment.paymentLinkUrl} target="_blank" rel="noreferrer" style={styles.link}>
                      Reopen pending checkout
                    </a>
                  ) : null}
                </div>
              ) : null}

              <div style={styles.planGrid}>
                {publicPlans.map((plan) => {
                  const isCurrentPlan = plan.id === currentPlan.effectivePlanId;
                  const isLowerTier = (PLAN_ORDER[plan.id] ?? 0) < currentPlanRank;
                  const isRenewal =
                    currentPlan.effectivePlanId === "free" &&
                    currentPlan.configuredPlanId === plan.id;
                  const isDisabled =
                    plan.id === "free" ||
                    isCurrentPlan ||
                    isLowerTier ||
                    billingSubmittingPlan === plan.id;

                  let actionLabel = "Included";
                  if (plan.id !== "free") {
                    if (isCurrentPlan) {
                      actionLabel = "Current plan";
                    } else if (isRenewal) {
                      actionLabel = `Renew ${plan.name}`;
                    } else if (isLowerTier) {
                      actionLabel = "Downgrade later";
                    } else {
                      actionLabel = `Choose ${plan.name}`;
                    }
                  }

                  return (
                    <div key={plan.id} style={styles.planCard}>
                      <div style={styles.planHeader}>
                        <strong style={styles.planName}>{plan.name}</strong>
                        <StatusPill
                          label={`${plan.linkLimit} active links`}
                          tone={getPlanTone(plan.id)}
                        />
                      </div>
                      <p style={styles.planPrice}>{formatPlanPrice(plan)}</p>
                      <div style={styles.planFeatureList}>
                        {plan.features.map((feature) => (
                          <p key={feature} style={styles.planFeatureItem}>
                            {feature}
                          </p>
                        ))}
                      </div>
                      <button
                        style={
                          isDisabled
                            ? { ...styles.secondaryButton, width: "100%", opacity: 0.6, cursor: "not-allowed" }
                            : { ...styles.primaryButton, width: "100%" }
                        }
                        onClick={() => !isDisabled && startPlanCheckout(plan.id)}
                        disabled={isDisabled}
                      >
                        {billingSubmittingPlan === plan.id ? "Opening checkout..." : actionLabel}
                      </button>
                    </div>
                  );
                })}
              </div>

              <p style={styles.helperText}>
                Need branded domains or customer onboarding help? Write to{" "}
                <a href={`mailto:${supportEmail}`} style={styles.link}>
                  {supportEmail}
                </a>
                .
              </p>
            </div>

            <div style={styles.panelCard}>
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
                  placeholder="go.customerbrand.in"
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
              <h2 style={styles.panelTitle}>Your links</h2>
              <StatusPill label={workspaceLoading ? "syncing" : "live"} tone="accent" />
            </div>

            {links.length ? (
              <div style={styles.linkList}>
                {links.map((link) => (
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
          </aside>

          <section style={styles.builderCard}>
            <div style={styles.panelTitleRow}>
              <div>
                <p style={styles.sectionEyebrow}>Builder</p>
                <h2 style={styles.panelTitle}>Create workspace-owned links</h2>
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
                placeholder="https://campaign.brand.com/launch"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>

            <label style={styles.label}>
              Fallback destinations
              <textarea
                style={styles.textarea}
                placeholder={"https://backup-1.example.com\nhttps://backup-2.example.com"}
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
                  : "Create resilient short link"}
            </button>

            {error ? <p style={styles.error}>{error}</p> : null}
            {copied ? <p style={styles.success}>{copied}</p> : null}

            {analytics?.shortUrl ? (
              <div style={styles.resultCard}>
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

          <section style={styles.analyticsPanel}>
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
              <div style={styles.metricCard}>
                <p style={styles.metricLabel}>Total clicks</p>
                <p style={styles.metricValue}>{analytics?.clicks ?? 0}</p>
              </div>
              <div style={styles.metricCard}>
                <p style={styles.metricLabel}>Last click</p>
                <p style={styles.metricValueSmall}>{formatDate(analytics?.lastClickedAt)}</p>
              </div>
              <div style={styles.metricCard}>
                <p style={styles.metricLabel}>Expires in</p>
                <p style={styles.metricValueSmall}>{countdown || "Not started"}</p>
              </div>
              <div style={styles.metricCard}>
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

            <div style={styles.panelCard}>
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

            <div style={styles.panelCard}>
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

            <div style={styles.panelCard}>
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

const styles = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    background:
      "radial-gradient(circle at top left, rgba(34,197,94,0.12), transparent 32%), radial-gradient(circle at bottom right, rgba(56,189,248,0.12), transparent 30%), linear-gradient(180deg, #020617 0%, #07111f 50%, #0f172a 100%)",
    color: "#f8fafc",
    padding: "32px 20px 40px",
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -120,
    left: -100,
    width: 320,
    height: 320,
    background: "rgba(16, 185, 129, 0.16)",
    filter: "blur(70px)",
    pointerEvents: "none",
  },
  backgroundGlowBottom: {
    position: "absolute",
    right: -120,
    bottom: -120,
    width: 340,
    height: 340,
    background: "rgba(14, 165, 233, 0.18)",
    filter: "blur(80px)",
    pointerEvents: "none",
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
    maxWidth: 1380,
    margin: "0 auto",
    display: "grid",
    gap: 24,
  },
  loadingShell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 640,
    margin: "12vh auto 0",
    padding: 32,
    borderRadius: 28,
    background: "rgba(15, 23, 42, 0.88)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    textAlign: "center",
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
    gap: 24,
    paddingTop: 18,
  },
  title: {
    margin: "18px 0 14px",
    fontSize: "clamp(2.5rem, 4vw, 4.8rem)",
    lineHeight: 0.97,
    letterSpacing: "-0.05em",
    maxWidth: 680,
  },
  subtitle: {
    margin: 0,
    maxWidth: 620,
    fontSize: "1.05rem",
    lineHeight: 1.75,
    color: "#cbd5e1",
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
    background: "rgba(15, 23, 42, 0.9)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: 28,
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(2, 6, 23, 0.44)",
  },
  authTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
  },
  authTab: {
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    padding: "16px 18px",
    fontWeight: 700,
    cursor: "pointer",
  },
  authTabActive: {
    border: "none",
    background: "rgba(56, 189, 248, 0.08)",
    color: "#e0f2fe",
    padding: "16px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
  authBody: {
    display: "grid",
    gap: 16,
    padding: 24,
  },
  authTitle: {
    margin: 0,
    fontSize: "1.7rem",
  },
  authSubtitle: {
    margin: "4px 0 4px",
    color: "#cbd5e1",
    lineHeight: 1.6,
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    padding: "4px 4px 0",
  },
  dashboardTitle: {
    margin: "8px 0 0",
    fontSize: "2.2rem",
    lineHeight: 1.02,
  },
  workspaceMeta: {
    margin: "8px 0 0",
    color: "#cbd5e1",
  },
  headerActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  dashboardGrid: {
    display: "grid",
    gap: 20,
    alignItems: "start",
  },
  sidebarCard: {
    background: "rgba(15, 23, 42, 0.86)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: 26,
    padding: 20,
    display: "grid",
    gap: 16,
  },
  builderCard: {
    background: "rgba(15, 23, 42, 0.86)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: 26,
    padding: 22,
    display: "grid",
    gap: 18,
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
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#7dd3fc",
  },
  panelTitle: {
    margin: "6px 0 0",
    fontSize: "1.15rem",
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
    color: "#e2e8f0",
  },
  input: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid rgba(148, 163, 184, 0.24)",
    background: "rgba(2, 6, 23, 0.74)",
    color: "#f8fafc",
    padding: "15px 16px",
    outline: "none",
    fontSize: 15,
  },
  textarea: {
    width: "100%",
    minHeight: 110,
    resize: "vertical",
    borderRadius: 18,
    border: "1px solid rgba(148, 163, 184, 0.24)",
    background: "rgba(2, 6, 23, 0.74)",
    color: "#f8fafc",
    padding: "15px 16px",
    outline: "none",
    fontSize: 15,
    fontFamily: "inherit",
  },
  select: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid rgba(148, 163, 184, 0.24)",
    background: "rgba(2, 6, 23, 0.74)",
    color: "#f8fafc",
    padding: "15px 16px",
    outline: "none",
    fontSize: 15,
  },
  primaryButton: {
    border: "none",
    borderRadius: 18,
    padding: "15px 18px",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.01em",
    background: "linear-gradient(135deg, #38bdf8 0%, #14b8a6 100%)",
    color: "#04111d",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(125, 211, 252, 0.24)",
    borderRadius: 14,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 700,
    background: "rgba(15, 23, 42, 0.92)",
    color: "#e0f2fe",
    cursor: "pointer",
  },
  dangerButton: {
    border: "none",
    borderRadius: 18,
    padding: "14px 18px",
    fontSize: 15,
    fontWeight: 800,
    background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
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
    color: "#cbd5e1",
    lineHeight: 1.6,
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
    accentColor: "#14b8a6",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 14,
  },
  metricCard: {
    background: "rgba(15, 23, 42, 0.86)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: 22,
    padding: 18,
  },
  metricLabel: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 13,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  metricValue: {
    margin: "12px 0 0",
    fontSize: "2.2rem",
    fontWeight: 900,
    lineHeight: 1,
  },
  metricValueSmall: {
    margin: "12px 0 0",
    fontSize: "1rem",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  metricHint: {
    color: "#94a3b8",
    fontSize: 13,
  },
  resultCard: {
    display: "grid",
    gap: 18,
    padding: 20,
    borderRadius: 22,
    background: "rgba(2, 6, 23, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.14)",
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
    color: "#94a3b8",
  },
  link: {
    color: "#7dd3fc",
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
    border: "1px solid rgba(148, 163, 184, 0.14)",
    borderRadius: 18,
    background: "rgba(2, 6, 23, 0.62)",
    color: "#f8fafc",
    padding: 16,
    textAlign: "left",
    cursor: "pointer",
  },
  linkListItemActive: {
    border: "1px solid rgba(56, 189, 248, 0.42)",
    borderRadius: 18,
    background: "rgba(8, 47, 73, 0.72)",
    color: "#f8fafc",
    padding: 16,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(14, 165, 233, 0.12)",
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
    background: "rgba(15, 23, 42, 0.86)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: 24,
    padding: 20,
    display: "grid",
    gap: 16,
  },
  billingStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  billingStatCard: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(2, 6, 23, 0.64)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
  },
  billingStatLabel: {
    margin: 0,
    color: "#94a3b8",
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
  planCard: {
    display: "grid",
    gap: 14,
    padding: 18,
    borderRadius: 20,
    background: "rgba(2, 6, 23, 0.64)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
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
  },
  planFeatureList: {
    display: "grid",
    gap: 8,
  },
  planFeatureItem: {
    margin: 0,
    color: "#cbd5e1",
    lineHeight: 1.5,
  },
  paymentCard: {
    display: "grid",
    gap: 8,
    padding: 16,
    borderRadius: 18,
    background: "rgba(2, 6, 23, 0.64)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
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
    background: "rgba(2, 6, 23, 0.64)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
  },
  dnsGrid: {
    display: "grid",
    gap: 10,
  },
  codeLine: {
    margin: "4px 0 0",
    padding: "8px 10px",
    borderRadius: 10,
    background: "rgba(15, 23, 42, 0.92)",
    color: "#e0f2fe",
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
    background: "rgba(2, 6, 23, 0.64)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
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
    background: "rgba(30, 41, 59, 1)",
    overflow: "hidden",
  },
  deviceBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(135deg, #38bdf8 0%, #22c55e 100%)",
  },
  eventList: {
    display: "grid",
    gap: 12,
  },
  eventCard: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(2, 6, 23, 0.64)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
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
