import type { CSSProperties } from "react";
import { cupertinoIcons, iconEm } from "./cupertino-paths";
export type IconName =
  | "globe"
  | "info"
  | "trash"
  | "badminton"
  | "court"
  | "chat"
  | "bell"
  | "person"
  | "plus"
  | "search"
  | "filter"
  | "pin"
  | "calendar"
  | "clock"
  | "arrow"
  | "check"
  | "bookmark"
  | "people"
  | "settings"
  | "sun"
  | "logout"
  | "close"
  | "send"
  | "chevron"
  | "star"
  | "map"
  | "share"
  | "copy"
  | "photo"
  | "refresh"
  | "qr";
export function Icon({ name, size = 20, style, active = false }: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  active?: boolean;
}) {
  const glyph = cupertinoIcons[name];
  const path = active && glyph.paths.length > 1 ? glyph.paths[1] : glyph.paths[0];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${iconEm} ${iconEm}`}
      fill="currentColor" style={style} aria-hidden="true" focusable="false"
      data-icon={name} data-icon-set="cupertino" data-symbol={glyph.symbol}>
      <path d={path} transform={`translate(${(iconEm - glyph.width) / 2} 448) scale(1 -1)`} />
    </svg>
  );
}
