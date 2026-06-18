import pino from "pino";
import { appConfig } from "../config";

export const logger = pino({
  level: appConfig.logLevel,
  transport:
    appConfig.nodeEnv === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  base: {
    service: "abbai-backend",
    version: process.env.npm_package_version || "1.0.0",
  },
});
