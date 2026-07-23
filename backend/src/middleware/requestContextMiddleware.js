const { randomUUID } = require("node:crypto");

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function getIncomingRequestId(req) {
  const value =
    typeof req.get === "function"
      ? req.get("x-request-id")
      : req.headers?.["x-request-id"];

  return typeof value === "string" && REQUEST_ID_PATTERN.test(value)
    ? value
    : null;
}

function createRequestContext({ generateRequestId = randomUUID } = {}) {
  return (req, res, next) => {
    const requestId = getIncomingRequestId(req) || generateRequestId();

    req.id = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  };
}

module.exports = {
  REQUEST_ID_PATTERN,
  createRequestContext,
  requestContext: createRequestContext(),
};
