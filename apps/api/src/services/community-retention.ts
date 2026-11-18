import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

const DAY = 86400000;

/** Retain exact source keys as tombstones; never delete native sessions or users. */
export async function runCommunityRetention(now = new Date(), actor = "retention-worker") {
  const thirtyDays = new Date(now.getTime() - 30 * DAY);
  const ninetyDays = new Date(now.getTime() - 90 * DAY);
  return prisma.$transaction(async (tx) => {
    // Multiple replicas can tick; serialize maintenance without blocking request transactions.
    const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(18081501) AS locked`;
    if (!lock?.locked) return { skipped: true, rawCleared: 0, operationsDeleted: 0, listingsAnonymized: 0, reportsCleared: 0 };
    const raw = await tx.communityListing.updateMany({
      where: { rawRetainedUntil: { lte: now } },
      data: { rawText: null, evidence: Prisma.DbNull, rawRetainedUntil: null },
    });
    const operations = await tx.communityIngestOperation.deleteMany({ where: { createdAt: { lt: thirtyDays } } });
    const listings = await tx.communityListing.updateMany({
      where: {
        anonymizedAt: null,
        OR: [
          { startsAt: { lt: ninetyDays } },
          { startsAt: null, firstSeenAt: { lt: ninetyDays } },
        ],
      },
      data: {
        publicationStatus: "SUPPRESSED", suppressionReason: "RETENTION_EXPIRED", anonymizedAt: now,
        title: null, description: null, venueName: null, venueAddress: null,venueId:null,venueMapsUrl:null,venueCandidateIds:[],venueResolutionStatus:"UNRESOLVED",
        skillNormalizationStatus:"UNRESOLVED",skillNormalizationNotes:[],skillNormalizationReasons:[],
        organizerName: null, contacts: [], rawText: null, evidence: Prisma.DbNull,
        rawRetainedUntil: null, skillText: null, feeText: null, reviewReasons: [], duplicateCandidateIds: [],
      },
    });
    await tx.communitySkillRequirement.deleteMany({where:{listing:{anonymizedAt:{not:null}}}});
    const reports = await tx.communityListingReport.updateMany({
      where: { createdAt: { lt: ninetyDays }, OR: [{ note: { not: null } }, { reporterContact: { not: null } }, { resolutionNote: { not: null } }] },
      data: { note: null, reporterContact: null, resolutionNote: null },
    });
    const result = { skipped: false, rawCleared: raw.count, operationsDeleted: operations.count, listingsAnonymized: listings.count, reportsCleared: reports.count };
    if (raw.count + operations.count + listings.count + reports.count > 0) {
      await tx.communityAuditLog.create({ data: { actor, action: "retention", targetType: "catalogue", targetId: "community", details: result } });
    }
    return result;
  }, { timeout: 30000 });
}
