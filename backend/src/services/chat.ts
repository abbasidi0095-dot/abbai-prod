import { getProvider } from "../providers";
import { prisma } from "../utils/prisma";
import { ChatMessage, ChatMessagePart, AuthenticatedUser } from "../types";
import { createMessage } from "./message";
import { getConversation, autoUpdateTitle, createConversation } from "./conversation";
import { getModelSettings } from "./user";
import { processAttachments } from "./fileProcessor";
import { logger } from "../utils/logger";

interface ChatRequest {
  conversationId?: string;
  message: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  attachments?: string[];
}

async function buildUserMessageContent(
  text: string,
  attachmentIds: string[],
  userId: string
): Promise<{ displayContent: string; parts: ChatMessagePart[] }> {
  const parts: ChatMessagePart[] = [];

  if (text.trim()) {
    parts.push({ text: text.trim() });
  }

  if (attachmentIds.length === 0) {
    return { displayContent: text.trim(), parts };
  }

  const attachments = await prisma.attachment.findMany({
    where: { id: { in: attachmentIds }, userId },
  });

  const processed = await processAttachments(attachments);

  const summaries: string[] = [];
  for (const item of processed) {
    summaries.push(`[${item.filename}]`);

    if (item.type === "image" && item.base64) {
      parts.push({
        inlineData: {
          mimeType: item.mimeType,
          data: item.base64,
        },
      });
    } else if (item.text) {
      parts.push({
        text: `\n--- Content of ${item.filename} ---\n${item.text.slice(0, 50000)}\n--- End of ${item.filename} ---\n`,
      });
    }
  }

  const displayContent = text.trim()
    ? `${text.trim()} ${summaries.join(" ")}`
    : summaries.join(" ");

  return { displayContent, parts };
}

export async function handleChat(
  user: AuthenticatedUser,
  request: ChatRequest
): Promise<{ content: string; conversationId: string; messageId: string }> {
  const startTime = Date.now();

  let conversationId = request.conversationId;
  let conversation;

  const settings = await getModelSettings(user.id);
  const providerName = request.provider || settings.defaultProvider || "google";
  const modelName = request.model || settings.defaultModel || "gemini-3.1-flash-lite";
  const attachmentIds = request.attachments || [];

  if (conversationId) {
    conversation = await getConversation(user.id, conversationId);
  } else {
    conversation = await createConversation(user.id, {
      title: "New Chat",
      model: modelName,
      provider: providerName,
      systemPrompt: request.systemPrompt || settings.systemPrompt || undefined,
    });
    conversationId = conversation.id;
  }

  const { displayContent, parts } = await buildUserMessageContent(request.message, attachmentIds, user.id);

  // Save user message
  const userMessage = await createMessage({
    conversationId: conversation.id,
    userId: user.id,
    role: "user",
    content: displayContent,
  });

  // Link attachments to message
  if (attachmentIds.length > 0) {
    await prisma.attachment.updateMany({
      where: { id: { in: attachmentIds }, userId: user.id },
      data: { messageId: userMessage.id, conversationId: conversation.id },
    });
  }

  // Auto-title on first message
  const messageCount = await prisma.message.count({ where: { conversationId: conversation.id } });
  if (messageCount <= 1) {
    await autoUpdateTitle(conversation.id, request.message || displayContent);
  }

  // Build context
  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true },
  });

  const messages: ChatMessage[] = history.map((m) => {
    if (m.id === userMessage.id) {
      return { role: m.role as ChatMessage["role"], content: m.content, parts };
    }
    return { role: m.role as ChatMessage["role"], content: m.content };
  });

  const provider = getProvider(providerName);
  const result = await provider.complete({
    model: modelName,
    messages,
    temperature: request.temperature ?? settings.temperature ?? 0.7,
    maxTokens: request.maxTokens ?? settings.maxTokens ?? undefined,
    topP: request.topP ?? settings.topP ?? undefined,
    topK: request.topK ?? settings.topK ?? undefined,
    systemPrompt: request.systemPrompt || conversation.systemPrompt || settings.systemPrompt || undefined,
  });

  const latencyMs = Date.now() - startTime;

  const assistantMessage = await createMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: result.content,
    model: modelName,
    provider: providerName,
    promptTokens: result.usage?.promptTokens,
    completionTokens: result.usage?.completionTokens,
    tokensUsed: result.usage?.totalTokens,
    latencyMs,
  });

  // Log usage
  await prisma.usageLog.create({
    data: {
      userId: user.id,
      action: "chat",
      model: modelName,
      provider: providerName,
      tokensIn: result.usage?.promptTokens,
      tokensOut: result.usage?.completionTokens,
      latencyMs,
    },
  });

  return {
    content: result.content,
    conversationId: conversation.id,
    messageId: assistantMessage.id,
  };
}

export async function* handleStream(
  user: AuthenticatedUser,
  request: ChatRequest
): AsyncIterable<{ type: "token" | "done" | "error"; data?: string; conversationId?: string; messageId?: string; error?: string }> {
  const startTime = Date.now();

  let conversation;
  const settings = await getModelSettings(user.id);
  const providerName = request.provider || settings.defaultProvider || "google";
  const modelName = request.model || settings.defaultModel || "gemini-3.1-flash-lite";
  const attachmentIds = request.attachments || [];

  if (request.conversationId) {
    conversation = await getConversation(user.id, request.conversationId);
  } else {
    conversation = await createConversation(user.id, {
      title: "New Chat",
      model: modelName,
      provider: providerName,
      systemPrompt: request.systemPrompt || settings.systemPrompt || undefined,
    });
  }

  logger.info({ userId: user.id, conversationId: conversation.id, attachmentCount: attachmentIds.length }, "stream: conversation ready");

  const { displayContent, parts } = await buildUserMessageContent(request.message, attachmentIds, user.id);
  logger.info({ userId: user.id, conversationId: conversation.id, parts: parts.length, elapsedMs: Date.now() - startTime }, "stream: attachments processed");

  const userMessage = await createMessage({
    conversationId: conversation.id,
    userId: user.id,
    role: "user",
    content: displayContent,
  });

  if (attachmentIds.length > 0) {
    await prisma.attachment.updateMany({
      where: { id: { in: attachmentIds }, userId: user.id },
      data: { messageId: userMessage.id, conversationId: conversation.id },
    });
  }

  const messageCount = await prisma.message.count({ where: { conversationId: conversation.id } });
  if (messageCount <= 1) {
    await autoUpdateTitle(conversation.id, request.message || displayContent);
  }

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true },
  });

  const messages: ChatMessage[] = history.map((m) => {
    if (m.id === userMessage.id) {
      return { role: m.role as ChatMessage["role"], content: m.content, parts };
    }
    return { role: m.role as ChatMessage["role"], content: m.content };
  });

  const provider = getProvider(providerName);

  const providerStart = Date.now();
  logger.info({ userId: user.id, conversationId: conversation.id, elapsedMs: Date.now() - startTime }, "stream: calling provider");

  let fullContent = "";
  try {
    for await (const chunk of provider.stream({
      model: modelName,
      messages,
      temperature: request.temperature ?? settings.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? settings.maxTokens ?? undefined,
      topP: request.topP ?? settings.topP ?? undefined,
      topK: request.topK ?? settings.topK ?? undefined,
      systemPrompt: request.systemPrompt || conversation.systemPrompt || settings.systemPrompt || undefined,
    })) {
      if (chunk.content) {
        fullContent += chunk.content;
        yield { type: "token", data: chunk.content, conversationId: conversation.id };
      }
      if (chunk.done) {
        break;
      }
    }
  } catch (err) {
    logger.error({ err }, "Streaming error");
    yield { type: "error", error: err instanceof Error ? err.message : "Streaming failed" };
    return;
  }

  const latencyMs = Date.now() - startTime;
  logger.info({ userId: user.id, conversationId: conversation.id, latencyMs, providerMs: Date.now() - providerStart }, "stream: provider complete");

  const assistantMessage = await createMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: fullContent,
    model: modelName,
    provider: providerName,
    latencyMs,
  });

  await prisma.usageLog.create({
    data: {
      userId: user.id,
      action: "stream",
      model: modelName,
      provider: providerName,
      latencyMs,
    },
  });

  yield { type: "done", conversationId: conversation.id, messageId: assistantMessage.id };
}
