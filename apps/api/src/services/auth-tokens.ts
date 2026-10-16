import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AuthProvider, User } from "@prisma/client";
import { prisma } from "../db/prisma.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Refresh tokens are high-entropy, so a fast SHA-256 hash at rest is enough. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function issueAccessToken(app: FastifyInstance, userId: string): string {
  return app.jwt.sign({ sub: userId }, { expiresIn: ACCESS_TOKEN_TTL });
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
    }
  });
  return raw;
}

/** Rotate: revoke the presented token and issue a fresh access + refresh pair. */
export async function rotateRefreshToken(
  app: FastifyInstance,
  raw: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const tokenHash = hashToken(raw);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      data: { revokedAt: new Date() }
    });

    if (claimed.count !== 1) {
      return null;
    }

    const record = await tx.refreshToken.findUniqueOrThrow({
      where: { tokenHash }
    });
    const nextRaw = randomBytes(32).toString("base64url");
    await tx.refreshToken.create({
      data: {
        userId: record.userId,
        tokenHash: hashToken(nextRaw),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
      }
    });

    return {
      accessToken: issueAccessToken(app, record.userId),
      refreshToken: nextRaw
    };
  });
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

/** Find or create the user behind an external identity, linking the identity. */
export async function upsertUserWithIdentity(input: {
  provider: AuthProvider;
  providerSub: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}): Promise<User> {
  const existing = await prisma.authIdentity.findUnique({
    where: {
      provider_providerSub: {
        provider: input.provider,
        providerSub: input.providerSub
      }
    },
    include: { user: true }
  });
  if (existing) {
    return applyGoogleAvatarIfMissing(existing.user, input.avatarUrl);
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: input.email }
  });
  const user = byEmail
    ? await applyGoogleAvatarIfMissing(byEmail, input.avatarUrl)
    : await prisma.user.create({
        data: {
          email: input.email,
          displayName:
            input.displayName ?? input.email.split("@")[0] ?? input.email,
          avatarUrl: input.avatarUrl
        }
      });

  await prisma.authIdentity.create({
    data: {
      userId: user.id,
      provider: input.provider,
      providerSub: input.providerSub
    }
  });

  return user;
}

/** Google photo is the fallback only — never replace an uploaded avatar. */
async function applyGoogleAvatarIfMissing(
  user: User,
  avatarUrl?: string
): Promise<User> {
  if (user.avatarUrl || !avatarUrl) {
    return user;
  }
  return prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl }
  });
}
