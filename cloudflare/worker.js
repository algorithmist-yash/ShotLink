import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";
import { backendRequest, resolveRoute } from "./routing.js";

export class ShotlinkBackend extends Container {
  defaultPort = 5000;
  sleepAfter = "15m";
  enableInternet = true;
  envVars = {
    ...JSON.parse(env.BACKEND_ENV_JSON || "{}"),
    NODE_ENV: "production",
    PORT: "5000",
    CLOUDFLARE_CONTAINER: "true",
    RUN_HEALTH_WORKER: "true",
  };
}

const csp = "default-src 'self'; base-uri 'self'; connect-src 'self' https://api.shotlink.in; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'";

export default {
  async fetch(request, bindings) {
    const url = new URL(request.url);
    const route = resolveRoute(url);
    if (route.redirect) return Response.redirect(route.redirect, 308);
    if (route.backend) {
      try {
        return await getContainer(bindings.BACKEND, "primary").fetch(backendRequest(request));
      } catch {
        return new Response("Service temporarily unavailable", {
          status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" },
        });
      }
    }
    url.pathname = route.asset;
    const response = new Response(await bindings.ASSETS.fetch(new Request(url, request)));
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    if (route.private) {
      response.headers.set("X-Robots-Tag", "noindex");
      response.headers.set("Cache-Control", "no-store");
    }
    return response;
  },
  async scheduled(_event, bindings) {
    // Keep the job consumers running during quiet periods. Durable jobs survive restarts in MongoDB.
    const response = await getContainer(bindings.BACKEND, "primary").fetch("https://api.shotlink.in/health");
    if (!response.ok) throw new Error("Backend readiness check failed");
  },
};
