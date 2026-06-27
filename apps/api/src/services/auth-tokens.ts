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
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) }
  });

  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() }
  });

  return {
    accessToken: issueAccessToken(app, record.userId),
    refreshToken: await issueRefreshToken(record.userId)
  };
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
    return existing.user;
  }

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {})
    },
    create: {
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
