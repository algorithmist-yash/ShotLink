const UsageCounter = require("../models/UsageCounter");
const { invalidateUsageCounter } = require("./cacheInvalidationService");
const { getUsagePeriodKey } = require("./usageServiceHelpers");

async function getCurrentUsageCounter(workspaceId, date = new Date()) {
  return UsageCounter.findOneAndUpdate(
    { workspaceId, periodKey: getUsagePeriodKey(date) },
    { $setOnInsert: { workspaceId, periodKey: getUsagePeriodKey(date) } },
    { returnDocument: "after", upsert: true }
  );
}

async function incrementUsage(workspaceId, increments, date = new Date()) {
  const counter = await UsageCounter.findOneAndUpdate(
    { workspaceId, periodKey: getUsagePeriodKey(date) },
    {
      $setOnInsert: { workspaceId, periodKey: getUsagePeriodKey(date) },
      $inc: increments,
    },
    { returnDocument: "after", upsert: true }
  );

  await invalidateUsageCounter(workspaceId, date);
  return counter;
}

function buildUsageMetric(key, used, limit) {
  const safeUsed = Math.max(Number(used) || 0, 0);
  const safeLimit = Math.max(Number(limit) || 0, 0);

  return {
    key,
    used: safeUsed,
    limit: safeLimit,
    remaining: Math.max(safeLimit - safeUsed, 0),
    percentUsed: safeLimit ? Math.min(Math.round((safeUsed / safeLimit) * 100), 100) : 0,
  };
}

module.exports = {
  buildUsageMetric,
  getCurrentUsageCounter,
  getUsagePeriodKey,
  incrementUsage,
};
