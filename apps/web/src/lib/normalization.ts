import { formatSkillRequirements } from "@voi/shared";
import type { CommunityListingDTO, VenueDTO } from "@voi/shared";

export type VenueSummary = VenueDTO;

export interface SkillCatalog {
  scale: { code: string; version: string | number };
  ranks: { code: string; label: string; order: number }[];
}

export interface CommunityNormalizationFilters {
  audience: string;
  rank: string;
  includeUnknown: boolean;
  venueId: string;
}

export const emptyNormalizationFilters: CommunityNormalizationFilters = {
  audience: "", rank: "", includeUnknown: false, venueId: "",
};

export function normalizationQuery(filters: CommunityNormalizationFilters): Record<string, string> {
  return {
    ...(filters.audience ? { audience: filters.audience } : {}),
    ...(filters.rank ? { rank: filters.rank, includeUnknown: String(filters.includeUnknown) } : {}),
    ...(filters.venueId ? { venueId: filters.venueId } : {}),
  };
}

type Translate = (text: string, values?: unknown[]) => string;

export function normalizedSkillLabel(listing: Pick<CommunityListingDTO, "skillNormalization">, t: Translate): string | null {
  if (!listing.skillNormalization) return null;
  return formatSkillRequirements(listing.skillNormalization, {
    audienceLabels: { ALL: t("Chung"), MALE: t("Nam"), FEMALE: t("Nữ") },
    unrestrictedLabel: t("Mọi trình độ"), unknownLabel: t("Chưa rõ trình độ"),
    fromLabel: t("Từ"), toLabel: t("Đến"),
  });
}

export function validVenueCoordinate(venue: VenueSummary | null | undefined): venue is VenueSummary & { latitude: number; longitude: number } {
  return Boolean(venue?.locationVerified && venue.latitude !== null && venue.longitude !== null &&
    Number.isFinite(venue.latitude) && Number.isFinite(venue.longitude) &&
    Math.abs(venue.latitude) <= 90 && Math.abs(venue.longitude) <= 180);
}

export function sessionMapCoordinate(session: { venue?: VenueSummary | null; venueLat: number | null; venueLng: number | null }): { lat: number; lng: number } | null {
  if (session.venue) return validVenueCoordinate(session.venue) ? { lat: session.venue.latitude, lng: session.venue.longitude } : null;
  const { venueLat: lat, venueLng: lng } = session;
  return lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Search links remain search links; they do not imply a verified place or pin. */
export function venueMapsHref(venue: VenueSummary | null | undefined, name: string | null, address?: string | null, area?: string | null): string | null {
  if (venue?.mapsUrl) {
    try {
      const url = new URL(venue.mapsUrl);
      if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
        ((["www.google.com", "google.com", "maps.google.com"].includes(url.hostname) && url.pathname.startsWith("/maps")) || url.hostname === "maps.app.goo.gl")) return url.href;
    } catch { /* Fall through to the source search. */ }
  }
  const query = [venue?.name || name, venue?.address || address, area].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

export function sessionMapsHref(session: { venue?: VenueSummary | null; venueName: string; venueLat: number | null; venueLng: number | null }): string | null {
  const location = sessionMapCoordinate(session);
  return venueMapsHref(session.venue, !session.venue && location ? `${location.lat},${location.lng}` : session.venueName);
}
