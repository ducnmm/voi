"use client";
import { Select } from "@/components/select";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/use-resource";
import { request } from "@/lib/api-client";
import type { NotificationPreference } from "@/lib/api-types";
import { RequireAuth } from "@/components/require-auth";
import { Title } from "@/components/primitives";
import { Icon, type IconName } from "@/components/icon";
import { ErrorNote, Spinner } from "@/components/ui";
export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}
function SettingsRow({
  id,
  icon,
  label,
  description,
  children,
  kind = "select",
}: {
  id: string;
  icon: IconName;
  label: string;
  description?: string;
  children: ReactNode;
  kind?: "select" | "switch";
}) {
  return (
    <div className="setting-row" data-setting-row={id}>
      <label className="setting-leading" htmlFor={id}>
        <span className="setting-icon">
          <Icon name={icon} size={18} />
        </span>
        <span className="setting-copy">
          <strong>{label}</strong>
          {description && (
            <span className="setting-description" id={`${id}-hint`}>
              {description}
            </span>
          )}
        </span>
      </label>
      <div className={`setting-control setting-${kind}`}>{children}</div>
    </div>
  );
}
function Settings() {
  const { t, language, setLanguage } = useI18n();
  const { token, signOut } = useAuth();
  const prefs = useResource<{ preference: NotificationPreference }>(
    "/notification-preferences",
  );
  const [theme, setTheme] = useState("system");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setTheme(localStorage.getItem("voi.theme") ?? "system");
  }, []);
  async function updatePreference(
    key: keyof NotificationPreference,
    value: boolean | number,
  ) {
    setBusy(true);
    setError("");
    try {
      prefs.setData(
        await request<{ preference: NotificationPreference }>(
          "/notification-preferences",
          { token, method: "PUT", body: { [key]: value } },
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("Không lưu được cài đặt."),
      );
    } finally {
      setBusy(false);
    }
  }
  const notificationRows = [
    {
      key: "remindersEnabled",
      icon: "clock",
      label: "Nhắc trước giờ chơi",
      hint: "Để bạn luôn kịp giờ ra sân.",
    },
    {
      key: "statusChangesEnabled",
      icon: "calendar",
      label: "Thay đổi của kèo",
      hint: "Khi chủ kèo cập nhật thông tin.",
    },
    {
      key: "waitlistEnabled",
      icon: "people",
      label: "Danh sách chờ",
      hint: "Khi có chỗ trống dành cho bạn.",
    },
  ] as const;
  return (
    <div className="settings-page">
      <Link className="settings-back" href="/profile">
        <Icon name="arrow" size={17} />
        {t("Hồ sơ")}
      </Link>
      <Title
        title={t("Cài đặt")}
      />
      {error && <ErrorNote message={error} />}
      <section
        className="settings-group"
        aria-labelledby="notification-settings"
      >
        <h2 id="notification-settings">{t("Thông báo")}</h2>
        <div className="card settings-list">
          {prefs.error ? (
            <div className="settings-feedback">
              <ErrorNote message={prefs.error} />
              <button
                className="btn btn-secondary"
                onClick={() => void prefs.reload()}
              >
                {t("Thử lại")}
              </button>
            </div>
          ) : prefs.loading ? (
            <Spinner />
          ) : (
            prefs.data && (
              <>
                {notificationRows.map(({ key, icon, label, hint }) => (
                  <SettingsRow
                    key={key}
                    id={`settings-${key}`}
                    icon={icon}
                    label={t(label)}
                    description={t(hint)}
                    kind="switch"
                  >
                    <input
                      id={`settings-${key}`}
                      className="switch"
                      type="checkbox"
                      role="switch"
                      aria-label={t(label)}
                      aria-describedby={`settings-${key}-hint`}
                      checked={prefs.data!.preference[key]}
                      disabled={busy}
                      onChange={(event) =>
                        void updatePreference(key, event.target.checked)
                      }
                    />
                  </SettingsRow>
                ))}
                <SettingsRow
                  id="settings-lead-time"
                  icon="bell"
                  label={t("Trước giờ chơi")}
                >
                  <Select
                    id="settings-lead-time"
                    aria-label={t("Trước giờ chơi")}
                    value={prefs.data.preference.reminderLeadMinutes}
                    disabled={busy}
                    onValueChange={(value) =>
                      void updatePreference(
                        "reminderLeadMinutes",
                        Number(value),
                      )
                    }
                  >
                    {[
                      [15, "15 phút"],
                      [30, "30 phút"],
                      [60, "1 giờ"],
                      [120, "2 giờ"],
                      [1440, "1 ngày"],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(String(label))}
                      </option>
                    ))}
                  </Select>
                </SettingsRow>
              </>
            )
          )}
        </div>
      </section>
      <section className="settings-group" aria-labelledby="app-settings">
        <h2 id="app-settings">{t("Giao diện")}</h2>
        <div className="card settings-list">
          <SettingsRow
            id="settings-language"
            icon="globe"
            label={t("Ngôn ngữ")}
          >
            <Select
              id="settings-language"
              aria-label={t("Ngôn ngữ")}
              value={language}
              onValueChange={(value) =>
                setLanguage(value as "vi" | "en")
              }
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </Select>
          </SettingsRow>
          <SettingsRow id="settings-theme" icon="sun" label={t("Giao diện")}>
            <Select
              id="settings-theme"
              aria-label={t("Chế độ giao diện")}
              value={theme}
              onValueChange={(value) => {
                setTheme(value);
                localStorage.setItem("voi.theme", value);
                document.documentElement.dataset.theme = value;
              }}
            >
              <option value="system">{t("Theo thiết bị")}</option>
              <option value="light">{t("Sáng")}</option>
              <option value="dark">{t("Tối")}</option>
            </Select>
          </SettingsRow>
          <button
            className="setting-action"
            onClick={() => window.dispatchEvent(new Event("voi:onboarding"))}
          >
            <span className="setting-leading">
              <span className="setting-icon">
                <Icon name="info" size={18} />
              </span>
              <span>{t("Xem lại giới thiệu")}</span>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </section>
      <section className="settings-group" aria-labelledby="account-settings">
        <h2 id="account-settings">{t("Tài khoản")}</h2>
        <div className="card settings-list">
          <button className="setting-action" onClick={signOut}>
            <span className="setting-leading">
              <span className="setting-icon">
                <Icon name="logout" size={18} />
              </span>
              <span>{t("Đăng xuất")}</span>
            </span>
            <Icon name="chevron" size={16} />
          </button>
          <button
            className="setting-action setting-destructive"
            aria-expanded={confirmDelete}
            onClick={() => setConfirmDelete(!confirmDelete)}
          >
            <span className="setting-leading">
              <span className="setting-icon">
                <Icon name="trash" size={18} />
              </span>
              <span>{t("Xóa tài khoản")}</span>
            </span>
            <Icon name="chevron" size={16} />
          </button>
          {confirmDelete && (
            <div className="settings-confirm">
              <p>
                {t(
                  "Xóa tài khoản sẽ xóa hồ sơ, đăng ký tham gia và tin nhắn của bạn. Bạn cần xử lý các nhóm và kèo đang tổ chức trước khi xóa.",
                )}
              </p>
              <button
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await request("/me", { token, method: "DELETE" });
                    signOut();
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : t("Không thể xóa tài khoản."),
                    );
                    setBusy(false);
                  }
                }}
              >
                {t("Xác nhận xóa vĩnh viễn")}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(false)}
              >
                {t("Giữ tài khoản")}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
