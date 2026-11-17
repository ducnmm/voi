import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, prisma, resetDb } from "../helpers.js";
import { communityFixture, type CommunityFixture, HOUR, ingest, observation, PUBLIC_URL, snapshot } from "../community-helpers.js";
import { runCommunityRetention } from "../../src/services/community-retention.js";

let app: FastifyInstance;
let fixture: CommunityFixture;
beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetDb(); fixture = await communityFixture(); });

describe("community data retention", () => {
  it("clears expired raw data and replay operations while retaining recent content and exact source identity", async () => {
    const oldItem = snapshot(fixture);
    const old = await ingest(app, fixture.token, oldItem);
    const liveItem = snapshot(fixture);
    const live = await ingest(app, fixture.token, liveItem);
    const now = new Date();
    await prisma.communityListing.update({ where: { id: old.listingId }, data: { rawRetainedUntil: new Date(now.getTime() - 1000) } });
    await prisma.communityIngestOperation.updateMany({ where: { listingId: old.listingId }, data: { createdAt: new Date(now.getTime() - 31 * 24 * HOUR) } });
    const result = await runCommunityRetention(now, "retention-test");
    expect(result).toMatchObject({ skipped: false, rawCleared: 1, operationsDeleted: 1, listingsAnonymized: 0 });
    const cleared = await prisma.communityListing.findUniqueOrThrow({ where: { id: old.listingId } });
    expect(cleared).toMatchObject({ rawText: null, evidence: null, rawRetainedUntil: null, sourceId: fixture.source.id, sourcePostId: oldItem.sourcePostId, publicationStatus: "PUBLISHED" });
    const recent = await prisma.communityListing.findUniqueOrThrow({ where: { id: live.listingId } });
    expect(recent.rawText).toBe(liveItem.rawText);
    expect(recent.evidence).toEqual(liveItem.evidence);
    expect(await prisma.communityIngestOperation.count()).toBe(1);
    expect((await app.inject({ method: "GET", url: `${PUBLIC_URL}/${old.listingId}` })).statusCode).toBe(200);
    const audit = await prisma.communityAuditLog.findFirstOrThrow({ where: { action: "retention" } });
    expect(audit.actor).toBe("retention-test");
    expect(JSON.stringify(audit.details)).not.toContain(oldItem.rawText);
    // Once the replay ledger expires, source identity and observation ordering
    // still prevent the old operation from creating another listing.
    const replayAfterRetention = await ingest(app, fixture.token, oldItem);
    expect(replayAfterRetention).toMatchObject({ listingId: old.listingId, outcome: "unchanged", replayed: false });
    expect(await prisma.communityListing.count()).toBe(2);
  });

  it("redacts 90-day expired/undated listings and reports, preserves tombstones, and cannot be undone by a bot", async () => {
    const expiredItem = snapshot(fixture, {}, { organizerName: "Private organizer", contacts: [{ type: "PHONE", value: "+84901234567" }] });
    const expired = await ingest(app, fixture.token, expiredItem);
    const undated = await ingest(app, fixture.token, snapshot(fixture, {}, { startsAt: null, endsAt: null }));
    const recent = await ingest(app, fixture.token, snapshot(fixture));
    const now = new Date();
    const oldDate = new Date(now.getTime() - 91 * 24 * HOUR);
    await prisma.communityListing.update({ where: { id: expired.listingId }, data: { startsAt: oldDate } });
    await prisma.communityListing.update({ where: { id: undated.listingId }, data: { firstSeenAt: oldDate } });
    const oldReport = await prisma.communityListingReport.create({ data: { listingId: expired.listingId, type: "WRONG_INFO", note: "Private report", reporterContact: "private@example.test", resolutionNote: "Private resolution", createdAt: oldDate } });
    const recentReport = await prisma.communityListingReport.create({ data: { listingId: recent.listingId, type: "FULL", note: "Recent report", reporterContact: "recent@example.test" } });
    const result = await runCommunityRetention(now, "retention-test");
    expect(result).toMatchObject({ skipped: false, listingsAnonymized: 2, reportsCleared: 1 });
    for (const id of [expired.listingId, undated.listingId]) {
      const stored = await prisma.communityListing.findUniqueOrThrow({ where: { id } });
      expect(stored).toMatchObject({ publicationStatus: "SUPPRESSED", suppressionReason: "RETENTION_EXPIRED", title: null, description: null, venueName: null, venueAddress: null, organizerName: null, contacts: [], rawText: null, evidence: null, skillText: null, feeText: null });
      expect(stored.anonymizedAt).toEqual(now);
      expect((await app.inject({ method: "GET", url: `${PUBLIC_URL}/${id}` })).statusCode).toBe(404);
    }
    expect(await prisma.communityListing.findUniqueOrThrow({ where: { id: expired.listingId } })).toMatchObject({ platform: "FACEBOOK", sourceId: fixture.source.id, sourcePostId: expiredItem.sourcePostId });
    expect(await prisma.communityListingReport.findUniqueOrThrow({ where: { id: oldReport.id } })).toMatchObject({ note: null, reporterContact: null, resolutionNote: null });
    expect(await prisma.communityListingReport.findUniqueOrThrow({ where: { id: recentReport.id } })).toMatchObject({ note: "Recent report", reporterContact: "recent@example.test" });
    expect((await app.inject({ method: "GET", url: `${PUBLIC_URL}/${recent.listingId}` })).statusCode).toBe(200);
    const restore = await ingest(app, fixture.token, observation(expiredItem));
    expect(restore.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "RESTORE_REQUIRES_OPERATOR" })]));
    const second = await runCommunityRetention(now, "retention-test");
    expect(second).toMatchObject({ rawCleared: 0, operationsDeleted: 0, listingsAnonymized: 0, reportsCleared: 0 });
    expect(await prisma.communityAuditLog.count({ where: { action: "retention" } })).toBe(1);
  });
});
