import type { Prisma, Venue, VenueAlias, VenueExternalRef } from "@prisma/client";
import type { VenueDTO } from "@voi/shared";
import { badRequest } from "../utils/api-error.js";

export const VENUE_RESOLVER_VERSION = "venue-alias-v1.0";
export type VenueWithRefs = Venue & { externalRefs?: VenueExternalRef[]; aliases?: VenueAlias[] };
export function normalizeVenueToken(text: string | null | undefined): string {
  return (text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g,"D")
    .toLowerCase().replace(/\bthe\s*b\b/g,"theb").replace(/^(?:san\s+)?cau\s+long\s+|^san\s+/g,"")
    .replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
export function normalizeMapsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (["www.google.com","google.com","maps.google.com"].includes(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname)) return url.href;
    if (url.hostname === "maps.app.goo.gl" && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return url.href;
  } catch { /* A source URL is never fetched by this resolver. */ }
  return null;
}
export function venueSearchUrl(name: string | null, address: string | null, areaCode?: string | null): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name,address,areaCode].filter(Boolean).join(", "))}`;
}
export function presentVenue(venue: VenueWithRefs, now = new Date()): VenueDTO {
  const valid = venue.status === "VERIFIED" && venue.latitude !== null && venue.longitude !== null && Boolean(venue.locationVerifiedAt)
    && ["OWNER","MANUAL","OSM_LICENSED"].includes(venue.locationSource??"") && (!venue.locationExpiresAt || venue.locationExpiresAt > now);
  const google = venue.externalRefs?.find((ref)=>ref.provider === "GOOGLE" && (!ref.expiresAt || ref.expiresAt > now));
  const mapsUrl = google ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([venue.name,venue.address].filter(Boolean).join(", "))}&query_place_id=${encodeURIComponent(google.placeId)}` : venueSearchUrl(venue.name,venue.address,venue.areaCode);
  return {id:venue.id,name:venue.name,address:venue.address,areaCode:venue.areaCode,latitude:valid?venue.latitude:null,longitude:valid?venue.longitude:null,mapsUrl,locationVerified:valid,status:venue.status};
}
type Db = Prisma.TransactionClient;
type VenueInput = {venueName:string|null;venueAddress:string|null;areaCode:string|null;sourceId?:string;venueId?:string|null};
export async function resolveVenue(db:Db,input:VenueInput) {
  const name = normalizeVenueToken(input.venueName), address=normalizeVenueToken(input.venueAddress);
  if (!name) return {status:"UNRESOLVED",venueId:null,candidateIds:[] as string[]};
  const aliases = await db.venueAlias.findMany({where:{normalizedName:name,areaCode:input.areaCode??"",OR:[{sourceId:""},...(input.sourceId?[{sourceId:input.sourceId}]:[])],venue:{status:"VERIFIED"}},include:{venue:true}});
  const matching = aliases.filter(alias=>alias.normalizedAddress ? Boolean(address)&&address===alias.normalizedAddress : !address||!alias.venue.address||normalizeVenueToken(alias.venue.address)===address);
  const ids=[...new Set(matching.map(alias=>alias.venueId))];
  if (input.venueId) {
    if (!ids.includes(input.venueId)) throw badRequest("Venue proposal does not match a verified name, address and area");
    return {status:"MATCHED",venueId:input.venueId,candidateIds:[] as string[]};
  }
  if(ids.length===1) return {status:"MATCHED",venueId:ids[0]!,candidateIds:[] as string[]};
  const candidates=[...new Set((ids.length?matching:aliases).map(alias=>alias.venueId))];
  return {status:candidates.length>1?"AMBIGUOUS":candidates.length?"SUGGESTED":"UNRESOLVED",venueId:null,candidateIds:candidates};
}

export async function selectedNativeVenue(db:Db,id:string|null|undefined) {
  if (!id) return null;
  const venue=await db.venue.findFirst({where:{id,status:"VERIFIED"},include:{externalRefs:true}});
  if(!venue) throw badRequest("Select an existing verified venue");
  return venue;
}
