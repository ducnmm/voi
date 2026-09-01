import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { notFound } from "../utils/api-error.js";
import { assertInviteActive } from "../services/invites.js";
import { presentSession, sessionInclude } from "../services/session-presenter.js";

export async function inviteRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/invites/:token/accept",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const params = request.params as { token: string };

      const invite = await prisma.invite.findUnique({
        where: { token: params.token },
        include: {
          group: true,
          session: {
            include: {
              group: true
            }
          }
        }
      });

      if (!invite) {
        throw notFound("Invite not found");
      }

      assertInviteActive(invite);

      const groupId = invite.groupId ?? invite.session?.groupId;
      if (!groupId) {
        throw notFound("Invite target not found");
      }

      await prisma.groupMember.upsert({
        where: {
          groupId_userId: {
            groupId,
            userId
          }
        },
        update: {},
        create: {
          groupId,
          userId,
          role: "MEMBER"
        }
      });

      const session = invite.sessionId
        ? await prisma.session.findUnique({
            where: { id: invite.sessionId },
            include: sessionInclude
          })
        : null;

      return {
        group: {
          id: invite.group?.id ?? invite.session?.group.id,
          name: invite.group?.name ?? invite.session?.group.name
        },
        session: session ? presentSession(session) : null
      };
    }
  );
}
