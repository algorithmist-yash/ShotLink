const ClickEvent = require("../models/ClickEvent");
const Url = require("../models/Url");
const Workspace = require("../models/Workspace");
const { resolveEffectivePlan } = require("../config/billingPlans");
const { getCurrentUsageCounter, incrementUsage } = require("../services/usageService");
const { buildClickContext } = require("../utils/deviceInfo");
const {
  getHostnameFromUrl,
  getRequestHostname,
  isLocalHostname,
} = require("../utils/domainUtils");
const { renderUnavailablePage } = require("../utils/failoverPage");
const {
  getDestinationSummaries,
  needsHealthRefresh,
  refreshUrlHealth,
  selectRedirectTarget,
} = require("../services/healthService");

function isDefaultRedirectHost(hostname) {
  const baseHost = getHostnameFromUrl(process.env.BASE_URL || "");
  return !hostname || isLocalHostname(hostname) || hostname === baseHost;
}

async function findUrlForRequest(req, shortCode) {
  const requestHost = getRequestHostname(req);

  if (isDefaultRedirectHost(requestHost)) {
    return Url.findOne({ shortCode });
  }

  const workspace = await Workspace.findOne({
    customDomains: {
      $elemMatch: {
        hostname: requestHost,
        status: "verified",
      },
    },
  });

  if (!workspace) {
    return null;
  }

  return Url.findOne({
    shortCode,
    workspaceId: workspace._id,
    customDomainHost: requestHost,
  });
}

exports.redirectToOriginal = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const url = await findUrlForRequest(req, shortCode);

    if (!url) {
      return res.status(404).send("Short URL not found");
    }

    if (!url.isActive || url.expiresAt < new Date()) {
      return res.status(410).send("This link has expired");
    }

    if (url.workspaceId) {
      const workspace = await Workspace.findById(url.workspaceId);
      if (workspace) {
        const effectivePlan = resolveEffectivePlan(workspace);
        const usageCounter = await getCurrentUsageCounter(workspace._id);
        if ((usageCounter?.clicks || 0) >= effectivePlan.clickLimit) {
          return res
            .status(402)
            .send(`This workspace has reached the ${effectivePlan.name} monthly click limit`);
        }
      }
    }

    if (needsHealthRefresh(url)) {
      await refreshUrlHealth(url);
    }

    const selectedTarget = selectRedirectTarget(url);
    const clickContext = buildClickContext(req);

    if (!selectedTarget) {
      await ClickEvent.create({
        urlId: url._id,
        shortCode,
        ...clickContext,
        redirectTarget: "",
        redirectTargetKind: "none",
        redirectStatus: 502,
      });
      if (url.workspaceId) {
        await incrementUsage(url.workspaceId, { clicks: 1 });
      }

      return res
        .status(502)
        .type("html")
        .send(
          renderUnavailablePage({
            shortCode,
            destinations: getDestinationSummaries(url),
          })
        );
    }

    await Promise.all([
      ClickEvent.create({
        urlId: url._id,
        shortCode,
        ...clickContext,
        redirectTarget: selectedTarget.url,
        redirectTargetKind: selectedTarget.kind,
        redirectStatus: 302,
      }),
      Url.updateOne(
        { _id: url._id },
        {
          $inc: { clicks: 1 },
          $set: { lastClickedAt: new Date() },
        }
      ),
      url.workspaceId
        ? incrementUsage(url.workspaceId, { clicks: 1 })
        : Promise.resolve(),
    ]);

    return res.redirect(302, selectedTarget.url);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Server error");
  }
};
