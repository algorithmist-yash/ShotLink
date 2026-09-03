const RESEND_API_URL = "https://api.resend.com/emails";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildActionUrl(pathname, token, env = process.env) {
  const appBaseUrl = String(env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
  const url = new URL(pathname, `${appBaseUrl}/`);
  // Keep bearer action tokens out of HTTP request URLs and provider access logs.
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

function renderEmail({ eyebrow, title, body, actionLabel, actionUrl, footer }) {
  const safeActionUrl = escapeHtml(actionUrl);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f4ef;color:#0d0f14;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f5f4ef">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d9d8d2;border-radius:20px;padding:32px">
          <tr><td>
            <p style="margin:0 0 14px;color:#3157ff;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${escapeHtml(eyebrow)}</p>
            <h1 style="margin:0 0 18px;font-size:30px;line-height:1.15">${escapeHtml(title)}</h1>
            <p style="margin:0 0 24px;color:#50525a;font-size:16px;line-height:1.6">${escapeHtml(body)}</p>
            <a href="${safeActionUrl}" style="display:inline-block;background:#c8ff44;color:#090b0f;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">${escapeHtml(actionLabel)}</a>
            <p style="margin:24px 0 8px;color:#696b73;font-size:13px;line-height:1.5">If the button does not work, copy this address:</p>
            <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.5"><a href="${safeActionUrl}" style="color:#3157ff">${safeActionUrl}</a></p>
            <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #ecebe6;color:#777982;font-size:12px;line-height:1.5">${escapeHtml(footer)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendTransactionalEmail(
  { to, subject, html, text, idempotencyKey },
  { env = process.env, fetchImpl = global.fetch } = {}
) {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    if (env.NODE_ENV === "production") {
      throw new Error("Transactional email is not configured");
    }
    return { delivered: false, skipped: true };
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("Transactional email transport is unavailable");
  }

  const response = await fetchImpl(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "User-Agent": "shotlink-backend/1.0",
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM || "Shotlink <support@shotlink.in>",
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Transactional email provider returned ${response.status}`);
  }

  const data = await response.json();
  return { delivered: true, id: data.id || "" };
}

async function sendEmailVerification({ user, token, tokenHash }, options = {}) {
  const env = options.env || process.env;
  const actionUrl = buildActionUrl("/verify-email", token, env);
  const name = String(user.name || "there").trim();

  return sendTransactionalEmail(
    {
      to: user.email,
      subject: "Verify your Shotlink email",
      text: `Hi ${name}, verify your Shotlink email within 24 hours: ${actionUrl}`,
      html: renderEmail({
        eyebrow: "Shotlink account",
        title: `Verify your email, ${name}`,
        body: "Confirm this address belongs to you. This verification link expires in 24 hours and can be used once.",
        actionLabel: "Verify email",
        actionUrl,
        footer: "If you did not create or use a Shotlink account, you can safely ignore this message.",
      }),
      idempotencyKey: `verify-${user._id}-${String(tokenHash).slice(0, 24)}`,
    },
    options
  );
}

async function sendPasswordResetEmail({ user, token, tokenHash }, options = {}) {
  const env = options.env || process.env;
  const actionUrl = buildActionUrl("/reset-password", token, env);
  const name = String(user.name || "there").trim();

  return sendTransactionalEmail(
    {
      to: user.email,
      subject: "Reset your Shotlink password",
      text: `Hi ${name}, reset your Shotlink password within 1 hour: ${actionUrl}`,
      html: renderEmail({
        eyebrow: "Shotlink security",
        title: "Reset your password",
        body: "Use this single-use link to choose a new password. It expires in one hour and all existing sessions will be signed out after the reset.",
        actionLabel: "Reset password",
        actionUrl,
        footer: "If you did not request a password reset, do not use this link. Your password has not changed.",
      }),
      idempotencyKey: `reset-${user._id}-${String(tokenHash).slice(0, 24)}`,
    },
    options
  );
}

module.exports = {
  RESEND_API_URL,
  buildActionUrl,
  escapeHtml,
  sendEmailVerification,
  sendPasswordResetEmail,
  sendTransactionalEmail,
};
