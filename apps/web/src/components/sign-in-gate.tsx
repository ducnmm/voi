"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { Button, Card, ErrorNote, Field, Input, Spinner } from "./ui";

export function SignInGate({ children }: { children: ReactNode }) {
  const { user, ready, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!ready) {
    return <Spinner />;
  }

  if (user) {
    return <>{children}</>;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), displayName.trim() || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <h1 className="text-xl font-bold">Welcome to Voi</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Sign in with your email to organize and join badminton sessions.
        </p>
        <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field label="Email">
            <Input
              type="email"
              required
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Display name" hint="Optional — defaults to your email handle.">
            <Input
              value={displayName}
              placeholder="Duc"
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          {error ? <ErrorNote message={error} /> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Continue"}
          </Button>
        </form>
      </Card>
      <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
        Development login — no password required yet.
      </p>
    </div>
  );
}
