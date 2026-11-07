"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Title, Avatar, Empty, skillLabels } from "@/components/primitives";
import { Icon } from "@/components/icon";
import { useResource } from "@/lib/use-resource";
import type { Person } from "@/lib/api-types";
import { ErrorNote, Spinner } from "@/components/ui";
export default function PeoplePage() {
  return (
    <RequireAuth>
      <People />
    </RequireAuth>
  );
}
function People() {
  const { t } = useI18n();

  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const { data, error, loading } = useResource<{ people: Person[] }>(
    `/people${role ? `?role=${role}` : ""}`,
  );
  const people =
    data?.people.filter((p) =>
      p.displayName.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <>
      <Title
        title={t("Bạn cùng sân")}
      />
      <div className="feed-tools">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            aria-label={t("Tìm người chơi")}
            placeholder={t("Tìm tên người chơi…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="segmented">
          <button className={!role ? "active" : ""} onClick={() => setRole("")}>
            {t("Tất cả")}
          </button>
          <button
            className={role === "host" ? "active" : ""}
            onClick={() => setRole("host")}
          >
            {t("Chủ kèo")}
          </button>
          <button
            className={role === "player" ? "active" : ""}
            onClick={() => setRole("player")}
          >
            {t("Người chơi")}
          </button>
        </div>
      </div>
      {error && <ErrorNote message={error} />}
      {loading ? (
        <Spinner />
      ) : !people.length ? (
        <Empty icon="people" title={t("Chưa tìm thấy người chơi")}>
          {t("Tham gia một nhóm để kết nối với những người cùng đam mê.")}
        </Empty>
      ) : (
        <div className="feed-grid">
          {people.map((person) => (
            <Link
              className="card stack"
              key={person.id}
              href={`/people/${person.id}`}
            >
              <div className="row">
                <Avatar
                  name={person.displayName}
                  url={person.avatarUrl}
                  size={48}
                />
                <div>
                  <h3>{person.displayName}</h3>
                  <p className="muted" style={{ fontSize: "var(--type-footnote)", marginTop: 6 }}>
                    {person.isHost ? t("Chủ kèo") : t("Người chơi")} {t(" ·")}{" "}
                    {t(skillLabels[person.defaultSkillLevel])}
                  </p>
                </div>
              </div>
              <div className="row spread" style={{ fontSize: "var(--type-footnote)" }}>
                <span className="muted">
                  {person.activityCount} {t("kèo đã tham gia")}
                </span>
                <span
                  className="row"
                  style={{ color: "var(--color-accent)", gap: 5 }}
                >
                  <Icon name="star" size={14} />
                  {person.averageRating?.toFixed(1) ?? t("Mới")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
