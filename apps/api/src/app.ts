import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { env, getCorsOrigins } from "./config/env.js";
import { setupAuth } from "./plugins/auth.js";
import { handleApiError } from "./utils/api-error.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { groupRoutes } from "./routes/groups.js";
import { sessionRoutes } from "./routes/sessions.js";
import { notificationRoutes } from "./routes/notifications.js";
import { openApiRoutes } from "./routes/openapi.js";
import { deviceRoutes } from "./routes/devices.js";
import { inviteRoutes } from "./routes/invites.js";
import { socialRoutes } from "./routes/social.js";
import { peopleRoutes } from "./routes/people.js";
import { chatRoutes } from "./routes/chat.js";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdir } from "node:fs/promises";
import { UPLOADS_DIR, MAX_UPLOAD_BYTES } from "./config/uploads.js";
import { uploadRoutes } from "./routes/uploads.js";
import { redactSensitiveUrl } from "./utils/log-redact.js";
import { closeRedis, connectRedis } from "./services/rate-limit.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.query.token",
          "query.token",
          "req.body.deviceToken",
          "body.deviceToken",
          "*.deviceToken"
        ],
        censor: "[Redacted]"
      },
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: redactSensitiveUrl(request.url ?? ""),
            hostname: request.hostname,
            remoteAddress: request.ip,
            remotePort: request.socket?.remotePort
          };
        }
      }
    },
    requestIdHeader: "x-request-id",
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      return typeof incoming === "string" && incoming.length > 0
        ? incoming
        : randomUUID();
    }
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    return payload;
  });

  await app.register(cors, {
    origin: getCorsOrigins()
  });
  await app.register(helmet);

  const redis = await connectRedis();
  if (env.NODE_ENV === "production" && !redis) {
    app.log.warn(
      env.REDIS_URL
        ? "REDIS_URL is set but Redis is unreachable; using in-memory rate limits"
        : "REDIS_URL is not set; HTTP/WS rate limits are per-process only"
    );
  }
  app.addHook("onClose", async () => {
    await closeRedis();
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    ...(redis ? { redis } : {}),
    skipOnError: true
  });
  await app.register(jwt, {
    secret: env.JWT_SECRET
  });
  await app.register(websocket, {
    options: { maxPayload: 64 * 1024 }
  });
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 }
  });
  await mkdir(UPLOADS_DIR, { recursive: true });
  await app.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: "/uploads/"
  });

  setupAuth(app);
  app.setErrorHandler(handleApiError);

  await app.register(openApiRoutes);
  await app.register(healthRoutes);
  await app.register(registerVersionedRoutes, {
    prefix: `/${env.API_VERSION}`
  });

  return app;
}

async function registerVersionedRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(groupRoutes);
  await app.register(sessionRoutes);
  await app.register(inviteRoutes);
  await app.register(notificationRoutes);
  await app.register(deviceRoutes);
  await app.register(socialRoutes);
  await app.register(peopleRoutes);
  await app.register(chatRoutes);
  await app.register(uploadRoutes);
}
