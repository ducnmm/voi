"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { CourtListing } from "@/lib/courts";
import { formatVnd } from "@/lib/courts";
import { Chip, Label, PillButton } from "./bento";

// Map the listing's accent key onto the soft green bento palette.
const imageBg: Record<CourtListing["tone"], string> = {
  acid: "bg-tint-acid",
  sun: "bg-tint-sun",
  bubble: "bg-tint-bubble",
  sky: "bg-tint-sky"
};

// Eased curve reused for every animation on this screen.
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type TileSize = "lg" | "md" | "sm";

// Repeating mosaic recipe. `grid-auto-flow: dense` packs the varied spans into
// a tidy bento regardless of how many courts come back; boosted courts override
// to the large square so the best listings read biggest.
const LAYOUT: { span: string; size: TileSize }[] = [
  { span: "sm:col-span-2 sm:row-span-2", size: "lg" },
  { span: "sm:row-span-2", size: "md" },
  { span: "sm:col-span-2", size: "md" },
  { span: "", size: "sm" },
  { span: "sm:col-span-2", size: "md" },
  { span: "", size: "sm" },
  { span: "sm:row-span-2", size: "md" },
  { span: "", size: "sm" }
];

const BIG = { span: "sm:col-span-2 sm:row-span-2", size: "lg" as TileSize };

const emojiSize: Record<TileSize, string> = {
  lg: "text-7xl sm:text-8xl",
  md: "text-5xl sm:text-6xl",
  sm: "text-4xl"
};

function CourtMeta({
  court,
  mode,
  size
}: {
  court: CourtListing;
  mode: "find" | "host";
  size: TileSize;
}) {
  // Small tiles only have room for name + price + rating.
  if (size === "sm") {
    return (
      <>
        <h3 className="truncate text-sm font-black uppercase leading-tight">
          {court.name}
        </h3>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-sm font-black text-leaf">
            {formatVnd(court.pricePerHour)}
            <span className="text-xs font-bold text-muted">/giờ</span>
          </span>
          <span className="shrink-0 text-xs font-bold text-muted">
            ★ {court.rating.toFixed(1)}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3
          className={
            size === "lg"
              ? "text-2xl font-black uppercase leading-tight sm:text-3xl"
              : "text-lg font-black uppercase leading-tight"
          }
        >
          {court.name}
        </h3>
        <span className="shrink-0 pt-1 text-sm font-bold text-muted">
          ★ {court.rating.toFixed(1)}
        </span>
      </div>
      <p className="mt-1 text-sm font-bold text-muted">
        📍 {court.district}
        {mode === "find" ? ` · ${court.distanceKm} km` : ""}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-base font-black text-leaf sm:text-lg">
          {formatVnd(court.pricePerHour)}
          <span className="text-xs font-bold text-muted">/giờ</span>
        </span>
        <Chip tone="mint">{court.courtCount} sân</Chip>
      </div>
      {mode === "host" && court.status ? (
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
          {court.status}
        </p>
      ) : null}
    </>
  );
}

function CourtTile({
  court,
  mode,
  size
}: {
  court: CourtListing;
  mode: "find" | "host";
  size: TileSize;
}) {
  return (
    <Link href={`/${mode}/${court.id}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-22px_rgba(31,61,43,0.45)]">
        {/* ảnh — để sạch, không chip đè */}
        <div className={`grid min-h-0 flex-1 place-items-center ${imageBg[court.tone]}`}>
          <span className={emojiSize[size]}>{court.emoji}</span>
        </div>
        {/* chữ ở dưới ảnh */}
        <div className={size === "sm" ? "p-3" : "p-4"}>
          <CourtMeta court={court} mode={mode} size={size} />
        </div>
      </div>
    </Link>
  );
}

export function CourtList({
  courts,
  mode
}: {
  courts: CourtListing[];
  mode: "find" | "host";
}) {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <main className="w-full px-3 py-4 sm:px-4 sm:py-5">
      {/* host: add-listing CTA */}
      {mode === "host" ? (
        <div className="mb-3 sm:mb-4">
          <PillButton tone="forest" className="w-full sm:w-auto">
            + Đăng tin sân mới
          </PillButton>
        </div>
      ) : null}

      {/* bento — lưới ô nhiều cỡ */}
      <div className="grid auto-rows-[9rem] grid-cols-2 gap-3 [grid-auto-flow:dense] sm:auto-rows-[10.5rem] sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {/* ô lọc — nằm trong lưới, bấm để thả panel xuống */}
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="relative z-30"
        >
          <button
            onClick={() => setFilterOpen((v) => !v)}
            aria-label="Bộ lọc"
            aria-expanded={filterOpen}
            className={`flex h-full w-full flex-col justify-between rounded-2xl p-4 text-left transition-transform hover:-translate-y-1 sm:p-5 ${
              filterOpen ? "bg-forest text-forest-fg" : "bg-surface text-fg"
            }`}
          >
            <span
              className={`grid h-10 w-10 place-items-center rounded-full ${
                filterOpen ? "bg-forest-fg/15" : "bg-surface-2"
              }`}
            >
              {/* funnel icon */}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </span>
            <span className="mt-auto text-lg font-black uppercase tracking-tight">Lọc</span>
          </button>

          {/* panel lọc — thả xuống ngay dưới ô */}
          <AnimatePresence initial={false}>
            {filterOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="absolute left-0 top-full z-50 mt-2 w-[min(20rem,80vw)] origin-top-left"
              >
                <div className="rounded-2xl bg-surface p-5 text-fg shadow-xl">
                  <Label>Bộ lọc (đang phát triển)</Label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Gần tôi", "Dưới 100k", "Còn trống", "Có máy lạnh", "≥ 4 sân"].map((f) => (
                      <span
                        key={f}
                        className="cursor-pointer rounded-full bg-surface-2 px-3 py-1 text-xs font-bold uppercase text-fg transition-colors hover:bg-mint"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>

        {courts.map((court, i) => {
          const { span, size } = court.boosted
            ? BIG
            : LAYOUT[i % LAYOUT.length] ?? BIG;
          return (
            <motion.div
              key={court.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                layout: { duration: 0.4, ease: EASE },
                duration: 0.3,
                delay: i * 0.04
              }}
              className={span}
            >
              <CourtTile court={court} mode={mode} size={size} />
            </motion.div>
          );
        })}
      </div>
    </main>
  );
}
