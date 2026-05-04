const { nanoid } = require("nanoid");

const Session = require("../models/Session");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { serializeBillingSnapshot } = require("../config/billingPlans");
const { extractClientIp, hashIp } = require("../utils/deviceInfo");
const {
  SESSION_TTL_DAYS,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isStrongEnoughPassword,
  isValidEmail,
  verifyPassword,
} = require("../utils/authUtils");
const { slugifyWorkspaceName } = require("../utils/slugUtils");
const { getDefaultCnameTarget, getTxtRecordName } = require("../utils/domainUtils");

async function generateWorkspaceSlug(name) {
  const baseSlug = slugifyWorkspaceName(name);
  let slug = baseSlug;

  while (await Workspace.exists({ slug })) {
    slug = `${baseSlug}-${nanoid(4).toLowerCase()}`;
  }

  return slug;
}

async function issueSession(req, user, workspace) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await Session.create({
    userId: user._id,
    workspaceId: workspace._id,
    tokenHash: hashSessionToken(token),
    userAgent: req.get("user-agent") || "",
    ipHash: hashIp(extractClientIp(req)),
    expiresAt,
  });

  return { token, expiresAt };
}

function serializeAuthPayload(user, workspace, sessionDetails) {
  const customDomains = workspace.customDomains.map((domain) => ({
    hostname: domain.hostname,
    status: domain.status,
    verificationToken: domain.verificationToken,
    isPrimary: Boolean(domain.isPrimary),
    verifiedAt: domain.verifiedAt,
    lastCheckedAt: domain.lastCheckedAt,
    lastVerificationError: domain.lastVerificationError || "",
    dns: {
      cnameTarget: getDefaultCnameTarget(),
      txtName: getTxtRecordName(domain.hostname),
      txtValue: domain.verificationToken,
    },
  }));

  const response = {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      defaultWorkspaceId: user.defaultWorkspaceId,
    },
    workspace: {
      id: workspace._id,
      name: workspace.name,
      slug: workspace.slug,
      plan: workspace.plan,
      memberCount: workspace.members.length,
      billing: serializeBillingSnapshot(workspace),
      customDomains,
      domainSetup: {
        cnameTarget: getDefaultCnameTarget(),
        txtPrefix: "_urlshortener",
      },
    },
  };

  if (sessionDetails) {
    response.token = sessionDetails.token;
    response.sessionExpiresAt = sessionDetails.expiresAt;
  }

  return response;
}

exports.register = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const workspaceName = String(req.body.workspaceName || `${name}'s workspace`).trim();

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "A valid email address is required" });
    }

    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existingUser = await User.exists({ email });
    if (existingUser) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: hashPassword(password),
    });

    const workspace = await Workspace.create({
      name: workspaceName || `${name}'s workspace`,
      slug: await generateWorkspaceSlug(workspaceName || `${name}'s workspace`),
      ownerId: user._id,
      members: [{ userId: user._id, role: "owner" }],
    });

    user.defaultWorkspaceId = workspace._id;
    await user.save();

    const sessionDetails = await issueSession(req, user, workspace);

    return res.status(201).json(serializeAuthPayload(user, workspace, sessionDetails));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const workspace =
      (user.defaultWorkspaceId && (await Workspace.findById(user.defaultWorkspaceId))) ||
      (await Workspace.findOne({ ownerId: user._id }).sort({ createdAt: 1 }));

    if (!workspace) {
      return res.status(500).json({ error: "Workspace not found for this account" });
    }

    user.defaultWorkspaceId = workspace._id;
    user.lastLoginAt = new Date();
    await user.save();

    const sessionDetails = await issueSession(req, user, workspace);

    return res.json(serializeAuthPayload(user, workspace, sessionDetails));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getCurrentSession = async (req, res) => {
  return res.json(serializeAuthPayload(req.auth.user, req.auth.workspace));
};

exports.logout = async (req, res) => {
  try {
    await Session.deleteOne({ _id: req.auth.session._id });
    return res.json({ message: "Logged out" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};
