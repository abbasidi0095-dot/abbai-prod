import { ChatCompletionOptions, StreamChunk } from "../types";

export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;
  isAvailable(): boolean;
  complete(options: ChatCompletionOptions): Promise<{ content: string; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }>;
  stream(options: ChatCompletionOptions): AsyncIterable<StreamChunk>;
}

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;

  abstract isAvailable(): boolean;
  abstract complete(options: ChatCompletionOptions): Promise<{ content: string; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }>;
  abstract stream(options: ChatCompletionOptions): AsyncIterable<StreamChunk>;

  protected buildSystemInstruction(systemPrompt?: string): string {
    return (
      systemPrompt ||
      "You are ABBAI, a sophisticated, helpful AI assistant. Provide clear, accurate, and concise answers."
    );
  }
}
