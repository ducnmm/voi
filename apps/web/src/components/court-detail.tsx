"use client";

import { useState } from "react";
import Link from "next/link";
import type { CourtListing } from "@/lib/courts";
import { formatVnd } from "@/lib/courts";
import { Chip, Label, PillButton } from "./bento";

const imageBg: Record<CourtListing["tone"], string> = {
  acid: "bg-tint-acid",
  sun: "bg-tint-sun",
  bubble: "bg-tint-bubble",
  sky: "bg-tint-sky"
};

// Decorative gallery thumbnails — soft tints cycled under the court emoji.
const thumbBg = ["bg-tint-sun", "bg-tint-sky", "bg-tint-bubble"];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line/10 py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      <span className="text-right text-sm font-bold">{value}</span>
    </div>
  );
}

/**
 * Full-screen detail, split into two equal halves: image (left) / info + action
 * (right). Stacks vertically on mobile. `mode` switches the primary action
 * between booking (find) and managing the listing (host).
 */
export function CourtDetail({
  court,
  mode
}: {
  court: CourtListing;
  mode: "find" | "host";
}) {
  const [done, setDone] = useState(false);
  const backHref = mode === "find" ? "/find" : "/host";

  return (
    <main className="w-full p-3 sm:p-4 lg:h-[100dvh]">
      <div className="grid h-full min-h-[calc(100dvh-2rem)] grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr] sm:gap-4">
        {/* GALLERY — main image + thumbnail strip */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className={`relative grid min-h-[36dvh] flex-1 place-items-center overflow-hidden rounded-[28px] ${imageBg[court.tone]}`}>
            <Link
              href={backHref}
              aria-label="Quay lại"
              className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-surface text-lg font-bold text-fg shadow-sm transition-transform active:scale-95"
            >
              ←
            </Link>
            {court.boosted ? (
              <span className="absolute right-4 top-4">
                <Chip tone="forest">★ Được đẩy</Chip>
              </span>
            ) : null}
            <span className="text-[9rem] leading-none">{court.emoji}</span>
          </div>

          {/* thumbnails */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {thumbBg.map((bg, i) => (
              <div
                key={i}
                className={`grid h-20 place-items-center rounded-[20px] sm:h-24 ${bg}`}
              >
                <span className="text-3xl opacity-80 sm:text-4xl">{court.emoji}</span>
              </div>
            ))}
          </div>
        </div>

        {/* INFO — nội dung */}
        <div className="flex flex-col overflow-y-auto rounded-[28px] bg-surface p-6 md:p-9">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-black uppercase leading-tight">{court.name}</h1>
            <Chip tone="mint">★ {court.rating.toFixed(1)}</Chip>
          </div>
          <p className="mt-2 text-sm font-bold text-muted">📍 {court.address}</p>

          <div className="mt-5 inline-flex w-fit items-baseline gap-1 rounded-full bg-mint px-5 py-2.5">
            <span className="text-2xl font-black text-fg">
              {formatVnd(court.pricePerHour)}
            </span>
            <span className="text-sm font-bold text-fg/70">/giờ</span>
          </div>

          <div className="mt-6">
            <InfoRow label="Khu vực" value={court.district} />
            <InfoRow label="Số sân" value={`${court.courtCount} sân`} />
            <InfoRow label="Giờ mở cửa" value={court.openHours} />
            <InfoRow label="Đánh giá" value={`${court.rating} (${court.ratingCount} lượt)`} />
            {mode === "find" ? (
              <InfoRow label="Khoảng cách" value={`${court.distanceKm} km`} />
            ) : null}
            {mode === "host" && court.bookingsThisWeek != null ? (
              <InfoRow label="Lượt đặt tuần này" value={`${court.bookingsThisWeek} lượt`} />
            ) : null}
          </div>

          <div className="mt-5">
            <Label>Tiện ích</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {court.amenities.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold uppercase text-fg"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>

          {/* primary action */}
          <div className="mt-auto pt-8">
            {mode === "find" ? (
              <PillButton
                tone={done ? "sage" : "forest"}
                onClick={() => setDone(true)}
                className="w-full py-4 text-base"
              >
                {done ? "✓ Đã gửi đăng ký" : "Đăng ký sân này"}
              </PillButton>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <PillButton tone="forest" className="flex-1 py-4 text-base">
                  Chỉnh sửa tin
                </PillButton>
                <PillButton tone="sage" className="flex-1 py-4 text-base">
                  ★ Đẩy lên top
                </PillButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
