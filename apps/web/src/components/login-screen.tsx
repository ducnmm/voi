"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.9 35.7 44 30.4 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

/** Screen 1 — a single circular Google button in the middle of the screen. */
export function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center px-6">
      <button
        onClick={handleLogin}
        disabled={busy}
        aria-label="Đăng nhập bằng Google"
        className="grid h-28 w-28 place-items-center rounded-full bg-surface shadow-[0_10px_30px_-8px_rgba(31,61,43,0.35)] ring-1 ring-line/10 transition-transform duration-100 hover:scale-105 active:scale-95 disabled:opacity-60"
      >
        {busy ? <span className="text-sm font-bold">…</span> : <GoogleMark />}
      </button>
    </main>
  );
}
