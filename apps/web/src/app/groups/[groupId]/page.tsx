"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError, api } from "@/lib/api-client";
import type { GroupDetail } from "@/lib/api-types";
import { formatSessionTime } from "@/lib/format";
import { SignInGate } from "@/components/sign-in-gate";
import { Badge, Button, Card, ErrorNote, PageHeader, Spinner } from "@/components/ui";

export default function GroupPage() {
  return (
    <SignInGate>
      <GroupDetailView />
    </SignInGate>
  );
}

function GroupDetailView() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { token } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const result = await api.getGroup(token, groupId);
      setGroup(result.group);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load group.");
    }
  }, [token, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorNote message={error} />;
  if (!group) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-[var(--color-muted)] hover:underline">
          ← All groups
        </Link>
      </div>
      <PageHeader
        title={group.name}
        subtitle={group.description ?? undefined}
        action={
          <Link href={`/groups/${groupId}/new-session`}>
            <Button>New session</Button>
          </Link>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Sessions
        </h2>
        {group.sessions.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-muted)]">
              No sessions scheduled yet.
            </p>
          </Card>
        ) : (
          group.sessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {session.title ?? session.venueName}
                    </h3>
                    <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                      {formatSessionTime(session.startsAt, session.endsAt)} ·{" "}
                      {session.venueName}
                    </p>
                  </div>
                  <Badge tone={session.status === "CANCELLED" ? "red" : "green"}>
                    {session.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  {session.courtCount} courts · max {session.maxPlayers} players
                </p>
              </Card>
            </Link>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Members ({group.members.length})
        </h2>
        <Card>
          <ul className="flex flex-col gap-2">
            {group.members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{member.user.displayName}</span>
                {member.role === "HOST" ? <Badge tone="amber">Host</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
