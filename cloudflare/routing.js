const pages = new Set([
  "pricing", "docs", "trust", "terms", "privacy", "contact",
  "refund-policy", "shipping-policy",
]);
const auth = new Set(["login", "register", "forgot-password", "reset-password", "verify-email"]);
const aliases = { "cancellation-refund-policy": "refund-policy", "delivery-policy": "shipping-policy" };

export function resolveRoute(url) {
  if (url.hostname === "shotlink.in") return { redirect: `https://www.shotlink.in${url.pathname}${url.search}` };
  if (url.hostname === "api.shotlink.in" || url.pathname.startsWith("/api/")) return { backend: true };
  const path = url.pathname.replace(/\/$/, "");
  const slug = path.slice(1);
  if (Object.hasOwn(aliases, slug)) return { redirect: `${url.origin}/${aliases[slug]}${url.search}` };
  if (!path || auth.has(slug)) return { asset: "/index.html", private: auth.has(slug) };
  if (pages.has(slug)) return { asset: `/${slug}.html` };
  if (/^\/[A-Za-z0-9_-]{3,48}$/.test(path)) return { backend: true };
  return { asset: url.pathname };
}

export function backendRequest(request) {
  const headers = new Headers(request.headers);
  // The container has one trusted proxy: this Worker. Never trust client-supplied forwarding headers.
  headers.delete("forwarded");
  headers.delete("x-forwarded-for");
  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) headers.set("x-forwarded-for", clientIp);
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-host", new URL(request.url).host);
  return new Request(request, { headers, redirect: "manual" });
}
