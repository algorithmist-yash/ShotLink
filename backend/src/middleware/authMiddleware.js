const Session = require("../models/Session");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { hashSessionToken } = require("../utils/authUtils");
const {
  deriveCsrfToken,
  getSessionCookieToken,
  isCsrfTokenValid,
  requiresCsrfProtection,
} = require("../utils/sessionCookieUtils");

const WORKSPACE_ROLES = Object.freeze(["owner", "admin", "member"]);

function idsMatch(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

function getWorkspaceRole(workspace, userId) {
  if (!workspace || !userId) {
    return "";
  }

  // ownerId is authoritative so legacy owners without a members entry keep access,
  // while an inconsistent members entry cannot grant owner privileges.
  if (idsMatch(workspace.ownerId, userId)) {
    return "owner";
  }

  const membership = (workspace.members || []).find((member) =>
    idsMatch(member.userId, userId)
  );

  if (!membership || membership.role === "owner") {
    return "";
  }

  return WORKSPACE_ROLES.includes(membership.role) ? membership.role : "";
}

function getBearerToken(req) {
  const authorization = req.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

function getAuthCredentials(req) {
  const bearerToken = getBearerToken(req);
  if (bearerToken) {
    return { source: "bearer", token: bearerToken };
  }

  const cookieToken = getSessionCookieToken(req);
  return cookieToken
    ? { source: "cookie", token: cookieToken }
    : { source: "", token: "" };
}

async function requireAuth(req, res, next) {
  try {
    const credentials = getAuthCredentials(req);
    const { token } = credentials;

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

    const csrfToken =
      credentials.source === "cookie" ? deriveCsrfToken(token) : "";

    if (
      credentials.source === "cookie" &&
      requiresCsrfProtection(req.method) &&
      !isCsrfTokenValid(req.get("x-csrf-token"), csrfToken)
    ) {
      return res.status(403).json({ error: "Invalid or missing CSRF token" });
    }

    const [user, workspace] = await Promise.all([
      User.findById(session.userId),
      Workspace.findById(session.workspaceId),
    ]);

    if (!user || !workspace || !user.isActive) {
      return res.status(401).json({ error: "Account is unavailable" });
    }

    const workspaceRole = getWorkspaceRole(workspace, user._id);

    if (!workspaceRole) {
      await Session.deleteOne({ _id: session._id });
      return res.status(403).json({ error: "Workspace access denied" });
    }

    req.auth = {
      token,
      authMethod: credentials.source,
      csrfToken,
      session,
      user,
      workspace,
      workspaceRole,
    };

    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
}

function requireWorkspaceRole(...allowedRoles) {
  if (
    allowedRoles.length === 0 ||
    allowedRoles.some((role) => !WORKSPACE_ROLES.includes(role))
  ) {
    throw new Error("At least one valid workspace role is required");
  }

  const allowedRoleSet = new Set(allowedRoles);

  return function authorizeWorkspaceRole(req, res, next) {
    if (!allowedRoleSet.has(req.auth?.workspaceRole)) {
      return res.status(403).json({
        error: "You do not have permission to perform this workspace action",
      });
    }

    return next();
  };
}

const requireWorkspaceOwner = requireWorkspaceRole("owner");
const requireWorkspaceAdmin = requireWorkspaceRole("owner", "admin");

module.exports = {
  getAuthCredentials,
  getWorkspaceRole,
  requireAuth,
  requireWorkspaceAdmin,
  requireWorkspaceOwner,
  requireWorkspaceRole,
};
