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
import { CHAT_RATE_MAX } from "../../src/services/rate-limit.js";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setup() {
  const host = await devLogin(app, "chat_host@voi.test");
  const player = await devLogin(app, "chat_player@voi.test");
  const gid = await createGroup(app, host.token);
  const session = await createSession(app, host.token, gid);
  await rsvp(app, player.token, session.id);
  return { host, player, sessionId: session.id };
}

function send(token: string, sessionId: string, body: string) {
  return app.inject({
    method: "POST",
    url: `/v1/sessions/${sessionId}/messages`,
    headers: auth(token),
    payload: { body }
  });
}

async function history(token: string, sessionId: string, query = ""): Promise<any> {
  const res = await app.inject({
    method: "GET",
    url: `/v1/sessions/${sessionId}/messages${query}`,
    headers: auth(token)
  });
  return res.json();
}

describe("chat REST", () => {
  it("host and participant send and read; strangers are blocked", async () => {
    const { host, player, sessionId } = await setup();
    const stranger = await devLogin(app, "chat_stranger@voi.test");

    expect((await send(host.token, sessionId, "hi from host")).statusCode).toBe(201);
    expect((await send(player.token, sessionId, "hi from player")).statusCode).toBe(201);
    expect((await send(stranger.token, sessionId, "intruder")).statusCode).toBe(403);

    const h = await history(host.token, sessionId);
    expect(h.messages.map((m: any) => m.body)).toEqual([
      "hi from host",
      "hi from player"
    ]);
    expect(h.messages[0].author.id).toBe(host.userId);

    const strangerRead = await app.inject({
      method: "GET",
      url: `/v1/sessions/${sessionId}/messages`,
      headers: auth(stranger.token)
    });
    expect(strangerRead.statusCode).toBe(403);
  });

  it("rate-limits message posts per user", async () => {
    const { host, sessionId } = await setup();
    const statuses: number[] = [];
    for (let i = 0; i < CHAT_RATE_MAX + 1; i += 1) {
      statuses.push((await send(host.token, sessionId, `m${i}`)).statusCode);
    }
    expect(statuses.filter((code) => code === 201)).toHaveLength(CHAT_RATE_MAX);
    expect(statuses.at(-1)).toBe(429);
  });

  it("validates the body", async () => {
    const { host, sessionId } = await setup();
    expect((await send(host.token, sessionId, "")).statusCode).toBe(400);
    expect((await send(host.token, sessionId, "x".repeat(2001))).statusCode).toBe(400);
  });

  it("paginates oldest→newest with a before cursor", async () => {
    const { host, sessionId } = await setup();
    for (let i = 1; i <= 5; i += 1) {
      await send(host.token, sessionId, `m${i}`);
      await sleep(5); // guarantee distinct createdAt for a deterministic order
    }

    const page1 = await history(host.token, sessionId, "?limit=2");
    expect(page1.messages.map((m: any) => m.body)).toEqual(["m4", "m5"]);
    expect(page1.olderCursor).toBeTruthy();

    const page2 = await history(
      host.token,
      sessionId,
      `?limit=2&before=${encodeURIComponent(page1.olderCursor)}`
    );
    expect(page2.messages.map((m: any) => m.body)).toEqual(["m2", "m3"]);

    const page3 = await history(
      host.token,
      sessionId,
      `?limit=2&before=${encodeURIComponent(page2.olderCursor)}`
    );
    expect(page3.messages.map((m: any) => m.body)).toEqual(["m1"]);
    expect(page3.olderCursor).toBeNull();
  });

  it("does not echo an oversized body in the validation error", async () => {
    const { host, sessionId } = await setup();
    const long = "x".repeat(2001);
    const res = await send(host.token, sessionId, long);
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.json())).not.toContain(long);
  });
});

describe("group chat REST", () => {
  async function setupGroup() {
    const host = await devLogin(app, "gchat_host@voi.test");
    const member = await devLogin(app, "gchat_member@voi.test");
    const groupId = await createGroup(app, host.token);
    await prisma.groupMember.create({
      data: { groupId, userId: member.userId, role: "MEMBER" }
    });
    return { host, member, groupId };
  }

  function sendGroup(token: string, groupId: string, body: string) {
    return app.inject({
      method: "POST",
      url: `/v1/groups/${groupId}/messages`,
      headers: auth(token),
      payload: { body }
    });
  }

  async function groupHistory(token: string, groupId: string, query = ""): Promise<any> {
    const res = await app.inject({
      method: "GET",
      url: `/v1/groups/${groupId}/messages${query}`,
      headers: auth(token)
    });
    return res;
  }

  it("members can send and read; non-members are blocked; missing group is 404", async () => {
    const { host, member, groupId } = await setupGroup();
    const stranger = await devLogin(app, "gchat_stranger@voi.test");

    expect((await sendGroup(host.token, groupId, "hi from host")).statusCode).toBe(
      201
    );
    expect((await sendGroup(member.token, groupId, "hi from member")).statusCode).toBe(
      201
    );
    expect((await sendGroup(stranger.token, groupId, "intruder")).statusCode).toBe(
      403
    );

    const h = await groupHistory(host.token, groupId);
    expect(h.statusCode).toBe(200);
    expect(h.json().messages.map((m: any) => m.body)).toEqual([
      "hi from host",
      "hi from member"
    ]);
    expect(h.json().messages[0].author.id).toBe(host.userId);

    const strangerRead = await groupHistory(stranger.token, groupId);
    expect(strangerRead.statusCode).toBe(403);

    const missing = await groupHistory(host.token, "does-not-exist");
    expect(missing.statusCode).toBe(404);
  });

  it("validates the body", async () => {
    const { host, groupId } = await setupGroup();
    expect((await sendGroup(host.token, groupId, "")).statusCode).toBe(400);
    const long = "x".repeat(2001);
    const res = await sendGroup(host.token, groupId, long);
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.json())).not.toContain(long);
  });

  it("does not mix group messages with session chat", async () => {
    const { host, groupId } = await setupGroup();
    const session = await createSession(app, host.token, groupId);
    expect((await sendGroup(host.token, groupId, "group only")).statusCode).toBe(201);
    expect((await send(host.token, session.id, "session only")).statusCode).toBe(201);

    const group = (await groupHistory(host.token, groupId)).json();
    expect(group.messages.map((m: any) => m.body)).toEqual(["group only"]);

    const sessionHistory = await history(host.token, session.id);
    expect(sessionHistory.messages.map((m: any) => m.body)).toEqual(["session only"]);
  });
});
