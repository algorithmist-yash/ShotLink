import { inject, pageview, track } from "@vercel/analytics";
import { GUIDES } from "./guideContent";

const PUBLIC_PATHS = new Set(["/", "/pricing", "/docs", "/trust", "/terms", "/privacy", "/contact", "/shipping-policy", "/refund-policy", "/login", "/register", ...GUIDES.map(g => `/${g.slug}`)]);
const EVENTS = new Set(["signup_started", "signup_completed", "email_verified", "workspace_link_created", "guest_link_created", "guest_link_failed", "guest_link_copied", "guest_qr_downloaded"]);
let initialized = false;
let lastPage = "";
const enabled = () => import.meta.env.PROD && import.meta.env.VITE_ENABLE_WEB_ANALYTICS === "true";

export function sanitizeAnalyticsEvent(event) {
  try {
    const url = new URL(event.url);
    if (!PUBLIC_PATHS.has(url.pathname)) {
      if (event.type !== "event" || url.pathname !== "/verify-email") return null;
      url.pathname = "/register";
    }
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch { return null; }
}

export function initializeMarketingAnalytics() {
  if (!enabled() || initialized) return;
  initialized = true;
  inject({ mode: "production", disableAutoTrack: true, beforeSend: sanitizeAnalyticsEvent });
}

export function recordMarketingPage(pathname = window.location.pathname) {
  if (!enabled() || !PUBLIC_PATHS.has(pathname) || lastPage === pathname) return;
  try {
    initializeMarketingAnalytics();
    lastPage = pathname;
    pageview({ path: pathname, route: pathname });
  } catch { /* An unavailable analytics provider must not affect page rendering. */ }
}

export function recordFunnelEvent(name) {
  if (!enabled() || !EVENTS.has(name)) return;
  try {
    initializeMarketingAnalytics();
    // Fixed event names only: no account IDs, destinations, aliases, tokens or form values.
    track(name);
  } catch { /* Measurement must never interrupt the product flow. */ }
}
