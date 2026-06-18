import { config } from "dotenv";
import path from "path";

// Load .env from backend directory or parent
try {
  config({ path: path.resolve(process.cwd(), ".env") });
} catch {
  config();
}

function env(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function envBool(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function envInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return parsed;
}

export const appConfig = {
  nodeEnv: env("NODE_ENV", "development"),
  port: envInt("PORT", 3000),
  host: env("HOST", "0.0.0.0"),
  appUrl: env("APP_URL", "http://localhost:3000"),
  frontendUrl: env("FRONTEND_URL", "http://localhost:3000"),
  logLevel: env("LOG_LEVEL", "info"),

  databaseUrl: env("DATABASE_URL"),
  redisUrl: env("REDIS_URL", ""),

  supabaseUrl: env("SUPABASE_URL", ""),
  supabaseAnonKey: env("SUPABASE_ANON_KEY", ""),
  supabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY", ""),
  supabaseJwtSecret: env("SUPABASE_JWT_SECRET", ""),
  supabaseStorageBucket: env("SUPABASE_STORAGE_BUCKET", "attachments"),

  googleAiApiKey: env("GOOGLE_AI_API_KEY", ""),
  openaiApiKey: env("OPENAI_API_KEY", ""),
  anthropicApiKey: env("ANTHROPIC_API_KEY", ""),
  openrouterApiKey: env("OPENROUTER_API_KEY", ""),
  groqApiKey: env("GROQ_API_KEY", ""),
  mistralApiKey: env("MISTRAL_API_KEY", ""),
  deepseekApiKey: env("DEEPSEEK_API_KEY", ""),
  xaiApiKey: env("XAI_API_KEY", ""),

  sessionSecret: env("SESSION_SECRET", "dev-secret-change-in-production"),
  encryptionKey: env("ENCRYPTION_KEY", "dev-encryption-key-change-in-prod"),
  corsOrigin: env("CORS_ORIGIN", "http://localhost:3000"),
  trustProxy: envBool("TRUST_PROXY", false),

  rateLimitMax: envInt("RATE_LIMIT_MAX", 100),
  rateLimitWindowMs: envInt("RATE_LIMIT_WINDOW_MS", 60_000),

  stripeSecretKey: env("STRIPE_SECRET_KEY", ""),
  stripeWebhookSecret: env("STRIPE_WEBHOOK_SECRET", ""),
  sentryDsn: env("SENTRY_DSN", ""),
  otelEndpoint: env("OTEL_EXPORTER_OTLP_ENDPOINT", ""),
  devAuthBypass: envBool("DEV_AUTH_BYPASS", false),

  get isDev() {
    return this.nodeEnv === "development";
  },
  get isProd() {
    return this.nodeEnv === "production";
  },
};

// Dev mode allows missing Supabase/AI credentials or explicit bypass for local testing
export const devMode =
  appConfig.isDev &&
  (appConfig.devAuthBypass || !appConfig.supabaseUrl || !appConfig.supabaseServiceRoleKey);
