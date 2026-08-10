import { useCallback, useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { apiFetch } from "./apiClient";
import { BrandLogo } from "./components/BrandLogo";
import { ConsentCheckbox, FeedbackMessage } from "./components/FormFeedback";
import { DeviceBar, UsageBar } from "./components/MetricBars";
import { PublicFooter, PublicHeader, PublicLanding } from "./components/PublicMarketing";
import { StatusPill } from "./components/StatusPill";
import { usePublicPage } from "./hooks/usePublicPage";
import { useResponsiveLayout } from "./hooks/useResponsiveLayout";
import {
  LEGAL_PAGE_CONTENT,
  OPERATOR_NOTICE,
  POLICY_EFFECTIVE_DATE,
} from "./legalContent";
import {
  formatDate,
  formatLabel,
  formatPlanPrice,
  formatPriceInInr,
} from "./utils/formatters";
import { enterpriseDashboardStyles, styles } from "./styles";

const LEGACY_SESSION_STORAGE_KEY = "url-shortener-session-token";
const ACCOUNT_POLICY_VERSION = "2026-08-09";
const LINK_POLICY_VERSION = "2026-08-09";

const CREATOR_DASHBOARD_NAV_ITEMS = [
  { id: "builder-panel", label: "Create link", index: "01" },
  { id: "social-panel", label: "Social publisher", index: "02" },
  { id: "links-panel", label: "Link library", index: "03" },
  { id: "analytics-panel", label: "Analytics", index: "04" },
  { id: "domains-panel", label: "Domains", index: "05" },
  { id: "billing-panel", label: "Billing", index: "06" },
  { id: "docs-panel", label: "Operator guide", index: "07" },
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

const API_SNIPPET_LINES = [
  "POST /api/v1/links",
  "Authorization: Bearer <session-token>",
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

const WORKSPACE_TYPE_OPTIONS = [
  {
    id: "creator",
    label: "Creator",
    description: "Campaigns, portfolios, releases, QR codes, and audience insight.",
  },
  {
    id: "institution",
    label: "University / Institution",
    description: "Official resources, controlled domains, audit history, and team access.",
  },
];

const INSTITUTION_RESOURCE_OPTIONS = [
  { value: "attendance", label: "Attendance sheet" },
  { value: "registration", label: "Registration form" },
  { value: "notice", label: "Official notice" },
  { value: "results", label: "Results sheet" },
  { value: "lecture", label: "Lecture resource" },
  { value: "resource", label: "General resource" },
];

const CREATOR_CONTENT_OPTIONS = [
  { value: "video", label: "Video" },
  { value: "reel", label: "Reel / short" },
  { value: "post", label: "Social post" },
  { value: "collab", label: "Collaboration" },
  { value: "live", label: "Live event" },
  { value: "portfolio", label: "Portfolio" },
  { value: "campaign", label: "Campaign" },
];

const SOCIAL_PUBLISH_PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram",
    mark: "IG",
    helper: "Copy the post package and open Instagram for final review.",
    openUrl: "https://www.instagram.com/",
  },
  {
    id: "facebook",
    name: "Facebook",
    mark: "FB",
    helper: "Open Facebook's sharing dialog with the Shotlink attached.",
  },
  {
    id: "x",
    name: "X",
    mark: "X",
    helper: "Open a prepared X post with the caption and Shotlink.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    mark: "IN",
    helper: "Copy the caption and open LinkedIn's sharing dialog.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    mark: "TT",
    helper: "Copy the post package and open TikTok Upload.",
    openUrl: "https://www.tiktok.com/upload",
  },
  {
    id: "youtube",
    name: "YouTube",
    mark: "YT",
    helper: "Copy the post package and open YouTube Upload.",
    openUrl: "https://www.youtube.com/upload",
  },
];

function getSocialShareUrl(platformId, shortUrl, caption) {
  const message = [String(caption || "").trim(), shortUrl].filter(Boolean).join("\n\n");
  if (platformId === "x") {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
  }
  if (platformId === "facebook") {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shortUrl)}`;
  }
  if (platformId === "linkedin") {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shortUrl)}`;
  }
  return SOCIAL_PUBLISH_PLATFORMS.find((platform) => platform.id === platformId)?.openUrl || "";
}

function getLocalDateInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

function slugifyAliasPart(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDestinationAliasStem(rawUrl) {
  try {
    const hostname = new URL(String(rawUrl || "")).hostname.toLowerCase().replace(/^www\./, "");
    const matchesHost = (provider) => hostname === provider || hostname.endsWith(`.${provider}`);
    if (matchesHost("youtu.be") || matchesHost("youtube.com")) return "youtube";
    if (matchesHost("instagram.com")) return "instagram";
    if (matchesHost("tiktok.com")) return "tiktok";
    if (matchesHost("x.com") || matchesHost("twitter.com")) return "x";
    if (matchesHost("facebook.com")) return "facebook";
    if (matchesHost("linkedin.com")) return "linkedin";
    if (matchesHost("vimeo.com")) return "vimeo";
    if (matchesHost("loom.com")) return "loom";
    return slugifyAliasPart(hostname.split(".")[0]);
  } catch {
    return "";
  }
}

function buildDatedAlias(prefixParts, kind, date) {
  const suffixParts = [slugifyAliasPart(kind), slugifyAliasPart(date)].filter(Boolean);
  const suffix = suffixParts.join("-");
  const prefix = prefixParts.map(slugifyAliasPart).filter(Boolean).join("-");
  if (!prefix && !suffix) return "";
  if (!prefix) return suffix.slice(0, 48).replace(/-+$/g, "");

  const prefixBudget = Math.max(48 - suffix.length - 1, 1);
  const safePrefix = prefix.slice(0, prefixBudget).replace(/-+$/g, "");
  return [safePrefix, suffix].filter(Boolean).join("-");
}

function buildSmartAlias({
  workspaceType,
  url,
  institutionResourceKind,
  institutionUnit,
  institutionGroup,
  creatorContentKind,
  creatorContentTitle,
  resourceDate,
}) {
  if (workspaceType === "institution") {
    if (!String(url || "").trim() && !institutionUnit.trim() && !institutionGroup.trim()) return "";
    return buildDatedAlias(
      [institutionUnit, institutionGroup],
      institutionResourceKind,
      resourceDate
    );
  }

  const creatorStem = slugifyAliasPart(creatorContentTitle.trim() || getDestinationAliasStem(url));
  if (!creatorStem) return "";
  const normalizedKind = slugifyAliasPart(creatorContentKind);
  const kindAlreadyInName =
    creatorStem === normalizedKind || creatorStem.endsWith(`-${normalizedKind}`);
  return buildDatedAlias(
    [creatorStem],
    kindAlreadyInName ? "" : normalizedKind,
    resourceDate
  );
}

function classifyDestinationInput(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ""));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.toLowerCase();

    if (hostname === "docs.google.com" && pathname.startsWith("/spreadsheets/")) {
      return {
        type: "google_sheet",
        label: "Google Sheet detected",
        guidance:
          "Confirm the Sheet sharing setting before publishing. Shotlink controls the route and expiry, but Google still controls who can open the Sheet.",
      };
    }
    if (hostname === "docs.google.com" && pathname.startsWith("/forms/")) {
      return {
        type: "form",
        label: "Google Form detected",
        guidance:
          "Use expiry and a fallback page for time-bound registrations. Google Form access settings still apply after the redirect.",
      };
    }
    if (
      (hostname === "docs.google.com" && pathname.startsWith("/document/")) ||
      hostname === "drive.google.com"
    ) {
      return {
        type: "document",
        label: "Google document detected",
        guidance: "Check the Drive sharing audience before publishing an official resource link.",
      };
    }
    if (
      ["youtube.com", "youtu.be", "vimeo.com", "loom.com"].some(
        (provider) => hostname === provider || hostname.endsWith(`.${provider}`)
      ) ||
      /\.(mp4|mov|m4v|webm)(?:$|[?#])/i.test(parsed.href)
    ) {
      return {
        type: "video",
        label: "Video destination detected",
        guidance:
          "Shotlink measures visits to the video. Watch time and completion remain available from the video host, such as YouTube or Vimeo.",
      };
    }
    if (
      ["instagram.com", "tiktok.com", "facebook.com", "x.com", "twitter.com", "linkedin.com"].includes(
        hostname
      )
    ) {
      return {
        type: "social",
        label: "Social post detected",
        guidance: "Use a memorable alias and compare Shotlink referrers across campaign placements.",
      };
    }
    return {
      type: "website",
      label: "Website destination",
      guidance: "Add a fallback route when this destination is important or time-sensitive.",
    };
  } catch {
    return null;
  }
}

function getDestinationLabel(link) {
  if (link?.destinationLabel) return link.destinationLabel;
  return classifyDestinationInput(link?.originalUrl)?.label.replace(" detected", "") || "Website";
}

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
    name: "Creator Pro",
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
      "Up to 500 active campaign and bio links",
      "1 branded domain",
      "250 campaign QR codes",
      "Audience, device, and referrer analytics",
      "Editable destinations and fallback routing",
      "Priority email support",
    ],
  },
  {
    id: "business",
    name: "Studio",
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
      "Up to 10,000 active campaign links",
      "Up to 10 branded domains",
      "Team workspaces for talent and campaign managers",
      "5,000 campaign QR codes",
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
      "Verified institution email-domain governance",
      "Workspace roles and audit logs",
      "Dedicated success and security review",
      "Custom SLA and procurement support",
    ],
  },
];

const INSTITUTION_DASHBOARD_NAV_ITEMS = [
  { id: "builder-panel", label: "Publish resource", index: "01" },
  { id: "links-panel", label: "Official links", index: "02" },
  { id: "analytics-panel", label: "Usage analytics", index: "03" },
  { id: "domains-panel", label: "Domain control", index: "04" },
  { id: "billing-panel", label: "Plan & access", index: "05" },
  { id: "docs-panel", label: "Governance guide", index: "06" },
];

const DEFAULT_CHECKOUT_AVAILABILITY = Object.freeze({
  enabled: false,
  message:
    "Live paid checkout is coming soon. Razorpay Test Mode is restricted to internal verification, so no real payment is collected yet.",
});

function ShortenerPreview({ onStart }) {
  return (
    <div className="sl-lift" style={styles.shortenerPreviewCard}>
      <div style={styles.previewHeader}>
        <StatusPill label="Start now" tone="accent" />
        <span style={styles.previewDomain}>shotlink.in/summer-sale</span>
      </div>

      <div style={styles.previewForm}>
        <label style={styles.previewLabel}>
          Destination
          <div style={styles.previewInput}>https://brand.com/campaign/summer-launch</div>
        </label>
        <label style={styles.previewLabel}>
          Custom alias
          <div style={styles.previewAliasRow}>
            <span>shotlink.in/</span>
            <strong>summer-sale</strong>
          </div>
        </label>
        <button
          type="button"
          className="sl-action"
          style={styles.previewButton}
          onClick={onStart}
        >
          Shorten URL
        </button>
      </div>

      <div style={styles.previewResultGrid}>
        <div style={styles.previewQr}>
          <QRCodeCanvas
            value="https://shotlink.in/summer-sale"
            size={92}
            includeMargin
            aria-label="QR code for the demo short link"
          />
        </div>
        <div>
          <p style={styles.mutedLabel}>Ready to share</p>
          <p style={styles.previewShortLink}>shotlink.in/summer-sale</p>
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
function toBrowserSession(data) {
  return {
    csrfToken: data.csrfToken || "",
    sessionExpiresAt: data.sessionExpiresAt || null,
    user: data.user,
    workspace: data.workspace,
  };
}

function App() {
  const initialAuthPath = window.location.pathname.replace(/\/$/, "") || "/";
  const [authMode, setAuthMode] = useState(
    initialAuthPath === "/login" ? "login" : "register"
  );
  const [authViewOpen, setAuthViewOpen] = useState(
    initialAuthPath === "/login" || initialAuthPath === "/register"
  );
  const [publicPage, setPublicPage] = usePublicPage();
  const [session, setSession] = useState(null);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    workspaceName: "",
    workspaceType: "creator",
    consents: createDefaultConsents(),
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [links, setLinks] = useState([]);
  const [selectedShortCode, setSelectedShortCode] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [url, setUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [customAliasManuallyEdited, setCustomAliasManuallyEdited] = useState(false);
  const [institutionResourceKind, setInstitutionResourceKind] = useState("attendance");
  const [institutionUnit, setInstitutionUnit] = useState("");
  const [institutionGroup, setInstitutionGroup] = useState("");
  const [creatorContentKind, setCreatorContentKind] = useState("video");
  const [creatorContentTitle, setCreatorContentTitle] = useState("");
  const [resourceDate, setResourceDate] = useState(getLocalDateInputValue);
  const [socialPlatform, setSocialPlatform] = useState("instagram");
  const [socialCaption, setSocialCaption] = useState("");
  const [socialMessage, setSocialMessage] = useState("");
  const [socialError, setSocialError] = useState("");
  const [fallbackInput, setFallbackInput] = useState("");
  const [expiry, setExpiry] = useState(30);
  const [loading, setLoading] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [authError, setAuthError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");
  const [copied, setCopied] = useState("");
  const [publicPlans, setPublicPlans] = useState(DEFAULT_PUBLIC_PLANS);
  const [checkoutAvailability, setCheckoutAvailability] = useState(
    DEFAULT_CHECKOUT_AVAILABILITY
  );
  const [billingSummary, setBillingSummary] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [checkoutLoadingPlanId, setCheckoutLoadingPlanId] = useState("");
  const [billingMessage, setBillingMessage] = useState("");
  const [billingError, setBillingError] = useState("");
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [domainMessage, setDomainMessage] = useState("");
  const [domainError, setDomainError] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState("");
  const [managedEmailDomainInput, setManagedEmailDomainInput] = useState("");
  const [managedEmailDomainMessage, setManagedEmailDomainMessage] = useState("");
  const [managedEmailDomainError, setManagedEmailDomainError] = useState("");
  const [managedEmailDomainSaving, setManagedEmailDomainSaving] = useState(false);
  const [managedEmailDomainVerifying, setManagedEmailDomainVerifying] = useState("");
  const [selectedDomainHost, setSelectedDomainHost] = useState("");
  const [linkComplianceAccepted, setLinkComplianceAccepted] = useState(false);
  const isMobile = useResponsiveLayout();
  const [showDocsPanel, setShowDocsPanel] = useState(false);
  const [activeDashboardSection, setActiveDashboardSection] = useState("builder-panel");
  const isAuthenticated = Boolean(session);

  const clearSession = useCallback(() => {
    setSession(null);
    setLinks([]);
    setSelectedShortCode("");
    setAnalytics(null);
    setBillingSummary(null);
    setBillingMessage("");
    setBillingError("");
    setBillingLoading(false);
    setCheckoutLoadingPlanId("");
    setCustomDomainInput("");
    setDomainMessage("");
    setDomainError("");
    setDomainSaving(false);
    setDomainVerifying("");
    setManagedEmailDomainInput("");
    setManagedEmailDomainMessage("");
    setManagedEmailDomainError("");
    setManagedEmailDomainSaving(false);
    setManagedEmailDomainVerifying("");
    setSelectedDomainHost("");
    setLinkComplianceAccepted(false);
    setLinkError("");
    setAnalyticsError("");
    setSocialCaption("");
    setSocialMessage("");
    setSocialError("");
  }, []);

  const authorizedFetch = useCallback(
    async (path, options = {}) => {
      const response = await apiFetch(path, {
        csrfToken: session?.csrfToken || "",
        ...options,
      });

      if (response.status === 401) {
        clearSession();
        throw new Error("Your session has expired. Please sign in again.");
      }

      return response;
    },
    [clearSession, session?.csrfToken]
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
    if (data.checkout) {
      setCheckoutAvailability(data.checkout);
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
    if (!session) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const page = document.querySelector(".sl-page");
    if (page) page.scrollTop = 0;
  }, [session]);

  useEffect(() => {
    if (session) return undefined;

    const syncAuthRoute = () => {
      const path = window.location.pathname.replace(/\/$/, "") || "/";
      if (path === "/login" || path === "/register") {
        setAuthMode(path === "/login" ? "login" : "register");
        setAuthViewOpen(true);
        return;
      }

      setAuthViewOpen(false);
    };

    window.addEventListener("popstate", syncAuthRoute);
    return () => window.removeEventListener("popstate", syncAuthRoute);
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    const loadPublicPlans = async () => {
      try {
        const response = await apiFetch("/api/v1/billing/plans");
        if (!response.ok) return;

        const data = await response.json();
        if (!cancelled) {
          setPublicPlans(data.plans?.length ? data.plans : DEFAULT_PUBLIC_PLANS);
          setCheckoutAvailability(data.checkout || DEFAULT_CHECKOUT_AVAILABILITY);
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
    let cancelled = false;

    const loadSession = async () => {
      setAuthLoading(true);

      try {
        const legacyToken = localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
        localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);

        if (legacyToken) {
          try {
            await apiFetch("/api/v1/auth/logout", {
              method: "POST",
              headers: { Authorization: `Bearer ${legacyToken}` },
            });
          } catch {
            // The token is already removed locally. A failed best-effort revoke
            // must not prevent the browser from restoring a cookie session.
          }
        }

        const response = await apiFetch("/api/v1/auth/me");

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const data = await response.json();
        if (!cancelled) {
          setSession(toBrowserSession(data));
          setAuthError("");
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
  }, [clearSession]);

  useEffect(() => {
    if (!isAuthenticated) {
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

        if (!response.ok) {
          throw new Error(data.error || "Could not load links");
        }

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
          setLinkError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setLinkError(requestError.message || "Could not load links");
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
  }, [authorizedFetch, isAuthenticated]);

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
    if (!selectedShortCode || !isAuthenticated) {
      setAnalytics(null);
      setAnalyticsError("");
      return undefined;
    }

    let cancelled = false;

    const loadAnalytics = async () => {
      try {
        const response = await authorizedFetch(`/api/v1/links/${selectedShortCode}/analytics`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load analytics");
        }

        if (!cancelled) {
          setAnalytics(data);
          setAnalyticsError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setAnalyticsError(requestError.message || "Could not load analytics");
        }
      }
    };

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [authorizedFetch, isAuthenticated, selectedShortCode]);

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

  const refreshBillingSummary = async (message = "", { syncProvider = false } = {}) => {
    setBillingLoading(true);
    setBillingError("");

    try {
      let resolvedMessage = message;
      const billingStatus =
        billingSummary?.currentPlan?.billingStatus ||
        session?.workspace?.billing?.billingStatus ||
        "";

      if (syncProvider && billingStatus === "pending") {
        const syncResponse = await authorizedFetch(
          "/api/v1/billing/subscriptions/sync",
          {
            method: "POST",
            body: JSON.stringify({}),
          }
        );
        const syncData = await syncResponse.json();

        if (!syncResponse.ok) {
          throw new Error(syncData.error || "Could not verify the payment with Razorpay");
        }

        resolvedMessage = syncData.message || message;
      }

      const data = await fetchBillingSummary();
      applyBillingSummary(data);

      if (resolvedMessage) {
        setBillingMessage(resolvedMessage);
      }

      return data;
    } catch (requestError) {
      setBillingError(requestError.message || "Could not load billing");
      return null;
    } finally {
      setBillingLoading(false);
    }
  };

  const startPlanCheckout = async (plan) => {
    if (!plan) return;

    setBillingError("");

    if (plan.id === "enterprise") {
      const supportEmail = billingSummary?.supportEmail || "support@shotlink.in";
      window.location.href = `mailto:${supportEmail}?subject=Shotlink Institution onboarding`;
      return;
    }

    if (!checkoutAvailability.enabled) {
      setBillingError(checkoutAvailability.message);
      return;
    }

    if (!plan.priceInPaise) {
      setBillingMessage("You are already on the free plan. Choose Pro or Business to upgrade.");
      return;
    }

    setCheckoutLoadingPlanId(plan.id);
    setBillingMessage("");
    setBillingError("");

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
      setBillingError(requestError.message || "Could not start checkout");
    } finally {
      setCheckoutLoadingPlanId("");
    }
  };

  const cancelCurrentSubscription = async () => {
    setBillingLoading(true);
    setBillingMessage("");
    setBillingError("");

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
      setBillingError(requestError.message || "Could not cancel subscription");
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
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
          setBillingError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setBillingError(requestError.message || "Could not load billing");
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
  }, [applyBillingSummary, fetchBillingSummary, isAuthenticated]);

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

  const openAuthView = (mode) => {
    setPublicPage("home");
    setAuthMode(mode);
    setAuthViewOpen(true);
    window.history.pushState({}, "", mode === "login" ? "/login" : "/register");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const openRegistrationPanel = (requestedWorkspaceType = "creator") => {
    const workspaceType = requestedWorkspaceType === "institution" ? "institution" : "creator";
    setAuthForm((current) => ({ ...current, workspaceType }));
    openAuthView("register");
  };
  const openLoginPanel = () => openAuthView("login");

  const closeAuthView = () => {
    setAuthViewOpen(false);
    setPublicPage("home");
    window.history.pushState({}, "", "/");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const renderPublicPricing = ({ compact = false } = {}) => (
    <div
      style={{
        ...styles.planGrid,
        gridTemplateColumns: isMobile || compact ? "1fr" : "repeat(4, minmax(0, 1fr))",
      }}
    >
      {publicPlans.map((plan) => {
        const isInstitutionPlan = plan.id === "enterprise";
        const displayName = isInstitutionPlan ? "Institution" : plan.name;
        return (
          <div
            key={plan.id}
            className="sl-lift"
            style={plan.id === "pro" ? { ...styles.planCard, ...styles.planCardFeatured } : styles.planCard}
          >
            <div style={styles.planHeader}>
              <strong style={styles.planName}>{displayName}</strong>
              <StatusPill
                label={isInstitutionPlan
                  ? "Official control"
                  : plan.id !== "free" && !checkoutAvailability.enabled
                    ? "Coming soon"
                    : `${plan.linkLimit} links`}
                tone={getPlanTone(plan.id)}
              />
            </div>
            <p style={styles.planPrice}>{formatPlanPrice(plan)}</p>
            <div style={styles.planFeatureList}>
              {plan.features.slice(0, compact ? 3 : plan.features.length).map((feature) => (
                <p key={feature} style={styles.planFeatureItem}>{feature}</p>
              ))}
            </div>
            {!compact ? (
              <button
                style={styles.primaryButton}
                onClick={() => openRegistrationPanel(isInstitutionPlan ? "institution" : "creator")}
              >
                {isInstitutionPlan
                  ? "Create institution workspace"
                  : plan.id !== "free" && !checkoutAvailability.enabled
                    ? "Create a free workspace"
                    : `Start with ${displayName}`}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const renderPublicContent = () => {
    if (publicPage === "pricing") {
      return (
        <section className="sl-reveal" style={styles.publicPageCard}>
          <p style={styles.sectionEyebrow}>Pricing</p>
          <h1 style={styles.publicTitle}>Plans for creators and institutions.</h1>
          <p style={styles.publicLead}>
            Creators can start free, choose Creator Pro, or use Studio for managed talent.
            Universities and organisations can start an Institution workspace with a separate
            official-publishing interface, then activate domain governance through onboarding.
          </p>
          {!checkoutAvailability.enabled ? (
            <div role="status" style={styles.checkoutNotice}>
              <strong>Free launch is open.</strong>
              <span>{checkoutAvailability.message}</span>
            </div>
          ) : null}
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
          <div
            aria-label="Example API request"
            role="region"
            style={styles.codePanel}
            tabIndex={0}
          >
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

    if (LEGAL_PAGE_CONTENT[publicPage]) {
      const policy = LEGAL_PAGE_CONTENT[publicPage];
      return (
        <section className="sl-reveal" style={styles.publicPageCard}>
          <p style={styles.sectionEyebrow}>{policy.eyebrow}</p>
          <h1 style={styles.publicTitle}>{policy.title}</h1>
          <p style={styles.publicLead}>{policy.lead}</p>
          <div style={styles.policyMeta}>
            <strong>Effective {POLICY_EFFECTIVE_DATE}</strong>
            <span>{OPERATOR_NOTICE}</span>
          </div>
          {policy.contactRows?.length ? (
            <dl style={styles.contactGrid}>
              {policy.contactRows.map((row) => (
                <div key={row.label} style={styles.contactRow}>
                  <dt style={styles.contactLabel}>{row.label}</dt>
                  <dd style={styles.contactValue}>
                    {row.href ? <a href={row.href}>{row.value}</a> : row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div style={styles.policySections}>
            {policy.sections.map((section) => (
              <article key={section.title} style={styles.policySection}>
                <h2 style={styles.policyTitle}>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} style={styles.policyText}>{paragraph}</p>
                ))}
                {section.bullets?.length ? (
                  <ul style={styles.policyList}>
                    {section.bullets.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
                {section.links?.length ? (
                  <div style={styles.policyLinks}>
                    {section.links.map((link) => (
                      <a key={link.href} href={link.href}>{link.label}</a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <p style={styles.legalFinePrint}>
            Policy version {ACCOUNT_POLICY_VERSION}. Questions may be sent to support@shotlink.in.
          </p>
        </section>
      );
    }

    return <PublicLanding onStart={openRegistrationPanel} />;
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
    setAuthError("");

    try {
      const { consents, ...registerFields } = authForm;
      const payload =
        authMode === "register"
          ? { ...registerFields, consents }
          : { email: authForm.email, password: authForm.password };

      const response = await apiFetch(`/api/v1/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setSession(toBrowserSession(data));
      setAuthViewOpen(false);
      window.history.replaceState({}, "", "/");
      setAuthForm({
        name: "",
        email: authForm.email,
        password: "",
        workspaceName: "",
        workspaceType: "creator",
        consents: createDefaultConsents(),
      });
    } catch (requestError) {
      setAuthError(requestError.message || "Authentication failed");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const logout = async () => {
    try {
      if (session) {
        await authorizedFetch("/api/v1/auth/logout", { method: "POST" });
      }
    } catch {
      // The local session cleanup below is enough for the UI.
    } finally {
      clearSession();
      setAuthViewOpen(false);
      setAuthMode("login");
      setPublicPage("home");
      window.history.replaceState({}, "", "/");
    }
  };

  const addCustomDomain = async () => {
    if (!customDomainInput.trim()) {
      setDomainError("Enter a domain before adding it.");
      return;
    }

    setDomainSaving(true);
    setDomainError("");
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
      setDomainError(requestError.message || "Could not add domain");
    } finally {
      setDomainSaving(false);
    }
  };

  const verifyCustomDomain = async (hostname) => {
    setDomainVerifying(hostname);
    setDomainError("");
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
      setDomainError(requestError.message || "Could not verify domain");
    } finally {
      setDomainVerifying("");
    }
  };

  const setPrimaryCustomDomain = async (hostname) => {
    setDomainVerifying(hostname);
    setDomainError("");
    setDomainMessage("");

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
      setDomainError(requestError.message || "Could not set primary domain");
    } finally {
      setDomainVerifying("");
    }
  };

  const removeCustomDomain = async (hostname) => {
    setDomainVerifying(hostname);
    setDomainError("");
    setDomainMessage("");

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
      setDomainError(requestError.message || "Could not remove domain");
    } finally {
      setDomainVerifying("");
    }
  };

  const refreshAnalytics = async (shortCodeToLoad = selectedShortCode) => {
    if (!shortCodeToLoad) return;

    const response = await authorizedFetch(`/api/v1/links/${shortCodeToLoad}/analytics`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not refresh analytics");
    }

    setAnalytics(data);
    setAnalyticsError("");
  };

  const addManagedEmailDomain = async () => {
    if (!managedEmailDomainInput.trim()) {
      setManagedEmailDomainError("Enter an institution email domain before adding it.");
      return;
    }

    setManagedEmailDomainSaving(true);
    setManagedEmailDomainError("");
    setManagedEmailDomainMessage("");

    try {
      const response = await authorizedFetch("/api/v1/workspace/email-domains", {
        method: "POST",
        body: JSON.stringify({ hostname: managedEmailDomainInput }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not add institution email domain");
      }

      applyWorkspaceSettings(data);
      setManagedEmailDomainInput("");
      setManagedEmailDomainMessage(
        "Domain added. Publish the ownership TXT record, then verify it."
      );
    } catch (requestError) {
      setManagedEmailDomainError(
        requestError.message || "Could not add institution email domain"
      );
    } finally {
      setManagedEmailDomainSaving(false);
    }
  };

  const verifyManagedEmailDomain = async (hostname) => {
    setManagedEmailDomainVerifying(hostname);
    setManagedEmailDomainError("");
    setManagedEmailDomainMessage("");

    try {
      const response = await authorizedFetch(
        `/api/v1/workspace/email-domains/${encodeURIComponent(hostname)}/verify`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok) {
        if (data.workspace) {
          applyWorkspaceSettings({ workspace: data.workspace });
        }
        throw new Error(data.error || "Could not verify institution email domain");
      }

      applyWorkspaceSettings(data);
      setManagedEmailDomainMessage(
        `${hostname} is verified. New self-service workspaces on this domain are now blocked.`
      );
    } catch (requestError) {
      setManagedEmailDomainError(
        requestError.message || "Could not verify institution email domain"
      );
    } finally {
      setManagedEmailDomainVerifying("");
    }
  };

  const removeManagedEmailDomain = async (hostname) => {
    setManagedEmailDomainVerifying(hostname);
    setManagedEmailDomainError("");
    setManagedEmailDomainMessage("");

    try {
      const response = await authorizedFetch(
        `/api/v1/workspace/email-domains/${encodeURIComponent(hostname)}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not remove institution email domain");
      }

      applyWorkspaceSettings(data);
      setManagedEmailDomainMessage(`${hostname} is no longer governed by this workspace.`);
    } catch (requestError) {
      setManagedEmailDomainError(
        requestError.message || "Could not remove institution email domain"
      );
    } finally {
      setManagedEmailDomainVerifying("");
    }
  };

  const createLink = async () => {
    if (!url.trim()) {
      setLinkError("Please enter a valid destination URL.");
      return;
    }

    if (!linkComplianceAccepted) {
      setLinkError("Please confirm the destination authority and anti-abuse consent before creating this link.");
      return;
    }

    setLoading(true);
    setLinkError("");
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
      setCustomAliasManuallyEdited(false);
      setInstitutionUnit("");
      setInstitutionGroup("");
      setCreatorContentTitle("");
      setFallbackInput("");
      setExpiry(30);
      setLinkComplianceAccepted(false);
      try {
        await refreshAnalytics(data.link.shortCode);
      } catch (requestError) {
        setAnalyticsError(requestError.message || "Could not load analytics for the new link");
      }
      await refreshBillingSummary();
    } catch (requestError) {
      setLinkError(requestError.message || "Could not create link");
    } finally {
      setLoading(false);
    }
  };

  const expireCurrentLink = async () => {
    if (!selectedShortCode) return;

    const shortCodeToExpire = selectedShortCode;
    setLinkError("");

    try {
      const response = await authorizedFetch(`/api/v1/links/${selectedShortCode}/expire`, {
        method: "PATCH",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not expire this link");
      }

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
    } catch (requestError) {
      setLinkError(requestError.message || "Could not expire this link");
    }
  };

  const refreshHealth = async () => {
    if (!selectedShortCode) return;

    setRefreshingHealth(true);
    setLinkError("");

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
      try {
        await refreshAnalytics(selectedShortCode);
      } catch (requestError) {
        setAnalyticsError(requestError.message || "Could not refresh analytics");
      }
    } catch (requestError) {
      setLinkError(requestError.message || "Health refresh failed");
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

  const prepareSocialPost = async () => {
    if (!selectedShareLink?.shortUrl) {
      setSocialError("Create or select an active Shotlink before preparing a social post.");
      setSocialMessage("");
      return;
    }

    const platform = SOCIAL_PUBLISH_PLATFORMS.find((item) => item.id === socialPlatform);
    const postPackage = [socialCaption.trim(), selectedShareLink.shortUrl]
      .filter(Boolean)
      .join("\n\n");
    const shareUrl = getSocialShareUrl(socialPlatform, selectedShareLink.shortUrl, socialCaption);
    const openedWindow = shareUrl
      ? window.open(shareUrl, "_blank", "noopener,noreferrer")
      : null;
    if (openedWindow) openedWindow.opener = null;

    try {
      await navigator.clipboard.writeText(postPackage);
      setSocialError("");
      setSocialMessage(
        `${platform?.name || "Platform"} post package copied. Complete the final review in the opened platform tab; allow pop-ups if no tab appeared.`
      );
    } catch {
      setSocialMessage("");
      setSocialError("Could not copy the post package. Check browser clipboard permission and try again.");
    }
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
  const workspaceType = session?.workspace?.workspaceType || "creator";
  const isInstitutionWorkspace = workspaceType === "institution";
  const dashboardNavItems = isInstitutionWorkspace
    ? INSTITUTION_DASHBOARD_NAV_ITEMS
    : CREATOR_DASHBOARD_NAV_ITEMS;
  const detectedDestination = classifyDestinationInput(url);
  const smartAliasSuggestion = buildSmartAlias({
    workspaceType,
    url,
    institutionResourceKind,
    institutionUnit,
    institutionGroup,
    creatorContentKind,
    creatorContentTitle,
    resourceDate,
  });
  useEffect(() => {
    if (!customAliasManuallyEdited) setCustomAlias(smartAliasSuggestion);
  }, [customAliasManuallyEdited, smartAliasSuggestion]);
  const customDomains = session?.workspace?.customDomains || [];
  const managedEmailDomains = session?.workspace?.managedEmailDomains || [];
  const verifiedDomains = customDomains.filter((domain) => domain.status === "verified");
  const domainLimit = currentPlan.domainLimit ?? 0;
  const cnameTarget = session?.workspace?.domainSetup?.cnameTarget || "go.shotlink.in";
  const institutionGovernanceEnabled =
    isInstitutionWorkspace && currentPlan.effectivePlanId === "enterprise";
  const activeLinks = links.filter(isUsableLink);
  const selectedShareLink =
    activeLinks.find((link) => link.shortCode === selectedShortCode) || activeLinks[0] || null;
  const selectedSocialPlatform =
    SOCIAL_PUBLISH_PLATFORMS.find((platform) => platform.id === socialPlatform) ||
    SOCIAL_PUBLISH_PLATFORMS[0];
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
  if (authLoading) {
    return (
      <div className="sl-page sl-dashboard-page" style={styles.page}>
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
    if (authViewOpen) {
      return (
        <div className="sl-page sl-auth-page" style={{ ...styles.page, ...styles.publicPageRoot }}>
          <header className="sl-auth-header" style={styles.authPageHeader}>
            <a
              href="/"
              style={styles.brandLink}
              aria-label="Back to Shotlink home"
              onClick={(event) => {
                event.preventDefault();
                closeAuthView();
              }}
            >
              <BrandLogo style={styles.navLogo} />
            </a>
            <div style={styles.authHeaderSwitch}>
              <span>{authMode === "register" ? "Already have an account?" : "New to Shotlink?"}</span>
              <button
                type="button"
                style={styles.authHeaderButton}
                onClick={authMode === "register" ? openLoginPanel : openRegistrationPanel}
              >
                {authMode === "register" ? "Sign in" : "Create account"}
              </button>
            </div>
          </header>

          <main className="sl-auth-layout" style={styles.authPageMain}>
            <section id="auth-panel" style={styles.authFormPane}>
              <form
                style={styles.authBody}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!authSubmitDisabled) submitAuth();
                }}
              >
                <div>
                  <p style={styles.sectionEyebrow}>
                    {authMode === "register" ? "Start for free" : "Welcome back"}
                  </p>
                  <h1 style={styles.authTitle}>
                    {authMode === "register" ? "Create your Shotlink workspace" : "Sign in"}
                  </h1>
                  <p style={styles.authSubtitle}>
                    {authMode === "register"
                      ? authForm.workspaceType === "institution"
                        ? "Create an official workspace for university, institute, or organisation links."
                        : "Start with free campaign links, QR codes, and creator analytics."
                      : "Continue to your links, analytics, domains, and billing."}
                  </p>
                </div>

                {authMode === "register" ? (
                  <label style={styles.label}>
                    Full name
                    <input
                      style={styles.input}
                      value={authForm.name}
                      autoComplete="name"
                      required
                      onChange={(event) =>
                        setAuthForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </label>
                ) : null}

                <label style={styles.label}>
                  Email
                  <input
                    style={styles.input}
                    type="email"
                    value={authForm.email}
                    autoComplete="email"
                    required
                    onChange={(event) =>
                      setAuthForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                  {authMode === "register" ? (
                    <span style={styles.miniHelperText}>Use an email address you can access and verify.</span>
                  ) : null}
                </label>

                <label style={styles.label}>
                  Password
                  <input
                    style={styles.input}
                    type="password"
                    value={authForm.password}
                    autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    minLength={8}
                    required
                    onChange={(event) =>
                      setAuthForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </label>

                {authMode === "register" ? (
                  <>
                    <fieldset style={styles.workspaceTypeFieldset}>
                      <legend style={styles.labelText}>Choose your workspace</legend>
                      <div className="sl-workspace-type-grid" style={styles.workspaceTypeGrid}>
                        {WORKSPACE_TYPE_OPTIONS.map((option) => {
                          const isSelected = authForm.workspaceType === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={isSelected}
                              style={isSelected ? styles.workspaceTypeButtonSelected : styles.workspaceTypeButton}
                              onClick={() =>
                                setAuthForm((current) => ({ ...current, workspaceType: option.id }))
                              }
                            >
                              <strong>{option.label}</strong>
                              <span>{option.description}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <label style={styles.label}>
                      {authForm.workspaceType === "institution" ? "Institution name" : "Workspace name"}
                      <input
                        style={styles.input}
                        value={authForm.workspaceName}
                        autoComplete="organization"
                        required
                        onChange={(event) =>
                          setAuthForm((current) => ({
                            ...current,
                            workspaceName: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                ) : null}

                {authMode === "register" ? (
                  <div className="sl-consent-box" style={styles.consentBox}>
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
                ) : (
                  <p style={styles.authSecurityNote}>
                    Secure cookie session · CSRF protected · Automatic session expiry
                  </p>
                )}

                <FeedbackMessage message={authError} />

                <button
                  type="submit"
                  style={
                    authSubmitDisabled
                      ? { ...styles.authSubmitButton, opacity: 0.6, cursor: "not-allowed" }
                      : styles.authSubmitButton
                  }
                  disabled={authSubmitDisabled}
                >
                  {authSubmitting
                    ? "Working..."
                    : authMode === "register"
                      ? "Create workspace"
                      : "Sign in"}
                </button>

                <p style={styles.authInlineSwitch}>
                  {authMode === "register" ? "Already use Shotlink?" : "Need a workspace?"}{" "}
                  <button
                    type="button"
                    style={styles.inlineTextButton}
                    onClick={authMode === "register" ? openLoginPanel : openRegistrationPanel}
                  >
                    {authMode === "register" ? "Sign in" : "Create one for free"}
                  </button>
                </p>
              </form>
            </section>

            <aside className="sl-auth-visual" style={styles.authVisualPane}>
              <div style={styles.authVisualCopy}>
                <p style={styles.freePlanBadge}>
                  {authForm.workspaceType === "institution" ? "Official publishing controls" : "Creator intelligence built in"}
                </p>
                <h2 style={styles.authVisualTitle}>
                  {authForm.workspaceType === "institution"
                    ? "Publish Sheets, forms, videos, and official resources with control."
                    : "Create, protect, and measure every campaign route."}
                </h2>
                <p style={styles.authVisualText}>
                  {authForm.workspaceType === "institution"
                    ? "Resource detection, official domains, audit history, expiry, and fallback routes live in one institutional workspace."
                    : "Branded links, QR codes, click analytics, and fallback destinations live in one clean workspace."}
                </p>
              </div>
              <ShortenerPreview onStart={openRegistrationPanel} />
              <div style={styles.authVisualStats}>
                <div><strong>9+</strong><span>analytics signals</span></div>
                <div><strong>3</strong><span>routing layers</span></div>
                <div><strong>24/7</strong><span>health checks</span></div>
              </div>
            </aside>
          </main>

          <footer style={styles.authFooter}>
            <span>© 2026 Shotlink. All rights reserved.</span>
            <nav aria-label="Legal links" style={styles.authFooterLinks}>
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/refund-policy">Refunds</a>
              <a href="/contact">Contact</a>
            </nav>
          </footer>
        </div>
      );
    }

    return (
      <div className="sl-page sl-public-page" style={{ ...styles.page, ...styles.publicPageRoot }}>
        <div className="mk-public-shell">
          <PublicHeader onLogin={openLoginPanel} onStart={openRegistrationPanel} />

          <main style={styles.publicMain}>
            {renderPublicContent()}
          </main>

          <PublicFooter onStart={openRegistrationPanel} />
        </div>
      </div>
    );
  }

  const workspaceInitials = session.workspace.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const userFirstName = session.user.name.split(/\s+/).filter(Boolean)[0] || session.user.name;

  return (
    <div
      className="sl-page sl-dashboard-page"
      data-workspace-type={workspaceType}
      style={{ ...styles.page, ...enterpriseDashboardStyles.page }}
    >
      <div className="sl-grid-overlay" style={{ ...styles.backgroundGrid, ...enterpriseDashboardStyles.backgroundGrid }} />
      <div className="sl-glow sl-glow-top" style={{ ...styles.backgroundGlowTop, ...enterpriseDashboardStyles.backgroundGlowTop }} />
      <div className="sl-glow sl-glow-bottom" style={{ ...styles.backgroundGlowBottom, ...enterpriseDashboardStyles.backgroundGlowBottom }} />

      <div className="sl-dashboard-shell" style={styles.dashboardShell}>
        <header
          className="sl-dashboard-header"
          style={{ ...styles.headerBar, ...enterpriseDashboardStyles.headerBar }}
        >
          <div className="sl-dashboard-brand" style={styles.dashboardBrandBlock}>
            <BrandLogo style={styles.dashboardLogo} />
            <span style={styles.headerDivider} aria-hidden="true" />
            <div className="sl-header-workspace" style={styles.workspaceHeadingBlock}>
              <span>Current workspace</span>
              <strong>{session.workspace.name}</strong>
            </div>
          </div>
          <div className="sl-header-actions" style={styles.headerActions}>
            <StatusPill label={`${activeLinkCount}/${activeLinkLimit} active links`} tone="accent" />
            <StatusPill
              label={isInstitutionWorkspace ? "Institution workspace" : "Creator workspace"}
              tone={isInstitutionWorkspace ? "neutral" : "healthy"}
            />
            <StatusPill label={formatLabel(currentPlan.billingStatus)} tone={getBillingTone(currentPlan.billingStatus)} />
            <button
              className="sl-header-new-link"
              style={styles.primaryButton}
              onClick={() => {
                setActiveDashboardSection("builder-panel");
                scrollToDashboardSection("builder-panel");
              }}
            >
              Create link
            </button>
            <button style={styles.secondaryButton} onClick={logout}>Sign out</button>
          </div>
        </header>

        <section className="sl-command-strip" style={styles.commandStrip}>
          <div style={styles.commandStripHeading}>
            <div>
              <p style={styles.sectionEyebrow}>Welcome back, {userFirstName}</p>
              <h1 style={styles.overviewTitle}>{session.workspace.name}</h1>
              <p className="sl-overview-copy">
                {isInstitutionWorkspace
                  ? "An official workspace for Sheets, forms, videos, notices, and public resources. Publish with expiry, domain control, usage evidence, and an auditable route history."
                  : "One clean workspace for every post, collaboration, portfolio, release, and live event. Publish faster, learn what travels, and keep every campaign route organised."}
              </p>
            </div>
            <span className="sl-live-indicator" style={styles.overviewTimestamp}>
              <span aria-hidden="true" /> Live workspace data
            </span>
          </div>
          <article className="sl-lift sl-command-card" data-accent="blue" style={{ ...styles.commandCard, ...enterpriseDashboardStyles.commandCard }}>
            <div style={styles.commandCardTop}><span style={styles.commandIndex}>01</span><p style={styles.metricLabel}>{isInstitutionWorkspace ? "Official links" : "Active links"}</p></div>
            <strong style={styles.commandValue}>{activeLinkCount}</strong>
            <span style={styles.metricHint}>{remainingLinkSlots} slots available</span>
          </article>
          <article className="sl-lift sl-command-card" data-accent="green" style={{ ...styles.commandCard, ...enterpriseDashboardStyles.commandCard }}>
            <div style={styles.commandCardTop}><span style={styles.commandIndex}>02</span><p style={styles.metricLabel}>Tracked clicks</p></div>
            <strong style={styles.commandValue}>{analytics?.clicks ?? 0}</strong>
            <span style={styles.metricHint}>selected link telemetry</span>
          </article>
          <article className="sl-lift sl-command-card" data-accent="amber" style={{ ...styles.commandCard, ...enterpriseDashboardStyles.commandCard }}>
            <div style={styles.commandCardTop}><span style={styles.commandIndex}>03</span><p style={styles.metricLabel}>{isInstitutionWorkspace ? "Controlled domains" : "Branded domains"}</p></div>
            <strong style={styles.commandValue}>{isInstitutionWorkspace ? customDomains.length + managedEmailDomains.length : customDomains.length}</strong>
            <span style={styles.metricHint}>{isInstitutionWorkspace ? `${managedEmailDomains.length} identity · ${customDomains.length} link` : `${verifiedDomains.length} verified · ${domainLimit} allowed`}</span>
          </article>
          <article className="sl-lift sl-command-card" data-accent="violet" style={{ ...styles.commandCard, ...enterpriseDashboardStyles.commandCard }}>
            <div style={styles.commandCardTop}><span style={styles.commandIndex}>04</span><p style={styles.metricLabel}>Current plan</p></div>
            <strong style={styles.commandValue}>{currentPlan.effectivePlanName}</strong>
            <span style={styles.metricHint}>{formatLabel(currentPlan.billingStatus)}</span>
          </article>
        </section>

        <nav
          className="sl-dashboard-nav"
          style={{ ...styles.dashboardNavCard, ...enterpriseDashboardStyles.panelCard }}
          aria-label="Workspace navigation"
        >
          <div className="sl-dashboard-nav-intro" style={styles.dashboardNavIntro}>
            <span style={styles.workspaceAvatar}>{workspaceInitials || "SL"}</span>
            <div style={styles.navWorkspaceCopy}>
              <strong style={styles.navWorkspaceName}>{session.workspace.name}</strong>
              <span style={styles.navWorkspaceSlug}>/{session.workspace.slug}</span>
            </div>
          </div>
          <div className="sl-dashboard-nav-items" style={styles.dashboardNavItems}>
            {dashboardNavItems.map((item) => (
              <button
                key={item.id}
                style={styles.dashboardNavItem}
                data-active={activeDashboardSection === item.id ? "true" : "false"}
                aria-current={activeDashboardSection === item.id ? "page" : undefined}
                onClick={() => {
                  setActiveDashboardSection(item.id);
                  if (item.id === "docs-panel") {
                    setShowDocsPanel(true);
                    window.setTimeout(() => scrollToDashboardSection(item.id), 50);
                    return;
                  }
                  scrollToDashboardSection(item.id);
                }}
              >
                <span style={styles.dashboardNavIndex}>{item.index}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="sl-dashboard-nav-plan" style={styles.dashboardNavPlan}>
            <p style={styles.navPlanLabel}>{currentPlan.effectivePlanName} plan</p>
            <strong style={styles.navPlanValue}>{remainingLinkSlots}</strong>
            <span style={styles.navPlanHint}>link slots remaining</span>
            <button
              style={styles.navPlanButton}
              onClick={() => {
                setActiveDashboardSection("billing-panel");
                scrollToDashboardSection("billing-panel");
              }}
            >
              Manage plan
            </button>
          </div>
        </nav>

        <main
          className="sl-dashboard-main"
          style={{
            ...styles.dashboardGrid,
            gridTemplateAreas: isInstitutionWorkspace
              ? '"builder links" "analytics analytics" "domains domains" "billing billing" "docs docs"'
              : styles.dashboardGrid.gridTemplateAreas,
          }}
        >
          <section id="builder-panel" style={{ ...styles.builderCard, ...enterpriseDashboardStyles.builderCard, gridArea: "builder" }}>
            <div style={styles.panelTitleRow}>
              <div>
                <p style={styles.sectionEyebrow}>{isInstitutionWorkspace ? "Official publishing" : "Create"}</p>
                <h2 style={styles.panelTitle}>{isInstitutionWorkspace ? "Publish an official resource" : "Publish a short link"}</h2>
                <p style={styles.panelLead}>{isInstitutionWorkspace ? "Classify the resource, set its official path and expiry, then add a continuity route when needed." : "Set the destination, branded path, expiry, and failover behavior."}</p>
              </div>
              <StatusPill label={currentPlan.effectivePlanName} tone={getPlanTone(currentPlan.effectivePlanId)} />
            </div>
            <p style={styles.helperText}>
              {remainingLinkSlots > 0
                ? `${remainingLinkSlots} active link slots remaining on the ${currentPlan.effectivePlanName} plan.`
                : `You have used all ${activeLinkLimit} active-link slots on the ${currentPlan.effectivePlanName} plan. Upgrade billing to create more links.`}
            </p>
            <form
              style={styles.linkBuilderForm}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                createLink();
              }}
              onKeyDown={(event) => {
                const isSingleLineInput =
                  event.target.tagName === "INPUT" && event.target.type !== "checkbox";

                if (event.key !== "Enter" || !isSingleLineInput) return;

                event.preventDefault();
                if (!linkSubmitDisabled) event.currentTarget.requestSubmit();
              }}
            >
              <div className="sl-builder-form-grid" style={styles.builderFormGrid}>
                <label style={styles.label}>
                  Short link domain
                  <select style={styles.select} value={selectedDomainHost} onChange={(event) => setSelectedDomainHost(event.target.value)}>
                    <option value="">Default redirect domain</option>
                    {verifiedDomains.map((domain) => (
                      <option key={domain.hostname} value={domain.hostname}>{domain.hostname}</option>
                    ))}
                  </select>
                </label>
                <label style={styles.label}>
                  Link expiry
                  <select style={styles.select} value={expiry} onChange={(event) => setExpiry(Number(event.target.value))}>
                    {EXPIRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="sl-smart-path-card">
                <div className="sl-smart-path-heading">
                  <div>
                    <p>{isInstitutionWorkspace ? "Official link template" : "Creator link template"}</p>
                    <strong>{isInstitutionWorkspace ? "Generate a structured campus path" : "Generate a share-ready content path"}</strong>
                  </div>
                  <span>Auto path</span>
                </div>
                {isInstitutionWorkspace ? (
                  <div className="sl-smart-path-fields">
                    <label style={styles.label}>
                      Resource type
                      <select
                        style={styles.select}
                        value={institutionResourceKind}
                        onChange={(event) => setInstitutionResourceKind(event.target.value)}
                      >
                        {INSTITUTION_RESOURCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label style={styles.label}>
                      Department / course
                      <input
                        style={styles.input}
                        value={institutionUnit}
                        maxLength={18}
                        placeholder="CSE"
                        onChange={(event) => setInstitutionUnit(event.target.value)}
                      />
                    </label>
                    <label style={styles.label}>
                      Class / section
                      <input
                        style={styles.input}
                        value={institutionGroup}
                        maxLength={12}
                        placeholder="42"
                        onChange={(event) => setInstitutionGroup(event.target.value)}
                      />
                    </label>
                    <label style={styles.label}>
                      Resource date
                      <input
                        style={styles.input}
                        type="date"
                        value={resourceDate}
                        onChange={(event) => setResourceDate(event.target.value)}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="sl-smart-path-fields sl-smart-path-fields-creator">
                    <label style={styles.label}>
                      Content type
                      <select
                        style={styles.select}
                        value={creatorContentKind}
                        onChange={(event) => setCreatorContentKind(event.target.value)}
                      >
                        {CREATOR_CONTENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label style={styles.label}>
                      Content / campaign name
                      <input
                        style={styles.input}
                        value={creatorContentTitle}
                        maxLength={32}
                        placeholder="campus-vlog"
                        onChange={(event) => setCreatorContentTitle(event.target.value)}
                      />
                    </label>
                    <label style={styles.label}>
                      Publish date
                      <input
                        style={styles.input}
                        type="date"
                        value={resourceDate}
                        onChange={(event) => setResourceDate(event.target.value)}
                      />
                    </label>
                  </div>
                )}
                <div className="sl-smart-path-preview" aria-live="polite">
                  <span>Suggested short link</span>
                  <strong>
                    {selectedDomainHost || "shotlink.in"}/{smartAliasSuggestion || (isInstitutionWorkspace ? "cse-42-attendance-2026-08-10" : "youtube-video-2026-08-10")}
                  </strong>
                  {smartAliasSuggestion && customAliasManuallyEdited && customAlias !== smartAliasSuggestion ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAliasManuallyEdited(false);
                        setCustomAlias(smartAliasSuggestion);
                      }}
                    >
                      Use suggested path
                    </button>
                  ) : null}
                </div>
              </div>
              <div style={styles.label}>
                <label htmlFor="primary-destination">
                  {isInstitutionWorkspace ? "Official resource URL" : "Campaign destination"}
                </label>
                <input
                  id="primary-destination"
                  style={styles.input}
                  type="url"
                  autoComplete="url"
                  aria-describedby="primary-destination-help"
                  placeholder={isInstitutionWorkspace ? "https://docs.google.com/spreadsheets/..." : "https://youtube.com/watch?v=..."}
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <span id="primary-destination-help" style={styles.miniHelperText}>
                  {isInstitutionWorkspace
                    ? "Paste a Google Sheet, form, document, video, notice, or other official HTTPS resource."
                    : "Paste the post, video, portfolio, store, booking, or sponsor page your audience should reach."}
                </span>
                {detectedDestination && detectedDestination.type !== "website" ? (
                  <div role="status" style={styles.destinationInsight}>
                    <strong>{detectedDestination.label}</strong>
                    <span>{detectedDestination.guidance}</span>
                  </div>
                ) : null}
              </div>
              <div style={styles.label}>
                <label htmlFor="custom-alias">Custom alias</label>
                <div className="sl-alias-group" style={styles.aliasInputGroup}>
                  <span className="sl-alias-prefix" style={styles.aliasPrefix}>{selectedDomainHost || "shotlink.in"}/</span>
                  <input
                    id="custom-alias"
                    style={{ ...styles.input, ...styles.aliasInput }}
                    aria-describedby="custom-alias-help"
                    value={customAlias}
                    onChange={(event) => {
                      setCustomAliasManuallyEdited(true);
                      setCustomAlias(event.target.value);
                    }}
                  />
                </div>
                <span id="custom-alias-help" style={styles.miniHelperText}>
                  Auto-filled from the template. You can replace it with any available 3-48 character path.
                </span>
              </div>
              <div style={styles.label}>
                <label htmlFor="fallback-destinations">
                  Fallback destinations <span aria-hidden="true" style={styles.optionalLabel}>Optional</span>
                </label>
                <textarea
                  id="fallback-destinations"
                  style={styles.textarea}
                  aria-describedby="fallback-destinations-help"
                  value={fallbackInput}
                  onChange={(event) => setFallbackInput(event.target.value)}
                />
                <span id="fallback-destinations-help" style={styles.miniHelperText}>Add one HTTPS backup destination per line, in failover order.</span>
              </div>
              <div className="sl-consent-box" style={styles.consentBox}>
                <p style={styles.consentIntro}>
                  Link policy version {LINK_POLICY_VERSION}. Required for every link so abusive or illegal destinations can be suspended with a clear audit trail.
                </p>
                <ConsentCheckbox checked={linkComplianceAccepted} onChange={setLinkComplianceAccepted}>
                  I have authority to share these destinations, consent to automated health checks, and will not use this link for phishing, malware, spam, impersonation, or unlawful content.
                </ConsentCheckbox>
              </div>
              <button
                type="submit"
                style={linkSubmitDisabled ? { ...styles.primaryButton, opacity: 0.6, cursor: "not-allowed" } : styles.primaryButton}
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
              <FeedbackMessage message={linkError} />
              <FeedbackMessage message={copied} tone="success" />
            </form>
            {analytics?.shortUrl && analytics.isActive ? (
              <div className="sl-dashboard-result" style={{ ...styles.resultCard, ...enterpriseDashboardStyles.panelCard }}>
                <div style={styles.resultTopRow}>
                  <div>
                    <p style={styles.mutedLabel}>Selected short URL · {getDestinationLabel(analytics)}</p>
                    <a href={analytics.shortUrl} target="_blank" rel="noreferrer" style={styles.link}>{analytics.shortUrl}</a>
                  </div>
                  <div style={styles.inlineActions}>
                    <button style={styles.secondaryButton} onClick={copyShortUrl}>Copy</button>
                    <button style={styles.secondaryButton} onClick={downloadQR}>QR</button>
                  </div>
                </div>
                <div style={styles.qrPanel}>
                  <QRCodeCanvas
                    id="qr-code"
                    value={analytics.shortUrl}
                    size={132}
                    includeMargin
                    aria-label={`QR code for ${analytics.shortUrl}`}
                  />
                  <div style={styles.qrText}>
                    <p style={styles.mutedLabel}>Routing behavior</p>
                    <p style={styles.qrHeadline}>
                      {analytics.currentTarget ? `Currently sending traffic to ${analytics.currentTarget.label}` : "No healthy destination available"}
                    </p>
                    <p style={styles.qrDescription}>Refresh route health after destination deploys, incidents, or domain fixes.</p>
                    <button style={styles.secondaryButton} onClick={refreshHealth} disabled={refreshingHealth}>
                      {refreshingHealth ? "Refreshing..." : "Refresh route health"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section id="analytics-panel" style={{ ...styles.analyticsPanel, ...enterpriseDashboardStyles.panelCard, gridArea: "analytics" }}>
            <div style={styles.analyticsHeader}>
              <div>
                <p style={styles.sectionEyebrow}>Analytics console</p>
                <h2 style={styles.panelTitle}>Protected workspace analytics</h2>
              </div>
              <div style={styles.inlineActions}>
                {analytics ? <StatusPill label={getDestinationLabel(analytics)} tone="accent" /> : null}
                <StatusPill
                  label={analytics?.isActive ? "active" : selectedShortCode ? "expired" : "select a link"}
                  tone={analytics?.isActive ? "healthy" : selectedShortCode ? "danger" : "neutral"}
                />
              </div>
            </div>
            <FeedbackMessage message={analyticsError} />
            <div className="sl-analytics-metrics" style={styles.metricsGrid}>
              <div style={{ ...styles.metricCard, ...enterpriseDashboardStyles.metricCard }}><p style={styles.metricLabel}>Total clicks</p><p style={styles.metricValue}>{analytics?.clicks ?? 0}</p></div>
              <div style={{ ...styles.metricCard, ...enterpriseDashboardStyles.metricCard }}><p style={styles.metricLabel}>Last click</p><p style={styles.metricValueSmall}>{formatDate(analytics?.lastClickedAt)}</p></div>
              <div style={{ ...styles.metricCard, ...enterpriseDashboardStyles.metricCard }}><p style={styles.metricLabel}>Expires in</p><p style={styles.metricValueSmall}>{countdown || "Select a link"}</p></div>
              <div style={{ ...styles.metricCard, ...enterpriseDashboardStyles.metricCard }}>
                <p style={styles.metricLabel}>Current target</p>
                <p style={styles.metricValueSmall}>
                  {analytics?.currentTarget?.kind === "fallback" ? analytics.currentTarget.label : analytics?.currentTarget ? "Primary destination" : "Select a link"}
                </p>
              </div>
            </div>
            <div style={styles.analyticsDetailGrid}>
              <div style={{ ...styles.panelCard, ...enterpriseDashboardStyles.panelCard }}>
                <div style={styles.panelTitleRow}>
                  <h3 style={styles.panelTitle}>Destination health</h3>
                  {analytics?.primaryHealth ? <StatusPill label={analytics.primaryHealth.status} tone={getHealthTone(analytics.primaryHealth.status)} /> : null}
                </div>
                <div style={styles.routeList}>
                  <div style={styles.routeCard}>
                    <div>
                      <p style={styles.routeLabel}>Primary</p>
                      <p style={styles.routeUrl}>{analytics?.originalUrl || "Select a link to inspect route health"}</p>
                    </div>
                    <div style={styles.routeMeta}>
                      <StatusPill label={analytics?.primaryHealth?.status || "not monitored"} tone={getHealthTone(analytics?.primaryHealth?.status)} />
                      <span style={styles.routeTime}>{analytics?.primaryHealth?.lastCheckedAt ? formatDate(analytics.primaryHealth.lastCheckedAt) : "Awaiting first health check"}</span>
                    </div>
                  </div>
                  {(analytics?.fallbackUrls || []).map((fallback) => (
                    <div key={fallback.url} style={styles.routeCard}>
                      <div><p style={styles.routeLabel}>{fallback.label}</p><p style={styles.routeUrl}>{fallback.url}</p></div>
                      <div style={styles.routeMeta}>
                        <StatusPill label={fallback.lastStatus} tone={getHealthTone(fallback.lastStatus)} />
                        <span style={styles.routeTime}>{fallback.lastCheckedAt ? formatDate(fallback.lastCheckedAt) : "Awaiting first health check"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ ...styles.panelCard, ...enterpriseDashboardStyles.panelCard }}>
                <div style={styles.panelTitleRow}><h3 style={styles.panelTitle}>Device mix</h3><span style={styles.metricHint}>{totalDeviceClicks} tracked events</span></div>
                {analytics?.deviceBreakdown?.length ? analytics.deviceBreakdown.map((item) => <DeviceBar key={item.deviceType} item={item} total={totalDeviceClicks} />) : <p style={styles.emptyState}>Clicks will appear here after people open the selected short URL.</p>}
              </div>
            </div>
            <div style={{ ...styles.panelCard, ...enterpriseDashboardStyles.panelCard }}>
              <div style={styles.panelTitleRow}>
                <h3 style={styles.panelTitle}>Recent click events</h3>
                {selectedShortCode ? (
                  <button
                    style={styles.secondaryButton}
                    onClick={async () => {
                      setAnalyticsError("");
                      try {
                        await refreshAnalytics();
                      } catch (requestError) {
                        setAnalyticsError(requestError.message || "Could not refresh analytics");
                      }
                    }}
                  >
                    Refresh analytics
                  </button>
                ) : null}
              </div>
              {analytics?.recentEvents?.length ? (
                <div style={styles.eventList}>
                  {analytics.recentEvents.map((event, index) => (
                    <div key={`${event.clickedAt}-${index}`} style={styles.eventCard}>
                      <div style={styles.eventTopRow}>
                        <strong style={styles.eventTitle}>{event.deviceType} on {event.browser}</strong>
                        <StatusPill label={event.redirectTargetKind} tone={event.redirectTargetKind === "fallback" ? "warning" : "accent"} />
                      </div>
                      <p style={styles.eventMeta}>{event.os} - {formatDate(event.clickedAt)}</p>
                      <p style={styles.eventTarget}>{event.redirectTarget || "No redirect target available"}</p>
                      <p style={styles.eventReferrer}>Referrer: {event.referrer || "Direct / unknown"}</p>
                    </div>
                  ))}
                </div>
              ) : <p style={styles.emptyState}>Click activity will appear here after the selected link receives traffic.</p>}
            </div>
            {analytics?.isActive ? <button style={styles.dangerButton} onClick={() => window.confirm("Expire this short link now?") && expireCurrentLink()}>Expire this short link</button> : null}
          </section>

          <section id="links-panel" style={{ ...styles.panelCard, ...styles.linksPanel, ...enterpriseDashboardStyles.panelCard, gridArea: "links" }}>
            <div style={styles.panelTitleRow}>
              <div>
                <p style={styles.sectionEyebrow}>Links</p>
                <h2 style={styles.panelTitle}>Active links</h2>
                {expiredLinkCount ? <p style={styles.miniHelperText}>{expiredLinkCount} expired link{expiredLinkCount === 1 ? "" : "s"} hidden</p> : null}
              </div>
              <StatusPill label={workspaceLoading ? "syncing" : "live"} tone="accent" />
            </div>
            {activeLinks.length ? (
              <div className="sl-link-library-list" style={styles.linkList}>
                {activeLinks.map((link) => (
                  <button key={link.shortCode} style={link.shortCode === selectedShortCode ? styles.linkListItemActive : styles.linkListItem} onClick={() => setSelectedShortCode(link.shortCode)}>
                    <div style={styles.linkListTopRow}>
                      <span style={styles.linkShortCode}>{link.shortCode}</span>
                      <div style={styles.inlineActions}>
                        <StatusPill label={getDestinationLabel(link)} tone="neutral" />
                        <StatusPill label={link.isActive ? "active" : "expired"} tone={getActiveTone(link)} />
                      </div>
                    </div>
                    {link.customDomainHost ? <p style={styles.mutedLabel}>{link.customDomainHost}</p> : null}
                    <p style={styles.linkOriginal}>{link.originalUrl}</p>
                    <div style={styles.linkListFooter}><span>{link.clicks} clicks</span><span>{formatDate(link.createdAt)}</span></div>
                  </button>
                ))}
              </div>
            ) : <p style={styles.emptyState}>Your published links will appear here.</p>}
          </section>

          {!isInstitutionWorkspace ? (
            <section
              id="social-panel"
              className="sl-social-publisher"
              style={{ ...styles.panelCard, ...enterpriseDashboardStyles.panelCard, gridArea: "social" }}
            >
              <div className="sl-social-publisher-header">
                <div>
                  <p style={styles.sectionEyebrow}>Creator automation · Stage 01</p>
                  <h2 style={styles.panelTitle}>Prepare and share from one workspace</h2>
                  <p style={styles.panelLead}>
                    Choose an active Shotlink, write the caption once, then open the selected platform with a share-ready post package.
                  </p>
                </div>
                <StatusPill label="No password required" tone="healthy" />
              </div>

              <div className="sl-social-publisher-grid">
                <div className="sl-social-composer">
                  <label style={styles.label}>
                    Shotlink to share
                    <select
                      style={styles.select}
                      value={selectedShareLink?.shortCode || ""}
                      disabled={!activeLinks.length}
                      onChange={(event) => {
                        setSelectedShortCode(event.target.value);
                        setSocialMessage("");
                        setSocialError("");
                      }}
                    >
                      {!activeLinks.length ? <option value="">Create an active link first</option> : null}
                      {activeLinks.map((link) => (
                        <option key={link.shortCode} value={link.shortCode}>
                          {link.shortUrl} · {getDestinationLabel(link)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={styles.label}>
                    Caption
                    <textarea
                      style={styles.textarea}
                      value={socialCaption}
                      maxLength={2000}
                      placeholder="Tell your audience what this link is about..."
                      onChange={(event) => {
                        setSocialCaption(event.target.value);
                        setSocialMessage("");
                        setSocialError("");
                      }}
                    />
                    <span style={styles.miniHelperText}>
                      {socialCaption.length}/2000 · Review each platform's caption limits before publishing.
                    </span>
                  </label>

                  <fieldset className="sl-social-platform-fieldset">
                    <legend>Post to</legend>
                    <div className="sl-social-platform-grid">
                      {SOCIAL_PUBLISH_PLATFORMS.map((platform) => {
                        const isSelected = socialPlatform === platform.id;
                        return (
                          <button
                            key={platform.id}
                            type="button"
                            className={isSelected ? "is-selected" : ""}
                            aria-label={`Select ${platform.name}`}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSocialPlatform(platform.id);
                              setSocialMessage("");
                              setSocialError("");
                            }}
                          >
                            <span>{platform.mark}</span>
                            <strong>{platform.name}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>

                <aside className="sl-social-preview" aria-label="Social post preview">
                  <div className="sl-social-preview-top">
                    <span>{selectedSocialPlatform.mark}</span>
                    <div>
                      <strong>{selectedSocialPlatform.name}</strong>
                      <small>Review before posting</small>
                    </div>
                  </div>
                  <p>{socialCaption.trim() || "Your caption preview will appear here."}</p>
                  <a href={selectedShareLink?.shortUrl || undefined} target="_blank" rel="noreferrer">
                    {selectedShareLink?.shortUrl || "Create a Shotlink to continue"}
                  </a>
                  <small>{selectedSocialPlatform.helper}</small>
                  <button
                    type="button"
                    className="sl-social-publish-button"
                    disabled={!selectedShareLink}
                    onClick={prepareSocialPost}
                  >
                    Prepare post for {selectedSocialPlatform.name} →
                  </button>
                  <FeedbackMessage message={socialError} />
                  <FeedbackMessage message={socialMessage} tone="success" />
                  <p className="sl-social-security-note">
                    Shotlink copies the post package and opens the platform. You remain in control and confirm the final post there.
                  </p>
                </aside>
              </div>
            </section>
          ) : null}

          <section id="domains-panel" style={{ ...styles.panelCard, ...enterpriseDashboardStyles.panelCard, gridArea: "domains" }}>
            <div style={styles.panelTitleRow}>
              <div>
                <p style={styles.sectionEyebrow}>Domains</p>
                <h2 style={styles.panelTitle}>
                  {isInstitutionWorkspace ? "Official link and identity domains" : "Branded link domains"}
                </h2>
              </div>
              <StatusPill
                label={isInstitutionWorkspace
                  ? `${customDomains.length} link · ${managedEmailDomains.length} identity`
                  : `${customDomains.length} connected`}
                tone={domainLimit ? "accent" : "neutral"}
              />
            </div>
            <FeedbackMessage message={domainError} />
            <FeedbackMessage message={domainMessage} tone="success" />
            <div className="sl-inline-form" style={styles.inlineForm}>
              <div style={styles.inlineFieldLabel}>
                <label htmlFor="custom-domain">Branded subdomain</label>
                <input id="custom-domain" style={styles.input} aria-describedby="custom-domain-help" value={customDomainInput} onChange={(event) => setCustomDomainInput(event.target.value)} disabled={domainSaving || customDomains.length >= domainLimit} />
                <span id="custom-domain-help" style={styles.miniHelperText}>Enter the subdomain you will point to Shotlink.</span>
              </div>
              <button style={domainSaving || customDomains.length >= domainLimit ? { ...styles.secondaryButton, opacity: 0.6, cursor: "not-allowed" } : styles.primaryButton} onClick={addCustomDomain} disabled={domainSaving || customDomains.length >= domainLimit}>
                {domainSaving ? "Adding..." : "Add domain"}
              </button>
            </div>
            {domainLimit === 0 ? (
              <p style={styles.helperText}>
                {isInstitutionWorkspace
                  ? "Activate the Institution plan to connect an official link domain and email identity domain."
                  : "Upgrade to Creator Pro or Studio to publish branded campaign links."}
              </p>
            ) : null}
            {customDomains.length ? (
              <div style={styles.domainList}>
                {customDomains.map((domain) => (
                  <div key={domain.hostname} style={styles.domainCard}>
                    <div style={styles.planHeader}><strong style={styles.planName}>{domain.hostname}</strong><StatusPill label={domain.isPrimary ? `${domain.status} primary` : domain.status} tone={domain.status === "verified" ? "healthy" : "warning"} /></div>
                    <div style={styles.dnsGrid}>
                      <div><p style={styles.mutedLabel}>CNAME</p><p style={styles.codeLine}>{domain.hostname} to {cnameTarget}</p></div>
                      <div><p style={styles.mutedLabel}>TXT</p><p style={styles.codeLine}>{domain.dns?.txtName}</p><p style={styles.codeLine}>{domain.dns?.txtValue}</p></div>
                    </div>
                    <FeedbackMessage message={domain.lastVerificationError} />
                    <div style={styles.inlineActions}>
                      <button style={styles.secondaryButton} onClick={() => verifyCustomDomain(domain.hostname)} disabled={domainVerifying === domain.hostname}>{domainVerifying === domain.hostname ? "Checking..." : "Verify"}</button>
                      {domain.status === "verified" && !domain.isPrimary ? <button style={styles.secondaryButton} onClick={() => setPrimaryCustomDomain(domain.hostname)} disabled={domainVerifying === domain.hostname}>Make primary</button> : null}
                      <button style={styles.secondaryButton} onClick={() => window.confirm("Remove this domain from the workspace?") && removeCustomDomain(domain.hostname)} disabled={domainVerifying === domain.hostname}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p style={styles.emptyState}>Add your branded subdomain, publish the DNS records, then verify it here.</p>}

            {isInstitutionWorkspace ? <div style={{ ...styles.paymentCard, marginTop: 20 }}>
              <div style={styles.panelTitleRow}>
                <div>
                  <p style={styles.sectionEyebrow}>Institution access</p>
                  <h3 style={styles.panelTitle}>Official email-domain ownership</h3>
                  <p style={styles.helperText}>
                    Verify an institution domain once. New users on that domain can no longer create
                    unsanctioned Shotlink workspaces and must be provisioned by the institution.
                  </p>
                </div>
                <StatusPill
                  label={institutionGovernanceEnabled ? "Governance enabled" : "Institution control"}
                  tone={institutionGovernanceEnabled ? "healthy" : "neutral"}
                />
              </div>
              {!institutionGovernanceEnabled ? (
                <p style={styles.helperText}>
                  Official email-domain governance is activated with the Institution plan. Contact
                  support@shotlink.in when your university, agency, or company is ready to claim its domain.
                </p>
              ) : null}
              <FeedbackMessage message={managedEmailDomainError} />
              <FeedbackMessage message={managedEmailDomainMessage} tone="success" />
              <div className="sl-inline-form" style={styles.inlineForm}>
                <div style={styles.inlineFieldLabel}>
                  <label htmlFor="managed-email-domain">Official email domain</label>
                  <input
                    id="managed-email-domain"
                    style={styles.input}
                    aria-describedby="managed-email-domain-help"
                    value={managedEmailDomainInput}
                    placeholder="university.edu.in"
                    onChange={(event) => setManagedEmailDomainInput(event.target.value)}
                    disabled={managedEmailDomainSaving || !institutionGovernanceEnabled}
                  />
                  <span id="managed-email-domain-help" style={styles.miniHelperText}>
                    Public inbox providers such as Gmail and Outlook cannot be claimed.
                  </span>
                </div>
                <button
                  style={managedEmailDomainSaving || !institutionGovernanceEnabled ? { ...styles.secondaryButton, opacity: 0.6, cursor: "not-allowed" } : styles.primaryButton}
                  onClick={addManagedEmailDomain}
                  disabled={managedEmailDomainSaving || !institutionGovernanceEnabled}
                >
                  {managedEmailDomainSaving ? "Adding..." : "Claim domain"}
                </button>
              </div>
              {managedEmailDomains.length ? (
                <div style={styles.domainList}>
                  {managedEmailDomains.map((domain) => (
                    <div key={domain.hostname} style={styles.domainCard}>
                      <div style={styles.planHeader}>
                        <strong style={styles.planName}>@{domain.hostname}</strong>
                        <StatusPill
                          label={domain.status === "verified" ? "governed" : domain.status}
                          tone={domain.status === "verified" ? "healthy" : "warning"}
                        />
                      </div>
                      <div style={styles.dnsGrid}>
                        <div>
                          <p style={styles.mutedLabel}>Ownership TXT name</p>
                          <p style={styles.codeLine}>{domain.dns?.txtName}</p>
                        </div>
                        <div>
                          <p style={styles.mutedLabel}>TXT value</p>
                          <p style={styles.codeLine}>{domain.dns?.txtValue}</p>
                        </div>
                      </div>
                      <FeedbackMessage message={domain.lastVerificationError} />
                      <div style={styles.inlineActions}>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => verifyManagedEmailDomain(domain.hostname)}
                          disabled={managedEmailDomainVerifying === domain.hostname}
                        >
                          {managedEmailDomainVerifying === domain.hostname ? "Checking..." : "Verify ownership"}
                        </button>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => window.confirm("Release this institution email domain?") && removeManagedEmailDomain(domain.hostname)}
                          disabled={managedEmailDomainVerifying === domain.hostname}
                        >
                          Release domain
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div> : null}
          </section>

          <section id="billing-panel" style={{ ...styles.panelCard, ...enterpriseDashboardStyles.panelCard, gridArea: "billing" }}>
            <div style={styles.panelTitleRow}>
              <div><p style={styles.sectionEyebrow}>Billing</p><h2 style={styles.panelTitle}>Active subscription</h2></div>
              <button style={{ ...styles.secondaryButton, opacity: billingLoading ? 0.7 : 1, cursor: billingLoading ? "progress" : "pointer" }} onClick={() => refreshBillingSummary("Billing status refreshed.", { syncProvider: true })} disabled={billingLoading}>
                {billingLoading ? "Refreshing..." : currentPlan.billingStatus === "pending" ? "Verify payment" : "Refresh billing"}
              </button>
            </div>
            <FeedbackMessage message={billingError} />
            <FeedbackMessage message={billingMessage} tone="success" />
            <div style={styles.billingOverviewGrid}>
              <div style={{ ...styles.subscriptionCard, ...enterpriseDashboardStyles.subscriptionCard }}>
                <div><p style={styles.mutedLabel}>Current subscription</p><h3 style={styles.subscriptionTitle}>{currentPlan.effectivePlanName}</h3></div>
                <StatusPill label={formatLabel(currentPlan.billingStatus)} tone={getBillingTone(currentPlan.billingStatus)} />
                <p style={styles.helperText}>{activeLinkCount}/{activeLinkLimit} active links used. {remainingLinkSlots} slots still available.</p>
                <p style={styles.miniHelperText}>{currentPlan.currentPeriodEndsAt ? `Renews or ends ${formatDate(currentPlan.currentPeriodEndsAt)}` : "Free tier subscription"}</p>
              </div>
              <div style={styles.billingStatsGrid}>
                <div style={styles.billingStatCard}><p style={styles.billingStatLabel}>Current plan</p><p style={styles.billingStatValue}>{currentPlan.effectivePlanName}</p></div>
                <div style={styles.billingStatCard}><p style={styles.billingStatLabel}>Slots left</p><p style={styles.billingStatValue}>{remainingLinkSlots}</p></div>
                <div style={styles.billingStatCard}><p style={styles.billingStatLabel}>Billing status</p><p style={styles.billingStatValueSmall}>{formatLabel(currentPlan.billingStatus)}</p></div>
                <div style={styles.billingStatCard}><p style={styles.billingStatLabel}>Current period</p><p style={styles.billingStatValueSmall}>{currentPlan.currentPeriodEndsAt ? formatDate(currentPlan.currentPeriodEndsAt) : "Free tier"}</p></div>
              </div>
            </div>
            <div style={styles.paymentCard}>
              <div>
                <p style={styles.mutedLabel}>Upgrade subscription</p>
                <p style={styles.helperText}>
                  {checkoutAvailability.enabled
                    ? "Choose a paid plan to open secure Razorpay checkout."
                    : checkoutAvailability.message}
                </p>
              </div>
              <div style={styles.compactPlanGrid}>
                {publicPlans.filter((plan) =>
                  plan.id !== "free" && (isInstitutionWorkspace ? plan.id === "enterprise" : plan.id !== "enterprise")
                ).map((plan) => {
                  const isInstitutionPlan = plan.id === "enterprise";
                  const isCurrentPlan = currentPlan.effectivePlanId === plan.id;
                  const isCheckoutLoading = checkoutLoadingPlanId === plan.id;
                  const isPaidCheckoutUnavailable = !checkoutAvailability.enabled && !isInstitutionPlan;
                  const displayName = isInstitutionPlan ? "Institution" : plan.name;
                  return (
                    <div key={plan.id} style={{ ...styles.compactPlanCard, ...enterpriseDashboardStyles.compactPlanCard }}>
                      <div style={styles.planHeader}><strong style={styles.planName}>{displayName}</strong><span style={styles.compactPlanPrice}>{formatPlanPrice(plan)}</span></div>
                      <p style={styles.miniHelperText}>
                        {isInstitutionPlan
                          ? "Official link domains, email-domain governance, roles, and audit control."
                          : `${plan.linkLimit} links and ${plan.domainLimit} branded ${plan.domainLimit === 1 ? "domain" : "domains"}.`}
                      </p>
                      <button style={isCurrentPlan || isCheckoutLoading || isPaidCheckoutUnavailable ? { ...styles.secondaryButton, opacity: 0.65, cursor: "not-allowed" } : styles.primaryButton} onClick={() => startPlanCheckout(plan)} disabled={isCurrentPlan || isPaidCheckoutUnavailable || Boolean(checkoutLoadingPlanId)}>
                        {isCurrentPlan ? "Current plan" : isCheckoutLoading ? "Opening..." : isPaidCheckoutUnavailable ? "Live checkout coming soon" : isInstitutionPlan ? "Contact institution onboarding" : `Upgrade to ${plan.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={styles.billingDetailGrid}>
              <div style={styles.paymentCard}>
                <div style={styles.planHeader}><div><p style={styles.mutedLabel}>Usage</p><p style={styles.helperText}>Monthly quotas reset with your billing cycle.</p></div><StatusPill label={currentPlan.usagePeriodKey || "Current month"} tone="neutral" /></div>
                <div style={styles.usageGrid}>{Object.values(currentPlan.usage || {}).map((metric) => <UsageBar key={metric.key} metric={metric} />)}</div>
              </div>
              <div style={styles.paymentCard}>
                <div style={styles.planHeader}>
                  <div><p style={styles.mutedLabel}>Invoices</p><p style={styles.helperText}>Recent Razorpay subscription and invoice events.</p></div>
                  {currentPlan.effectivePlanId !== "free" ? <button style={{ ...styles.secondaryButton, opacity: billingLoading ? 0.65 : 1, cursor: billingLoading ? "not-allowed" : "pointer" }} onClick={cancelCurrentSubscription} disabled={billingLoading}>Cancel at renewal</button> : null}
                </div>
                <div style={styles.invoiceList}>
                  {billingRecords.length ? billingRecords.slice(0, 5).map((record) => (
                    <div key={record.id} style={styles.invoiceRow}>
                      <div><strong style={styles.planName}>{record.planName}</strong><p style={styles.miniHelperText}>{formatLabel(record.status)} - {formatDate(record.createdAt)}</p></div>
                      {record.invoiceUrl || record.paymentLinkUrl ? <a href={record.invoiceUrl || record.paymentLinkUrl} target="_blank" rel="noreferrer" style={styles.inlineLink}>Open</a> : <span style={styles.miniHelperText}>{formatPriceInInr(record.amountInPaise)}</span>}
                    </div>
                  )) : <p style={styles.helperText}>Invoices appear after your first subscription event.</p>}
                </div>
              </div>
            </div>
          </section>

          {showDocsPanel ? (
            <section id="docs-panel" style={{ ...styles.docsQuickPanel, ...enterpriseDashboardStyles.docsQuickPanel, gridArea: "docs" }}>
              <div style={styles.panelTitleRow}><div><p style={styles.sectionEyebrow}>Docs</p><h2 style={styles.panelTitle}>Quick operator guide</h2></div><button style={styles.secondaryButton} onClick={() => setShowDocsPanel(false)}>Hide</button></div>
              <div style={styles.docsQuickList}>
                {DOC_SECTIONS.slice(0, 3).map((section) => <div key={section.title} style={styles.docsQuickItem}><strong>{section.title}</strong><span>{section.body}</span></div>)}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default App;
