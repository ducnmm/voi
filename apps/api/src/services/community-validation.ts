import { createHash } from "node:crypto";
import type { CommunityContact } from "@voi/shared";
import { badRequest } from "../utils/api-error.js";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${canonicalJson(val)}`).join(",")}}`;
}
export function communityPayloadHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
const facebookHosts = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "mbasic.facebook.com"]);
export function normalizeCommunitySourceUrl(raw: string, groupId: string, postId: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !facebookHosts.has(url.hostname) || url.port || url.username || url.password) return null;
    const match = /^\/groups\/([0-9]+)\/(?:posts|permalink)\/([0-9]+)\/?$/.exec(url.pathname);
    if (!match || match[1] !== groupId || match[2] !== postId) return null;
    return `https://www.facebook.com/groups/${groupId}/posts/${postId}/`;
  } catch { return null; }
}
export function normalizeCommunityContact(contact: CommunityContact): CommunityContact | null {
  if (contact.type === "PHONE") {
    const value = contact.value.replace(/[\s().-]/g, "");
    return /^\+?[0-9]{8,15}$/.test(value) ? { type: contact.type, value } : null;
  }
  try {
    const url = new URL(contact.value);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
    if (contact.type === "ZALO") {
      if (url.hostname !== "zalo.me" || !/^\/[0-9]{8,15}\/?$/.test(url.pathname)) return null;
      return { type: contact.type, value: `https://zalo.me${url.pathname.replace(/\/$/, "")}` };
    }
    if (!facebookHosts.has(url.hostname) || url.pathname === "/" || /^\/(?:l\.php|login|dialog|sharer|share|flx|away)(?:\/|\.|$)/i.test(url.pathname)) return null;
    // Keep the profile id on profile.php; tracking and redirect query parameters are discarded.
    if (url.pathname === "/profile.php" && !/^\d+$/.test(url.searchParams.get("id") ?? "")) return null;
    return { type: contact.type, value: `https://www.facebook.com${url.pathname}${url.pathname === "/profile.php" ? `?id=${url.searchParams.get("id")}` : ""}` };
  } catch { return null; }
}
export function encodeCommunityCursor(at: Date, id: string, scanAt?: Date): string {
  return Buffer.from(JSON.stringify({ at: at.toISOString(), id, ...(scanAt ? { scanAt: scanAt.toISOString() } : {}) })).toString("base64url");
}
export function decodeCommunityCursor(cursor?: string): { at: Date; id: string; scanAt?: Date } | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof value.at !== "string" || typeof value.id !== "string" || !value.id || value.id.length > 128 || !Number.isFinite(Date.parse(value.at))) throw new Error();
    if (value.scanAt !== undefined && (typeof value.scanAt !== "string" || !Number.isFinite(Date.parse(value.scanAt)))) throw new Error();
    return { at: new Date(value.at), id: value.id, ...(value.scanAt ? { scanAt: new Date(value.scanAt) } : {}) };
  } catch { throw badRequest("Invalid cursor"); }
}
/** Convert a calendar date in an IANA zone to UTC bounds without depending on server locale. */
export function communityDateBounds(date: string, timeZone: string): { gte: Date; lt: Date } {
  const initial = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(initial) || new Date(initial).toISOString().slice(0, 10) !== date) throw badRequest("Invalid date");
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }); }
  catch { throw badRequest("Invalid time zone"); }
  const midnight = (utc: number) => {
    let result = utc;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(result)).map((part) => [part.type, part.value]));
      const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      result += utc - local;
    }
    return new Date(result);
  };
  return { gte: midnight(initial), lt: midnight(initial + 86400000) };
}
