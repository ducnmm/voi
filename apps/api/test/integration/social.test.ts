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

describe("follow", () => {
  it("follows idempotently and lists following", async () => {
    const a = await devLogin(app, "soc_a@voi.test");
    const b = await devLogin(app, "soc_b@voi.test");

    expect(
      (await app.inject({ method: "PUT", url: `/v1/users/${b.userId}/follow`, headers: auth(a.token) })).statusCode
    ).toBe(200);
    expect(
      (await app.inject({ method: "PUT", url: `/v1/users/${b.userId}/follow`, headers: auth(a.token) })).statusCode
    ).toBe(200);

    const following = (
      await app.inject({ method: "GET", url: "/v1/me/following", headers: auth(a.token) })
    ).json().users;
    expect(following.map((u: any) => u.id)).toEqual([b.userId]);

    await app.inject({ method: "DELETE", url: `/v1/users/${b.userId}/follow`, headers: auth(a.token) });
    expect(
      (await app.inject({ method: "GET", url: "/v1/me/following", headers: auth(a.token) })).json().users
    ).toEqual([]);
  });

  it("rejects following yourself", async () => {
    const a = await devLogin(app, "soc_self@voi.test");
    expect(
      (await app.inject({ method: "PUT", url: `/v1/users/${a.userId}/follow`, headers: auth(a.token) })).statusCode
    ).toBe(400);
  });

  it("404s following an unknown user", async () => {
    const a = await devLogin(app, "soc_unknown@voi.test");
    expect(
      (await app.inject({ method: "PUT", url: "/v1/users/ghost/follow", headers: auth(a.token) })).statusCode
    ).toBe(404);
  });
});

describe("saved sessions", () => {
  it("saves idempotently, lists, filters the feed, and unsaves", async () => {
    const host = await devLogin(app, "sav_host@voi.test");
    const gid = await createGroup(app, host.token);
    const session = await createSession(app, host.token, gid, { title: "Save me" });

    expect(
      (await app.inject({ method: "PUT", url: `/v1/sessions/${session.id}/save`, headers: auth(host.token) })).statusCode
    ).toBe(200);
    expect(
      (await app.inject({ method: "PUT", url: `/v1/sessions/${session.id}/save`, headers: auth(host.token) })).statusCode
    ).toBe(200);

    const saved = (
      await app.inject({ method: "GET", url: "/v1/me/saved", headers: auth(host.token) })
    ).json().sessions;
    expect(saved.map((s: { title: string }) => s.title)).toEqual(["Save me"]);
    expect(saved[0].participants).toBeUndefined();
    expect(
      (await app.inject({ method: "GET", url: "/v1/sessions?savedOnly=true", headers: auth(host.token) })).json().sessions.length
    ).toBe(1);

    await app.inject({ method: "DELETE", url: `/v1/sessions/${session.id}/save`, headers: auth(host.token) });
    expect(
      (await app.inject({ method: "GET", url: "/v1/sessions?savedOnly=true", headers: auth(host.token) })).json().sessions.length
    ).toBe(0);
  });

  it("does not let outsiders bookmark a GROUP_ONLY session", async () => {
    const host = await devLogin(app, "sav_go_host@voi.test");
    const gid = await createGroup(app, host.token);
    const session = await createSession(app, host.token, gid, {
      title: "Private",
      visibility: "GROUP_ONLY"
    });
    const outsider = await devLogin(app, "sav_go_out@voi.test");

    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/v1/sessions/${session.id}/save`,
          headers: auth(outsider.token)
        })
      ).statusCode
    ).toBe(403);
    expect(
      (await app.inject({ method: "GET", url: "/v1/me/saved", headers: auth(outsider.token) }))
        .json().sessions
    ).toEqual([]);
  });
});
