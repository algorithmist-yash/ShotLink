const express = require("express");

const {
  addCustomDomain,
  getWorkspaceSettings,
  listAuditEvents,
  removeCustomDomain,
  setPrimaryCustomDomain,
  verifyCustomDomain,
} = require("../controllers/workspaceController");
const {
  requireAuth,
  requireWorkspaceAdmin,
} = require("../middleware/authMiddleware");
const { writeRateLimit } = require("../middleware/rateLimitMiddleware");
const { validateRequestBody } = require("../middleware/requestContractMiddleware");
const { customDomainContract } = require("../contracts/apiContracts");

const router = express.Router();

router.use(requireAuth);

router.get("/", getWorkspaceSettings);
router.get("/audit-events", requireWorkspaceAdmin, listAuditEvents);
router.post(
  "/domains",
  requireWorkspaceAdmin,
  writeRateLimit,
  validateRequestBody(customDomainContract),
  addCustomDomain
);
router.post(
  "/domains/:hostname/verify",
  requireWorkspaceAdmin,
  writeRateLimit,
  verifyCustomDomain
);
router.patch(
  "/domains/:hostname/primary",
  requireWorkspaceAdmin,
  writeRateLimit,
  setPrimaryCustomDomain
);
router.delete(
  "/domains/:hostname",
  requireWorkspaceAdmin,
  writeRateLimit,
  removeCustomDomain
);

module.exports = router;
