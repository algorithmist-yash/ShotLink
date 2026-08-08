function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateRequestBody(contract, { allowEmpty = false } = {}) {
  return function requestContractMiddleware(req, res, next) {
    if (allowEmpty && req.body === undefined) req.body = {};
    if (!isPlainObject(req.body)) {
      return res.status(400).json({
        error: "Invalid request body",
        details: [{ field: "$", message: "must be a JSON object" }],
      });
    }

    const details = [];
    for (const [field, validate] of Object.entries(contract)) {
      if (!(field in req.body)) continue;
      const message = validate(req.body[field]);
      if (message) details.push({ field, message });
    }

    if (details.length) {
      return res.status(400).json({ error: "Invalid request body", details });
    }

    return next();
  };
}

module.exports = { isPlainObject, validateRequestBody };
