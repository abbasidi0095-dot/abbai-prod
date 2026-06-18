import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getSupabaseClient, getSupabaseOAuthClient } from "../auth/supabase";
import { appConfig } from "../config";
import { findOrCreateUser } from "../services/user";
import { logger } from "../utils/logger";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(request.body);

    if (appConfig.isDev && appConfig.devAuthBypass) {
      const user = await findOrCreateUser(`dev-${body.email}`, body.email);
      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
        },
        access_token: `dev_${body.email}`,
        token_type: "bearer",
        expires_in: 3600,
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error || !data.session) {
      logger.warn({ error: error?.message }, "Login failed");
      return reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: error?.message || "Invalid credentials" });
    }

    const user = await findOrCreateUser(data.user.id, data.user.email || body.email);

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: "bearer",
      expires_in: data.session.expires_in,
    });
  });

  fastify.post("/auth/signup", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = signupSchema.parse(request.body);

    if (appConfig.isDev && appConfig.devAuthBypass) {
      const user = await findOrCreateUser(`dev-${body.email}`, body.email);
      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
        },
        access_token: `dev_${body.email}`,
        token_type: "bearer",
        expires_in: 3600,
      });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: { full_name: body.fullName },
      },
    });

    if (error || !data.user) {
      logger.warn({ error: error?.message }, "Signup failed");
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: error?.message || "Signup failed" });
    }

    const user = await findOrCreateUser(data.user.id, data.user.email || body.email);

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
      ...(data.session
        ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            token_type: "bearer",
            expires_in: data.session.expires_in,
          }
        : { requires_email_confirmation: true }),
    });
  });

  fastify.post("/auth/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    const { refresh_token } = z.object({ refresh_token: z.string() }).parse(request.body);

    if (appConfig.isDev && appConfig.devAuthBypass) {
      return reply.send({ access_token: refresh_token, token_type: "bearer", expires_in: 3600 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error || !data.session) {
      return reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: error?.message || "Invalid refresh token" });
    }

    return reply.send({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: "bearer",
      expires_in: data.session.expires_in,
    });
  });

  fastify.post("/auth/reset-password", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = resetPasswordSchema.parse(request.body);

    if (appConfig.isDev && appConfig.devAuthBypass) {
      return reply.send({ message: "Password reset email sent (dev mode)" });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
      redirectTo: `${appConfig.frontendUrl}/auth/reset-password`,
    });

    if (error) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: error.message });
    }

    return reply.send({ message: "Password reset email sent" });
  });

  fastify.get("/auth/me", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ user: request.user });
  });

  fastify.get("/auth/oauth/:provider", async (request: FastifyRequest, reply: FastifyReply) => {
    const { provider } = request.params as { provider: string };

    if (!["google", "github"].includes(provider)) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Unsupported OAuth provider" });
    }

    if (appConfig.isDev && appConfig.devAuthBypass) {
      return reply.redirect(`${appConfig.frontendUrl}/auth/callback.html#access_token=dev_${provider}_user&token_type=bearer&expires_in=3600`);
    }

    const cookies: Record<string, string> = {};
    request.cookies && Object.assign(cookies, request.cookies);

    const supabase = getSupabaseOAuthClient(cookies, (name, value, options) => {
      void reply.setCookie(name, value, options || {});
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as "google" | "github",
      options: {
        redirectTo: `${appConfig.appUrl}/api/auth/callback`,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: error?.message || "OAuth init failed" });
    }

    return reply.redirect(data.url);
  });

  fastify.get("/auth/callback", async (request: FastifyRequest, reply: FastifyReply) => {
    if (appConfig.isDev && appConfig.devAuthBypass) {
      return reply.redirect(`${appConfig.frontendUrl}/auth/callback.html#access_token=dev_oauth_user&token_type=bearer&expires_in=3600`);
    }

    const code = (request.query as { code?: string }).code;
    if (!code) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Missing OAuth code" });
    }

    const cookies: Record<string, string> = {};
    request.cookies && Object.assign(cookies, request.cookies);

    const supabase = getSupabaseOAuthClient(cookies, (name, value, options) => {
      void reply.setCookie(name, value, options || {});
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      logger.error({ error: error?.message }, "OAuth callback failed");
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: error?.message || "OAuth callback failed" });
    }

    await findOrCreateUser(data.user.id, data.user.email || "unknown@abbai.app");

    const hash = new URLSearchParams({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token || "",
      expires_in: String(data.session.expires_in || 3600),
      token_type: data.session.token_type || "bearer",
    }).toString();

    return reply.redirect(`${appConfig.frontendUrl}/auth/callback.html#${hash}`);
  });
}
