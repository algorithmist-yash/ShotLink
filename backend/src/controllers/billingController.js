const { nanoid } = require("nanoid");

const BillingRecord = require("../models/BillingRecord");
const Url = require("../models/Url");
const Workspace = require("../models/Workspace");
const {
  addMonths,
  getPlanDefinition,
  listPublicPlans,
  resolveEffectivePlan,
  serializeBillingSnapshot,
} = require("../config/billingPlans");
const { getRazorpayBasicAuthHeader, verifyRazorpayWebhookSignature } = require("../utils/razorpayUtils");

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.ALLOWED_ORIGINS?.split(",")[0] || "").replace(
    /\/$/,
    ""
  );
}

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || "support@shotlink.in";
}

function formatAmountInInr(amountInPaise) {
  return `INR ${(amountInPaise / 100).toFixed(0)}`;
}

async function countWorkspaceLinks(workspaceId) {
  return Url.countDocuments({
    workspaceId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
}

function buildBillingSummary(workspace, linkCount) {
  const billing = serializeBillingSnapshot(workspace);
  return {
    ...billing,
    linkCountUsed: linkCount,
    linkCountRemaining: Math.max(billing.linkLimit - linkCount, 0),
  };
}

exports.getPublicPlans = async (req, res) => {
  return res.json({
    plans: listPublicPlans(),
    supportEmail: getSupportEmail(),
  });
};

exports.getBillingSummary = async (req, res) => {
  try {
    const [linkCount, recentRecords] = await Promise.all([
      countWorkspaceLinks(req.auth.workspace._id),
      BillingRecord.find({ workspaceId: req.auth.workspace._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return res.json({
      plans: listPublicPlans(),
      supportEmail: getSupportEmail(),
      currentPlan: buildBillingSummary(req.auth.workspace, linkCount),
      recentPayments: recentRecords.map((record) => ({
        id: record._id,
        planId: record.planId,
        planName: record.planName,
        amountInPaise: record.amountInPaise,
        currency: record.currency,
        status: record.status,
        referenceId: record.referenceId,
        paymentLinkUrl: record.paymentLinkUrl,
        createdAt: record.createdAt,
        paidAt: record.paidAt,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.createPaymentLink = async (req, res) => {
  try {
    const planId = String(req.body.planId || "").trim().toLowerCase();
    const plan = getPlanDefinition(planId);

    if (!plan || plan.id === "free") {
      return res.status(400).json({ error: "Choose a paid plan to continue" });
    }

    const appBaseUrl = getAppBaseUrl();
    if (!appBaseUrl) {
      return res
        .status(500)
        .json({ error: "APP_BASE_URL or ALLOWED_ORIGINS must be configured on the server" });
    }

    const referenceId = `BILL-${nanoid(10).toUpperCase()}`;
    const callbackUrl = `${appBaseUrl}/?billing_reference=${referenceId}&plan=${plan.id}`;
    const record = await BillingRecord.create({
      workspaceId: req.auth.workspace._id,
      userId: req.auth.user._id,
      planId: plan.id,
      planName: plan.name,
      amountInPaise: plan.priceInPaise,
      currency: plan.currency,
      referenceId,
      callbackUrl,
      expiresAt: addMonths(new Date(), 1),
    });

    const response = await fetch("https://api.razorpay.com/v1/payment_links/", {
      method: "POST",
      headers: {
        Authorization: getRazorpayBasicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.priceInPaise,
        currency: plan.currency,
        accept_partial: false,
        expire_by: Math.floor(addMonths(new Date(), 1).getTime() / 1000),
        reference_id: referenceId,
        description: `${plan.name} plan for workspace ${req.auth.workspace.name}`,
        customer: {
          name: req.auth.user.name,
          email: req.auth.user.email,
        },
        notify: {
          sms: false,
          email: false,
        },
        reminder_enable: true,
        notes: {
          workspace_id: String(req.auth.workspace._id),
          user_id: String(req.auth.user._id),
          plan_id: plan.id,
          billing_record_id: String(record._id),
        },
        callback_url: callbackUrl,
        callback_method: "get",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      record.status = "failed";
      record.rawLastEvent = "create_failed";
      await record.save();

      return res.status(502).json({
        error: data?.error?.description || data?.error?.reason || "Could not create payment link",
      });
    }

    record.paymentLinkId = data.id || "";
    record.paymentLinkUrl = data.short_url || "";
    record.status = data.status === "paid" ? "paid" : "created";
    await record.save();

    return res.status(201).json({
      paymentLinkUrl: record.paymentLinkUrl,
      paymentLinkId: record.paymentLinkId,
      amountLabel: formatAmountInInr(plan.priceInPaise),
      referenceId,
      plan: {
        id: plan.id,
        name: plan.name,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

function mapWebhookStatus(eventName) {
  const statuses = {
    "payment_link.paid": "paid",
    "payment_link.cancelled": "cancelled",
    "payment_link.expired": "expired",
    "payment_link.partially_paid": "partially_paid",
  };

  return statuses[eventName] || "created";
}

exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.get("x-razorpay-signature");
    if (!verifyRazorpayWebhookSignature(req.body, signature)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const payload = JSON.parse(req.body.toString("utf8"));
    const paymentLink = payload?.payload?.payment_link?.entity;
    const payment = payload?.payload?.payment?.entity;
    const order = payload?.payload?.order?.entity;
    const webhookEventId = req.get("x-razorpay-event-id") || payload.id || "";
    const referenceId = paymentLink?.reference_id || "";
    const paymentLinkId = paymentLink?.id || "";

    const record = await BillingRecord.findOne({
      $or: [{ paymentLinkId }, { referenceId }],
    });

    if (!record) {
      return res.json({ received: true, ignored: true });
    }

    if (webhookEventId && record.webhookEventIds.includes(webhookEventId)) {
      return res.json({ received: true, duplicate: true });
    }

    record.status = mapWebhookStatus(payload.event);
    record.rawLastEvent = payload.event;
    record.paymentLinkId = paymentLinkId || record.paymentLinkId;
    record.paymentLinkUrl = paymentLink?.short_url || record.paymentLinkUrl;
    record.paymentId = payment?.id || record.paymentId;
    record.orderId = order?.id || record.orderId;

    if (record.status === "paid" && !record.paidAt) {
      const paidAtUnix = paymentLink?.paid_at || payment?.created_at || payload.created_at;
      record.paidAt = paidAtUnix ? new Date(paidAtUnix * 1000) : new Date();

      const workspace = await Workspace.findById(record.workspaceId);
      if (workspace) {
        const plan = getPlanDefinition(record.planId);
        workspace.plan = plan?.id || workspace.plan;
        workspace.billing = {
          status: "active",
          currentPeriodEndsAt: plan ? addMonths(record.paidAt, plan.intervalMonths) : null,
          lastPaymentAt: record.paidAt,
          lastPaymentReference: record.referenceId,
          billingEmail: payment?.email || workspace.billing?.billingEmail || "",
        };
        await workspace.save();
      }
    }

    if (webhookEventId) {
      record.webhookEventIds = [...new Set([...record.webhookEventIds, webhookEventId])].slice(-25);
    }

    await record.save();

    return res.json({ received: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};
