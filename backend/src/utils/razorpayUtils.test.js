const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  getRazorpayBasicAuthHeader,
  verifyRazorpayWebhookSignature,
} = require("./razorpayUtils");

test("getRazorpayBasicAuthHeader creates a valid Basic auth header", () => {
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;

  process.env.RAZORPAY_KEY_ID = "rzp_test_123";
  process.env.RAZORPAY_KEY_SECRET = "secret_456";

  const header = getRazorpayBasicAuthHeader();
  assert.equal(
    header,
    `Basic ${Buffer.from("rzp_test_123:secret_456").toString("base64")}`
  );

  process.env.RAZORPAY_KEY_ID = originalKeyId;
  process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
});

test("verifyRazorpayWebhookSignature accepts valid signatures", () => {
  const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";

  const body = Buffer.from(JSON.stringify({ event: "payment_link.paid" }));
  const signature = crypto
    .createHmac("sha256", "webhook-secret")
    .update(body)
    .digest("hex");

  assert.equal(verifyRazorpayWebhookSignature(body, signature), true);
  assert.equal(verifyRazorpayWebhookSignature(body, "invalid-signature"), false);

  process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
});
