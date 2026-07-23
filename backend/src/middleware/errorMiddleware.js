const { getSafeRequestPath } = require("./requestLoggerMiddleware");

function getErrorStatusCode(error) {
  const statusCode = Number(error.statusCode || error.status);

  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
    ? statusCode
    : 500;
}

function getPublicErrorMessage(error, statusCode) {
  if (statusCode >= 500) {
    return "Internal server error";
  }

  if (error.expose === true) {
    return error.message;
  }

  if (statusCode === 400) {
    return "Invalid request";
  }

  if (statusCode === 413) {
    return "Request payload too large";
  }

  return "Request failed";
}

function notFoundHandler(req, res) {
  return res.status(404).json({
    error: "Route not found",
    requestId: req.id || null,
  });
}

function createErrorHandler({ logger = console } = {}) {
  return (error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const statusCode = getErrorStatusCode(error);

    logger.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "request_error",
        requestId: req.id || null,
        method: req.method,
        path: getSafeRequestPath(req),
        statusCode,
        errorName: error.name || "Error",
        errorMessage: error.message || "Unknown error",
        stack: statusCode >= 500 ? error.stack || null : null,
      })
    );

    return res.status(statusCode).json({
      error: getPublicErrorMessage(error, statusCode),
      requestId: req.id || null,
    });
  };
}

module.exports = {
  createErrorHandler,
  errorHandler: createErrorHandler(),
  getErrorStatusCode,
  getPublicErrorMessage,
  notFoundHandler,
};
