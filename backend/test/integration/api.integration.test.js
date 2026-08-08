const assert = require("node:assert/strict");
const test = require("node:test");

const mongoose = require("mongoose");

const {
  HttpTestClient,
  startIntegrationEnvironment,
} = require("./harness");

const ACCOUNT_CONSENTS = Object.freeze({
  ageConfirmed: true,
  analyticsAccepted: true,
  lawfulUseAccepted: true,
  privacyAccepted: true,
  termsAccepted: true,
});
const LINK_COMPLIANCE = Object.freeze({
  abusePolicyAccepted: true,
  destinationAuthorityAccepted: true,
  securityScanAccepted: true,
});

function registrationPayload(overrides = {}) {
  return {
    name: "Integration Owner",
    email: "owner@integration.test",
    password: "StrongPass123",
    workspaceName: "Integration Workspace",
    consents: ACCOUNT_CONSENTS,
    ...overrides,
  };
}

test(
  "real MongoDB replica-set API integration",
  { timeout: 300_000 },
  async (t) => {
    const environment = await startIntegrationEnvironment();

    try {
      await t.test("production indexes are created and enforced by MongoDB", async () => {
        await environment.resetDatabase();
        const User = require("../../src/models/User");
        const AuditEvent = require("../../src/models/AuditEvent");
        const ClickEvent = require("../../src/models/ClickEvent");
        const Url = require("../../src/models/Url");
        const UrlHealthJob = require("../../src/models/UrlHealthJob");
        const RedirectEventJob = require("../../src/models/RedirectEventJob");

        const [userIndexes, urlIndexes, healthIndexes, redirectIndexes, clickIndexes, auditIndexes] = await Promise.all([
          User.collection.indexes(),
          Url.collection.indexes(),
          UrlHealthJob.collection.indexes(),
          RedirectEventJob.collection.indexes(),
          ClickEvent.collection.indexes(),
          AuditEvent.collection.indexes(),
        ]);
        assert.equal(userIndexes.find((index) => index.name === "email_1")?.unique, true);
        assert.equal(urlIndexes.find((index) => index.name === "shortCode_1")?.unique, true);
        assert.ok(redirectIndexes.some((index) => index.name === "redirect_jobs_available"));
        assert.equal(
          redirectIndexes.find((index) => index.name === "redirect_jobs_ttl")?.expireAfterSeconds,
          0
        );
        assert.equal(
          clickIndexes.find((index) => index.name === "click_events_ttl")?.expireAfterSeconds,
          0
        );
        assert.equal(
          auditIndexes.find((index) => index.name === "audit_events_ttl")?.expireAfterSeconds,
          0
        );
        const activeHealthIndex = healthIndexes.find(
          (index) => index.name === "url_health_jobs_one_active_per_url"
        );
        assert.equal(activeHealthIndex?.unique, true);
        assert.deepEqual(activeHealthIndex?.partialFilterExpression, { active: true });

        const baseUser = {
          name: "Index Test",
          email: "unique@integration.test",
          passwordHash: "not-a-real-login-hash",
        };
        await User.create(baseUser);
        await assert.rejects(User.create(baseUser), (error) => error?.code === 11000);
      });

      await t.test("active-link plan limits remain exact under concurrent creates", async () => {
        await environment.resetDatabase();
        const Url = require("../../src/models/Url");
        const Workspace = require("../../src/models/Workspace");

        const owner = new HttpTestClient(environment.baseUrl);
        const registration = await owner.request("/api/v1/auth/register", {
          method: "POST",
          body: registrationPayload({
            email: "quota-race@integration.test",
            workspaceName: "Quota Race Workspace",
          }),
        });
        assert.equal(registration.status, 201);

        const workspaceId = registration.body.workspace.id;
        await Url.insertMany(
          Array.from({ length: 9 }, (_, index) => ({
            workspaceId,
            originalUrl: `https://example.com/quota-seed-${index}`,
            shortCode: `quota-seed-${index}`,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          }))
        );

        const attempts = await Promise.all(
          Array.from({ length: 5 }, (_, index) =>
            owner.request("/api/v1/links", {
              method: "POST",
              headers: { "X-CSRF-Token": registration.body.csrfToken },
              body: {
                originalUrl: `https://example.com/quota-race-${index}`,
                customAlias: `quota-race-${index}`,
                expiresInMinutes: 60,
                compliance: LINK_COMPLIANCE,
              },
            })
          )
        );

        assert.deepEqual(
          attempts.map((attempt) => attempt.status).sort(),
          [201, 403, 403, 403, 403]
        );
        assert.equal(
          await Url.countDocuments({
            workspaceId,
            isActive: true,
            expiresAt: { $gt: new Date() },
          }),
          10
        );
        assert.equal(
          (await Workspace.findById(workspaceId)).billing.linkCreationVersion,
          1
        );
      });

      await t.test(
        "registration, sessions, links, redirects, transactions, analytics, and isolation work over HTTP",
        async () => {
          await environment.resetDatabase();
          const ClickEvent = require("../../src/models/ClickEvent");
          const AuditEvent = require("../../src/models/AuditEvent");
          const RedirectEventJob = require("../../src/models/RedirectEventJob");
          const Session = require("../../src/models/Session");
          const Url = require("../../src/models/Url");
          const UsageCounter = require("../../src/models/UsageCounter");
          const User = require("../../src/models/User");
          const Workspace = require("../../src/models/Workspace");
          const {
            claimRedirectEventJob,
            processClaimedRedirectEvent,
          } = require("../../src/services/redirectEventService");

          const owner = new HttpTestClient(environment.baseUrl);
          const registration = await owner.request("/api/v1/auth/register", {
            method: "POST",
            body: registrationPayload(),
          });

          assert.equal(registration.status, 201);
          assert.match(owner.cookie, /^shotlink_session=/);
          assert.ok(registration.body.csrfToken.length > 20);
          assert.equal(registration.body.workspace.memberCount, 1);

          const [savedUser, savedWorkspace, savedSession] = await Promise.all([
            User.findOne({ email: "owner@integration.test" }),
            Workspace.findOne({ slug: "integration-workspace" }),
            Session.findOne({}),
          ]);
          assert.equal(String(savedUser.defaultWorkspaceId), String(savedWorkspace._id));
          assert.equal(String(savedWorkspace.ownerId), String(savedUser._id));
          assert.equal(String(savedSession.userId), String(savedUser._id));
          assert.ok(registration.body.token.length > 20);
          assert.notEqual(savedSession.tokenHash, registration.body.token);

          const duplicate = await new HttpTestClient(environment.baseUrl).request(
            "/api/v1/auth/register",
            { method: "POST", body: registrationPayload() }
          );
          assert.equal(duplicate.status, 409);

          const invalidLogin = await owner.request("/api/v1/auth/login", {
            method: "POST",
            body: { email: "owner@integration.test", password: "WrongPass123" },
          });
          assert.equal(invalidLogin.status, 401);

          const login = await owner.request("/api/v1/auth/login", {
            method: "POST",
            body: { email: "owner@integration.test", password: "StrongPass123" },
          });
          assert.equal(login.status, 200);
          assert.equal(await Session.countDocuments({ userId: savedUser._id }), 1);
          const csrfToken = login.body.csrfToken;

          const currentSession = await owner.request("/api/v1/auth/me");
          assert.equal(currentSession.status, 200);
          assert.equal(currentSession.body.user.email, "owner@integration.test");

          const [workspaceSettings, billingSummary] = await Promise.all([
            owner.request("/api/v1/workspace"),
            owner.request("/api/v1/billing/summary"),
          ]);
          assert.equal(workspaceSettings.status, 200);
          assert.equal(billingSummary.status, 200);
          assert.equal(billingSummary.body.currentPlan.effectivePlanId, "free");

          savedWorkspace.plan = "business";
          savedWorkspace.billing.status = "active";
          savedWorkspace.billing.currentPeriodEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await savedWorkspace.save();

          const domain = await owner.request("/api/v1/workspace/domains", {
            method: "POST",
            headers: { "X-CSRF-Token": csrfToken },
            body: { hostname: "brand.integration.test" },
          });
          assert.equal(domain.status, 201);
          assert.equal(domain.body.workspace.customDomains[0].status, "pending");
          const duplicateDomain = await owner.request("/api/v1/workspace/domains", {
            method: "POST",
            headers: { "X-CSRF-Token": csrfToken },
            body: { hostname: "brand.integration.test" },
          });
          assert.equal(duplicateDomain.status, 200);

          const workspaceWithDomain = await Workspace.findById(savedWorkspace._id);
          workspaceWithDomain.customDomains[0].status = "verified";
          await workspaceWithDomain.save();
          assert.equal(
            (await owner.request("/api/v1/workspace/domains/brand.integration.test/primary", {
              method: "PATCH",
              headers: { "X-CSRF-Token": csrfToken },
            })).status,
            200
          );
          assert.equal(
            (await owner.request("/api/v1/workspace/domains/brand.integration.test", {
              method: "DELETE",
              headers: { "X-CSRF-Token": csrfToken },
            })).status,
            200
          );

          const missingCsrf = await owner.request("/api/v1/links", {
            method: "POST",
            body: { originalUrl: "https://example.com" },
          });
          assert.equal(missingCsrf.status, 403);
          assert.equal(await Url.countDocuments({}), 0);

          const linkResponse = await owner.request("/api/v1/links", {
            method: "POST",
            headers: { "X-CSRF-Token": csrfToken },
            body: {
              originalUrl: "https://example.com/campaign",
              customAlias: "integration-link",
              expiresInMinutes: 60,
              fallbackUrls: ["https://www.iana.org/help/example-domains"],
              compliance: LINK_COMPLIANCE,
            },
          });
          assert.equal(linkResponse.status, 201);
          assert.equal(linkResponse.body.link.shortCode, "integration-link");
          assert.equal(linkResponse.body.link.primaryHealth.status, "healthy");

          const listedLinks = await owner.request("/api/v1/links");
          assert.equal(listedLinks.status, 200);
          assert.equal(listedLinks.body.links.length, 1);
          const refreshedHealth = await owner.request(
            "/api/v1/links/integration-link/health-check",
            { method: "POST", headers: { "X-CSRF-Token": csrfToken } }
          );
          assert.equal(refreshedHealth.status, 200);

          const savedUrl = await Url.findOne({ shortCode: "integration-link" });
          const usageAfterCreate = await UsageCounter.findOne({
            workspaceId: savedWorkspace._id,
          });
          assert.equal(String(savedUrl.compliance.acceptedBy), String(savedUser._id));
          assert.ok(savedUrl.compliance.destinationAuthorityAcceptedAt instanceof Date);
          assert.equal(usageAfterCreate.linksCreated, 1);

          const redirect = await new HttpTestClient(environment.baseUrl).request(
            "/integration-link",
            { headers: { "User-Agent": "Integration Browser" } }
          );
          assert.equal(redirect.status, 302);
          assert.equal(redirect.headers.get("location"), "https://example.com/campaign");

          const queuedJob = await RedirectEventJob.findOne({ shortCode: "integration-link" });
          assert.equal(queuedJob.status, "pending");
          assert.equal(queuedJob.healthRefreshRequested, false);

          const claimedJob = await claimRedirectEventJob();
          assert.equal(claimedJob.status, "processing");
          assert.equal(await processClaimedRedirectEvent(claimedJob), true);

          const [completedJob, clickEvent, countedUrl, usageAfterRedirect] = await Promise.all([
            RedirectEventJob.findById(queuedJob._id),
            ClickEvent.findOne({ ingestionKey: String(queuedJob._id) }),
            Url.findById(savedUrl._id),
            UsageCounter.findOne({ workspaceId: savedWorkspace._id }),
          ]);
          assert.equal(completedJob.status, "completed");
          assert.equal(clickEvent.redirectStatus, 302);
          assert.ok(clickEvent.expiresAt instanceof Date);
          assert.ok(clickEvent.expiresAt > clickEvent.clickedAt);
          assert.equal(countedUrl.clicks, 1);
          assert.equal(usageAfterRedirect.clicks, 1);

          const rollbackJob = await RedirectEventJob.create({
            urlId: savedUrl._id,
            workspaceId: savedWorkspace._id,
            shortCode: "integration-link",
            clickedAt: new Date(),
            deviceType: "desktop",
            browser: "Integration Browser",
            os: "Integration OS",
            userAgent: "transaction-rollback-test",
            redirectTarget: savedUrl.originalUrl,
            redirectTargetKind: "primary",
            redirectStatus: 302,
            availableAt: new Date(),
            attempts: 0,
            status: "pending",
          });
          const claimedRollbackJob = await claimRedirectEventJob();
          await assert.rejects(
            processClaimedRedirectEvent(claimedRollbackJob, {
              UrlModel: {
                async updateOne() {
                  throw new Error("injected transaction failure");
                },
              },
            }),
            /injected transaction failure/
          );
          assert.equal(
            await ClickEvent.countDocuments({ ingestionKey: String(rollbackJob._id) }),
            0
          );
          assert.equal((await Url.findById(savedUrl._id)).clicks, 1);

          const analytics = await owner.request(
            "/api/v1/links/integration-link/analytics"
          );
          const events = await owner.request(
            "/api/v1/links/integration-link/events?limit=10"
          );
          assert.equal(analytics.status, 200);
          assert.equal(analytics.body.clicks, 1);
          assert.equal(analytics.body.deviceBreakdown[0].count, 1);
          assert.equal(events.status, 200);
          assert.equal(events.body.events.length, 1);

          const auditResponse = await owner.request("/api/v1/workspace/audit-events?limit=20");
          assert.equal(auditResponse.status, 200);
          assert.ok(
            auditResponse.body.events.some((event) => event.action === "account.registered")
          );
          assert.ok(auditResponse.body.events.some((event) => event.action === "session.login"));
          assert.ok(auditResponse.body.events.some((event) => event.action === "link.created"));
          assert.ok(auditResponse.body.events.some((event) => event.action === "domain.added"));
          assert.ok(await AuditEvent.countDocuments({ workspaceId: savedWorkspace._id }) >= 3);

          const expiredLink = await owner.request("/api/v1/links/integration-link/expire", {
            method: "PATCH",
            headers: { "X-CSRF-Token": csrfToken },
          });
          assert.equal(expiredLink.status, 200);

          const outsider = new HttpTestClient(environment.baseUrl);
          const outsiderRegistration = await outsider.request("/api/v1/auth/register", {
            method: "POST",
            body: registrationPayload({
              name: "Integration Outsider",
              email: "outsider@integration.test",
              workspaceName: "Outsider Workspace",
            }),
          });
          assert.equal(outsiderRegistration.status, 201);
          const isolatedAnalytics = await outsider.request(
            "/api/v1/links/integration-link/analytics"
          );
          assert.equal(isolatedAnalytics.status, 404);

          const logout = await owner.request("/api/v1/auth/logout", {
            method: "POST",
            headers: { "X-CSRF-Token": csrfToken },
          });
          assert.equal(logout.status, 200);
          assert.equal(owner.cookie, "");
          assert.equal(await Session.countDocuments({ userId: savedUser._id }), 0);
          assert.equal((await owner.request("/api/v1/auth/me")).status, 401);

          assert.equal(mongoose.connection.readyState, 1);
        }
      );
    } finally {
      await environment.stop();
    }
  }
);
