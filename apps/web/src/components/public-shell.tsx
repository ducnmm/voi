"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./icon";

export function PublicShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const theme = localStorage.getItem("voi.theme") ?? "system";
    setDark(theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches));
  }, []);
  return <div className="public-shell">
    <a className="skip-link" href="#main">{t("Đến nội dung chính")}</a>
    <header className="public-header">
      <nav className="public-nav" aria-label={t("Điều hướng chính")}>
        <Link className="brand" href="/" aria-label={t("Voi — Trang chủ")}><Image src="/voi-app-icon.png" alt="" width={32} height={32} className="app-icon" priority />voi</Link>
        <div className="public-nav-actions">
          <button
            className="icon-btn"
            aria-label={`${t("Ngôn ngữ")}: ${language === "vi" ? "Tiếng Việt" : "English"}. ${t(language === "vi" ? "Chuyển sang tiếng Anh" : "Chuyển sang tiếng Việt")}`}
            title={t(language === "vi" ? "Chuyển sang tiếng Anh" : "Chuyển sang tiếng Việt")}
            onClick={() => setLanguage(language === "vi" ? "en" : "vi")}
          >{language.toUpperCase()}</button>
          <button className="icon-btn" aria-label={dark ? t("Chuyển sang giao diện sáng") : t("Chuyển sang giao diện tối")} onClick={() => {
            const next = !dark;
            setDark(next);
            document.documentElement.dataset.theme = next ? "dark" : "light";
            localStorage.setItem("voi.theme", next ? "dark" : "light");
          }}><Icon name="sun" size={18} /></button>
          <Link className="btn btn-secondary" href={user ? "/" : "/login"}>{user ? t("Kèo của tôi") : t("Đăng nhập")}</Link>
        </div>
      </nav>
    </header>
    <main className="public-content" id="main">{children}</main>
  </div>;
}
