const mongoose = require("mongoose");

async function up(db) {
  const jobs = db.collection("urlhealthjobs");

  await jobs.createIndex(
    { urlId: 1 },
    {
      unique: true,
      partialFilterExpression: { active: true },
      name: "url_health_jobs_one_active_per_url",
    }
  );
  await jobs.createIndex(
    { status: 1, availableAt: 1, createdAt: 1 },
    { name: "url_health_jobs_pending" }
  );
  await jobs.createIndex(
    { status: 1, leaseUntil: 1, createdAt: 1 },
    { name: "url_health_jobs_expired_leases" }
  );
  await jobs.createIndex(
    { deleteAfter: 1 },
    { expireAfterSeconds: 0, name: "url_health_jobs_ttl" }
  );
}

async function down(db) {
  const jobs = db.collection("urlhealthjobs");
  for (const indexName of [
    "url_health_jobs_one_active_per_url",
    "url_health_jobs_pending",
    "url_health_jobs_expired_leases",
    "url_health_jobs_ttl",
  ]) {
    await jobs.dropIndex(indexName).catch(() => {});
  }
}

module.exports = { up, down };

if (require.main === module) {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is required to run this migration");
  }

  mongoose
    .connect(uri)
    .then(() => up(mongoose.connection.db))
    .then(() => mongoose.disconnect())
    .catch(async (error) => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
