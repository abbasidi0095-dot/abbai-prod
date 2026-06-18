import crypto from "crypto";

export function generateId(): string {
  return crypto.randomUUID();
}

export function hashApiKey(key: string): string {
  return crypto.createHmac("sha256", process.env.ENCRYPTION_KEY || "dev").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string } {
  const key = `abai_${crypto.randomBytes(32).toString("hex")}`;
  const prefix = key.slice(0, 12);
  return { key, prefix };
}

export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function safeJsonParse<T>(input: string | null | undefined, fallback: T): T {
  if (!input) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(input: unknown): string {
  try {
    return JSON.stringify(input);
  } catch {
    return "{}";
  }
}

export function truncateText(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}
