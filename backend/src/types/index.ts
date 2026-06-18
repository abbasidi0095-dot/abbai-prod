export type Role = "USER" | "ADMIN" | "MODERATOR";
export type MessageRole = "user" | "assistant" | "system";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "unpaid" | "trialing";

export interface AuthenticatedUser {
  id: string;
  supabaseUid: string;
  email: string;
  role: Role;
  profile?: {
    fullName?: string | null;
    avatarUrl?: string | null;
    username?: string | null;
  } | null;
}

export interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  parts?: ChatMessagePart[];
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface AttachmentInput {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}
