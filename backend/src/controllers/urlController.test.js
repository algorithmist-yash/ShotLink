const assert = require("node:assert/strict");
const test = require("node:test");

const Url = require("../models/Url");
const redirectEventService = require("../services/redirectEventService");

test("a stale health snapshot records durable refresh intent before redirecting", async (t) => {
  const originalFindUrl = Url.findOne;
  const originalEnqueue = redirectEventService.enqueueRedirectEvent;
  const originalWake = redirectEventService.redirectEventWorker.wake;
  const controllerPath = require.resolve("./urlController");
  const order = [];
  let queuedEvent = null;
  const url = {
    _id: "url-1",
    workspaceId: null,
    shortCode: "fast-link",
    originalUrl: "https://primary.example.com/path",
    expiresAt: new Date(Date.now() + 60_000),
    isActive: true,
    primaryHealth: {
      status: "healthy",
      lastCheckedAt: null,
    },
    fallbackUrls: [],
  };

  Url.findOne = async () => url;
  redirectEventService.enqueueRedirectEvent = async (event) => {
    queuedEvent = event;
    order.push("enqueue");
    return { _id: "redirect-job-1" };
  };
  redirectEventService.redirectEventWorker.wake = () => order.push("wake");
  delete require.cache[controllerPath];
  const { redirectToOriginal } = require("./urlController");

  t.after(() => {
    Url.findOne = originalFindUrl;
    redirectEventService.enqueueRedirectEvent = originalEnqueue;
    redirectEventService.redirectEventWorker.wake = originalWake;
    delete require.cache[controllerPath];
  });

  const response = {
    statusCode: 200,
    location: "",
    redirect(statusCode, location) {
      this.statusCode = statusCode;
      this.location = location;
      order.push("redirect");
      return this;
    },
  };
  const request = {
    params: { shortCode: "fast-link" },
    hostname: "localhost",
    headers: {},
    ip: "203.0.113.10",
    get() {
      return "";
    },
  };

  await redirectToOriginal(request, response);

  assert.equal(response.statusCode, 302);
  assert.equal(response.location, url.originalUrl);
  assert.equal(queuedEvent.urlId, url._id);
  assert.equal(queuedEvent.redirectTarget, url.originalUrl);
  assert.equal(queuedEvent.redirectTargetKind, "primary");
  assert.equal(queuedEvent.redirectStatus, 302);
  assert.equal(queuedEvent.healthRefreshRequested, true);
  assert.deepEqual(order, ["enqueue", "redirect", "wake"]);
});
