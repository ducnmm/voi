"use client";
import { useI18n } from "@/lib/i18n";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LoginScreen } from "./login-screen";

/** Gates a route behind sign-in; unauthenticated users see the login screen. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  const { user, ready } = useAuth();

  if (!ready)
    return (
      <div className="loading" role="status">
        {t("Đang tải…")}
      </div>
    );

  if (!user) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
