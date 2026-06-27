import type { Prisma } from "@prisma/client";
import { presentUserSummary } from "./user-presenter.js";

type ChatMessageWithAuthor = Prisma.ChatMessageGetPayload<{
  include: { author: true };
}>;

export function presentChatMessage(message: ChatMessageWithAuthor) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    author: presentUserSummary(message.author)
  };
}

export interface ChatCursor {
  createdAt: Date;
  id: string;
}

export function encodeChatCursor(input: { createdAt: Date; id: string }): string {
  return `${input.createdAt.toISOString()}|${input.id}`;
}

export function decodeChatCursor(raw: string): ChatCursor | null {
  const separator = raw.indexOf("|");
  if (separator < 0) {
    return null;
  }
  const iso = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  const createdAt = new Date(iso);
  if (!id || Number.isNaN(createdAt.getTime())) {
    return null;
  }
  return { createdAt, id };
}
