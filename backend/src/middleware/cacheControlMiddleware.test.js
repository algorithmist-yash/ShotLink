const assert = require("node:assert/strict");
const test = require("node:test");

const { noStore } = require("./cacheControlMiddleware");

test("private and operational responses are marked non-cacheable", () => {
  const headers = {};
  let nextCalled = false;

  noStore(
    {},
    {
      setHeader(name, value) {
        headers[name] = value;
      },
    },
    () => {
      nextCalled = true;
    }
  );

  assert.equal(headers["Cache-Control"], "no-store, max-age=0");
  assert.equal(headers.Pragma, "no-cache");
  assert.equal(nextCalled, true);
});
