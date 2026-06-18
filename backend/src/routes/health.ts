import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../utils/prisma";
import { logger } from "../utils/logger";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async (_request: FastifyRequest, reply: FastifyReply) => {
    let database = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      database = "error";
      logger.error({ err }, "Health check database error");
    }

    const status = database === "ok" ? 200 : 503;
    return reply.status(status).send({
      status: database === "ok" ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      uptime: process.uptime(),
      checks: {
        database,
      },
    });
  });

  fastify.get("/ready", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ ready: true });
    } catch (err) {
      logger.error({ err }, "Readiness check failed");
      return reply.status(503).send({ ready: false });
    }
  });

  fastify.get("/metrics", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
    });
  });
}
