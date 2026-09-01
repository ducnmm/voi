import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import {
  buildTestApp,
  createGroup,
  createSession,
  devLogin,
  prisma,
  resetDb,
  rsvp
} from "../helpers.js";

let app: FastifyInstance;
let wsBase: string;

beforeAll(async () => {
  app = await buildTestApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  wsBase = `ws://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

function connect(sessionId: string, token: string): WebSocket {
  return new WebSocket(`${wsBase}/v1/ws/sessions/${sessionId}?token=${token}`);
}

function opened(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

function waitForType(ws: WebSocket, type: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: any) => {
      const payload = JSON.parse(data.toString());
      if (payload.type === type) {
        ws.off("message", onMessage);
        resolve(payload);
      }
    };
    ws.on("message", onMessage);
    ws.once("error", reject);
  });
}

function closedCode(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => ws.once("close", (code) => resolve(code)));
}

describe("chat WebSocket", () => {
  it("broadcasts a sent message to everyone in the room", async () => {
    const host = await devLogin(app, "ws_host@voi.test");
    const player = await devLogin(app, "ws_player@voi.test");
    const gid = await createGroup(app, host.token);
    const session = await createSession(app, host.token, gid);
    await rsvp(app, player.token, session.id);

    const c1 = connect(session.id, host.token);
    const c2 = connect(session.id, player.token);
    await Promise.all([opened(c1), opened(c2)]);
    // wait until the server has authorized + joined both sockets to the room
    await Promise.all([waitForType(c1, "ready"), waitForType(c2, "ready")]);

    const received = waitForType(c2, "message");
    c1.send(JSON.stringify({ body: "hello room" }));
    const payload = await received;

    expect(payload.type).toBe("message");
    expect(payload.message.body).toBe("hello room");
    expect(payload.message.author.id).toBe(host.userId);

    c1.close();
    c2.close();
  });

  it("rate-limits chat messages on the socket", async () => {
    const { CHAT_RATE_MAX } = await import("../../src/services/rate-limit.js");
    const host = await devLogin(app, "ws_rl_host@voi.test");
    const gid = await createGroup(app, host.token);
    const session = await createSession(app, host.token, gid);

    const ws = connect(session.id, host.token);
    await opened(ws);
    await waitForType(ws, "ready");

    const limited = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no rate-limit error")), 4000);
      ws.on("message", (data) => {
        const payload = JSON.parse(data.toString());
        if (payload.type === "error" && payload.code === "RATE_LIMITED") {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    for (let i = 0; i < CHAT_RATE_MAX + 1; i += 1) {
      ws.send(JSON.stringify({ body: `flood ${i}` }));
    }

    expect(await limited).toMatchObject({ type: "error", code: "RATE_LIMITED" });
    await expect
      .poll(async () =>
        prisma.chatMessage.count({ where: { sessionId: session.id } })
      )
      .toBe(CHAT_RATE_MAX);
    ws.close();
  });

  it("closes with 4001 on an invalid token", async () => {
    const host = await devLogin(app, "ws_badtoken_host@voi.test");
    const gid = await createGroup(app, host.token);
    const session = await createSession(app, host.token, gid);

    const ws = connect(session.id, "not-a-real-token");
    expect(await closedCode(ws)).toBe(4001);
  });

  it("closes with 4003 for a non-member", async () => {
    const host = await devLogin(app, "ws_owner@voi.test");
    const stranger = await devLogin(app, "ws_stranger@voi.test");
    const gid = await createGroup(app, host.token);
    const session = await createSession(app, host.token, gid);

    const ws = connect(session.id, stranger.token);
    expect(await closedCode(ws)).toBe(4003);
  });
});

describe("group chat WebSocket", () => {
  function connectGroup(groupId: string, token: string): WebSocket {
    return new WebSocket(`${wsBase}/v1/ws/groups/${groupId}?token=${token}`);
  }

  async function setupGroup() {
    const host = await devLogin(app, "gws_host@voi.test");
    const member = await devLogin(app, "gws_member@voi.test");
    const groupId = await createGroup(app, host.token);
    await prisma.groupMember.create({
      data: { groupId, userId: member.userId, role: "MEMBER" }
    });
    return { host, member, groupId };
  }

  it("broadcasts a sent message to everyone in the group room", async () => {
    const { host, member, groupId } = await setupGroup();

    const c1 = connectGroup(groupId, host.token);
    const c2 = connectGroup(groupId, member.token);
    await Promise.all([opened(c1), opened(c2)]);
    await Promise.all([waitForType(c1, "ready"), waitForType(c2, "ready")]);

    const received = waitForType(c2, "message");
    c1.send(JSON.stringify({ body: "hello group" }));
    const payload = await received;

    expect(payload.type).toBe("message");
    expect(payload.message.body).toBe("hello group");
    expect(payload.message.author.id).toBe(host.userId);

    c1.close();
    c2.close();
  });

  it("broadcasts REST POSTs to live group subscribers", async () => {
    const { host, member, groupId } = await setupGroup();
    const ws = connectGroup(groupId, member.token);
    await opened(ws);
    await waitForType(ws, "ready");

    const received = waitForType(ws, "message");
    const res = await app.inject({
      method: "POST",
      url: `/v1/groups/${groupId}/messages`,
      headers: { authorization: `Bearer ${host.token}` },
      payload: { body: "from rest" }
    });
    expect(res.statusCode).toBe(201);
    const payload = await received;
    expect(payload.message.body).toBe("from rest");
    ws.close();
  });

  it("closes with 4001 on an invalid token", async () => {
    const host = await devLogin(app, "gws_badtoken_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const ws = connectGroup(groupId, "not-a-real-token");
    expect(await closedCode(ws)).toBe(4001);
  });

  it("closes with 4003 for a non-member", async () => {
    const host = await devLogin(app, "gws_owner@voi.test");
    const stranger = await devLogin(app, "gws_stranger@voi.test");
    const groupId = await createGroup(app, host.token);
    const ws = connectGroup(groupId, stranger.token);
    expect(await closedCode(ws)).toBe(4003);
  });
});
