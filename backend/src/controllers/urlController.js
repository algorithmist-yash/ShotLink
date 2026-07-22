const {
  enqueueRedirectEvent,
  redirectEventWorker,
} = require("../services/redirectEventService");
const {
  getRedirectEntitlement,
  resolveUrlForRequest,
} = require("../services/redirectResolutionService");
const { buildClickContext } = require("../utils/deviceInfo");
const { renderUnavailablePage } = require("../utils/failoverPage");
const {
  getDestinationSummaries,
  needsHealthRefresh,
  selectRedirectTarget,
} = require("../services/healthService");

function buildRedirectEvent(
  url,
  shortCode,
  clickContext,
  target,
  redirectStatus,
  healthRefreshRequested = false,
  analyticsRetentionDays = 90
) {
  return {
    urlId: url._id,
    workspaceId: url.workspaceId || null,
    shortCode,
    ...clickContext,
    redirectTarget: target?.url || "",
    redirectTargetKind: target?.kind || "none",
    redirectStatus,
    healthRefreshRequested,
    analyticsRetentionDays,
  };
}

exports.redirectToOriginal = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const url = await resolveUrlForRequest(req, shortCode);

    if (!url) {
      return res.status(404).send("Short URL not found");
    }

    if (!url.isActive || url.expiresAt < new Date()) {
      return res.status(410).send("This link has expired");
    }

    let analyticsRetentionDays = 90;
    if (url.workspaceId) {
      const entitlement = await getRedirectEntitlement(url.workspaceId);
      if (entitlement) {
        analyticsRetentionDays = entitlement.plan.analyticsRetentionDays || 90;
        if ((entitlement.usage?.clicks || 0) >= entitlement.plan.clickLimit) {
          return res
            .status(402)
            .send(
              `This workspace has reached the ${entitlement.plan.name} monthly click limit`
            );
        }
      }
    }

    const shouldRefreshHealth = needsHealthRefresh(url);
    const selectedTarget = selectRedirectTarget(url);
    const clickContext = buildClickContext(req);

    if (!selectedTarget) {
      await enqueueRedirectEvent(
        buildRedirectEvent(
          url,
          shortCode,
          clickContext,
          null,
          502,
          shouldRefreshHealth,
          analyticsRetentionDays
        )
      );

      const response = res
        .status(502)
        .type("html")
        .send(
          renderUnavailablePage({
            shortCode,
            destinations: getDestinationSummaries(url),
          })
        );
      redirectEventWorker.wake();

      return response;
    }

    await enqueueRedirectEvent(
      buildRedirectEvent(
        url,
        shortCode,
        clickContext,
        selectedTarget,
        302,
        shouldRefreshHealth,
        analyticsRetentionDays
      )
    );

    const response = res.redirect(302, selectedTarget.url);
    redirectEventWorker.wake();

    return response;
  } catch (error) {
    console.error(error);
    return res.status(500).send("Server error");
  }
};

exports.buildRedirectEvent = buildRedirectEvent;
