require("dotenv").config();

const connectDB = require("../config/db");
const ClickEvent = require("../src/models/ClickEvent");

const DEFAULT_RETENTION_DAYS = 90;

function getLegacyRetentionDays(env = process.env) {
  const configured = Number(env.LEGACY_ANALYTICS_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= 1 && configured <= 3650
    ? configured
    : DEFAULT_RETENTION_DAYS;
}

async function up({ ClickEventModel = ClickEvent, env = process.env } = {}) {
  const retentionDays = getLegacyRetentionDays(env);
  return ClickEventModel.updateMany(
    { expiresAt: { $exists: false } },
    [
      {
        $set: {
          expiresAt: {
            $dateAdd: {
              startDate: { $ifNull: ["$clickedAt", "$createdAt"] },
              unit: "day",
              amount: retentionDays,
            },
          },
        },
      },
    ],
    { updatePipeline: true }
  );
}

async function main() {
  await connectDB();
  const result = await up();
  console.log(
    JSON.stringify({
      event: "analytics_retention_backfill_complete",
      matched: result.matchedCount,
      modified: result.modifiedCount,
    })
  );
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Analytics retention migration failed:", error.message);
    process.exit(1);
  });
}

module.exports = { DEFAULT_RETENTION_DAYS, getLegacyRetentionDays, up };
