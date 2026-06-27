"use client";

import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { CourtDetail } from "@/components/court-detail";
import { findCourt } from "@/lib/courts";
import { PillLink } from "@/components/bento";

export default function HostCourtPage() {
  const { courtId } = useParams<{ courtId: string }>();
  const court = findCourt(courtId);

  return (
    <RequireAuth>
      {court ? (
        <CourtDetail court={court} mode="host" />
      ) : (
        <main className="grid min-h-[100dvh] place-items-center gap-4 p-6 text-center">
          <div>
            <p className="text-2xl font-black uppercase">Không tìm thấy sân</p>
            <PillLink href="/host" tone="forest" className="mt-4">
              ← Về danh sách
            </PillLink>
          </div>
        </main>
      )}
    </RequireAuth>
  );
}
