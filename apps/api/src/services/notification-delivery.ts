import type { NotificationPreference, NotificationType } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { PushPayload, PushSender } from "./push/sender.js";

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 50;

/** Exponential backoff: 1m, 2m, 4m… capped at 1 hour. */
export function backoffMs(attempts: number): number {
  const base = 60_000 * 2 ** Math.max(0, attempts - 1);
  return Math.min(base, 60 * 60_000);
}

export function preferenceAllows(
  type: NotificationType,
  pref: NotificationPreference | null
): boolean {
  if (!pref) {
    return true;
  }
  switch (type) {
    case "SESSION_REMINDER":
      return pref.remindersEnabled;
    case "WAITLIST_PROMOTION":
      return pref.waitlistEnabled;
    case "SESSION_CANCELLED":
    case "SESSION_CHANGED":
      return pref.statusChangesEnabled;
    default:
      return true;
  }
}

export function buildPayload(
  type: NotificationType,
  session: { title: string | null } | null
): PushPayload {
  const name = session?.title ?? "your session";
  switch (type) {
    case "SESSION_REMINDER":
      return { title: "Session reminder", body: `${name} is coming up` };
    case "WAITLIST_PROMOTION":
      return { title: "You're in!", body: `A spot opened up in ${name}` };
    case "SESSION_CANCELLED":
      return { title: "Session cancelled", body: `${name} was cancelled` };
    case "SESSION_CHANGED":
      return { title: "Session updated", body: `${name} was updated` };
    default:
      return { title: "Voi", body: name };
  }
}

export interface DeliveryDeps {
  now: Date;
  sender: PushSender;
  maxAttempts?: number;
  batchSize?: number;
}

export interface DeliveryTickResult {
  sent: number;
  failed: number;
  retried: number;
  suppressed: number;
  skipped: number;
}

/**
 * Processes one batch of due, pending notifications. At-least-once with
 * idempotency (only PENDING rows are picked; SENT/FAILED/CANCELLED are never
 * re-processed). Failures back off and dead-letter (FAILED) after maxAttempts.
 */
export async function runDeliveryTick(
  deps: DeliveryDeps
): Promise<DeliveryTickResult> {
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const result: DeliveryTickResult = {
    sent: 0,
    failed: 0,
    retried: 0,
    suppressed: 0,
    skipped: 0
  };

  const due = await prisma.notification.findMany({
    where: {
      deliveryStatus: "PENDING",
      AND: [
        { OR: [{ scheduledFor: null }, { scheduledFor: { lte: deps.now } }] },
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: deps.now } }] }
      ]
    },
    include: {
      user: {
        include: {
          pushDevices: { where: { disabledAt: null } },
          notificationPref: true
        }
      },
      session: { select: { title: true } }
    },
    orderBy: { createdAt: "asc" },
    take: deps.batchSize ?? DEFAULT_BATCH_SIZE
  });

  for (const notification of due) {
    if (!preferenceAllows(notification.type, notification.user.notificationPref)) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { deliveryStatus: "CANCELLED" }
      });
      result.suppressed += 1;
      continue;
    }

    const tokens = notification.user.pushDevices.map((device) => device.deviceToken);
    if (tokens.length === 0) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { deliveryStatus: "SENT", sentAt: deps.now }
      });
      result.skipped += 1;
      continue;
    }

    try {
      await deps.sender.send(
        tokens,
        buildPayload(notification.type, notification.session)
      );
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          deliveryStatus: "SENT",
          sentAt: deps.now,
          attempts: notification.attempts + 1
        }
      });
      result.sent += 1;
    } catch {
      const attempts = notification.attempts + 1;
      if (attempts >= maxAttempts) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { deliveryStatus: "FAILED", attempts }
        });
        result.failed += 1;
      } else {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            attempts,
            nextAttemptAt: new Date(deps.now.getTime() + backoffMs(attempts))
          }
        });
        result.retried += 1;
      }
    }
  }

  return result;
}
