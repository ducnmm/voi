"use client";
import { Select } from "@/components/select";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import type { SkillLevel } from "@voi/shared";
import { useAuth } from "@/lib/auth";
import { request, uploadImage } from "@/lib/api-client";
import { RequireAuth } from "@/components/require-auth";
import { Avatar, Title, skillLabels } from "@/components/primitives";
import { Icon } from "@/components/icon";
import { ErrorNote } from "@/components/ui";
import type { UserProfile } from "@/lib/api-types";
export default function ProfilePage() {
  return (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  );
}
function Profile() {
  const { t } = useI18n();

  const { user, token, updateUser } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [skill, setSkill] = useState<SkillLevel>(
    user?.defaultSkillLevel ?? "INTERMEDIATE",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <div className="stack form-section">
      <Title
        title={t("Hồ sơ")}
      />
      <section className="card profile-identity">
        <Avatar name={user?.displayName ?? ""} url={user?.avatarUrl} size={80} />
        <div>
          <h2>{user?.displayName}</h2>
          <p>{user?.email}</p>
          <Link href={`/people/${user?.id}`} className="profile-public-link">
            {t("Xem hồ sơ công khai →")}
          </Link>
        </div>
      </section>
      <section className="card">
        <h2>{t("Kèo của bạn")}</h2>
        <div className="manage-links" style={{ marginTop: 20 }}>
          <Link href="/groups">
            <Icon name="people" size={18} />
            {t("Nhóm của tôi")}
          </Link>
          <Link href="/?scope=past">
            <Icon name="clock" size={18} />
            {t("Lịch sử tham gia")}
          </Link>
        </div>
        <div style={{ marginTop: 20 }}>
          <Link href="/sessions/new" className="list-row">
            <span className="avatar">
              <Icon name="plus" />
            </span>
            <span className="grow">{t("Tạo kèo mới")}</span>
            <Icon name="chevron" size={16} />
          </Link>
          <Link href="/sessions/manage" className="list-row">
            <span className="avatar">
              <Icon name="court" />
            </span>
            <span className="grow">{t("Kèo tôi tổ chức")}</span>
            <Icon name="chevron" size={16} />
          </Link>
        </div>
      </section>
      <form
        className="card stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setSaved(false);
          try {
            const { user } = await request<{ user: UserProfile }>("/me", {
              token,
              method: "PATCH",
              body: { displayName: name.trim(), defaultSkillLevel: skill },
            });
            updateUser(user);
            setSaved(true);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : t("Không thể lưu hồ sơ."),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{t("Thông tin cá nhân")}</h2>
        <label>
          {t("Tên hiển thị")}
          <input
            required
            maxLength={80}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label>
          {t("Trình độ mặc định")}
          <Select
            value={skill}
            onValueChange={(value) => {
              setSkill(value as SkillLevel);
              setSaved(false);
            }}
          >
            {Object.entries(skillLabels).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </Select>
        </label>
        <label>
          {t("Ảnh đại diện")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file || !token) return;
              setBusy(true);
              setError("");
              try {
                if (file.size > 8 * 1024 * 1024)
                  throw new Error(t("Vui lòng chọn ảnh dưới 8 MB."));
                const url = await uploadImage(token, file);
                const result = await request<{ user: UserProfile }>("/me", {
                  token,
                  method: "PATCH",
                  body: { avatarUrl: url },
                });
                updateUser(result.user);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : t("Không thể đổi ảnh."),
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {error && <ErrorNote message={error} />}
        {saved && (
          <div className="notice" role="status">
            {t("Đã lưu thông tin của bạn.")}
          </div>
        )}
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy ? t("Đang lưu…") : t("Lưu thay đổi")}
        </button>
      </form>
      <Link href="/settings" className="card row">
        <Icon name="settings" />
        <span style={{ flex: 1 }}>{t("Cài đặt")}</span>
        <Icon name="chevron" size={16} />
      </Link>
    </div>
  );
}
