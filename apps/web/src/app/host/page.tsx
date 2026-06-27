"use client";

import { RequireAuth } from "@/components/require-auth";
import { CourtList } from "@/components/court-list";
import { MY_COURTS } from "@/lib/courts";

export default function HostPage() {
  return (
    <RequireAuth>
      <CourtList courts={MY_COURTS} mode="host" />
    </RequireAuth>
  );
}
