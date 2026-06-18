import { GoogleGenerativeAI, Content, GenerateContentStreamResult, Part } from "@google/generative-ai";
import { appConfig } from "../config";
import { BaseAIProvider } from "./base";
import { ChatCompletionOptions, ChatMessage, StreamChunk } from "../types";

export class GoogleProvider extends BaseAIProvider {
  readonly name = "google";
  readonly defaultModel = "gemini-3.1-flash-lite";

  private client: GoogleGenerativeAI | null = null;

  constructor() {
    super();
    if (appConfig.googleAiApiKey) {
      this.client = new GoogleGenerativeAI(appConfig.googleAiApiKey);
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  private toGeminiPart(part: NonNullable<ChatMessage["parts"]>[number]): Part {
    if (part.inlineData) {
      return {
        inlineData: {
          mimeType: part.inlineData.mimeType,
          data: part.inlineData.data,
        },
      };
    }
    return { text: part.text || "" };
  }

  private toGeminiMessages(messages: ChatMessage[]): { contents: Content[]; systemInstruction?: string } {
    const systemMessages = messages.filter((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    const systemInstruction = systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n")
      : undefined;

    const contents: Content[] = otherMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: m.parts?.length ? m.parts.map((p) => this.toGeminiPart(p)) : [{ text: m.content }],
    }));

    return { contents, systemInstruction };
  }

  async complete(options: ChatCompletionOptions): Promise<{ content: string; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }> {
    if (!this.client) throw new Error("Google AI client not initialized");

    const model = this.client.getGenerativeModel({
      model: options.model || this.defaultModel,
      systemInstruction: options.systemPrompt || this.buildSystemInstruction(),
    });

    const { contents } = this.toGeminiMessages(options.messages);
    const chat = model.startChat({ history: contents.slice(0, -1) });
    const lastMessage = contents[contents.length - 1];

    const result = await chat.sendMessage(lastMessage?.parts?.length ? lastMessage.parts : [{ text: "" }]);
    const response = await result.response;
    const text = response.text();

    const usage = response.usageMetadata;

    return {
      content: text,
      usage: {
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
      },
    };
  }

  async *stream(options: ChatCompletionOptions): AsyncIterable<StreamChunk> {
    if (!this.client) throw new Error("Google AI client not initialized");

    const model = this.client.getGenerativeModel({
      model: options.model || this.defaultModel,
      systemInstruction: options.systemPrompt || this.buildSystemInstruction(),
    });

    const { contents } = this.toGeminiMessages(options.messages);
    const chat = model.startChat({ history: contents.slice(0, -1) });
    const lastMessage = contents[contents.length - 1];

    const result: GenerateContentStreamResult = await chat.sendMessageStream(
      lastMessage?.parts?.length ? lastMessage.parts : [{ text: "" }]
    );

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { content: text, done: false };
      }
    }

    yield { content: "", done: true };
  }
}
