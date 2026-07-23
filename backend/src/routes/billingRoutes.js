const express = require("express");

const {
  createPaymentLink,
  createSubscription,
  cancelSubscription,
  getBillingSummary,
  getPublicPlans,
  handleRazorpayWebhook,
  syncSubscription,
} = require("../controllers/billingController");
const {
  requireAuth,
  requireWorkspaceOwner,
} = require("../middleware/authMiddleware");
const { writeRateLimit } = require("../middleware/rateLimitMiddleware");
const { validateRequestBody } = require("../middleware/requestContractMiddleware");
const {
  cancelSubscriptionContract,
  planContract,
} = require("../contracts/apiContracts");

const router = express.Router();

router.get("/plans", getPublicPlans);
router.post("/webhooks/razorpay", handleRazorpayWebhook);
router.use(requireAuth);
router.get("/summary", getBillingSummary);
router.post(
  "/payment-links",
  requireWorkspaceOwner,
  writeRateLimit,
  validateRequestBody(planContract),
  createPaymentLink
);
router.post(
  "/subscriptions",
  requireWorkspaceOwner,
  writeRateLimit,
  validateRequestBody(planContract),
  createSubscription
);
router.post(
  "/subscriptions/cancel",
  requireWorkspaceOwner,
  writeRateLimit,
  validateRequestBody(cancelSubscriptionContract, { allowEmpty: true }),
  cancelSubscription
);
router.post(
  "/subscriptions/sync",
  requireWorkspaceOwner,
  writeRateLimit,
  validateRequestBody(cancelSubscriptionContract, { allowEmpty: true }),
  syncSubscription
);

module.exports = router;
