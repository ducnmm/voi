"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api-client";
import type { InviteDetail } from "@/lib/api-types";
import { formatSessionTime } from "@/lib/format";
import { SignInGate } from "@/components/sign-in-gate";
import { Button, Card, ErrorNote, PageHeader, Spinner } from "@/components/ui";

export default function InvitePage() {
  return (
    <SignInGate>
      <InviteView />
    </SignInGate>
  );
}

function InviteView() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getInvite(params.token)
      .then((result) => {
        if (active) setInvite(result.invite);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof ApiError ? err.message : "Invite not found.");
        }
      });
    return () => {
      active = false;
    };
  }, [params.token]);

  if (error) return <ErrorNote message={error} />;
  if (!invite) return <Spinner />;

  if (invite.session) {
    const session = invite.session;
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="You're invited" subtitle={invite.group?.name ?? undefined} />
        <Card>
          <h2 className="font-semibold">{session.title ?? session.venueName}</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {formatSessionTime(session.startsAt, session.endsAt)} · {session.venueName}
          </p>
          <p className="mt-3 text-sm">
            {session.summary.joinedPlayerCount}/{session.maxPlayers} joined ·{" "}
            {session.summary.availableSlots} open
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push(`/sessions/${session.id}`)}
          >
            View session
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Group invite" subtitle={invite.group?.name ?? undefined} />
      <Card>
        <p className="text-sm text-[var(--color-muted)]">
          This invite links to a group. Group join from the web is coming soon.
        </p>
      </Card>
    </div>
  );
}
