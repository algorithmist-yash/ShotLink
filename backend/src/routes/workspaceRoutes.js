const express = require("express");

const {
  addCustomDomain,
  getWorkspaceSettings,
  removeCustomDomain,
  setPrimaryCustomDomain,
  verifyCustomDomain,
} = require("../controllers/workspaceController");
const { requireAuth } = require("../middleware/authMiddleware");
const { writeRateLimit } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", getWorkspaceSettings);
router.post("/domains", writeRateLimit, addCustomDomain);
router.post("/domains/:hostname/verify", writeRateLimit, verifyCustomDomain);
router.patch("/domains/:hostname/primary", writeRateLimit, setPrimaryCustomDomain);
router.delete("/domains/:hostname", writeRateLimit, removeCustomDomain);

module.exports = router;
