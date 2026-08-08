const express = require("express");

const {
  addManagedEmailDomain,
  addCustomDomain,
  getWorkspaceSettings,
  listAuditEvents,
  removeManagedEmailDomain,
  removeCustomDomain,
  setPrimaryCustomDomain,
  verifyManagedEmailDomain,
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
router.post(
  "/email-domains",
  requireWorkspaceAdmin,
  writeRateLimit,
  validateRequestBody(customDomainContract),
  addManagedEmailDomain
);
router.post(
  "/email-domains/:hostname/verify",
  requireWorkspaceAdmin,
  writeRateLimit,
  verifyManagedEmailDomain
);
router.delete(
  "/email-domains/:hostname",
  requireWorkspaceAdmin,
  writeRateLimit,
  removeManagedEmailDomain
);

module.exports = router;
