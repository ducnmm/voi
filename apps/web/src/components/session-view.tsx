"use client";

import { useCallback, useEffect, useState } from "react";
import type { RsvpStatus } from "@voi/shared";
import { useAuth } from "@/lib/auth";
import { ApiError, api } from "@/lib/api-client";
import type { RsvpChoice } from "@/lib/api-client";
import type { SessionDetail, SessionParticipant } from "@/lib/api-types";
import { formatSessionTime, formatVnd } from "@/lib/format";
import { API_BASE_URL } from "@/lib/api-client";
import { Badge, Button, Card, ErrorNote, PageHeader, Spinner } from "./ui";

const RSVP_OPTIONS: { value: RsvpChoice; label: string }[] = [
  { value: "JOINED", label: "Join" },
  { value: "MAYBE", label: "Maybe" },
  { value: "DECLINED", label: "Can't go" }
];

const statusTone: Record<RsvpStatus, "green" | "amber" | "slate" | "red" | "blue"> = {
  JOINED: "green",
  WAITLISTED: "blue",
  MAYBE: "amber",
  DECLINED: "slate",
  CANCELLED: "slate"
};

export function SessionView({ sessionId }: { sessionId: string }) {
  const { token, user } = useAuth();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.getSession(sessionId, token);
      setSession(result.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load session.");
    }
  }, [sessionId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRsvp(status: RsvpChoice) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.rsvp(token, sessionId, status);
      setSession(result.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update RSVP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.cancelSession(token, sessionId);
      setSession(result.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel session.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePayment(participant: SessionParticipant) {
    if (!token) return;
    const next = participant.paymentStatus === "PAID" ? "UNPAID" : "PAID";
    setBusy(true);
    try {
      const result = await api.setPayment(token, sessionId, participant.id, next);
      setSession(result.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update payment.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !session) return <ErrorNote message={error} />;
  if (!session) return <Spinner />;

  const isHost = user?.id === session.hostUserId;
  const isCancelled = session.status === "CANCELLED";
  const myParticipant = session.participants.find((p) => p.userId === user?.id);
  const joined = session.participants.filter((p) => p.rsvpStatus === "JOINED");
  const waitlisted = session.participants.filter((p) => p.rsvpStatus === "WAITLISTED");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={session.title ?? session.venueName}
        subtitle={`${formatSessionTime(session.startsAt, session.endsAt)} · ${session.venueName}`}
        action={
          <Badge tone={isCancelled ? "red" : "green"}>{session.status}</Badge>
        }
      />

      {error ? <ErrorNote message={error} /> : null}

      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Joined" value={`${session.summary.joinedPlayerCount}/${session.maxPlayers}`} />
          <Stat label="Open slots" value={String(session.summary.availableSlots)} />
          <Stat label="Waitlist" value={String(session.summary.waitlistCount)} />
          <Stat label="Per player" value={formatVnd(session.summary.perPlayerCostVnd)} />
        </div>
        {session.summary.totalCostVnd > 0 ? (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Total cost {formatVnd(session.summary.totalCostVnd)} · {session.courtCount} courts
          </p>
        ) : null}
      </Card>

      {!isCancelled ? (
        <Card>
          <h2 className="text-sm font-semibold">Your RSVP</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {RSVP_OPTIONS.map((option) => {
              const active =
                myParticipant?.rsvpStatus === option.value ||
                (option.value === "JOINED" && myParticipant?.rsvpStatus === "WAITLISTED");
              return (
                <Button
                  key={option.value}
                  variant={active ? "primary" : "secondary"}
                  disabled={busy}
                  onClick={() => handleRsvp(option.value)}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
          {myParticipant?.rsvpStatus === "WAITLISTED" ? (
            <p className="mt-2 text-xs text-amber-700">
              You are on the waitlist (position {myParticipant.waitlistPosition ?? "—"}).
            </p>
          ) : null}
        </Card>
      ) : null}

      <ParticipantList
        title={`Confirmed (${joined.length})`}
        participants={joined}
        isHost={isHost}
        showPayment
        onTogglePayment={handleTogglePayment}
        busy={busy}
      />

      {waitlisted.length > 0 ? (
        <ParticipantList
          title={`Waitlist (${waitlisted.length})`}
          participants={waitlisted}
          isHost={isHost}
          showPayment={false}
          onTogglePayment={handleTogglePayment}
          busy={busy}
        />
      ) : null}

      <LineupBoard session={session} />

      {session.inviteUrlToken ? (
        <InviteRow token={session.inviteUrlToken} />
      ) : null}

      {isHost && !isCancelled ? (
        <Button variant="danger" disabled={busy} onClick={handleCancel}>
          Cancel session
        </Button>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function ParticipantList({
  title,
  participants,
  isHost,
  showPayment,
  onTogglePayment,
  busy
}: {
  title: string;
  participants: SessionParticipant[];
  isHost: boolean;
  showPayment: boolean;
  onTogglePayment: (participant: SessionParticipant) => void;
  busy: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </h2>
      {participants.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">No players yet.</p>
        </Card>
      ) : (
        <Card>
          <ul className="flex flex-col divide-y divide-[var(--color-line)]">
            {participants.map((participant) => (
              <li
                key={participant.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 text-sm"
              >
                <span>{participant.user.displayName}</span>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone[participant.rsvpStatus]}>
                    {participant.rsvpStatus}
                  </Badge>
                  {showPayment ? (
                    isHost ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => onTogglePayment(participant)}
                      >
                        {participant.paymentStatus === "PAID" ? "Paid" : "Mark paid"}
                      </Button>
                    ) : (
                      <Badge tone={participant.paymentStatus === "PAID" ? "green" : "amber"}>
                        {participant.paymentStatus}
                      </Badge>
                    )
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function LineupBoard({ session }: { session: SessionDetail }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Courts
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {session.courts.map((court) => (
          <Card key={court.id}>
            <h3 className="font-semibold">{court.label}</h3>
            {court.lineupSlots.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-muted)]">Empty</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {court.lineupSlots.map((slot) => (
                  <li key={slot.id}>
                    {slot.slotOrder}. {slot.user.displayName}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}

function InviteRow({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/invites/${token}`
      : `/invites/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold">Invite link</h2>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-xs">
          {inviteUrl}
        </code>
        <Button variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">API base: {API_BASE_URL}</p>
    </Card>
  );
}
