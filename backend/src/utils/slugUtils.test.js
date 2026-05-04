const test = require("node:test");
const assert = require("node:assert/strict");

const { slugifyWorkspaceName } = require("./slugUtils");

test("slugifyWorkspaceName normalizes names for URLs", () => {
  assert.equal(slugifyWorkspaceName("Yash Growth Lab"), "yash-growth-lab");
  assert.equal(slugifyWorkspaceName("  Team @ India 2026 "), "team-india-2026");
  assert.equal(slugifyWorkspaceName(""), "workspace");
});
