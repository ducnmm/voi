"use client";
import { mediaSource } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";
export function Avatar({
  name,
  url,
  size = 38,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {url && broken !== url ? (
        <img
          src={mediaSource(url)}
          alt={name}
          onError={(event) => {
            setBroken(url);
          }}
        />
      ) : (
        name.trim().slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
export function Empty({
  icon = "court",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty card">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export const skillLabels: Record<string, string> = {
  OPEN: "Mọi trình độ",
  BEGINNER: "Mới bắt đầu",
  INTERMEDIATE: "Trung bình",
  ADVANCED: "Nâng cao",
};
export function Cover({
  images = [],
  title = "Sân cầu lông",
}: {
  images?: string[];
  title?: string;
}) {
  const { t } = useI18n();

  const [broken, setBroken] = useState<string | null>(null);
  return (
    <div className="cover">
      {images.length && broken !== images[0] ? (
        <img
          src={mediaSource(images[0]!)}
          alt={title}
          onError={(event) => {
            setBroken(images[0] ?? null);
          }}
        />
      ) : (
        <CourtArt />
      )}
    </div>
  );
}
export function CourtArt() {
  return (
    <div className="cover-placeholder">
      <svg viewBox="0 0 640 360" fill="none" aria-hidden="true">
        <path fill="#e8eaed" d="M0 0h640v360H0z" />
        <g transform="translate(320 180) rotate(-28) translate(-165 -225)">
          <path fill="#53616b" d="M0 0h330v450H0z" />
          <path
            stroke="#fff"
            strokeOpacity=".7"
            strokeWidth="2"
            d="M12 12h306v426H12zM38 12v426M292 12v426M12 160h306M12 290h306M165 12v148M165 290v148M12 225h306"
          />
          <path stroke="#fff" strokeOpacity=".4" d="M0 221h330M0 229h330" />
        </g>
        <ellipse
          cx="490"
          cy="284"
          rx="35"
          ry="8"
          fill="#0e2116"
          fillOpacity=".25"
        />
        <g transform="translate(477 205) rotate(20)">
          <path d="m0 0 23-10 16 12-22 41Z" fill="#f3f0e3" />
          <path
            d="m7-3 15 34M15-6l11 30M23-9l7 28M32-3l1 15"
            stroke="#d2d0bf"
          />
          <path d="M17 43c-8 10 4 19 11 9l5-9-10-5Z" fill="#e2dece" />
          <path d="m20 38 11 5" stroke="#b9b5a5" strokeWidth="3" />
        </g>
      </svg>
    </div>
  );
}
export function Title({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
