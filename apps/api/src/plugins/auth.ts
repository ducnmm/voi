import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { unauthorized } from "../utils/api-error.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export function setupAuth(app: FastifyInstance): void {
  app.decorate("authenticate", async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw unauthorized();
    }
  });
}

export function getAuthenticatedUserId(request: FastifyRequest): string {
  const userId = request.user?.sub;
  if (!userId) {
    throw unauthorized();
  }

  return userId;
}
