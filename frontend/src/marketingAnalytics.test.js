import { describe, expect, test } from "vitest";
import { sanitizeAnalyticsEvent } from "./marketingAnalytics";

describe("marketing analytics data boundaries", () => {
  test("strips all queries and fragments, including action tokens", () => {
    expect(sanitizeAnalyticsEvent({ type: "pageview", url: "https://www.shotlink.in/register?email=private#token=secret" }).url).toBe("https://www.shotlink.in/register");
  });
  test("does not measure destination paths or account-action pageviews", () => {
    for (const path of ["/private-alias", "/dashboard", "/reset-password", "/verify-email"]) {
      expect(sanitizeAnalyticsEvent({ type: "pageview", url: `https://www.shotlink.in${path}` })).toBeNull();
    }
  });
  test("verification success is a sanitized funnel event", () => {
    expect(sanitizeAnalyticsEvent({ type: "event", url: "https://www.shotlink.in/verify-email#token=secret" }).url).toBe("https://www.shotlink.in/register");
  });
});
