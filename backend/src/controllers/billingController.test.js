const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const BillingRecord = require("../models/BillingRecord");
const Workspace = require("../models/Workspace");
const {
  createSubscription,
  handleRazorpayWebhook,
  syncSubscription,
} = require("./billingController");

function createResponse() {
  return {
    body: null,
    statusCode: 200,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function applySet(target, values = {}) {
  for (const [path, value] of Object.entries(values)) {
    const parts = path.split(".");
    const property = parts.pop();
    let current = target;

    for (const part of parts) {
      current[part] ||= {};
      current = current[part];
    }

    current[property] = value;
  }
}

function createSubscriptionRequest(workspace, planId = "pro") {
  return {
    body: { planId },
    auth: {
      workspace,
      user: {
        _id: "user-1",
        name: "Test User",
        email: "test@example.com",
      },
    },
  };
}

function installSubscriptionCreationStubs(t, fetchImpl) {
  const originalCreateBillingRecord = BillingRecord.create;
  const originalFindBillingRecord = BillingRecord.findOne;
  const originalFindAndUpdateWorkspace = Workspace.findOneAndUpdate;
  const originalFindWorkspace = Workspace.findById;
  const originalUpdateWorkspace = Workspace.updateOne;
  const originalFetch = global.fetch;
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const originalPlanId = process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY;
  const records = [];
  const claimFilters = [];
  const workspace = {
    _id: "workspace-1",
    name: "Test Workspace",
    plan: "free",
    billing: {
      status: "inactive",
      provider: "",
      providerSubscriptionId: "",
      lastPaymentReference: "",
      subscriptionCreationReference: "",
      subscriptionCreationPlanId: "",
      subscriptionCreationStartedAt: null,
    },
  };

  process.env.RAZORPAY_KEY_ID = "rzp_test_controller";
  process.env.RAZORPAY_KEY_SECRET = "controller-secret";
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY = "plan_pro_controller";
  global.fetch = fetchImpl;

  Workspace.findOneAndUpdate = async (filter, update) => {
    claimFilters.push(filter);
    const isBlocked =
      Boolean(workspace.billing.subscriptionCreationReference) ||
      ["pending", "active", "past_due"].includes(workspace.billing.status);

    if (isBlocked) return null;

    applySet(workspace, update.$set);
    return workspace;
  };
  Workspace.findById = async () => workspace;
  Workspace.updateOne = async (filter, update) => {
    const expectedReference = filter["billing.subscriptionCreationReference"];
    if (
      expectedReference &&
      workspace.billing.subscriptionCreationReference !== expectedReference
    ) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    applySet(workspace, update.$set);
    return { matchedCount: 1, modifiedCount: 1 };
  };
  BillingRecord.create = async (input) => {
    const record = {
      _id: `billing-record-${records.length + 1}`,
      status: "created",
      subscriptionId: "",
      subscriptionShortUrl: "",
      currentPeriodStartsAt: null,
      currentPeriodEndsAt: null,
      nextChargeAt: null,
      rawLastEvent: "",
      ...input,
      async save() {},
    };
    records.push(record);
    return record;
  };
  BillingRecord.findOne = async (query) =>
    records.find(
      (record) =>
        String(record.workspaceId) === String(query.workspaceId) &&
        query.$or.some((clause) =>
          Object.entries(clause).every(([key, value]) => record[key] === value)
        )
    ) || null;

  t.after(() => {
    BillingRecord.create = originalCreateBillingRecord;
    BillingRecord.findOne = originalFindBillingRecord;
    Workspace.findOneAndUpdate = originalFindAndUpdateWorkspace;
    Workspace.findById = originalFindWorkspace;
    Workspace.updateOne = originalUpdateWorkspace;
    global.fetch = originalFetch;

    const environment = {
      RAZORPAY_KEY_ID: originalKeyId,
      RAZORPAY_KEY_SECRET: originalKeySecret,
      RAZORPAY_PLAN_ID_PRO_MONTHLY: originalPlanId,
    };
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  return { claimFilters, records, workspace };
}

function createProviderResponse(data, ok = true) {
  return {
    ok,
    async json() {
      return data;
    },
  };
}

function createBillingRecord() {
  return {
    _id: "billing-record-1",
    workspaceId: "workspace-1",
    userId: "user-1",
    planId: "pro",
    planName: "Pro",
    amountInPaise: 119900,
    currency: "INR",
    status: "created",
    referenceId: "SUB-TEST",
    subscriptionId: "",
    subscriptionShortUrl: "",
    paymentLinkId: "",
    paymentLinkUrl: "",
    paymentId: "",
    orderId: "",
    invoiceId: "",
    invoiceUrl: "",
    paidAt: null,
    currentPeriodStartsAt: null,
    currentPeriodEndsAt: null,
    nextChargeAt: null,
    rawLastEvent: "",
    webhookEventIds: [],
    async save() {},
  };
}

function createWorkspace() {
  return {
    _id: "workspace-1",
    plan: "free",
    billing: {
      status: "pending",
      currentPeriodEndsAt: null,
      lastPaymentAt: null,
      lastPaymentReference: "SUB-TEST",
      provider: "razorpay",
      providerCustomerId: "",
      providerSubscriptionId: "sub_test",
      cancelAtCycleEnd: false,
      subscriptionCreationReference: "SUB-TEST",
      subscriptionCreationPlanId: "pro",
      subscriptionCreationStartedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
    async save() {},
  };
}

function buildSubscriptionPayload(event, overrides = {}) {
  return {
    event,
    created_at: 1_784_200_000,
    payload: {
      subscription: {
        entity: {
          id: "sub_test",
          customer_id: "customer_test",
          status: event.replace("subscription.", ""),
          current_start: null,
          current_end: null,
          charge_at: 1_786_800_000,
          paid_count: 0,
          notes: {
            billing_record_id: "billing-record-1",
            reference_id: "SUB-TEST",
          },
          ...overrides,
        },
      },
    },
  };
}

async function deliverWebhook(payload, eventId) {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  const headers = {
    "x-razorpay-event-id": eventId,
    "x-razorpay-signature": signature,
  };
  const response = createResponse();

  await handleRazorpayWebhook(
    {
      body,
      get(name) {
        return headers[String(name).toLowerCase()] || "";
      },
    },
    response
  );

  return response;
}

test("subscription webhooks grant entitlements only after an active or paid state", async (t) => {
  const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const originalFindBillingRecord = BillingRecord.findOne;
  const originalFindWorkspace = Workspace.findById;
  const originalUpdateWorkspace = Workspace.updateOne;
  let currentRecord = createBillingRecord();
  let currentWorkspace = createWorkspace();

  process.env.RAZORPAY_WEBHOOK_SECRET = "billing-controller-test-secret";
  BillingRecord.findOne = async () => currentRecord;
  Workspace.findById = async () => currentWorkspace;
  Workspace.updateOne = async (filter, update) => {
    if (
      filter["billing.subscriptionCreationReference"] &&
      filter["billing.subscriptionCreationReference"] !==
        currentWorkspace.billing.subscriptionCreationReference
    ) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    applySet(currentWorkspace, update.$set);
    return { matchedCount: 1, modifiedCount: 1 };
  };

  t.after(() => {
    BillingRecord.findOne = originalFindBillingRecord;
    Workspace.findById = originalFindWorkspace;
    Workspace.updateOne = originalUpdateWorkspace;

    if (originalSecret === undefined) {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    } else {
      process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
    }
  });

  const authenticatedResponse = await deliverWebhook(
    buildSubscriptionPayload("subscription.authenticated"),
    "event-authenticated"
  );

  assert.equal(authenticatedResponse.statusCode, 200);
  assert.deepEqual(authenticatedResponse.body, { received: true });
  assert.equal(currentRecord.status, "authenticated");
  assert.equal(currentRecord.paidAt, null);
  assert.equal(currentWorkspace.plan, "free");
  assert.equal(currentWorkspace.billing.status, "pending");
  assert.equal(currentWorkspace.billing.currentPeriodEndsAt, null);

  currentRecord = createBillingRecord();
  currentWorkspace = createWorkspace();

  const activeResponse = await deliverWebhook(
    buildSubscriptionPayload("subscription.activated", {
      current_start: 1_784_200_000,
      current_end: 1_786_800_000,
      paid_count: 1,
    }),
    "event-activated"
  );

  assert.equal(activeResponse.statusCode, 200);
  assert.equal(currentRecord.status, "active");
  assert.ok(currentRecord.paidAt instanceof Date);
  assert.equal(currentWorkspace.plan, "pro");
  assert.equal(currentWorkspace.billing.status, "active");
  assert.equal(currentWorkspace.billing.subscriptionCreationReference, "SUB-TEST");
  assert.equal(currentWorkspace.billing.subscriptionCreationPlanId, "pro");
  assert.equal(
    currentWorkspace.billing.currentPeriodEndsAt.toISOString(),
    new Date(1_786_800_000 * 1000).toISOString()
  );

  const cancelledResponse = await deliverWebhook(
    buildSubscriptionPayload("subscription.cancelled"),
    "event-cancelled"
  );

  assert.equal(cancelledResponse.statusCode, 200);
  assert.equal(currentWorkspace.billing.status, "inactive");
  assert.equal(currentWorkspace.billing.providerSubscriptionId, "");
  assert.equal(currentWorkspace.billing.subscriptionCreationReference, "");
  assert.equal(currentWorkspace.billing.subscriptionCreationPlanId, "");
  assert.equal(currentWorkspace.billing.subscriptionCreationStartedAt, null);
});

test("manual subscription sync recovers an active payment when a webhook was missed", async (t) => {
  const originalFindBillingRecord = BillingRecord.findOne;
  const originalFindWorkspace = Workspace.findById;
  const originalFetch = global.fetch;
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const originalPlanId = process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY;
  const currentRecord = createBillingRecord();
  const currentWorkspace = createWorkspace();
  let providerRequest = null;

  currentRecord.subscriptionId = "sub_test";
  currentRecord.providerPlanId = "plan_pro_controller";
  process.env.RAZORPAY_KEY_ID = "rzp_test_controller";
  process.env.RAZORPAY_KEY_SECRET = "controller-secret";
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY = "plan_pro_controller";

  BillingRecord.findOne = async (query) => {
    assert.equal(String(query.workspaceId), String(currentWorkspace._id));
    assert.equal(query.subscriptionId, currentRecord.subscriptionId);
    return currentRecord;
  };
  Workspace.findById = async () => currentWorkspace;
  global.fetch = async (url, options) => {
    providerRequest = { url, options };
    return createProviderResponse({
      id: "sub_test",
      entity: "subscription",
      plan_id: "plan_pro_controller",
      customer_id: "customer_test",
      status: "active",
      paid_count: 1,
      current_start: 1_784_200_000,
      current_end: 1_786_800_000,
      charge_at: 1_789_400_000,
      created_at: 1_784_100_000,
    });
  };

  t.after(() => {
    BillingRecord.findOne = originalFindBillingRecord;
    Workspace.findById = originalFindWorkspace;
    global.fetch = originalFetch;

    const environment = {
      RAZORPAY_KEY_ID: originalKeyId,
      RAZORPAY_KEY_SECRET: originalKeySecret,
      RAZORPAY_PLAN_ID_PRO_MONTHLY: originalPlanId,
    };
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const response = createResponse();
  await syncSubscription(
    {
      auth: {
        workspace: currentWorkspace,
        user: { _id: "user-1" },
      },
      get() {
        return "";
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.synced, true);
  assert.equal(response.body.providerStatus, "active");
  assert.equal(providerRequest.options.method, "GET");
  assert.match(providerRequest.options.headers.Authorization, /^Basic /);
  assert.equal(currentRecord.status, "active");
  assert.equal(currentRecord.rawLastEvent, "subscription.synced");
  assert.ok(currentRecord.paidAt instanceof Date);
  assert.equal(currentWorkspace.plan, "pro");
  assert.equal(currentWorkspace.billing.status, "active");
  assert.equal(
    currentWorkspace.billing.currentPeriodEndsAt.toISOString(),
    new Date(1_786_800_000 * 1000).toISOString()
  );
});

test("concurrent subscription requests create one provider subscription and reuse its checkout", async (t) => {
  let fetchCalls = 0;
  let signalFetchStarted;
  let resolveProviderResponse;
  const fetchStarted = new Promise((resolve) => {
    signalFetchStarted = resolve;
  });
  const providerResponse = new Promise((resolve) => {
    resolveProviderResponse = resolve;
  });
  const state = installSubscriptionCreationStubs(t, async () => {
    fetchCalls += 1;
    signalFetchStarted();
    return providerResponse;
  });
  const firstResponse = createResponse();
  const firstRequest = createSubscription(
    createSubscriptionRequest(state.workspace),
    firstResponse
  );

  await fetchStarted;

  const concurrentResponse = createResponse();
  await createSubscription(
    createSubscriptionRequest(state.workspace),
    concurrentResponse
  );

  assert.equal(concurrentResponse.statusCode, 409);
  assert.equal(concurrentResponse.body.retryable, false);
  assert.equal(fetchCalls, 1);

  resolveProviderResponse(
    createProviderResponse({
      id: "sub_single",
      short_url: "https://rzp.io/i/single",
      status: "created",
      current_start: null,
      current_end: null,
      charge_at: null,
    })
  );
  await firstRequest;

  assert.equal(firstResponse.statusCode, 201);
  assert.equal(firstResponse.body.subscriptionId, "sub_single");
  assert.equal(firstResponse.body.reused, false);
  assert.equal(state.records.length, 1);
  assert.equal(state.workspace.billing.status, "pending");

  const retryResponse = createResponse();
  await createSubscription(createSubscriptionRequest(state.workspace), retryResponse);

  assert.equal(retryResponse.statusCode, 200);
  assert.equal(retryResponse.body.reused, true);
  assert.equal(retryResponse.body.subscriptionId, "sub_single");
  assert.equal(retryResponse.body.referenceId, firstResponse.body.referenceId);
  assert.equal(fetchCalls, 1);
  assert.equal(state.records.length, 1);
  assert.ok(
    state.claimFilters.every(
      (filter) =>
        filter["billing.status"].$nin.includes("active") &&
        filter.$or.some(
          (clause) => clause["billing.subscriptionCreationReference"] === ""
        )
    )
  );
});

test("an ambiguous provider error keeps the subscription creation claim locked", async (t) => {
  const originalConsoleError = console.error;
  let fetchCalls = 0;
  console.error = () => {};
  t.after(() => {
    console.error = originalConsoleError;
  });
  const state = installSubscriptionCreationStubs(t, async () => {
    fetchCalls += 1;
    throw new Error("Connection reset after request write");
  });
  const firstResponse = createResponse();

  await createSubscription(createSubscriptionRequest(state.workspace), firstResponse);

  assert.equal(firstResponse.statusCode, 502);
  assert.equal(firstResponse.body.retryable, false);
  assert.ok(firstResponse.body.referenceId);
  assert.equal(state.records[0].rawLastEvent, "subscription_create_unknown");
  assert.equal(
    state.workspace.billing.subscriptionCreationReference,
    firstResponse.body.referenceId
  );

  const retryResponse = createResponse();
  await createSubscription(createSubscriptionRequest(state.workspace), retryResponse);

  assert.equal(retryResponse.statusCode, 409);
  assert.equal(fetchCalls, 1);
  assert.equal(state.records.length, 1);
});

test("a definitive provider rejection releases the claim for a safe retry", async (t) => {
  let fetchCalls = 0;
  const state = installSubscriptionCreationStubs(t, async () => {
    fetchCalls += 1;

    if (fetchCalls === 1) {
      return createProviderResponse(
        { error: { description: "Plan is unavailable" } },
        false
      );
    }

    return createProviderResponse({
      id: "sub_after_retry",
      short_url: "https://rzp.io/i/after-retry",
      status: "created",
    });
  });
  const rejectedResponse = createResponse();

  await createSubscription(createSubscriptionRequest(state.workspace), rejectedResponse);

  assert.equal(rejectedResponse.statusCode, 502);
  assert.equal(rejectedResponse.body.retryable, true);
  assert.equal(state.workspace.billing.subscriptionCreationReference, "");
  assert.equal(state.records[0].status, "failed");

  const retryResponse = createResponse();
  await createSubscription(createSubscriptionRequest(state.workspace), retryResponse);

  assert.equal(retryResponse.statusCode, 201);
  assert.equal(retryResponse.body.subscriptionId, "sub_after_retry");
  assert.equal(fetchCalls, 2);
  assert.equal(state.records.length, 2);
});
