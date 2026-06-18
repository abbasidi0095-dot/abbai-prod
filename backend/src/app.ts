import path from "path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import compress from "@fastify/compress";
import sensible from "@fastify/sensible";
import cookie from "@fastify/cookie";
import { appConfig } from "./config";
import { logger } from "./utils/logger";
import { authPlugin } from "./auth/plugin";
import { registerProviders } from "./providers";

import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { conversationRoutes } from "./routes/conversations";
import { attachmentRoutes } from "./routes/attachments";
import { providerRoutes } from "./routes/providers";
import { adminRoutes } from "./routes/admin";

export async function buildApp() {
  const fastify = Fastify({
    logger,
    trustProxy: appConfig.trustProxy,
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // Register providers
  registerProviders();

  // Security middleware
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
        styleSrcAttr: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://unpkg.com"],
        scriptSrcAttr: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  await fastify.register(cors, {
    origin: appConfig.corsOrigin === "*" ? true : appConfig.corsOrigin.split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  });

  await fastify.register(rateLimit, {
    max: appConfig.rateLimitMax,
    timeWindow: appConfig.rateLimitWindowMs,
    keyGenerator: (req) => (req.user ? req.user.id : req.ip),
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry after ${context.after}`,
      retryAfter: context.after,
    }),
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 5,
    },
  });

  await fastify.register(compress);
  await fastify.register(sensible);
  await fastify.register(cookie, {
    secret: appConfig.sessionSecret,
    parseOptions: {},
  });

  // Auth plugin
  await fastify.register(authPlugin);

  // API routes
  await fastify.register(healthRoutes, { prefix: "/api" });
  await fastify.register(authRoutes, { prefix: "/api" });
  await fastify.register(chatRoutes, { prefix: "/api" });
  await fastify.register(conversationRoutes, { prefix: "/api" });
  await fastify.register(attachmentRoutes, { prefix: "/api" });
  await fastify.register(providerRoutes, { prefix: "/api" });
  await fastify.register(adminRoutes, { prefix: "/api" });

  // Static frontend
  const frontendPath = path.resolve(process.cwd(), "../frontend/public");
  await fastify.register(staticPlugin, {
    root: frontendPath,
    prefix: "/",
    wildcard: true,
    serveDotFiles: false,
  });

  // Serve uploads directory in dev/local fallback
  const uploadsPath = path.resolve(process.cwd(), "uploads");
  await fastify.register(staticPlugin, {
    root: uploadsPath,
    prefix: "/uploads/",
    decorateReply: false,
  });

  // SPA fallback
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "API route not found" });
    }
    return reply.sendFile("index.html", frontendPath);
  });

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error }, "Unhandled error");

    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: error.message,
        details: error.validation,
      });
    }

    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    return reply.status(statusCode).send({
      statusCode,
      error: statusCode >= 500 ? "Internal Server Error" : "Error",
      message: appConfig.isProd ? "Internal server error" : error.message,
    });
  });

  return fastify;
}
