import type { FastifyInstance } from "fastify";
import type { Prisma, User } from "@prisma/client";
import { CreateReviewSchema } from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { badRequest, forbidden, notFound } from "../utils/api-error.js";
import { presentUserSummary } from "../services/user-presenter.js";

type ReviewWithAuthor = Prisma.ReviewGetPayload<{ include: { author: true } }>;

function presentReview(review: ReviewWithAuthor) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    sessionId: review.sessionId,
    createdAt: review.createdAt.toISOString(),
    author: presentUserSummary(review.author)
  };
}

export async function peopleRoutes(app: FastifyInstance): Promise<void> {
  // Directory of co-members across the requester's groups, with light stats.
  app.get("/people", { preHandler: app.authenticate }, async (request) => {
    const me = getAuthenticatedUserId(request);
    const roleFilter = (request.query as { role?: string }).role;

    const myGroups = await prisma.groupMember.findMany({
      where: { userId: me },
      select: { groupId: true }
    });
    const groupIds = myGroups.map((group) => group.groupId);

    const members = await prisma.groupMember.findMany({
      where: { groupId: { in: groupIds }, userId: { not: me } },
      include: { user: true }
    });

    const byUser = new Map<string, { user: User; isHost: boolean }>();
    for (const member of members) {
      const current = byUser.get(member.userId) ?? { user: member.user, isHost: false };
      if (member.role === "HOST") {
        current.isHost = true;
      }
      byUser.set(member.userId, current);
    }
    const ids = [...byUser.keys()];

    // Two group-by queries instead of per-user lookups (avoids N+1).
    const [reviewGroups, joinedGroups] = await Promise.all([
      prisma.review.groupBy({
        by: ["subjectId"],
        where: { subjectId: { in: ids } },
        _avg: { rating: true },
        _count: true
      }),
      prisma.sessionParticipant.groupBy({
        by: ["userId"],
        where: { userId: { in: ids }, rsvpStatus: "JOINED" },
        _count: true
      })
    ]);
    const reviewMap = new Map(
      reviewGroups.map((group) => [
        group.subjectId,
        { avg: group._avg.rating, count: group._count }
      ])
    );
    const joinedMap = new Map(
      joinedGroups.map((group) => [group.userId, group._count])
    );

    const people = ids.map((id) => {
      const entry = byUser.get(id)!;
      const review = reviewMap.get(id);
      return {
        ...presentUserSummary(entry.user),
        role: entry.isHost ? "host" : "player",
        activityCount: joinedMap.get(id) ?? 0,
        averageRating: review?.avg ?? null,
        reviewCount: review?.count ?? 0
      };
    });

    return {
      people: roleFilter
        ? people.filter((person) => person.role === roleFilter)
        : people
    };
  });

  // A user's public profile with computed stats.
  app.get(
    "/users/:userId/profile",
    { preHandler: app.authenticate },
    async (request) => {
      const { userId } = request.params as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw notFound("User not found");
      }

      const [hostedCount, joinedCount, reviewAgg, followerCount, followingCount] =
        await Promise.all([
          prisma.session.count({ where: { hostUserId: userId } }),
          prisma.sessionParticipant.count({
            where: { userId, rsvpStatus: "JOINED" }
          }),
          prisma.review.aggregate({
            where: { subjectId: userId },
            _avg: { rating: true },
            _count: true
          }),
          prisma.follow.count({ where: { followeeId: userId } }),
          prisma.follow.count({ where: { followerId: userId } })
        ]);

      return {
        profile: {
          ...presentUserSummary(user),
          hostedCount,
          joinedCount,
          averageRating: reviewAgg._avg.rating,
          reviewCount: reviewAgg._count,
          followerCount,
          followingCount
        }
      };
    }
  );

  // Reviews a user has received.
  app.get("/users/:userId/reviews", async (request) => {
    const { userId } = request.params as { userId: string };
    const rows = await prisma.review.findMany({
      where: { subjectId: userId },
      include: { author: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return { reviews: rows.map(presentReview) };
  });

  // Review a co-participant of a session. Gated on attendance (check-in).
  app.post(
    "/sessions/:sessionId/reviews",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const authorId = getAuthenticatedUserId(request);
      const { sessionId } = request.params as { sessionId: string };
      const body = CreateReviewSchema.parse(request.body);

      if (body.subjectId === authorId) {
        throw badRequest("You cannot review yourself");
      }

      const author = await prisma.sessionParticipant.findUnique({
        where: { sessionId_userId: { sessionId, userId: authorId } },
        select: { checkedInAt: true }
      });
      if (!author?.checkedInAt) {
        throw forbidden("Only checked-in attendees can leave reviews");
      }

      const subject = await prisma.sessionParticipant.findUnique({
        where: { sessionId_userId: { sessionId, userId: body.subjectId } },
        select: { id: true }
      });
      if (!subject) {
        throw badRequest("That player is not in this session");
      }

      const review = await prisma.review.upsert({
        where: {
          subjectId_authorId_sessionId: {
            subjectId: body.subjectId,
            authorId,
            sessionId
          }
        },
        update: { rating: body.rating, comment: body.comment },
        create: {
          subjectId: body.subjectId,
          authorId,
          sessionId,
          rating: body.rating,
          comment: body.comment
        },
        include: { author: true }
      });

      return reply.code(201).send({ review: presentReview(review) });
    }
  );
}
