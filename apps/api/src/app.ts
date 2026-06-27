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

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });

  await app.register(cors, {
    origin: getCorsOrigins()
  });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW
  });
  await app.register(jwt, {
    secret: env.JWT_SECRET
  });
  await app.register(websocket);
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
