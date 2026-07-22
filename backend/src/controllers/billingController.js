const { nanoid } = require("nanoid");

const BillingRecord = require("../models/BillingRecord");
const Url = require("../models/Url");
const Workspace = require("../models/Workspace");
const {
  buildUsageMetric,
  getCurrentUsageCounter,
} = require("../services/usageService");
const {
  addMonths,
  getPlanDefinition,
  listPublicPlans,
  resolveEffectivePlan,
  serializeBillingSnapshot,
} = require("../config/billingPlans");
const { getRazorpayBasicAuthHeader, verifyRazorpayWebhookSignature } = require("../utils/razorpayUtils");
const { recordAuditEvent } = require("../services/auditLogService");

const BLOCKING_BILLING_STATUSES = ["pending", "active", "past_due"];
const REUSABLE_CHECKOUT_STATUSES = ["created"];

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

function unixToDate(value) {
  return value ? new Date(value * 1000) : null;
}

function getRazorpayPlanId(plan) {
  const envKey = plan?.razorpayPlanIdEnvKey;
  return envKey ? String(process.env[envKey] || "").trim() : "";
}

function buildSubscriptionCheckoutResponse(record, plan, reused = false) {
  return {
    subscriptionId: record.subscriptionId,
    subscriptionShortUrl: record.subscriptionShortUrl,
    amountLabel: formatAmountInInr(plan.priceInPaise),
    referenceId: record.referenceId,
    reused,
    plan: {
      id: plan.id,
      name: plan.name,
    },
  };
}

async function releaseSubscriptionCreation(workspaceId, referenceId) {
  if (!referenceId) return;

  await Workspace.updateOne(
    {
      _id: workspaceId,
      "billing.subscriptionCreationReference": referenceId,
    },
    {
      $set: {
        "billing.subscriptionCreationReference": "",
        "billing.subscriptionCreationPlanId": "",
        "billing.subscriptionCreationStartedAt": null,
      },
    }
  );
}

async function findExistingSubscriptionRecord(workspace) {
  const referenceId = workspace?.billing?.subscriptionCreationReference || "";
  const subscriptionId = workspace?.billing?.providerSubscriptionId || "";
  const lookupClauses = compactLookupClauses([
    { referenceId },
    { subscriptionId },
  ]);

  if (!lookupClauses.length) return null;

  return BillingRecord.findOne({
    workspaceId: workspace._id,
    $or: lookupClauses,
  });
}

function isReusableSubscriptionCheckout(record, planId) {
  if (!record || record.planId !== planId || !record.subscriptionShortUrl) {
    return false;
  }

  if (!REUSABLE_CHECKOUT_STATUSES.includes(record.status)) {
    return false;
  }

  return !record.expiresAt || new Date(record.expiresAt) > new Date();
}

function compactLookupClauses(clauses) {
  return clauses.filter((clause) => {
    const value = Object.values(clause)[0];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}

async function countWorkspaceLinks(workspaceId) {
  return Url.countDocuments({
    workspaceId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
}

function countWorkspaceDomains(workspace) {
  return (workspace?.customDomains || []).filter((domain) => domain.status !== "disabled").length;
}

function countWorkspaceMembers(workspace) {
  return (workspace?.members || []).length || 1;
}

function buildBillingSummary(workspace, linkCount, usageCounter) {
  const billing = serializeBillingSnapshot(workspace);
  const usage = {
    links: buildUsageMetric("links", linkCount, billing.linkLimit),
    clicks: buildUsageMetric("clicks", usageCounter?.clicks, billing.clickLimit),
    domains: buildUsageMetric("domains", countWorkspaceDomains(workspace), billing.domainLimit),
    teamMembers: buildUsageMetric("teamMembers", countWorkspaceMembers(workspace), billing.teamMemberLimit),
    apiRequests: buildUsageMetric("apiRequests", usageCounter?.apiRequests, billing.apiCallLimit),
    qrCodes: buildUsageMetric("qrCodes", usageCounter?.qrCodesCreated, billing.qrCodeLimit),
  };

  return {
    ...billing,
    usagePeriodKey: usageCounter?.periodKey || "",
    usage,
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
    const [linkCount, usageCounter, recentRecords] = await Promise.all([
      countWorkspaceLinks(req.auth.workspace._id),
      getCurrentUsageCounter(req.auth.workspace._id),
      BillingRecord.find({ workspaceId: req.auth.workspace._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    return res.json({
      plans: listPublicPlans(),
      supportEmail: getSupportEmail(),
      currentPlan: buildBillingSummary(req.auth.workspace, linkCount, usageCounter),
      recentPayments: recentRecords.map((record) => ({
        id: record._id,
        planId: record.planId,
        planName: record.planName,
        amountInPaise: record.amountInPaise,
        currency: record.currency,
        status: record.status,
        referenceId: record.referenceId,
        subscriptionId: record.subscriptionId,
        subscriptionShortUrl: record.subscriptionShortUrl,
        paymentLinkUrl: record.paymentLinkUrl,
        invoiceId: record.invoiceId,
        invoiceUrl: record.invoiceUrl,
        currentPeriodEndsAt: record.currentPeriodEndsAt,
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

    await recordAuditEvent(req, {
      action: "billing.payment_link_created",
      targetType: "billing_record",
      targetId: record._id,
      metadata: { planId: plan.id, referenceId },
    });

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

exports.createSubscription = async (req, res) => {
  let creationClaimed = false;
  let providerRequestStarted = false;
  let record = null;
  let referenceId = "";

  try {
    const planId = String(req.body.planId || "").trim().toLowerCase();
    const plan = getPlanDefinition(planId);

    if (!plan || plan.id === "free" || plan.id === "enterprise") {
      return res.status(400).json({ error: "Choose Pro or Business to start a subscription" });
    }

    const razorpayPlanId = getRazorpayPlanId(plan);
    if (!razorpayPlanId) {
      return res.status(500).json({
        error: `${plan.razorpayPlanIdEnvKey} must be configured with the Razorpay monthly plan id`,
      });
    }

    referenceId = `SUB-${nanoid(10).toUpperCase()}`;
    const creationStartedAt = new Date();
    const claimedWorkspace = await Workspace.findOneAndUpdate(
      {
        _id: req.auth.workspace._id,
        "billing.status": { $nin: BLOCKING_BILLING_STATUSES },
        $or: [
          { "billing.subscriptionCreationReference": "" },
          { "billing.subscriptionCreationReference": { $exists: false } },
        ],
      },
      {
        $set: {
          "billing.subscriptionCreationReference": referenceId,
          "billing.subscriptionCreationPlanId": plan.id,
          "billing.subscriptionCreationStartedAt": creationStartedAt,
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!claimedWorkspace) {
      const currentWorkspace = await Workspace.findById(req.auth.workspace._id);
      const existingRecord = currentWorkspace
        ? await findExistingSubscriptionRecord(currentWorkspace)
        : null;

      if (isReusableSubscriptionCheckout(existingRecord, plan.id)) {
        await recordAuditEvent(req, {
          action: "billing.subscription_checkout_reused",
          targetType: "billing_record",
          targetId: existingRecord._id,
          metadata: { planId: plan.id, referenceId: existingRecord.referenceId },
        });
        return res
          .status(200)
          .json(buildSubscriptionCheckoutResponse(existingRecord, plan, true));
      }

      return res.status(409).json({
        error:
          "A subscription is already active or being created for this workspace. Complete or cancel it before starting another.",
        referenceId:
          currentWorkspace?.billing?.subscriptionCreationReference ||
          currentWorkspace?.billing?.lastPaymentReference ||
          "",
        retryable: false,
      });
    }

    creationClaimed = true;
    record = await BillingRecord.create({
      workspaceId: req.auth.workspace._id,
      userId: req.auth.user._id,
      planId: plan.id,
      planName: plan.name,
      amountInPaise: plan.priceInPaise,
      currency: plan.currency,
      providerPlanId: razorpayPlanId,
      referenceId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const authorization = getRazorpayBasicAuthHeader();
    providerRequestStarted = true;
    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        total_count: 120,
        quantity: 1,
        customer_notify: true,
        expire_by: Math.floor((Date.now() + 30 * 60 * 1000) / 1000),
        notes: {
          workspace_id: String(req.auth.workspace._id),
          user_id: String(req.auth.user._id),
          plan_id: plan.id,
          billing_record_id: String(record._id),
          reference_id: referenceId,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      record.status = "failed";
      record.rawLastEvent = "subscription_create_failed";
      await record.save();
      await releaseSubscriptionCreation(req.auth.workspace._id, referenceId);
      creationClaimed = false;

      return res.status(502).json({
        error: data?.error?.description || data?.error?.reason || "Could not create subscription",
        referenceId,
        retryable: true,
      });
    }

    record.subscriptionId = data.id || "";
    record.subscriptionShortUrl = data.short_url || "";
    record.status = data.status || "created";
    record.currentPeriodStartsAt = unixToDate(data.current_start);
    record.currentPeriodEndsAt = unixToDate(data.current_end);
    record.nextChargeAt = unixToDate(data.charge_at);
    await record.save();

    const workspaceUpdate = await Workspace.updateOne(
      {
        _id: req.auth.workspace._id,
        "billing.subscriptionCreationReference": referenceId,
      },
      {
        $set: {
          "billing.status": "pending",
          "billing.provider": "razorpay",
          "billing.providerSubscriptionId": record.subscriptionId,
          "billing.lastPaymentReference": referenceId,
          "billing.billingEmail": req.auth.user.email,
          "billing.cancelAtCycleEnd": false,
        },
      }
    );

    if (workspaceUpdate.matchedCount !== 1) {
      throw new Error("Subscription creation claim was lost before persistence");
    }

    await recordAuditEvent(req, {
      action: "billing.subscription_created",
      targetType: "billing_record",
      targetId: record._id,
      metadata: { planId: plan.id, referenceId },
    });

    return res
      .status(201)
      .json(buildSubscriptionCheckoutResponse(record, plan));
  } catch (error) {
    console.error(error);

    if (creationClaimed && !providerRequestStarted) {
      try {
        await releaseSubscriptionCreation(req.auth.workspace._id, referenceId);
      } catch (releaseError) {
        console.error(releaseError);
      }
    }

    if (creationClaimed && providerRequestStarted) {
      if (record) {
        record.rawLastEvent = "subscription_create_unknown";
        try {
          await record.save();
        } catch (saveError) {
          console.error(saveError);
        }
      }

      return res.status(502).json({
        error:
          "Razorpay subscription creation could not be confirmed. Do not retry; contact support with this reference.",
        referenceId,
        retryable: false,
      });
    }

    return res.status(500).json({ error: "Server error" });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const subscriptionId = req.auth.workspace.billing?.providerSubscriptionId;
    if (!subscriptionId) {
      return res.status(400).json({ error: "No active Razorpay subscription found" });
    }

    const response = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: getRazorpayBasicAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      }
    );
    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: data?.error?.description || data?.error?.reason || "Could not cancel subscription",
      });
    }

    req.auth.workspace.billing = {
      ...req.auth.workspace.billing,
      cancelAtCycleEnd: true,
    };
    await req.auth.workspace.save();

    await BillingRecord.updateOne(
      { workspaceId: req.auth.workspace._id, subscriptionId },
      {
        $set: {
          rawLastEvent: "subscription.cancel_requested",
          status: data.status || "cancelled",
        },
      }
    );

    await recordAuditEvent(req, {
      action: "billing.subscription_cancel_requested",
      targetType: "subscription",
      targetId: subscriptionId,
    });

    return res.json({
      message: "Subscription cancellation scheduled for the end of the current billing cycle",
      subscriptionId,
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
    "subscription.authenticated": "authenticated",
    "subscription.activated": "active",
    "subscription.charged": "active",
    "subscription.pending": "pending",
    "subscription.halted": "halted",
    "subscription.cancelled": "cancelled",
    "subscription.completed": "completed",
    "subscription.expired": "expired",
    "invoice.paid": "paid",
  };

  return statuses[eventName] || "created";
}

async function applySubscriptionState(record, subscription, payment, invoice, payload) {
  const plan = getPlanDefinition(record.planId);
  const workspace = await Workspace.findById(record.workspaceId);

  record.subscriptionId = subscription?.id || record.subscriptionId;
  record.subscriptionShortUrl = subscription?.short_url || record.subscriptionShortUrl;
  record.invoiceId = invoice?.id || record.invoiceId;
  record.invoiceUrl = invoice?.short_url || invoice?.invoice_url || record.invoiceUrl;
  record.paymentId = payment?.id || record.paymentId;
  record.currentPeriodStartsAt = unixToDate(subscription?.current_start) || record.currentPeriodStartsAt;
  record.currentPeriodEndsAt = unixToDate(subscription?.current_end) || record.currentPeriodEndsAt;
  record.nextChargeAt = unixToDate(subscription?.charge_at) || record.nextChargeAt;

  if (["active", "paid"].includes(record.status) && !record.paidAt) {
    record.paidAt = unixToDate(payment?.created_at || invoice?.paid_at || payload.created_at) || new Date();
  }

  if (!workspace) return;

  if (["active", "paid"].includes(record.status)) {
    workspace.plan = plan?.id || workspace.plan;
    workspace.billing = {
      ...workspace.billing,
      status: "active",
      currentPeriodEndsAt:
        record.currentPeriodEndsAt || (plan ? addMonths(record.paidAt || new Date(), plan.intervalMonths) : null),
      lastPaymentAt: record.paidAt || workspace.billing?.lastPaymentAt || null,
      lastPaymentReference: record.referenceId,
      billingEmail: payment?.email || workspace.billing?.billingEmail || "",
      provider: "razorpay",
      providerCustomerId: subscription?.customer_id || workspace.billing?.providerCustomerId || "",
      providerSubscriptionId: record.subscriptionId,
      cancelAtCycleEnd: false,
      subscriptionCreationReference: record.referenceId,
      subscriptionCreationPlanId: record.planId,
      subscriptionCreationStartedAt:
        workspace.billing?.subscriptionCreationStartedAt || record.createdAt || new Date(),
    };
  }

  if (record.status === "halted") {
    workspace.billing.status = "past_due";
    workspace.billing.provider = "razorpay";
    workspace.billing.providerSubscriptionId = record.subscriptionId;
  }

  if (["cancelled", "completed", "expired"].includes(record.status)) {
    workspace.billing.status = "inactive";
    workspace.billing.provider = "razorpay";
    workspace.billing.providerSubscriptionId = "";
  }

  await workspace.save();

  if (["cancelled", "completed", "expired"].includes(record.status)) {
    await releaseSubscriptionCreation(record.workspaceId, record.referenceId);
  }
}

exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.get("x-razorpay-signature");
    if (!verifyRazorpayWebhookSignature(req.body, signature)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const payload = JSON.parse(req.body.toString("utf8"));
    const paymentLink = payload?.payload?.payment_link?.entity;
    const subscription = payload?.payload?.subscription?.entity;
    const invoice = payload?.payload?.invoice?.entity;
    const payment = payload?.payload?.payment?.entity;
    const order = payload?.payload?.order?.entity;
    const webhookEventId = req.get("x-razorpay-event-id") || payload.id || "";
    const referenceId =
      paymentLink?.reference_id ||
      subscription?.notes?.reference_id ||
      invoice?.notes?.reference_id ||
      "";
    const paymentLinkId = paymentLink?.id || "";
    const subscriptionId = subscription?.id || invoice?.subscription_id || payment?.subscription_id || "";
    const billingRecordId =
      subscription?.notes?.billing_record_id ||
      invoice?.notes?.billing_record_id ||
      payment?.notes?.billing_record_id ||
      "";

    const lookupClauses = compactLookupClauses([
      { _id: billingRecordId },
      { subscriptionId },
      { paymentLinkId },
      { referenceId },
    ]);
    const record = lookupClauses.length
      ? await BillingRecord.findOne({ $or: lookupClauses })
      : null;

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
    record.invoiceId = invoice?.id || record.invoiceId;
    record.invoiceUrl = invoice?.short_url || invoice?.invoice_url || record.invoiceUrl;

    if (subscription || invoice?.subscription_id || payment?.subscription_id) {
      await applySubscriptionState(record, subscription, payment, invoice, payload);
    } else if (record.status === "paid" && !record.paidAt) {
      const paidAtUnix = paymentLink?.paid_at || payment?.created_at || payload.created_at;
      record.paidAt = paidAtUnix ? new Date(paidAtUnix * 1000) : new Date();

      const workspace = await Workspace.findById(record.workspaceId);
      if (workspace) {
        const plan = getPlanDefinition(record.planId);
        workspace.plan = plan?.id || workspace.plan;
        workspace.billing = {
          ...workspace.billing,
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
