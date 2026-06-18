import { PrismaClient } from "@prisma/client";
import { appConfig } from "../config";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      appConfig.nodeEnv === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "info" },
          ]
        : [{ emit: "stdout", level: "error" }],
  });

if (appConfig.nodeEnv === "development") {
  globalForPrisma.prisma = prisma;
}

if (appConfig.nodeEnv === "development") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("query", (e: { query: string; duration: number }) => {
    logger.debug({ query: e.query, duration: e.duration }, "Prisma query");
  });
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
