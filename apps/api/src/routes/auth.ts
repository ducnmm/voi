import type { FastifyInstance } from "fastify";
import type { User } from "@prisma/client";
import {
  DevLoginSchema,
  GoogleLoginSchema,
  RefreshTokenSchema,
  UpdateProfileSchema
} from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { env } from "../config/env.js";
import { conflict, notFound, notImplemented, unauthorized } from "../utils/api-error.js";
import {
  verifyGoogleIdToken,
  type GoogleIdentity
} from "../services/identity/google.js";
import {
  issueAccessToken,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  upsertUserWithIdentity
} from "../services/auth-tokens.js";

function presentUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    defaultSkillLevel: user.defaultSkillLevel
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Development login (local/CI only). Issues the same token pair as Google.
  const authRateLimit =
    env.NODE_ENV === "production"
      ? { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }
      : {};

  app.post("/auth/dev", authRateLimit, async (request, reply) => {
    if (env.NODE_ENV === "production") {
      throw notFound("Not found");
    }
    const body = DevLoginSchema.parse(request.body);
    const displayName =
      body.displayName ?? body.email.slice(0, body.email.indexOf("@"));

    const user = await prisma.user.upsert({
      where: { email: body.email },
      update: { displayName },
      create: { email: body.email, displayName }
    });

    const accessToken = issueAccessToken(app, user.id);
    const refreshToken = await issueRefreshToken(user.id);
    return reply.code(201).send({
      token: accessToken,
      accessToken,
      refreshToken,
      user: presentUser(user)
    });
  });

  app.post("/auth/apple", async () => {
    throw notImplemented("Sign in with Apple is not configured yet");
  });

  // Sign in with Google: verify the iOS-issued ID token, mint our token pair.
  app.post("/auth/google", authRateLimit, async (request, reply) => {
    const body = GoogleLoginSchema.parse(request.body);

    let identity: GoogleIdentity;
    try {
      identity = await verifyGoogleIdToken(body.idToken);
    } catch {
      throw unauthorized("Invalid Google token");
    }

    const user = await upsertUserWithIdentity({
      provider: "GOOGLE",
      providerSub: identity.sub,
      email: identity.email,
      displayName: identity.name,
      avatarUrl: identity.picture
    });

    const accessToken = issueAccessToken(app, user.id);
    const refreshToken = await issueRefreshToken(user.id);

    return reply.code(201).send({
      accessToken,
      refreshToken,
      user: presentUser(user)
    });
  });

  // Exchange (and rotate) a refresh token for a fresh access token.
  app.post("/auth/refresh", authRateLimit, async (request) => {
    const body = RefreshTokenSchema.parse(request.body);
    const result = await rotateRefreshToken(app, body.refreshToken);
    if (!result) {
      throw unauthorized("Invalid refresh token");
    }
    return result;
  });

  // Sign out: revoke the refresh token.
  app.post("/auth/logout", async (request) => {
    const body = RefreshTokenSchema.parse(request.body);
    await revokeRefreshToken(body.refreshToken);
    return { ok: true };
  });

  app.get("/me", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw notFound("User not found");
    }
    return { user: presentUser(user) };
  });

  app.patch("/me", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);
    const body = UpdateProfileSchema.parse(request.body);
    const user = await prisma.user.update({ where: { id: userId }, data: body });
    return { user: presentUser(user) };
  });

  app.delete("/me", { preHandler: app.authenticate }, async (request) => {
    const userId = getAuthenticatedUserId(request);

    const [otherGroupMembers, otherSessionParticipants] = await Promise.all([
      prisma.groupMember.count({
        where: {
          userId: { not: userId },
          group: { createdByUserId: userId }
        }
      }),
      prisma.sessionParticipant.count({
        where: {
          userId: { not: userId },
          session: { hostUserId: userId }
        }
      })
    ]);

    if (otherGroupMembers > 0 || otherSessionParticipants > 0) {
      throw conflict(
        "Cancel hosted sessions and remove other members from your groups before deleting your account.",
        { otherGroupMembers, otherSessionParticipants }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { hostUserId: userId } });
      await tx.group.deleteMany({ where: { createdByUserId: userId } });
      await tx.user.delete({ where: { id: userId } });
    });
    return { ok: true };
  });
}
