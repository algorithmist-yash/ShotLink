const express = require("express");

const {
  createPaymentLink,
  getBillingSummary,
  getPublicPlans,
  handleRazorpayWebhook,
} = require("../controllers/billingController");
const { requireAuth } = require("../middleware/authMiddleware");
const { writeRateLimit } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.get("/plans", getPublicPlans);
router.post("/webhooks/razorpay", handleRazorpayWebhook);
router.use(requireAuth);
router.get("/summary", getBillingSummary);
router.post("/payment-links", writeRateLimit, createPaymentLink);

module.exports = router;
