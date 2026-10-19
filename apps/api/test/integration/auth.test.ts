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
import {
  auth,
  buildTestApp,
  createGroup,
  createSession,
  devLogin,
  prisma,
  resetDb
} from "../helpers.js";
import { verifyGoogleIdToken } from "../../src/services/identity/google.js";
import { verifyAppleIdentityToken } from "../../src/services/identity/apple.js";

vi.mock("../../src/services/identity/google.js", () => ({
  verifyGoogleIdToken: vi.fn()
}));
vi.mock("../../src/services/identity/apple.js", () => ({
  verifyAppleIdentityToken: vi.fn()
}));
const mockVerify = vi.mocked(verifyGoogleIdToken);
const mockApple = vi.mocked(verifyAppleIdentityToken);

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
    expect(body.user.avatarUrl).toBe("https://example.com/p.png");

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

  it("does not overwrite an uploaded avatar on later Google logins", async () => {
    mockVerify.mockResolvedValue({
      sub: "g-av",
      email: "av@voi.test",
      name: "Av",
      picture: "https://example.com/g.png"
    });
    const first = (await google("t")).json();
    expect(first.user.avatarUrl).toBe("https://example.com/g.png");

    const patched = await app.inject({
      method: "PATCH",
      url: "/v1/me",
      headers: auth(first.accessToken),
      payload: { avatarUrl: "https://cdn.example.com/me.jpg" }
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().user.avatarUrl).toBe("https://cdn.example.com/me.jpg");

    mockVerify.mockResolvedValue({
      sub: "g-av",
      email: "av@voi.test",
      name: "Av",
      picture: "https://example.com/g2.png"
    });
    const second = (await google("t")).json();
    expect(second.user.avatarUrl).toBe("https://cdn.example.com/me.jpg");
  });

  it("fills a missing avatar from Google on a later login", async () => {
    mockVerify.mockResolvedValue({
      sub: "g-empty",
      email: "e@voi.test",
      name: "E"
    });
    const first = (await google("t")).json();
    expect(first.user.avatarUrl).toBeFalsy();

    mockVerify.mockResolvedValue({
      sub: "g-empty",
      email: "e@voi.test",
      name: "E",
      picture: "https://example.com/later.png"
    });
    const second = (await google("t")).json();
    expect(second.user.avatarUrl).toBe("https://example.com/later.png");
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

function apple(identityToken: string, fullName?: string) {
  return app.inject({
    method: "POST",
    url: "/v1/auth/apple",
    payload: fullName ? { identityToken, fullName } : { identityToken }
  });
}

describe("POST /auth/apple", () => {
  it("creates the user from a verified Apple identity", async () => {
    mockApple.mockResolvedValue({
      sub: "apple-1",
      email: "ada@privaterelay.appleid.com"
    });

    const res = await apple("valid-token", "Ada Lovelace");
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.user.email).toBe("ada@privaterelay.appleid.com");
    expect(body.user.displayName).toBe("Ada Lovelace");
    expect(mockApple).toHaveBeenCalledWith("valid-token", "com.voi.app");

    const me = await app.inject({
      method: "GET",
      url: "/v1/me",
      headers: auth(body.accessToken)
    });
    expect(me.statusCode).toBe(200);
    expect(await prisma.authIdentity.count()).toBe(1);
  });

  it("returns the same user when Apple omits the email on a later login", async () => {
    mockApple.mockResolvedValueOnce({
      sub: "apple-2",
      email: "repeat@privaterelay.appleid.com"
    });
    const first = (await apple("t", "Ada")).json();

    mockApple.mockResolvedValueOnce({ sub: "apple-2" });
    const second = await apple("t");
    expect(second.statusCode).toBe(201);
    expect(second.json().user.id).toBe(first.user.id);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.authIdentity.count()).toBe(1);
  });

  it("links Apple to an existing account with the same email", async () => {
    mockVerify.mockResolvedValue({
      sub: "g-link",
      email: "shared@voi.test",
      name: "Shared"
    });
    const googleUser = (await google("t")).json();

    mockApple.mockResolvedValue({
      sub: "apple-link",
      email: "shared@voi.test"
    });
    const appleUser = (await apple("apple-token", "Ignored")).json();
    expect(appleUser.user.id).toBe(googleUser.user.id);
    expect(appleUser.user.displayName).toBe("Shared");
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.authIdentity.count()).toBe(2);
  });

  it("rejects an invalid token and a first login with no email", async () => {
    mockApple.mockRejectedValueOnce(new Error("bad token"));
    expect((await apple("nope")).statusCode).toBe(401);

    mockApple.mockResolvedValueOnce({ sub: "apple-new" });
    const missingEmail = await apple("no-email");
    expect(missingEmail.statusCode).toBe(401);
    expect(missingEmail.json().error.message).toMatch(/email/);
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("DELETE /me", () => {
  it("deletes a host who owns groups and sessions", async () => {
    const host = await devLogin(app, "host_del@voi.test");
    const groupId = await createGroup(app, host.token);
    await createSession(app, host.token, groupId);
    const res = await app.inject({
      method: "DELETE",
      url: "/v1/me",
      headers: auth(host.token)
    });
    expect(res.statusCode).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: host.userId } })).toBeNull();
  });

  it("refuses to delete a host when other people are still in the group", async () => {
    const host = await devLogin(app, "host_keep@voi.test");
    const player = await devLogin(app, "player_keep@voi.test");
    const groupId = await createGroup(app, host.token);
    await prisma.groupMember.create({
      data: { groupId, userId: player.userId, role: "MEMBER" }
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/v1/me",
      headers: auth(host.token)
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("CONFLICT");
    expect(await prisma.user.findUnique({ where: { id: host.userId } })).not.toBeNull();
    expect(await prisma.group.findUnique({ where: { id: groupId } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: player.userId } })).not.toBeNull();
  });

  it("refuses to delete a host when other people are still in a hosted session", async () => {
    const host = await devLogin(app, "host_sess@voi.test");
    const player = await devLogin(app, "player_sess@voi.test");
    const groupId = await createGroup(app, host.token);
    const session = await createSession(app, host.token, groupId);
    await prisma.sessionParticipant.create({
      data: {
        sessionId: session.id,
        userId: player.userId,
        rsvpStatus: "JOINED"
      }
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/v1/me",
      headers: auth(host.token)
    });
    expect(res.statusCode).toBe(409);
    expect(await prisma.session.findUnique({ where: { id: session.id } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: host.userId } })).not.toBeNull();
  });

  it("lets a non-host member leave without deleting the group", async () => {
    const host = await devLogin(app, "host_stays@voi.test");
    const player = await devLogin(app, "player_leaves@voi.test");
    const groupId = await createGroup(app, host.token);
    await prisma.groupMember.create({
      data: { groupId, userId: player.userId, role: "MEMBER" }
    });

    const res = await app.inject({
      method: "DELETE",
      url: "/v1/me",
      headers: auth(player.token)
    });
    expect(res.statusCode).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: player.userId } })).toBeNull();
    expect(await prisma.group.findUnique({ where: { id: groupId } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: host.userId } })).not.toBeNull();
  });

  it("deletes the authenticated user", async () => {
    const { token, userId } = await (async () => {
      mockVerify.mockResolvedValue({ sub: "g-del", email: "gone@voi.test", name: "G" });
      const body = (await google("t")).json();
      return { token: body.accessToken, userId: body.user.id };
    })();

    const res = await app.inject({
      method: "DELETE",
      url: "/v1/me",
      headers: auth(token)
    });
    expect(res.statusCode).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
  });
});
