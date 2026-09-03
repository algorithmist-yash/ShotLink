const { nanoid } = require("nanoid");

const Session = require("../models/Session");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { serializeBillingSnapshot } = require("../config/billingPlans");
const { extractClientIp, hashIp } = require("../utils/deviceInfo");
const {
  ACCOUNT_POLICY_VERSION,
  buildAccountComplianceRecord,
  validateAccountConsents,
} = require("../utils/consentUtils");
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
const { recordAuditEvent } = require("../services/auditLogService");
const emailService = require("../services/emailService");
const { getDefaultCnameTarget, getTxtRecordName } = require("../utils/domainUtils");
const {
  getEmailDomain,
  getInstitutionTxtRecordName,
} = require("../utils/institutionDomainUtils");
const {
  clearSessionCookie,
  deriveCsrfToken,
  getSessionCookieToken,
  setSessionCookie,
} = require("../utils/sessionCookieUtils");

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

function createActionToken(ttlMs) {
  const token = generateSessionToken();
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  };
}

function logAuthFailure(event, error) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event,
      error: error.message,
    })
  );
}

async function generateWorkspaceSlug(name) {
  const baseSlug = slugifyWorkspaceName(name);
  let slug = baseSlug;

  while (await Workspace.exists({ slug })) {
    slug = `${baseSlug}-${nanoid(4).toLowerCase()}`;
  }

  return slug;
}

async function issueSession(req, res, user, workspace) {
  const previousToken = getSessionCookieToken(req);
  if (previousToken) {
    await Session.deleteOne({ tokenHash: hashSessionToken(previousToken) });
  }

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

  setSessionCookie(res, token, expiresAt);

  return { token, expiresAt, csrfToken: deriveCsrfToken(token) };
}

function serializeAuthPayload(user, workspace, sessionDetails) {
  const customDomains = (workspace.customDomains || []).map((domain) => ({
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
  const managedEmailDomains = (workspace.managedEmailDomains || []).map((domain) => ({
    hostname: domain.hostname,
    status: domain.status,
    verificationToken: domain.verificationToken,
    verifiedAt: domain.verifiedAt,
    lastCheckedAt: domain.lastCheckedAt,
    lastVerificationError: domain.lastVerificationError || "",
    dns: {
      txtName: getInstitutionTxtRecordName(domain.hostname),
      txtValue: domain.verificationToken,
    },
  }));

  const response = {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt || null,
      emailVerificationSentAt: user.emailVerificationSentAt || null,
      defaultWorkspaceId: user.defaultWorkspaceId,
      compliance: {
        policyVersion: user.compliance?.policyVersion || "",
        termsAcceptedAt: user.compliance?.termsAcceptedAt || null,
        privacyAcceptedAt: user.compliance?.privacyAcceptedAt || null,
        analyticsAcceptedAt: user.compliance?.analyticsAcceptedAt || null,
        lawfulUseAcceptedAt: user.compliance?.lawfulUseAcceptedAt || null,
        ageConfirmedAt: user.compliance?.ageConfirmedAt || null,
        marketingOptIn: Boolean(user.compliance?.marketingOptIn),
      },
    },
    workspace: {
      id: workspace._id,
      name: workspace.name,
      slug: workspace.slug,
      workspaceType: workspace.workspaceType || "creator",
      plan: workspace.plan,
      memberCount: workspace.members.length,
      billing: serializeBillingSnapshot(workspace),
      customDomains,
      managedEmailDomains,
      domainSetup: {
        cnameTarget: getDefaultCnameTarget(),
        txtPrefix: "_shotlink",
      },
      institutionDomainSetup: {
        txtPrefix: "_shotlink-access",
      },
    },
  };

  if (sessionDetails) {
    if (sessionDetails.token) response.token = sessionDetails.token;
    if (sessionDetails.expiresAt) {
      response.sessionExpiresAt = sessionDetails.expiresAt;
    }
    if (sessionDetails.csrfToken) response.csrfToken = sessionDetails.csrfToken;
  }

  return response;
}

exports.register = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const workspaceName = String(req.body.workspaceName || `${name}'s workspace`).trim();
    const workspaceType = String(req.body.workspaceType || "creator").trim().toLowerCase();

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "A valid email address is required" });
    }

    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters and include uppercase, lowercase, and a number",
      });
    }

    if (!["creator", "institution"].includes(workspaceType)) {
      return res.status(400).json({ error: "Choose a creator or institution workspace" });
    }

    const consentValidation = validateAccountConsents(req.body);
    if (!consentValidation.ok) {
      return res.status(400).json({
        error:
          "Please accept the required Terms, Privacy Notice, analytics notice, lawful-use policy, and age confirmation before creating an account.",
        missingConsents: consentValidation.missing,
        policyVersion: ACCOUNT_POLICY_VERSION,
      });
    }

    const existingUser = await User.exists({ email });
    if (existingUser) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }

    const emailDomain = getEmailDomain(email);
    const managedWorkspace = emailDomain
      ? await Workspace.findOne({
          managedEmailDomains: {
            $elemMatch: { hostname: emailDomain, status: "verified" },
          },
        })
          .select("name slug")
          .lean()
      : null;

    if (managedWorkspace) {
      return res.status(409).json({
        code: "INSTITUTION_DOMAIN_MANAGED",
        error: `${emailDomain} is governed by ${managedWorkspace.name}. Ask your institution administrator to provision access instead of creating a separate workspace.`,
        workspaceName: managedWorkspace.name,
      });
    }

    const verification = createActionToken(EMAIL_VERIFICATION_TTL_MS);
    const user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      emailVerificationTokenHash: verification.tokenHash,
      emailVerificationExpiresAt: verification.expiresAt,
      emailVerificationSentAt: new Date(),
      compliance: buildAccountComplianceRecord(req, consentValidation.consents),
    });

    const workspace = await Workspace.create({
      name: workspaceName || `${name}'s workspace`,
      slug: await generateWorkspaceSlug(workspaceName || `${name}'s workspace`),
      ownerId: user._id,
      workspaceType,
      members: [{ userId: user._id, role: "owner" }],
    });

    user.defaultWorkspaceId = workspace._id;
    await user.save();

    const sessionDetails = await issueSession(req, res, user, workspace);

    await recordAuditEvent(req, {
      action: "account.registered",
      targetType: "user",
      targetId: user._id,
      workspaceId: workspace._id,
      actorUserId: user._id,
      metadata: { emailDomain: email.split("@")[1] || "", workspaceType },
    });

    try {
      await emailService.sendEmailVerification({
        user,
        token: verification.token,
        tokenHash: verification.tokenHash,
      });
    } catch (error) {
      logAuthFailure("email_verification_delivery_failed", error);
    }

    return res.status(201).json(serializeAuthPayload(user, workspace, sessionDetails));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.requestPasswordReset = async (req, res) => {
  const genericResponse = {
    message: "If that address has an active Shotlink account, a password-reset link has been sent.",
  };

  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(202).json(genericResponse);
    }

    const reset = createActionToken(PASSWORD_RESET_TTL_MS);
    const requestedAt = new Date();
    const cooldownCutoff = new Date(requestedAt.getTime() - EMAIL_RESEND_COOLDOWN_MS);
    const user = await User.findOneAndUpdate(
      {
        email,
        isActive: true,
        $or: [
          { passwordResetRequestedAt: null },
          { passwordResetRequestedAt: { $lte: cooldownCutoff } },
        ],
      },
      {
        $set: {
          passwordResetTokenHash: reset.tokenHash,
          passwordResetExpiresAt: reset.expiresAt,
          passwordResetRequestedAt: requestedAt,
        },
      },
      { returnDocument: "after" }
    );
    if (!user) {
      return res.status(202).json(genericResponse);
    }

    try {
      await emailService.sendPasswordResetEmail({
        user,
        token: reset.token,
        tokenHash: reset.tokenHash,
      });
    } catch (error) {
      logAuthFailure("password_reset_delivery_failed", error);
    }

    return res.status(202).json(genericResponse);
  } catch (error) {
    console.error(error);
    return res.status(202).json(genericResponse);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "");

    if (!token || !isStrongEnoughPassword(password)) {
      return res.status(400).json({
        error:
          "Use a valid reset link and a password with at least 8 characters, uppercase, lowercase, and a number.",
      });
    }

    const passwordHash = await hashPassword(password);
    const passwordChangedAt = new Date();
    const user = await User.findOneAndUpdate(
      {
        passwordResetTokenHash: hashSessionToken(token),
        passwordResetExpiresAt: { $gt: passwordChangedAt },
        isActive: true,
      },
      {
        $set: {
          passwordHash,
          passwordResetTokenHash: "",
          passwordResetExpiresAt: null,
          passwordResetRequestedAt: null,
          passwordChangedAt,
        },
      },
      { returnDocument: "after" }
    );

    if (!user) {
      return res.status(400).json({ error: "This password-reset link is invalid or has expired." });
    }

    try {
      await Session.deleteMany({ userId: user._id });
    } catch (error) {
      // passwordChangedAt still invalidates older sessions on their next request.
      logAuthFailure("password_reset_session_cleanup_failed", error);
    }

    await recordAuditEvent(req, {
      action: "account.password_reset",
      targetType: "user",
      targetId: user._id,
      workspaceId: user.defaultWorkspaceId,
      actorUserId: user._id,
    });

    clearSessionCookie(res);
    return res.json({ message: "Password updated. Sign in again on each device." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not reset the password. Please try again." });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Email verification link is invalid or has expired." });
    }

    const emailVerifiedAt = new Date();
    const user = await User.findOneAndUpdate(
      {
        emailVerificationTokenHash: hashSessionToken(token),
        emailVerificationExpiresAt: { $gt: emailVerifiedAt },
        isActive: true,
      },
      {
        $set: {
          emailVerifiedAt,
          emailVerificationTokenHash: "",
          emailVerificationExpiresAt: null,
        },
      },
      { returnDocument: "after" }
    );

    if (!user) {
      return res.status(400).json({ error: "Email verification link is invalid or has expired." });
    }

    await recordAuditEvent(req, {
      action: "account.email_verified",
      targetType: "user",
      targetId: user._id,
      workspaceId: user.defaultWorkspaceId,
      actorUserId: user._id,
    });

    return res.json({
      message: "Email verified. Your Shotlink account is ready.",
      emailVerifiedAt: user.emailVerifiedAt,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not verify the email. Please try again." });
  }
};

exports.resendEmailVerification = async (req, res) => {
  const genericResponse = {
    message: "If that address still needs verification, a new link has been sent.",
  };

  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(202).json(genericResponse);
    }

    const verification = createActionToken(EMAIL_VERIFICATION_TTL_MS);
    const sentAt = new Date();
    const cooldownCutoff = new Date(sentAt.getTime() - EMAIL_RESEND_COOLDOWN_MS);
    const user = await User.findOneAndUpdate(
      {
        email,
        isActive: true,
        emailVerifiedAt: null,
        $or: [
          { emailVerificationSentAt: null },
          { emailVerificationSentAt: { $lte: cooldownCutoff } },
        ],
      },
      {
        $set: {
          emailVerificationTokenHash: verification.tokenHash,
          emailVerificationExpiresAt: verification.expiresAt,
          emailVerificationSentAt: sentAt,
        },
      },
      { returnDocument: "after" }
    );
    if (!user) {
      return res.status(202).json(genericResponse);
    }

    try {
      await emailService.sendEmailVerification({
        user,
        token: verification.token,
        tokenHash: verification.tokenHash,
      });
    } catch (error) {
      logAuthFailure("email_verification_delivery_failed", error);
    }

    return res.status(202).json(genericResponse);
  } catch (error) {
    console.error(error);
    return res.status(202).json(genericResponse);
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
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
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

    const sessionDetails = await issueSession(req, res, user, workspace);

    await recordAuditEvent(req, {
      action: "session.login",
      targetType: "user",
      targetId: user._id,
      workspaceId: workspace._id,
      actorUserId: user._id,
    });

    return res.json(serializeAuthPayload(user, workspace, sessionDetails));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getCurrentSession = async (req, res) => {
  return res.json(
    serializeAuthPayload(req.auth.user, req.auth.workspace, {
      csrfToken: req.auth.csrfToken,
      expiresAt: req.auth.session.expiresAt,
    })
  );
};

exports.logout = async (req, res) => {
  try {
    await recordAuditEvent(req, {
      action: "session.logout",
      targetType: "session",
      targetId: req.auth.session._id,
    });
    await Session.deleteOne({ _id: req.auth.session._id });
    clearSessionCookie(res);
    return res.json({ message: "Logged out" });
  } catch (error) {
    clearSessionCookie(res);
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};
