"use client";

import { RequireAuth } from "@/components/require-auth";
import { CourtList } from "@/components/court-list";
import { FIND_COURTS } from "@/lib/courts";

export default function FindPage() {
  return (
    <RequireAuth>
      <CourtList courts={FIND_COURTS} mode="find" />
    </RequireAuth>
  );
}
