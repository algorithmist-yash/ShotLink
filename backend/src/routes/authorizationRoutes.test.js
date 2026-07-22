const assert = require("node:assert/strict");
const test = require("node:test");

const billingRoutes = require("./billingRoutes");
const workspaceRoutes = require("./workspaceRoutes");

function createMockResponse() {
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

function getFirstRouteMiddleware(router, method, path) {
  const layer = router.stack.find(
    (candidate) => candidate.route?.path === path && candidate.route.methods[method]
  );

  assert.ok(layer, `${method.toUpperCase()} ${path} route should exist`);
  return layer.route.stack[0].handle;
}

function runRoleGuard(guard, workspaceRole) {
  const response = createMockResponse();
  let nextCalled = false;

  guard({ auth: { workspaceRole } }, response, () => {
    nextCalled = true;
  });

  return { nextCalled, response };
}

test("every monetary billing action is owner-only", () => {
  const routes = [
    ["post", "/payment-links"],
    ["post", "/subscriptions"],
    ["post", "/subscriptions/cancel"],
  ];

  for (const [method, path] of routes) {
    const guard = getFirstRouteMiddleware(billingRoutes, method, path);
    assert.equal(runRoleGuard(guard, "owner").nextCalled, true);
    assert.equal(runRoleGuard(guard, "admin").response.statusCode, 403);
    assert.equal(runRoleGuard(guard, "member").response.statusCode, 403);
  }
});

test("every custom-domain mutation is restricted to owners and admins", () => {
  const routes = [
    ["post", "/domains"],
    ["post", "/domains/:hostname/verify"],
    ["patch", "/domains/:hostname/primary"],
    ["delete", "/domains/:hostname"],
  ];

  for (const [method, path] of routes) {
    const guard = getFirstRouteMiddleware(workspaceRoutes, method, path);
    assert.equal(runRoleGuard(guard, "owner").nextCalled, true);
    assert.equal(runRoleGuard(guard, "admin").nextCalled, true);
    assert.equal(runRoleGuard(guard, "member").response.statusCode, 403);
  }
});
