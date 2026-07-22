const mongoose = require("mongoose");

function closeHttpServer(
  server,
  {
    timeoutMs = 10000,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {}
) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimer(timeout);

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    const timeout = setTimer(() => {
      finish(new Error(`HTTP server did not close within ${timeoutMs}ms`));

      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
    }, timeoutMs);
    timeout.unref?.();

    server.close(finish);
  });
}

async function gracefullyShutdown({
  server,
  signal,
  disconnect = () => mongoose.disconnect(),
  disconnectCache = async () => {},
  stopBackground = async () => {},
  logger = console,
  timeoutMs = 10000,
  setTimer,
  clearTimer,
}) {
  logger.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "shutdown_started",
      signal,
    })
  );

  await closeHttpServer(server, { timeoutMs, setTimer, clearTimer });
  await stopBackground();
  await disconnectCache();
  await disconnect();

  logger.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "shutdown_completed",
      signal,
    })
  );
}

function registerShutdownHandlers({
  server,
  processRef = process,
  shutdown = gracefullyShutdown,
  logger = console,
}) {
  let shuttingDown = false;

  const handleSignal = (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    Promise.resolve(shutdown({ server, signal, logger }))
      .then(() => processRef.exit(0))
      .catch((error) => {
        logger.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            event: "shutdown_failed",
            signal,
            error: error.message,
          })
        );
        processRef.exit(1);
      });
  };

  processRef.once("SIGTERM", () => handleSignal("SIGTERM"));
  processRef.once("SIGINT", () => handleSignal("SIGINT"));

  return handleSignal;
}

function normalizeFatalError(error) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack || null,
    };
  }

  return {
    errorName: "NonErrorRejection",
    errorMessage: String(error),
    stack: null,
  };
}

function registerProcessHandlers({
  server,
  processRef = process,
  shutdown = gracefullyShutdown,
  logger = console,
}) {
  let terminating = false;

  const terminate = ({ signal, exitCode, fatalError }) => {
    if (terminating) {
      return;
    }

    terminating = true;

    if (fatalError !== undefined) {
      logger.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          event: "fatal_process_error",
          signal,
          ...normalizeFatalError(fatalError),
        })
      );
    }

    Promise.resolve(shutdown({ server, signal, logger }))
      .then(() => processRef.exit(exitCode))
      .catch((error) => {
        logger.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            event: "shutdown_failed",
            signal,
            error: error.message,
          })
        );
        processRef.exit(1);
      });
  };

  processRef.once("SIGTERM", () => terminate({ signal: "SIGTERM", exitCode: 0 }));
  processRef.once("SIGINT", () => terminate({ signal: "SIGINT", exitCode: 0 }));
  processRef.once("uncaughtException", (error) =>
    terminate({ signal: "uncaughtException", exitCode: 1, fatalError: error })
  );
  processRef.once("unhandledRejection", (reason) =>
    terminate({ signal: "unhandledRejection", exitCode: 1, fatalError: reason })
  );

  return terminate;
}

function registerBackgroundProcessHandlers({
  processRef = process,
  shutdown,
  logger = console,
}) {
  let terminating = false;

  const terminate = ({ signal, exitCode, fatalError }) => {
    if (terminating) return;
    terminating = true;

    if (fatalError !== undefined) {
      logger.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          event: "fatal_process_error",
          signal,
          ...normalizeFatalError(fatalError),
        })
      );
    }

    Promise.resolve(shutdown({ signal, logger }))
      .then(() => processRef.exit(exitCode))
      .catch((error) => {
        logger.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            event: "shutdown_failed",
            signal,
            error: error.message,
          })
        );
        processRef.exit(1);
      });
  };

  processRef.once("SIGTERM", () => terminate({ signal: "SIGTERM", exitCode: 0 }));
  processRef.once("SIGINT", () => terminate({ signal: "SIGINT", exitCode: 0 }));
  processRef.once("uncaughtException", (error) =>
    terminate({ signal: "uncaughtException", exitCode: 1, fatalError: error })
  );
  processRef.once("unhandledRejection", (reason) =>
    terminate({ signal: "unhandledRejection", exitCode: 1, fatalError: reason })
  );

  return terminate;
}

module.exports = {
  closeHttpServer,
  gracefullyShutdown,
  normalizeFatalError,
  registerBackgroundProcessHandlers,
  registerProcessHandlers,
  registerShutdownHandlers,
};
