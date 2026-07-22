const assert = require("node:assert/strict");
const test = require("node:test");

const { createRequestContext } = require("./requestContextMiddleware");

function runMiddleware(incomingRequestId) {
  const headers = {};
  const req = {
    get(name) {
      return name === "x-request-id" ? incomingRequestId : undefined;
    },
  };
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
  };
  let nextCalled = false;

  createRequestContext({ generateRequestId: () => "generated-id" })(req, res, () => {
    nextCalled = true;
  });

  return { headers, nextCalled, req };
}

test("request context preserves a safe upstream request ID", () => {
  const result = runMiddleware("railway-request_123:edge");

  assert.equal(result.req.id, "railway-request_123:edge");
  assert.equal(result.headers["X-Request-Id"], "railway-request_123:edge");
  assert.equal(result.nextCalled, true);
});

test("request context replaces missing or unsafe request IDs", () => {
  for (const incomingRequestId of [
    undefined,
    "contains spaces",
    "line-break\r\nvalue",
    "a".repeat(129),
  ]) {
    const result = runMiddleware(incomingRequestId);

    assert.equal(result.req.id, "generated-id");
    assert.equal(result.headers["X-Request-Id"], "generated-id");
    assert.equal(result.nextCalled, true);
  }
});
