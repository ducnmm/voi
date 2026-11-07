"use client";
import { useI18n } from "@/lib/i18n";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { useResource } from "@/lib/use-resource";
import { useAuth } from "@/lib/auth";
import { request } from "@/lib/api-client";
import type { InviteDetail } from "@/lib/api-types";
import { Cover, Title } from "@/components/primitives";
import { ErrorNote, Spinner } from "@/components/ui";
import { formatSessionTime } from "@/lib/format";
export default function InvitePage() {
  return (
    <RequireAuth>
      <Invite />
    </RequireAuth>
  );
}
function Invite() {
  const { t } = useI18n();

  const { token: inviteToken } = useParams<{ token: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { data, error, loading, setError } = useResource<{
    invite: InviteDetail;
  }>(`/invites/${encodeURIComponent(inviteToken)}`);
  const [busy, setBusy] = useState(false);
  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;
  const { invite } = data;
  return (
    <div style={{ maxWidth: 560, margin: "20px auto" }}>
      <Title
        title={t("Một lời mời ra sân")}
        subtitle={invite.group?.name}
      />
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {invite.session && <Cover images={invite.session.imageUrls} />}
        <div className="stack" style={{ padding: 24 }}>
          <h2>
            {invite.session?.title ||
              invite.session?.venueName ||
              invite.group?.name}
          </h2>
          {invite.session ? (
            <p className="muted" style={{ fontSize: "var(--type-callout)", lineHeight: "var(--leading-body)" }}>
              {formatSessionTime(
                invite.session.startsAt,
                invite.session.endsAt,
              )}
              <br />
              {invite.session.venueName} {t(" ·")}{" "}
              {invite.session.summary.joinedPlayerCount}
              {t("/")}
              {invite.session.maxPlayers} {t("người")}
            </p>
          ) : (
            <p className="muted" style={{ fontSize: "var(--type-callout)" }}>
              {t("Tham gia nhóm để xem kèo và trò chuyện cùng mọi người.")}
            </p>
          )}
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await request<{
                  group: { id: string };
                  session: { id: string } | null;
                }>(`/invites/${encodeURIComponent(inviteToken)}/accept`, {
                  token,
                  method: "POST",
                });
                router.push(
                  result.session
                    ? `/sessions/${result.session.id}`
                    : `/groups/${result.group.id}`,
                );
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : t("Không thể nhận lời mời."),
                );
                setBusy(false);
              }
            }}
          >
            {busy
              ? t("Đang nhận lời mời…")
              : invite.session
                ? t("Nhận lời mời & xem kèo")
                : t("Tham gia nhóm")}
          </button>
          {invite.session && (
            <p className="muted" style={{ fontSize: "var(--type-footnote)", lineHeight: "var(--leading-body)" }}>
              {t(
                "Sau khi nhận lời mời, chọn “Tham gia kèo” để xác nhận chỗ của bạn.",
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
