import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { badRequest, notFound } from "../utils/api-error.js";
import { presentSession, sessionInclude } from "../services/session-presenter.js";
import { presentUserSummary } from "../services/user-presenter.js";

export async function socialRoutes(app: FastifyInstance): Promise<void> {
  // Follow a host/player. Idempotent (PUT).
  app.put(
    "/users/:userId/follow",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const followerId = getAuthenticatedUserId(request);
      const { userId: followeeId } = request.params as { userId: string };

      if (followeeId === followerId) {
        throw badRequest("You cannot follow yourself");
      }

      const target = await prisma.user.findUnique({
        where: { id: followeeId },
        select: { id: true }
      });
      if (!target) {
        throw notFound("User not found");
      }

      await prisma.follow.upsert({
        where: { followerId_followeeId: { followerId, followeeId } },
        update: {},
        create: { followerId, followeeId }
      });

      return reply.code(200).send({ following: true });
    }
  );

  app.delete(
    "/users/:userId/follow",
    { preHandler: app.authenticate },
    async (request) => {
      const followerId = getAuthenticatedUserId(request);
      const { userId: followeeId } = request.params as { userId: string };

      await prisma.follow.deleteMany({ where: { followerId, followeeId } });

      return { following: false };
    }
  );

  app.get("/me/following", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);
    const rows = await prisma.follow.findMany({
      where: { followerId: userId },
      include: { followee: true },
      orderBy: { createdAt: "desc" }
    });
    return { users: rows.map((row) => presentUserSummary(row.followee)) };
  });

  // Save (bookmark) a session. Idempotent (PUT).
  app.put(
    "/sessions/:sessionId/save",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = getAuthenticatedUserId(request);
      const { sessionId } = request.params as { sessionId: string };

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true }
      });
      if (!session) {
        throw notFound("Session not found");
      }

      await prisma.savedSession.upsert({
        where: { userId_sessionId: { userId, sessionId } },
        update: {},
        create: { userId, sessionId }
      });

      return reply.code(200).send({ saved: true });
    }
  );

  app.delete(
    "/sessions/:sessionId/save",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const { sessionId } = request.params as { sessionId: string };

      await prisma.savedSession.deleteMany({ where: { userId, sessionId } });

      return { saved: false };
    }
  );

  app.get("/me/saved", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);
    const rows = await prisma.savedSession.findMany({
      where: { userId },
      include: { session: { include: sessionInclude } },
      orderBy: { createdAt: "desc" }
    });
    return { sessions: rows.map((row) => presentSession(row.session)) };
  });
}
