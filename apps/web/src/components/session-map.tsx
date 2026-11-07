"use client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import type { SessionCard } from "@/lib/api-types";
import type { Map as LeafletMap } from "leaflet";
import { ErrorNote } from "./ui";
export function SessionMap({
  sessions,
  selected,
  onSelect,
  pick,
  location,
}: {
  sessions: SessionCard[];
  selected?: string;
  onSelect?: (id: string) => void;
  pick?: (lat: number, lng: number) => void;
  location?: { lat: number; lng: number };
}) {
  const { t } = useI18n();

  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<LeafletMap | null>(null);
  const [error, setError] = useState("");
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    if (!ref.current) return;
    setError("");
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (disposed || !ref.current) return;
        const points = sessions.filter(
          (
            session,
          ): session is SessionCard & { venueLat: number; venueLng: number } =>
            session.venueLat != null && session.venueLng != null,
        );
        const map = L.map(ref.current, {
          scrollWheelZoom: false,
          zoomControl: true,
        }).setView([10.7769, 106.7009], 12);
        instance.current = map;
        const tiles = L.tileLayer(
          process.env.NEXT_PUBLIC_MAP_TILE_URL ??
            (process.env.NODE_ENV === "production"
              ? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              : "https://tile.openstreetmap.de/{z}/{x}/{y}.png"),
          {
            attribution:
              process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ??
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' +
                (process.env.NODE_ENV === "production"
                  ? ""
                  : ' · <a href="https://www.openstreetmap.de/">OSM Deutschland</a>'),
            maxZoom: 19,
          },
        ).addTo(map);
        tiles.on("tileload", () => {
          if (!disposed) setError("");
        });
        let failures = 0;
        tiles.on("tileerror", () => {
          if (++failures >= 3 && !disposed)
            setError(
              t(
                "Không tải được bản đồ. Bạn vẫn có thể chọn kèo và mở chỉ đường.",
              ),
            );
        });
        for (const session of points) {
          const icon = L.divIcon({
            className: "venue-marker",
            html: `<span class="${selected === session.id ? "selected" : ""}">${session.summary.availableSlots}</span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
          });
          const marker = L.marker([session.venueLat, session.venueLng], {
            icon,
            title: session.title || session.venueName,
            keyboard: true,
          }).addTo(map);
          const tooltip = document.createElement("span");
          tooltip.textContent = session.title || session.venueName;
          marker.bindTooltip(tooltip, { direction: "top", offset: [0, -30] });
          marker.on("click", () => selectRef.current?.(session.id));
        }
        if (points.length)
          map.fitBounds(
            points.map(
              (session) =>
                [session.venueLat, session.venueLng] as [number, number],
            ),
            { padding: [45, 45], maxZoom: 15 },
          );
        const focused = points.find((point) => point.id === selected);
        if (focused) map.setView([focused.venueLat, focused.venueLng], 15);
        if (location) {
          L.circleMarker([location.lat, location.lng], {
            radius: 10,
            color: "#fff",
            weight: 3,
            fillColor: "#0066cc",
            fillOpacity: 1,
          }).addTo(map);
          map.setView([location.lat, location.lng], 15);
        }
        if (pickRef.current)
          map.on("click", (event) =>
            pickRef.current?.(event.latlng.lat, event.latlng.lng),
          );
        observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(ref.current);
      })
      .catch(() => {
        if (!disposed) setError(t("Không tải được bản đồ."));
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      instance.current?.remove();
      instance.current = null;
    };
  }, [sessions, selected, location]);
  return (
    <div className="map-frame">
      <div
        ref={ref}
        className="session-map"
        role="region"
        aria-label={t("Bản đồ các kèo cầu lông")}
      />
      {error && (
        <div className="map-error">
          <ErrorNote message={error} />
        </div>
      )}
    </div>
  );
}
