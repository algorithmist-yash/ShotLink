const Session = require("../models/Session");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { hashSessionToken } = require("../utils/authUtils");

function getBearerToken(req) {
  const authorization = req.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const session = await Session.findOne({
      tokenHash: hashSessionToken(token),
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    const [user, workspace] = await Promise.all([
      User.findById(session.userId),
      Workspace.findById(session.workspaceId),
    ]);

    if (!user || !workspace || !user.isActive) {
      return res.status(401).json({ error: "Account is unavailable" });
    }

    req.auth = {
      token,
      session,
      user,
      workspace,
    };

    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = { requireAuth };
