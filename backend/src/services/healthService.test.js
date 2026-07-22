const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const {
  HEALTH_REFRESH_LEASE_MS,
  HEALTH_TTL_MS,
  checkDestinationHealth,
  needsHealthRefresh,
  refreshUrlHealth,
  refreshUrlHealthWithLease,
  selectRedirectTarget,
  validatePublicDestination,
} = require("./healthService");

test("health changes invalidate cached redirect targets after persistence", async () => {
  const events = [];
  const url = {
    originalUrl: "https://primary.example.com",
    primaryHealth: {},
    fallbackUrls: [],
    async save() {
      events.push("saved");
    },
  };

  await refreshUrlHealth(url, {
    checkHealth: async () => ({
      status: "healthy",
      statusCode: 200,
      checkedAt: new Date("2026-07-20T12:00:00.000Z"),
      failureReason: "",
    }),
    invalidateRoute: async (persistedUrl) => {
      assert.equal(persistedUrl, url);
      events.push("invalidated");
    },
  });

  assert.deepEqual(events, ["saved", "invalidated"]);
});

function createRequestStub(statusCodes, onRequest) {
  const remainingStatusCodes = [...statusCodes];

  return (url, options, callback) => {
    const request = new EventEmitter();

    request.destroy = (error) => {
      if (error) request.emit("error", error);
    };
    request.end = () => {
      options.lookup(url.hostname, { all: true }, (error, addresses) => {
        if (error) {
          request.emit("error", error);
          return;
        }

        onRequest({ addresses, method: options.method });
        callback({
          statusCode: remainingStatusCodes.shift(),
          destroy() {},
        });
      });
    };

    return request;
  };
}

test("selectRedirectTarget prefers a healthy primary destination", () => {
  const selection = selectRedirectTarget({
    originalUrl: "https://primary.example.com",
    primaryHealth: { status: "healthy" },
    fallbackUrls: [
      { url: "https://backup.example.com", label: "Fallback 1", priority: 0, isActive: true, lastStatus: "healthy" },
    ],
  });

  assert.equal(selection.kind, "primary");
  assert.equal(selection.url, "https://primary.example.com");
});

test("selectRedirectTarget falls back when the primary is unhealthy", () => {
  const selection = selectRedirectTarget({
    originalUrl: "https://primary.example.com",
    primaryHealth: { status: "unhealthy" },
    fallbackUrls: [
      { url: "https://backup-1.example.com", label: "Fallback 1", priority: 0, isActive: true, lastStatus: "healthy" },
      { url: "https://backup-2.example.com", label: "Fallback 2", priority: 1, isActive: true, lastStatus: "unknown" },
    ],
  });

  assert.equal(selection.kind, "fallback");
  assert.equal(selection.url, "https://backup-1.example.com");
});

test("needsHealthRefresh returns true when no recent primary health check exists", () => {
  assert.equal(needsHealthRefresh({ primaryHealth: { lastCheckedAt: null } }), true);
  assert.equal(
    needsHealthRefresh({
      primaryHealth: { lastCheckedAt: new Date(Date.now() - HEALTH_TTL_MS - 1000).toISOString() },
    }),
    true
  );
  assert.equal(
    needsHealthRefresh({
      primaryHealth: { lastCheckedAt: new Date().toISOString() },
    }),
    false
  );
});

test("validatePublicDestination rejects DNS answers to private network addresses", async () => {
  await assert.rejects(
    () =>
      validatePublicDestination("https://internal.example.com", async () => [
        { address: "10.0.0.5", family: 4 },
      ]),
    /private or local/
  );

  await assert.doesNotReject(() =>
    validatePublicDestination("https://public.example.com", async () => [
      { address: "93.184.216.34", family: 4 },
    ])
  );
});

test("checkDestinationHealth pins the request to the validated DNS answer", async () => {
  let resolverCalls = 0;
  const requests = [];
  const lookup = async () => {
    resolverCalls += 1;

    return resolverCalls === 1
      ? [{ address: "93.184.216.34", family: 4 }]
      : [{ address: "127.0.0.1", family: 4 }];
  };
  const request = createRequestStub([204], (requestDetails) => {
    requests.push(requestDetails);
  });

  const snapshot = await checkDestinationHealth("https://rebind.example.com/status", {
    lookup,
    request,
  });

  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.statusCode, 204);
  assert.equal(resolverCalls, 1);
  assert.deepEqual(requests, [
    {
      addresses: [{ address: "93.184.216.34", family: 4 }],
      method: "HEAD",
    },
  ]);
});

test("checkDestinationHealth reuses validated DNS answers for its GET fallback", async () => {
  let resolverCalls = 0;
  const requests = [];
  const request = createRequestStub([405, 200], (requestDetails) => {
    requests.push(requestDetails);
  });

  const snapshot = await checkDestinationHealth("https://public.example.com/status", {
    lookup: async () => {
      resolverCalls += 1;
      return [{ address: "93.184.216.34", family: 4 }];
    },
    request,
  });

  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.statusCode, 200);
  assert.equal(resolverCalls, 1);
  assert.deepEqual(
    requests.map(({ method }) => method),
    ["HEAD", "GET"]
  );
  assert.ok(
    requests.every(
      ({ addresses }) =>
        addresses.length === 1 && addresses[0].address === "93.184.216.34"
    )
  );
});

test("refreshUrlHealthWithLease allows only one concurrent refresh per URL", async () => {
  const url = { _id: "url-1" };
  let leaseClaimed = false;
  let refreshCalls = 0;
  let releaseCalls = 0;
  let resolveRefresh;
  const refreshFinished = new Promise((resolve) => {
    resolveRefresh = resolve;
  });
  const dependencies = {
    now: () => new Date("2026-07-16T12:00:00.000Z"),
    createLeaseToken: () => "lease-1",
    claimLease: async (_filter, update) => {
      if (leaseClaimed) return null;
      leaseClaimed = true;
      assert.equal(
        update.$set["healthRefreshLease.expiresAt"].getTime(),
        new Date("2026-07-16T12:00:00.000Z").getTime() +
          HEALTH_REFRESH_LEASE_MS
      );
      return url;
    },
    refresh: async (leasedUrl) => {
      refreshCalls += 1;
      assert.equal(leasedUrl, url);
      await refreshFinished;
    },
    releaseLease: async (filter) => {
      releaseCalls += 1;
      assert.equal(filter["healthRefreshLease.token"], "lease-1");
    },
  };

  const firstRefresh = refreshUrlHealthWithLease("url-1", dependencies);
  const secondRefresh = await refreshUrlHealthWithLease("url-1", dependencies);

  assert.equal(secondRefresh, false);
  assert.equal(refreshCalls, 1);
  assert.equal(releaseCalls, 0);

  resolveRefresh();
  assert.equal(await firstRefresh, true);
  assert.equal(releaseCalls, 1);
});

test("refreshUrlHealthWithLease releases its lease after a failed refresh", async () => {
  let released = false;

  await assert.rejects(
    () =>
      refreshUrlHealthWithLease("url-2", {
        now: () => new Date("2026-07-16T12:00:00.000Z"),
        createLeaseToken: () => "lease-2",
        claimLease: async () => ({ _id: "url-2" }),
        refresh: async () => {
          throw new Error("health request failed");
        },
        releaseLease: async () => {
          released = true;
        },
      }),
    /health request failed/
  );

  assert.equal(released, true);
});
