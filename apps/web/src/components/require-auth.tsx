"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LoginScreen } from "./login-screen";

/** Gates a route behind sign-in; unauthenticated users see the login screen. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <main className="grid min-h-[100dvh] place-items-center">
        <span className="text-sm font-extrabold uppercase tracking-wide">Đang tải…</span>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
