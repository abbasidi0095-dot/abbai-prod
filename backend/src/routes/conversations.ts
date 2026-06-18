import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
} from "../services/conversation";
import { listMessages } from "../services/message";

const createSchema = z.object({
  title: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  archived: z.coerce.boolean().default(false),
});

export async function conversationRoutes(fastify: FastifyInstance) {
  fastify.get("/history", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listQuerySchema.parse(request.query);
    const conversations = await listConversations(request.user!.id, query);
    return reply.send({ data: conversations, pagination: { limit: query.limit, offset: query.offset } });
  });

  fastify.get("/conversation/:id", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const conversation = await getConversation(request.user!.id, id);
    return reply.send(conversation);
  });

  fastify.post("/conversation", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createSchema.parse(request.body);
    const conversation = await createConversation(request.user!.id, body);
    return reply.status(201).send(conversation);
  });

  fastify.patch("/conversation/:id", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);
    const conversation = await updateConversation(request.user!.id, id, body);
    return reply.send(conversation);
  });

  fastify.delete("/conversation/:id", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await deleteConversation(request.user!.id, id);
    return reply.status(204).send();
  });

  fastify.get("/conversation/:id/messages", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await getConversation(request.user!.id, id); // verify ownership
    const messages = await listMessages(id);
    return reply.send({ data: messages });
  });
}
