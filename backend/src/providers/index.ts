import { AIProvider } from "./base";
import { GoogleProvider } from "./google";
import { MockProvider } from "./mock";

const providers = new Map<string, AIProvider>();

export function registerProviders(): void {
  providers.set("google", new GoogleProvider());
  providers.set("mock", new MockProvider());

  // Future providers register here:
  // providers.set("openai", new OpenAIProvider(appConfig.openaiApiKey));
  // providers.set("anthropic", new AnthropicProvider(appConfig.anthropicApiKey));
  // providers.set("openrouter", new OpenRouterProvider(appConfig.openrouterApiKey));
  // providers.set("groq", new GroqProvider(appConfig.groqApiKey));
  // providers.set("mistral", new MistralProvider(appConfig.mistralApiKey));
  // providers.set("deepseek", new DeepSeekProvider(appConfig.deepseekApiKey));
  // providers.set("xai", new XAIProvider(appConfig.xaiApiKey));
}

export function getProvider(name?: string): AIProvider {
  if (name) {
    const provider = providers.get(name.toLowerCase());
    if (provider && provider.isAvailable()) return provider;
    if (provider) throw new Error(`Provider '${name}' is registered but not available. Check API key.`);
  }

  // Default to Google if available, otherwise mock
  const google = providers.get("google");
  if (google && google.isAvailable()) return google;

  const mock = providers.get("mock");
  if (mock) return mock;

  throw new Error("No AI provider available");
}

export function listAvailableProviders(): Array<{ name: string; defaultModel: string; available: boolean }> {
  return Array.from(providers.values()).map((p) => ({
    name: p.name,
    defaultModel: p.defaultModel,
    available: p.isAvailable(),
  }));
}
