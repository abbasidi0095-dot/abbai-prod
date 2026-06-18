import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { appConfig, devMode } from "../config";
import { logger } from "../utils/logger";

interface CookieStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

function createCookieStorage(cookies: Record<string, string>, setCookie: (name: string, value: string, options?: Record<string, unknown>) => void): CookieStorage {
  return {
    getItem(key: string): string | null {
      return cookies[key] || null;
    },
    setItem(key: string, value: string): void {
      setCookie(key, value, { path: "/", httpOnly: true, sameSite: "lax", secure: appConfig.isProd, maxAge: 60 * 10 });
    },
    removeItem(key: string): void {
      setCookie(key, "", { path: "/", httpOnly: true, sameSite: "lax", secure: appConfig.isProd, maxAge: 0 });
    },
  };
}

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;

  if (devMode) {
    logger.warn("Running in dev mode without real Supabase admin client");
    // Create a dummy client; auth operations are mocked
    supabaseAdmin = createClient("http://localhost", "dummy", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return supabaseAdmin;
  }

  if (!appConfig.supabaseUrl || !appConfig.supabaseServiceRoleKey) {
    throw new Error("Supabase URL and service role key are required");
  }

  supabaseAdmin = createClient(appConfig.supabaseUrl, appConfig.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}

export function getSupabaseClient(): SupabaseClient {
  if (devMode) {
    return createClient("http://localhost", "dummy", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    throw new Error("Supabase URL and anon key are required");
  }
  return createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
}

export function getSupabaseOAuthClient(cookies: Record<string, string>, setCookie: (name: string, value: string, options?: Record<string, unknown>) => void): SupabaseClient {
  if (devMode) {
    return createClient("http://localhost", "dummy", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    throw new Error("Supabase URL and anon key are required");
  }
  return createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      storage: createCookieStorage(cookies, setCookie),
      flowType: "pkce",
    },
  });
}
