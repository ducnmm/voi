import type { CommunityListingDTO } from "@voi/shared";

type Translate = (text: string, values?: unknown[]) => string;

export const communitySkillLabels: Record<CommunityListingDTO["skillLevel"], string> = {
  OPEN: "Mọi trình độ",
  BEGINNER: "Mới bắt đầu",
  INTERMEDIATE: "Trung bình",
  ADVANCED: "Nâng cao",
  UNKNOWN: "Chưa rõ trình độ",
};

export const communityStatusLabels: Record<CommunityListingDTO["effectiveStatus"], string> = {
  OPEN: "Liên hệ xác nhận",
  FULL: "Đã đủ người",
  CANCELLED: "Đã hủy",
  EXPIRED: "Đã qua giờ bắt đầu",
  UNAVAILABLE: "Không còn hiển thị",
};

/** Only source-owned contact destinations are rendered as actionable links. */
export function communityContactHref(contact: CommunityListingDTO["contacts"][number]): string | null {
  if (contact.type === "PHONE") {
    const phone = contact.value.replace(/[\s().-]/g, "");
    return /^\+?\d{8,15}$/.test(phone) ? `tel:${phone}` : null;
  }
  if (contact.type === "ZALO" && /^\+?\d{8,15}$/.test(contact.value))
    return `https://zalo.me/${contact.value.replace(/^\+/, "")}`;
  return communitySourceHref(contact.value, contact.type === "ZALO" ? ["zalo.me", "www.zalo.me"] : undefined);
}

export function communitySourceHref(value: string, hosts = ["facebook.com", "www.facebook.com", "m.facebook.com", "mbasic.facebook.com"]): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && hosts.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function communityFee(listing: Pick<CommunityListingDTO, "feeVnd" | "feeBasis" | "feeText">, locale: string, t: Translate): string {
  if (listing.feeVnd === null) return listing.feeText || t("Chưa rõ phí");
  const amount = new Intl.NumberFormat(locale, { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(listing.feeVnd);
  const templates = { PER_PERSON: "{0}/người", PER_HOUR: "{0}/giờ", TOTAL: "{0} tổng phí" };
  if (listing.feeBasis in templates)
    return t(templates[listing.feeBasis as keyof typeof templates], [amount]);
  return listing.feeText || t("{0} · Chưa rõ cách tính", [amount]);
}

export function communityDate(value: string, timeZone: string, locale: string, withTime = false): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : { weekday: "short" as const }),
  }).format(new Date(value));
}

export function communityTime(listing: Pick<CommunityListingDTO, "startsAt" | "endsAt" | "timeZone">, locale: string, t: Translate): string {
  if (!listing.startsAt) return t("Chưa rõ giờ");
  const time = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: listing.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
  const start = time(listing.startsAt);
  if (!listing.endsAt) return t("Từ {0} · Chưa rõ giờ kết thúc", [start]);
  const sameDay = communityDate(listing.startsAt, listing.timeZone, locale) === communityDate(listing.endsAt, listing.timeZone, locale);
  return `${start} – ${time(listing.endsAt)}${sameDay ? "" : ` (${communityDate(listing.endsAt, listing.timeZone, locale)})`}`;
}
