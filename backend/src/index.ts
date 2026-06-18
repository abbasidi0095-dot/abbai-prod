import { buildApp } from "./app";
import { appConfig } from "./config";
import { disconnectDatabase } from "./utils/prisma";
import { logger } from "./utils/logger";

async function main() {
  const app = await buildApp();

  const closeSignals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
  for (const signal of closeSignals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Shutting down server");
      await app.close();
      await disconnectDatabase();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: appConfig.port, host: appConfig.host });
    logger.info(`ABBAI backend running at http://${appConfig.host}:${appConfig.port}`);
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    await disconnectDatabase();
    process.exit(1);
  }
}

main();
