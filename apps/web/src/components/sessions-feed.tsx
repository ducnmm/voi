"use client";
import { Select } from "@/components/select";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useResource } from "@/lib/use-resource";
import { useCommunityFeed } from "@/lib/use-community-feed";
import { useAuth } from "@/lib/auth";
import { request } from "@/lib/api-client";
import type { SessionCard } from "@/lib/api-types";
import { formatSessionTime, formatVnd } from "@/lib/format";
import { Icon } from "./icon";
import { Cover, Empty, Title, skillLabels } from "./primitives";
import { Dialog } from "./dialog";
import { ErrorNote, Spinner } from "./ui";
import { CommunityListingCard } from "./community-feed";
export function SessionsFeed({ manage = false }: { manage?: boolean }) {
  const { t } = useI18n();

  const [scope, setScope] = useState("upcoming");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("scope") === "past")
      setScope("past");
  }, []);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const [filters, setFilters] = useState(false);
  const [skill, setSkill] = useState("");
  const [venue, setVenue] = useState("");
  const [venues, setVenues] = useState<string[]>([]);
  const [sort, setSort] = useState("date");
  const [available, setAvailable] = useState(false);
  const query = new URLSearchParams({
    scope,
    sort,
    savedOnly: String(saved),
    availableOnly: String(available),
    ...(skill ? { skill } : {}),
    ...(venue ? { venue } : {}),
  }).toString();
  const { data, error, loading, reload } = useResource<{
    sessions: SessionCard[];
    nextCursor?: string | null;
  }>(`/sessions?${query}`);
  const [extra, setExtra] = useState<SessionCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState("");
  const { token, user } = useAuth();
  const nativeGeneration = useRef(0);
  const nativeMorePending = useRef(false);
  const communityEnabled = !manage && scope === "upcoming" && !saved && !available;
  const community = useCommunityFeed(communityEnabled, skill);
  useEffect(() => {
    ++nativeGeneration.current;
    nativeMorePending.current = false;
    setExtra([]);
    setCursor(null);
    setMoreBusy(false);
    setMoreError("");
    return () => { ++nativeGeneration.current; };
  }, [query, token]);
  useEffect(() => {
    if (data)
      setVenues((current) =>
        [
          ...new Set([
            ...current,
            ...data.sessions.map((item) => item.venueName),
          ]),
        ].sort(),
      );
  }, [data]);
  useEffect(() => {
    if (community.listings.length)
      setVenues((current) => [...new Set([
        ...current,
        ...community.listings.flatMap((item) => item.venueName ? [item.venueName] : []),
      ])].sort());
  }, [community.listings]);
  const venueOptions = [...new Set([...venues, ...(venue ? [venue] : [])])].sort();
  const items = [...(data?.sessions ?? []), ...extra]
    .filter((item) => !manage || item.hostUserId === user?.id)
    .filter(
      (item, index, list) =>
        list.findIndex((other) => other.id === item.id) === index,
    )
    .filter((session) =>
      `${session.title ?? ""} ${session.venueName}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
    );
  const communityItems = community.listings
    .filter((listing) => !skill || listing.skillLevel === skill)
    .filter((listing) => !venue || (listing.venueName ?? "").toLocaleLowerCase("vi").includes(venue.toLocaleLowerCase("vi")))
    .filter((listing) => `${listing.title} ${listing.venueName ?? ""} ${listing.venueAddress ?? ""} ${listing.areaLabel ?? ""} ${listing.source.name}`
      .toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")))
    .sort((left, right) => {
      // Recruitment counts do not tell us how many spaces are still available.
      // All community capacities remain unknown for the native "spots" sort.
      if (sort === "price") {
        const leftFee = left.feeBasis === "PER_PERSON" ? left.feeVnd : null;
        const rightFee = right.feeBasis === "PER_PERSON" ? right.feeVnd : null;
        if (leftFee !== rightFee) {
          if (leftFee === null) return 1;
          if (rightFee === null) return -1;
          return leftFee - rightFee;
        }
      }
      return (left.startsAt ?? "9999").localeCompare(right.startsAt ?? "9999") || left.id.localeCompare(right.id);
    });
  const reset = () => {
    ++nativeGeneration.current;
    nativeMorePending.current = false;
    setExtra([]);
    setCursor(null);
    setMoreBusy(false);
    setMoreError("");
  };
  const showCommunitySection = communityEnabled && Boolean(
    community.loading || community.error || communityItems.length || community.nextCursor,
  );
  return (
    <div className="community-surface">
      <Title
        title={manage ? t("Kèo tôi tổ chức") : t("Kèo cầu lông")}
        action={
          <Link className="btn btn-primary" href="/sessions/new">
            <Icon name="plus" size={18} />
            {t("Tạo kèo")}
          </Link>
        }
      />
      <div className="feed-tools">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            aria-label={t("Tìm kèo hoặc sân")}
            placeholder={t("Tìm tên kèo, sân cầu lông…")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="segmented" aria-label={t("Loại kèo")}>
          <button
            className={scope === "upcoming" && !saved ? "active" : ""}
            onClick={() => {
              reset();
              setScope("upcoming");
              setSaved(false);
            }}
          >
            {t("Sắp diễn ra")}
          </button>
          <button
            className={saved ? "active" : ""}
            onClick={() => {
              reset();
              setSaved(true);
              setScope("upcoming");
            }}
          >
            {t("Đã lưu")}
          </button>
          <button
            className={scope === "past" ? "active" : ""}
            onClick={() => {
              reset();
              setScope("past");
              setSaved(false);
            }}
          >
            {t("Đã qua")}
          </button>
        </div>
        <div className="view-actions">
          <Link href="/map" className="icon-btn" aria-label={t("Xem bản đồ")}>
            <Icon name="map" size={19} />
          </Link>
          <button
            className="icon-btn"
            ref={filterTrigger}
            aria-label={t("Bộ lọc")}
            aria-expanded={filters}
            onClick={() => setFilters(!filters)}
            style={{
              color:
                skill || venue || available ? "var(--color-brand)" : undefined,
            }}
          >
            <Icon name="filter" size={19} />
          </button>
          <button
            className="icon-btn"
            aria-label={t("Làm mới")}
            disabled={loading || community.loading}
            onClick={() => {
              reset();
              void reload();
              community.reload();
            }}
          >
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </div>
      <Dialog
        open={filters}
        onClose={() => setFilters(false)}
        title={t("Lọc kèo")}
        returnFocusRef={filterTrigger}
      >
        <div className="filters">
          <label style={{ fontSize: "var(--type-footnote)" }}>
            {t("Trình độ")}
            <Select
              value={skill}
              onValueChange={(value) => {
                reset();
                setSkill(value);
              }}
              style={{ marginTop: 8 }}
            >
              <option value="">{t("Tất cả trình độ")}</option>
              {Object.entries(skillLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {t(String(label))}
                </option>
              ))}
            </Select>
          </label>
          <label style={{ fontSize: "var(--type-footnote)" }}>
            {t("Sắp xếp")}
            <Select
              value={sort}
              onValueChange={(value) => {
                reset();
                setSort(value);
              }}
              style={{ marginTop: 8 }}
            >
              <option value="date">{t("Ngày diễn ra")}</option>
              <option value="price">{t("Giá tăng dần")}</option>
              <option value="spots">{t("Nhiều chỗ trống")}</option>
            </Select>
          </label>
          <label className="row" style={{ fontSize: "var(--type-footnote)" }}>
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => {
                reset();
                setAvailable(e.target.checked);
              }}
            />
            {t("Chỉ kèo còn chỗ")}
          </label>
          <label>
            {t("Sân")}
            <Select
              value={venue}
              onValueChange={(value) => {
                reset();
                setVenue(value);
              }}
            >
              <option value="">{t("Tất cả sân")}</option>
              {venueOptions.map((name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ))}
            </Select>
          </label>
          <div className="share-actions">
            <button
              className="btn btn-secondary"
              onClick={() => {
                reset();
                setSkill("");
                setVenue("");
                setAvailable(false);
                setSort("date");
              }}
            >
              {t("Đặt lại")}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setFilters(false)}
            >
              {t("Xem kết quả")}
            </button>
          </div>
        </div>
      </Dialog>
      {error ? (
        <div className="stack">
          <ErrorNote message={error} />
          <button className="btn btn-secondary" onClick={() => void reload()}>
            {t("Thử lại")}
          </button>
        </div>
      ) : loading ? (
        <Spinner />
      ) : items.length ? (
        <>
          {communityEnabled && <h2 style={{ fontSize: "var(--type-card)", marginBottom: 16 }}>{t("Kèo của nhóm")}</h2>}
          <div className="row spread feed-summary">
            <span className="muted" style={{ fontSize: "var(--type-footnote)" }}>
              {items.length} {t("kèo")}
              {scope === "past" ? t(" đã diễn ra") : t(" dành cho bạn")}
            </span>
            <Link
              href="/people"
              className="row"
              style={{ color: "var(--color-brand)", fontSize: "var(--type-footnote)" }}
            >
              {t("Gặp gỡ người chơi")}
              <Icon name="chevron" size={14} />
            </Link>
          </div>
          <div className="feed-grid">
            {items.map((session) => (
              <SessionTile key={session.id} session={session} />
            ))}
          </div>
          {moreError && <ErrorNote message={moreError} />}
          {(cursor ?? data?.nextCursor) && (
            <button
              className="btn btn-secondary"
              style={{ margin: "24px auto", display: "flex" }}
              disabled={moreBusy}
              onClick={async () => {
                if (nativeMorePending.current) return;
                const current = nativeGeneration.current;
                nativeMorePending.current = true;
                setMoreBusy(true);
                setMoreError("");
                try {
                  const next = await request<{
                    sessions: SessionCard[];
                    nextCursor: string | null;
                  }>(
                    `/sessions?${query}&cursor=${encodeURIComponent(cursor ?? data?.nextCursor ?? "")}`,
                    { token },
                  );
                  if (current !== nativeGeneration.current) return;
                  setExtra((previous) => [...previous, ...next.sessions]);
                  setCursor(next.nextCursor ?? "");
                } catch (err) {
                  if (current === nativeGeneration.current)
                    setMoreError(
                      err instanceof Error
                        ? err.message
                        : t("Không tải được kèo."),
                    );
                } finally {
                  if (current === nativeGeneration.current) {
                    nativeMorePending.current = false;
                    setMoreBusy(false);
                  }
                }
              }}
            >
              {" "}
              {moreBusy ? t("Đang tải…") : t("Xem thêm kèo")}
            </button>
          )}
        </>
      ) : showCommunitySection ? null : (
        <Empty
          icon={saved ? "bookmark" : "court"}
          title={
            search || skill || venue || available
              ? t("Chưa tìm thấy kèo phù hợp")
              : saved
                ? t("Những kèo bạn muốn quay lại")
                : scope === "past"
                  ? t("Chưa có kèo đã qua")
                  : t("Kèo đầu tiên bắt đầu từ bạn")
          }
          action={
            <Link className="btn btn-primary" href="/sessions/new">
              <Icon name="plus" size={16} />
              {t("Tạo kèo mới")}
            </Link>
          }
        >
          {saved
            ? t("Lưu kèo trong trang chi tiết để dễ dàng tìm lại ở đây.")
            : t(
                "Rủ bạn bè cùng tham gia, chọn một giờ đẹp và hẹn nhau ra sân.",
              )}
        </Empty>
      )}
      {showCommunitySection && <section aria-label={t("Kèo cộng đồng")} style={{ marginTop: items.length || error ? 32 : 0 }}>
        <div className="community-feed-heading">
          <h2>{t("Kèo cộng đồng")}</h2>
          <span>{t("Liên hệ trực tiếp chủ kèo")}</span>
        </div>
        {community.loading && <Spinner />}
        {community.error && <div className="stack">
          <ErrorNote message={t("Không thể tải kèo cộng đồng. Vui lòng thử lại.")} />
          <button className="btn btn-secondary" onClick={community.reload}>{t("Thử lại")}</button>
        </div>}
        {communityItems.length > 0 && <div className="feed-grid">
          {communityItems.map((listing) => <CommunityListingCard key={listing.id} listing={listing} />)}
        </div>}
        {!community.loading && !community.error && !communityItems.length && community.nextCursor && <p className="muted">{t("Chưa có kèo phù hợp")}</p>}
        {community.moreError && <ErrorNote message={t("Không thể tải kèo cộng đồng. Vui lòng thử lại.")} />}
        {community.nextCursor && <button
          className="btn btn-secondary"
          aria-label={`${t("Xem thêm kèo")} — ${t("Kèo cộng đồng")}`}
          style={{ margin: "24px auto", display: "flex" }}
          disabled={community.loadingMore}
          onClick={() => void community.loadMore()}
        >{community.loadingMore ? t("Đang tải…") : t("Xem thêm kèo")}</button>}
      </section>}
    </div>
  );
}
export function SessionTile({ session }: { session: SessionCard }) {
  const { t } = useI18n();

  const full = session.summary.availableSlots === 0;
  const cancelled = session.status === "CANCELLED";
  return (
    <Link prefetch={false} className="card session-card" href={`/sessions/${session.id}`}>
      <div style={{ position: "relative" }}>
        <Cover
          images={session.imageUrls}
          title={session.title ?? session.venueName}
        />
        {(cancelled || full) && (
          <span
            className={`chip ${cancelled ? "" : "chip-orange"}`}
            style={{
              position: "absolute",
              left: 14,
              top: 14,
              background: "var(--color-surface)",
            }}
          >
            {cancelled ? t("Đã hủy") : t("Đã đủ người")}
          </span>
        )}
      </div>
      <div className="session-body">
        <div className="row spread" style={{ alignItems: "flex-start" }}>
          <div>
            <h2>{session.title || session.venueName}</h2>
            <p className="venue muted">{session.venueName}</p>
          </div>
          <strong
            style={{
              color: "var(--color-brand)",
              fontSize: "var(--type-callout)",
              whiteSpace: "nowrap",
            }}
          >
            {session.summary.joinedPlayerCount}
            <span className="muted" style={{ fontWeight: 400 }}>
              {t("/")}
              {session.maxPlayers}
            </span>
          </strong>
        </div>
        <div className="meta">
          <span className="chip">
            <Icon name="court" size={13} />
            {session.courtCount} {t("sân")}
          </span>
          <span className="chip">{t(skillLabels[session.skillLevel])}</span>
        </div>
        <div className="row spread time">
          <span className="row" style={{ gap: 6 }}>
            <Icon name="clock" size={14} />
            {formatSessionTime(session.startsAt, session.endsAt)}
          </span>
        </div>
        <div className="row spread session-footer">
          <span className="muted">{session.group.name}</span>
          <strong>
            {formatVnd(session.summary.perPlayerCostVnd)}
            <span className="muted" style={{ fontWeight: 400 }}>
              {" "}
              {t("/ người")}
            </span>
          </strong>
        </div>
        <div className="row spread" style={{ marginTop: 12 }}>
          <span
            style={{
              color: full ? "var(--color-accent)" : "var(--color-brand)",
              fontSize: "var(--type-footnote)",
            }}
          >
            {full
              ? t("Danh sách chờ · {0}", [session.summary.waitlistCount])
              : t("Còn {0} chỗ trống", [session.summary.availableSlots])}
          </span>
          <Icon name="chevron" size={16} />
        </div>
      </div>
    </Link>
  );
}
