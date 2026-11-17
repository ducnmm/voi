import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { auth, buildTestApp, devLogin, prisma, resetDb } from "../helpers.js";
import {
  addCredential,
  batch,
  BATCH_URL,
  BOT_URL,
  communityFixture,
  type CommunityFixture,
  deletion,
  HOUR,
  ingest,
  isoAfter,
  observation,
  PUBLIC_URL,
  snapshot
} from "../community-helpers.js";

let app: FastifyInstance;
let fixture: CommunityFixture;

beforeAll(async () => { app = await buildTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await resetDb(); fixture = await communityFixture(); });

describe("community integration authorization", () => {
  it("rejects missing, invalid and user credentials, and cannot use a bot key for native sessions", async () => {
    const item = snapshot(fixture);
    const missing = await app.inject({ method: "POST", url: BATCH_URL, payload: { schemaVersion: 1, runId: "auth", items: [item] } });
    expect(missing.statusCode).toBe(401);
    expect((await batch(app, "invalid-token", [item])).statusCode).toBe(401);
    const forgedToken = `voi_int.${fixture.credential.keyId}.${"x".repeat(64)}`;
    expect((await batch(app, forgedToken, [item])).statusCode).toBe(401);
    const user = await devLogin(app, "community-user@voi.test");
    expect((await batch(app, user.token, [item])).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/sessions", headers: auth(fixture.token) })).statusCode).toBe(401);
    expect(await prisma.communityListing.count()).toBe(0);
  });

  it("checks every source in the batch before committing any item", async () => {
    const otherSource = await prisma.communitySource.create({ data: {
      externalGroupId: "999999999999999", name: "Out of scope", url: "https://www.facebook.com/groups/999999999999999/", publicEnabled: true
    } });
    const forbidden = snapshot(fixture, { sourceId: otherSource.id });
    const response = await batch(app, fixture.token, [snapshot(fixture), forbidden]);
    expect(response.statusCode).toBe(403);
    expect(await prisma.communityListing.count()).toBe(0);
    expect(await prisma.communityIngestOperation.count()).toBe(0);
  });

  it("enforces separate read and write scopes, including listing detail source isolation", async () => {
    const created = await ingest(app, fixture.token, snapshot(fixture));
    await prisma.integrationClient.update({ where: { id: fixture.client.id }, data: { scopes: ["community:read"] } });
    expect((await batch(app, fixture.token, [snapshot(fixture)])).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: `${BOT_URL}/${created.listingId}`, headers: auth(fixture.token) })).statusCode).toBe(200);
    await prisma.integrationClient.update({ where: { id: fixture.client.id }, data: { scopes: ["community:write"] } });
    expect((await app.inject({ method: "GET", url: `${BOT_URL}/${created.listingId}`, headers: auth(fixture.token) })).statusCode).toBe(403);
    await prisma.integrationClient.update({ where: { id: fixture.client.id }, data: { scopes: ["community:read"], sourceIds: [] } });
    expect((await app.inject({ method: "GET", url: `${BOT_URL}/${created.listingId}`, headers: auth(fixture.token) })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `${BOT_URL}?sourceId=${fixture.source.id}`, headers: auth(fixture.token) })).statusCode).toBe(403);
  });

  it.each(["revoked", "expired", "disabled"])("rejects %s credentials or clients", async (state) => {
    if (state === "disabled") {
      await prisma.integrationClient.update({ where: { id: fixture.client.id }, data: { disabledAt: new Date() } });
    } else {
      await prisma.integrationCredential.update({ where: { id: fixture.credential.id }, data: state === "revoked" ? { revokedAt: new Date() } : { expiresAt: new Date(Date.now() - 1000) } });
    }
    expect((await batch(app, fixture.token, [snapshot(fixture)])).statusCode).toBe(401);
  });

  it("shares replay identity across overlapping rotated keys, then revokes only the old key", async () => {
    const item = snapshot(fixture);
    const first = await ingest(app, fixture.token, item);
    const rotated = await addCredential(fixture.client.id);
    const replay = await ingest(app, rotated.token, item);
    expect(replay).toMatchObject({ listingId: first.listingId, outcome: "created", replayed: true });
    expect(await prisma.communityIngestOperation.count()).toBe(1);
    await prisma.integrationCredential.update({ where: { id: fixture.credential.id }, data: { revokedAt: new Date() } });
    expect((await batch(app, fixture.token, [item])).statusCode).toBe(401);
    expect((await batch(app, rotated.token, [observation(item)])).statusCode).toBe(200);
  });

  it("rejects ingest into a disabled source", async () => {
    await prisma.communitySource.update({ where: { id: fixture.source.id }, data: { ingestEnabled: false } });
    expect((await batch(app, fixture.token, [snapshot(fixture)])).statusCode).toBe(403);
    expect(await prisma.communityListing.count()).toBe(0);
  });
});

describe("community batch validation and dry run", () => {
  it("commits valid items alongside invalid items without leaking raw input in errors", async () => {
    const valid = snapshot(fixture);
    const invalid = snapshot(fixture, { rawText: "PRIVATE-RAW-MARKER" }, { title: "x".repeat(161) });
    const response = await batch(app, fixture.token, [valid, invalid, { sourceId: fixture.source.id }]);
    expect(response.statusCode).toBe(200);
    const results = response.json().results;
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ outcome: "created", replayed: false });
    expect(results[1]).toMatchObject({ outcome: "rejected" });
    expect(results[1].errors.length).toBeGreaterThan(0);
    expect(results[2]).toMatchObject({ outcome: "rejected", index: 2 });
    expect(response.body).not.toContain("PRIVATE-RAW-MARKER");
    expect(response.body).not.toContain(fixture.token);
    expect(await prisma.communityListing.count()).toBe(1);
  });

  it("rejects duplicate operation IDs and invalid envelopes before any mutation", async () => {
    const item = snapshot(fixture);
    expect((await batch(app, fixture.token, [item, item])).statusCode).toBe(400);
    expect((await batch(app, fixture.token, [item], { schemaVersion: 99 })).statusCode).toBe(400);
    expect((await batch(app, fixture.token, Array.from({ length: 26 }, () => snapshot(fixture)))).statusCode).toBe(400);
    expect(await prisma.communityListing.count()).toBe(0);
    expect(await prisma.communityIngestOperation.count()).toBe(0);
  });

  it("enforces item text limits and the whole body size limit", async () => {
    const item = snapshot(fixture, { rawText: "x".repeat(20001) });
    const result = await ingest(app, fixture.token, item);
    expect(result.outcome).toBe("rejected");
    const tooLarge = await batch(app, fixture.token, [snapshot(fixture, { rawText: "x".repeat(1024 * 1024) })]);
    expect(tooLarge.statusCode).toBe(413);
    expect(await prisma.communityListing.count()).toBe(0);
  });

  it("predicts creates in dry run without writing listings or operations, then applies the same operation", async () => {
    const item = snapshot(fixture);
    const response = await batch(app, fixture.token, [item], { dryRun: true });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ dryRun: true, results: [{ outcome: "created", listingId: null, publicUrl: null }] });
    expect(await prisma.communityListing.count()).toBe(0);
    expect(await prisma.communityIngestOperation.count()).toBe(0);
    expect(await ingest(app, fixture.token, item)).toMatchObject({ outcome: "created", replayed: false });
  });

  it("does not update an existing listing's freshness or ledger during dry run", async () => {
    const item = snapshot(fixture);
    const result = await ingest(app, fixture.token, item);
    const before = await prisma.communityListing.findUniqueOrThrow({ where: { id: result.listingId } });
    const response = await batch(app, fixture.token, [observation(item)], { dryRun: true });
    expect(response.statusCode).toBe(200);
    const after = await prisma.communityListing.findUniqueOrThrow({ where: { id: result.listingId } });
    expect(after).toEqual(before);
    expect(await prisma.communityIngestOperation.count()).toBe(1);
  });

  it("rolls back the listing if its operation ledger fails, then safely retries the same operation", async () => {
    const item = snapshot(fixture, { operationId: "test-ledger-write-failure" });
    // A temporary constraint on this disposable test database simulates a real
    // failure after the listing write but before the operation can commit.
    await prisma.$executeRawUnsafe('ALTER TABLE "community_ingest_operations" ADD CONSTRAINT "test_community_ledger_failure" CHECK ("operation_id" <> \'test-ledger-write-failure\')');
    try {
      const failed = await ingest(app, fixture.token, item);
      expect(failed.outcome).toBe("retryable_error");
      expect(await prisma.communityListing.count()).toBe(0);
      expect(await prisma.communityIngestOperation.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "community_ingest_operations" DROP CONSTRAINT "test_community_ledger_failure"');
    }
    const retried = await ingest(app, fixture.token, item);
    expect(retried).toMatchObject({ outcome: "created", replayed: false });
    expect(await prisma.communityListing.count()).toBe(1);
    expect(await prisma.communityIngestOperation.count()).toBe(1);
  });
});

describe("community identity, replay and concurrent writes", () => {
  it("deduplicates mobile/desktop permalinks by the original source post", async () => {
    const item = snapshot(fixture);
    const first = await ingest(app, fixture.token, item);
    const alias = observation(item, { sourceUrl: item.sourceUrl.replace("www.facebook.com", "m.facebook.com") });
    const second = await ingest(app, fixture.token, alias);
    expect(second.listingId).toBe(first.listingId);
    expect(["unchanged", "updated"]).toContain(second.outcome);
    expect(await prisma.communityListing.count()).toBe(1);
  });

  it("replays the committed result across run IDs and rejects a changed payload for that operation", async () => {
    const item = snapshot(fixture);
    const first = await ingest(app, fixture.token, item);
    const replay = await ingest(app, fixture.token, item);
    expect(replay).toEqual({ ...first, replayed: true });
    const conflict = await ingest(app, fixture.token, { ...item, rawText: "Changed payload" });
    expect(conflict.outcome).toBe("rejected");
    expect(conflict.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" })]));
    expect(await prisma.communityListing.count()).toBe(1);
    expect(await prisma.communityIngestOperation.count()).toBe(1);
    const stored = await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } });
    expect(stored.rawText).toBe(item.rawText);
  });

  it("commits one listing and one ledger result for concurrent retries of an operation", async () => {
    const item = snapshot(fixture);
    const responses = await Promise.all(Array.from({ length: 5 }, () => batch(app, fixture.token, [item])));
    const results = responses.map((response) => { expect(response.statusCode).toBe(200); return response.json().results[0]; });
    expect(new Set(results.map((result) => result.listingId)).size).toBe(1);
    expect(results.every((result) => result.outcome === "created")).toBe(true);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect(await prisma.communityListing.count()).toBe(1);
    expect(await prisma.communityIngestOperation.count()).toBe(1);
  });

  it("serializes concurrent new operations for the same source post without duplicates", async () => {
    const item = snapshot(fixture);
    const second = { ...item, operationId: randomUUID() };
    const results = await Promise.all([ingest(app, fixture.token, item), ingest(app, fixture.token, second)]);
    expect(results.map((result) => result.outcome).sort()).toEqual(["created", "unchanged"]);
    expect(results[0].listingId).toBe(results[1].listingId);
    expect(await prisma.communityListing.count()).toBe(1);
    expect(await prisma.communityIngestOperation.count()).toBe(2);
  });
});

describe("community observation ordering and freshness", () => {
  it("ignores an older observation and reports conflicts for different content at the same timestamp", async () => {
    const item = snapshot(fixture);
    const first = await ingest(app, fixture.token, item);
    const newest = observation(item, {}, { title: "Latest title" });
    expect((await ingest(app, fixture.token, newest)).outcome).toBe("updated");
    expect((await ingest(app, fixture.token, observation(item, { observedAt: item.observedAt }, { title: "Stale title" }))).outcome).toBe("ignored_stale");
    const conflict = await ingest(app, fixture.token, observation(newest, { observedAt: newest.observedAt }, { title: "Conflicting title" }));
    expect(conflict.outcome).toBe("rejected");
    expect(conflict.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "OBSERVATION_CONFLICT" })]));
    const stored = await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } });
    expect(stored.title).toBe("Latest title");
    expect(stored.lastVerifiedAt.toISOString()).toBe(newest.observedAt);
  });

  it("preserves a non-null source-update watermark when a fresh snapshot omits it", async () => {
    const item = snapshot(fixture, { sourceUpdatedAt: isoAfter(-HOUR) });
    const first = await ingest(app, fixture.token, item);
    const omitted = observation(item, { sourceUpdatedAt: null });
    expect((await ingest(app, fixture.token, omitted)).outcome).toBe("unchanged");
    const before = await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } });
    expect(before.sourceUpdatedAt?.toISOString()).toBe(item.sourceUpdatedAt);
    const lowerVersion = observation(item, { observedAt: isoAfter(-60 * 1000), sourceUpdatedAt: isoAfter(-90 * 60 * 1000) }, { title: "Old source version" });
    expect((await ingest(app, fixture.token, lowerVersion)).outcome).toBe("ignored_stale");
    const after = await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } });
    expect(after.title).toBe(before.title);
    expect(after.lastVerifiedAt).toEqual(before.lastVerifiedAt);
  });

  it("refreshes an unchanged new observation but never a replay or stale observation", async () => {
    const item = snapshot(fixture, { observedAt: isoAfter(-5 * HOUR), sourcePostedAt: isoAfter(-6 * HOUR) });
    const first = await ingest(app, fixture.token, item);
    const before = await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } });
    expect(before.lastVerifiedAt.toISOString()).toBe(item.observedAt);
    expect((await ingest(app, fixture.token, item)).replayed).toBe(true);
    const replayed = await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } });
    expect(replayed.lastVerifiedAt).toEqual(before.lastVerifiedAt);
    const reread = observation(item);
    expect((await ingest(app, fixture.token, reread)).outcome).toBe("unchanged");
    const fresh = await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } });
    expect(fresh.lastVerifiedAt.toISOString()).toBe(reread.observedAt);
    expect((await ingest(app, fixture.token, observation(item, { observedAt: isoAfter(-4 * HOUR) }))).outcome).toBe("ignored_stale");
    expect((await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } })).lastVerifiedAt).toEqual(fresh.lastVerifiedAt);
  });

  it("rejects observations more than five minutes into the future", async () => {
    const result = await ingest(app, fixture.token, snapshot(fixture, { observedAt: isoAfter(10 * 60 * 1000) }));
    expect(result.outcome).toBe("rejected");
    expect(await prisma.communityListing.count()).toBe(0);
  });

  it("lets deletion win an equal timestamp and requires an operator to restore", async () => {
    const item = snapshot(fixture);
    const first = await ingest(app, fixture.token, item);
    const removed = await ingest(app, fixture.token, deletion(item, item.observedAt));
    expect(removed).toMatchObject({ listingId: first.listingId, outcome: "updated", effectiveStatus: "UNAVAILABLE", publicUrl: null });
    expect((await app.inject({ method: "GET", url: `${PUBLIC_URL}/${first.listingId}` })).statusCode).toBe(404);
    const restore = await ingest(app, fixture.token, observation(item));
    expect(restore.outcome).toBe("rejected");
    expect(restore.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "RESTORE_REQUIRES_OPERATOR" })]));
  });

  it("creates a tombstone for a not-yet-imported deletion and blocks old and equal UPSERTs", async () => {
    const item = snapshot(fixture);
    const removed = await ingest(app, fixture.token, deletion(item, item.observedAt));
    expect(removed).toMatchObject({ outcome: "created", effectiveStatus: "UNAVAILABLE", publicUrl: null });
    for (const observedAt of [isoAfter(-HOUR), item.observedAt, isoAfter(-60 * 1000)]) {
      const result = await ingest(app, fixture.token, observation(item, { observedAt }));
      expect(["ignored_stale", "rejected"]).toContain(result.outcome);
    }
    expect(await prisma.communityListing.count()).toBe(1);
    const stored = await prisma.communityListing.findUniqueOrThrow({ where: { id: removed.listingId } });
    expect(stored.sourceStatus).toBe("DELETED");
  });

  it("accepts a newer deletion without sourceUpdatedAt and rejects stale deletion of a fresh listing", async () => {
    const item = snapshot(fixture, { sourceUpdatedAt: isoAfter(-HOUR) });
    const first = await ingest(app, fixture.token, item);
    expect((await ingest(app, fixture.token, deletion(item, isoAfter(-HOUR)))).outcome).toBe("ignored_stale");
    expect((await ingest(app, fixture.token, deletion(item))).effectiveStatus).toBe("UNAVAILABLE");
    expect((await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } })).sourceUpdatedAt?.toISOString()).toBe(item.sourceUpdatedAt);
  });

  it("never resurrects an operator-suppressed listing through bot updates", async () => {
    const item = snapshot(fixture);
    const first = await ingest(app, fixture.token, item);
    await prisma.communityListing.update({ where: { id: first.listingId }, data: { publicationStatus: "SUPPRESSED" } });
    const result = await ingest(app, fixture.token, observation(item));
    expect(result.outcome).toBe("rejected");
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "RESTORE_REQUIRES_OPERATOR" })]));
    expect((await app.inject({ method: "GET", url: `${PUBLIC_URL}/${first.listingId}` })).statusCode).toBe(404);
  });

  it("does not overwrite an operator suppression that commits while ingestion waits for the listing lock", async () => {
    const item = snapshot(fixture);
    const first = await ingest(app, fixture.token, item);
    let releaseOperator!: () => void;
    let notifyLocked!: () => void;
    const operatorGate = new Promise<void>((resolve) => { releaseOperator = resolve; });
    const rowLocked = new Promise<void>((resolve) => { notifyLocked = resolve; });
    const operator = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM community_listings WHERE id = ${first.listingId} FOR UPDATE`;
      notifyLocked();
      await operatorGate;
      await tx.communityListing.update({ where: { id: first.listingId }, data: { publicationStatus: "SUPPRESSED", suppressionReason: "Operator race regression" } });
    }, { timeout: 15000 });
    await rowLocked;
    const pending = ingest(app, fixture.token, observation(item));
    let waiting = false;
    try {
      // Observe a real blocked ingest query, rather than relying on timing to
      // assume the request has reached its listing read/update transaction.
      for (let attempt = 0; attempt < 100 && !waiting; attempt += 1) {
        const rows = await prisma.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database() AND pid <> pg_backend_pid()
              AND wait_event_type = 'Lock' AND query LIKE '%community_listings%'
          ) AS waiting`;
        waiting = rows[0].waiting;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
      }
    } finally {
      releaseOperator();
    }
    const [, result] = await Promise.all([operator, pending]);
    expect(waiting).toBe(true);
    expect(result.outcome).toBe("rejected");
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "RESTORE_REQUIRES_OPERATOR" })]));
    expect((await prisma.communityListing.findUniqueOrThrow({ where: { id: first.listingId } })).publicationStatus).toBe("SUPPRESSED");
  });
});
