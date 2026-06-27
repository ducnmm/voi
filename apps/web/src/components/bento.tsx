import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode
} from "react";

type Tone = "sage" | "forest" | "ink" | "mint" | "sand" | "paper";

const toneBg: Record<Tone, string> = {
  sage: "bg-sage text-sage-fg",
  forest: "bg-forest text-forest-fg",
  ink: "bg-ink text-ink-fg",
  mint: "bg-mint text-mint-fg",
  sand: "bg-sand text-sand-fg",
  paper: "bg-surface text-fg"
};

/** Soft rounded bento tile — no borders, no hard shadows. */
export function Tile({
  tone = "paper",
  className = "",
  children
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-[28px] ${toneBg[tone]} ${className}`}>{children}</div>
  );
}

type PillTone = "forest" | "paper" | "sage" | "ghost";

const pillTone: Record<PillTone, string> = {
  forest: "bg-forest text-forest-fg hover:bg-forest-hover",
  paper: "bg-surface text-fg hover:bg-surface-hover",
  sage: "bg-sage text-sage-fg hover:bg-sage-hover",
  ghost: "bg-transparent text-fg hover:bg-fg/10"
};

const PILL_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function PillButton({
  tone = "forest",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: PillTone }) {
  return (
    <button className={`${PILL_BASE} ${pillTone[tone]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function PillLink({
  tone = "forest",
  className = "",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { tone?: PillTone }) {
  return (
    <a className={`${PILL_BASE} ${pillTone[tone]} ${className}`} {...props}>
      {children}
    </a>
  );
}

/** Small uppercase eyebrow label, e.g. "01 — NGƯỜI CHƠI". */
export function Label({
  className = "",
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`text-xs font-bold uppercase tracking-[0.18em] opacity-60 ${className}`}
    >
      {children}
    </span>
  );
}

/** Rounded chip for ratings / amenities. */
export function Chip({
  tone = "mint",
  className = "",
  children
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase ${toneBg[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
