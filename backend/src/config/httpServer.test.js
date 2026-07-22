const assert = require("node:assert/strict");
const test = require("node:test");

const { configureHttpServer, HTTP_SERVER_LIMITS } = require("./httpServer");

test("HTTP server limits bound slow and long-lived connections", () => {
  const server = {
    setTimeout(timeout) {
      this.timeout = timeout;
    },
  };

  assert.equal(configureHttpServer(server), server);
  assert.equal(server.headersTimeout, HTTP_SERVER_LIMITS.headersTimeoutMs);
  assert.equal(server.requestTimeout, HTTP_SERVER_LIMITS.requestTimeoutMs);
  assert.equal(server.timeout, HTTP_SERVER_LIMITS.idleTimeoutMs);
  assert.equal(server.keepAliveTimeout, HTTP_SERVER_LIMITS.keepAliveTimeoutMs);
  assert.equal(server.maxRequestsPerSocket, HTTP_SERVER_LIMITS.maxRequestsPerSocket);
  assert.ok(server.headersTimeout < server.requestTimeout);
});
