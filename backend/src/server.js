require("dotenv").config();

const connectDB = require("../config/db");
const { validateRuntimeEnv } = require("./config/env");
const { configureHttpServer } = require("./config/httpServer");
const { gracefullyShutdown, registerProcessHandlers } = require("./config/lifecycle");
const { closeRedis, connectRedis } = require("./config/redis");
const { redirectEventWorker } = require("./services/redirectEventService");
const app = require("./app");

async function startServer({
  application = app,
  connect = connectDB,
  connectCache = connectRedis,
  configureServer = configureHttpServer,
  env = process.env,
  logger = console,
  validateEnv = validateRuntimeEnv,
} = {}) {
  const runtimeConfig = validateEnv(env);

  const port = runtimeConfig?.port ?? Number(env.PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  await connect();
  try {
    await connectCache({ env, logger });
  } catch (error) {
    logger.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        event: "redis_startup_degraded",
        error: error.message,
      })
    );
  }

  const server = application.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });

  return configureServer(server);
}

if (require.main === module) {
  startServer()
    .then((server) => {
      redirectEventWorker.start();
      registerProcessHandlers({
        server,
        shutdown: (options) =>
          gracefullyShutdown({
            ...options,
            stopBackground: () => redirectEventWorker.stop(),
            disconnectCache: closeRedis,
          }),
      });
    })
    .catch((error) => {
      console.error("Server startup failed:", error.message);
      process.exit(1);
    });
}

module.exports = { startServer };
