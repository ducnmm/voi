import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// Vendored + adapted from Magic UI's <BentoGrid> / <BentoCard>
// (https://magicui.design/docs/components/bento-grid). Reworked for Tailwind v4
// and the Voi green/cream palette, with no external dependencies.

type Tone = "sage" | "forest" | "ink" | "mint" | "sand" | "paper";

const toneClass: Record<Tone, string> = {
  sage: "bg-sage text-sage-fg",
  forest: "bg-forest text-forest-fg",
  ink: "bg-ink text-ink-fg",
  mint: "bg-mint text-mint-fg",
  sand: "bg-sand text-sand-fg",
  paper: "bg-surface text-fg"
};

export function BentoGrid({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoCard({
  tone = "paper",
  className,
  href,
  cta,
  children
}: {
  tone?: Tone;
  className?: string;
  href?: string;
  cta?: string;
  children: ReactNode;
}) {
  const interactive =
    "cursor-pointer hover:-translate-y-1 hover:shadow-[0_20px_45px_-20px_rgba(31,61,43,0.55)]";

  const card = (
    <div
      className={cn(
        "group relative flex h-full flex-col justify-between overflow-hidden rounded-[24px] p-6 transition-all duration-300 sm:p-7",
        toneClass[tone],
        href && interactive,
        className
      )}
    >
      {/* content shifts up on hover to reveal the CTA, like Magic UI */}
      <div
        className={cn(
          "flex h-full flex-col",
          cta && href && "transition-transform duration-300 group-hover:-translate-y-3"
        )}
      >
        {children}
      </div>

      {cta && href ? (
        <span className="pointer-events-none absolute bottom-5 left-6 flex translate-y-6 items-center gap-1 text-sm font-bold uppercase tracking-wide opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          {cta} →
        </span>
      ) : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  );
}
