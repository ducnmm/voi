import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import type { FastifyInstance } from "fastify";
import { auth, buildTestApp, prisma, resetDb } from "../helpers.js";
import { verifyGoogleIdToken } from "../../src/services/identity/google.js";

vi.mock("../../src/services/identity/google.js", () => ({
  verifyGoogleIdToken: vi.fn()
}));
const mockVerify = vi.mocked(verifyGoogleIdToken);

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
  vi.clearAllMocks();
});

function google(idToken: string) {
  return app.inject({
    method: "POST",
    url: "/v1/auth/google",
    payload: { idToken }
  });
}

function refresh(refreshToken: string) {
  return app.inject({
    method: "POST",
    url: "/v1/auth/refresh",
    payload: { refreshToken }
  });
}

describe("POST /auth/google", () => {
  it("verifies the token, creates the user, returns a token pair", async () => {
    mockVerify.mockResolvedValue({
      sub: "g-123",
      email: "neo@voi.test",
      name: "Neo",
      picture: "https://example.com/p.png"
    });

    const res = await google("valid-token");
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.email).toBe("neo@voi.test");
    expect(body.user.displayName).toBe("Neo");

    const me = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: auth(body.accessToken)
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe("neo@voi.test");

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.authIdentity.count()).toBe(1);
  });

  it("returns the same user on repeat login (no duplicate identity)", async () => {
    mockVerify.mockResolvedValue({ sub: "g-1", email: "a@voi.test", name: "A" });
    const first = (await google("t")).json();
    const second = (await google("t")).json();
    expect(second.user.id).toBe(first.user.id);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.authIdentity.count()).toBe(1);
  });

  it("rejects an invalid token", async () => {
    mockVerify.mockRejectedValue(new Error("bad token"));
    expect((await google("nope")).statusCode).toBe(401);
  });
});

describe("refresh + logout", () => {
  async function login() {
    mockVerify.mockResolvedValue({ sub: "g-r", email: "r@voi.test", name: "R" });
    return (await google("t")).json();
  }

  it("rotates the refresh token and revokes the old one", async () => {
    const { refreshToken } = await login();

    const rotated = await refresh(refreshToken);
    expect(rotated.statusCode).toBe(200);
    const next = rotated.json();
    expect(next.accessToken).toBeTruthy();
    expect(next.refreshToken).toBeTruthy();
    expect(next.refreshToken).not.toBe(refreshToken);

    expect((await refresh(refreshToken)).statusCode).toBe(401); // old revoked
    expect((await refresh(next.refreshToken)).statusCode).toBe(200); // new works
  });

  it("logout revokes the refresh token", async () => {
    const { refreshToken } = await login();
    await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      payload: { refreshToken }
    });
    expect((await refresh(refreshToken)).statusCode).toBe(401);
  });

  it("rejects an unknown refresh token", async () => {
    expect((await refresh("garbage")).statusCode).toBe(401);
  });
});
