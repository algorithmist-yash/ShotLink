const mongoose = require("mongoose");

async function up(db) {
  await db.collection("redirecteventjobs").createIndex(
    { status: 1, availableAt: 1, createdAt: 1 },
    { name: "redirect_jobs_available" }
  );
  await db.collection("redirecteventjobs").createIndex(
    { deleteAfter: 1 },
    { expireAfterSeconds: 0, name: "redirect_jobs_ttl" }
  );
  await db.collection("clickevents").createIndex(
    { ingestionKey: 1 },
    { unique: true, sparse: true, name: "click_event_ingestion_unique" }
  );
}

async function down(db) {
  await db.collection("redirecteventjobs").dropIndex("redirect_jobs_available").catch(() => {});
  await db.collection("redirecteventjobs").dropIndex("redirect_jobs_ttl").catch(() => {});
  await db.collection("clickevents").dropIndex("click_event_ingestion_unique").catch(() => {});
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
