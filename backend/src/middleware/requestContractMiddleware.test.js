const assert = require("node:assert/strict");
const test = require("node:test");

const { loginContract } = require("../contracts/apiContracts");
const { isPlainObject, validateRequestBody } = require("./requestContractMiddleware");

function run(body) {
  const response = {
    body: null,
    statusCode: 200,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(value) { this.body = value; return this; },
  };
  let advanced = false;
  validateRequestBody(loginContract)({ body }, response, () => { advanced = true; });
  return { advanced, response };
}

test("plain object detection rejects arrays and prototype-bearing special objects", () => {
  assert.equal(isPlainObject({ email: "owner@example.com" }), true);
  assert.equal(isPlainObject(Object.create(null)), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(new Date()), false);
});

test("request contracts reject non-object and non-string credentials", () => {
  const arrayResult = run([]);
  assert.equal(arrayResult.response.statusCode, 400);
  assert.equal(arrayResult.response.body.details[0].field, "$");

  const typedResult = run({ email: { $ne: null }, password: ["guess"] });
  assert.equal(typedResult.advanced, false);
  assert.deepEqual(typedResult.response.body.details.map((item) => item.field), ["email", "password"]);
});

test("request contracts preserve valid backwards-compatible JSON bodies", () => {
  const result = run({ email: "owner@example.com", password: "StrongPass123" });
  assert.equal(result.advanced, true);
  assert.equal(result.response.statusCode, 200);
});
