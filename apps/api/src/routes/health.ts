import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", service: "voi-api", db: "ok" };
    } catch {
      return reply.code(503).send({
        status: "degraded",
        service: "voi-api",
        db: "error"
      });
    }
  });
}
