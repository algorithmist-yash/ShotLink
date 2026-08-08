const assert = require("node:assert/strict");
const test = require("node:test");

process.env.ALLOWED_ORIGINS = "https://app.example.com";
process.env.APP_BASE_URL = "https://app.example.com";

const app = require("./app");

async function withServer(run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("credentialed CORS accepts only configured browser origins", async () => {
  await withServer(async (baseUrl) => {
    const allowedResponse = await fetch(`${baseUrl}/live`, {
      headers: { Origin: "https://app.example.com" },
    });
    const deniedResponse = await fetch(`${baseUrl}/live`, {
      headers: { Origin: "https://attacker.example" },
    });

    assert.equal(allowedResponse.status, 200);
    assert.equal(
      allowedResponse.headers.get("access-control-allow-origin"),
      "https://app.example.com"
    );
    assert.equal(
      allowedResponse.headers.get("access-control-allow-credentials"),
      "true"
    );
    assert.equal(deniedResponse.status, 403);
    assert.equal(deniedResponse.headers.get("access-control-allow-origin"), null);
  });
});

test("CORS preflight permits the CSRF header for configured origins", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/links`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.example.com",
        "Access-Control-Request-Headers": "content-type,x-csrf-token",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "https://app.example.com"
    );
    assert.equal(
      response.headers.get("access-control-allow-credentials"),
      "true"
    );
    assert.match(
      response.headers.get("access-control-allow-headers") || "",
      /x-csrf-token/i
    );
  });
});
