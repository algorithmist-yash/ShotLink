const { once } = require("node:events");

const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const TEST_DATABASE_NAME = "shotlink_integration";
const TEST_MONGODB_VERSION = "8.2.6";

function configureIntegrationEnvironment({ backendUrl, frontendUrl } = {}) {
  Object.assign(process.env, {
    NODE_ENV: "test",
    ALLOWED_ORIGINS: frontendUrl || "",
    APP_BASE_URL: frontendUrl || "http://127.0.0.1",
    BASE_URL: backendUrl || "http://127.0.0.1",
    CSRF_SECRET: "integration-only-csrf-secret-not-for-production",
    FRONTEND_URL: frontendUrl || "",
    IP_HASH_SALT: "integration-only-ip-salt-not-for-production",
    REDIS_URL: "",
  });
}

function installDeterministicHealthCheck() {
  const healthService = require("../../src/services/healthService");
  const originalRefresh = healthService.refreshUrlHealth;

  healthService.refreshUrlHealth = async (url) => {
    const checkedAt = new Date();
    url.primaryHealth.status = "healthy";
    url.primaryHealth.lastStatusCode = 204;
    url.primaryHealth.lastCheckedAt = checkedAt;
    url.primaryHealth.lastFailureReason = "";

    for (const fallback of url.fallbackUrls || []) {
      fallback.lastStatus = "healthy";
      fallback.lastStatusCode = 204;
      fallback.lastCheckedAt = checkedAt;
      fallback.lastFailureReason = "";
    }

    await url.save();
    return url;
  };

  return () => {
    healthService.refreshUrlHealth = originalRefresh;
  };
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function startIntegrationEnvironment({
  databaseName = TEST_DATABASE_NAME,
  frontendUrl = "",
  port = 0,
} = {}) {
  const configuredBackendUrl = port ? `http://127.0.0.1:${port}` : "http://127.0.0.1";
  configureIntegrationEnvironment({
    backendUrl: configuredBackendUrl,
    frontendUrl,
  });
  const restoreHealthCheck = installDeterministicHealthCheck();
  let replicaSet;
  let server;

  try {
    replicaSet = await MongoMemoryReplSet.create({
      binary: {
        version: process.env.MONGOMS_VERSION || TEST_MONGODB_VERSION,
      },
      replSet: {
        count: 1,
        name: "shotlink-test-rs",
        storageEngine: "wiredTiger",
      },
    });

    const mongoUri = replicaSet.getUri(databaseName);
    process.env.MONGO_URI = mongoUri;
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });

    const app = require("../../src/app");
    server = app.listen(port, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    process.env.BASE_URL = baseUrl;
    await mongoose.syncIndexes();

    return {
      baseUrl,
      async resetDatabase() {
        await Promise.all(
          Object.values(mongoose.connection.collections).map((collection) =>
            collection.deleteMany({})
          )
        );
      },
      async stop() {
        const failures = [];
        for (const close of [
          () => closeServer(server),
          () => mongoose.disconnect(),
          () => replicaSet.stop(),
        ]) {
          try {
            await close();
          } catch (error) {
            failures.push(error);
          }
        }
        restoreHealthCheck();
        if (failures.length) {
          throw new AggregateError(failures, "Integration environment cleanup failed");
        }
      },
    };
  } catch (error) {
    await closeServer(server).catch(() => {});
    await mongoose.disconnect().catch(() => {});
    await replicaSet?.stop().catch(() => {});
    restoreHealthCheck();
    throw error;
  }
}

class HttpTestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = "";
  }

  async request(path, { body, headers = {}, method = "GET" } = {}) {
    const requestHeaders = new Headers(headers);
    requestHeaders.set("Accept", "application/json");
    if (this.cookie) requestHeaders.set("Cookie", this.cookie);

    let requestBody;
    if (body !== undefined) {
      requestHeaders.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      body: requestBody,
      headers: requestHeaders,
      method,
      redirect: "manual",
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      const cookiePair = setCookie.split(";", 1)[0];
      this.cookie = cookiePair.endsWith("=") ? "" : cookiePair;
    }

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const parsedBody = contentType.includes("application/json") && text
      ? JSON.parse(text)
      : null;

    return {
      body: parsedBody,
      headers: response.headers,
      status: response.status,
      text,
    };
  }
}

module.exports = {
  HttpTestClient,
  TEST_DATABASE_NAME,
  TEST_MONGODB_VERSION,
  startIntegrationEnvironment,
};
