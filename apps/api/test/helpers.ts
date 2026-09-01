import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { resetMemoryRateLimits } from "../src/services/rate-limit.js";

export { prisma };

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

const TABLES = [
  "reviews",
  "saved_sessions",
  "follows",
  "match_results",
  "lineup_slots",
  "courts",
  "session_participants",
  "invites",
  "notifications",
  "notification_preferences",
  "push_devices",
  "chat_messages",
  "auth_identities",
  "refresh_tokens",
  "sessions",
  "group_members",
  "groups",
  "users"
];

export async function resetDb(): Promise<void> {
  resetMemoryRateLimits();
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
}

export function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export async function devLogin(
  app: FastifyInstance,
  email: string
): Promise<{ token: string; userId: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/dev",
    payload: { email, displayName: email.split("@")[0] }
  });
  const body = res.json();
  return { token: body.token, userId: body.user.id };
}

export async function createGroup(
  app: FastifyInstance,
  token: string,
  name = "Test Club"
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/groups",
    headers: auth(token),
    payload: { name }
  });
  return res.json().group.id;
}

export async function createSession(
  app: FastifyInstance,
  token: string,
  groupId: string,
  overrides: Record<string, unknown> = {}
): Promise<Record<string, any>> {
  const res = await app.inject({
    method: "POST",
    url: `/v1/groups/${groupId}/sessions`,
    headers: auth(token),
    payload: {
      title: "Session",
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString(),
      venueName: "Hoa Lu",
      courtCount: 2,
      ...overrides
    }
  });
  return res.json().session;
}

export async function rsvp(
  app: FastifyInstance,
  token: string,
  sessionId: string,
  status = "JOINED"
): Promise<Record<string, any>> {
  const res = await app.inject({
    method: "POST",
    url: `/v1/sessions/${sessionId}/rsvp`,
    headers: auth(token),
    payload: { status }
  });
  return res.json().session;
}

export function participantId(
  session: Record<string, any>,
  userId: string
): string {
  return session.participants.find((p: any) => p.userId === userId).id;
}
