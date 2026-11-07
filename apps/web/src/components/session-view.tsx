"use client";
import { Select } from "@/components/select";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { request, type RsvpChoice } from "@/lib/api-client";
import { useResource } from "@/lib/use-resource";
import type { SessionDetail, MatchResult } from "@/lib/api-types";
import { formatSessionTime, formatVnd } from "@/lib/format";
import { Icon } from "./icon";
import { Avatar, Cover, Title, skillLabels } from "./primitives";
import { ErrorNote, Spinner } from "./ui";
import { ShareSheet, QRCode } from "./share-sheet";
import { Dialog } from "./dialog";
import { PhotoGallery } from "./photo-gallery";
import { downloadCalendar } from "@/lib/calendar";
import { SessionForm } from "./session-form";
const rsvpLabels: Record<string, string> = {
  JOINED: "Đã tham gia",
  MAYBE: "Có thể tham gia",
  DECLINED: "Không tham gia",
  CANCELLED: "Đã rời kèo",
  WAITLISTED: "Trong danh sách chờ",
};
export function SessionView({ sessionId }: { sessionId: string }) {
  const { t } = useI18n();

  const { token, user } = useAuth();
  const resource = useResource<{ session: SessionDetail }>(
    `/sessions/${sessionId}`,
  );
  const scores = useResource<{ results: MatchResult[] }>(
    `/sessions/${sessionId}/results`,
  );
  const saved = useResource<{ sessions: { id: string }[] }>("/me/saved");
  const [sharing, setSharing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "duplicate">("view");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [scoreForm, setScoreForm] = useState(false);
  const [label, setLabel] = useState("");
  const [scoreA, setScoreA] = useState(21);
  const [scoreB, setScoreB] = useState(15);
  const [reviewId, setReviewId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSent, setReviewSent] = useState(false);
  const session = resource.data?.session;
  async function mutate(path: string, method: string, body?: unknown) {
    if (!token || busy) return;
    setBusy(true);
    resource.setError("");
    try {
      const result = await request<{ session?: SessionDetail }>(path, {
        token,
        method,
        body,
      });
      if (result.session) resource.setData({ session: result.session });
      return true;
    } catch (err) {
      resource.setError(
        err instanceof Error ? err.message : t("Không thể cập nhật."),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return resource.error ? (
      <div className="stack">
        <ErrorNote message={resource.error} />
        <button
          className="btn btn-secondary"
          onClick={() => void resource.reload()}
        >
          {t("Thử lại")}
        </button>
      </div>
    ) : (
      <Spinner />
    );
  if (mode !== "view")
    return (
      <>
        <button className="btn btn-ghost" onClick={() => setMode("view")}>
          {t("← Quay lại chi tiết")}
        </button>
        <SessionForm
          session={session}
          duplicate={mode === "duplicate"}
          onSaved={(next) => {
            resource.setData({ session: next });
            setMode("view");
          }}
        />
      </>
    );
  const isHost = user?.id === session.hostUserId;
  const cancelled = session.status === "CANCELLED";
  const joined = session.participants.filter(
    (person) => person.rsvpStatus === "JOINED",
  );
  const waiting = session.participants
    .filter((person) => person.rsvpStatus === "WAITLISTED")
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
  const me = session.participants.find((person) => person.userId === user?.id);
  const isSaved =
    saved.data?.sessions.some((item) => item.id === sessionId) ?? false;
  async function assign(participantId: string, courtId: string) {
    const assignments = session!.courts.flatMap((court) =>
      court.lineupSlots
        .filter((slot) => slot.participantId !== participantId)
        .map((slot) => ({
          courtId: court.id,
          participantId: slot.participantId,
          slotOrder: slot.slotOrder,
        })),
    );
    if (courtId) {
      const used = assignments
        .filter((item) => item.courtId === courtId)
        .map((item) => item.slotOrder);
      const free = [1, 2, 3, 4].find((slot) => !used.includes(slot));
      if (!free) {
        resource.setError(
          t("Sân đã đủ 4 người. Hãy chuyển một người ra ghế dự bị trước."),
        );
        return;
      }
      assignments.push({ courtId, participantId, slotOrder: free });
    }
    await mutate(`/sessions/${sessionId}/lineup`, "PUT", { assignments });
  }
  return (
    <div className="stack">
      <Link href="/" className="row muted" style={{ fontSize: "var(--type-footnote)" }}>
        <Icon name="arrow" size={16} />
        {t("Tất cả kèo")}
      </Link>
      <Title
        eyebrow={session.group.name}
        title={session.title || session.venueName}
        subtitle={formatSessionTime(session.startsAt, session.endsAt)}
        action={
          <button
            className="icon-btn"
            disabled={busy || !saved.data}
            aria-label={isSaved ? t("Bỏ lưu kèo") : t("Lưu kèo")}
            aria-pressed={isSaved}
            style={{ color: isSaved ? "var(--color-brand)" : undefined }}
            onClick={async () => {
              if (
                await mutate(
                  `/sessions/${sessionId}/save`,
                  isSaved ? "DELETE" : "PUT",
                )
              )
                await saved.reload();
            }}
          >
            <Icon name="bookmark" />
          </button>
        }
      />
      {resource.error && <ErrorNote message={resource.error} />}
      {cancelled && <div className="error">{t("Kèo này đã được hủy.")}</div>}
      <div className="detail-grid">
        <div className="stack">
          <PhotoGallery
            images={session.imageUrls}
            title={session.title || session.venueName}
          />
          <section className="card stack">
            <div className="row">
              <span className="avatar">
                <Icon name="pin" />
              </span>
              <div>
                <h2>{session.venueName}</h2>
                <p className="muted" style={{ marginTop: 5, fontSize: "var(--type-footnote)" }}>
                  {session.venueNote || t("Hẹn gặp bạn trên sân!")}
                </p>
              </div>
            </div>
            <div className="row wrap">
              <span className="chip">
                <Icon name="court" size={14} />
                {session.courtCount} {t("sân")}
              </span>
              <span className="chip">{t(skillLabels[session.skillLevel])}</span>
              <a
                className="chip chip-green"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.venueLat != null && session.venueLng != null ? `${session.venueLat},${session.venueLng}` : session.venueName)}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("Chỉ đường ↗")}
              </a>
            </div>
          </section>
          <section className="card cost-breakdown">
            <div className="row spread">
              <h2>{t("Chi phí buổi chơi")}</h2>
              <span className="chip chip-green">
                {
                  joined.filter((person) => person.paymentStatus === "PAID")
                    .length
                }
                {t("/")}
                {joined.length} {t("đã trả")}
              </span>
            </div>
            <dl>
              {session.feePerPlayerVnd != null ? (
                <div>
                  <dt>{t("Giá cố định mỗi người")}</dt>
                  <dd>{formatVnd(session.feePerPlayerVnd)}</dd>
                </div>
              ) : (
                <>
                  <div>
                    <dt>{t("Tiền sân")}</dt>
                    <dd>{formatVnd(session.feeTotalVnd ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>{t("Tiền cầu")}</dt>
                    <dd>{formatVnd(session.shuttlecockCostVnd ?? 0)}</dd>
                  </div>
                </>
              )}
              <div className="cost-total">
                <dt>{t("Tổng chi phí")}</dt>
                <dd>{formatVnd(session.summary.totalCostVnd)}</dd>
              </div>
              <div>
                <dt>{t("Mỗi người")}</dt>
                <dd>{formatVnd(session.summary.perPlayerCostVnd)}</dd>
              </div>
            </dl>
            {me?.paymentStatus === "UNPAID" && !cancelled && (
              <button
                className="btn btn-primary"
                onClick={() => setPaying(true)}
              >
                <Icon name="qr" size={18} />
                {t("Xem thanh toán của tôi")}
              </button>
            )}
            {paymentNotice && (
              <p role="status" className="notice">
                {paymentNotice}
              </p>
            )}
          </section>
          <section>
            <h2 style={{ marginBottom: 14 }}>
              {t("Người tham gia")}{" "}
              <span className="muted" style={{ fontWeight: 400 }}>
                {t("(")}
                {joined.length}
                {t("/")}
                {session.maxPlayers}
                {t(")")}
              </span>
            </h2>
            <div className="card">
              {joined.length === 0 && (
                <p className="muted" style={{ fontSize: "var(--type-footnote)" }}>
                  {t("Chưa có người tham gia. Rủ bạn bè cùng chơi nhé.")}
                </p>
              )}
              {joined.map((person) => (
                <div key={person.id} className="list-row">
                  <Link href={`/people/${person.userId}`}>
                    <Avatar
                      name={person.user.displayName}
                      url={person.user.avatarUrl}
                    />
                  </Link>
                  <div className="grow">
                    <Link
                      href={`/people/${person.userId}`}
                      style={{ fontSize: "var(--type-callout)", fontWeight: 600 }}
                    >
                      {person.user.displayName}
                      {person.userId === session.hostUserId
                        ? t(" · Chủ kèo")
                        : ""}
                    </Link>
                    <p>
                      {person.checkedInAt
                        ? t("Đã điểm danh")
                        : t(
                            skillLabels[
                              person.user.defaultSkillLevel ?? "OPEN"
                            ],
                          )}
                    </p>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {isHost && !cancelled ? (
                      <>
                        <button
                          className={`chip ${person.checkedInAt ? "chip-green" : ""}`}
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              `/sessions/${sessionId}/participants/${person.id}/checkin`,
                              person.checkedInAt ? "DELETE" : "POST",
                            )
                          }
                          aria-label={t("Điểm danh {0}", [
                            person.user.displayName,
                          ])}
                        >
                          {person.checkedInAt ? t("Đã đến") : t("Điểm danh")}
                        </button>
                        <button
                          className={`chip ${person.paymentStatus === "PAID" ? "chip-green" : "chip-orange"}`}
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              `/sessions/${sessionId}/participants/${person.id}/payment`,
                              "PATCH",
                              {
                                paymentStatus:
                                  person.paymentStatus === "PAID"
                                    ? "UNPAID"
                                    : "PAID",
                              },
                            )
                          }
                        >
                          {person.paymentStatus === "PAID"
                            ? t("Đã trả")
                            : t("Chưa trả")}
                        </button>
                      </>
                    ) : (
                      <span
                        className={`chip ${person.paymentStatus === "PAID" ? "chip-green" : ""}`}
                      >
                        {person.paymentStatus === "PAID"
                          ? t("Đã trả")
                          : person.paymentStatus === "NOT_REQUIRED"
                            ? t("Không thu phí")
                            : t("Chưa trả")}
                      </span>
                    )}
                    {me?.checkedInAt && person.userId !== user?.id && (
                      <button
                        className="icon-btn"
                        aria-label={t("Đánh giá {0}", [
                          person.user.displayName,
                        ])}
                        onClick={() => {
                          setReviewId(person.userId);
                          setReviewSent(false);
                        }}
                      >
                        <Icon name="star" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
          {reviewId && (
            <form
              className="card stack"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  await mutate(`/sessions/${sessionId}/reviews`, "POST", {
                    subjectId: reviewId,
                    rating,
                    comment,
                  })
                ) {
                  setReviewId("");
                  setComment("");
                  setReviewSent(true);
                }
              }}
            >
              <h2>
                {t("Đánh giá")}{" "}
                {
                  joined.find((person) => person.userId === reviewId)?.user
                    .displayName
                }
              </h2>
              <label>
                {t("Số sao")}
                <Select
                  value={rating}
                  onValueChange={(value) => setRating(Number(value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} {t("sao")}
                    </option>
                  ))}
                </Select>
              </label>
              <textarea
                aria-label={t("Nhận xét")}
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("Chia sẻ trải nghiệm của bạn…")}
              />
              <div className="row">
                <button className="btn btn-primary" disabled={busy}>
                  {t("Gửi đánh giá")}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setReviewId("")}
                >
                  {t("Đóng")}
                </button>
              </div>
            </form>
          )}
          {reviewSent && (
            <div className="notice" role="status">
              {t("Đã gửi đánh giá. Cảm ơn bạn!")}
            </div>
          )}
          {waiting.length > 0 && (
            <section>
              <h2 style={{ marginBottom: 14 }}>
                {t("Danh sách chờ ·")}
                {waiting.length}
              </h2>
              <div className="card">
                {waiting.map((person) => (
                  <div className="list-row" key={person.id}>
                    <span className="chip">
                      {t("#")}
                      {person.waitlistPosition}
                    </span>
                    <Avatar
                      name={person.user.displayName}
                      url={person.user.avatarUrl}
                    />
                    <span style={{ fontSize: "var(--type-callout)" }}>
                      {person.user.displayName}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 style={{ marginBottom: 14 }}>{t("Đội hình trên sân")}</h2>
            <div className="form-grid">
              {session.courts.map((court) => (
                <div className="card" key={court.id}>
                  <div className="row spread">
                    <strong style={{ fontSize: "var(--type-callout)" }}>{court.label}</strong>
                    <span className="muted" style={{ fontSize: "var(--type-footnote)" }}>
                      {court.lineupSlots.length}
                      {t("/4")}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 80,
                      borderRadius: 8,
                      overflow: "hidden",
                      margin: "14px 0",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--color-sage)",
                        height: "100%",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--color-brand)",
                      }}
                    >
                      <Icon name="court" size={42} />
                    </div>
                  </div>
                  {court.lineupSlots.map((slot) => (
                    <p key={slot.id} style={{ fontSize: "var(--type-footnote)", padding: "5px 0" }}>
                      {slot.user.displayName}
                    </p>
                  ))}
                  {court.lineupSlots.length === 0 && (
                    <p className="muted" style={{ fontSize: "var(--type-footnote)" }}>
                      {t("Chưa xếp người")}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {isHost && !cancelled && joined.length > 0 && (
              <div className="card" style={{ marginTop: 14 }}>
                <h3 style={{ marginBottom: 14 }}>{t("Sắp xếp người chơi")}</h3>
                {joined.map((person) => (
                  <div className="list-row" key={person.id}>
                    <span className="grow" style={{ fontSize: "var(--type-footnote)" }}>
                      {person.user.displayName}
                    </span>
                    <Select
                      aria-label={t("Xếp sân cho {0}", [
                        person.user.displayName,
                      ])}
                      disabled={busy}
                      style={{ width: 150 }}
                      value={
                        session.courts.find((court) =>
                          court.lineupSlots.some(
                            (slot) => slot.participantId === person.id,
                          ),
                        )?.id ?? ""
                      }
                      onValueChange={(value) => void assign(person.id, value)}
                    >
                      <option value="">{t("Ghế dự bị")}</option>
                      {session.courts.map((court) => (
                        <option value={court.id} key={court.id}>
                          {court.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="card">
            <div className="row spread">
              <h2>{t("Kết quả trận")}</h2>
              {!cancelled && (isHost || me?.rsvpStatus === "JOINED") && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setScoreForm(!scoreForm)}
                >
                  <Icon name="plus" size={16} />
                  {t("Thêm")}
                </button>
              )}
            </div>
            {scores.error && <ErrorNote message={scores.error} />}
            {scores.data?.results.map((result) => (
              <div className="list-row" key={result.id}>
                <span className="grow" style={{ fontSize: "var(--type-callout)" }}>
                  {result.label}
                </span>
                <strong style={{ color: "var(--color-brand)" }}>
                  {result.scoreA} {t(" – ")}
                  {result.scoreB}
                </strong>
              </div>
            ))}
            {scores.data?.results.length === 0 && (
              <p className="muted" style={{ marginTop: 16, fontSize: "var(--type-footnote)" }}>
                {t("Chưa có kết quả trận.")}
              </p>
            )}
            {scoreForm && (
              <form
                className="stack"
                style={{ marginTop: 20 }}
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (
                    await mutate(`/sessions/${sessionId}/results`, "POST", {
                      label,
                      scoreA,
                      scoreB,
                    })
                  ) {
                    setScoreForm(false);
                    await scores.reload();
                  }
                }}
              >
                <input
                  aria-label={t("Tên trận")}
                  required
                  maxLength={40}
                  value={t(String(label))}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t("Ví dụ: Trận đôi số 1")}
                />
                <div className="row">
                  <input
                    aria-label={t("Điểm đội A")}
                    required
                    type="number"
                    min={0}
                    max={99}
                    value={scoreA}
                    onChange={(e) => setScoreA(Number(e.target.value))}
                  />
                  <span>{t("–")}</span>
                  <input
                    aria-label={t("Điểm đội B")}
                    required
                    type="number"
                    min={0}
                    max={99}
                    value={scoreB}
                    onChange={(e) => setScoreB(Number(e.target.value))}
                  />
                </div>
                <button className="btn btn-primary" disabled={busy}>
                  {t("Lưu kết quả")}
                </button>
              </form>
            )}
          </section>
        </div>
        <aside className="detail-aside stack">
          <section className="card stack">
            <div>
              <p className="muted" style={{ fontSize: "var(--type-footnote)" }}>
                {t("Chi phí mỗi người")}
              </p>
              <p
                style={{
                  fontSize: "var(--type-title-2)",
                  fontWeight: 600,
                  marginTop: 8,
                  letterSpacing: -1,
                }}
              >
                {formatVnd(session.summary.perPlayerCostVnd)}
              </p>
              <p className="muted" style={{ fontSize: "var(--type-footnote)", marginTop: 6 }}>
                {session.feePerPlayerVnd != null
                  ? t("Giá cố định")
                  : t("Chia đều theo số người tham gia")}
              </p>
            </div>
            <div
              style={{
                borderTop: "1px solid var(--color-line)",
                paddingTop: 16,
              }}
            >
              <div className="row spread" style={{ fontSize: "var(--type-footnote)" }}>
                <span className="muted">{t("Đã tham gia")}</span>
                <strong>
                  {joined.length}
                  {t("/")}
                  {session.maxPlayers}
                </strong>
              </div>
              <div
                style={{
                  height: 4,
                  background: "var(--color-line)",
                  borderRadius: 4,
                  marginTop: 12,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, (joined.length / session.maxPlayers) * 100)}%`,
                    background: "var(--color-brand)",
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
            {me && (
              <span className="chip chip-green" role="status">
                {t(rsvpLabels[me.rsvpStatus])}
                {me.rsvpStatus === "WAITLISTED"
                  ? ` · #${me.waitlistPosition}`
                  : ""}
              </span>
            )}
            {!cancelled && (
              <>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void mutate(`/sessions/${sessionId}/rsvp`, "POST", {
                      status: "JOINED" satisfies RsvpChoice,
                    })
                  }
                >
                  <Icon name="check" size={18} />
                  {me?.rsvpStatus === "JOINED"
                    ? t("Đã tham gia")
                    : session.summary.availableSlots
                      ? t("Tham gia kèo")
                      : t("Vào danh sách chờ")}
                </button>
                <div className="row">
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={busy}
                    onClick={() =>
                      void mutate(`/sessions/${sessionId}/rsvp`, "POST", {
                        status: "MAYBE",
                      })
                    }
                  >
                    {t("Có thể")}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    disabled={busy}
                    onClick={() =>
                      void mutate(`/sessions/${sessionId}/rsvp`, "POST", {
                        status: "CANCELLED",
                      })
                    }
                  >
                    {t("Không đi")}
                  </button>
                </div>
              </>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => downloadCalendar(session)}
            >
              <Icon name="calendar" size={18} />
              {t("Thêm vào lịch")}
            </button>
            <Link
              className="btn btn-secondary"
              href={`/messages?session=${session.id}`}
            >
              <Icon name="chat" size={17} />
              {t("Trò chuyện cùng kèo")}
            </Link>
          </section>
          {session.inviteUrlToken && (
            <section className="card">
              <h3>{t("Rủ bạn cùng chơi")}</h3>
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 16 }}
                onClick={() => setSharing(true)}
              >
                <Icon name="qr" size={18} />
                {t("Mã QR & chia sẻ")}
              </button>
              <p
                className="muted"
                style={{ fontSize: "var(--type-footnote)", lineHeight: "var(--leading-body)", margin: "8px 0 16px" }}
              >
                {t(
                  "Chia sẻ đường link để bạn bè tham gia từ bất kỳ thiết bị nào.",
                )}
              </p>
              <button
                className="btn btn-secondary"
                style={{ width: "100%" }}
                onClick={async () => {
                  setCopyError("");
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/invites/${session.inviteUrlToken}`,
                    );
                    setCopied(true);
                  } catch {
                    setCopyError(
                      t(
                        "Không thể sao chép. Bạn có thể mở lời mời và sao chép địa chỉ.",
                      ),
                    );
                  }
                }}
              >
                {copied ? t("Đã sao chép!") : t("Sao chép lời mời")}
              </button>
              <Link
                href={`/invites/${session.inviteUrlToken}`}
                className="btn btn-ghost"
                style={{ width: "100%", marginTop: 6 }}
              >
                {t("Mở lời mời")}
              </Link>
              {copyError && (
                <p className="muted" style={{ fontSize: "var(--type-footnote)", marginTop: 8 }}>
                  {copyError}
                </p>
              )}
            </section>
          )}
          {isHost && !cancelled && (
            <section className="card stack">
              <h3>{t("Quản lý kèo")}</h3>
              <button
                className="btn btn-secondary"
                onClick={() => setMode("edit")}
              >
                {t("Chỉnh sửa thông tin")}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setMode("duplicate")}
              >
                {t("Nhân bản sang tuần sau")}
              </button>
              {confirmCancel ? (
                <div className="stack" style={{ gap: 10 }}>
                  <p style={{ fontSize: "var(--type-footnote)" }}>
                    {t("Hủy kèo và thông báo cho mọi người?")}
                  </p>
                  <button
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() =>
                      void mutate(`/sessions/${sessionId}/cancel`, "POST")
                    }
                  >
                    {t("Xác nhận hủy kèo")}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setConfirmCancel(false)}
                  >
                    {t("Giữ kèo")}
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={() => setConfirmCancel(true)}
                >
                  {t("Hủy kèo")}
                </button>
              )}
            </section>
          )}
        </aside>
      </div>
      {session.inviteUrlToken && (
        <ShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          title={t("Rủ bạn cùng chơi")}
          description={session.title || session.venueName}
          url={`${origin}/invites/${session.inviteUrlToken}`}
        />
      )}
      <Dialog
        open={paying}
        onClose={() => setPaying(false)}
        title={t("Thanh toán")}
      >
        <div className="stack payment-sheet">
          <div>
            <p className="muted">{t("Chi phí của bạn")}</p>
            <h1>{formatVnd(session.summary.perPlayerCostVnd)}</h1>
            <p>{session.title || session.venueName}</p>
          </div>
          <QRCode
            value={`voipay://pay?session=${encodeURIComponent(session.id)}&participant=${encodeURIComponent(me?.id ?? "")}&amount=${session.summary.perPlayerCostVnd ?? 0}`}
            label={t("Mã xác nhận chi phí với chủ kèo")}
          />
          <p className="notice">
            {t(
              "Đưa mã này cho chủ kèo để đối chiếu chi phí. Chủ kèo xác nhận sau khi nhận tiền. Đây không phải mã chuyển khoản ngân hàng.",
            )}
          </p>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              if (isHost && me) {
                if (
                  await mutate(
                    `/sessions/${sessionId}/participants/${me.id}/payment`,
                    "PATCH",
                    { paymentStatus: "PAID" },
                  )
                ) {
                  setPaying(false);
                  setPaymentNotice(t("Đã xác nhận thanh toán."));
                }
              } else {
                setPaying(false);
                setPaymentNotice(
                  t("Vui lòng nhờ chủ kèo xác nhận sau khi nhận tiền."),
                );
              }
            }}
          >
            {t("Tôi đã thanh toán")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
