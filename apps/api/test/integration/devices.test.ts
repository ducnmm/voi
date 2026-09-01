import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  auth,
  buildTestApp,
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

const TOKEN = "apns-token-aaaaaaaa";

function register(userToken: string, deviceToken = TOKEN) {
  return app.inject({
    method: "POST",
    url: "/v1/devices",
    headers: auth(userToken),
    payload: { deviceToken, platform: "IOS", appVersion: "0.1.0" }
  });
}

describe("push device registration", () => {
  it("refuses to steal an active token from another account", async () => {
    const owner = await devLogin(app, "dev_owner@voi.test");
    const thief = await devLogin(app, "dev_thief@voi.test");

    expect((await register(owner.token)).statusCode).toBe(201);

    const stolen = await register(thief.token);
    expect(stolen.statusCode).toBe(409);
    expect(stolen.json().error.code).toBe("CONFLICT");

    const row = await prisma.pushDevice.findUniqueOrThrow({
      where: { deviceToken: TOKEN }
    });
    expect(row.userId).toBe(owner.userId);
    expect(row.disabledAt).toBeNull();
  });

  it("allows the same phone to rebind after the owner unregisters", async () => {
    const owner = await devLogin(app, "dev_old@voi.test");
    const next = await devLogin(app, "dev_new@voi.test");

    expect((await register(owner.token)).statusCode).toBe(201);

    const unreg = await app.inject({
      method: "POST",
      url: "/v1/devices/unregister",
      headers: auth(owner.token),
      payload: { deviceToken: TOKEN }
    });
    expect(unreg.statusCode).toBe(200);

    const rebound = await register(next.token);
    expect(rebound.statusCode).toBe(201);

    const row = await prisma.pushDevice.findUniqueOrThrow({
      where: { deviceToken: TOKEN }
    });
    expect(row.userId).toBe(next.userId);
    expect(row.disabledAt).toBeNull();
  });

  it("lets the owner re-register their own token", async () => {
    const owner = await devLogin(app, "dev_same@voi.test");
    expect((await register(owner.token)).statusCode).toBe(201);
    expect((await register(owner.token)).statusCode).toBe(201);
  });
});
