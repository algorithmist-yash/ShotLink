const assert = require("node:assert/strict");
const test = require("node:test");

const Session = require("../models/Session");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { hashPassword, hashSessionToken } = require("../utils/authUtils");
const { login, logout } = require("./authController");

function createResponse() {
  return {
    body: null,
    clearedCookies: [],
    cookies: [],
    statusCode: 200,
    clearCookie(...args) {
      this.clearedCookies.push(args);
      return this;
    },
    cookie(...args) {
      this.cookies.push(args);
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

test("login rotates a prior cookie and issues secure browser session material", async (t) => {
  const originalFindUser = User.findOne;
  const originalFindWorkspace = Workspace.findById;
  const originalCreateSession = Session.create;
  const originalDeleteSession = Session.deleteOne;
  const password = "StrongPassword1";
  const user = {
    _id: "user-1",
    name: "Owner",
    email: "owner@example.com",
    passwordHash: await hashPassword(password),
    defaultWorkspaceId: "workspace-1",
    compliance: {},
    async save() {},
  };
  const workspace = {
    _id: "workspace-1",
    name: "Owner workspace",
    slug: "owner-workspace",
    ownerId: "user-1",
    members: [{ userId: "user-1", role: "owner" }],
    customDomains: [],
    plan: "free",
    billing: {},
  };
  const deletedFilters = [];
  let createdSession = null;

  User.findOne = async () => user;
  Workspace.findById = async () => workspace;
  Session.deleteOne = async (filter) => {
    deletedFilters.push(filter);
    return { deletedCount: 1 };
  };
  Session.create = async (session) => {
    createdSession = session;
    return { _id: "new-session", ...session };
  };

  t.after(() => {
    User.findOne = originalFindUser;
    Workspace.findById = originalFindWorkspace;
    Session.create = originalCreateSession;
    Session.deleteOne = originalDeleteSession;
  });

  const request = {
    body: { email: user.email, password },
    get(name) {
      if (name === "cookie") return "shotlink_session=previous-cookie-token";
      if (name === "user-agent") return "test-agent";
      return "";
    },
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
  };
  const response = createResponse();

  await login(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.cookies.length, 1);
  assert.equal(response.cookies[0][0], "shotlink_session");
  assert.equal(response.cookies[0][1], response.body.token);
  assert.equal(response.cookies[0][2].httpOnly, true);
  assert.equal(response.cookies[0][2].sameSite, "lax");
  assert.equal(response.cookies[0][2].secure, false);
  assert.equal(typeof response.body.csrfToken, "string");
  assert.ok(response.body.csrfToken.length > 20);
  assert.equal(createdSession.tokenHash, hashSessionToken(response.body.token));
  assert.deepEqual(deletedFilters[0], {
    tokenHash: hashSessionToken("previous-cookie-token"),
  });
});

test("logout revokes the database session and expires the browser cookie", async (t) => {
  const originalDeleteSession = Session.deleteOne;
  let deletedFilter = null;

  Session.deleteOne = async (filter) => {
    deletedFilter = filter;
    return { deletedCount: 1 };
  };
  t.after(() => {
    Session.deleteOne = originalDeleteSession;
  });

  const response = createResponse();
  await logout({ auth: { session: { _id: "session-logout" } } }, response);

  assert.deepEqual(deletedFilter, { _id: "session-logout" });
  assert.equal(response.clearedCookies.length, 1);
  assert.equal(response.clearedCookies[0][0], "shotlink_session");
  assert.deepEqual(response.body, { message: "Logged out" });
});
