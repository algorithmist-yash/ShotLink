const { nanoid } = require("nanoid");

const { resolveEffectivePlan } = require("../config/billingPlans");
const ClickEvent = require("../models/ClickEvent");
const Url = require("../models/Url");
const {
  LINK_POLICY_VERSION,
  buildLinkComplianceRecord,
  validateLinkConsents,
} = require("../utils/consentUtils");
const { normalizeHostname } = require("../utils/domainUtils");
const { validateShortenPayload } = require("../utils/urlUtils");
const {
  needsHealthRefresh,
  refreshUrlHealth,
  selectRedirectTarget,
} = require("../services/healthService");
const { incrementUsage } = require("../services/usageService");

async function generateUniqueShortCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shortCode = nanoid(7);
    const existing = await Url.exists({ shortCode });
    if (!existing) return shortCode;
  }

  throw new Error("Unable to generate a unique short code");
}

function buildShortUrl(req, url) {
  if (url.customDomainHost) {
    return `https://${url.customDomainHost}/${url.shortCode}`;
  }

  const baseUrl =
    process.env.BASE_URL || `${req.protocol || "http"}://${req.get("host")}`;

  return `${baseUrl.replace(/\/$/, "")}/${url.shortCode}`;
}

function serializeLinkSummary(req, url) {
  return {
    id: url._id,
    shortCode: url.shortCode,
    shortUrl: buildShortUrl(req, url),
    customDomainHost: url.customDomainHost || "",
    originalUrl: url.originalUrl,
    clicks: url.clicks,
    createdAt: url.createdAt,
    expiresAt: url.expiresAt,
    isActive: url.isActive && url.expiresAt > new Date(),
    lastClickedAt: url.lastClickedAt,
    currentTarget: selectRedirectTarget(url),
    primaryHealth: url.primaryHealth,
    fallbackUrls: url.fallbackUrls,
  };
}

async function getOwnedLink(workspaceId, shortCode) {
  return Url.findOne({ workspaceId, shortCode });
}

async function buildAnalyticsPayload(req, url) {
  const [deviceBreakdown, recentEvents] = await Promise.all([
    ClickEvent.aggregate([
      { $match: { urlId: url._id } },
      { $group: { _id: "$deviceType", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]),
    ClickEvent.find({ urlId: url._id })
      .sort({ clickedAt: -1 })
      .limit(20)
      .select(
        "clickedAt deviceType browser os referrer redirectTarget redirectTargetKind redirectStatus"
      )
      .lean(),
  ]);

  return {
    ...serializeLinkSummary(req, url),
    deviceBreakdown: deviceBreakdown.map((item) => ({
      deviceType: item._id || "unknown",
      count: item.count,
    })),
    recentEvents,
  };
}

exports.listLinks = async (req, res) => {
  try {
    const urls = await Url.find({ workspaceId: req.auth.workspace._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      links: urls.map((url) => serializeLinkSummary(req, url)),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.createLink = async (req, res) => {
  try {
    const effectivePlan = resolveEffectivePlan(req.auth.workspace);
    const existingLinkCount = await Url.countDocuments({
      workspaceId: req.auth.workspace._id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (existingLinkCount >= effectivePlan.linkLimit) {
      return res.status(403).json({
        error: `Your ${effectivePlan.name} plan allows up to ${effectivePlan.linkLimit} active links. Expire unused links or upgrade billing to add more.`,
      });
    }

    const { errors, originalUrl, expiryMinutes, fallbackUrls, customAlias } = validateShortenPayload(
      req.body
    );

    if (errors.length) {
      return res.status(400).json({ error: errors.join(". ") });
    }

    const shortCode = customAlias || await generateUniqueShortCode();
    if (customAlias) {
      const existingAlias = await Url.exists({ shortCode: customAlias });
      if (existingAlias) {
        return res.status(409).json({ error: "That custom alias is already taken" });
      }
    }

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const customDomainHost = normalizeHostname(req.body.customDomainHost);
    const consentValidation = validateLinkConsents(req.body);

    if (!consentValidation.ok) {
      return res.status(400).json({
        error:
          "Please confirm you have authority to use this destination, consent to automated health checks, and accept the anti-abuse policy before creating the link.",
        missingConsents: consentValidation.missing,
        policyVersion: LINK_POLICY_VERSION,
      });
    }

    if (customDomainHost) {
      const matchingDomain = req.auth.workspace.customDomains.find(
        (domain) => domain.hostname === customDomainHost
      );

      if (!matchingDomain) {
        return res.status(400).json({ error: "Custom domain is not connected to this workspace" });
      }

      if (matchingDomain.status !== "verified") {
        return res.status(400).json({ error: "Verify this custom domain before creating links on it" });
      }
    }

    const url = await Url.create({
      workspaceId: req.auth.workspace._id,
      createdBy: req.auth.user._id,
      originalUrl,
      shortCode,
      customDomainHost,
      expiresAt,
      isActive: true,
      clicks: 0,
      fallbackUrls,
      compliance: buildLinkComplianceRecord(req, req.auth.user._id),
    });

    await refreshUrlHealth(url);
    await incrementUsage(req.auth.workspace._id, { linksCreated: 1 });

    return res.status(201).json({
      link: serializeLinkSummary(req, url),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getLinkAnalytics = async (req, res) => {
  try {
    const url = await getOwnedLink(req.auth.workspace._id, req.params.shortCode);

    if (!url) {
      return res.status(404).json({ error: "URL not found" });
    }

    if (needsHealthRefresh(url)) {
      await refreshUrlHealth(url);
    }

    return res.json(await buildAnalyticsPayload(req, url));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getClickEvents = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const url = await getOwnedLink(req.auth.workspace._id, req.params.shortCode);

    if (!url) {
      return res.status(404).json({ error: "URL not found" });
    }

    const events = await ClickEvent.find({ urlId: url._id })
      .sort({ clickedAt: -1 })
      .limit(limit)
      .select(
        "clickedAt deviceType browser os referrer redirectTarget redirectTargetKind redirectStatus"
      )
      .lean();

    return res.json({ events });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.expireLink = async (req, res) => {
  try {
    const url = await getOwnedLink(req.auth.workspace._id, req.params.shortCode);

    if (!url) {
      return res.status(404).json({ error: "URL not found" });
    }

    url.isActive = false;
    await url.save();

    return res.json({ message: "URL expired manually" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.refreshLinkHealth = async (req, res) => {
  try {
    const url = await getOwnedLink(req.auth.workspace._id, req.params.shortCode);

    if (!url) {
      return res.status(404).json({ error: "URL not found" });
    }

    await refreshUrlHealth(url);

    return res.json({
      link: serializeLinkSummary(req, url),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};
