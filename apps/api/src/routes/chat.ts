import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { SendMessageSchema } from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { getAuthenticatedUserId } from "../plugins/auth.js";
import { badRequest, forbidden, notFound, tooManyRequests } from "../utils/api-error.js";
import { consumeChatMessage } from "../services/rate-limit.js";
import {
  chatHub,
  groupChatRoom,
  sessionChatRoom,
  type ChatSocket
} from "../services/chat-hub.js";
import {
  chatAuthorInclude,
  decodeChatCursor,
  encodeChatCursor,
  presentChatMessage
} from "../services/chat-presenter.js";

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().trim().min(1).optional()
});

type ChatParent = { sessionId: string; groupId?: never } | { groupId: string; sessionId?: never };

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

async function assertCanAccessGroupChat(
  userId: string,
  groupId: string
): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true }
  });
  if (!group) {
    throw notFound("Group not found");
  }
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { groupId: true }
  });
  if (!member) {
    throw forbidden("You are not a member of this group");
  }
}

function createMessage(parent: ChatParent, authorId: string, body: string) {
  const sessionId = "sessionId" in parent ? parent.sessionId : null;
  const groupId = "groupId" in parent ? parent.groupId : null;
  if ((sessionId == null) === (groupId == null)) {
    throw badRequest("Message must belong to exactly one of session or group");
  }
  return prisma.chatMessage.create({
    data: { sessionId, groupId, authorId, body },
    include: chatAuthorInclude
  });
}

async function listChatHistory(
  parentWhere: Prisma.ChatMessageWhereInput,
  query: z.infer<typeof HistoryQuerySchema>
) {
  const before = query.before ? decodeChatCursor(query.before) : null;
  const where: Prisma.ChatMessageWhereInput = {
    ...parentWhere,
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
    include: chatAuthorInclude,
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

function bindChatWebSocket(
  app: FastifyInstance,
  socket: ChatSocket & {
    close(code?: number, reason?: string): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
  },
  request: FastifyRequest,
  roomId: string,
  authorize: (userId: string) => Promise<void>,
  persist: (userId: string, body: string) => ReturnType<typeof createMessage>
): void {
  const token = (request.query as { token?: string }).token ?? "";

  let userId: string;
  try {
    const payload = app.jwt.verify(token) as { sub: string };
    userId = payload.sub;
  } catch {
    socket.close(4001, "unauthorized");
    return;
  }

  void authorize(userId)
    .then(() => {
      chatHub.join(roomId, socket);
      // Tell the client the room is joined so it can start sending without
      // racing the async authorization above.
      socket.send(JSON.stringify({ type: "ready" }));

      socket.on("message", (raw: unknown) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(raw));
        } catch {
          return;
        }
        const result = SendMessageSchema.safeParse(parsed);
        if (!result.success) {
          return;
        }
        void consumeChatMessage(userId)
          .then((allowed) => {
            if (!allowed) {
              try {
                socket.send(
                  JSON.stringify({ type: "error", code: "RATE_LIMITED" })
                );
              } catch {
                // socket already closed
              }
              return;
            }
            return persist(userId, result.data.body).then((message) => {
              chatHub.broadcast(roomId, {
                type: "message",
                message: presentChatMessage(message)
              });
            });
          })
          .catch(() => {
            try {
              socket.send(JSON.stringify({ type: "error" }));
            } catch {
              // socket already closed
            }
          });
      });

      socket.on("close", () => chatHub.leave(roomId, socket));
    })
    .catch(() => {
      socket.close(4003, "forbidden");
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
      return listChatHistory({ sessionId }, query);
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
      if (!(await consumeChatMessage(userId))) {
        throw tooManyRequests("Too many messages, slow down");
      }

      const message = await createMessage({ sessionId }, userId, body.body);
      const presented = presentChatMessage(message);
      chatHub.broadcast(sessionChatRoom(sessionId), {
        type: "message",
        message: presented
      });
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
      bindChatWebSocket(
        app,
        socket,
        request,
        sessionChatRoom(sessionId),
        (userId) => assertCanAccessSessionChat(userId, sessionId),
        (userId, body) => createMessage({ sessionId }, userId, body)
      );
    }
  );

  app.get(
    "/groups/:groupId/messages",
    { preHandler: app.authenticate },
    async (request) => {
      const userId = getAuthenticatedUserId(request);
      const { groupId } = request.params as { groupId: string };
      const query = HistoryQuerySchema.parse(request.query);
      await assertCanAccessGroupChat(userId, groupId);
      return listChatHistory({ groupId }, query);
    }
  );

  app.post(
    "/groups/:groupId/messages",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const userId = getAuthenticatedUserId(request);
      const { groupId } = request.params as { groupId: string };
      const body = SendMessageSchema.parse(request.body);
      await assertCanAccessGroupChat(userId, groupId);
      if (!(await consumeChatMessage(userId))) {
        throw tooManyRequests("Too many messages, slow down");
      }

      const message = await createMessage({ groupId }, userId, body.body);
      const presented = presentChatMessage(message);
      chatHub.broadcast(groupChatRoom(groupId), {
        type: "message",
        message: presented
      });
      return reply.code(201).send({ message: presented });
    }
  );

  app.get(
    "/ws/groups/:groupId",
    { websocket: true },
    (socket, request) => {
      const { groupId } = request.params as { groupId: string };
      bindChatWebSocket(
        app,
        socket,
        request,
        groupChatRoom(groupId),
        (userId) => assertCanAccessGroupChat(userId, groupId),
        (userId, body) => createMessage({ groupId }, userId, body)
      );
    }
  );
}
