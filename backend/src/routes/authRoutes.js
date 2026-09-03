const express = require("express");

const {
  getCurrentSession,
  login,
  logout,
  register,
  requestPasswordReset,
  resendEmailVerification,
  resetPassword,
  verifyEmail,
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");
const { authRateLimit } = require("../middleware/rateLimitMiddleware");
const { validateRequestBody } = require("../middleware/requestContractMiddleware");
const {
  emailActionContract,
  loginContract,
  registerContract,
  resetPasswordContract,
  tokenActionContract,
} = require("../contracts/apiContracts");

const router = express.Router();

router.post("/register", authRateLimit, validateRequestBody(registerContract), register);
router.post("/login", authRateLimit, validateRequestBody(loginContract), login);
router.post(
  "/forgot-password",
  authRateLimit,
  validateRequestBody(emailActionContract),
  requestPasswordReset
);
router.post(
  "/reset-password",
  authRateLimit,
  validateRequestBody(resetPasswordContract),
  resetPassword
);
router.post(
  "/verify-email",
  authRateLimit,
  validateRequestBody(tokenActionContract),
  verifyEmail
);
router.post(
  "/resend-verification",
  authRateLimit,
  validateRequestBody(emailActionContract),
  resendEmailVerification
);
router.get("/me", requireAuth, getCurrentSession);
router.post("/logout", requireAuth, logout);

module.exports = router;
