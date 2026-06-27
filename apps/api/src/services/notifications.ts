import type { Prisma, Session, SessionParticipant } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export function getReminderTime(startsAt: Date, leadMinutes = 120): Date | null {
  const reminderTime = new Date(startsAt.getTime() - leadMinutes * 60 * 1000);

  if (reminderTime <= new Date()) {
    return null;
  }

  return reminderTime;
}

export async function scheduleSessionReminder(input: {
  tx: Tx;
  userId: string;
  sessionId: string;
  startsAt: Date;
}): Promise<void> {
  const preference = await getNotificationPreference(input.tx, input.userId);
  if (!preference.remindersEnabled) {
    return;
  }

  const scheduledFor = getReminderTime(
    input.startsAt,
    preference.reminderLeadMinutes
  );

  if (!scheduledFor) {
    return;
  }

  await input.tx.notification.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId,
      type: "SESSION_REMINDER",
      scheduledFor
    }
  });
}

export async function cancelPendingReminders(input: {
  tx: Tx;
  sessionId: string;
  userId?: string;
}): Promise<void> {
  await input.tx.notification.updateMany({
    where: {
      sessionId: input.sessionId,
      userId: input.userId,
      type: "SESSION_REMINDER",
      deliveryStatus: "PENDING"
    },
    data: {
      deliveryStatus: "CANCELLED"
    }
  });
}

export async function rescheduleJoinedReminders(input: {
  tx: Tx;
  session: Session;
}): Promise<void> {
  await cancelPendingReminders({
    tx: input.tx,
    sessionId: input.session.id
  });

  const joinedParticipants = await input.tx.sessionParticipant.findMany({
    where: {
      sessionId: input.session.id,
      rsvpStatus: "JOINED"
    },
    select: { userId: true }
  });

  for (const participant of joinedParticipants) {
    await scheduleSessionReminder({
      tx: input.tx,
      userId: participant.userId,
      sessionId: input.session.id,
      startsAt: input.session.startsAt
    });
  }
}

export async function createSessionChangeNotifications(input: {
  tx: Tx;
  sessionId: string;
}): Promise<void> {
  const participants = await input.tx.sessionParticipant.findMany({
    where: {
      sessionId: input.sessionId,
      rsvpStatus: {
        in: ["JOINED", "WAITLISTED"]
      }
    },
    select: { userId: true }
  });

  const data = [];
  for (const participant of participants) {
    const preference = await getNotificationPreference(input.tx, participant.userId);
    if (preference.statusChangesEnabled) {
      data.push({
        userId: participant.userId,
        sessionId: input.sessionId,
        type: "SESSION_CHANGED" as const
      });
    }
  }

  if (data.length > 0) {
    await input.tx.notification.createMany({ data });
  }
}

export async function createSessionCancellationNotifications(input: {
  tx: Tx;
  sessionId: string;
}): Promise<void> {
  const participants = await input.tx.sessionParticipant.findMany({
    where: {
      sessionId: input.sessionId,
      rsvpStatus: {
        in: ["JOINED", "WAITLISTED"]
      }
    },
    select: { userId: true }
  });

  const data = [];
  for (const participant of participants) {
    const preference = await getNotificationPreference(input.tx, participant.userId);
    if (preference.statusChangesEnabled) {
      data.push({
        userId: participant.userId,
        sessionId: input.sessionId,
        type: "SESSION_CANCELLED" as const
      });
    }
  }

  if (data.length > 0) {
    await input.tx.notification.createMany({ data });
  }
}

export async function createWaitlistPromotionNotifications(input: {
  tx: Tx;
  session: Session;
  participant: SessionParticipant;
}): Promise<void> {
  const preference = await getNotificationPreference(
    input.tx,
    input.participant.userId
  );

  if (!preference.waitlistEnabled) {
    return;
  }

  await input.tx.notification.create({
    data: {
      userId: input.participant.userId,
      sessionId: input.session.id,
      type: "WAITLIST_PROMOTION"
    }
  });

  await scheduleSessionReminder({
    tx: input.tx,
    userId: input.participant.userId,
    sessionId: input.session.id,
    startsAt: input.session.startsAt
  });
}

async function getNotificationPreference(tx: Tx, userId: string) {
  return tx.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
}
