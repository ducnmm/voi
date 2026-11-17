import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { auth, prisma } from "./helpers.js";

export const BATCH_URL = "/v1/integrations/community-listings/batch";
export const BOT_URL = "/v1/integrations/community-listings";
export const PUBLIC_URL = "/v1/community-listings";
export const AREA = "hcm-binh-thanh";
export const OTHER_AREA = "hcm-district-1";

let postSequence = 123456789000000;

export async function communityFixture() {
  await prisma.communityArea.createMany({
    data: [
      { code: AREA, label: "Bình Thạnh" },
      { code: OTHER_AREA, label: "Quận 1" }
    ]
  });
  const source = await prisma.communitySource.create({
    data: {
      externalGroupId: "987654321098765",
      name: "Synthetic public badminton source",
      url: "https://www.facebook.com/groups/987654321098765/",
      publicEnabled: true
    }
  });
  const client = await prisma.integrationClient.create({
    data: {
      name: "Synthetic Muse integration",
      scopes: ["community:read", "community:write"],
      sourceIds: [source.id]
    }
  });
  const credential = await addCredential(client.id);
  return { source, client, ...credential };
}

export async function addCredential(clientId: string) {
  const keyId = randomUUID();
  const token = `voi_int.${keyId}.${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
  const credential = await prisma.integrationCredential.create({
    data: {
      keyId,
      clientId,
      tokenHash: createHash("sha256").update(token).digest("hex")
    }
  });
  return { token, credential };
}

export type CommunityFixture = Awaited<ReturnType<typeof communityFixture>>;

export function isoAfter(milliseconds: number) {
  return new Date(Date.now() + milliseconds).toISOString();
}

export const HOUR = 60 * 60 * 1000;

export function snapshot(
  fixture: CommunityFixture,
  overrides: Record<string, unknown> = {},
  listingOverrides: Record<string, unknown> = {}
) {
  const sourcePostId = String(++postSequence);
  return {
    operationId: randomUUID(),
    action: "UPSERT",
    sourceId: fixture.source.id,
    sourcePostId,
    sourceUrl: `https://www.facebook.com/groups/${fixture.source.externalGroupId}/posts/${sourcePostId}/`,
    sourcePostedAt: isoAfter(-2 * HOUR),
    sourceUpdatedAt: null,
    observedAt: isoAfter(-10 * 60 * 1000),
    rawText: "Synthetic private raw text: An explicitly dated, single session at Synthetic badminton court. 80k/người, recruit 3 players.",
    listing: {
      title: "Synthetic badminton gathering",
      description: "Three players wanted for a friendly game.",
      startsAt: isoAfter(48 * HOUR),
      endsAt: isoAfter(50 * HOUR),
      timeZone: "Asia/Ho_Chi_Minh",
      venueName: "Synthetic badminton court",
      venueAddress: null,
      areaCode: AREA,
      skillLevel: "INTERMEDIATE",
      skillText: "Trung bình",
      feeVnd: 80000,
      feeBasis: "PER_PERSON",
      feeText: "80k/người",
      requestedPlayers: 3,
      organizerName: null,
      contacts: [],
      sourceStatus: "RECRUITING",
      ...listingOverrides
    },
    evidence: {
      schedule: "An explicitly dated, single session",
      venue: "Synthetic badminton court",
      fee: "80k/người",
      requestedPlayers: "3 players"
    },
    ...overrides
  };
}

export function observation(
  previous: ReturnType<typeof snapshot>,
  overrides: Record<string, unknown> = {},
  listingOverrides: Record<string, unknown> = {}
) {
  return {
    ...previous,
    operationId: randomUUID(),
    observedAt: isoAfter(-5 * 60 * 1000),
    ...overrides,
    listing: { ...previous.listing, ...listingOverrides }
  };
}

export function deletion(previous: ReturnType<typeof snapshot>, observedAt = isoAfter(-60 * 1000)) {
  return {
    operationId: randomUUID(),
    action: "SOURCE_DELETED",
    sourceId: previous.sourceId,
    sourcePostId: previous.sourcePostId,
    sourceUrl: previous.sourceUrl,
    observedAt
  };
}

export function batch(
  app: FastifyInstance,
  token: string,
  items: unknown[],
  overrides: Record<string, unknown> = {}
) {
  return app.inject({
    method: "POST",
    url: BATCH_URL,
    headers: auth(token),
    payload: { schemaVersion: 1, runId: `test-${randomUUID()}`, dryRun: false, items, ...overrides }
  });
}

export async function ingest(
  app: FastifyInstance,
  token: string,
  item: unknown
) {
  const response = await batch(app, token, [item]);
  if (response.statusCode !== 200) {
    throw new Error(`Ingest fixture failed (${response.statusCode}): ${response.body}`);
  }
  return response.json().results[0];
}

export async function publicFeed(app: FastifyInstance, query = "") {
  const response = await app.inject({ method: "GET", url: `${PUBLIC_URL}${query}` });
  if (response.statusCode !== 200) throw new Error(response.body);
  return response.json();
}
