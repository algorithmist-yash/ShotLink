const UrlHealthJob = require("../models/UrlHealthJob");
const { refreshUrlHealthWithLease } = require("./healthService");
const { createPollingWorker } = require("./pollingWorker");

const MAX_ATTEMPTS = 5;
const LEASE_MS = 30_000;
const COMPLETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DEAD_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 60_000;

async function enqueueUrlHealthRefresh(
  urlId,
  {
    JobModel = UrlHealthJob,
    session,
    requestedAt = new Date(),
  } = {}
) {
  return JobModel.findOneAndUpdate(
    { urlId, active: true },
    {
      $max: { requestedAt },
      $setOnInsert: {
        active: true,
        attempts: 0,
        availableAt: requestedAt,
        lastError: "",
        leaseUntil: null,
        status: "pending",
        urlId,
      },
    },
    {
      returnDocument: "after",
      session,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  );
}

async function claimUrlHealthJob({
  JobModel = UrlHealthJob,
  clock = Date.now,
  leaseMs = LEASE_MS,
  maxAttempts = MAX_ATTEMPTS,
  deadRetentionMs = DEAD_RETENTION_MS,
} = {}) {
  const now = new Date(clock());

  const job = await JobModel.findOneAndUpdate(
    {
      active: true,
      attempts: { $lt: maxAttempts },
      $or: [
        {
          status: "pending",
          availableAt: { $lte: now },
        },
        {
          status: "processing",
          leaseUntil: { $lte: now },
        },
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

  if (job) return job;

  await deadLetterExpiredUrlHealthJob({
    JobModel,
    clock,
    deadRetentionMs,
    maxAttempts,
  });
  return null;
}

async function deadLetterExpiredUrlHealthJob({
  JobModel = UrlHealthJob,
  clock = Date.now,
  deadRetentionMs = DEAD_RETENTION_MS,
  maxAttempts = MAX_ATTEMPTS,
} = {}) {
  const now = new Date(clock());
  return JobModel.findOneAndUpdate(
    {
      active: true,
      attempts: { $gte: maxAttempts },
      leaseUntil: { $lte: now },
      status: "processing",
    },
    {
      $set: {
        active: false,
        availableAt: null,
        deleteAfter: new Date(now.getTime() + deadRetentionMs),
        lastError: "URL health job exhausted after worker lease expiration",
        leaseUntil: null,
        status: "dead",
      },
    },
    { returnDocument: "after", sort: { leaseUntil: 1 } }
  );
}

async function completeUrlHealthJob(
  job,
  {
    JobModel = UrlHealthJob,
    clock = Date.now,
    completedRetentionMs = COMPLETED_RETENTION_MS,
  } = {}
) {
  const completedAt = new Date(clock());
  return JobModel.updateOne(
    {
      _id: job._id,
      active: true,
      attempts: job.attempts,
      status: "processing",
    },
    {
      $set: {
        active: false,
        completedAt,
        deleteAfter: new Date(completedAt.getTime() + completedRetentionMs),
        lastError: "",
        leaseUntil: null,
        status: "completed",
      },
    }
  );
}

function getRetryDelayMs(attempts, random = Math.random) {
  const maximumDelay = Math.min(
    1000 * 2 ** Math.max(Number(attempts) - 1, 0),
    MAX_BACKOFF_MS
  );
  return Math.floor(maximumDelay / 2 + random() * (maximumDelay / 2));
}

async function releaseFailedUrlHealthJob(
  job,
  error,
  {
    JobModel = UrlHealthJob,
    clock = Date.now,
    random = Math.random,
    maxAttempts = MAX_ATTEMPTS,
    deadRetentionMs = DEAD_RETENTION_MS,
  } = {}
) {
  const attempts = Number(job.attempts) || 0;
  const isDead = attempts >= maxAttempts;
  const now = clock();

  return JobModel.updateOne(
    {
      _id: job._id,
      active: true,
      attempts,
      status: "processing",
    },
    {
      $set: {
        active: !isDead,
        availableAt: isDead ? null : new Date(now + getRetryDelayMs(attempts, random)),
        deleteAfter: isDead ? new Date(now + deadRetentionMs) : null,
        lastError: String(error?.message || error || "Unknown URL health failure").slice(
          0,
          1000
        ),
        leaseUntil: null,
        status: isDead ? "dead" : "pending",
      },
    }
  );
}

async function processClaimedUrlHealthJob(
  job,
  {
    refresh = refreshUrlHealthWithLease,
    complete = completeUrlHealthJob,
  } = {}
) {
  const refreshed = await refresh(job.urlId);
  if (!refreshed) {
    throw new Error("URL health refresh lease is unavailable");
  }

  const result = await complete(job);
  if (result && Number(result.matchedCount) === 0) {
    throw new Error("URL health job lease ownership was lost before completion");
  }

  return true;
}

async function processNextUrlHealthJob({
  claim = claimUrlHealthJob,
  processClaimed = processClaimedUrlHealthJob,
  releaseFailed = releaseFailedUrlHealthJob,
  logger = console,
} = {}) {
  const job = await claim();
  if (!job) return false;

  try {
    await processClaimed(job);
    logger.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "url_health_job_completed",
        jobId: String(job._id),
        urlId: String(job.urlId),
        attempts: Number(job.attempts) || 0,
      })
    );
  } catch (error) {
    await releaseFailed(job, error);
    const dead = Number(job.attempts) >= MAX_ATTEMPTS;
    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        event: dead ? "url_health_job_dead" : "url_health_job_retry_scheduled",
        jobId: String(job._id),
        urlId: String(job.urlId),
        attempts: Number(job.attempts) || 0,
        error: error.message,
      })
    );
  }

  return true;
}

async function getUrlHealthQueueDepth({
  JobModel = UrlHealthJob,
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

function createUrlHealthWorker(options = {}) {
  return createPollingWorker({
    processNext: processNextUrlHealthJob,
    workerName: "url_health",
    batchSize: 10,
    ...options,
  });
}

const urlHealthWorker = createUrlHealthWorker();

module.exports = {
  COMPLETED_RETENTION_MS,
  DEAD_RETENTION_MS,
  LEASE_MS,
  MAX_ATTEMPTS,
  claimUrlHealthJob,
  completeUrlHealthJob,
  createUrlHealthWorker,
  deadLetterExpiredUrlHealthJob,
  enqueueUrlHealthRefresh,
  getRetryDelayMs,
  getUrlHealthQueueDepth,
  processClaimedUrlHealthJob,
  processNextUrlHealthJob,
  releaseFailedUrlHealthJob,
  urlHealthWorker,
};
