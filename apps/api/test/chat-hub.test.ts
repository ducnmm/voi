import { describe, expect, it, vi } from "vitest";
import {
  ChatHub,
  groupChatRoom,
  sessionChatRoom
} from "../src/services/chat-hub.js";

describe("ChatHub", () => {
  it("broadcasts only to sockets in the target room", () => {
    const hub = new ChatHub();
    const a1 = { send: vi.fn() };
    const a2 = { send: vi.fn() };
    const b1 = { send: vi.fn() };
    hub.join("A", a1);
    hub.join("A", a2);
    hub.join("B", b1);

    hub.broadcast("A", { type: "message", message: { id: "x" } });
    const expected = JSON.stringify({ type: "message", message: { id: "x" } });

    expect(a1.send).toHaveBeenCalledWith(expected);
    expect(a2.send).toHaveBeenCalledWith(expected);
    expect(b1.send).not.toHaveBeenCalled();
    expect(hub.roomSize("A")).toBe(2);
  });

  it("stops delivering after leave and drops empty rooms", () => {
    const hub = new ChatHub();
    const socket = { send: vi.fn() };
    hub.join("R", socket);
    hub.leave("R", socket);
    expect(hub.roomSize("R")).toBe(0);

    hub.broadcast("R", { x: 1 });
    expect(socket.send).not.toHaveBeenCalled();
  });

  it("keeps delivering even if one socket throws", () => {
    const hub = new ChatHub();
    const bad = {
      send: () => {
        throw new Error("dead socket");
      }
    };
    const good = { send: vi.fn() };
    hub.join("R", bad);
    hub.join("R", good);

    expect(() => hub.broadcast("R", { x: 1 })).not.toThrow();
    expect(good.send).toHaveBeenCalled();
  });

  it("uses distinct room keys for session and group chats", () => {
    expect(sessionChatRoom("abc")).toBe("session:abc");
    expect(groupChatRoom("abc")).toBe("group:abc");
    expect(sessionChatRoom("abc")).not.toBe(groupChatRoom("abc"));
  });
});
