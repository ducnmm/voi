"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { ShareSheet } from "@/components/share-sheet";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { request } from "@/lib/api-client";
import { useParams } from "next/navigation";
import { useResource } from "@/lib/use-resource";
import type { GroupDetail } from "@/lib/api-types";
import { formatSessionTime } from "@/lib/format";
import { RequireAuth } from "@/components/require-auth";
import { Title, Avatar, Empty } from "@/components/primitives";
import { Icon } from "@/components/icon";
import { ErrorNote, Spinner } from "@/components/ui";
export default function GroupPage() {
  return (
    <RequireAuth>
      <Group />
    </RequireAuth>
  );
}
function Group() {
  const { t } = useI18n();

  const { groupId } = useParams<{ groupId: string }>();
  const resource = useResource<{ group: GroupDetail }>(`/groups/${groupId}`);
  const { token, user } = useAuth();
  const [inviteLink, setInviteLink] = useState("");
  const [sharing, setSharing] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  if (!resource.data)
    return resource.error ? (
      <ErrorNote message={resource.error} />
    ) : (
      <Spinner />
    );
  const { group } = resource.data;
  return (
    <div className="stack">
      <Link href="/groups" className="row muted" style={{ fontSize: "var(--type-footnote)" }}>
        <Icon name="arrow" size={16} />
        {t("Nhóm của tôi")}
      </Link>
      <Title
        title={group.name}
        subtitle={group.description ?? undefined}
        action={
          <Link
            className="btn btn-primary"
            href={`/groups/${groupId}/new-session`}
          >
            <Icon name="plus" size={16} />
            {t("Tạo kèo")}
          </Link>
        }
      />
      <Link
        className="btn btn-secondary"
        style={{ alignSelf: "flex-start" }}
        href={`/messages?group=${group.id}`}
      >
        <Icon name="chat" size={16} />
        {t("Trò chuyện cùng nhóm")}
      </Link>
      {group.members.some(
        (member) => member.user.id === user?.id && member.role === "HOST",
      ) && (
        <section className="card stack">
          <h2>{t("Rủ bạn vào nhóm")}</h2>
          <p className="muted" style={{ fontSize: "var(--type-footnote)" }}>
            {t("Gửi lời mời để bạn bè cùng xem kèo và trò chuyện.")}
          </p>
          {inviteLink ? (
            <div className="stack">
              <button
                className="btn btn-primary"
                onClick={() => setSharing(true)}
              >
                <Icon name="qr" size={18} />
                {t("Mã QR & chia sẻ")}
              </button>
              <input
                aria-label={t("Link mời vào nhóm")}
                readOnly
                value={inviteLink}
                onFocus={(event) => event.target.select()}
              />
            </div>
          ) : (
            <button
              className="btn btn-secondary"
              disabled={inviteBusy}
              onClick={async () => {
                setInviteBusy(true);
                resource.setError("");
                try {
                  const result = await request<{ invite: { token: string } }>(
                    `/groups/${groupId}/invites`,
                    { token, method: "POST" },
                  );
                  setInviteLink(
                    `${window.location.origin}/invites/${result.invite.token}`,
                  );
                } catch (err) {
                  resource.setError(
                    err instanceof Error
                      ? err.message
                      : t("Không tạo được lời mời."),
                  );
                } finally {
                  setInviteBusy(false);
                }
              }}
            >
              {inviteBusy ? t("Đang tạo…") : t("Tạo link mời")}
            </button>
          )}
          {resource.error && <ErrorNote message={resource.error} />}
        </section>
      )}
      <section>
        <h2 style={{ marginBottom: 16 }}>{t("Kèo của nhóm")}</h2>
        {!group.sessions.length ? (
          <Empty title={t("Sẵn sàng cho kèo đầu tiên")}>
            {t("Tạo kèo và rủ mọi người trong nhóm cùng chơi.")}
          </Empty>
        ) : (
          <div className="card">
            {group.sessions.map((session) => (
              <Link
                className="list-row"
                key={session.id}
                href={`/sessions/${session.id}`}
              >
                <span className="avatar">
                  <Icon name="court" />
                </span>
                <div className="grow">
                  <h3>{session.title || session.venueName}</h3>
                  <p>
                    {formatSessionTime(session.startsAt, session.endsAt)}{" "}
                    {t(" ·")} {session.venueName}
                  </p>
                </div>
                {session.status === "CANCELLED" ? (
                  <span className="chip chip-orange">{t("Đã hủy")}</span>
                ) : (
                  <Icon name="chevron" size={16} />
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 20 }}>
          {t("Thành viên ·")}
          {group.members.length}
        </h2>
        {group.members.map((member) => (
          <Link
            href={`/people/${member.user.id}`}
            className="list-row"
            key={member.id}
          >
            <Avatar
              name={member.user.displayName}
              url={member.user.avatarUrl}
            />
            <span className="grow" style={{ fontSize: "var(--type-callout)" }}>
              {member.user.displayName}
            </span>
            {member.role === "HOST" && (
              <span className="chip chip-green">{t("Chủ nhóm")}</span>
            )}
          </Link>
        ))}
      </section>
      {inviteLink && (
        <ShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          url={inviteLink}
          title={t("Mời bạn vào nhóm")}
          description={group.name}
        />
      )}
    </div>
  );
}
