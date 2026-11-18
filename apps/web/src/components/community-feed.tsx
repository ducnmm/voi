"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CommunityListingDTO } from "@voi/shared";
import { publicRequest } from "@/lib/api-client";
import { communityDate, communityFee, communitySkillLabels, communityStatusLabels, communityTime } from "@/lib/community-listings";
import { useI18n } from "@/lib/i18n";
import { usePublicResource } from "@/lib/use-public-resource";
import { Icon } from "./icon";
import { Empty, Title } from "./primitives";
import { Select } from "./select";
import { CommunityNormalizationFilters } from "./community-normalization-filters";
import { emptyNormalizationFilters, normalizationQuery, normalizedSkillLabel } from "@/lib/normalization";

type Feed = { listings: CommunityListingDTO[]; nextCursor: string | null };

export function CommunityFeed() {
  const { t } = useI18n();
  const [areaCode, setAreaCode] = useState("");
  const [date, setDate] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [revision, setRevision] = useState(0);
  const [normalizedFilters, setNormalizedFilters] = useState(emptyNormalizationFilters);
  const query = new URLSearchParams({ limit: "20", ...(areaCode ? { areaCode } : {}), ...(date ? { date } : {}), ...(skillLevel ? { skillLevel } : {}), ...normalizationQuery(normalizedFilters) }).toString();
  const { data: areas, error: areaError, reload: reloadAreas } = usePublicResource<{ areas: { code: string; label: string }[] }>("/community-listings/areas");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setFeed(null);
    setLoading(true);
    setLoadingMore(false);
    setError(false);
    void publicRequest<Feed>(`/community-listings?${query}`, { signal: controller.signal })
      .then((result) => { if (current === generation.current) setFeed(result); })
      .catch(() => { if (current === generation.current) setError(true); })
      .finally(() => { if (current === generation.current) setLoading(false); });
    return () => { ++generation.current; controller.abort(); };
  }, [query, revision]);
  const loadMore = async () => {
    if (!feed?.nextCursor || loadingMore) return;
    const current = generation.current;
    setLoadingMore(true);
    setError(false);
    try {
      const result = await publicRequest<Feed>(`/community-listings?${query}&cursor=${encodeURIComponent(feed.nextCursor)}`);
      if (current !== generation.current) return;
      setFeed((previous) => ({
        listings: [...(previous?.listings ?? []), ...result.listings].filter((item, index, items) => items.findIndex((other) => other.id === item.id) === index),
        nextCursor: result.nextCursor,
      }));
    } catch {
      if (current === generation.current) setError(true);
    } finally {
      if (current === generation.current) setLoadingMore(false);
    }
  };
  const hasFilters = Boolean(areaCode || date || skillLevel || normalizedFilters.audience || normalizedFilters.rank || normalizedFilters.venueId);
  const reset = () => { setAreaCode(""); setDate(""); setSkillLevel(""); setNormalizedFilters(emptyNormalizationFilters); };
  return (
    <div className="community-feed community-surface">
      <Title title={t("Khám phá")} action={
        <button className="icon-btn" aria-label={t("Làm mới")} disabled={loading} onClick={() => { setRevision((value) => value + 1); if (areaError) reloadAreas(); }}>
          <Icon name="refresh" size={19} />
        </button>
      } />
      <div className="community-layout">
        <aside className="community-filter-panel" aria-label={t("Lọc kèo cộng đồng")}>
          <div className="community-filter-heading"><Icon name="search" size={19} /><h2>{t("Bộ lọc")}</h2></div>
          <div className="community-filters">
            <label><span>{t("Khu vực")}</span>
              <Select value={areaCode} onValueChange={setAreaCode} aria-label={t("Khu vực")} disabled={!areas}>
                <option value="">{t("Tất cả khu vực")}</option>
                {areas?.areas.map((area) => <option key={area.code} value={area.code}>{area.label}</option>)}
              </Select>
            </label>
            <label><span>{t("Ngày diễn ra")}</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label={t("Ngày diễn ra")} />
            </label>
            <label><span>{t("Trình độ")}</span>
              <Select value={skillLevel} onValueChange={setSkillLevel} aria-label={t("Trình độ")}>
                <option value="">{t("Tất cả trình độ")}</option>
                {Object.entries(communitySkillLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
              </Select>
            </label>
            <CommunityNormalizationFilters value={normalizedFilters} onChange={value => { setNormalizedFilters(value); if (value.rank) setSkillLevel(""); }} areaCode={areaCode} />
            {hasFilters && <button className="btn btn-ghost community-clear" onClick={reset}>{t("Xóa bộ lọc")}</button>}
          </div>
          {areaError && <p className="community-inline-note" role="status">{t("Chưa tải được khu vực.")} <button className="community-text-button" onClick={reloadAreas}>{t("Thử lại")}</button></p>}
        </aside>
        <section className="community-results" aria-label={t("Kèo cộng đồng")}>
          <div className="community-feed-heading"><h2>{t("Kèo cộng đồng")}</h2><span>{t("Liên hệ trực tiếp chủ kèo")}</span></div>
          {loading && <div className="loading" role="status">{t("Đang tải…")}</div>}
          {!loading && !error && feed?.listings.length === 0 && <Empty icon="search" title={t("Chưa có kèo phù hợp")} action={hasFilters ? <button className="btn btn-secondary" onClick={reset}>{t("Xóa bộ lọc")}</button> : undefined}>{t("Thử ngày hoặc khu vực khác, hoặc quay lại sau.")}</Empty>}
          {feed && <div className="community-grid">{feed.listings.map((listing) => <CommunityListingCard key={listing.id} listing={listing} />)}</div>}
          {error && <div className="community-error" role="alert"><p>{t("Không thể tải kèo cộng đồng. Vui lòng thử lại.")}</p><button className="btn btn-secondary" onClick={() => feed ? void loadMore() : setRevision((value) => value + 1)}>{t("Thử lại")}</button></div>}
          {feed?.nextCursor && !error && <div className="community-pagination"><button className="btn btn-secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? t("Đang tải…") : t("Xem thêm kèo")}</button></div>}
        </section>
      </div>
    </div>
  );
}

export function CommunityListingCard({ listing }: { listing: CommunityListingDTO }) {
  const { t, locale } = useI18n();
  const venue = listing.venue;
  const skillSummary = normalizedSkillLabel(listing, t);
  const shortTitle = venue?.name || listing.venueName || listing.title;
  const accessibleTitle = shortTitle === listing.title ? listing.title : `${shortTitle} — ${listing.title}`;
  return (
    <article className="community-card card">
      <header className="community-card-header">
        <span className="community-source-avatar" aria-hidden="true"><Icon name="globe" size={22} /></span>
        <div className="community-card-identity">
          <div className="community-source"><span>{listing.source.name}</span></div>
          {listing.organizerName && <p className="community-card-organizer">{t("Chủ kèo")}: <span>{listing.organizerName}</span></p>}
        </div>
      </header>
      <h2 aria-label={accessibleTitle}><Link href={`/community-listings/${listing.id}`} aria-label={accessibleTitle}>{shortTitle}</Link></h2>
      <div className="community-card-facts">
        <div className="community-schedule"><Icon name="calendar" size={20} /><span><strong className="community-time">{communityTime(listing, locale, t)}</strong><small>{listing.startsAt ? communityDate(listing.startsAt, listing.timeZone, locale) : t("Chưa rõ ngày")}</small></span></div>
        <div><Icon name="pin" size={20} /><span>{venue?.address || listing.venueAddress || listing.areaLabel || listing.areaCode || t("Chưa rõ khu vực")}{(venue?.address || listing.venueAddress) && <small>{listing.areaLabel || listing.areaCode || t("Chưa rõ khu vực")}</small>}</span></div>
        <div className="community-skill"><Icon name="badminton" size={20} /><span>{skillSummary || listing.skillText || t(communitySkillLabels[listing.skillLevel])}{listing.skillNormalization?.status === "PARTIAL" && <small>{t("Đã chuẩn hóa một phần")}</small>}</span></div>
      </div>
      <div className="community-card-summary">
        <div className="community-card-fee"><Icon name="info" size={19} /><span>{communityFee(listing, locale, t)}</span></div>
        <p className="community-recruiting"><Icon name="people" size={19} /><span>{listing.requestedPlayers === null ? t("Chưa rõ số người tuyển") : t("Bài đăng tuyển {0} người", [listing.requestedPlayers])}</span></p>
      </div>
      <div className="community-card-footer">
        <div><span className="community-availability">{t(communityStatusLabels[listing.effectiveStatus])}</span><p className={`community-freshness ${listing.stale ? "is-stale" : ""}`}>{listing.stale ? t("Thông tin chưa được cập nhật gần đây") : t("Kiểm tra {0}", [communityDate(listing.lastVerifiedAt, listing.timeZone, locale, true)])}</p></div>
        <Link href={`/community-listings/${listing.id}`} className="community-open" aria-label={`${t("Xem kèo")} — ${listing.title}`}>{t("Xem kèo")}<Icon name="arrow" size={17} /></Link>
      </div>
    </article>
  );
}
