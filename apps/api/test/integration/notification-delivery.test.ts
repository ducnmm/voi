import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../helpers.js";
import { runDeliveryTick } from "../../src/services/notification-delivery.js";
import { MockPushSender } from "../../src/services/push/sender.js";

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

const NOW = new Date("2026-07-19T12:00:00.000Z");

async function seedUser(
  email: string,
  opts: { device?: boolean; pref?: Record<string, unknown> } = {}
) {
  const user = await prisma.user.create({
    data: { email, displayName: email.split("@")[0] }
  });
  if (opts.device !== false) {
    await prisma.pushDevice.create({
      data: { userId: user.id, deviceToken: `tok-${user.id}` }
    });
  }
  if (opts.pref) {
    await prisma.notificationPreference.create({
      data: { userId: user.id, ...(opts.pref as any) }
    });
  }
  return user;
}

async function seedSession(userId: string) {
  const group = await prisma.group.create({
    data: { name: "G", createdByUserId: userId }
  });
  return prisma.session.create({
    data: {
      groupId: group.id,
      hostUserId: userId,
      startsAt: new Date("2026-07-20T12:00:00.000Z"),
      endsAt: new Date("2026-07-20T14:00:00.000Z"),
      venueName: "V",
      courtCount: 1,
      maxPlayers: 4,
      title: "Friday"
    }
  });
}

function notify(
  userId: string,
  sessionId: string,
  extra: Record<string, unknown> = {}
) {
  return prisma.notification.create({
    data: { userId, sessionId, type: "SESSION_REMINDER", ...extra }
  });
}

describe("notification delivery worker", () => {
  it("delivers a pending reminder to active devices and marks SENT", async () => {
    const user = await seedUser("nd_a@voi.test");
    const session = await seedSession(user.id);
    const n = await notify(user.id, session.id);
    const sender = new MockPushSender();

    const result = await runDeliveryTick({ now: NOW, sender });
    expect(result.sent).toBe(1);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.tokens).toEqual([`tok-${user.id}`]);
    expect(sender.sent[0]?.payload.body).toContain("Friday");

    const updated = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } });
    expect(updated.deliveryStatus).toBe("SENT");
    expect(updated.sentAt).not.toBeNull();
  });

  it("does not re-send an already-sent notification (idempotent)", async () => {
    const user = await seedUser("nd_b@voi.test");
    const session = await seedSession(user.id);
    await notify(user.id, session.id);
    const sender = new MockPushSender();

    await runDeliveryTick({ now: NOW, sender });
    const second = await runDeliveryTick({ now: NOW, sender });
    expect(second.sent).toBe(0);
    expect(sender.sent).toHaveLength(1);
  });

  it("suppresses a type disabled in preferences", async () => {
    const user = await seedUser("nd_c@voi.test", { pref: { remindersEnabled: false } });
    const session = await seedSession(user.id);
    const n = await notify(user.id, session.id);
    const sender = new MockPushSender();

    const result = await runDeliveryTick({ now: NOW, sender });
    expect(result.suppressed).toBe(1);
    expect(sender.sent).toHaveLength(0);
    expect(
      (await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).deliveryStatus
    ).toBe("CANCELLED");
  });

  it("marks SENT when there are no active devices", async () => {
    const user = await seedUser("nd_d@voi.test", { device: false });
    const session = await seedSession(user.id);
    await notify(user.id, session.id);
    const sender = new MockPushSender();

    const result = await runDeliveryTick({ now: NOW, sender });
    expect(result.skipped).toBe(1);
    expect(sender.sent).toHaveLength(0);
  });

  it("retries with backoff then dead-letters after maxAttempts", async () => {
    const user = await seedUser("nd_e@voi.test");
    const session = await seedSession(user.id);
    const n = await notify(user.id, session.id);
    const sender = new MockPushSender();
    sender.failNext(10);

    let tickNow = NOW;
    for (let i = 0; i < 5; i += 1) {
      await runDeliveryTick({ now: tickNow, sender, maxAttempts: 3 });
      const current = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } });
      if (current.deliveryStatus === "FAILED") {
        break;
      }
      tickNow = new Date((current.nextAttemptAt ?? tickNow).getTime() + 1000);
    }

    const final = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } });
    expect(final.deliveryStatus).toBe("FAILED");
    expect(final.attempts).toBe(3);
  });

  it("ignores a future-scheduled notification", async () => {
    const user = await seedUser("nd_f@voi.test");
    const session = await seedSession(user.id);
    await notify(user.id, session.id, {
      scheduledFor: new Date("2026-08-01T00:00:00.000Z")
    });
    const sender = new MockPushSender();

    expect((await runDeliveryTick({ now: NOW, sender })).sent).toBe(0);
  });
});
