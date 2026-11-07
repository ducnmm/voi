"use client";
import { useI18n } from "@/lib/i18n";
import Script from "next/script";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { ErrorNote } from "./ui";
declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          state: string;
          nonce: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: { id_token: string; state: string };
          user?: { name?: { firstName?: string; lastName?: string } };
        }>;
      };
    };
  }
}
export function AppleSignIn() {
  const { t } = useI18n();

  const { signInWithApple } = useAuth();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
  const redirectURI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI;
  if (!clientId || !redirectURI) return null;
  return (
    <>
      {clientId && redirectURI && (
        <Script
          src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
          onReady={() => setReady(true)}
          onError={() => setError(t("Không tải được đăng nhập Apple."))}
        />
      )}
      <button
        className="btn apple-login"
        disabled={!ready || busy}
        onClick={async () => {
          if (!window.AppleID || !clientId || !redirectURI) return;
          setBusy(true);
          setError("");
          try {
            const state = crypto.randomUUID();
            const nonce = crypto.randomUUID();
            window.AppleID.auth.init({
              clientId,
              redirectURI,
              state,
              nonce,
              scope: "name email",
              usePopup: true,
            });
            const result = await window.AppleID.auth.signIn();
            if (result.authorization.state !== state)
              throw new Error(t("Phiên đăng nhập Apple không hợp lệ."));
            const fullName =
              [result.user?.name?.firstName, result.user?.name?.lastName]
                .filter(Boolean)
                .join(" ") || undefined;
            await signInWithApple(
              result.authorization.id_token,
              nonce,
              fullName,
            );
          } catch (err) {
            if (!(
              err &&
              typeof err === "object" &&
              "error" in err &&
              err.error === "popup_closed_by_user"
            ))
              setError(
                err instanceof Error
                  ? err.message
                  : t("Không thể đăng nhập Apple."),
              );
          } finally {
            setBusy(false);
          }
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="21"
          height="21"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M17.1 12.5c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.2.8-.6 0-1.6-.8-2.7-.8-1.4 0-2.7.8-3.5 2-1.5 2.5-.4 6.3 1.1 8.4.7 1 1.5 2.1 2.6 2.1 1.1 0 1.4-.7 2.8-.7 1.3 0 1.7.7 2.9.7 1.2 0 1.9-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.4-.9-2.4-3.4ZM15 6.3c.5-.7.9-1.6.8-2.5-.8 0-1.8.6-2.4 1.3-.5.6-1 1.5-.9 2.4.9.1 1.9-.5 2.5-1.2Z" />
        </svg>
        {busy ? t("Đang đăng nhập…") : t("Tiếp tục với Apple")}
      </button>
      {!clientId && (
        <p className="auth-provider-note">
          {t("Apple chưa sẵn sàng trên web.")}
        </p>
      )}
      {error && <ErrorNote message={error} />}
    </>
  );
}
