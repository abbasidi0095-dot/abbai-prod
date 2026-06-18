import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { uploadAttachment, refreshSignedUrl } from "../services/attachment";
import { logger } from "../utils/logger";

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".docx", ".csv", ".json", ".md", ".markdown"];

export async function attachmentRoutes(fastify: FastifyInstance) {
  fastify.post("/attachments", {
    preHandler: [fastify.authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "No file uploaded" });
      }

      const buffer = await data.toBuffer();
      const originalName = data.filename;
      const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: `File extension '${ext}' not allowed` });
      }

      try {
        const attachment = await uploadAttachment(
          request.user!.id,
          {
            filename: originalName,
            originalName,
            mimeType: data.mimetype,
            size: buffer.length,
            buffer,
          },
          (request.query as { conversationId?: string }).conversationId
        );

        return reply.status(201).send(attachment);
      } catch (err) {
        logger.error({ err }, "Attachment upload failed");
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
  });

  fastify.post("/attachments/:id/refresh", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const attachment = await refreshSignedUrl(id, request.user!.id);
    return reply.send(attachment);
  });
}
