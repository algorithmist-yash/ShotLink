const test = require("node:test");
const assert = require("node:assert/strict");

const { classifyDestination } = require("./destinationClassifier");

test("classifies Google Sheets as structured resources", () => {
  assert.deepEqual(
    classifyDestination("https://docs.google.com/spreadsheets/d/abc123/edit#gid=0"),
    { type: "google_sheet", provider: "google_sheets", label: "Google Sheet" }
  );
});

test("classifies hosted and direct videos", () => {
  assert.equal(classifyDestination("https://youtu.be/abc123").type, "video");
  assert.equal(classifyDestination("https://cdn.example.com/launch.mp4?download=1").type, "video");
});

test("classifies Google Forms, documents, social posts, and normal websites", () => {
  assert.equal(classifyDestination("https://docs.google.com/forms/d/e/abc/viewform").type, "form");
  assert.equal(classifyDestination("https://drive.google.com/file/d/abc/view").type, "document");
  assert.equal(classifyDestination("https://instagram.com/p/abc").type, "social");
  assert.equal(classifyDestination("https://example.edu/resource").type, "website");
});
