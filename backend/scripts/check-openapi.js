const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OPENAPI_PATH = path.join(ROOT, "docs", "openapi.json");
const ROUTES = [
  ["src/routes/authRoutes.js", "/api/v1/auth"],
  ["src/routes/linkRoutes.js", "/api/v1/links"],
  ["src/routes/workspaceRoutes.js", "/api/v1/workspace"],
  ["src/routes/billingRoutes.js", "/api/v1/billing"],
  ["src/routes/urlRoutes.js", ""],
];

function normalizeExpressPath(routePath) {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function readExpressOperations() {
  const operations = [];
  for (const [relativePath, prefix] of ROUTES) {
    const source = fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
    const pattern = /router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
    for (const match of source.matchAll(pattern)) {
      const routePath = match[2] === "/" && prefix ? "" : match[2];
      operations.push({
        method: match[1],
        path: normalizeExpressPath(`${prefix}${routePath}` || "/"),
      });
    }
  }
  return operations;
}

function main() {
  const specification = JSON.parse(fs.readFileSync(OPENAPI_PATH, "utf8"));
  if (specification.openapi !== "3.1.0") {
    throw new Error("OpenAPI specification must use version 3.1.0");
  }

  const missing = readExpressOperations().filter(
    ({ method, path: operationPath }) => !specification.paths?.[operationPath]?.[method]
  );
  for (const operation of [
    { method: "get", path: "/" },
    { method: "get", path: "/health" },
    { method: "get", path: "/live" },
    { method: "get", path: "/metrics" },
  ]) {
    if (!specification.paths?.[operation.path]?.[operation.method]) missing.push(operation);
  }

  if (missing.length) {
    throw new Error(
      `OpenAPI is missing operations: ${missing.map(({ method, path: operationPath }) => `${method.toUpperCase()} ${operationPath}`).join(", ")}`
    );
  }

  console.log(`OpenAPI contract covers ${readExpressOperations().length + 4} runtime operations.`);
}

main();
