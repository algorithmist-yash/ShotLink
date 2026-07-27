const UsageCounter = require("../models/UsageCounter");

function getUsagePeriodKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function getCurrentUsageCounter(workspaceId, date = new Date()) {
  return UsageCounter.findOneAndUpdate(
    { workspaceId, periodKey: getUsagePeriodKey(date) },
    { $setOnInsert: { workspaceId, periodKey: getUsagePeriodKey(date) } },
    { new: true, upsert: true }
  );
}

async function incrementUsage(workspaceId, increments, date = new Date()) {
  return UsageCounter.findOneAndUpdate(
    { workspaceId, periodKey: getUsagePeriodKey(date) },
    {
      $setOnInsert: { workspaceId, periodKey: getUsagePeriodKey(date) },
      $inc: increments,
    },
    { new: true, upsert: true }
  );
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
