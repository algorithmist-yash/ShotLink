const assert = require("node:assert/strict");
const test = require("node:test");

const Session = require("../models/Session");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const emailService = require("../services/emailService");
const { hashPassword, hashSessionToken } = require("../utils/authUtils");
const {
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} = require("./authController");

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

test("registration cannot create a shadow workspace for a governed institution domain", async (t) => {
  const originalUserExists = User.exists;
  const originalWorkspaceFindOne = Workspace.findOne;

  User.exists = async () => false;
  Workspace.findOne = () => ({
    select() {
      return this;
    },
    async lean() {
      return { name: "Acme University", slug: "acme-university" };
    },
  });

  t.after(() => {
    User.exists = originalUserExists;
    Workspace.findOne = originalWorkspaceFindOne;
  });

  const request = {
    body: {
      name: "Faculty Member",
      email: "faculty@acme.edu",
      password: "StrongPassword1",
      workspaceName: "Shadow workspace",
      consents: {
        ageConfirmed: true,
        termsAccepted: true,
        privacyAccepted: true,
        analyticsAccepted: true,
        lawfulUseAccepted: true,
      },
    },
    get() {
      return "";
    },
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
  };
  const response = createResponse();

  await register(request, response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "INSTITUTION_DOMAIN_MANAGED");
  assert.match(response.body.error, /Acme University/);
});

test("password reset requests do not reveal whether an account exists", async (t) => {
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const originalSendPasswordResetEmail = emailService.sendPasswordResetEmail;
  let deliveryCount = 0;

  User.findOneAndUpdate = async () => null;
  emailService.sendPasswordResetEmail = async () => {
    deliveryCount += 1;
  };
  t.after(() => {
    User.findOneAndUpdate = originalFindOneAndUpdate;
    emailService.sendPasswordResetEmail = originalSendPasswordResetEmail;
  });

  const missingAccountResponse = createResponse();
  await requestPasswordReset(
    { body: { email: "missing@example.com" } },
    missingAccountResponse
  );
  const malformedEmailResponse = createResponse();
  await requestPasswordReset({ body: { email: "not-an-email" } }, malformedEmailResponse);

  assert.equal(missingAccountResponse.statusCode, 202);
  assert.equal(malformedEmailResponse.statusCode, 202);
  assert.deepEqual(missingAccountResponse.body, malformedEmailResponse.body);
  assert.equal(deliveryCount, 0);
});

test("password reset stores a hashed token and sends only the raw action token", async (t) => {
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const originalSendPasswordResetEmail = emailService.sendPasswordResetEmail;
  const user = {
    _id: "user-reset",
    name: "Owner",
    email: "owner@example.com",
    passwordResetRequestedAt: null,
    async save() {},
  };
  let delivered = null;

  User.findOneAndUpdate = async (filter, update, options) => {
    assert.equal(filter.email, user.email);
    assert.equal(options.returnDocument, "after");
    Object.assign(user, update.$set);
    return user;
  };
  emailService.sendPasswordResetEmail = async (payload) => {
    delivered = payload;
  };
  t.after(() => {
    User.findOneAndUpdate = originalFindOneAndUpdate;
    emailService.sendPasswordResetEmail = originalSendPasswordResetEmail;
  });

  const response = createResponse();
  await requestPasswordReset({ body: { email: user.email } }, response);

  assert.equal(response.statusCode, 202);
  assert.ok(user.passwordResetExpiresAt > new Date());
  assert.equal(user.passwordResetTokenHash, hashSessionToken(delivered.token));
  assert.equal(delivered.tokenHash, user.passwordResetTokenHash);
  assert.notEqual(delivered.token, user.passwordResetTokenHash);
});

test("resetting a password consumes the token and revokes every session", async (t) => {
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const originalDeleteMany = Session.deleteMany;
  const oldHash = await hashPassword("OldPassword1");
  const user = {
    _id: "user-reset",
    defaultWorkspaceId: null,
    passwordHash: oldHash,
    passwordResetTokenHash: "stored",
    passwordResetExpiresAt: new Date(Date.now() + 60_000),
    passwordResetRequestedAt: new Date(),
    async save() {},
  };
  let revokedFilter = null;

  User.findOneAndUpdate = async (filter, update, options) => {
    assert.equal(filter.passwordResetTokenHash, hashSessionToken("raw-reset-token"));
    assert.equal(options.returnDocument, "after");
    Object.assign(user, update.$set);
    return user;
  };
  Session.deleteMany = async (filter) => {
    revokedFilter = filter;
    return { deletedCount: 2 };
  };
  t.after(() => {
    User.findOneAndUpdate = originalFindOneAndUpdate;
    Session.deleteMany = originalDeleteMany;
  });

  const response = createResponse();
  await resetPassword(
    { body: { token: "raw-reset-token", password: "NewPassword2" } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(revokedFilter, { userId: user._id });
  assert.equal(user.passwordResetTokenHash, "");
  assert.equal(user.passwordResetExpiresAt, null);
  assert.equal(await require("../utils/authUtils").verifyPassword("NewPassword2", user.passwordHash), true);
  assert.equal(response.clearedCookies.length, 1);
});

test("email verification consumes a valid single-use token", async (t) => {
  const originalFindOneAndUpdate = User.findOneAndUpdate;
  const user = {
    _id: "user-verify",
    defaultWorkspaceId: null,
    emailVerificationTokenHash: "stored",
    emailVerificationExpiresAt: new Date(Date.now() + 60_000),
    emailVerifiedAt: null,
    async save() {},
  };

  User.findOneAndUpdate = async (filter, update, options) => {
    assert.equal(filter.emailVerificationTokenHash, hashSessionToken("raw-verify-token"));
    assert.equal(options.returnDocument, "after");
    Object.assign(user, update.$set);
    return user;
  };
  t.after(() => {
    User.findOneAndUpdate = originalFindOneAndUpdate;
  });

  const response = createResponse();
  await verifyEmail({ body: { token: "raw-verify-token" } }, response);

  assert.equal(response.statusCode, 200);
  assert.ok(user.emailVerifiedAt instanceof Date);
  assert.equal(user.emailVerificationTokenHash, "");
  assert.equal(user.emailVerificationExpiresAt, null);
});
