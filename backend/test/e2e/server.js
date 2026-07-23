const {
  redirectEventWorker,
} = require("../../src/services/redirectEventService");
const {
  startIntegrationEnvironment,
} = require("../integration/harness");

const DEFAULT_PORT = 5001;
const DEFAULT_FRONTEND_URL = "http://127.0.0.1:4173";

let environment;
let shutdownPromise;

async function shutdown(exitCode = 0) {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    const failures = [];

    for (const stop of [
      () => redirectEventWorker.stop(),
      () => environment?.stop(),
    ]) {
      try {
        await stop();
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length) {
      console.error(new AggregateError(failures, "E2E server cleanup failed"));
      process.exitCode = 1;
      return;
    }

    process.exitCode = exitCode;
  })();

  return shutdownPromise;
}

async function main() {
  const port = Number(process.env.E2E_BACKEND_PORT || DEFAULT_PORT);
  const frontendUrl = process.env.E2E_FRONTEND_URL || DEFAULT_FRONTEND_URL;

  environment = await startIntegrationEnvironment({
    databaseName: "shotlink_browser_e2e",
    frontendUrl,
    port,
  });
  await environment.resetDatabase();
  redirectEventWorker.start();

  console.log(`Shotlink E2E backend ready at ${environment.baseUrl}`);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    shutdown().finally(() => process.exit(process.exitCode || 0));
  });
}

main().catch(async (error) => {
  console.error("Shotlink E2E backend failed:", error);
  await shutdown(1);
  process.exit(1);
});
