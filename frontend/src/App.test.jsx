import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import App from "./App";

vi.mock("qrcode.react", () => ({
  QRCodeCanvas: ({ id }) => <div data-testid={id || "qr-code-preview"} />,
}));

const sessionPayload = {
  csrfToken: "test-csrf-token",
  sessionExpiresAt: "2026-08-20T00:00:00.000Z",
  user: {
    id: "user-test",
    name: "Test Owner",
    email: "owner@example.com",
  },
  workspace: {
    id: "workspace-test",
    name: "Test Workspace",
    slug: "test-workspace",
    plan: "free",
    customDomains: [],
    billing: {
      configuredPlanId: "free",
      effectivePlanId: "free",
      effectivePlanName: "Free",
      billingStatus: "inactive",
      linkLimit: 10,
      domainLimit: 0,
      usage: {},
    },
  },
};

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function getRequestPath(input) {
  return new URL(String(input), "http://localhost").pathname;
}

describe("Shotlink frontend workflows", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  test("turns the landing preview action into a working registration CTA", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi
      .spyOn(window.HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});

    fetch.mockImplementation(async (input) => {
      const path = getRequestPath(input);
      if (path === "/api/v1/auth/me") return jsonResponse(401, { error: "Authentication required" });
      if (path === "/api/v1/billing/plans") return jsonResponse(200, { plans: [] });
      throw new Error(`Unexpected request: ${path}`);
    });
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Shorten URL" }));

    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
  });

  test("shows a rejected sign-in beside the authentication form", async () => {
    const user = userEvent.setup();

    fetch.mockImplementation(async (input) => {
      const path = getRequestPath(input);

      if (path === "/api/v1/billing/plans") {
        return jsonResponse(200, { plans: [] });
      }

      if (path === "/api/v1/auth/me") {
        return jsonResponse(401, { error: "Authentication required" });
      }

      if (path === "/api/v1/auth/login") {
        return jsonResponse(401, { error: "Invalid email or password" });
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    const signInForm = screen.getByRole("heading", { name: "Sign in" }).closest("form");

    await user.type(within(signInForm).getByLabelText("Email"), "owner@example.com");
    await user.type(within(signInForm).getByLabelText("Password"), "wrong-password");
    await user.click(within(signInForm).getByRole("button", { name: "Sign in" }));

    expect(await within(signInForm).findByRole("alert")).toHaveTextContent(
      "Invalid email or password"
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  test("submits the link builder from the destination field with Enter", async () => {
    const user = userEvent.setup();

    const createdLink = {
      shortCode: "keyboard-link",
      shortUrl: "https://shot.link/keyboard-link",
      originalUrl: "https://example.com/keyboard-campaign",
      isActive: true,
      expiresAt: null,
      createdAt: "2026-07-18T00:00:00.000Z",
    };
    let storedLinks = [];

    fetch.mockImplementation(async (input, options = {}) => {
      const path = getRequestPath(input);
      const method = options.method || "GET";

      if (path === "/api/v1/billing/plans") {
        return jsonResponse(200, { plans: [] });
      }

      if (path === "/api/v1/auth/me") {
        return jsonResponse(200, sessionPayload);
      }

      if (path === "/api/v1/links" && method === "GET") {
        return jsonResponse(200, { links: storedLinks });
      }

      if (path === "/api/v1/links" && method === "POST") {
        storedLinks = [createdLink];
        return jsonResponse(201, { link: createdLink });
      }

      if (path === "/api/v1/links/keyboard-link/analytics") {
        return jsonResponse(200, {
          ...createdLink,
          clicks: 0,
          deviceBreakdown: [],
          recentEvents: [],
        });
      }

      if (path === "/api/v1/billing/summary") {
        return jsonResponse(200, {
          currentPlan: sessionPayload.workspace.billing,
          plans: [],
          recentPayments: [],
        });
      }

      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Test Workspace" })
    ).toBeInTheDocument();

    const builderPanel = document.querySelector("#builder-panel");
    const destination = within(builderPanel).getByLabelText("Primary destination");
    const policyCheckbox = within(builderPanel).getByRole("checkbox");

    expect(destination).toHaveAttribute("type", "url");
    expect(destination.closest("form")).not.toBeNull();

    fireEvent.change(destination, { target: { value: createdLink.originalUrl } });
    await user.click(policyCheckbox);
    await user.click(destination);
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(
        fetch.mock.calls.some(([requestInput, requestOptions = {}]) =>
          getRequestPath(requestInput) === "/api/v1/links" &&
          requestOptions.method === "POST"
        )
      ).toBe(true);
    });

    const createRequest = fetch.mock.calls.find(
      ([requestInput, requestOptions = {}]) =>
        getRequestPath(requestInput) === "/api/v1/links" &&
        requestOptions.method === "POST"
    );
    const createHeaders = new Headers(createRequest[1].headers);
    expect(createRequest[1].credentials).toBe("include");
    expect(createHeaders.get("X-CSRF-Token")).toBe(sessionPayload.csrfToken);

    expect(
      await within(builderPanel).findByRole("link", { name: createdLink.shortUrl })
    ).toBeInTheDocument();
  });

  test("keeps a denied subscription action inside the billing panel", async () => {
    const user = userEvent.setup();

    fetch.mockImplementation(async (input, options = {}) => {
      const path = getRequestPath(input);
      const method = options.method || "GET";

      if (path === "/api/v1/billing/plans") {
        return jsonResponse(200, { plans: [] });
      }

      if (path === "/api/v1/auth/me") {
        return jsonResponse(200, sessionPayload);
      }

      if (path === "/api/v1/links") {
        return jsonResponse(200, { links: [] });
      }

      if (path === "/api/v1/billing/summary") {
        return jsonResponse(200, {
          currentPlan: sessionPayload.workspace.billing,
          plans: [],
          recentPayments: [],
        });
      }

      if (path === "/api/v1/billing/subscriptions" && method === "POST") {
        return jsonResponse(403, {
          error: "You do not have permission to perform this workspace action",
        });
      }

      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Test Workspace" })
    ).toBeInTheDocument();

    const billingPanel = document.querySelector("#billing-panel");
    const builderPanel = document.querySelector("#builder-panel");

    await user.click(within(billingPanel).getByRole("button", { name: "Upgrade to Pro" }));

    expect(await within(billingPanel).findByRole("alert")).toHaveTextContent(
      "You do not have permission to perform this workspace action"
    );
    expect(within(builderPanel).queryByRole("alert")).not.toBeInTheDocument();
  });

  test("signs in with cookie transport without persisting the returned bearer token", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("url-shortener-session-token", "stale-session-token");

    fetch.mockImplementation(async (input, options = {}) => {
      const path = getRequestPath(input);

      if (path === "/api/v1/auth/me") {
        return jsonResponse(401, { error: "Authentication required" });
      }
      if (path === "/api/v1/auth/logout") {
        expect(new Headers(options.headers).get("Authorization")).toBe(
          "Bearer stale-session-token"
        );
        return jsonResponse(200, { message: "Logged out" });
      }
      if (path === "/api/v1/billing/plans") {
        return jsonResponse(200, { plans: [] });
      }
      if (path === "/api/v1/auth/login") {
        expect(options.credentials).toBe("include");
        return jsonResponse(200, {
          ...sessionPayload,
          token: "legacy-bearer-token",
        });
      }
      if (path === "/api/v1/links") {
        return jsonResponse(200, { links: [] });
      }
      if (path === "/api/v1/billing/summary") {
        return jsonResponse(200, {
          currentPlan: sessionPayload.workspace.billing,
          plans: [],
          recentPayments: [],
        });
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    const signInForm = screen.getByRole("heading", { name: "Sign in" }).closest("form");

    await user.type(within(signInForm).getByLabelText("Email"), "owner@example.com");
    await user.type(within(signInForm).getByLabelText("Password"), "StrongPass1");
    await user.click(within(signInForm).getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Test Workspace" })).toBeInTheDocument();
    expect(window.localStorage.getItem("url-shortener-session-token")).toBeNull();
  });

  test("logs out through CSRF-protected cookie transport and clears the dashboard", async () => {
    const user = userEvent.setup();

    fetch.mockImplementation(async (input, options = {}) => {
      const path = getRequestPath(input);

      if (path === "/api/v1/auth/me") return jsonResponse(200, sessionPayload);
      if (path === "/api/v1/billing/plans") return jsonResponse(200, { plans: [] });
      if (path === "/api/v1/links") return jsonResponse(200, { links: [] });
      if (path === "/api/v1/billing/summary") {
        return jsonResponse(200, {
          currentPlan: sessionPayload.workspace.billing,
          plans: [],
          recentPayments: [],
        });
      }
      if (path === "/api/v1/auth/logout") {
        const headers = new Headers(options.headers);
        expect(options.credentials).toBe("include");
        expect(headers.get("X-CSRF-Token")).toBe(sessionPayload.csrfToken);
        return jsonResponse(200, { message: "Logged out" });
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Test Workspace" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "High-speed links for serious internet teams." })).toBeInTheDocument();
  });
});
