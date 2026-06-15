const mongoose = require("mongoose");

async function up(db) {
  await db.collection("usagecounters").createIndex(
    { workspaceId: 1, periodKey: 1 },
    { unique: true, name: "usage_workspace_period_unique" }
  );
  await db.collection("billingrecords").createIndex(
    { subscriptionId: 1 },
    { name: "billing_subscription_id" }
  );
  await db.collection("billingrecords").createIndex(
    { invoiceId: 1 },
    { name: "billing_invoice_id" }
  );
  await db.collection("workspaces").updateMany(
    { "billing.provider": { $exists: false } },
    {
      $set: {
        "billing.provider": "",
        "billing.providerCustomerId": "",
        "billing.providerSubscriptionId": "",
        "billing.cancelAtCycleEnd": false,
      },
    }
  );
}

async function down(db) {
  await db.collection("usagecounters").dropIndex("usage_workspace_period_unique").catch(() => {});
  await db.collection("billingrecords").dropIndex("billing_subscription_id").catch(() => {});
  await db.collection("billingrecords").dropIndex("billing_invoice_id").catch(() => {});
  await db.collection("workspaces").updateMany(
    {},
    {
      $unset: {
        "billing.provider": "",
        "billing.providerCustomerId": "",
        "billing.providerSubscriptionId": "",
        "billing.cancelAtCycleEnd": "",
      },
    }
  );
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
