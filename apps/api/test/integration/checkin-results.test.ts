import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  auth,
  buildTestApp,
  createGroup,
  createSession,
  devLogin,
  participantId,
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

async function setup() {
  const host = await devLogin(app, "ci_host@voi.test");
  const player = await devLogin(app, "ci_player@voi.test");
  const gid = await createGroup(app, host.token);
  const session = await createSession(app, host.token, gid);
  const s = await rsvp(app, player.token, session.id, "JOINED");
  return { host, player, sessionId: session.id, pid: participantId(s, player.userId) };
}

function checkedInAt(session: any, pid: string): string | null {
  return session.participants.find((p: any) => p.id === pid).checkedInAt;
}

describe("check-in", () => {
  it("host checks a participant in, idempotently", async () => {
    const { host, sessionId, pid } = await setup();
    const r1 = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/participants/${pid}/checkin`,
      headers: auth(host.token)
    });
    expect(r1.statusCode).toBe(200);
    const t1 = checkedInAt(r1.json().session, pid);
    expect(t1).toBeTruthy();

    const r2 = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/participants/${pid}/checkin`,
      headers: auth(host.token)
    });
    expect(checkedInAt(r2.json().session, pid)).toBe(t1);
  });

  it("rejects a non-host", async () => {
    const { player, sessionId, pid } = await setup();
    const res = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/participants/${pid}/checkin`,
      headers: auth(player.token)
    });
    expect(res.statusCode).toBe(403);
  });

  it("404s an unknown participant", async () => {
    const { host, sessionId } = await setup();
    const res = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/participants/ghost/checkin`,
      headers: auth(host.token)
    });
    expect(res.statusCode).toBe(404);
  });

  it("undoes check-in", async () => {
    const { host, sessionId, pid } = await setup();
    await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/participants/${pid}/checkin`,
      headers: auth(host.token)
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/v1/sessions/${sessionId}/participants/${pid}/checkin`,
      headers: auth(host.token)
    });
    expect(checkedInAt(res.json().session, pid)).toBeNull();
  });
});

describe("match results", () => {
  it("host and joined players record; strangers cannot", async () => {
    const { host, player, sessionId } = await setup();
    const stranger = await devLogin(app, "ci_stranger@voi.test");

    const byPlayer = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/results`,
      headers: auth(player.token),
      payload: { label: "Court 1", scoreA: 21, scoreB: 18 }
    });
    expect(byPlayer.statusCode).toBe(201);

    const byHost = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/results`,
      headers: auth(host.token),
      payload: { label: "Court 2", scoreA: 19, scoreB: 21 }
    });
    expect(byHost.statusCode).toBe(201);

    const byStranger = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/results`,
      headers: auth(stranger.token),
      payload: { label: "X", scoreA: 1, scoreB: 0 }
    });
    expect(byStranger.statusCode).toBe(403);
  });

  it("validates score range", async () => {
    const { host, sessionId } = await setup();
    const res = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/results`,
      headers: auth(host.token),
      payload: { label: "X", scoreA: 999, scoreB: 1 }
    });
    expect(res.statusCode).toBe(400);
  });

  it("lists results in creation order (public read for PRIVATE_LINK)", async () => {
    const { host, sessionId } = await setup();
    for (const label of ["A", "B"]) {
      await app.inject({
        method: "POST",
        url: `/v1/sessions/${sessionId}/results`,
        headers: auth(host.token),
        payload: { label, scoreA: 21, scoreB: 10 }
      });
    }
    const res = await app.inject({
      method: "GET",
      url: `/v1/sessions/${sessionId}/results`
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results.map((r: any) => r.label)).toEqual(["A", "B"]);
  });

  it("hides GROUP_ONLY results from strangers", async () => {
    const host = await devLogin(app, "ci_go_host@voi.test");
    const member = await devLogin(app, "ci_go_member@voi.test");
    const stranger = await devLogin(app, "ci_go_stranger@voi.test");
    const gid = await createGroup(app, host.token);
    await prisma.groupMember.create({
      data: { groupId: gid, userId: member.userId, role: "MEMBER" }
    });
    const session = await createSession(app, host.token, gid, {
      visibility: "GROUP_ONLY"
    });
    await app.inject({
      method: "POST",
      url: `/v1/sessions/${session.id}/results`,
      headers: auth(host.token),
      payload: { label: "A", scoreA: 21, scoreB: 10 }
    });

    expect(
      (await app.inject({ method: "GET", url: `/v1/sessions/${session.id}/results` }))
        .statusCode
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/v1/sessions/${session.id}/results`,
          headers: auth(stranger.token)
        })
      ).statusCode
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/v1/sessions/${session.id}/results`,
          headers: auth(member.token)
        })
      ).statusCode
    ).toBe(200);
  });
});
