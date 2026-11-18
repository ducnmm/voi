"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { usePublicResource } from "@/lib/use-public-resource";
import type { CommunityNormalizationFilters as FilterValue, SkillCatalog, VenueSummary } from "@/lib/normalization";
import { Select } from "./select";

export function CommunityNormalizationFilters({ value, onChange, areaCode = "" }: {
  value: FilterValue; onChange: (value: FilterValue) => void; areaCode?: string;
}) {
  const { t } = useI18n();
  const catalog = usePublicResource<SkillCatalog>("/community-listings/skills");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search), 250); return () => window.clearTimeout(timer); }, [search]);
  const venues = usePublicResource<{ venues: VenueSummary[] }>(`/venues?${new URLSearchParams({ limit: "50", ...(areaCode ? { areaCode } : {}), ...(query ? { q: query } : {}) })}`);
  const [selectedVenue, setSelectedVenue] = useState<VenueSummary | null>(null);
  useEffect(() => {
    const selected = venues.data?.venues.find(venue => venue.id === value.venueId);
    if (selected) setSelectedVenue(selected);
    else if (!value.venueId) setSelectedVenue(null);
  }, [venues.data, value.venueId]);
  const options = [...(venues.data?.venues ?? []), ...(selectedVenue && !venues.data?.venues.some(venue => venue.id === selectedVenue.id) ? [selectedVenue] : [])];
  return <>
    <label><span>{t("Yêu cầu trình độ cho")}</span><Select aria-label={t("Yêu cầu trình độ cho")} value={value.audience} onValueChange={audience => onChange({ ...value, audience })}>
      <option value="">{t("Tất cả đối tượng")}</option><option value="MALE">{t("Nam")}</option><option value="FEMALE">{t("Nữ")}</option>
    </Select></label>
    <label><span>{t("Mức trình độ của bạn")}</span><Select aria-label={t("Mức trình độ của bạn")} value={value.rank} disabled={!catalog.data} onValueChange={rank => onChange({ ...value, rank })}>
      <option value="">{t("Tất cả mức trình độ")}</option>{catalog.data?.ranks.map(rank => <option key={rank.code} value={rank.code}>{rank.label}</option>)}
    </Select></label>
    <label className="community-unknown-filter"><input type="checkbox" disabled={!value.rank} checked={value.includeUnknown} onChange={event => onChange({ ...value, includeUnknown: event.target.checked })} /><span>{t("Gồm bài chưa rõ trình độ")}</span></label>
    <label><span>{t("Tìm sân trong danh mục")}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Tên sân hoặc địa chỉ")} /></label>
    <label><span>{t("Sân đã đối chiếu")}</span><Select aria-label={t("Sân đã đối chiếu")} value={value.venueId} onValueChange={venueId => onChange({ ...value, venueId })}>
      <option value="">{t("Tất cả sân đã đối chiếu")}</option>{options.map(venue => <option key={venue.id} value={venue.id}>{venue.name}{venue.address ? ` · ${venue.address}` : ""}</option>)}
    </Select></label>
    {(catalog.error || venues.error) && <p className="community-inline-note" role="status">{t("Chưa tải được danh mục chuẩn hóa.")} <button type="button" className="community-text-button" onClick={() => { catalog.reload(); venues.reload(); }}>{t("Thử lại")}</button></p>}
  </>;
}
