"use client";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { SessionForm } from "@/components/session-form";
export default function NewSessionPage() {
  const { groupId } = useParams<{ groupId: string }>();
  return (
    <RequireAuth>
      <SessionForm groupId={groupId} />
    </RequireAuth>
  );
}
