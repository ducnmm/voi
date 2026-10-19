import type { FastifyInstance } from "fastify";
import { UpdateNotificationPreferenceSchema } from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { notFound } from "../utils/api-error.js";

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/notification-preferences",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const preference = await prisma.notificationPreference.upsert({
        where: { userId },
        update: {},
        create: { userId }
      });

      return {
        preference: presentPreference(preference)
      };
    }
  );

  app.put(
    "/notification-preferences",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const body = UpdateNotificationPreferenceSchema.parse(request.body);
      const preference = await prisma.notificationPreference.upsert({
        where: { userId },
        update: body,
        create: {
          userId,
          ...body
        }
      });

      return {
        preference: presentPreference(preference)
      };
    }
  );

  app.get("/me/badges", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true }
    });
    const groupIds = memberships.map((row) => row.groupId);

    const [alertsUnread, sessions] = await Promise.all([
      prisma.notification.count({
        where: { userId, readAt: null, deliveryStatus: { not: "CANCELLED" } }
      }),
      groupIds.length > 0
        ? prisma.session.findMany({
            where: { groupId: { in: groupIds } },
            select: { id: true }
          })
        : Promise.resolve([])
    ]);
    const sessionIds = sessions.map((row) => row.id);

    const [groupLast, sessionLast] = await Promise.all([
      groupIds.length > 0
        ? prisma.chatMessage.groupBy({
            by: ["groupId"],
            where: { groupId: { in: groupIds } },
            _max: { createdAt: true }
          })
        : Promise.resolve([]),
      sessionIds.length > 0
        ? prisma.chatMessage.groupBy({
            by: ["sessionId"],
            where: { sessionId: { in: sessionIds } },
            _max: { createdAt: true }
          })
        : Promise.resolve([])
    ]);

    const chats = [
      ...groupLast.flatMap((row) =>
        row.groupId && row._max.createdAt
          ? [{ room: `group:${row.groupId}`, lastMessageAt: row._max.createdAt.toISOString() }]
          : []
      ),
      ...sessionLast.flatMap((row) =>
        row.sessionId && row._max.createdAt
          ? [
              {
                room: `session:${row.sessionId}`,
                lastMessageAt: row._max.createdAt.toISOString()
              }
            ]
          : []
      )
    ];

    return { alertsUnread, chats };
  });

  app.get("/notifications", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);

    const notifications = await prisma.notification.findMany({
      where: { userId, deliveryStatus: { not: "CANCELLED" } },
      include: {
        session: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            venueName: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50
    });

    return {
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        deliveryStatus: notification.deliveryStatus,
        scheduledFor: notification.scheduledFor?.toISOString() ?? null,
        sentAt: notification.sentAt?.toISOString() ?? null,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
        session: notification.session
          ? {
              id: notification.session.id,
              title: notification.session.title,
              startsAt: notification.session.startsAt.toISOString(),
              venueName: notification.session.venueName
            }
          : null
      }))
    };
  });

  app.post(
    "/notifications/:notificationId/read",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { notificationId: string };
      const updated = await prisma.notification.updateMany({
        where: { id: params.notificationId, userId, readAt: null },
        data: { readAt: new Date() }
      });
      if (updated.count === 0) {
        const existing = await prisma.notification.findFirst({
          where: { id: params.notificationId, userId }
        });
        if (!existing) {
          throw notFound("Notification not found");
        }
      }
      return { ok: true };
    }
  );

  app.post(
    "/notifications/read-all",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() }
      });
      return { ok: true };
    }
  );
}

function presentPreference(preference: {
  remindersEnabled: boolean;
  statusChangesEnabled: boolean;
  waitlistEnabled: boolean;
  reminderLeadMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    remindersEnabled: preference.remindersEnabled,
    statusChangesEnabled: preference.statusChangesEnabled,
    waitlistEnabled: preference.waitlistEnabled,
    reminderLeadMinutes: preference.reminderLeadMinutes,
    createdAt: preference.createdAt.toISOString(),
    updatedAt: preference.updatedAt.toISOString()
  };
}
