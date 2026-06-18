import { prisma } from "../utils/prisma";
import { MessageRole } from "../types";

export async function createMessage(data: {
  conversationId: string;
  userId?: string;
  role: MessageRole;
  content: string;
  model?: string;
  provider?: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
}) {
  return prisma.message.create({
    data: {
      conversationId: data.conversationId,
      userId: data.userId,
      role: data.role,
      content: data.content,
      model: data.model,
      provider: data.provider,
      tokensUsed: data.tokensUsed,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      latencyMs: data.latencyMs,
    },
  });
}

export async function listMessages(conversationId: string, options: { limit?: number; before?: Date } = {}) {
  const { limit = 100, before } = options;
  return prisma.message.findMany({
    where: {
      conversationId,
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { attachments: true },
  });
}
