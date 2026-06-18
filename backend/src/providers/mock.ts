import { BaseAIProvider } from "./base";
import { ChatCompletionOptions, StreamChunk } from "../types";

export class MockProvider extends BaseAIProvider {
  readonly name = "mock";
  readonly defaultModel = "mock-model";

  isAvailable(): boolean {
    return true;
  }

  async complete(options: ChatCompletionOptions): Promise<{ content: string; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }> {
    const lastUserMessage = [...options.messages].reverse().find((m) => m.role === "user");
    const prompt = lastUserMessage?.content || "Hello";
    const hasAttachments = lastUserMessage?.parts?.some((p) => p.inlineData);

    return {
      content: `**Mock ABBAI Response**\n\nYou said: "${prompt}"${hasAttachments ? " (with attachments)" : ""}\n\nThis is a simulated response because no real AI provider API key is configured or the provider is unavailable. Configure your provider API key in the backend environment to get real responses.`,
      usage: {
        promptTokens: prompt.length / 4,
        completionTokens: 64,
        totalTokens: prompt.length / 4 + 64,
      },
    };
  }

  async *stream(options: ChatCompletionOptions): AsyncIterable<StreamChunk> {
    const lastUserMessage = [...options.messages].reverse().find((m) => m.role === "user");
    const prompt = lastUserMessage?.content || "Hello";
    const hasAttachments = lastUserMessage?.parts?.some((p) => p.inlineData);

    const words = `Mock ABBAI is thinking about: "${prompt}"${hasAttachments ? " and your attachments" : ""}. Streaming is active. Configure a real AI provider key to replace this simulated output.`.split(" ");

    for (const word of words) {
      yield { content: `${word} `, done: false };
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    yield { content: "", done: true };
  }
}
