const HTTP_SERVER_LIMITS = Object.freeze({
  headersTimeoutMs: 15000,
  requestTimeoutMs: 30000,
  idleTimeoutMs: 30000,
  keepAliveTimeoutMs: 5000,
  maxRequestsPerSocket: 1000,
});

function configureHttpServer(server, limits = HTTP_SERVER_LIMITS) {
  server.headersTimeout = limits.headersTimeoutMs;
  server.requestTimeout = limits.requestTimeoutMs;
  server.keepAliveTimeout = limits.keepAliveTimeoutMs;
  server.maxRequestsPerSocket = limits.maxRequestsPerSocket;
  server.setTimeout(limits.idleTimeoutMs);

  return server;
}

module.exports = {
  configureHttpServer,
  HTTP_SERVER_LIMITS,
};
