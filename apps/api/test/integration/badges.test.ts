import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  auth,
  buildTestApp,
  createGroup,
  createSession,
  devLogin,
  prisma,
  resetDb
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

describe("GET /me/badges", () => {
  it("counts unread alerts and rooms with chat", async () => {
    const host = await devLogin(app, "badge_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId);

    const posted = await app.inject({
      method: "POST",
      url: `/v1/sessions/${session.id}/messages`,
      headers: auth(host.token),
      payload: { body: "hello" }
    });
    expect(posted.statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: "/v1/me/badges",
      headers: auth(host.token)
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.alertsUnread).toBeGreaterThanOrEqual(1);
    expect(body.chats.some((c: { room: string }) => c.room === `session:${session.id}`)).toBe(
      true
    );
  });
});
