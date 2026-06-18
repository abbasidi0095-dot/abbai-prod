import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { handleChat, handleStream } from "../services/chat";
import { logger } from "../utils/logger";

const chatSchema = z.object({
  conversationId: z.preprocess((val) => (val === null ? undefined : val), z.string().uuid().optional()),
  message: z.string().min(1).max(100000),
  model: z.string().optional(),
  provider: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().positive().optional(),
  attachments: z.array(z.string().uuid()).optional(),
});

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.post("/chat", {
    preHandler: [fastify.authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = chatSchema.parse(request.body);
      const result = await handleChat(request.user!, body);
      return reply.send(result);
    },
  });

  fastify.post("/stream", {
    preHandler: [fastify.authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = chatSchema.parse(request.body);

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      try {
        for await (const event of handleStream(request.user!, body)) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
          if (event.type === "done" || event.type === "error") {
            break;
          }
        }
      } catch (err) {
        logger.error({ err }, "Stream error");
        reply.raw.write(`data: ${JSON.stringify({ type: "error", error: "Internal server error" })}\n\n`);
      } finally {
        reply.raw.write("data: [DONE]\n\n");
        reply.raw.end();
      }
    },
  });
}
