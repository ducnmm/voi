export interface ChatSocket {
  send(data: string): void;
}

export function sessionChatRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

export function groupChatRoom(groupId: string): string {
  return `group:${groupId}`;
}

/**
 * In-memory registry of WebSocket connections per chat room (`session:{id}` /
 * `group:{id}`). Single-process only; a multi-instance deployment needs Redis
 * pub/sub fan-out in front of this.
 */
export class ChatHub {
  private rooms = new Map<string, Set<ChatSocket>>();

  join(roomId: string, socket: ChatSocket): void {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Set();
      this.rooms.set(roomId, room);
    }
    room.add(socket);
  }

  leave(roomId: string, socket: ChatSocket): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    room.delete(socket);
    if (room.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  broadcast(roomId: string, payload: unknown): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    const data = JSON.stringify(payload);
    for (const socket of room) {
      try {
        socket.send(data);
      } catch {
        // a dead socket is cleaned up on its own close event
      }
    }
  }

  roomSize(roomId: string): number {
    return this.rooms.get(roomId)?.size ?? 0;
  }
}

export const chatHub = new ChatHub();
