const assert = require("node:assert/strict");
const test = require("node:test");

const {
  RESEND_API_URL,
  buildActionUrl,
  escapeHtml,
  sendEmailVerification,
  sendTransactionalEmail,
} = require("./emailService");

test("buildActionUrl keeps authentication tokens in the client-only URL fragment", () => {
  const url = new URL(
    buildActionUrl("/reset-password", "token with/symbols", {
      APP_BASE_URL: "https://www.shotlink.in/",
    })
  );

  assert.equal(url.origin, "https://www.shotlink.in");
  assert.equal(url.pathname, "/reset-password");
  assert.equal(url.search, "");
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("token"), "token with/symbols");
});

test("escapeHtml protects user-controlled email template content", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
});

test("transactional email is safely skipped in local development without a key", async () => {
  const result = await sendTransactionalEmail(
    {
      to: "owner@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
      idempotencyKey: "test-local",
    },
    { env: { NODE_ENV: "development" } }
  );

  assert.deepEqual(result, { delivered: false, skipped: true });
});

test("transactional email uses Resend HTTPS authentication and idempotency", async () => {
  let request = null;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      async json() {
        return { id: "email-1" };
      },
    };
  };

  const result = await sendEmailVerification(
    {
      user: {
        _id: "user-1",
        name: "Owner <script>",
        email: "owner@example.com",
      },
      token: "verification-token",
      tokenHash: "abcdef0123456789abcdef0123456789",
    },
    {
      fetchImpl,
      env: {
        NODE_ENV: "production",
        APP_BASE_URL: "https://www.shotlink.in",
        RESEND_API_KEY: "re_test_key",
        AUTH_EMAIL_FROM: "Shotlink <support@shotlink.in>",
      },
    }
  );

  assert.deepEqual(result, { delivered: true, id: "email-1" });
  assert.equal(request.url, RESEND_API_URL);
  assert.equal(request.options.headers.Authorization, "Bearer re_test_key");
  assert.match(request.options.headers["Idempotency-Key"], /^verify-user-1-/);
  assert.equal(request.options.headers["User-Agent"], "shotlink-backend/1.0");
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.to, ["owner@example.com"]);
  assert.equal(body.from, "Shotlink <support@shotlink.in>");
  assert.match(body.html, /Owner &lt;script&gt;/);
  assert.doesNotMatch(body.html, /Owner <script>/);
});

test("production email delivery fails closed without an API key", async () => {
  await assert.rejects(
    sendTransactionalEmail(
      {
        to: "owner@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
        idempotencyKey: "test-production",
      },
      { env: { NODE_ENV: "production" } }
    ),
    /not configured/
  );
});
