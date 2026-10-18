import { describe, expect, test } from "vitest";
import config from "../vercel.json";
import { GUIDES } from "./guideContent";

describe("public deployment routing", () => {
  test("the apex host permanently redirects to the canonical www host", () => {
    expect(config.redirects).toContainEqual(expect.objectContaining({
      destination: "https://www.shotlink.in/:path*",
      permanent: true,
      has: [{ type: "host", value: "shotlink.in" }],
    }));
  });

  test("account pages are excluded from search results", () => {
    const accountRule = config.headers.find(rule => rule.source.includes("forgot-password"));
    expect(accountRule.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  });

  test.each(GUIDES)("guide $slug is served before short links", ({ slug }) => {
    const guide = config.rewrites.findIndex(rule => rule.source === `/${slug}`);
    const proxy = config.rewrites.findIndex(rule => rule.source.includes(":shortCode"));
    expect(guide).toBeGreaterThanOrEqual(0);
    expect(guide).toBeLessThan(proxy);
    expect(config.rewrites[guide].destination).toBe(`/${slug}.html`);
  });
  test.each(["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"])(
    "%s reaches the application before the short-link proxy", (path) => {
      const explicit = config.rewrites.findIndex((rule) => rule.source === path);
      const proxy = config.rewrites.findIndex((rule) => rule.source.includes(":shortCode"));
      expect(explicit).toBeGreaterThanOrEqual(0);
      expect(explicit).toBeLessThan(proxy);
      expect(config.rewrites[explicit].destination).toBe("/index.html");
    }
  );

  test("does not rewrite unknown nested pages to a successful homepage", () => {
    expect(config.rewrites.some((rule) => rule.source === "/(.*)")).toBe(false);
  });
});
