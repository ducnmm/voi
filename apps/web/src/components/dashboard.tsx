"use client";
import { Select } from "@/components/select";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { request } from "@/lib/api-client";
import { useResource } from "@/lib/use-resource";
import type { GroupSummary } from "@/lib/api-types";
import { Icon } from "./icon";
import { Title, Empty, skillLabels } from "./primitives";
import { ErrorNote, Spinner } from "./ui";
export function Dashboard() {
  const { t } = useI18n();

  const { token } = useAuth();
  const resource = useResource<{ groups: GroupSummary[] }>("/groups");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [skill, setSkill] = useState("OPEN");
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack">
      <Title
        title={t("Nhóm của tôi")}
        action={
          <button
            className="btn btn-primary"
            onClick={() => setCreating(!creating)}
          >
            <Icon name={creating ? "close" : "plus"} size={16} />
            {creating ? t("Đóng") : t("Tạo nhóm")}
          </button>
        }
      />
      {resource.error && <ErrorNote message={resource.error} />}
      {creating && (
        <form
          className="card stack form-section"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            resource.setError("");
            try {
              await request("/groups", {
                token,
                method: "POST",
                body: {
                  name: name.trim(),
                  description: description.trim() || undefined,
                  defaultSkillLevel: skill,
                },
              });
              setCreating(false);
              setName("");
              setDescription("");
              await resource.reload();
            } catch (err) {
              resource.setError(
                err instanceof Error ? err.message : t("Không thể tạo nhóm."),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>{t("Một nhóm mới, những kèo mới")}</h2>
          <label>
            {t("Tên nhóm")}
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Hội cầu lông tối thứ Ba")}
            />
          </label>
          <label>
            {t("Mô tả")}
            <input
              maxLength={280}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("Giới thiệu một chút về nhóm…")}
            />
          </label>
          <label>
            {t("Trình độ mặc định")}
            <Select value={skill} onValueChange={(value) => setSkill(value)}>
              {Object.entries(skillLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {t(String(label))}
                </option>
              ))}
            </Select>
          </label>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? t("Đang tạo…") : t("Tạo nhóm")}
          </button>
        </form>
      )}
      {resource.loading ? (
        <Spinner />
      ) : !resource.data?.groups.length ? (
        <Empty icon="people" title={t("Nhóm đầu tiên của bạn")}>
          {t("Tạo một nhóm, rủ những người bạn quen và bắt đầu lên kèo.")}
        </Empty>
      ) : (
        <div className="feed-grid">
          {resource.data.groups.map((group) => (
            <Link
              className="card stack"
              key={group.id}
              href={`/groups/${group.id}`}
            >
              <div className="row spread">
                <span className="avatar">
                  <Icon name="people" />
                </span>
                <Icon name="chevron" size={16} />
              </div>
              <div>
                <h2>{group.name}</h2>
                <p
                  className="muted"
                  style={{ fontSize: "var(--type-footnote)", lineHeight: "var(--leading-body)", marginTop: 8 }}
                >
                  {group.description ||
                    t("Cùng nhau ra sân, cùng nhau tiến bộ.")}
                </p>
              </div>
              <div className="row spread">
                <span className="muted" style={{ fontSize: "var(--type-footnote)" }}>
                  {group.memberCount} {t("thành viên")}
                </span>
                <span className="chip">
                  {t(skillLabels[group.defaultSkillLevel])}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
