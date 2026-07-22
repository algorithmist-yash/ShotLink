const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createErrorHandler,
  notFoundHandler,
} = require("./errorMiddleware");

function createResponse() {
  return {
    body: null,
    headersSent: false,
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

test("unknown routes return a correlated JSON response", () => {
  const res = createResponse();

  notFoundHandler({ id: "request-404" }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    error: "Route not found",
    requestId: "request-404",
  });
});

test("error handler hides internal details and logs diagnostic context", () => {
  const messages = [];
  const res = createResponse();
  const error = new Error("database password leaked in failure");

  createErrorHandler({ logger: { error: (message) => messages.push(message) } })(
    {
      ...error,
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    {
      id: "request-500",
      method: "POST",
      originalUrl: "/api/v1/links?token=secret",
    },
    res,
    () => {}
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: "Internal server error",
    requestId: "request-500",
  });

  const logged = JSON.parse(messages[0]);
  assert.equal(logged.requestId, "request-500");
  assert.equal(logged.path, "/api/v1/links");
  assert.equal(logged.errorMessage, error.message);
  assert.equal(messages[0].includes("token=secret"), false);
});

test("explicitly exposed client errors keep their safe message", () => {
  const res = createResponse();
  const error = Object.assign(new Error("CORS origin not allowed"), {
    status: 403,
    expose: true,
  });

  createErrorHandler({ logger: { error() {} } })(
    error,
    { id: "request-403", method: "GET", path: "/api/v1/links" },
    res,
    () => {}
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: "CORS origin not allowed",
    requestId: "request-403",
  });
});

test("errors after headers are sent remain delegated to Express", () => {
  const error = new Error("stream failed");
  const res = { headersSent: true };
  let delegatedError;

  createErrorHandler({ logger: { error() {} } })(
    error,
    {},
    res,
    (receivedError) => {
      delegatedError = receivedError;
    }
  );

  assert.equal(delegatedError, error);
});
