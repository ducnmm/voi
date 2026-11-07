"use client";
import { useI18n } from "@/lib/i18n";
import { AppleSignIn } from "./apple-sign-in";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ErrorNote } from "./ui";
import { CourtArt } from "./primitives";
interface GoogleIdentity {
  initialize: (options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: Record<string, string | number>,
  ) => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}
export function LoginScreen() {
  const { t, language, setLanguage } = useI18n();

  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const googleButton = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const setup = useCallback(() => {
    if (!clientId || !window.google || !googleButton.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        setBusy(true);
        setError("");
        void signInWithGoogle(response.credential)
          .catch((err) =>
            setError(
              err instanceof Error ? err.message : t("Không thể đăng nhập."),
            ),
          )
          .finally(() => setBusy(false));
      },
    });
    window.google.accounts.id.renderButton(googleButton.current, {
      theme: "outline",
      size: "large",
      width: Math.min(320, googleButton.current.clientWidth),
      text: "continue_with",
      locale: language,
    });
  }, [clientId, signInWithGoogle, language, t]);
  useEffect(() => {
    setup();
  }, [setup]);
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <h1>
          {t("Thêm một kèo.")}
          <br />
          {t("Thêm niềm vui.")}
        </h1>
        <div className="story-court">
          <CourtArt />
        </div>
      </section>
      <section className="auth-panel">
        <button
          className="btn btn-ghost auth-language"
          aria-label={t("Ngôn ngữ")}
          onClick={() => setLanguage(language === "vi" ? "en" : "vi")}
        >
          {language === "vi" ? "EN" : "VI"}
        </button>
        <div className="auth-inner">
          <h2>{t("Sẵn sàng ra sân?")}</h2>
          <AppleSignIn />
          {clientId && (
            <>
              <Script
                src="https://accounts.google.com/gsi/client"
                onLoad={setup}
                onError={() =>
                  setError(
                    t("Không tải được đăng nhập Google. Vui lòng thử lại."),
                  )
                }
              />
              <div
                ref={googleButton}
                aria-label={t("Đăng nhập với Google")}
                style={{ minHeight: 44 }}
              />
            </>
          )}
          {busy && (
            <p className="muted" role="status" style={{ marginTop: 16 }}>
              {t("Đang đăng nhập…")}
            </p>
          )}
          {error && (
            <div style={{ marginTop: 16 }}>
              <ErrorNote message={error} />
            </div>
          )}
          {process.env.NODE_ENV !== "production" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setBusy(true);
                setError("");
                void signIn(email, name || undefined)
                  .catch((err) =>
                    setError(
                      err instanceof Error
                        ? err.message
                        : t("Không thể đăng nhập."),
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
              style={{ marginTop: 28 }}
            >
              <p className="muted" style={{ fontSize: "var(--type-footnote)" }}>
                {t("Tài khoản thử nghiệm trên môi trường phát triển")}
              </p>
              <label>
                {t("Tên hiển thị")}
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("Tên của bạn")}
                  maxLength={80}
                  autoComplete="name"
                />
              </label>
              <label>
                {t("Email")}
                <input
                  type="email"
                  value={email}
                  required
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("ban@example.com")}
                  autoComplete="email"
                />
              </label>
              <button className="btn btn-primary" disabled={busy}>
                {t("Tiếp tục")}
              </button>
            </form>
          )}
          {!clientId && process.env.NODE_ENV === "production" && (
            <div className="notice">
              {t("Đăng nhập hiện chưa sẵn sàng. Vui lòng quay lại sau.")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
