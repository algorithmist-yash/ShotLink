const express = require("express");

const {
  getCurrentSession,
  login,
  logout,
  register,
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");
const { authRateLimit } = require("../middleware/rateLimitMiddleware");
const { validateRequestBody } = require("../middleware/requestContractMiddleware");
const { loginContract, registerContract } = require("../contracts/apiContracts");

const router = express.Router();

router.post("/register", authRateLimit, validateRequestBody(registerContract), register);
router.post("/login", authRateLimit, validateRequestBody(loginContract), login);
router.get("/me", requireAuth, getCurrentSession);
router.post("/logout", requireAuth, logout);

module.exports = router;
