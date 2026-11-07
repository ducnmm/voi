"use client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  markChatRead,
  unreadChatRooms,
  type ChatBadges,
} from "@/lib/chat-read";
import { ShareSheet } from "@/components/share-sheet";
import { useAuth } from "@/lib/auth";
import { API_BASE_URL, request } from "@/lib/api-client";
import { useResource } from "@/lib/use-resource";
import type { ChatMessage, GroupSummary, SessionCard } from "@/lib/api-types";
import { RequireAuth } from "@/components/require-auth";
import { Title, Avatar, Empty } from "@/components/primitives";
import { Icon } from "@/components/icon";
import { ErrorNote, Spinner } from "@/components/ui";
type Room = { id: string; name: string; kind: "groups" | "sessions" };
export default function MessagesPage() {
  return (
    <RequireAuth>
      <Messages />
    </RequireAuth>
  );
}
function Messages() {
  const { t } = useI18n();

  const groups = useResource<{ groups: GroupSummary[] }>("/groups");
  const sessions = useResource<{ sessions: SessionCard[] }>(
    "/sessions?limit=100",
  );
  const past = useResource<{ sessions: SessionCard[] }>(
    "/sessions?scope=past&limit=100",
  );
  const [selected, setSelected] = useState<Room | null>(null);
  const rooms: Room[] = [
    ...(groups.data?.groups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      kind: "groups" as const,
    })),
    ...[...(sessions.data?.sessions ?? []), ...(past.data?.sessions ?? [])].map(
      (s) => ({
        id: s.id,
        name: s.title || s.venueName,
        kind: "sessions" as const,
      }),
    ),
  ];
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const group = params.get("group");
    if (group)
      setSelected({
        id: group,
        name: t("Trò chuyện trong nhóm"),
        kind: "groups",
      });
    const id = params.get("session");
    if (id)
      setSelected({ id, name: t("Trò chuyện trong kèo"), kind: "sessions" });
  }, []);
  const room = selected ?? rooms[0];
  const { user, token } = useAuth();
  const [search, setSearch] = useState("");
  const [unread, setUnread] = useState<Set<string>>(new Set());
  const badges = useResource<ChatBadges>("/me/badges");
  useEffect(() => {
    if (user && badges.data)
      setUnread(unreadChatRooms(user.id, badges.data.chats));
  }, [user, badges.data]);
  useEffect(() => {
    const timer = setInterval(() => void badges.reload(), 30000);
    return () => clearInterval(timer);
  }, [badges.reload]);
  const visibleRooms = rooms.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Title
        title={t("Tin nhắn")}
      />
      {groups.error && <ErrorNote message={groups.error} />}
      {sessions.error && <ErrorNote message={sessions.error} />}
      {groups.loading ? (
        <Spinner />
      ) : !room ? (
        <Empty icon="chat" title={t("Câu chuyện bắt đầu từ một kèo")}>
          {t("Tham gia nhóm hoặc kèo để trò chuyện cùng mọi người.")}
        </Empty>
      ) : (
        <div className={`chat-layout ${selected ? "has-selection" : ""}`}>
          <nav className="rooms" aria-label={t("Hội thoại")}>
            <div className="chat-search">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Tìm cuộc trò chuyện…")}
                aria-label={t("Tìm cuộc trò chuyện")}
              />
            </div>
            {visibleRooms.map((item) => (
              <button
                key={`${item.kind}:${item.id}`}
                className={`room ${item.kind === room.kind && item.id === room.id ? "active" : ""}`}
                onClick={() => {
                  setSelected(item);
                  if (user) {
                    markChatRead(
                      user.id,
                      `${item.kind === "groups" ? "group" : "session"}:${item.id}`,
                    );
                    setUnread((current) => {
                      const next = new Set(current);
                      next.delete(
                        `${item.kind === "groups" ? "group" : "session"}:${item.id}`,
                      );
                      return next;
                    });
                  }
                }}
              >
                <Avatar name={item.name} />
                <div>
                  <strong style={{ fontSize: "var(--type-footnote)" }}>{item.name}</strong>
                  <p>
                    {item.kind === "groups"
                      ? t("Nhóm cầu lông")
                      : t("Trò chuyện trong kèo")}
                  </p>
                </div>
                {unread.has(
                  `${item.kind === "groups" ? "group" : "session"}:${item.id}`,
                ) && (
                  <span
                    className="room-unread"
                    aria-label={t("Tin nhắn chưa đọc")}
                  />
                )}
              </button>
            ))}
          </nav>
          <Conversation
            key={`${room.kind}:${room.id}`}
            room={room}
            visible={Boolean(selected)}
            onBack={() => setSelected(null)}
          />
        </div>
      )}
    </>
  );
}
function Conversation({
  room,
  onBack,
  visible,
}: {
  room: Room;
  onBack: () => void;
  visible: boolean;
}) {
  const { t } = useI18n();

  const { token, user } = useAuth();
  const path = `/${room.kind}/${room.id}/messages`;
  const resource = useResource<{
    messages: ChatMessage[];
    olderCursor: string | null;
  }>(path);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const previousHeight = useRef<number | null>(null);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null | undefined>(
    undefined,
  );
  const messages = useMemo(() => {
    const items = new Map<string, ChatMessage>();
    for (const message of [...older, ...(resource.data?.messages ?? [])])
      items.set(message.id, message);
    return [...items.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }, [older, resource.data]);
  const olderCursor =
    historyCursor === undefined ? resource.data?.olderCursor : historyCursor;
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [reconnect, setReconnect] = useState(0);
  useEffect(() => {
    if (
      user &&
      resource.data &&
      (visible || window.matchMedia("(min-width: 768px)").matches)
    )
      markChatRead(
        user.id,
        `${room.kind === "groups" ? "group" : "session"}:${room.id}`,
      );
  }, [user, room.id, room.kind, resource.data, visible]);
  useLayoutEffect(() => {
    const node = history.current;
    if (!node) return;
    if (previousHeight.current !== null) {
      node.scrollTop += node.scrollHeight - previousHeight.current;
      previousHeight.current = null;
    } else if (follow.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length]);
  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    const url = new URL(
      `${API_BASE_URL}/ws/${room.kind}/${room.id}`,
      window.location.origin,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", localStorage.getItem("voi.token") ?? token);
    const socket = new WebSocket(url);
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "ready") {
          setLive(true);
          void resource.reload();
        }
        if (payload.type === "message")
          resource.setData((current) => ({
            messages: [
              ...(current?.messages ?? []).filter(
                (m) => m.id !== payload.message.id,
              ),
              payload.message,
            ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
            olderCursor: current?.olderCursor ?? null,
          }));
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = (event) => {
      setLive(false);
      if (event.code === 4003) {
        resource.setError(t("Bạn chưa có quyền vào cuộc trò chuyện này."));
        return;
      }
      if (!stopped)
        retry = setTimeout(() => setReconnect((value) => value + 1), 5000);
    };
    socket.onerror = () => {
      setLive(false);
    };
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket.close();
    };
  }, [room.id, room.kind, token, reconnect, resource.reload, resource.setData]);
  // HTTP refresh keeps messages usable when a proxy does not support WebSocket upgrades.
  useEffect(() => {
    if (live) return;
    const timer = setInterval(() => void resource.reload(), 10000);
    return () => clearInterval(timer);
  }, [live, resource.reload]);
  return (
    <section className="chat-pane">
      <header className="chat-head row">
        <button
          className="icon-btn chat-back"
          onClick={onBack}
          aria-label={t("Quay lại hội thoại")}
        >
          <Icon name="arrow" size={18} />
        </button>
        <Avatar name={room.name} />
        <div>
          <h3>{room.name}</h3>
          <p className="muted" style={{ fontSize: "var(--type-caption)", marginTop: 5 }}>
            {live ? t("Đã kết nối trực tiếp") : t("Đang đồng bộ tin nhắn")}
          </p>
        </div>
        {room.kind === "groups" && (
          <button
            className="icon-btn"
            style={{ marginLeft: "auto" }}
            aria-label={t("Mời bạn vào nhóm")}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await request<{ invite: { token: string } }>(
                  `/groups/${room.id}/invites`,
                  { token, method: "POST" },
                );
                setShareUrl(
                  `${window.location.origin}/invites/${result.invite.token}`,
                );
                setSharing(true);
              } catch (err) {
                resource.setError(
                  err instanceof Error
                    ? err.message
                    : t("Không tạo được lời mời."),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="share" size={18} />
          </button>
        )}
      </header>
      {resource.error && <ErrorNote message={resource.error} />}
      <div
        className="chat-history"
        ref={history}
        onScroll={() => {
          const node = history.current;
          if (node)
            follow.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
        role="log"
        aria-label={t("Nội dung hội thoại")}
      >
        {resource.loading && !resource.data ? (
          <Spinner />
        ) : (
          <>
            {olderCursor && (
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await request<{
                      messages: ChatMessage[];
                      olderCursor: string | null;
                    }>(`${path}?before=${encodeURIComponent(olderCursor)}`, {
                      token,
                    });
                    previousHeight.current =
                      history.current?.scrollHeight ?? null;
                    setOlder((current) => [...result.messages, ...current]);
                    setHistoryCursor(result.olderCursor);
                  } catch (err) {
                    resource.setError(
                      err instanceof Error
                        ? err.message
                        : t("Không thể tải tin nhắn."),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("Tin nhắn trước đó")}
              </button>
            )}
            {messages.length === 0 && !resource.loading && (
              <div className="empty">
                <Icon name="chat" size={32} />
                <p>{t("Gửi lời chào đầu tiên đến mọi người nhé.")}</p>
              </div>
            )}
            {messages.map((message) => (
              <div
                className={`bubble ${message.author.id === user?.id ? "mine" : ""}`}
                key={message.id}
              >
                <small>
                  {message.author.displayName} {t(" ·")}{" "}
                  {new Date(message.createdAt).toLocaleTimeString(t("vi-VN"), {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
                {message.body}
              </div>
            ))}
          </>
        )}
      </div>
      <form
        className="chat-compose"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.trim() || busy) return;
          follow.current = true;
          setBusy(true);
          resource.setError("");
          try {
            const result = await request<{ message: ChatMessage }>(path, {
              token,
              method: "POST",
              body: { body: draft.trim() },
            });
            resource.setData((current) => ({
              messages: [
                ...(current?.messages ?? []).filter(
                  (m) => m.id !== result.message.id,
                ),
                result.message,
              ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
              olderCursor: current?.olderCursor ?? null,
            }));
            setDraft("");
          } catch (err) {
            resource.setError(
              err instanceof Error
                ? err.message
                : t("Không gửi được tin nhắn."),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          aria-label={t("Tin nhắn")}
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("Nhắn gì đó cho mọi người…")}
        />
        <button
          className="btn btn-primary"
          aria-label={t("Gửi tin nhắn")}
          disabled={busy || !draft.trim()}
        >
          <Icon name="send" size={18} />
        </button>
      </form>
      {shareUrl && (
        <ShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          url={shareUrl}
          title={t("Mời bạn vào nhóm")}
          description={room.name}
        />
      )}
    </section>
  );
}
