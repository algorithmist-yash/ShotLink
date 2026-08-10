const dns = require("node:dns").promises;
const { nanoid } = require("nanoid");

const { resolveEffectivePlan } = require("../config/billingPlans");
const Url = require("../models/Url");
const Workspace = require("../models/Workspace");
const { invalidateCustomDomain } = require("../services/cacheInvalidationService");
const AuditEvent = require("../models/AuditEvent");
const { recordAuditEvent } = require("../services/auditLogService");
const {
  getDefaultCnameTarget,
  getTxtRecordName,
  isValidCustomHostname,
  normalizeHostname,
} = require("../utils/domainUtils");
const {
  getInstitutionTxtRecordName,
  isInstitutionalEmailDomain,
} = require("../utils/institutionDomainUtils");

function serializeDomain(domain) {
  return {
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
  };
}

function serializeManagedEmailDomain(domain) {
  return {
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
  };
}

function serializeWorkspaceSettings(workspace) {
  return {
    workspace: {
      id: workspace._id,
      name: workspace.name,
      slug: workspace.slug,
      workspaceType: workspace.workspaceType || "creator",
      plan: workspace.plan,
      customDomains: workspace.customDomains.map(serializeDomain),
      managedEmailDomains: (workspace.managedEmailDomains || []).map(
        serializeManagedEmailDomain
      ),
      domainSetup: {
        cnameTarget: getDefaultCnameTarget(),
        txtPrefix: "_shotlink",
      },
      institutionDomainSetup: {
        txtPrefix: "_shotlink-access",
      },
    },
  };
}

async function hasTxtVerification(hostname, token) {
  const records = await dns.resolveTxt(getTxtRecordName(hostname));
  return records.flat().some((record) => String(record).trim() === token);
}

async function findWorkspaceByDomain(hostname) {
  return Workspace.findOne({ "customDomains.hostname": hostname });
}

async function hasInstitutionTxtVerification(hostname, token) {
  const records = await dns.resolveTxt(getInstitutionTxtRecordName(hostname));
  return records.flat().some((record) => String(record).trim() === token);
}

async function findWorkspaceByManagedEmailDomain(hostname) {
  return Workspace.findOne({ "managedEmailDomains.hostname": hostname });
}

exports.getWorkspaceSettings = async (req, res) => {
  return res.json(serializeWorkspaceSettings(req.auth.workspace));
};

exports.listAuditEvents = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const events = await AuditEvent.find({ workspaceId: req.auth.workspace._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "actorUserId action targetType targetId outcome requestId metadata createdAt expiresAt"
      )
      .lean();

    return res.json({ events });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.addCustomDomain = async (req, res) => {
  try {
    const effectivePlan = resolveEffectivePlan(req.auth.workspace);
    const domainLimit = effectivePlan.domainLimit || 0;
    const hostname = normalizeHostname(req.body.hostname);

    if (!isValidCustomHostname(hostname)) {
      return res.status(400).json({ error: "Enter a valid custom domain or subdomain" });
    }

    const existingDomains = req.auth.workspace.customDomains.filter(
      (domain) => domain.status !== "disabled"
    );
    if (existingDomains.length >= domainLimit) {
      return res.status(403).json({
        error: `Your ${effectivePlan.name} plan allows ${domainLimit} branded domains. Upgrade billing to add more.`,
      });
    }

    const existingWorkspace = await findWorkspaceByDomain(hostname);
    if (
      existingWorkspace &&
      String(existingWorkspace._id) !== String(req.auth.workspace._id)
    ) {
      return res.status(409).json({ error: "This domain is already connected to another workspace" });
    }

    const existingDomain = req.auth.workspace.customDomains.find(
      (domain) => domain.hostname === hostname
    );
    if (existingDomain) {
      return res.json(serializeWorkspaceSettings(req.auth.workspace));
    }

    req.auth.workspace.customDomains.push({
      hostname,
      status: "pending",
      verificationToken: `url-shortener-verify-${nanoid(24)}`,
      isPrimary: existingDomains.length === 0,
    });
    await req.auth.workspace.save();
    await invalidateCustomDomain(hostname);

    await recordAuditEvent(req, {
      action: "domain.added",
      targetType: "custom_domain",
      targetId: hostname,
    });

    return res.status(201).json(serializeWorkspaceSettings(req.auth.workspace));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.verifyCustomDomain = async (req, res) => {
  try {
    const hostname = normalizeHostname(req.params.hostname);
    const domain = req.auth.workspace.customDomains.find(
      (customDomain) => customDomain.hostname === hostname
    );

    if (!domain) {
      return res.status(404).json({ error: "Custom domain not found" });
    }

    domain.lastCheckedAt = new Date();

    try {
      const verified = await hasTxtVerification(hostname, domain.verificationToken);
      if (!verified) {
        domain.status = "pending";
        domain.lastVerificationError = "TXT record was not found yet";
        await req.auth.workspace.save();
        await invalidateCustomDomain(hostname);

        return res.status(400).json({
          error: `TXT record not found. Add ${getTxtRecordName(hostname)} with value ${domain.verificationToken}, wait for DNS, then verify again.`,
          workspace: serializeWorkspaceSettings(req.auth.workspace).workspace,
        });
      }

      domain.status = "verified";
      domain.verifiedAt = new Date();
      domain.lastVerificationError = "";
      await req.auth.workspace.save();
      await invalidateCustomDomain(hostname);

      await recordAuditEvent(req, {
        action: "domain.verified",
        targetType: "custom_domain",
        targetId: hostname,
      });

      return res.json(serializeWorkspaceSettings(req.auth.workspace));
    } catch (dnsError) {
      domain.status = "pending";
      domain.lastVerificationError = dnsError.code || "DNS lookup failed";
      await req.auth.workspace.save();
      await invalidateCustomDomain(hostname);

      return res.status(400).json({
        error: "DNS record is not visible yet. Wait a few minutes and verify again.",
        workspace: serializeWorkspaceSettings(req.auth.workspace).workspace,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.setPrimaryCustomDomain = async (req, res) => {
  try {
    const hostname = normalizeHostname(req.params.hostname);
    const domain = req.auth.workspace.customDomains.find(
      (customDomain) => customDomain.hostname === hostname
    );

    if (!domain) {
      return res.status(404).json({ error: "Custom domain not found" });
    }

    if (domain.status !== "verified") {
      return res.status(400).json({ error: "Verify this domain before making it primary" });
    }

    req.auth.workspace.customDomains.forEach((customDomain) => {
      customDomain.isPrimary = customDomain.hostname === hostname;
    });
    await req.auth.workspace.save();
    await invalidateCustomDomain(hostname);

    await recordAuditEvent(req, {
      action: "domain.primary_changed",
      targetType: "custom_domain",
      targetId: hostname,
    });

    return res.json(serializeWorkspaceSettings(req.auth.workspace));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.removeCustomDomain = async (req, res) => {
  try {
    const hostname = normalizeHostname(req.params.hostname);
    const linkedUrlCount = await Url.countDocuments({
      workspaceId: req.auth.workspace._id,
      customDomainHost: hostname,
    });

    if (linkedUrlCount > 0) {
      return res.status(409).json({
        error: "This domain has existing links. Keep it connected so customer links do not break.",
      });
    }

    req.auth.workspace.customDomains = req.auth.workspace.customDomains.filter(
      (domain) => domain.hostname !== hostname
    );
    if (
      req.auth.workspace.customDomains.length &&
      !req.auth.workspace.customDomains.some((domain) => domain.isPrimary)
    ) {
      req.auth.workspace.customDomains[0].isPrimary = true;
    }
    await req.auth.workspace.save();
    await invalidateCustomDomain(hostname);

    await recordAuditEvent(req, {
      action: "domain.removed",
      targetType: "custom_domain",
      targetId: hostname,
    });

    return res.json(serializeWorkspaceSettings(req.auth.workspace));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.addManagedEmailDomain = async (req, res) => {
  try {
    const effectivePlan = resolveEffectivePlan(req.auth.workspace);
    const hostname = normalizeHostname(req.body.hostname);

    if (effectivePlan.id !== "enterprise") {
      return res.status(403).json({
        error:
          "Institution email-domain governance is available on Enterprise workspaces. Contact sales to enable it.",
      });
    }

    if (!isInstitutionalEmailDomain(hostname)) {
      return res.status(400).json({
        error: "Enter an official institution domain, not a public email provider",
      });
    }

    const existingWorkspace = await findWorkspaceByManagedEmailDomain(hostname);
    if (
      existingWorkspace &&
      String(existingWorkspace._id) !== String(req.auth.workspace._id)
    ) {
      return res.status(409).json({
        error: "This institution email domain is already governed by another workspace",
      });
    }

    const existingDomain = (req.auth.workspace.managedEmailDomains || []).find(
      (domain) => domain.hostname === hostname
    );
    if (existingDomain) {
      return res.json(serializeWorkspaceSettings(req.auth.workspace));
    }

    req.auth.workspace.managedEmailDomains.push({
      hostname,
      status: "pending",
      verificationToken: `shotlink-org-verify-${nanoid(24)}`,
    });
    await req.auth.workspace.save();

    await recordAuditEvent(req, {
      action: "institution_domain.added",
      targetType: "managed_email_domain",
      targetId: hostname,
    });

    return res.status(201).json(serializeWorkspaceSettings(req.auth.workspace));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.verifyManagedEmailDomain = async (req, res) => {
  try {
    const hostname = normalizeHostname(req.params.hostname);
    const domain = (req.auth.workspace.managedEmailDomains || []).find(
      (managedDomain) => managedDomain.hostname === hostname
    );

    if (!domain) {
      return res.status(404).json({ error: "Institution email domain not found" });
    }

    domain.lastCheckedAt = new Date();

    try {
      const verified = await hasInstitutionTxtVerification(
        hostname,
        domain.verificationToken
      );
      if (!verified) {
        domain.status = "pending";
        domain.lastVerificationError = "Institution ownership TXT record was not found yet";
        await req.auth.workspace.save();
        return res.status(400).json({
          error: `TXT record not found. Add ${getInstitutionTxtRecordName(hostname)} with value ${domain.verificationToken}, wait for DNS, then verify again.`,
          workspace: serializeWorkspaceSettings(req.auth.workspace).workspace,
        });
      }

      domain.status = "verified";
      domain.verifiedAt = new Date();
      domain.lastVerificationError = "";
      await req.auth.workspace.save();

      await recordAuditEvent(req, {
        action: "institution_domain.verified",
        targetType: "managed_email_domain",
        targetId: hostname,
      });

      return res.json(serializeWorkspaceSettings(req.auth.workspace));
    } catch (dnsError) {
      domain.status = "pending";
      domain.lastVerificationError = dnsError.code || "DNS lookup failed";
      await req.auth.workspace.save();
      return res.status(400).json({
        error: "Institution ownership record is not visible yet. Wait for DNS, then verify again.",
        workspace: serializeWorkspaceSettings(req.auth.workspace).workspace,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.removeManagedEmailDomain = async (req, res) => {
  try {
    const hostname = normalizeHostname(req.params.hostname);
    const previousLength = (req.auth.workspace.managedEmailDomains || []).length;
    req.auth.workspace.managedEmailDomains = (
      req.auth.workspace.managedEmailDomains || []
    ).filter((domain) => domain.hostname !== hostname);

    if (req.auth.workspace.managedEmailDomains.length === previousLength) {
      return res.status(404).json({ error: "Institution email domain not found" });
    }

    await req.auth.workspace.save();
    await recordAuditEvent(req, {
      action: "institution_domain.removed",
      targetType: "managed_email_domain",
      targetId: hostname,
    });

    return res.json(serializeWorkspaceSettings(req.auth.workspace));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};
