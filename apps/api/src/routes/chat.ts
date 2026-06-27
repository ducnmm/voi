import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { SendMessageSchema } from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { forbidden, notFound } from "../utils/api-error.js";
import { chatHub, type ChatSocket } from "../services/chat-hub.js";
import {
  decodeChatCursor,
  encodeChatCursor,
  presentChatMessage
} from "../services/chat-presenter.js";

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().trim().min(1).optional()
});

async function assertCanAccessSessionChat(
  userId: string,
  sessionId: string
): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, hostUserId: true, groupId: true }
  });
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.hostUserId === userId) {
    return;
  }
  const [member, participant] = await Promise.all([
    prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: session.groupId, userId } },
      select: { groupId: true }
    }),
    prisma.sessionParticipant.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      select: { id: true }
    })
  ]);
  if (member || participant) {
    return;
  }
  throw forbidden("You are not part of this session");
}

function createMessage(sessionId: string, authorId: string, body: string) {
  return prisma.chatMessage.create({
    data: { sessionId, authorId, body },
    include: { author: true }
  });
}

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  // History — keyset, returned oldest→newest; `before` cursor loads older.
  app.get(
    "/sessions/:sessionId/messages",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const { sessionId } = request.params as { sessionId: string };
      const query = HistoryQuerySchema.parse(request.query);
      await assertCanAccessSessionChat(userId, sessionId);

      const before = query.before ? decodeChatCursor(query.before) : null;
      const where: Prisma.ChatMessageWhereInput = {
        sessionId,
        ...(before
          ? {
              OR: [
                { createdAt: { lt: before.createdAt } },
                { createdAt: before.createdAt, id: { lt: before.id } }
              ]
            }
          : {})
      };

      const rows = await prisma.chatMessage.findMany({
        where,
        include: { author: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1
      });

      const hasMore = rows.length > query.limit;
      const page = rows.slice(0, query.limit); // newest → oldest
      const oldest = page[page.length - 1];
      const olderCursor = hasMore && oldest ? encodeChatCursor(oldest) : null;

      return {
        messages: page.reverse().map(presentChatMessage), // oldest → newest
        olderCursor
      };
    }
  );

  // Send via REST (also broadcasts to live WebSocket subscribers).
  app.post(
    "/sessions/:sessionId/messages",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = getAuthenticatedUserId(request);
      const { sessionId } = request.params as { sessionId: string };
      const body = SendMessageSchema.parse(request.body);
      await assertCanAccessSessionChat(userId, sessionId);

      const message = await createMessage(sessionId, userId, body.body);
      const presented = presentChatMessage(message);
      chatHub.broadcast(sessionId, { type: "message", message: presented });
      return reply.code(201).send({ message: presented });
    }
  );

  // Realtime stream. Token is passed via `?token=` so non-browser clients can
  // authenticate the upgrade request.
  app.get(
    "/ws/sessions/:sessionId",
    { websocket: true },
    (socket, request) => {
      const { sessionId } = request.params as { sessionId: string };
      const token = (request.query as { token?: string }).token ?? "";

      let userId: string;
      try {
        const payload = app.jwt.verify(token) as { sub: string };
        userId = payload.sub;
      } catch {
        socket.close(4001, "unauthorized");
        return;
      }

      void assertCanAccessSessionChat(userId, sessionId)
        .then(() => {
          chatHub.join(sessionId, socket as ChatSocket);
          // Tell the client the room is joined so it can start sending without
          // racing the async authorization above.
          socket.send(JSON.stringify({ type: "ready" }));

          socket.on("message", (raw: Buffer) => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(raw.toString());
            } catch {
              return;
            }
            const result = SendMessageSchema.safeParse(parsed);
            if (!result.success) {
              return;
            }
            void createMessage(sessionId, userId, result.data.body).then(
              (message) => {
                chatHub.broadcast(sessionId, {
                  type: "message",
                  message: presentChatMessage(message)
                });
              }
            );
          });

          socket.on("close", () => chatHub.leave(sessionId, socket as ChatSocket));
        })
        .catch(() => {
          socket.close(4003, "forbidden");
        });
    }
  );
}
