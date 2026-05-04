const express = require("express");

const {
  getCurrentSession,
  login,
  logout,
  register,
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");
const { authRateLimit } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.post("/register", authRateLimit, register);
router.post("/login", authRateLimit, login);
router.get("/me", requireAuth, getCurrentSession);
router.post("/logout", requireAuth, logout);

module.exports = router;
