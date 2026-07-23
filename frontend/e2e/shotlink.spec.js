import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const BACKEND_URL = "http://127.0.0.1:5001";
const ACCOUNT_CONSENT_LABELS = [
  "I confirm I am 18+ or legally allowed to use this service.",
  "I agree to the Terms of Service and paid-plan rules.",
  "I have read the Privacy Notice for account, billing, and support data.",
  "I understand link visits collect time, device type, browser, OS, referrer, and hashed IP for analytics, security, and abuse prevention.",
  "I agree not to use this service for spam, phishing, malware, impersonation, illegal content, or misleading links.",
];
const LINK_POLICY_LABEL =
  "I have authority to share these destinations, consent to automated health checks, and will not use this link for phishing, malware, spam, impersonation, or unlawful content.";

function collectRuntimeErrors(page) {
  const errors = [];

  page.on("console", (message) => {
    const isBrowserNetworkDiagnostic = message.text().startsWith("Failed to load resource:");
    if (message.type() === "error" && !isBrowserNetworkDiagnostic) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

  return errors;
}

function violationFingerprints(results) {
  return results.violations.map((violation) => ({
    rule: violation.id,
    targets: violation.nodes.map((node) => node.target),
  }));
}

async function expectNoWcagViolations(page, testInfo) {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().activeDuration !== Infinity)
        .every((animation) => animation.playState === "finished")
  );

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  await testInfo.attach("axe-wcag-results", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  expect(violationFingerprints(results)).toEqual([]);
}

async function openPublicHomepage(page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "URL shortener with smart fallback routing",
    })
  ).toBeVisible();
}

test("public navigation, auth validation, and WCAG guardrails work", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPublicHomepage(page);

  await expect(page).toHaveTitle("Shotlink | Branded short links and fallback routing");
  await expect(page.getByRole("navigation", { name: "Public pages" })).toBeVisible();
  await expectNoWcagViolations(page, testInfo);

  const publicDestinations = [
    ["Pricing", "/pricing", "Infrastructure pricing without enterprise fog."],
    ["Resources", "/docs", "Build on the Shotlink routing layer."],
    ["Trust", "/trust", "Trust rules for public link infrastructure."],
    ["Platform", "/", "URL shortener with smart fallback routing"],
  ];

  for (const [linkName, path, heading] of publicDestinations) {
    await page
      .getByRole("navigation", { name: "Public pages" })
      .getByRole("link", { name: linkName, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : `${path}$`}`));
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

  const loginForm = page.locator("form");
  await loginForm.getByRole("button", { name: "Sign in", exact: true }).click();
  expect(
    await page
      .getByRole("textbox", { name: "Email" })
      .evaluate((input) => input.validity.valueMissing)
  ).toBe(true);

  await page.getByRole("textbox", { name: "Email" }).fill("nobody@e2e.test");
  await page.getByLabel("Password").fill("StrongPass123");
  await loginForm.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Invalid email or password", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create workspace", exact: true })).toBeDisabled();
  expect(runtimeErrors).toEqual([]);
});

test("real registration, cookie session, link redirect, analytics, and logout work", async ({
  page,
  request,
}, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  const uniqueSuffix = `${Date.now()}-${test.info().workerIndex}`;
  const email = `owner-${uniqueSuffix}@e2e.test`;
  const alias = `browser-${uniqueSuffix}`;
  const workspaceName = "Browser E2E Workspace";
  const destination = "https://example.com/e2e-campaign";

  await openPublicHomepage(page);
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Get started", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Full name" }).fill("Browser E2E Owner");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByLabel("Password").fill("StrongPass123");
  await page.getByRole("textbox", { name: "Workspace name" }).fill(workspaceName);

  for (const label of ACCOUNT_CONSENT_LABELS) {
    await page.getByRole("checkbox", { name: label, exact: true }).check();
  }

  const createWorkspaceButton = page.getByRole("button", {
    name: "Create workspace",
    exact: true,
  });
  await expect(createWorkspaceButton).toBeEnabled();
  const registrationResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/v1/auth/register")
  );
  await createWorkspaceButton.click();
  expect((await registrationResponsePromise).status()).toBe(201);

  await expect(page.getByRole("heading", { level: 1, name: workspaceName })).toBeVisible();
  await expect(page.getByText("Welcome back, Browser.", { exact: false })).toBeVisible();
  expect((await page.context().cookies()).some((cookie) => cookie.name === "shotlink_session")).toBe(
    true
  );

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: workspaceName })).toBeVisible();
  await expectNoWcagViolations(page, testInfo);

  await page.getByRole("textbox", { name: "Primary destination" }).fill(destination);
  await page.getByRole("textbox", { name: "Custom alias" }).fill(alias);
  await page.getByRole("checkbox", { name: LINK_POLICY_LABEL, exact: true }).check();

  const createLinkResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/v1/links") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Shorten URL", exact: true }).click();
  expect((await createLinkResponsePromise).status()).toBe(201);

  const selectedLink = page.locator(`a[target="_blank"][href*="/${alias}"]`);
  await expect(selectedLink).toBeVisible();
  const shortUrl = await selectedLink.getAttribute("href");
  expect(shortUrl).toBe(`${BACKEND_URL}/${alias}`);

  const redirectResponse = await request.get(shortUrl, {
    headers: { "User-Agent": "Shotlink Playwright E2E" },
    maxRedirects: 0,
  });
  expect(redirectResponse.status()).toBe(302);
  expect(redirectResponse.headers().location).toBe(destination);

  const refreshAnalyticsButton = page.getByRole("button", {
    name: "Refresh analytics",
    exact: true,
  });
  await expect
    .poll(
      async () => {
        if (await refreshAnalyticsButton.isEnabled()) {
          await refreshAnalyticsButton.click();
        }
        return page.getByText("Total clicks", { exact: true }).evaluate((label) =>
          label.parentElement?.querySelector("p:nth-of-type(2)")?.textContent?.trim()
        );
      },
      { timeout: 15_000 }
    )
    .toBe("1");

  const logoutResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/v1/auth/logout")
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  expect((await logoutResponsePromise).status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "URL shortener with smart fallback routing",
    })
  ).toBeVisible();
  expect((await page.context().cookies()).some((cookie) => cookie.name === "shotlink_session")).toBe(
    false
  );
  expect(
    await page.evaluate(() =>
      fetch("http://127.0.0.1:5001/api/v1/auth/me", { credentials: "include" }).then(
        (response) => response.status
      )
    )
  ).toBe(401);
  expect(runtimeErrors).toEqual([]);
});

test("@mobile public and sign-in layouts fit a 390px viewport", async ({ page }, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await openPublicHomepage(page);

  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(
    page.getByRole("banner").getByRole("button", { name: "Get started", exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expectNoWcagViolations(page, testInfo);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test("public routes ship indexable HTML and keyboard focus remains visible", async ({
  page,
  request,
}) => {
  for (const [path, heading] of [
    ["/pricing", "Infrastructure pricing without enterprise fog."],
    ["/docs", "Build on the Shotlink routing layer."],
    ["/trust", "Trust rules for public link infrastructure."],
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(heading);
  }

  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect((await request.get("/sitemap.xml")).status()).toBe(200);

  await openPublicHomepage(page);
  const focusedLabels = [];
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    focusedLabels.push(
      await page.evaluate(() => {
        const active = document.activeElement;
        const style = window.getComputedStyle(active);
        return {
          label: active?.getAttribute("aria-label") || active?.textContent?.trim() || "",
          tag: active?.tagName || "",
          visible: style.outlineStyle !== "none" || style.boxShadow !== "none",
        };
      })
    );
  }
  expect(focusedLabels.every((item) => ["A", "BUTTON", "INPUT"].includes(item.tag))).toBe(true);
  expect(focusedLabels.some((item) => item.visible)).toBe(true);
});
