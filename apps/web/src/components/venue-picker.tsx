"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { usePublicResource } from "@/lib/use-public-resource";
import type { VenueSummary } from "@/lib/normalization";
import { venueMapsHref } from "@/lib/normalization";
import { Select } from "./select";

export function VenuePicker({ name, venueId, initialVenue, onNameChange, onSelect, required = true }: {
  name: string; venueId: string | null; initialVenue?: VenueSummary | null;
  onNameChange: (name: string) => void; onSelect: (venue: VenueSummary | null) => void; required?: boolean;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(name);
  useEffect(() => { const timer = window.setTimeout(() => setQuery(name), 250); return () => window.clearTimeout(timer); }, [name]);
  const response = usePublicResource<{ venues: VenueSummary[] }>(`/venues?${new URLSearchParams({ limit: "20", ...(query ? { q: query } : {}) })}`);
  const [selected, setSelected] = useState(initialVenue ?? null);
  const options = [...(response.data?.venues ?? []), ...(selected && !response.data?.venues.some(venue => venue.id === selected.id) ? [selected] : [])];
  const mapsHref = venueMapsHref(selected, name);
  return <div className="stack" style={{ gap: 10, minWidth: 0 }}>
    <label>{t("Sân cầu lông")}<input required={required} maxLength={120} value={name} onChange={event => { setSelected(null); onNameChange(event.target.value); }} placeholder={t("Tên sân của bạn")} /></label>
    <label>{t("Chọn đúng chi nhánh sân")}<Select aria-label={t("Chọn đúng chi nhánh sân")} value={venueId ?? ""} onValueChange={id => {
      const venue = options.find(option => option.id === id) ?? null;
      setSelected(venue); onSelect(venue);
    }}><option value="">{t("Dùng tên sân tự nhập")}</option>{options.map(venue => <option key={venue.id} value={venue.id}>{venue.name}{venue.address ? ` · ${venue.address}` : ""}</option>)}</Select></label>
    {selected?.address && <small className="muted">{selected.address}</small>}
    {mapsHref && <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="community-text-button">{selected?.locationVerified ? t("Mở Google Maps") : t("Tìm sân trên Google Maps")}</a>}
    {response.error && <small className="muted">{t("Chưa tải được danh mục sân. Bạn vẫn có thể nhập tên sân.")}</small>}
  </div>;
}
