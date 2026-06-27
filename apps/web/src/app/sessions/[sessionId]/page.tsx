"use client";

import { useParams } from "next/navigation";
import { SignInGate } from "@/components/sign-in-gate";
import { SessionView } from "@/components/session-view";

export default function SessionPage() {
  return (
    <SignInGate>
      <SessionRoute />
    </SignInGate>
  );
}

function SessionRoute() {
  const params = useParams<{ sessionId: string }>();
  return <SessionView sessionId={params.sessionId} />;
}
