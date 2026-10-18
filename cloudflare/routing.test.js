import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRoute, backendRequest } from "./routing.js";

test("account action links never enter the short-link backend", () => {
  for (const route of ["login", "register", "verify-email", "reset-password", "forgot-password"]) {
    assert.deepEqual(resolveRoute(new URL(`https://www.shotlink.in/${route}`)), { asset: "/index.html", private: true });
  }
});
test("API and campaign links reach the backend; unknown pages stay 404 candidates", () => {
  for (const url of ["https://api.shotlink.in/health", "https://www.shotlink.in/api/v1/links", "https://www.shotlink.in/summer-sale"]) {
    assert.deepEqual(resolveRoute(new URL(url)), { backend: true });
  }
  assert.deepEqual(resolveRoute(new URL("https://www.shotlink.in/missing/page")), { asset: "/missing/page" });
  assert.deepEqual(resolveRoute(new URL("https://www.shotlink.in/pricing")), { asset: "/pricing.html" });
});
test("canonical redirects preserve queries", () => {
  assert.equal(resolveRoute(new URL("https://shotlink.in/summer?utm_source=email")).redirect, "https://www.shotlink.in/summer?utm_source=email");
});
test("the container receives only trusted forwarding information", () => {
  const request = backendRequest(new Request("https://www.shotlink.in/api/v1/links", { headers: {
    "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "attacker", "forwarded": "for=attacker", "x-forwarded-proto": "http",
  } }));
  assert.equal(request.headers.get("x-forwarded-for"), "203.0.113.1");
  assert.equal(request.headers.get("forwarded"), null);
  assert.equal(request.headers.get("x-forwarded-proto"), "https");
});
