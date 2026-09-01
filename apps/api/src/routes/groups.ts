import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { CreateGroupSchema, DEFAULT_CURRENCY } from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { forbidden, notFound } from "../utils/api-error.js";
import { env } from "../config/env.js";
import { inviteExpiresAt } from "../services/invites.js";
import { userSummarySelect } from "../services/user-presenter.js";

export async function groupRoutes(app: FastifyInstance): Promise<void> {
  app.get("/groups", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);

    const now = new Date();
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: { userId }
        }
      },
      include: {
        _count: {
          select: {
            members: true,
            sessions: {
              where: { status: "SCHEDULED", endsAt: { gte: now } }
            }
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return {
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        defaultVenueName: group.defaultVenueName,
        defaultSkillLevel: group.defaultSkillLevel,
        currency: group.currency,
        memberCount: group._count.members,
        upcomingSessionCount: group._count.sessions
      }))
    };
  });

  app.post("/groups", { preHandler: app.authenticate }, async (request, reply) => {
    const userId = getAuthenticatedUserId(request);
    const body = CreateGroupSchema.parse(request.body);

    const group = await prisma.group.create({
      data: {
        name: body.name,
        description: body.description,
        defaultVenueName: body.defaultVenueName,
        defaultSkillLevel: body.defaultSkillLevel,
        currency: DEFAULT_CURRENCY,
        createdByUserId: userId,
        members: {
          create: {
            userId,
            role: "HOST"
          }
        }
      },
      include: {
        members: true
      }
    });

    return reply.code(201).send({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        defaultVenueName: group.defaultVenueName,
        defaultSkillLevel: group.defaultSkillLevel,
        currency: group.currency,
        memberCount: group.members.length
      }
    });
  });

  app.get("/groups/:groupId", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);
    const params = request.params as { groupId: string };

    const group = await prisma.group.findFirst({
      where: {
        id: params.groupId,
        members: {
          some: { userId }
        }
      },
      include: {
        members: {
          include: {
            user: { select: userSummarySelect }
          },
          orderBy: { joinedAt: "asc" }
        },
        sessions: {
          where: { status: { not: "DRAFT" } },
          orderBy: { startsAt: "desc" },
          take: 50
        }
      }
    });

    if (!group) {
      throw notFound("Group not found");
    }

    return {
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        defaultVenueName: group.defaultVenueName,
        defaultSkillLevel: group.defaultSkillLevel,
        currency: group.currency,
        members: group.members.map((member) => ({
          id: member.id,
          role: member.role,
          user: {
            id: member.user.id,
            displayName: member.user.displayName,
            avatarUrl: member.user.avatarUrl,
            defaultSkillLevel: member.user.defaultSkillLevel
          }
        })),
        sessions: group.sessions.map((session) => ({
          id: session.id,
          title: session.title,
          startsAt: session.startsAt.toISOString(),
          endsAt: session.endsAt.toISOString(),
          venueName: session.venueName,
          courtCount: session.courtCount,
          maxPlayers: session.maxPlayers,
          status: session.status
        }))
      }
    };
  });

  app.post(
    "/groups/:groupId/invites",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { groupId: string };
      await assertCanHostGroup(userId, params.groupId);

      const token = randomBytes(18).toString("base64url");
      const expiresAt = inviteExpiresAt();
      const invite = await prisma.invite.create({
        data: {
          groupId: params.groupId,
          token,
          expiresAt
        }
      });

      return reply.code(201).send({
        invite: {
          id: invite.id,
          token: invite.token,
          expiresAt: invite.expiresAt.toISOString(),
          inviteUrl: `${env.APP_BASE_URL.replace(/\/?$/, "/")}invites/${token}`
        }
      });
    }
  );
}

async function assertCanHostGroup(userId: string, groupId: string): Promise<void> {
  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId
      }
    }
  });

  if (!membership) {
    throw notFound("Group not found");
  }

  if (membership.role !== "HOST") {
    throw forbidden("Only group hosts can manage group invites");
  }
}
