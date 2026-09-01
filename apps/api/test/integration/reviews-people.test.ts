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

// Host + two players, both joined and checked in.
async function attendedSession() {
  const host = await devLogin(app, "rv_host@voi.test");
  const gid = await createGroup(app, host.token);
  const session = await createSession(app, host.token, gid);
  const a = await devLogin(app, "rv_a@voi.test");
  const b = await devLogin(app, "rv_b@voi.test");
  await rsvp(app, a.token, session.id);
  const s = await rsvp(app, b.token, session.id);
  for (const uid of [a.userId, b.userId]) {
    await app.inject({
      method: "POST",
      url: `/v1/sessions/${session.id}/participants/${participantId(s, uid)}/checkin`,
      headers: auth(host.token)
    });
  }
  return { host, a, b, gid, sessionId: session.id };
}

describe("reviews", () => {
  it("requires the author to be checked in", async () => {
    const host = await devLogin(app, "rv2_host@voi.test");
    const gid = await createGroup(app, host.token);
    const session = await createSession(app, host.token, gid);
    const a = await devLogin(app, "rv2_a@voi.test");
    const b = await devLogin(app, "rv2_b@voi.test");
    await rsvp(app, a.token, session.id);
    await rsvp(app, b.token, session.id);

    const res = await app.inject({
      method: "POST",
      url: `/v1/sessions/${session.id}/reviews`,
      headers: auth(a.token),
      payload: { subjectId: b.userId, rating: 5 }
    });
    expect(res.statusCode).toBe(403);
  });

  it("a checked-in attendee reviews a co-participant; upsert updates", async () => {
    const { a, b, sessionId } = await attendedSession();

    const r1 = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/reviews`,
      headers: auth(a.token),
      payload: { subjectId: b.userId, rating: 4, comment: "gg" }
    });
    expect(r1.statusCode).toBe(201);

    const r2 = await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/reviews`,
      headers: auth(a.token),
      payload: { subjectId: b.userId, rating: 5, comment: "even better" }
    });
    expect(r2.statusCode).toBe(201);

    expect(
      (
        await app.inject({
          method: "GET",
          url: `/v1/users/${b.userId}/reviews`
        })
      ).statusCode
    ).toBe(401);

    const list = (
      await app.inject({
        method: "GET",
        url: `/v1/users/${b.userId}/reviews`,
        headers: auth(a.token)
      })
    ).json().reviews;
    expect(list.length).toBe(1);
    expect(list[0].rating).toBe(5);
    expect(list[0].author.id).toBe(a.userId);
  });

  it("rejects self-review and a non-participant subject", async () => {
    const { a, sessionId } = await attendedSession();
    expect(
      (await app.inject({
        method: "POST",
        url: `/v1/sessions/${sessionId}/reviews`,
        headers: auth(a.token),
        payload: { subjectId: a.userId, rating: 5 }
      })).statusCode
    ).toBe(400);
    expect(
      (await app.inject({
        method: "POST",
        url: `/v1/sessions/${sessionId}/reviews`,
        headers: auth(a.token),
        payload: { subjectId: "ghost", rating: 5 }
      })).statusCode
    ).toBe(400);
  });

  it("validates rating range 1..5", async () => {
    const { a, b, sessionId } = await attendedSession();
    expect(
      (await app.inject({
        method: "POST",
        url: `/v1/sessions/${sessionId}/reviews`,
        headers: auth(a.token),
        payload: { subjectId: b.userId, rating: 6 }
      })).statusCode
    ).toBe(400);
  });
});

describe("profile stats", () => {
  it("computes joined / review / follower / hosted counts", async () => {
    const { a, b, sessionId } = await attendedSession();
    await app.inject({
      method: "POST",
      url: `/v1/sessions/${sessionId}/reviews`,
      headers: auth(a.token),
      payload: { subjectId: b.userId, rating: 4 }
    });
    await app.inject({ method: "PUT", url: `/v1/users/${b.userId}/follow`, headers: auth(a.token) });

    const profile = (
      await app.inject({
        method: "GET",
        url: `/v1/users/${b.userId}/profile`,
        headers: auth(a.token)
      })
    ).json().profile;

    expect(profile.joinedCount).toBe(1);
    expect(profile.reviewCount).toBe(1);
    expect(profile.averageRating).toBe(4);
    expect(profile.followerCount).toBe(1);
    expect(profile.hostedCount).toBe(0);
  });
});

describe("people directory", () => {
  it("lists co-members with role and stats, filterable by role", async () => {
    const host = await devLogin(app, "ppl_host@voi.test");
    const gid = await createGroup(app, host.token);
    const player = await devLogin(app, "ppl_player@voi.test");
    await prisma.groupMember.create({
      data: { groupId: gid, userId: player.userId, role: "MEMBER" }
    });

    const fromHost = (
      await app.inject({ method: "GET", url: "/v1/people", headers: auth(host.token) })
    ).json().people;
    const playerEntry = fromHost.find((p: any) => p.id === player.userId);
    expect(playerEntry).toBeTruthy();
    expect(playerEntry.role).toBe("player");

    const fromPlayer = (
      await app.inject({ method: "GET", url: "/v1/people", headers: auth(player.token) })
    ).json().people;
    expect(fromPlayer.find((p: any) => p.id === host.userId).role).toBe("host");

    const hostsOnly = (
      await app.inject({ method: "GET", url: "/v1/people?role=host", headers: auth(player.token) })
    ).json().people;
    expect(hostsOnly.every((p: any) => p.role === "host")).toBe(true);
    expect(hostsOnly.length).toBe(1);
  });

  it("excludes the requester and people from other groups", async () => {
    const host = await devLogin(app, "ppl_iso_host@voi.test");
    await createGroup(app, host.token);
    const fromHost = (
      await app.inject({ method: "GET", url: "/v1/people", headers: auth(host.token) })
    ).json().people;
    expect(fromHost).toEqual([]);
  });
});
