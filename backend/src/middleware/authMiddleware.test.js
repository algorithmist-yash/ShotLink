const assert = require("node:assert/strict");
const test = require("node:test");

const Session = require("../models/Session");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { deriveCsrfToken } = require("../utils/sessionCookieUtils");
const {
  getWorkspaceRole,
  requireAuth,
  requireWorkspaceAdmin,
  requireWorkspaceOwner,
  requireWorkspaceRole,
} = require("./authMiddleware");

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

function createAuthRequest(
  token = "test-session-token",
  { authMethod = "bearer", csrfToken = "", method = "GET" } = {}
) {
  return {
    method,
    get(name) {
      if (name === "authorization" && authMethod === "bearer") {
        return `Bearer ${token}`;
      }
      if (name === "cookie" && authMethod === "cookie") {
        return `shotlink_session=${encodeURIComponent(token)}`;
      }
      if (name === "x-csrf-token") return csrfToken;
      return "";
    },
  };
}

function stubAuthModels(t, { session, user, workspace }) {
  const originalFindSession = Session.findOne;
  const originalDeleteSession = Session.deleteOne;
  const originalFindUser = User.findById;
  const originalFindWorkspace = Workspace.findById;
  let deletedSessionFilter = null;

  Session.findOne = async () => session;
  Session.deleteOne = async (filter) => {
    deletedSessionFilter = filter;
    return { deletedCount: 1 };
  };
  User.findById = async () => user;
  Workspace.findById = async () => workspace;

  t.after(() => {
    Session.findOne = originalFindSession;
    Session.deleteOne = originalDeleteSession;
    User.findById = originalFindUser;
    Workspace.findById = originalFindWorkspace;
  });

  return {
    getDeletedSessionFilter() {
      return deletedSessionFilter;
    },
  };
}

test("workspace ownerId is authoritative even without a members entry", () => {
  assert.equal(
    getWorkspaceRole({ ownerId: "user-owner", members: [] }, "user-owner"),
    "owner"
  );
});

test("workspace roles resolve only for valid non-owner memberships", () => {
  const workspace = {
    ownerId: "user-owner",
    members: [
      { userId: "user-admin", role: "admin" },
      { userId: "user-member", role: "member" },
      { userId: "user-invalid-owner", role: "owner" },
    ],
  };

  assert.equal(getWorkspaceRole(workspace, "user-admin"), "admin");
  assert.equal(getWorkspaceRole(workspace, "user-member"), "member");
  assert.equal(getWorkspaceRole(workspace, "user-invalid-owner"), "");
  assert.equal(getWorkspaceRole(workspace, "user-unknown"), "");
});

test("requireAuth attaches the current workspace role", async (t) => {
  const session = {
    _id: "session-1",
    userId: "user-admin",
    workspaceId: "workspace-1",
  };
  const user = { _id: "user-admin", isActive: true };
  const workspace = {
    _id: "workspace-1",
    ownerId: "user-owner",
    members: [{ userId: "user-admin", role: "admin" }],
  };
  stubAuthModels(t, { session, user, workspace });
  const request = createAuthRequest();
  const response = createMockResponse();
  let nextCalled = false;

  await requireAuth(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(request.auth.workspaceRole, "admin");
  assert.equal(request.auth.workspace, workspace);
});

test("cookie authentication exposes a session-bound CSRF token", async (t) => {
  const token = "cookie-session-token";
  const session = {
    _id: "session-cookie",
    userId: "user-owner",
    workspaceId: "workspace-1",
  };
  const user = { _id: "user-owner", isActive: true };
  const workspace = {
    _id: "workspace-1",
    ownerId: "user-owner",
    members: [],
  };
  stubAuthModels(t, { session, user, workspace });
  const request = createAuthRequest(token, { authMethod: "cookie" });
  let nextCalled = false;

  await requireAuth(request, createMockResponse(), () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(request.auth.authMethod, "cookie");
  assert.equal(request.auth.csrfToken, deriveCsrfToken(token));
});

test("unsafe cookie requests require the matching CSRF header", async (t) => {
  const token = "cookie-session-token";
  const session = {
    _id: "session-cookie",
    userId: "user-owner",
    workspaceId: "workspace-1",
  };
  const user = { _id: "user-owner", isActive: true };
  const workspace = {
    _id: "workspace-1",
    ownerId: "user-owner",
    members: [],
  };
  stubAuthModels(t, { session, user, workspace });
  const deniedResponse = createMockResponse();

  await requireAuth(
    createAuthRequest(token, { authMethod: "cookie", method: "POST" }),
    deniedResponse,
    () => {}
  );

  let nextCalled = false;
  await requireAuth(
    createAuthRequest(token, {
      authMethod: "cookie",
      csrfToken: deriveCsrfToken(token),
      method: "POST",
    }),
    createMockResponse(),
    () => {
      nextCalled = true;
    }
  );

  assert.equal(deniedResponse.statusCode, 403);
  assert.deepEqual(deniedResponse.body, {
    error: "Invalid or missing CSRF token",
  });
  assert.equal(nextCalled, true);
});

test("unsafe bearer requests remain backward compatible without CSRF", async (t) => {
  const session = {
    _id: "session-bearer",
    userId: "user-owner",
    workspaceId: "workspace-1",
  };
  const user = { _id: "user-owner", isActive: true };
  const workspace = {
    _id: "workspace-1",
    ownerId: "user-owner",
    members: [],
  };
  stubAuthModels(t, { session, user, workspace });
  let nextCalled = false;

  await requireAuth(
    createAuthRequest("bearer-token", { method: "POST" }),
    createMockResponse(),
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
});

test("requireAuth rejects removed members and revokes their stale session", async (t) => {
  const session = {
    _id: "session-removed",
    userId: "user-removed",
    workspaceId: "workspace-1",
  };
  const user = { _id: "user-removed", isActive: true };
  const workspace = {
    _id: "workspace-1",
    ownerId: "user-owner",
    members: [],
  };
  const stubs = stubAuthModels(t, { session, user, workspace });
  const response = createMockResponse();
  let nextCalled = false;

  await requireAuth(createAuthRequest(), response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: "Workspace access denied" });
  assert.deepEqual(stubs.getDeletedSessionFilter(), { _id: "session-removed" });
});

test("owner-only authorization denies admins and allows owners", () => {
  const deniedResponse = createMockResponse();
  let deniedNextCalled = false;
  requireWorkspaceOwner(
    { auth: { workspaceRole: "admin" } },
    deniedResponse,
    () => {
      deniedNextCalled = true;
    }
  );

  let allowedNextCalled = false;
  requireWorkspaceOwner(
    { auth: { workspaceRole: "owner" } },
    createMockResponse(),
    () => {
      allowedNextCalled = true;
    }
  );

  assert.equal(deniedNextCalled, false);
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(allowedNextCalled, true);
});

test("workspace administration allows admins but denies members", () => {
  let adminNextCalled = false;
  requireWorkspaceAdmin(
    { auth: { workspaceRole: "admin" } },
    createMockResponse(),
    () => {
      adminNextCalled = true;
    }
  );
  const memberResponse = createMockResponse();

  requireWorkspaceAdmin(
    { auth: { workspaceRole: "member" } },
    memberResponse,
    () => {}
  );

  assert.equal(adminNextCalled, true);
  assert.equal(memberResponse.statusCode, 403);
});

test("role middleware rejects invalid configuration", () => {
  assert.throws(() => requireWorkspaceRole(), /valid workspace role/);
  assert.throws(
    () => requireWorkspaceRole("super-admin"),
    /valid workspace role/
  );
});
