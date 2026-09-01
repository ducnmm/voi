import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma, Session } from "@prisma/client";
import { z } from "zod";
import {
  CreateMatchResultSchema,
  CreateSessionSchema,
  PaymentStatusSchema,
  RsvpStatusSchema,
  SessionFeedQuerySchema,
  UpdateSessionSchema
} from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import {
  badRequest,
  conflict,
  forbidden,
  notFound
} from "../utils/api-error.js";
import { assertCanAccessSession } from "../services/session-access.js";
import { assertInviteActive, inviteExpiresAt } from "../services/invites.js";
import {
  calculateNextWaitlistPosition,
  resolveJoinStatus
} from "../services/attendance.js";
import {
  compareSessionsBy,
  decodeSessionCursor,
  encodeSessionCursor
} from "../services/session-feed.js";
import { withSerializableRetry } from "../services/transactions.js";
import {
  presentMatchResult,
  presentSession,
  presentSessionCard,
  sessionFeedInclude,
  sessionInclude
} from "../services/session-presenter.js";
import {
  cancelPendingReminders,
  createSessionCancellationNotifications,
  createSessionChangeNotifications,
  createWaitlistPromotionNotifications,
  rescheduleJoinedReminders,
  scheduleSessionReminder
} from "../services/notifications.js";

const RsvpBodySchema = z.object({
  status: RsvpStatusSchema.extract(["JOINED", "MAYBE", "DECLINED", "CANCELLED"])
});

const PaymentBodySchema = z.object({
  paymentStatus: PaymentStatusSchema.extract(["UNPAID", "PAID"])
});

const LineupBodySchema = z.object({
  assignments: z
    .array(
      z.object({
        courtId: z.string().min(1),
        participantId: z.string().min(1),
        slotOrder: z.number().int().min(1).max(4)
      })
    )
    .max(80)
});

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // Discovery feed: sessions in the authenticated user's groups, filtered and
  // sorted server-side. Keyset pagination on the default date sort.
  app.get("/sessions", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);
    const query = SessionFeedQuerySchema.parse(request.query);
    const now = new Date();

    const where: Prisma.SessionWhereInput = {
      group: { members: { some: { userId } } },
      ...(query.scope === "upcoming"
        ? { status: "SCHEDULED", endsAt: { gte: now } }
        : { endsAt: { lt: now }, status: { not: "DRAFT" } }),
      ...(query.skill ? { skillLevel: query.skill } : {}),
      ...(query.venue
        ? { venueName: { contains: query.venue, mode: "insensitive" } }
        : {}),
      ...(query.savedOnly ? { savedBy: { some: { userId } } } : {})
    };

    // Keyset is well-defined only for the date sort without the post-query
    // availableOnly filter. Other sorts read a capped window (ample for one
    // user's groups) and order in memory.
    const wantsKeyset = query.sort === "date" && !query.availableOnly;
    const cursor = query.cursor ? decodeSessionCursor(query.cursor) : null;

    if (wantsKeyset && cursor) {
      where.OR =
        query.scope === "upcoming"
          ? [
              { startsAt: { gt: cursor.startsAt } },
              { startsAt: cursor.startsAt, id: { gt: cursor.id } }
            ]
          : [
              { startsAt: { lt: cursor.startsAt } },
              { startsAt: cursor.startsAt, id: { lt: cursor.id } }
            ];
    }

    const rows = await prisma.session.findMany({
      where,
      include: sessionFeedInclude,
      orderBy:
        query.scope === "upcoming"
          ? [{ startsAt: "asc" }, { id: "asc" }]
          : [{ startsAt: "desc" }, { id: "desc" }],
      take: wantsKeyset ? query.limit + 1 : 200
    });

    let sessions = rows.map(presentSessionCard);

    if (query.availableOnly) {
      sessions = sessions.filter(
        (session) => session.summary.availableSlots > 0
      );
    }

    if (query.sort !== "date") {
      const compare = compareSessionsBy(query.sort, query.scope);
      sessions.sort((a, b) =>
        compare(
          {
            startsAt: new Date(a.startsAt),
            id: a.id,
            perPlayerCostVnd: a.summary.perPlayerCostVnd,
            availableSlots: a.summary.availableSlots
          },
          {
            startsAt: new Date(b.startsAt),
            id: b.id,
            perPlayerCostVnd: b.summary.perPlayerCostVnd,
            availableSlots: b.summary.availableSlots
          }
        )
      );
    }

    let nextCursor: string | null = null;
    if (wantsKeyset && sessions.length > query.limit) {
      const lastOnPage = sessions[query.limit - 1];
      if (lastOnPage) {
        nextCursor = encodeSessionCursor({
          startsAt: new Date(lastOnPage.startsAt),
          id: lastOnPage.id
        });
      }
    }

    return {
      sessions: sessions.slice(0, query.limit),
      nextCursor
    };
  });

  app.post(
    "/groups/:groupId/sessions",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { groupId: string };
      const body = CreateSessionSchema.parse(request.body);
      const startsAt = new Date(body.startsAt);
      const endsAt = new Date(body.endsAt);

      if (startsAt >= endsAt) {
        throw badRequest("Session start time must be before end time");
      }

      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: params.groupId,
            userId
          }
        }
      });

      if (!membership) {
        throw notFound("Group not found");
      }

      if (membership.role !== "HOST") {
        throw forbidden("Only group hosts can create sessions");
      }

      const token = generateInviteToken();
      const maxPlayers = body.maxPlayers ?? body.courtCount * 4;

      const session = await prisma.session.create({
        data: {
          groupId: params.groupId,
          hostUserId: userId,
          title: body.title,
          startsAt,
          endsAt,
          venueName: body.venueName,
          venueNote: body.venueNote,
          courtCount: body.courtCount,
          maxPlayers,
          feeTotalVnd: body.feeTotalVnd,
          shuttlecockCostVnd: body.shuttlecockCostVnd,
          currency: env.DEFAULT_CURRENCY,
          skillLevel: body.skillLevel,
          visibility: body.visibility,
          costTrackingEnabled: body.costTrackingEnabled,
          feePerPlayerVnd: body.feePerPlayerVnd,
          venueLat: body.venueLat,
          venueLng: body.venueLng,
          imageUrls: body.imageUrls ?? [],
          courts: {
            create: Array.from({ length: body.courtCount }, (_, index) => ({
              label: `Court ${index + 1}`,
              sortOrder: index + 1
            }))
          },
          invites: {
            create: {
              token,
              expiresAt: inviteExpiresAt()
            }
          },
          participants: {
            create: {
              userId,
              rsvpStatus: "JOINED",
              joinedAt: new Date(),
              paymentStatus: body.costTrackingEnabled ? "UNPAID" : "NOT_REQUIRED"
            }
          }
        },
        include: sessionInclude
      });

      await prisma.$transaction(async (tx) => {
        await scheduleSessionReminder({
          tx,
          userId,
          sessionId: session.id,
          startsAt
        });
      });

      return reply.code(201).send({
        session: presentSession(session),
        inviteUrl: buildInviteUrl(token)
      });
    }
  );

  app.get("/sessions/:sessionId", async (request) => {
    const params = request.params as { sessionId: string };
    const meta = await prisma.session.findUnique({
      where: { id: params.sessionId },
      select: { id: true, groupId: true, visibility: true, hostUserId: true }
    });

    if (!meta) {
      throw notFound("Session not found");
    }

    const userId = await optionalUserId(request);
    await assertCanAccessSession(meta, userId);

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: params.sessionId },
      include: sessionInclude
    });

    const presented = presentSession(session);
    if (userId !== session.hostUserId) {
      presented.inviteUrlToken = null;
    }

    return {
      session: presented
    };
  });

  app.patch(
    "/sessions/:sessionId",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { sessionId: string };
      const body = UpdateSessionSchema.parse(request.body);

      await assertCanHostSession(userId, params.sessionId);

      const session = await prisma.$transaction(async (tx) => {
        const current = await tx.session.findUnique({
          where: { id: params.sessionId },
          include: {
            courts: {
              orderBy: { sortOrder: "asc" },
              include: {
                lineupSlots: true
              }
            }
          }
        });

        if (!current) {
          throw notFound("Session not found");
        }

        if (current.status === "CANCELLED") {
          throw conflict("Cannot update a cancelled session");
        }

        const startsAt = body.startsAt ? new Date(body.startsAt) : current.startsAt;
        const endsAt = body.endsAt ? new Date(body.endsAt) : current.endsAt;

        if (startsAt >= endsAt) {
          throw badRequest("Session start time must be before end time");
        }

        const nextCourtCount = body.courtCount ?? current.courtCount;
        const nextMaxPlayers = body.maxPlayers ?? current.maxPlayers;
        const joinedCount = await tx.sessionParticipant.count({
          where: {
            sessionId: current.id,
            rsvpStatus: "JOINED"
          }
        });

        if (nextMaxPlayers < joinedCount) {
          throw badRequest("Max players cannot be lower than joined players");
        }

        const extraSlots = Math.max(0, nextMaxPlayers - current.maxPlayers);

        await syncCourts({
          tx,
          sessionId: current.id,
          currentCourts: current.courts,
          nextCourtCount
        });

        const timeChanged =
          startsAt.getTime() !== current.startsAt.getTime() ||
          endsAt.getTime() !== current.endsAt.getTime();
        const venueChanged =
          body.venueName !== undefined && body.venueName !== current.venueName;

        const updated = await tx.session.update({
          where: { id: current.id },
          data: {
            title: body.title,
            startsAt,
            endsAt,
            venueName: body.venueName,
            venueNote: body.venueNote,
            courtCount: nextCourtCount,
            maxPlayers: nextMaxPlayers,
            feeTotalVnd: body.feeTotalVnd,
            shuttlecockCostVnd: body.shuttlecockCostVnd,
            skillLevel: body.skillLevel,
            visibility: body.visibility,
            costTrackingEnabled: body.costTrackingEnabled,
            feePerPlayerVnd: body.feePerPlayerVnd,
            venueLat: body.venueLat,
            venueLng: body.venueLng,
            imageUrls: body.imageUrls
          }
        });

        if (timeChanged) {
          await rescheduleJoinedReminders({
            tx,
            session: updated
          });
        }

        if (timeChanged || venueChanged) {
          await createSessionChangeNotifications({
            tx,
            sessionId: updated.id
          });
        }

        let remaining = extraSlots;
        while (remaining > 0) {
          const promoted = await promoteFirstWaitlistedParticipant(tx, updated);
          if (!promoted) break;
          remaining -= 1;
        }

        return tx.session.findUniqueOrThrow({
          where: { id: updated.id },
          include: sessionInclude
        });
      });

      return {
        session: presentSession(session)
      };
    }
  );

  app.post(
    "/sessions/:sessionId/cancel",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { sessionId: string };

      await assertCanHostSession(userId, params.sessionId);

      const session = await prisma.$transaction(async (tx) => {
        const current = await tx.session.findUnique({
          where: { id: params.sessionId }
        });

        if (!current) {
          throw notFound("Session not found");
        }

        if (current.status === "CANCELLED") {
          return tx.session.findUniqueOrThrow({
            where: { id: current.id },
            include: sessionInclude
          });
        }

        await tx.session.update({
          where: { id: current.id },
          data: { status: "CANCELLED" }
        });

        await cancelPendingReminders({
          tx,
          sessionId: current.id
        });

        await createSessionCancellationNotifications({
          tx,
          sessionId: current.id
        });

        return tx.session.findUniqueOrThrow({
          where: { id: current.id },
          include: sessionInclude
        });
      });

      return {
        session: presentSession(session)
      };
    }
  );

  app.get("/invites/:token", async (request) => {
    const params = request.params as { token: string };
    const invite = await prisma.invite.findUnique({
      where: { token: params.token },
      include: {
        group: { select: { id: true, name: true } },
        session: {
          include: sessionFeedInclude
        }
      }
    });

    if (!invite) {
      throw notFound("Invite not found");
    }

    assertInviteActive(invite);

    return {
      invite: {
        id: invite.id,
        token: invite.token,
        group: invite.group
          ? {
              id: invite.group.id,
              name: invite.group.name
            }
          : null,
        session: invite.session ? presentSessionCard(invite.session) : null
      }
    };
  });

  app.post(
    "/sessions/:sessionId/rsvp",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { sessionId: string };
      const body = RsvpBodySchema.parse(request.body);

      const result = await withSerializableRetry(async (tx) => {
        const session = await tx.session.findUnique({
          where: { id: params.sessionId }
        });

        if (!session) {
          throw notFound("Session not found");
        }

        if (session.status === "CANCELLED") {
          throw conflict("Cannot RSVP to a cancelled session");
        }

        if (session.visibility === "GROUP_ONLY") {
          const membership = await tx.groupMember.findUnique({
            where: {
              groupId_userId: {
                groupId: session.groupId,
                userId
              }
            }
          });
          if (!membership) {
            throw forbidden("This session is only open to group members");
          }
        }

        const existing = await tx.sessionParticipant.findUnique({
          where: {
            sessionId_userId: {
              sessionId: session.id,
              userId
            }
          }
        });

        const joinedCount = await tx.sessionParticipant.count({
          where: {
            sessionId: session.id,
            rsvpStatus: "JOINED",
            userId: existing?.rsvpStatus === "JOINED" ? undefined : { not: userId }
          }
        });

        const wasJoined = existing?.rsvpStatus === "JOINED";
        let promotedParticipantId: string | null = null;

        if (body.status === "JOINED") {
          const effectiveStatus = resolveJoinStatus({
            joinedCount,
            maxPlayers: session.maxPlayers,
            existingStatus: existing?.rsvpStatus
          });

          const waitlistPosition =
            effectiveStatus === "WAITLISTED"
              ? existing?.waitlistPosition ??
                calculateNextWaitlistPosition(
                  (
                    await tx.sessionParticipant.findMany({
                      where: {
                        sessionId: session.id,
                        rsvpStatus: "WAITLISTED"
                      },
                      select: { waitlistPosition: true }
                    })
                  ).map((participant) => participant.waitlistPosition)
                )
              : null;

          await tx.sessionParticipant.upsert({
            where: {
              sessionId_userId: {
                sessionId: session.id,
                userId
              }
            },
            update: {
              rsvpStatus: effectiveStatus,
              joinedAt: effectiveStatus === "JOINED" ? new Date() : null,
              waitlistPosition,
              paymentStatus:
                existing?.paymentStatus === "PAID"
                  ? "PAID"
                  : effectiveStatus === "JOINED" && session.costTrackingEnabled
                    ? "UNPAID"
                    : "NOT_REQUIRED"
            },
            create: {
              sessionId: session.id,
              userId,
              rsvpStatus: effectiveStatus,
              joinedAt: effectiveStatus === "JOINED" ? new Date() : null,
              waitlistPosition,
              paymentStatus:
                effectiveStatus === "JOINED" && session.costTrackingEnabled
                  ? "UNPAID"
                  : "NOT_REQUIRED"
            }
          });

          if (effectiveStatus === "JOINED") {
            await cancelPendingReminders({
              tx,
              sessionId: session.id,
              userId
            });
            await scheduleSessionReminder({
              tx,
              userId,
              sessionId: session.id,
              startsAt: session.startsAt
            });
          } else {
            await cancelPendingReminders({
              tx,
              sessionId: session.id,
              userId
            });
          }
        } else {
          const participant = await tx.sessionParticipant.upsert({
            where: {
              sessionId_userId: {
                sessionId: session.id,
                userId
              }
            },
            update: {
              rsvpStatus: body.status,
              joinedAt: null,
              waitlistPosition: null,
              paymentStatus: "NOT_REQUIRED"
            },
            create: {
              sessionId: session.id,
              userId,
              rsvpStatus: body.status,
              paymentStatus: "NOT_REQUIRED"
            }
          });

          await tx.lineupSlot.deleteMany({
            where: {
              participantId: participant.id
            }
          });

          await cancelPendingReminders({
            tx,
            sessionId: session.id,
            userId
          });

          if (wasJoined) {
            const promoted = await promoteFirstWaitlistedParticipant(tx, session);
            promotedParticipantId = promoted?.id ?? null;
          }
        }

        const updatedSession = await tx.session.findUniqueOrThrow({
          where: { id: session.id },
          include: sessionInclude
        });

        return {
          session: updatedSession,
          promotedParticipantId
        };
      });

      return {
        session: presentSession(result.session),
        promotedParticipantId: result.promotedParticipantId
      };
    }
  );

  app.patch(
    "/sessions/:sessionId/participants/:participantId/payment",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { sessionId: string; participantId: string };
      const body = PaymentBodySchema.parse(request.body);

      await assertCanHostSession(userId, params.sessionId);

      const updated = await prisma.sessionParticipant.updateMany({
        where: {
          id: params.participantId,
          sessionId: params.sessionId
        },
        data: {
          paymentStatus: body.paymentStatus
        }
      });

      if (updated.count === 0) {
        throw notFound("Participant not found");
      }

      const session = await prisma.session.findUniqueOrThrow({
        where: { id: params.sessionId },
        include: sessionInclude
      });

      return {
        session: presentSession(session)
      };
    }
  );

  app.put(
    "/sessions/:sessionId/lineup",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { sessionId: string };
      const body = LineupBodySchema.parse(request.body);

      await assertCanHostSession(userId, params.sessionId);
      validateLineupAssignments(body.assignments);

      const session = await prisma.$transaction(async (tx) => {
        const courts = await tx.court.findMany({
          where: { sessionId: params.sessionId },
          select: { id: true }
        });
        const courtIds = new Set(courts.map((court) => court.id));

        const participants = await tx.sessionParticipant.findMany({
          where: {
            sessionId: params.sessionId,
            id: {
              in: body.assignments.map((assignment) => assignment.participantId)
            },
            rsvpStatus: "JOINED"
          },
          select: { id: true }
        });
        const participantIds = new Set(
          participants.map((participant) => participant.id)
        );

        for (const assignment of body.assignments) {
          if (!courtIds.has(assignment.courtId)) {
            throw badRequest("Lineup contains a court from another session");
          }

          if (!participantIds.has(assignment.participantId)) {
            throw badRequest("Lineup can only include joined participants");
          }
        }

        await tx.lineupSlot.deleteMany({
          where: { sessionId: params.sessionId }
        });

        if (body.assignments.length > 0) {
          await tx.lineupSlot.createMany({
            data: body.assignments.map((assignment) => ({
              sessionId: params.sessionId,
              courtId: assignment.courtId,
              participantId: assignment.participantId,
              slotOrder: assignment.slotOrder
            }))
          });
        }

        return tx.session.findUniqueOrThrow({
          where: { id: params.sessionId },
          include: sessionInclude
        });
      });

      return {
        session: presentSession(session)
      };
    }
  );

  // Check-in: host marks a participant present at the venue. Idempotent.
  app.post(
    "/sessions/:sessionId/participants/:participantId/checkin",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as {
        sessionId: string;
        participantId: string;
      };

      await assertCanHostSession(userId, params.sessionId);

      const participant = await prisma.sessionParticipant.findFirst({
        where: { id: params.participantId, sessionId: params.sessionId },
        select: { id: true, checkedInAt: true }
      });

      if (!participant) {
        throw notFound("Participant not found");
      }

      if (!participant.checkedInAt) {
        await prisma.sessionParticipant.update({
          where: { id: participant.id },
          data: { checkedInAt: new Date() }
        });
      }

      const session = await prisma.session.findUniqueOrThrow({
        where: { id: params.sessionId },
        include: sessionInclude
      });

      return { session: presentSession(session) };
    }
  );

  app.delete(
    "/sessions/:sessionId/participants/:participantId/checkin",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as {
        sessionId: string;
        participantId: string;
      };

      await assertCanHostSession(userId, params.sessionId);

      const updated = await prisma.sessionParticipant.updateMany({
        where: { id: params.participantId, sessionId: params.sessionId },
        data: { checkedInAt: null }
      });

      if (updated.count === 0) {
        throw notFound("Participant not found");
      }

      const session = await prisma.session.findUniqueOrThrow({
        where: { id: params.sessionId },
        include: sessionInclude
      });

      return { session: presentSession(session) };
    }
  );

  // Match results: the host or any joined player can record a score.
  app.get("/sessions/:sessionId/results", async (request) => {
    const params = request.params as { sessionId: string };
    const session = await prisma.session.findUnique({
      where: { id: params.sessionId },
      select: { id: true, groupId: true, visibility: true }
    });
    if (!session) {
      throw notFound("Session not found");
    }
    await assertCanAccessSession(session, await optionalUserId(request));

    const results = await prisma.matchResult.findMany({
      where: { sessionId: params.sessionId },
      orderBy: { createdAt: "asc" }
    });
    return { results: results.map(presentMatchResult) };
  });

  app.post(
    "/sessions/:sessionId/results",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { sessionId: string };
      const body = CreateMatchResultSchema.parse(request.body);

      await assertCanLogResult(userId, params.sessionId);

      const result = await prisma.matchResult.create({
        data: {
          sessionId: params.sessionId,
          label: body.label,
          scoreA: body.scoreA,
          scoreB: body.scoreB
        }
      });

      return reply.code(201).send({ result: presentMatchResult(result) });
    }
  );
}

async function assertCanLogResult(
  userId: string,
  sessionId: string
): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, hostUserId: true }
  });

  if (!session) {
    throw notFound("Session not found");
  }

  if (session.hostUserId === userId) {
    return;
  }

  const participant = await prisma.sessionParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
    select: { rsvpStatus: true }
  });

  if (participant?.rsvpStatus === "JOINED") {
    return;
  }

  throw forbidden("Only the host or joined players can record results");
}

async function optionalUserId(request: FastifyRequest): Promise<string | null> {
  try {
    await request.jwtVerify();
    return getAuthenticatedUserId(request);
  } catch {
    return null;
  }
}

async function assertCanHostSession(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      OR: [
        { hostUserId: userId },
        {
          group: {
            members: {
              some: {
                userId,
                role: "HOST"
              }
            }
          }
        }
      ]
    },
    select: { id: true }
  });

  if (!session) {
    throw forbidden("Only hosts can update this session");
  }
}

async function promoteFirstWaitlistedParticipant(
  tx: Prisma.TransactionClient,
  session: Session
) {
  const firstWaitlisted = await tx.sessionParticipant.findFirst({
    where: {
      sessionId: session.id,
      rsvpStatus: "WAITLISTED"
    },
    orderBy: [{ waitlistPosition: "asc" }, { updatedAt: "asc" }]
  });

  if (!firstWaitlisted) {
    return null;
  }

  await tx.sessionParticipant.update({
    where: { id: firstWaitlisted.id },
    data: {
      rsvpStatus: "JOINED",
      joinedAt: new Date(),
      waitlistPosition: null,
      paymentStatus:
        firstWaitlisted.paymentStatus === "PAID"
          ? "PAID"
          : session.costTrackingEnabled
            ? "UNPAID"
            : "NOT_REQUIRED"
    }
  });

  await createWaitlistPromotionNotifications({
    tx,
    session,
    participant: firstWaitlisted
  });

  return firstWaitlisted;
}

async function syncCourts(input: {
  tx: Prisma.TransactionClient;
  sessionId: string;
  currentCourts: Array<{ id: string; sortOrder: number; lineupSlots: unknown[] }>;
  nextCourtCount: number;
}): Promise<void> {
  const currentCourtCount = input.currentCourts.length;

  if (input.nextCourtCount === currentCourtCount) {
    return;
  }

  if (input.nextCourtCount > currentCourtCount) {
    await input.tx.court.createMany({
      data: Array.from(
        { length: input.nextCourtCount - currentCourtCount },
        (_, index) => {
          const sortOrder = currentCourtCount + index + 1;
          return {
            sessionId: input.sessionId,
            label: `Court ${sortOrder}`,
            sortOrder
          };
        }
      )
    });
    return;
  }

  const courtsToRemove = input.currentCourts.filter(
    (court) => court.sortOrder > input.nextCourtCount
  );
  const hasAssignments = courtsToRemove.some(
    (court) => court.lineupSlots.length > 0
  );

  if (hasAssignments) {
    throw badRequest("Cannot remove courts with assigned lineup slots");
  }

  await input.tx.court.deleteMany({
    where: {
      sessionId: input.sessionId,
      sortOrder: {
        gt: input.nextCourtCount
      }
    }
  });
}

function validateLineupAssignments(
  assignments: Array<{ courtId: string; participantId: string; slotOrder: number }>
): void {
  const participantIds = new Set<string>();
  const courtSlots = new Set<string>();

  for (const assignment of assignments) {
    if (participantIds.has(assignment.participantId)) {
      throw badRequest("A participant can only appear once in the lineup");
    }

    participantIds.add(assignment.participantId);

    const courtSlot = `${assignment.courtId}:${assignment.slotOrder}`;
    if (courtSlots.has(courtSlot)) {
      throw badRequest("A court slot can only have one participant");
    }

    courtSlots.add(courtSlot);
  }
}

function generateInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

function buildInviteUrl(token: string): string {
  return `${env.APP_BASE_URL.replace(/\/?$/, "/")}invites/${token}`;
}
