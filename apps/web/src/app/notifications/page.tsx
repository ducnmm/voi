"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { Title, Empty } from "@/components/primitives";
import { Icon } from "@/components/icon";
import { useResource } from "@/lib/use-resource";
import { useAuth } from "@/lib/auth";
import { request } from "@/lib/api-client";
import type { AppNotification } from "@/lib/api-types";
import { ErrorNote, Spinner } from "@/components/ui";
const labels: Record<string, string> = {
  SESSION_REMINDER: "Sắp đến giờ ra sân",
  SESSION_CHANGED: "Kèo có thay đổi",
  SESSION_CANCELLED: "Kèo đã hủy",
  WAITLIST_PROMOTION: "Đã đến lượt bạn tham gia",
  RSVP_UPDATED: "Cập nhật người tham gia",
  PAYMENT_REMINDER: "Nhắc thanh toán",
};
export default function NotificationsPage() {
  return (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  );
}
function Notifications() {
  const { t } = useI18n();

  const { token } = useAuth();
  const resource = useResource<{ notifications: AppNotification[] }>(
    "/notifications",
  );
  const [busy, setBusy] = useState(false);
  async function read(id?: string) {
    setBusy(true);
    try {
      await request(
        id ? `/notifications/${id}/read` : "/notifications/read-all",
        { token, method: "POST" },
      );
      resource.setData((current) =>
        current
          ? {
              notifications: current.notifications.map((item) =>
                !id || item.id === id
                  ? { ...item, readAt: new Date().toISOString() }
                  : item,
              ),
            }
          : current,
      );
      window.dispatchEvent(new Event("voi:badges"));
    } catch (err) {
      resource.setError(
        err instanceof Error ? err.message : t("Không thể cập nhật."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title
        title={t("Thông báo")}
        action={
          <button
            className="btn btn-secondary"
            disabled={
              busy || !resource.data?.notifications.some((n) => !n.readAt)
            }
            onClick={() => void read()}
          >
            {t("Đọc tất cả")}
          </button>
        }
      />
      {resource.error && <ErrorNote message={resource.error} />}
      {resource.loading ? (
        <Spinner />
      ) : !resource.data?.notifications.length ? (
        <Empty icon="bell" title={t("Mọi thứ đã được cập nhật")}>
          {t("Lời nhắc và thay đổi của kèo sẽ xuất hiện ở đây.")}
        </Empty>
      ) : (
        <div className="card">
          {resource.data.notifications.map((item) => (
            <article className="list-row" key={item.id}>
              <span className="avatar">
                <Icon
                  name={
                    item.type.includes("CANCEL")
                      ? "close"
                      : item.type.includes("REMINDER")
                        ? "clock"
                        : "bell"
                  }
                />
              </span>
              <div className="grow">
                <h3
                  style={{ fontSize: "var(--type-callout)", fontWeight: item.readAt ? 400 : 600 }}
                >
                  {t(labels[item.type] ?? "Cập nhật kèo cầu lông")}
                </h3>
                <p>
                  {item.session?.title || item.session?.venueName || "Voi"}{" "}
                  {t(" ·")}{" "}
                  {new Date(item.createdAt).toLocaleString(t("vi-VN"), {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {!item.readAt && (
                <button
                  className="icon-btn"
                  aria-label={t("Đánh dấu đã đọc")}
                  disabled={busy}
                  onClick={() => void read(item.id)}
                >
                  <Icon name="check" size={17} />
                </button>
              )}
              {item.session && (
                <Link
                  href={`/sessions/${item.session.id}`}
                  className="icon-btn"
                  aria-label={t("Xem kèo")}
                >
                  <Icon name="chevron" size={16} />
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
