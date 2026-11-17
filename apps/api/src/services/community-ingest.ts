import { randomUUID } from "node:crypto";
import { Prisma, type CommunityListing, type CommunitySource, type IntegrationClient } from "@prisma/client";
import { CommunityIngestItemSchema, type CommunityBatchInput, type CommunityItemResult } from "@voi/shared";
import { prisma } from "../db/prisma.js";
import { communityEffectiveStatus, communityPublicUrl } from "./community-presenter.js";
import { communityPayloadHash, normalizeCommunityContact, normalizeCommunitySourceUrl } from "./community-validation.js";

type Db = Prisma.TransactionClient;
function resultBase(index: number, operationId: string | null): CommunityItemResult {
  return { index, operationId, outcome: "rejected", replayed: false, listingId: null, publicationStatus: null, effectiveStatus: null, publicUrl: null, warnings: [], errors: [] };
}
function reject(result: CommunityItemResult, code: string, field: string | null = null, message = "Item cannot be applied"): CommunityItemResult {
  return { ...result, outcome: "rejected", errors: [{ code, field, message }] };
}
function resultFor(result: CommunityItemResult, row: CommunityListing, source: CommunitySource, now: Date, exists = true): CommunityItemResult {
  return { ...result, listingId: exists ? row.id : null, publicationStatus: row.publicationStatus,
    effectiveStatus: communityEffectiveStatus(row, now), publicUrl: exists ? communityPublicUrl(row, source.publicEnabled) : null,
    warnings: row.sourceStatus === "RECRUITING" || row.sourceStatus === "UNKNOWN" ? ["AVAILABILITY_UNCONFIRMED"] : [] };
}
function newListing(source: CommunitySource, postId: string, sourceUrl: string, observedAt: Date, now: Date): CommunityListing {
  return {
    id: randomUUID(), platform: source.platform, sourceId: source.id, sourcePostId: postId, sourceUrl,
    title: null, description: null, startsAt: null, endsAt: null, timeZone: "Asia/Ho_Chi_Minh",
    venueName: null, venueAddress: null, areaCode: null, skillLevel: "UNKNOWN", skillText: null,
    feeVnd: null, feeBasis: "UNKNOWN", feeText: null, requestedPlayers: null, organizerName: null,
    contacts: [], scheduleKind: "SINGLE", rawText: null, evidence: null, rawRetainedUntil: null,
    sourcePostedAt: null, sourceUpdatedAt: null, observedAt, receivedAt: now, lastVerifiedAt: observedAt,
    firstSeenAt: now, publishedAt: null, publicationStatus: "NEEDS_REVIEW", sourceStatus: "UNKNOWN",
    reviewReasons: [], suppressionReason: null, duplicateCandidateIds: [], snapshotHash: null, version: 1,
    anonymizedAt: null, createdAt: now, updatedAt: now
  };
}
async function applyItem(db: Db, raw: unknown, base: CommunityItemResult, dryRun: boolean): Promise<CommunityItemResult> {
  const parsed = CommunityIngestItemSchema.safeParse(raw);
  if (!parsed.success) return { ...base, errors: parsed.error.issues.map((issue) => ({ code: "INVALID_ITEM", field: issue.path.join("."), message: "Invalid or missing field" })) };
  const item = parsed.data;
  const now = new Date();
  const observedAt = new Date(item.observedAt);
  if (observedAt.getTime() > now.getTime() + 300000) return reject(base, "FUTURE_OBSERVATION", "observedAt", "Observation must not be more than five minutes in the future");
  const source = await db.communitySource.findUnique({ where: { id: item.sourceId } });
  if (!source || !source.ingestEnabled) return reject(base, "SOURCE_DISABLED", "sourceId");
  const sourceUrl = normalizeCommunitySourceUrl(item.sourceUrl, source.externalGroupId, item.sourcePostId);
  if (!sourceUrl) return reject(base, "INVALID_SOURCE_URL", "sourceUrl", "Permalink must identify the configured group and post");
  if (!dryRun) {
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`community-listing:${source.platform}:${item.sourcePostId}`}, 0))::text`;
    // Also serialize against operator/retention updates, which use ordinary row locks.
    await db.$queryRaw`SELECT id FROM community_listings WHERE platform = CAST(${source.platform} AS "CommunityPlatform") AND source_post_id = ${item.sourcePostId} FOR UPDATE`;
  }
  const existing = await db.communityListing.findUnique({ where: { platform_sourcePostId: { platform: source.platform, sourcePostId: item.sourcePostId } } });
  if (existing && existing.sourceId !== source.id) return reject(base, "SOURCE_MISMATCH", "sourceId");
  let result = existing ? resultFor(base, existing, source, now) : base;
  if (item.action === "UPSERT" && existing && (existing.publicationStatus === "SUPPRESSED" || existing.sourceStatus === "DELETED" || existing.anonymizedAt)) {
    return reject(result, "RESTORE_REQUIRES_OPERATOR", null, "An operator must restore this listing");
  }
  if (existing && observedAt < existing.observedAt) return { ...result, outcome: "ignored_stale" };
  if (item.action === "UPSERT" && item.sourceUpdatedAt && existing?.sourceUpdatedAt && new Date(item.sourceUpdatedAt) < existing.sourceUpdatedAt) {
    return { ...result, outcome: "ignored_stale" };
  }
  const next = existing ? { ...existing } : newListing(source, item.sourcePostId, sourceUrl, observedAt, now);
  let snapshotHash: string;
  if (item.action === "SOURCE_DELETED") {
    snapshotHash = communityPayloadHash({ action: item.action, sourceUrl });
    // Deletion wins a tie, including an already persisted UPSERT at this observation time.
    if (existing?.sourceStatus === "DELETED" && observedAt.getTime() === existing.observedAt.getTime()) return { ...result, outcome: "unchanged" };
    next.sourceStatus = "DELETED";
    next.sourceUrl = sourceUrl;
  } else {
    const snapshot = item.listing;
    const contacts = snapshot.contacts.map(normalizeCommunityContact);
    if (contacts.some((contact) => contact === null)) return reject(result, "INVALID_CONTACT", "listing.contacts", "Contact must use a supported phone number or secure host");
    const area = snapshot.areaCode ? await db.communityArea.findUnique({ where: { code: snapshot.areaCode } }) : null;
    if (snapshot.areaCode && (!area || !area.enabled)) return reject(result, "INVALID_AREA", "listing.areaCode", "Area is not configured");
    for (const field of ["sourcePostedAt", "sourceUpdatedAt"] as const) {
      if (item[field] && Date.parse(item[field]) > observedAt.getTime() + 300000) return reject(result, "INVALID_SOURCE_TIMESTAMP", field);
    }
    // Null sourceUpdatedAt does not erase the last known source watermark.
    const sourceUpdatedAt = item.sourceUpdatedAt ? new Date(item.sourceUpdatedAt) : existing?.sourceUpdatedAt ?? null;
    snapshotHash = communityPayloadHash({ listing: { ...snapshot, contacts }, sourceUrl, sourcePostedAt: item.sourcePostedAt, sourceUpdatedAt: sourceUpdatedAt?.toISOString() ?? null, rawText: item.rawText, evidence: item.evidence });
    if (existing && observedAt.getTime() === existing.observedAt.getTime()) {
      if (snapshotHash !== existing.snapshotHash) return reject(result, "OBSERVATION_CONFLICT", "observedAt", "Different snapshots have the same observation time");
      return { ...result, outcome: "unchanged" };
    }
    Object.assign(next, snapshot, {
      contacts, startsAt: snapshot.startsAt ? new Date(snapshot.startsAt) : null,
      endsAt: snapshot.endsAt ? new Date(snapshot.endsAt) : null,
      sourceUrl, sourcePostedAt: item.sourcePostedAt ? new Date(item.sourcePostedAt) : null,
      sourceUpdatedAt, rawText: item.rawText, evidence: item.evidence,
      rawRetainedUntil: new Date(now.getTime() + 30 * 86400000)
    });
    const reasons: string[] = [];
    if (!source.publicEnabled) reasons.push("SOURCE_NOT_PUBLIC");
    const normalizedRaw = item.rawText.replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
    for (const field of ["schedule", "venue"] as const) {
      const excerpt = item.evidence[field]?.replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
      if (!excerpt || !normalizedRaw.includes(excerpt)) reasons.push(field === "schedule" ? "MISSING_SCHEDULE_EVIDENCE" : "MISSING_VENUE_EVIDENCE");
    }
    if (!next.startsAt) reasons.push("MISSING_START_TIME");
    else if (!existing?.publishedAt && next.startsAt <= now) reasons.push("START_NOT_IN_FUTURE");
    if (!next.venueName) reasons.push("MISSING_VENUE");
    if (!next.areaCode) reasons.push("MISSING_AREA");
    if (next.scheduleKind !== "SINGLE") reasons.push("AMBIGUOUS_SCHEDULE");
    next.reviewReasons = reasons;
    next.publicationStatus = reasons.length ? "NEEDS_REVIEW" : "PUBLISHED";
    if (next.publicationStatus === "PUBLISHED" && !next.publishedAt) next.publishedAt = now;
    if (next.startsAt && next.venueName && contacts.length) {
      const candidates = await db.communityListing.findMany({ where: { id: { not: next.id }, startsAt: next.startsAt, venueName: next.venueName, sourceStatus: { not: "DELETED" } }, select: { id: true, contacts: true }, take: 25 });
      const values = new Set(contacts.map((contact) => `${contact!.type}:${contact!.value}`));
      next.duplicateCandidateIds = candidates.filter((candidate) => Array.isArray(candidate.contacts) && candidate.contacts.some((contact) => contact && typeof contact === "object" && !Array.isArray(contact) && values.has(`${contact.type}:${contact.value}`))).map((candidate) => candidate.id);
    } else next.duplicateCandidateIds = [];
  }
  next.snapshotHash = snapshotHash;
  next.observedAt = observedAt;
  next.lastVerifiedAt = observedAt;
  next.receivedAt = now;
  next.updatedAt = now;
  next.version = existing ? existing.version + 1 : 1;
  const outcome = item.action === "UPSERT" && next.publicationStatus === "NEEDS_REVIEW" ? "needs_review" : !existing ? "created" : snapshotHash === existing.snapshotHash ? "unchanged" : "updated";
  if (!dryRun) {
    const data = { ...next, contacts: next.contacts as Prisma.InputJsonValue, evidence: next.evidence === null ? Prisma.DbNull : next.evidence as Prisma.InputJsonValue };
    if (existing) await db.communityListing.update({ where: { id: existing.id }, data });
    else await db.communityListing.create({ data });
  }
  result = resultFor(base, next, source, now, Boolean(existing) || !dryRun);
  if (next.duplicateCandidateIds.length) result.warnings.push("POSSIBLE_DUPLICATE");
  return { ...result, outcome };
}
export async function ingestCommunityBatch(client: IntegrationClient, batch: CommunityBatchInput): Promise<CommunityItemResult[]> {
  const results: CommunityItemResult[] = [];
  for (const [index, raw] of batch.items.entries()) {
    const candidate = raw && typeof raw === "object" && "operationId" in raw ? raw.operationId : null;
    const operationId = typeof candidate === "string" && candidate.length > 0 && candidate.length <= 128 ? candidate : null;
    const base = resultBase(index, operationId);
    const payloadHash = communityPayloadHash(raw);
    try {
      const result = await prisma.$transaction(async (tx) => {
        if (operationId) {
          if (!batch.dryRun) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`community-operation:${client.id}:${operationId}`}, 0))::text`;
          const previous = await tx.communityIngestOperation.findUnique({ where: { integrationClientId_operationId: { integrationClientId: client.id, operationId } } });
          if (previous) {
            if (previous.payloadHash !== payloadHash) return reject(base, "IDEMPOTENCY_CONFLICT", "operationId", "Operation ID was used with a different payload");
            return { ...(previous.result as unknown as CommunityItemResult), index, replayed: true };
          }
        }
        const applied = await applyItem(tx, raw, base, batch.dryRun);
        if (!batch.dryRun && operationId) await tx.communityIngestOperation.create({ data: { integrationClientId: client.id, operationId, payloadHash, result: applied as unknown as Prisma.InputJsonValue, listingId: applied.listingId } });
        return applied;
      }, { timeout: 15000 });
      results.push(result);
    } catch {
      // Do not persist transient failures or log Prisma query parameters / source content.
      results.push({ ...base, outcome: "retryable_error", errors: [{ code: "TEMPORARY_FAILURE", field: null, message: "Retry this operation with its original payload" }] });
    }
  }
  return results;
}
