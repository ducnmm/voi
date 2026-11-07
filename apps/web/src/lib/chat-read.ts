export type ChatBadges = {
  alertsUnread: number;
  chats: { room: string; lastMessageAt: string }[];
};
export function readChatTimes(userId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(`voi.chatRead.${userId}`) ?? "{}");
  } catch {
    return {};
  }
}
export function markChatRead(
  userId: string,
  room: string,
  at = new Date().toISOString(),
) {
  const times = readChatTimes(userId);
  times[room] = at;
  localStorage.setItem(`voi.chatRead.${userId}`, JSON.stringify(times));
  window.dispatchEvent(new Event("voi:chat-read"));
}
export function unreadChatRooms(userId: string, chats: ChatBadges["chats"]) {
  const read = readChatTimes(userId);
  return new Set(
    chats
      .filter(
        (chat) => !read[chat.room] || chat.lastMessageAt > read[chat.room]!,
      )
      .map((chat) => chat.room),
  );
}
