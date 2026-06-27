import type { FastifyInstance } from "fastify";
import { UpdateNotificationPreferenceSchema } from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";

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

  app.get("/notifications", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);

    const notifications = await prisma.notification.findMany({
      where: { userId },
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
