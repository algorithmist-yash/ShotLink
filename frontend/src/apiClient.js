const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function apiFetch(path, { csrfToken = "", ...options } = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!SAFE_METHODS.has(method) && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
}
