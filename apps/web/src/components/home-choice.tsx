"use client";

import { Label } from "./bento";
import { BentoCard } from "./ui/bento-grid";

/** Screen 2 — two equal halves, full screen: Tìm sân / Host sân. */
export function HomeChoice() {
  return (
    <main className="h-[100dvh] w-full p-3 sm:p-4">
      <div className="grid h-full grid-cols-1 grid-rows-2 gap-3 sm:grid-cols-2 sm:grid-rows-1 sm:gap-4">
        {/* TÌM SÂN */}
        <BentoCard tone="sage" href="/find" cta="Bắt đầu">
          <Label>01 — Người chơi</Label>
          <h2 className="mt-auto text-7xl font-black uppercase leading-[0.88] tracking-tight sm:text-8xl">
            Tìm
            <br />
            sân
          </h2>
        </BentoCard>

        {/* HOST SÂN */}
        <BentoCard tone="ink" href="/host" cta="Đăng sân">
          <Label>02 — Chủ sân</Label>
          <h2 className="mt-auto text-7xl font-black uppercase leading-[0.88] tracking-tight sm:text-8xl">
            Host
            <br />
            sân
          </h2>
        </BentoCard>
      </div>
    </main>
  );
}
