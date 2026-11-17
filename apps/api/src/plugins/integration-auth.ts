import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IntegrationClient } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db/prisma.js";
import { consumeToken } from "../services/rate-limit.js";
import { forbidden, tooManyRequests, unauthorized } from "../utils/api-error.js";

export const COMMUNITY_READ_SCOPE = "community:read";
export const COMMUNITY_WRITE_SCOPE = "community:write";
export function hashIntegrationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function generateIntegrationCredential(): { token: string; keyId: string; tokenHash: string } {
  const keyId = randomBytes(12).toString("hex");
  const token = `voi_int.${keyId}.${randomBytes(32).toString("base64url")}`;
  return { token, keyId, tokenHash: hashIntegrationToken(token) };
}
// Alias useful for callers issuing keys; token plaintext is returned only on creation.
export const createIntegrationToken = generateIntegrationCredential;

declare module "fastify" {
  interface FastifyRequest { integrationClient: IntegrationClient | null }
  interface FastifyInstance {
    authenticateIntegration: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
export async function communityRateLimit(key: string, max: number, seconds: number, reply: FastifyReply): Promise<void> {
  if (!(await consumeToken(key, max, seconds))) {
    reply.header("Retry-After", String(seconds));
    throw tooManyRequests();
  }
}
export function setupIntegrationAuth(app: FastifyInstance): void {
  app.decorateRequest("integrationClient", null);
  app.decorate("authenticateIntegration", async (request: FastifyRequest, reply: FastifyReply) => {
    await communityRateLimit(`rl:community:auth:${request.ip}`, 120, 60, reply);
    const header = request.headers.authorization;
    const match = typeof header === "string" ? /^Bearer (voi_int\.([a-zA-Z0-9_-]{1,80})\.[a-zA-Z0-9_-]{32,128})$/.exec(header) : null;
    if (!match) throw unauthorized("Invalid integration credential");
    const credential = await prisma.integrationCredential.findUnique({ where: { keyId: match[2] }, include: { client: true } });
    const candidate = Buffer.from(hashIntegrationToken(match[1]!), "hex");
    const expected = Buffer.from(credential?.tokenHash ?? "0".repeat(64), "hex");
    const matches = candidate.length === expected.length && timingSafeEqual(candidate, expected);
    if (!credential || !matches || credential.revokedAt || credential.client.disabledAt ||
      (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())) {
      throw unauthorized("Invalid integration credential");
    }
    request.integrationClient = credential.client;
  });
}
export function requireIntegrationScope(request: FastifyRequest, scope: string, sourceIds: string[] = []): IntegrationClient {
  const client = request.integrationClient;
  if (!client) throw unauthorized();
  if (!client.scopes.includes(scope) || sourceIds.some((id) => !client.sourceIds.includes(id))) throw forbidden("Integration scope does not permit this request");
  return client;
}
