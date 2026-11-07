"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { SessionMap } from "@/components/session-map";
import { Title, Empty } from "@/components/primitives";
import { useResource } from "@/lib/use-resource";
import type { SessionCard } from "@/lib/api-types";
import { formatSessionTime, formatVnd } from "@/lib/format";
import { Icon } from "@/components/icon";
import { ErrorNote, Spinner } from "@/components/ui";
export default function MapPage() {
  return (
    <RequireAuth>
      <MapBrowse />
    </RequireAuth>
  );
}
function MapBrowse() {
  const { t } = useI18n();

  const resource = useResource<{ sessions: SessionCard[] }>(
    "/sessions?limit=100",
  );
  const [selected, setSelected] = useState("");
  return (
    <>
      <Title
        title={t("Kèo trên bản đồ")}
        action={
          <Link className="btn btn-secondary" href="/">
            <Icon name="court" size={18} />
            {t("Danh sách")}
          </Link>
        }
      />
      {resource.error ? (
        <ErrorNote message={resource.error} />
      ) : resource.loading ? (
        <Spinner />
      ) : !resource.data?.sessions.length ? (
        <Empty icon="map" title={t("Chưa có kèo trên bản đồ")}>
          {t("Kèo của nhóm sẽ xuất hiện ở đây.")}
        </Empty>
      ) : (
        <div className="map-browser">
          <SessionMap
            sessions={resource.data.sessions}
            selected={selected}
            onSelect={setSelected}
          />
          <div className="map-list">
            {resource.data.sessions.map((session) => (
              <article
                key={session.id}
                className={`card map-card ${selected === session.id ? "selected" : ""}`}
              >
                <button
                  className="map-select"
                  onClick={() => setSelected(session.id)}
                  aria-pressed={selected === session.id}
                >
                  <h3>{session.title || session.venueName}</h3>
                  <p className="muted">{session.venueName}</p>
                  <p className="muted">
                    {formatSessionTime(session.startsAt, session.endsAt)}
                  </p>
                </button>
                <div className="row spread">
                  <strong>{formatVnd(session.summary.perPlayerCostVnd)}</strong>
                  <Link
                    href={`/sessions/${session.id}`}
                    className="chip chip-green"
                  >
                    {t("Xem kèo")}
                    <Icon name="chevron" size={14} />
                  </Link>
                </div>
                {session.venueLat == null && (
                  <p className="muted map-note">
                    {t("Sân chưa có tọa độ.")}{" "}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.venueName)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("Tìm đường ↗")}
                    </a>
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
