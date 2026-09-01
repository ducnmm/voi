import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  auth,
  buildTestApp,
  createGroup,
  createSession,
  devLogin,
  prisma,
  resetDb,
  rsvp
} from "../helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

describe("session create / RSVP / payment / lineup", () => {
  it("auto-joins the host and issues an invite", async () => {
    const host = await devLogin(app, "host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId, {
      maxPlayers: 2,
      costTrackingEnabled: true
    });
    expect(session.summary.joinedPlayerCount).toBe(1);
    expect(session.participants[0].userId).toBe(host.userId);

    const lookup = await app.inject({
      method: "GET",
      url: `/v1/invites/${session.inviteUrlToken}`
    });
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json().invite.session.participants).toBeUndefined();
    expect(lookup.json().invite.session.summary.joinedPlayerCount).toBe(1);
  });

  it("counts every upcoming session on the group list", async () => {
    const host = await devLogin(app, "grp_host@voi.test");
    const groupId = await createGroup(app, host.token);
    for (let i = 0; i < 6; i += 1) {
      await createSession(app, host.token, groupId, { title: `S${i}` });
    }
    const res = await app.inject({
      method: "GET",
      url: "/v1/groups",
      headers: auth(host.token)
    });
    expect(res.statusCode).toBe(200);
    const group = res.json().groups.find((g: { id: string }) => g.id === groupId);
    expect(group.upcomingSessionCount).toBe(6);
    expect(group.memberCount).toBe(1);
  });

  it("waitlists the extra player when the session is full", async () => {
    const host = await devLogin(app, "cap_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId, {
      courtCount: 1,
      maxPlayers: 1
    });
    const other = await devLogin(app, "cap_player@voi.test");
    const updated = await rsvp(app, other.token, session.id, "JOINED");
    const player = updated.participants.find((p: { userId: string }) => p.userId === other.userId);
    expect(player.rsvpStatus).toBe("WAITLISTED");
  });

  it("promotes the waitlist when maxPlayers increases", async () => {
    const host = await devLogin(app, "promo_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId, {
      courtCount: 1,
      maxPlayers: 1
    });
    const other = await devLogin(app, "promo_player@voi.test");
    await rsvp(app, other.token, session.id, "JOINED");

    const patched = await app.inject({
      method: "PATCH",
      url: `/v1/sessions/${session.id}`,
      headers: auth(host.token),
      payload: { maxPlayers: 2 }
    });
    expect(patched.statusCode).toBe(200);
    const player = patched
      .json()
      .session.participants.find((p: { userId: string }) => p.userId === other.userId);
    expect(player.rsvpStatus).toBe("JOINED");
  });

  it("forbids lineup edits from non-hosts", async () => {
    const host = await devLogin(app, "line_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId);
    const other = await devLogin(app, "line_player@voi.test");
    const res = await app.inject({
      method: "PUT",
      url: `/v1/sessions/${session.id}/lineup`,
      headers: auth(other.token),
      payload: { assignments: [] }
    });
    expect(res.statusCode).toBe(403);
  });

  it("forbids payment updates from non-hosts", async () => {
    const host = await devLogin(app, "pay_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId, {
      costTrackingEnabled: true
    });
    const participantId = session.participants[0].id;
    const other = await devLogin(app, "pay_player@voi.test");
    const res = await app.inject({
      method: "PATCH",
      url: `/v1/sessions/${session.id}/participants/${participantId}/payment`,
      headers: auth(other.token),
      payload: { paymentStatus: "PAID" }
    });
    expect(res.statusCode).toBe(403);
  });

  it("hides GROUP_ONLY sessions from outsiders", async () => {
    const host = await devLogin(app, "priv_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId, {
      visibility: "GROUP_ONLY"
    });
    const outsider = await devLogin(app, "priv_out@voi.test");
    const res = await app.inject({
      method: "GET",
      url: `/v1/sessions/${session.id}`,
      headers: auth(outsider.token)
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns the invite token only to the host", async () => {
    const host = await devLogin(app, "tok_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId);
    const player = await devLogin(app, "tok_player@voi.test");
    await rsvp(app, player.token, session.id);

    const asHost = await app.inject({
      method: "GET",
      url: `/v1/sessions/${session.id}`,
      headers: auth(host.token)
    });
    expect(asHost.json().session.inviteUrlToken).toBeTruthy();

    const asPlayer = await app.inject({
      method: "GET",
      url: `/v1/sessions/${session.id}`,
      headers: auth(player.token)
    });
    expect(asPlayer.json().session.inviteUrlToken).toBeNull();

    const anonymous = await app.inject({
      method: "GET",
      url: `/v1/sessions/${session.id}`
    });
    expect(anonymous.json().session.inviteUrlToken).toBeNull();
  });
});

describe("notifications read state", () => {
  it("marks a notification as read", async () => {
    const host = await devLogin(app, "n_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId);
    const row = await prisma.notification.create({
      data: {
        userId: host.userId,
        sessionId: session.id,
        type: "SESSION_REMINDER"
      }
    });
    const res = await app.inject({
      method: "POST",
      url: `/v1/notifications/${row.id}/read`,
      headers: auth(host.token)
    });
    expect(res.statusCode).toBe(200);
    const list = await app.inject({
      method: "GET",
      url: "/v1/notifications",
      headers: auth(host.token)
    });
    const item = list.json().notifications.find((n: { id: string }) => n.id === row.id);
    expect(item.readAt).toBeTruthy();
  });
});
