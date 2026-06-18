import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listAvailableProviders } from "../providers";

export async function providerRoutes(fastify: FastifyInstance) {
  fastify.get("/providers", { preHandler: [fastify.authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ providers: listAvailableProviders() });
  });
}
