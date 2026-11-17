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

type Feed = { listings: CommunityListingDTO[]; nextCursor: string | null };

export function CommunityFeed() {
  const { t } = useI18n();
  const [areaCode, setAreaCode] = useState("");
  const [date, setDate] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [revision, setRevision] = useState(0);
  const query = new URLSearchParams({ limit: "20", ...(areaCode ? { areaCode } : {}), ...(date ? { date } : {}), ...(skillLevel ? { skillLevel } : {}) }).toString();
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
  const hasFilters = Boolean(areaCode || date || skillLevel);
  const reset = () => { setAreaCode(""); setDate(""); setSkillLevel(""); };
  return (
    <div className="community-feed">
      <Title title={t("Khám phá")} action={
        <button className="icon-btn" aria-label={t("Làm mới")} disabled={loading} onClick={() => { setRevision((value) => value + 1); if (areaError) reloadAreas(); }}>
          <Icon name="refresh" size={19} />
        </button>
      } />
      <div className="community-filters" aria-label={t("Lọc kèo cộng đồng")}>
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
        {hasFilters && <button className="btn btn-ghost community-clear" onClick={reset}>{t("Xóa bộ lọc")}</button>}
      </div>
      {areaError && <p className="community-inline-note" role="status">{t("Chưa tải được khu vực.")} <button className="community-text-button" onClick={reloadAreas}>{t("Thử lại")}</button></p>}
      <div className="community-feed-heading"><h2>{t("Kèo cộng đồng")}</h2><span>{t("Liên hệ trực tiếp chủ kèo")}</span></div>
      {loading && <div className="loading" role="status">{t("Đang tải…")}</div>}
      {!loading && !error && feed?.listings.length === 0 && <Empty icon="search" title={t("Chưa có kèo phù hợp")} action={hasFilters ? <button className="btn btn-secondary" onClick={reset}>{t("Xóa bộ lọc")}</button> : undefined}>{t("Thử ngày hoặc khu vực khác, hoặc quay lại sau.")}</Empty>}
      {feed && <div className="community-grid">{feed.listings.map((listing) => <CommunityListingCard key={listing.id} listing={listing} />)}</div>}
      {error && <div className="community-error" role="alert"><p>{t("Không thể tải kèo cộng đồng. Vui lòng thử lại.")}</p><button className="btn btn-secondary" onClick={() => feed ? void loadMore() : setRevision((value) => value + 1)}>{t("Thử lại")}</button></div>}
      {feed?.nextCursor && !error && <div className="community-pagination"><button className="btn btn-secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? t("Đang tải…") : t("Xem thêm kèo")}</button></div>}
    </div>
  );
}

export function CommunityListingCard({ listing }: { listing: CommunityListingDTO }) {
  const { t, locale } = useI18n();
  return (
    <article className="community-card card">
      <div className="community-source"><Icon name="globe" size={15} /><span>{listing.source.name}</span></div>
      <h2><Link href={`/community-listings/${listing.id}`}>{listing.title}</Link></h2>
      <div className="community-card-facts">
        <div><Icon name="calendar" size={18} /><span>{listing.startsAt ? communityDate(listing.startsAt, listing.timeZone, locale) : t("Chưa rõ ngày")}<small>{communityTime(listing, locale, t)}</small></span></div>
        <div><Icon name="pin" size={18} /><span>{listing.venueName || t("Chưa rõ sân")}<small>{listing.areaLabel || listing.areaCode || t("Chưa rõ khu vực")}</small></span></div>
        <div><Icon name="badminton" size={18} /><span>{listing.skillText || t(communitySkillLabels[listing.skillLevel])}</span></div>
      </div>
      <div className="community-card-fee">{communityFee(listing, locale, t)}</div>
      <p className="community-recruiting">{listing.requestedPlayers === null ? t("Chưa rõ số người tuyển") : t("Bài đăng tuyển {0} người", [listing.requestedPlayers])}</p>
      <div className="community-card-footer">
        <div><span className="community-availability">{t(communityStatusLabels[listing.effectiveStatus])}</span><p className={`community-freshness ${listing.stale ? "is-stale" : ""}`}>{listing.stale ? t("Thông tin chưa được cập nhật gần đây") : t("Kiểm tra {0}", [communityDate(listing.lastVerifiedAt, listing.timeZone, locale, true)])}</p></div>
        <Link href={`/community-listings/${listing.id}`} className="community-open" aria-label={t("Xem {0}", [listing.title])}><Icon name="arrow" size={20} /></Link>
      </div>
    </article>
  );
}
