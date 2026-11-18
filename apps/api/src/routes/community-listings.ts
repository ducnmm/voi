import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { CommunityBatchSchema, CommunityFeedQuerySchema, CommunityRecheckQuerySchema, CommunityReportSchema, SKILL_RANKS, SKILL_SCALE_CODE, SKILL_NORMALIZATION_VERSION } from "@voi/shared";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { communityRateLimit, COMMUNITY_READ_SCOPE, COMMUNITY_WRITE_SCOPE, requireIntegrationScope } from "../plugins/integration-auth.js";
import { ingestCommunityBatch } from "../services/community-ingest.js";
import { presentCommunityListing, presentIntegrationListing } from "../services/community-presenter.js";
import { communityDateBounds, decodeCommunityCursor, encodeCommunityCursor } from "../services/community-validation.js";
import { ApiError, forbidden, notFound } from "../utils/api-error.js";
import { badRequest } from "../utils/api-error.js";
import { normalizationInclude } from "../services/community-normalization.js";
import { presentVenue, normalizeVenueToken } from "../services/venue-catalog.js";

const skillCatalog=()=>({scale:{code:SKILL_SCALE_CODE,version:SKILL_NORMALIZATION_VERSION},ranks:SKILL_RANKS});
function skillWhere(audience:string,rankCode:string,includeUnknown:boolean):Prisma.CommunityListingWhereInput {
  const rank=SKILL_RANKS.find(r=>r.code===rankCode);
  if(!rank)throw badRequest("Unknown skill rank");
  const bounded:Prisma.CommunitySkillRequirementWhereInput={OR:[{mode:"UNRESTRICTED"},{mode:"RANGE",AND:[{OR:[{minRank:null},{minimum:{order:{lt:rank.order}}},{minRank:rank.code,minInclusive:true}]},{OR:[{maxRank:null},{maximum:{order:{gt:rank.order}}},{maxRank:rank.code,maxInclusive:true}]}]},...(includeUnknown?[{mode:"UNKNOWN"}]:[])]};
  if(audience==="ALL")return {OR:[{skillRequirements:{some:bounded}},...(includeUnknown?[{skillRequirements:{none:{}}}]:[])]};
  return {OR:[{skillRequirements:{some:{...bounded,audience}}},{AND:[{skillRequirements:{none:{audience}}},{skillRequirements:{some:{...bounded,audience:"ALL"}}}]},...(includeUnknown?[{skillRequirements:{none:{audience:{in:[audience,"ALL"]}}}}]:[])]};
}

function publicEnabled(): void {
  if (!env.COMMUNITY_LISTINGS_PUBLIC_ENABLED) throw notFound();
}
const publicWhere: Prisma.CommunityListingWhereInput = {
  publicationStatus: "PUBLISHED", sourceStatus: { not: "DELETED" }, anonymizedAt: null, source: { publicEnabled: true }
};
export async function communityListingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/community-listings/skills",async()=>{publicEnabled();return skillCatalog();});
  app.get("/venues",async request=>{
    publicEnabled();
    const query=z.object({q:z.string().max(120).optional(),areaCode:z.string().max(80).optional(),limit:z.coerce.number().int().min(1).max(100).default(30)}).strict().parse(request.query);
    const venues=await prisma.venue.findMany({where:{status:"VERIFIED",...(query.areaCode?{areaCode:query.areaCode}:{}),...(query.q?{OR:[{name:{contains:query.q,mode:"insensitive"}},{aliases:{some:{name:{contains:query.q,mode:"insensitive"}}}},{aliases:{some:{normalizedName:{contains:normalizeVenueToken(query.q)}}}}]}:{})},include:{externalRefs:true},orderBy:[{name:"asc"},{id:"asc"}],take:query.limit});
    return{venues:venues.map(venue=>presentVenue(venue))};
  });
  app.get("/integrations/community-listings/catalog",{onRequest:app.authenticateIntegration},async(request,reply)=>{
    const client=requireIntegrationScope(request,COMMUNITY_READ_SCOPE);await communityRateLimit(`rl:community:read:${client.id}`,120,60,reply);
    const venues=await prisma.venue.findMany({where:{status:"VERIFIED"},include:{externalRefs:true},orderBy:[{name:"asc"},{id:"asc"}],take:1000});
    return{...skillCatalog(),venues:venues.map(venue=>presentVenue(venue))};
  });
  app.get("/community-listings/statistics",async()=>{
    publicEnabled();const where:Prisma.CommunityListingWhereInput={AND:[publicWhere,{startsAt:{gt:new Date()},sourceStatus:{in:["RECRUITING","UNKNOWN"]}}]};
    const [total,skills,venueMatches,venues]=await Promise.all([prisma.communityListing.count({where}),prisma.communityListing.groupBy({by:["skillNormalizationStatus"],where,_count:true}),prisma.communityListing.count({where:{AND:[where,{venueId:{not:null}}]}}),prisma.communityListing.groupBy({by:["venueId"],where:{AND:[where,{venueId:{not:null}}]}})]);
    const skillDemand=await Promise.all((["ALL","MALE","FEMALE"] as const).flatMap(audience=>SKILL_RANKS.map(async rank=>({audience,rank:rank.code,count:await prisma.communityListing.count({where:{AND:[where,skillWhere(audience,rank.code,false),...(audience==="MALE"?[{skillRecruitmentAudience:{not:"FEMALE_ONLY"}}]:audience==="FEMALE"?[{skillRecruitmentAudience:{not:"MALE_ONLY"}}]:[])]}})}))));
    return{totalPosts:total,skillCoverage:skills.map(r=>({status:r.skillNormalizationStatus,count:r._count})),skillDemand,venueMatchedPosts:venueMatches,distinctVenues:venues.length,countingUnit:"SOURCE_POST"};
  });
  app.post("/integrations/community-listings/batch", { bodyLimit: 1024 * 1024, onRequest: app.authenticateIntegration }, async (request, reply) => {
    if (!env.COMMUNITY_LISTINGS_INGEST_ENABLED) throw forbidden("Community ingest is disabled");
    const batch = CommunityBatchSchema.parse(request.body);
    const sourceIds = [...new Set(batch.items.flatMap((item) => item && typeof item === "object" && "sourceId" in item && typeof item.sourceId === "string" ? [item.sourceId] : []))];
    const client = requireIntegrationScope(request, COMMUNITY_WRITE_SCOPE, sourceIds);
    // Validate the entire source scope before any per-item transaction can mutate state.
    const permitted = await prisma.communitySource.count({ where: { id: { in: sourceIds }, ingestEnabled: true } });
    if (permitted !== sourceIds.length) throw forbidden("One or more sources are unavailable for ingest");
    await communityRateLimit(`rl:community:batch:${client.id}`, 30, 60, reply);
    const results = await ingestCommunityBatch(client, batch);
    request.log.info({ runId: batch.runId, schemaVersion: batch.schemaVersion, clientId: client.id, outcomes: results.map((r) => ({ operationId: r.operationId, listingId: r.listingId, outcome: r.outcome, codes: r.errors.map((e) => e.code) })) }, "Community ingest batch complete");
    return { runId: batch.runId, dryRun: batch.dryRun, results };
  });
  app.get("/integrations/community-listings", { onRequest: app.authenticateIntegration }, async (request, reply) => {
    const query = CommunityRecheckQuerySchema.parse(request.query);
    const client = requireIntegrationScope(request, COMMUNITY_READ_SCOPE, [query.sourceId]);
    await communityRateLimit(`rl:community:read:${client.id}`, 120, 60, reply);
    const now = new Date();
    const cursor = decodeCommunityCursor(query.cursor);
    const scanAt = cursor?.scanAt ?? now;
    const conditions: Prisma.CommunityListingWhereInput[] = [{ sourceId: query.sourceId, receivedAt: { lte: scanAt } }];
    if (query.needsRecheck === "true") conditions.push({
      publicationStatus: { not: "SUPPRESSED" }, sourceStatus: { not: "DELETED" }, anonymizedAt: null,
      OR: [{ startsAt: { gt: now } }, { publicationStatus: "NEEDS_REVIEW", startsAt: null, firstSeenAt: { gte: new Date(now.getTime() - 7 * 86400000) } }]
    });
    if (cursor) conditions.push({ OR: [{ lastVerifiedAt: { gt: cursor.at } }, { lastVerifiedAt: cursor.at, id: { gt: cursor.id } }] });
    const rows = await prisma.communityListing.findMany({ where: { AND: conditions }, include: normalizationInclude, orderBy: [{ lastVerifiedAt: "asc" }, { id: "asc" }], take: query.limit + 1 });
    const more = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return { listings: page.map((row) => presentIntegrationListing(row, now)), nextCursor: more && last ? encodeCommunityCursor(last.lastVerifiedAt, last.id, scanAt) : null };
  });
  app.get("/integrations/community-listings/:id", { onRequest: app.authenticateIntegration }, async (request, reply) => {
    const client = requireIntegrationScope(request, COMMUNITY_READ_SCOPE);
    await communityRateLimit(`rl:community:read:${client.id}`, 120, 60, reply);
    const { id } = request.params as { id: string };
    const row = await prisma.communityListing.findFirst({ where: { id, sourceId: { in: client.sourceIds } }, include: normalizationInclude });
    if (!row) throw notFound("Listing not found");
    return { listing: presentIntegrationListing(row) };
  });
  app.get("/community-listings/areas", async () => {
    publicEnabled();
    return { areas: await prisma.communityArea.findMany({ where: { enabled: true }, select: { code: true, label: true }, orderBy: { label: "asc" } }) };
  });
  app.get("/community-listings", async (request) => {
    publicEnabled();
    const query = CommunityFeedQuerySchema.parse(request.query);
    const cursor = decodeCommunityCursor(query.cursor);
    const now = new Date();
    const conditions: Prisma.CommunityListingWhereInput[] = [publicWhere, { startsAt: { gt: now }, sourceStatus: { in: ["RECRUITING", "UNKNOWN"] } }];
    if (query.areaCode) conditions.push({ areaCode: query.areaCode });
    if (query.skillLevel) conditions.push({ skillLevel: query.skillLevel });
    if(query.venueId)conditions.push({venueId:query.venueId});
    if(query.audience==="MALE")conditions.push({skillRecruitmentAudience:{not:"FEMALE_ONLY"}});
    if(query.audience==="FEMALE")conditions.push({skillRecruitmentAudience:{not:"MALE_ONLY"}});
    if(query.rank)conditions.push(skillWhere(query.audience??"ALL",query.rank,query.includeUnknown==="true"));
    if (query.date) conditions.push({ startsAt: communityDateBounds(query.date, query.timeZone) });
    if (cursor) conditions.push({ OR: [{ startsAt: { gt: cursor.at } }, { startsAt: cursor.at, id: { gt: cursor.id } }] });
    const rows = await prisma.communityListing.findMany({ where: { AND: conditions }, include: normalizationInclude, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: query.limit + 1 });
    const more = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return { listings: page.map((row) => presentCommunityListing(row, now)), nextCursor: more && last?.startsAt ? encodeCommunityCursor(last.startsAt, last.id) : null };
  });
  app.get("/community-listings/:id", async (request) => {
    publicEnabled();
    const { id } = request.params as { id: string };
    const row = await prisma.communityListing.findFirst({ where: { AND: [publicWhere, { id }] }, include: normalizationInclude });
    if (!row) throw notFound("Listing not found");
    return { listing: presentCommunityListing(row) };
  });
  app.post("/community-listings/:id/reports", { bodyLimit: 8192 }, async (request, reply) => {
    publicEnabled();
    await communityRateLimit(`rl:community:report:${request.ip}`, 10, 3600, reply);
    const input = CommunityReportSchema.parse(request.body);
    const { id } = request.params as { id: string };
    const row = await prisma.communityListing.findFirst({ where: { AND: [publicWhere, { id }] }, select: { id: true } });
    if (!row) throw notFound("Listing not found");
    try {
      const report = await prisma.communityListingReport.create({ data: { listingId: row.id, ...input } });
      return reply.code(201).send({ reportId: report.id, status: report.status });
    } catch {
      // Prisma error text can include mutation arguments, including private reporter contact.
      throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Unable to save report; please retry");
    }
  });
}
