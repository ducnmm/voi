"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { SessionVisibility, SkillLevel } from "@voi/shared";
import { useAuth } from "@/lib/auth";
import { ApiError, api } from "@/lib/api-client";
import { localInputToIso } from "@/lib/format";
import { SignInGate } from "@/components/sign-in-gate";
import { Button, Card, ErrorNote, Field, Input, PageHeader } from "@/components/ui";

const SKILL_LEVELS: SkillLevel[] = ["OPEN", "BEGINNER", "INTERMEDIATE", "ADVANCED"];
const VISIBILITIES: SessionVisibility[] = ["PRIVATE_LINK", "GROUP_ONLY"];

export default function NewSessionPage() {
  return (
    <SignInGate>
      <NewSessionForm />
    </SignInGate>
  );
}

function NewSessionForm() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const router = useRouter();
  const { token } = useAuth();

  const [title, setTitle] = useState("");
  const [venueName, setVenueName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [courtCount, setCourtCount] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState("");
  const [feeTotalVnd, setFeeTotalVnd] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("OPEN");
  const [visibility, setVisibility] = useState<SessionVisibility>("PRIVATE_LINK");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.createSession(token, groupId, {
        title: title.trim() || undefined,
        venueName: venueName.trim(),
        startsAt: localInputToIso(startsAt),
        endsAt: localInputToIso(endsAt),
        courtCount,
        maxPlayers: maxPlayers ? Number(maxPlayers) : undefined,
        feeTotalVnd: feeTotalVnd ? Number(feeTotalVnd) : undefined,
        skillLevel,
        visibility
      });
      router.push(`/sessions/${result.session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create session.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/groups/${groupId}`}
          className="text-sm text-[var(--color-muted)] hover:underline"
        >
          ← Back to group
        </Link>
      </div>
      <PageHeader title="New session" subtitle="Set the time, venue, and capacity." />
      <Card>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field label="Title" hint="Optional — defaults to the venue name.">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Venue">
            <Input
              required
              value={venueName}
              placeholder="Nhà thi đấu Q7"
              onChange={(e) => setVenueName(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Starts at">
              <Input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </Field>
            <Field label="Ends at">
              <Input
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Courts">
              <Input
                type="number"
                min={1}
                max={20}
                required
                value={courtCount}
                onChange={(e) => setCourtCount(Number(e.target.value))}
              />
            </Field>
            <Field label="Max players" hint="Defaults to courts × 4.">
              <Input
                type="number"
                min={1}
                max={80}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Total fee (VND)" hint="Optional — split across joined players.">
            <Input
              type="number"
              min={0}
              value={feeTotalVnd}
              placeholder="300000"
              onChange={(e) => setFeeTotalVnd(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Skill level">
              <select
                className="rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
              >
                {SKILL_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Visibility">
              <select
                className="rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as SessionVisibility)}
              >
                {VISIBILITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {error ? <ErrorNote message={error} /> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create session"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
