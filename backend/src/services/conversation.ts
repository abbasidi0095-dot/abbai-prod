import { prisma } from "../utils/prisma";
import { NotFoundError, ForbiddenError } from "../utils/errors";
import { truncateText } from "../utils/helpers";

export async function listConversations(userId: string, options: { limit?: number; offset?: number; archived?: boolean } = {}) {
  const { limit = 50, offset = 0, archived = false } = options;
  return prisma.conversation.findMany({
    where: { userId, archived },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      title: true,
      model: true,
      provider: true,
      pinned: true,
      archived: true,
      updatedAt: true,
      createdAt: true,
      _count: { select: { messages: true } },
    },
  });
}

export async function getConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { attachments: true },
      },
      attachments: true,
    },
  });

  if (!conversation) throw new NotFoundError("Conversation");
  if (conversation.userId !== userId) throw new ForbiddenError();

  return conversation;
}

export async function createConversation(userId: string, data: {
  title?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
}) {
  return prisma.conversation.create({
    data: {
      userId,
      title: data.title || "New Chat",
      model: data.model || "gemini-3.1-flash-lite",
      provider: data.provider || "google",
      systemPrompt: data.systemPrompt,
    },
  });
}

export async function updateConversation(userId: string, conversationId: string, data: {
  title?: string;
  pinned?: boolean;
  archived?: boolean;
  model?: string;
  provider?: string;
  systemPrompt?: string;
}) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError("Conversation");
  if (conversation.userId !== userId) throw new ForbiddenError();

  return prisma.conversation.update({
    where: { id: conversationId },
    data,
  });
}

export async function deleteConversation(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new NotFoundError("Conversation");
  if (conversation.userId !== userId) throw new ForbiddenError();

  return prisma.conversation.delete({ where: { id: conversationId } });
}

export async function autoUpdateTitle(conversationId: string, firstUserMessage: string) {
  const title = truncateText(firstUserMessage, 60);
  return prisma.conversation.update({
    where: { id: conversationId },
    data: { title },
  });
}
