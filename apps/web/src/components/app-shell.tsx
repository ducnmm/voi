"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { request } from "@/lib/api-client";
import { Icon, type IconName } from "./icon";
import { Onboarding } from "./onboarding";
import { unreadChatRooms, type ChatBadges } from "@/lib/chat-read";
import { Avatar } from "./primitives";
const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Kèo cầu lông", icon: "badminton" },
  { href: "/messages", label: "Tin nhắn", icon: "chat" },
  { href: "/notifications", label: "Thông báo", icon: "bell" },
  { href: "/profile", label: "Hồ sơ", icon: "person" },
];
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  const path = usePathname();
  const { user, token, ready } = useAuth();
  const [chatUnread, setChatUnread] = useState(0);
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    if (user)
      setIntro(localStorage.getItem(`voi.onboarding.${user.id}`) !== "done");
  }, [user?.id]);
  useEffect(() => {
    const show = () => setIntro(true);
    window.addEventListener("voi:onboarding", show);
    return () => window.removeEventListener("voi:onboarding", show);
  }, []);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      const root = document.documentElement;
      root.style.setProperty(
        "--app-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      root.style.setProperty("--viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const theme = localStorage.getItem("voi.theme") ?? "system";
    document.documentElement.dataset.theme = theme;
  }, []);
  useEffect(() => {
    if (!token) {
      setUnread(0);
      setChatUnread(0);
      return;
    }
    let active = true;
    const load = () =>
      request<ChatBadges>("/me/badges", { token })
        .then((data) => {
          if (active) {
            setUnread(data.alertsUnread);
            if (user) setChatUnread(unreadChatRooms(user.id, data.chats).size);
          }
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 30000);
    window.addEventListener("voi:badges", load);
    window.addEventListener("voi:chat-read", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("voi:badges", load);
      window.removeEventListener("voi:chat-read", load);
    };
  }, [token, user]);
  const active = (href: string) =>
    href === "/"
      ? path === "/" || path.startsWith("/sessions")
      : path.startsWith(href);
  const compactActive = (href: string) =>
    active(href) || (href === "/profile" && path.startsWith("/settings"));
  const section =
    tabs.find((tab) => active(tab.href))?.label ??
    (path.startsWith("/people")
      ? t("Người chơi")
      : path.startsWith("/groups")
        ? t("Nhóm của tôi")
        : path.startsWith("/settings")
          ? t("Cài đặt")
          : path.startsWith("/map")
            ? t("Kèo trên bản đồ")
            : t("Lời mời"));
  if (path.startsWith("/dev-preview")) return <>{children}</>;
  if (!ready)
    return (
      <main className="launch-screen">
        <div className="brand">
          <Image
            src="/voi-app-icon.png"
            alt=""
            width={40}
            height={40}
            className="app-icon"
            priority
          />
          voi
        </div>
        <div className="loading" role="status">
          {t("Đang tải…")}
        </div>
      </main>
    );
  if (!user)
    return (
      <main id="main" className="auth-root">
        {children}
      </main>
    );
  return (
    <div className="app-shell" data-app-shell>
      <a className="skip-link" href="#main">
        {t("Đến nội dung chính")}
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label={t("Voi — Trang chủ")}>
          <span className="brand-mark">
            <Image
              src="/voi-app-icon.png"
              alt=""
              width={36}
              height={36}
              className="app-icon"
              priority
            />
          </span>
          {t("voi")}
        </Link>
        <nav aria-label={t("Điều hướng chính")}>
          {tabs.map((tab) => (
            <Link
              className={`nav-link ${active(tab.href) ? "active" : ""}`}
              aria-current={active(tab.href) ? "page" : undefined}
              key={tab.href}
              href={tab.href}
            >
              <Icon name={tab.icon} active={active(tab.href)} />
              {t(tab.label)}
              {tab.icon === "chat" && chatUnread > 0 && (
                <span className="badge-count">{chatUnread}</span>
              )}
              {tab.icon === "bell" && unread > 0 && (
                <span className="badge-count">{unread}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="side-caption">{t("CỘNG ĐỒNG")}</div>
        <Link
          className={`nav-link ${path.startsWith("/people") ? "active" : ""}`}
          href="/people"
        >
          <Icon name="people" />
          {t("Người chơi & chủ kèo")}
        </Link>
        <Link
          className={`nav-link ${path.startsWith("/groups") ? "active" : ""}`}
          href="/groups"
        >
          <Icon name="court" />
          {t("Nhóm của tôi")}
        </Link>
        <div className="sidebar-bottom">
          <Link
            className={`nav-link ${path.startsWith("/settings") ? "active" : ""}`}
            aria-current={path.startsWith("/settings") ? "page" : undefined}
            href="/settings"
          >
            <Icon name="settings" />
            {t("Cài đặt")}
          </Link>
          {user && (
            <Link
              href="/profile"
              className="row"
              style={{ padding: "16px 12px 0" }}
            >
              <Avatar name={user.displayName} url={user.avatarUrl} />
              <div>
                <strong style={{ fontSize: "var(--type-footnote)" }}>{user.displayName}</strong>
              </div>
            </Link>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            {t("Voi")}
            <span>
              {t("/   ")}
              {t(section)}
            </span>
          </div>
          <Link className="brand mobile-brand" href="/">
            <Image
              src="/voi-app-icon.png"
              alt=""
              width={32}
              height={32}
              className="app-icon"
              priority
            />
            {t("voi")}
          </Link>
          <div className="row">
            <Link
              href="/notifications"
              className="icon-btn"
              aria-label={t("Thông báo{0}", [
                unread ? t(", {0} chưa đọc", [unread]) : "",
              ])}
            >
              <Icon name="bell" />
            </Link>
            {user && (
              <Link href="/profile" aria-label={t("Hồ sơ cá nhân")}>
                <Avatar
                  name={user.displayName}
                  url={user.avatarUrl}
                  size={34}
                />
              </Link>
            )}
          </div>
        </header>
        <main className="content" id="main">
          {children}
        </main>
      </div>
      <nav className="bottom-nav" aria-label={t("Điều hướng trên điện thoại")}>
        {tabs.map((tab) => (
          <Link
            className={compactActive(tab.href) ? "active" : ""}
            aria-current={compactActive(tab.href) ? "page" : undefined}
            href={tab.href}
            key={tab.href}
          >
            <span className="tab-icon">
              <Icon
                name={tab.icon}
                size={22}
                active={compactActive(tab.href)}
              />
              {((tab.icon === "chat" && chatUnread > 0) ||
                (tab.icon === "bell" && unread > 0)) && (
                <span className="badge-count">
                  {tab.icon === "chat" ? chatUnread : unread}
                </span>
              )}
            </span>
            <span>{tab.href === "/" ? t("Kèo") : t(tab.label)}</span>
          </Link>
        ))}
      </nav>
      {user && (
        <Onboarding
          key={String(intro)}
          open={intro}
          onFinish={() => {
            localStorage.setItem(`voi.onboarding.${user.id}`, "done");
            setIntro(false);
          }}
        />
      )}
    </div>
  );
}
