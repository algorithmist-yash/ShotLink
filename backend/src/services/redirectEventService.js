const mongoose = require("mongoose");

const ClickEvent = require("../models/ClickEvent");
const RedirectEventJob = require("../models/RedirectEventJob");
const Url = require("../models/Url");
const UsageCounter = require("../models/UsageCounter");
const { invalidateUsageCounter } = require("./cacheInvalidationService");
const { createPollingWorker } = require("./pollingWorker");
const { enqueueUrlHealthRefresh } = require("./urlHealthQueueService");
const { getUsagePeriodKey } = require("./usageServiceHelpers");

const MAX_ATTEMPTS = 5;
const LEASE_MS = 30_000;
const COMPLETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DEAD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 60_000;
const DEFAULT_ANALYTICS_RETENTION_DAYS = 90;

function normalizeAnalyticsRetentionDays(value) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 3650
    ? days
    : DEFAULT_ANALYTICS_RETENTION_DAYS;
}

async function enqueueRedirectEvent(event, { JobModel = RedirectEventJob } = {}) {
  return JobModel.create({
    ...event,
    availableAt: new Date(),
    attempts: 0,
    status: "pending",
  });
}

async function claimRedirectEventJob({
  JobModel = RedirectEventJob,
  clock = Date.now,
  leaseMs = LEASE_MS,
  maxAttempts = MAX_ATTEMPTS,
} = {}) {
  const now = new Date(clock());

  return JobModel.findOneAndUpdate(
    {
      attempts: { $lt: maxAttempts },
      $or: [
        { status: "pending", availableAt: { $lte: now } },
        { status: "processing", leaseUntil: { $lte: now } },
      ],
    },
    {
      $inc: { attempts: 1 },
      $set: {
        lastError: "",
        leaseUntil: new Date(now.getTime() + leaseMs),
        status: "processing",
      },
    },
    { returnDocument: "after", sort: { createdAt: 1 } }
  );
}

function getClickEventFromJob(job) {
  const clickedAt = new Date(job.clickedAt);
  const retentionDays = normalizeAnalyticsRetentionDays(job.analyticsRetentionDays);
  return {
    ingestionKey: String(job._id),
    urlId: job.urlId,
    shortCode: job.shortCode,
    clickedAt,
    deviceType: job.deviceType,
    browser: job.browser,
    os: job.os,
    userAgent: job.userAgent,
    referrer: job.referrer,
    ipHash: job.ipHash,
    redirectTarget: job.redirectTarget,
    redirectTargetKind: job.redirectTargetKind,
    redirectStatus: job.redirectStatus,
    expiresAt: new Date(clickedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000),
  };
}

async function getCurrentClaim(JobModel, job, session) {
  const query = JobModel.findOne({
    _id: job._id,
    attempts: job.attempts,
    status: "processing",
  });

  return typeof query.session === "function" ? query.session(session) : query;
}

async function persistRedirectEvent(
  job,
  {
    session,
    JobModel = RedirectEventJob,
    ClickEventModel = ClickEvent,
    UrlModel = Url,
    UsageCounterModel = UsageCounter,
    enqueueHealthRefresh = enqueueUrlHealthRefresh,
    clock = Date.now,
    completedRetentionMs = COMPLETED_RETENTION_MS,
  } = {}
) {
  const currentJob = await getCurrentClaim(JobModel, job, session);
  if (!currentJob) return false;

  const clickEvent = getClickEventFromJob(currentJob);

  await ClickEventModel.updateOne(
    { ingestionKey: clickEvent.ingestionKey },
    { $setOnInsert: clickEvent },
    { session, upsert: true }
  );

  if (Number(currentJob.redirectStatus) === 302) {
    await UrlModel.updateOne(
      { _id: currentJob.urlId },
      {
        $inc: { clicks: 1 },
        $max: { lastClickedAt: currentJob.clickedAt },
      },
      { session }
    );
  }

  if (currentJob.workspaceId) {
    const periodKey = getUsagePeriodKey(currentJob.clickedAt);
    await UsageCounterModel.findOneAndUpdate(
      { workspaceId: currentJob.workspaceId, periodKey },
      {
        $inc: { clicks: 1 },
        $setOnInsert: { workspaceId: currentJob.workspaceId, periodKey },
      },
      { returnDocument: "after", session, upsert: true }
    );
  }

  if (currentJob.healthRefreshRequested) {
    await enqueueHealthRefresh(currentJob.urlId, {
      requestedAt: currentJob.clickedAt,
      session,
    });
  }

  const completedAt = new Date(clock());
  await JobModel.updateOne(
    {
      _id: currentJob._id,
      attempts: currentJob.attempts,
      status: "processing",
    },
    {
      $set: {
        completedAt,
        deleteAfter: new Date(completedAt.getTime() + completedRetentionMs),
        lastError: "",
        leaseUntil: null,
        status: "completed",
      },
    },
    { session }
  );

  return true;
}

async function processClaimedRedirectEvent(
  job,
  {
    startSession = () => mongoose.startSession(),
    transactionOptions,
    invalidateUsage = invalidateUsageCounter,
    ...dependencies
  } = {}
) {
  const session = await startSession();
  let processed = false;

  try {
    await session.withTransaction(async () => {
      processed = await persistRedirectEvent(job, {
        ...dependencies,
        session,
      });
    }, transactionOptions);
  } finally {
    await session.endSession();
  }

  if (processed && job.workspaceId) {
    await invalidateUsage(job.workspaceId, job.clickedAt);
  }

  return processed;
}

function getRetryDelayMs(attempts) {
  return Math.min(1000 * 2 ** Math.max(Number(attempts) - 1, 0), MAX_BACKOFF_MS);
}

async function releaseFailedRedirectEvent(
  job,
  error,
  {
    JobModel = RedirectEventJob,
    clock = Date.now,
    maxAttempts = MAX_ATTEMPTS,
    deadRetentionMs = DEAD_RETENTION_MS,
  } = {}
) {
  const attempts = Number(job.attempts) || 0;
  const isDead = attempts >= maxAttempts;
  const now = clock();

  return JobModel.updateOne(
    { _id: job._id, attempts, status: "processing" },
    {
      $set: {
        availableAt: new Date(now + getRetryDelayMs(attempts)),
        deleteAfter: isDead ? new Date(now + deadRetentionMs) : null,
        lastError: String(error?.message || error || "Unknown redirect event failure").slice(
          0,
          1000
        ),
        leaseUntil: null,
        status: isDead ? "dead" : "pending",
      },
    }
  );
}

async function processNextRedirectEventJob({
  claim = claimRedirectEventJob,
  processClaimed = processClaimedRedirectEvent,
  releaseFailed = releaseFailedRedirectEvent,
  logger = console,
} = {}) {
  const job = await claim();
  if (!job) return false;

  try {
    await processClaimed(job);
  } catch (error) {
    await releaseFailed(job, error);
    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "redirect_event_job_failed",
        jobId: String(job._id),
        attempts: Number(job.attempts) || 0,
        error: error.message,
      })
    );
  }

  return true;
}

async function getRedirectEventQueueDepth({
  JobModel = RedirectEventJob,
  queryTimeoutMs = 1000,
} = {}) {
  const [pending, processing, dead] = await Promise.all(
    ["pending", "processing", "dead"].map((status) => {
      const query = JobModel.countDocuments({ status });
      return typeof query?.maxTimeMS === "function"
        ? query.maxTimeMS(queryTimeoutMs)
        : query;
    })
  );

  return { pending, processing, dead };
}

function createRedirectEventWorker({
  processNext = processNextRedirectEventJob,
  logger = console,
  batchSize = 50,
  pollIntervalMs = 1000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  return createPollingWorker({
    processNext,
    logger,
    workerName: "redirect_event",
    batchSize,
    pollIntervalMs,
    setTimer,
    clearTimer,
  });
}

const redirectEventWorker = createRedirectEventWorker();

module.exports = {
  COMPLETED_RETENTION_MS,
  DEFAULT_ANALYTICS_RETENTION_DAYS,
  DEAD_RETENTION_MS,
  LEASE_MS,
  MAX_ATTEMPTS,
  claimRedirectEventJob,
  createRedirectEventWorker,
  enqueueRedirectEvent,
  getClickEventFromJob,
  getRedirectEventQueueDepth,
  getRetryDelayMs,
  normalizeAnalyticsRetentionDays,
  persistRedirectEvent,
  processClaimedRedirectEvent,
  processNextRedirectEventJob,
  redirectEventWorker,
  releaseFailedRedirectEvent,
};
