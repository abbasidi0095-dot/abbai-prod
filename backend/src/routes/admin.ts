import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../utils/prisma";

const modelSettingsAdminSchema = z.object({
  userId: z.string().uuid().optional(),
  defaultModel: z.string().optional(),
  defaultProvider: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().positive().optional(),
  systemPrompt: z.string().optional(),
  isAdminPreset: z.boolean().optional(),
});

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/users", { preHandler: [fastify.authenticate, fastify.requireRole(["ADMIN"])] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const users = await prisma.user.findMany({
      take: 100,
      include: { profile: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ data: users });
  });

  fastify.patch("/admin/users/:id/role", { preHandler: [fastify.authenticate, fastify.requireRole(["ADMIN"])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { role } = z.object({ role: z.enum(["USER", "ADMIN", "MODERATOR"]) }).parse(request.body);
    const user = await prisma.user.update({ where: { id }, data: { role } });
    return reply.send(user);
  });

  fastify.post("/admin/model-settings", { preHandler: [fastify.authenticate, fastify.requireRole(["ADMIN"])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = modelSettingsAdminSchema.parse(request.body);

    if (body.userId) {
      const settings = await prisma.modelSettings.upsert({
        where: { userId: body.userId },
        create: { userId: body.userId, ...body },
        update: body,
      });
      return reply.send(settings);
    }

    // Global admin preset applied to all users without their own settings
    return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "userId is required" });
  });

  fastify.get("/admin/usage", { preHandler: [fastify.authenticate, fastify.requireRole(["ADMIN"])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = "100", offset = "0" } = request.query as { limit?: string; offset?: string };
    const logs = await prisma.usageLog.findMany({
      take: parseInt(limit || "100", 10),
      skip: parseInt(offset || "0", 10),
      orderBy: { createdAt: "desc" },
      include: { user: { include: { profile: true } } },
    });
    return reply.send({ data: logs });
  });
}
