const express = require("express");

const {
  createLink,
  expireLink,
  getClickEvents,
  getLinkAnalytics,
  listLinks,
  refreshLinkHealth,
} = require("../controllers/linkController");
const { requireAuth } = require("../middleware/authMiddleware");
const { writeRateLimit } = require("../middleware/rateLimitMiddleware");
const { validateRequestBody } = require("../middleware/requestContractMiddleware");
const { createLinkContract } = require("../contracts/apiContracts");

const router = express.Router();

router.use(requireAuth);

router.get("/", listLinks);
router.post("/", writeRateLimit, validateRequestBody(createLinkContract), createLink);
router.get("/:shortCode/analytics", getLinkAnalytics);
router.get("/:shortCode/events", getClickEvents);
router.patch("/:shortCode/expire", writeRateLimit, expireLink);
router.post("/:shortCode/health-check", writeRateLimit, refreshLinkHealth);

module.exports = router;
