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
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  test("turns the landing preview action into a working registration CTA", async () => {
    const user = userEvent.setup();
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

    expect(
      screen.getByRole("heading", { name: "Create your Shotlink workspace" })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/register");
  });

  test("creates an institution workspace with the official publishing interface", async () => {
    const institutionSession = {
      ...sessionPayload,
      workspace: {
        ...sessionPayload.workspace,
        name: "North Campus University",
        workspaceType: "institution",
      },
    };

    fetch.mockImplementation(async (input, options = {}) => {
      const path = getRequestPath(input);
      const method = options.method || "GET";

      if (path === "/api/v1/auth/me") return jsonResponse(401, { error: "Authentication required" });
      if (path === "/api/v1/billing/plans") return jsonResponse(200, { plans: [] });
      if (path === "/api/v1/auth/register" && method === "POST") {
        const payload = JSON.parse(options.body);
        expect(payload.workspaceType).toBe("institution");
        expect(payload.workspaceName).toBe("North Campus University");
        return jsonResponse(201, institutionSession);
      }
      if (path === "/api/v1/links") return jsonResponse(200, { links: [] });
      if (path === "/api/v1/billing/summary") {
        return jsonResponse(200, {
          currentPlan: institutionSession.workspace.billing,
          plans: [],
          recentPayments: [],
        });
      }

      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Create an institution workspace" }));

    const form = screen.getByRole("heading", { name: "Create your Shotlink workspace" }).closest("form");
    expect(within(form).getByRole("button", { name: /University \/ Institution/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(within(form).getByLabelText("Full name"), { target: { value: "Campus Admin" } });
    fireEvent.change(within(form).getByLabelText(/^Email/), { target: { value: "admin@northcampus.edu" } });
    fireEvent.change(within(form).getByLabelText("Password"), { target: { value: "StrongPass1" } });
    fireEvent.change(within(form).getByLabelText("Institution name"), { target: { value: "North Campus University" } });
    for (const checkbox of within(form).getAllByRole("checkbox")) fireEvent.click(checkbox);
    fireEvent.click(within(form).getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByRole("heading", { name: "North Campus University" })).toBeInTheDocument();
    expect(document.querySelector(".sl-dashboard-page")).toHaveAttribute("data-workspace-type", "institution");
    const officialResource = screen.getByLabelText("Official resource URL");
    expect(officialResource).toBeInTheDocument();
    expect(screen.getByText("Official link and identity domains")).toBeInTheDocument();
    expect(screen.queryByText("Social publisher")).not.toBeInTheDocument();

    fireEvent.change(officialResource, { target: { value: "https://docs.google.com/spreadsheets/d/campus-sheet/edit" } });
    expect(screen.getByText("Google Sheet detected")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Department / course"), { target: { value: "CSE" } });
    fireEvent.change(screen.getByLabelText("Class / section"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("Resource date"), { target: { value: "2026-08-10" } });

    await waitFor(() => {
      expect(screen.getByLabelText("Custom alias")).toHaveValue(
        "cse-42-attendance-2026-08-10"
      );
    });
    expect(screen.getByText("shotlink.in/cse-42-attendance-2026-08-10")).toBeInTheDocument();
  });

  test("generates a creator video path from the content template", async () => {
    fetch.mockImplementation(async (input) => {
      const path = getRequestPath(input);
      if (path === "/api/v1/auth/me") return jsonResponse(200, sessionPayload);
      if (path === "/api/v1/links") return jsonResponse(200, { links: [] });
      if (path === "/api/v1/billing/plans") return jsonResponse(200, { plans: [] });
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

    expect(await screen.findByText("Creator link template")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Campaign destination"), {
      target: { value: "https://www.youtube.com/watch?v=creator-video" },
    });
    fireEvent.change(screen.getByLabelText("Content / campaign name"), {
      target: { value: "Campus Vlog" },
    });
    fireEvent.change(screen.getByLabelText("Publish date"), {
      target: { value: "2026-08-10" },
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Custom alias")).toHaveValue(
        "campus-vlog-video-2026-08-10"
      );
    });
    expect(screen.getByText("shotlink.in/campus-vlog-video-2026-08-10")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Content / campaign name"), {
      target: { value: "Launch Video" },
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Custom alias")).toHaveValue(
        "launch-video-2026-08-10"
      );
    });
  });

  test("prepares a creator post package and opens the selected social composer", async () => {
    const user = userEvent.setup();
    const socialLink = {
      shortCode: "launch-video",
      shortUrl: "https://shotlink.in/launch-video",
      originalUrl: "https://www.youtube.com/watch?v=launch",
      destinationLabel: "Video",
      clicks: 0,
      isActive: true,
      expiresAt: null,
      createdAt: "2026-08-10T00:00:00.000Z",
    };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const openSpy = vi.spyOn(window, "open").mockReturnValue({ opener: null });

    fetch.mockImplementation(async (input) => {
      const path = getRequestPath(input);
      if (path === "/api/v1/auth/me") return jsonResponse(200, sessionPayload);
      if (path === "/api/v1/links") return jsonResponse(200, { links: [socialLink] });
      if (path === "/api/v1/billing/plans") return jsonResponse(200, { plans: [] });
      if (path === "/api/v1/billing/summary") {
        return jsonResponse(200, {
          currentPlan: sessionPayload.workspace.billing,
          plans: [],
          recentPayments: [],
        });
      }
      if (path === "/api/v1/links/launch-video/analytics") {
        return jsonResponse(200, {
          ...socialLink,
          deviceBreakdown: [],
          recentEvents: [],
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Prepare and share from one workspace" })
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Caption/), "Watch the full launch video");
    await user.click(screen.getByRole("button", { name: "Select X" }));
    await user.click(screen.getByRole("button", { name: "Prepare post for X →" }));

    expect(writeText).toHaveBeenCalledWith(
      "Watch the full launch video\n\nhttps://shotlink.in/launch-video"
    );
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://twitter.com/intent/tweet?text="),
      "_blank",
      "noopener,noreferrer"
    );
    expect(
      await screen.findByText(/X post package copied\. Complete the final review/)
    ).toBeInTheDocument();
  });

  test("creates a temporary homepage link and QR with a maximum 30-minute choice", async () => {
    const user = userEvent.setup();
    const temporaryLink = {
      shortCode: "creator15",
      shortUrl: "https://shotlink.in/creator15",
      originalUrl: "https://example.com/creator-post",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      isActive: true,
    };

    fetch.mockImplementation(async (input, options = {}) => {
      const path = getRequestPath(input);
      const method = options.method || "GET";

      if (path === "/api/v1/auth/me") {
        return jsonResponse(401, { error: "Authentication required" });
      }
      if (path === "/api/v1/billing/plans") {
        return jsonResponse(200, { plans: [] });
      }
      if (path === "/api/v1/links/guest" && method === "POST") {
        const payload = JSON.parse(options.body);
        expect(payload.originalUrl).toBe(temporaryLink.originalUrl);
        expect(payload.expiresInMinutes).toBe(15);
        expect(payload.compliance.abusePolicyAccepted).toBe(true);
        return jsonResponse(201, {
          link: temporaryLink,
          limits: { maxExpiryMinutes: 30 },
        });
      }

      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    render(<App />);

    await user.type(
      await screen.findByLabelText("Destination URL"),
      temporaryLink.originalUrl
    );
    await user.click(
      screen.getByLabelText(/I am authorised to share this destination/)
    );
    await user.click(screen.getByRole("button", { name: /Create short link \+ QR/ }));

    expect(
      await screen.findByRole("link", { name: temporaryLink.shortUrl })
    ).toBeInTheDocument();
    expect(screen.getByTestId("mk-temporary-qr")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "30 minutes" })).toBeInTheDocument();
  });

  test("publishes the required legal and contact details as readable pages", async () => {
    window.history.replaceState({}, "", "/contact");
    fetch.mockImplementation(async (input) => {
      const path = getRequestPath(input);
      if (path === "/api/v1/auth/me") return jsonResponse(401, { error: "Authentication required" });
      if (path === "/api/v1/billing/plans") {
        return jsonResponse(200, {
          plans: [],
          checkout: { enabled: false, message: "Live paid checkout is coming soon." },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Talk to the person operating Shotlink." })).toBeInTheDocument();
    expect(screen.getByText(/Yash Raj — Individual \/ Unregistered Business/)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "support@shotlink.in" })
        .some((link) => link.getAttribute("href") === "mailto:support@shotlink.in")
    ).toBe(true);
    expect(
      screen.getAllByRole("link", { name: "+91 87970 53635" })
        .some((link) => link.getAttribute("href") === "tel:+918797053635")
    ).toBe(true);
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  test("marks paid pricing as coming soon while live checkout is unavailable", async () => {
    window.history.replaceState({}, "", "/pricing");
    fetch.mockImplementation(async (input) => {
      const path = getRequestPath(input);
      if (path === "/api/v1/auth/me") return jsonResponse(401, { error: "Authentication required" });
      if (path === "/api/v1/billing/plans") {
        return jsonResponse(200, {
          plans: [],
          checkout: {
            enabled: false,
            message: "Live paid checkout is coming soon. No real payment is collected yet.",
          },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: /Plans for creators and institutions/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No real payment is collected yet.");
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
    expect(screen.getByText("Institution")).toBeInTheDocument();
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
      shortUrl: "https://shotlink.in/keyboard-link",
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
          checkout: { enabled: true, message: "Secure Razorpay checkout is available." },
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
    const destination = within(builderPanel).getByLabelText("Campaign destination");
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
        return jsonResponse(200, {
          plans: [],
          checkout: { enabled: true, message: "Secure Razorpay checkout is available." },
        });
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
          checkout: { enabled: true, message: "Secure Razorpay checkout is available." },
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

    await user.click(
      within(billingPanel).getByRole("button", { name: "Upgrade to Creator Pro" })
    );

    expect(await within(billingPanel).findByRole("alert")).toHaveTextContent(
      "You do not have permission to perform this workspace action"
    );
    expect(within(builderPanel).queryByRole("alert")).not.toBeInTheDocument();
  });

  test("verifies a pending Razorpay subscription before refreshing billing", async () => {
    const user = userEvent.setup();
    const pendingBilling = {
      ...sessionPayload.workspace.billing,
      billingStatus: "pending",
      lastPaymentReference: "SUB-TEST",
    };
    const activeBilling = {
      ...pendingBilling,
      configuredPlanId: "pro",
      effectivePlanId: "pro",
      effectivePlanName: "Creator Pro",
      billingStatus: "active",
      currentPeriodEndsAt: "2026-08-23T00:00:00.000Z",
      linkLimit: 500,
      domainLimit: 1,
    };
    const pendingSession = {
      ...sessionPayload,
      workspace: {
        ...sessionPayload.workspace,
        billing: pendingBilling,
      },
    };
    let providerSynced = false;

    fetch.mockImplementation(async (input, options = {}) => {
      const path = getRequestPath(input);
      const method = options.method || "GET";

      if (path === "/api/v1/auth/me") return jsonResponse(200, pendingSession);
      if (path === "/api/v1/billing/plans") return jsonResponse(200, { plans: [] });
      if (path === "/api/v1/links") return jsonResponse(200, { links: [] });
      if (path === "/api/v1/billing/subscriptions/sync" && method === "POST") {
        const headers = new Headers(options.headers);
        expect(options.credentials).toBe("include");
        expect(headers.get("X-CSRF-Token")).toBe(sessionPayload.csrfToken);
        providerSynced = true;
        return jsonResponse(200, {
          synced: true,
          providerStatus: "active",
          message: "Payment verified with Razorpay and the paid plan is now active.",
        });
      }
      if (path === "/api/v1/billing/summary") {
        return jsonResponse(200, {
          currentPlan: providerSynced ? activeBilling : pendingBilling,
          plans: [],
          recentPayments: [],
        });
      }

      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Test Workspace" })).toBeInTheDocument();

    const billingPanel = document.querySelector("#billing-panel");
    const verifyButton = await within(billingPanel).findByRole("button", {
      name: "Verify payment",
    });
    await user.click(verifyButton);

    expect(
      await within(billingPanel).findByText(
        "Payment verified with Razorpay and the paid plan is now active."
      )
    ).toBeInTheDocument();
    expect(
      within(billingPanel).getByRole("heading", { name: "Creator Pro" })
    ).toBeInTheDocument();
    expect(
      within(billingPanel).getByRole("button", { name: "Refresh billing" })
    ).toBeInTheDocument();
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

    expect(
      await screen.findByRole("heading", {
        name: /One link platform\./,
      })
    ).toBeInTheDocument();
  });
});
