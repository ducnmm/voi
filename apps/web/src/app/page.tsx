"use client";

import { useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/login-screen";
import { HomeChoice } from "@/components/home-choice";

export default function HomePage() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <main className="grid min-h-[100dvh] place-items-center">
        <span className="text-sm font-extrabold uppercase tracking-wide">Đang tải…</span>
      </main>
    );
  }

  return user ? <HomeChoice /> : <LoginScreen />;
}
