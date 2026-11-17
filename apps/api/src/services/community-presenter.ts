import type { CommunityArea, CommunityListing, CommunitySource } from "@prisma/client";
import type { CommunityContact, CommunityEffectiveStatus, CommunityListingDTO } from "@voi/shared";
import { env } from "../config/env.js";
export type CommunityListingWithSource = CommunityListing & { source: CommunitySource; area?: CommunityArea | null };
export function communityEffectiveStatus(listing: Pick<CommunityListing, "publicationStatus" | "sourceStatus" | "startsAt">, now = new Date()): CommunityEffectiveStatus {
  if (listing.publicationStatus !== "PUBLISHED" || listing.sourceStatus === "DELETED") return "UNAVAILABLE";
  if (listing.sourceStatus === "CANCELLED") return "CANCELLED";
  if (listing.sourceStatus === "FULL") return "FULL";
  if (!listing.startsAt || listing.startsAt <= now) return "EXPIRED";
  return "OPEN";
}
export function communityPublicUrl(listing: Pick<CommunityListing, "id" | "publicationStatus" | "sourceStatus">, sourcePublic: boolean): string | null {
  if (!env.COMMUNITY_LISTINGS_PUBLIC_ENABLED || !sourcePublic || listing.publicationStatus !== "PUBLISHED" || listing.sourceStatus === "DELETED") return null;
  const origin = env.COMMUNITY_LISTINGS_WEB_ORIGIN ?? (env.NODE_ENV !== "production" ? "http://localhost:43188" : undefined);
  return origin ? `${new URL(origin).origin}/community-listings/${encodeURIComponent(listing.id)}` : null;
}
/** Explicit anonymous allowlist; never spread a database record into this response. */
export function presentCommunityListing(row: CommunityListingWithSource, now = new Date()): CommunityListingDTO {
  return {
    id: row.id, title: row.title ?? "", description: row.description,
    startsAt: row.startsAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null, timeZone: row.timeZone,
    venueName: row.venueName, venueAddress: row.venueAddress, areaCode: row.areaCode, areaLabel: row.area?.label ?? null,
    skillLevel: row.skillLevel, skillText: row.skillText, feeVnd: row.feeVnd, feeBasis: row.feeBasis, feeText: row.feeText,
    requestedPlayers: row.requestedPlayers, organizerName: row.organizerName, contacts: row.contacts as CommunityContact[],
    source: { id: row.source.id, name: row.source.name, platform: row.source.platform, url: row.source.url },
    sourceUrl: row.sourceUrl, sourcePostedAt: row.sourcePostedAt?.toISOString() ?? null,
    lastVerifiedAt: row.lastVerifiedAt.toISOString(), effectiveStatus: communityEffectiveStatus(row, now),
    stale: now.getTime() - row.lastVerifiedAt.getTime() > env.COMMUNITY_LISTINGS_STALE_HOURS * 3600000
  };
}
export function presentIntegrationListing(row: CommunityListingWithSource, now = new Date()) {
  return {
    id: row.id, sourceId: row.sourceId, sourcePostId: row.sourcePostId, sourceUrl: row.sourceUrl,
    publicationStatus: row.publicationStatus, sourceStatus: row.sourceStatus, effectiveStatus: communityEffectiveStatus(row, now),
    startsAt: row.startsAt?.toISOString() ?? null, observedAt: row.observedAt.toISOString(),
    sourceUpdatedAt: row.sourceUpdatedAt?.toISOString() ?? null, firstSeenAt: row.firstSeenAt.toISOString(),
    lastVerifiedAt: row.lastVerifiedAt.toISOString(), version: row.version,
    reviewReasons: row.reviewReasons, publicUrl: communityPublicUrl(row, row.source.publicEnabled)
  };
}
