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
  requireVerifiedEmail,
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
  requireVerifiedEmail,
  writeRateLimit,
  validateRequestBody(customDomainContract),
  addCustomDomain
);
router.post(
  "/domains/:hostname/verify",
  requireWorkspaceAdmin,
  requireVerifiedEmail,
  writeRateLimit,
  verifyCustomDomain
);
router.patch(
  "/domains/:hostname/primary",
  requireWorkspaceAdmin,
  requireVerifiedEmail,
  writeRateLimit,
  setPrimaryCustomDomain
);
router.delete(
  "/domains/:hostname",
  requireWorkspaceAdmin,
  requireVerifiedEmail,
  writeRateLimit,
  removeCustomDomain
);
router.post(
  "/email-domains",
  requireWorkspaceAdmin,
  requireVerifiedEmail,
  writeRateLimit,
  validateRequestBody(customDomainContract),
  addManagedEmailDomain
);
router.post(
  "/email-domains/:hostname/verify",
  requireWorkspaceAdmin,
  requireVerifiedEmail,
  writeRateLimit,
  verifyManagedEmailDomain
);
router.delete(
  "/email-domains/:hostname",
  requireWorkspaceAdmin,
  requireVerifiedEmail,
  writeRateLimit,
  removeManagedEmailDomain
);

module.exports = router;
