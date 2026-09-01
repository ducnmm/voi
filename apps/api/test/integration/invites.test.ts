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

describe("invites expire", () => {
  it("issues session invites with an expiry and rejects them after it", async () => {
    const host = await devLogin(app, "inv_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId);
    const token = session.inviteUrlToken as string;

    const live = await app.inject({
      method: "GET",
      url: `/v1/invites/${token}`
    });
    expect(live.statusCode).toBe(200);

    await prisma.invite.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    const expired = await app.inject({
      method: "GET",
      url: `/v1/invites/${token}`
    });
    expect(expired.statusCode).toBe(404);
    expect(expired.json().error.message).toBe("Invite expired");

    const player = await devLogin(app, "inv_player@voi.test");
    const accept = await app.inject({
      method: "POST",
      url: `/v1/invites/${token}/accept`,
      headers: auth(player.token)
    });
    expect(accept.statusCode).toBe(404);
  });

  it("expires group invites the same way", async () => {
    const host = await devLogin(app, "ginv_host@voi.test");
    const groupId = await createGroup(app, host.token);
    const created = await app.inject({
      method: "POST",
      url: `/v1/groups/${groupId}/invites`,
      headers: auth(host.token)
    });
    expect(created.statusCode).toBe(201);
    const token = created.json().invite.token as string;
    expect(created.json().invite.expiresAt).toBeTruthy();

    await prisma.invite.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    const player = await devLogin(app, "ginv_player@voi.test");
    const accept = await app.inject({
      method: "POST",
      url: `/v1/invites/${token}/accept`,
      headers: auth(player.token)
    });
    expect(accept.statusCode).toBe(404);
  });
});
