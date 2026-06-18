import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import { User } from "@prisma/client";
import { devMode } from "../config";
import { getSupabaseAdmin } from "./supabase";
import { prisma } from "../utils/prisma";
import { AuthenticatedUser } from "../types";
import { AuthenticationError } from "../utils/errors";
import { logger } from "../utils/logger";

// Extend FastifyRequest interface
declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

interface DevUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
}

export async function verifyToken(token: string): Promise<AuthenticatedUser | null> {
  if (devMode) {
    // In dev mode accept a raw user-id token or any Bearer token
    const parts = token.split(" ");
    const rawToken = parts.length === 2 ? parts[1] : token;

    let devUser: DevUser | undefined;

    if (rawToken.startsWith("dev_")) {
      const email = rawToken.slice(4);
      devUser = { id: `dev-${email}`, email, role: "USER" };
    } else {
      // Accept any token as a dev user with a deterministic id
      devUser = { id: "dev-user-1", email: "dev@abbai.local", role: "USER" };
    }

    // Upsert dev user in local DB
    const existing = await prisma.user.findUnique({
      where: { supabaseUid: devUser.id },
      include: { profile: true },
    });

    if (!existing) {
      const created = await prisma.user.create({
        data: {
          supabaseUid: devUser.id,
          email: devUser.email,
          role: devUser.role,
          profile: { create: { fullName: "Local Developer" } },
          modelSettings: { create: {} },
        },
        include: { profile: true },
      });
      return mapUser(created);
    }

    return mapUser(existing);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    logger.warn({ error: error?.message }, "Invalid Supabase token");
    return null;
  }

  const existing = await prisma.user.findUnique({
    where: { supabaseUid: data.user.id },
    include: { profile: true },
  });

  if (existing) {
    return mapUser(existing);
  }

  // Auto-provision user on first API call
  const created = await prisma.user.create({
    data: {
      supabaseUid: data.user.id,
      email: data.user.email || "unknown@abbai.app",
      emailVerified: data.user.email_confirmed_at ? true : false,
      role: "USER",
      profile: { create: {} },
      modelSettings: { create: {} },
    },
    include: { profile: true },
  });

  return mapUser(created);
}

function mapUser(user: User & { profile?: { fullName?: string | null; avatarUrl?: string | null; username?: string | null } | null } | null): AuthenticatedUser | null {
  if (!user) return null;
  return {
    id: user.id,
    supabaseUid: user.supabaseUid,
    email: user.email,
    role: user.role as "USER" | "ADMIN" | "MODERATOR",
    profile: user.profile,
  };
}

export const authPlugin = fp(async function (fastify: FastifyInstance) {
  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          throw new AuthenticationError("Missing authorization header");
        }

        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
        const user = await verifyToken(token);

        if (!user) {
          throw new AuthenticationError("Invalid or expired token");
        }

        request.user = user;
      } catch (err) {
        reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: err instanceof Error ? err.message : "Unauthorized",
        });
      }
    }
  );

  fastify.decorate(
    "requireRole",
    function (roles: Array<"USER" | "ADMIN" | "MODERATOR">) {
      return function (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) {
        if (!request.user || !roles.includes(request.user.role)) {
          reply.status(403).send({
            statusCode: 403,
            error: "Forbidden",
            message: "Insufficient permissions",
          });
          return;
        }
        done();
      };
    }
  );
});

// Augment FastifyInstance type
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: Array<"USER" | "ADMIN" | "MODERATOR">) => (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => void;
  }
}
