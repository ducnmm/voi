import { z } from "zod";
import { CommunityIngestItemSchema, CommunityContactSchema, CommunityReportSchema, CommunitySkillLevelSchema, CommunityFeeBasisSchema, CommunitySourceStatusSchema, CommunityPublicationStatusSchema, CommunityEffectiveStatusSchema } from "@voi/shared";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ "application/json": { schema } });
const string = { type: "string" };
const nullableString = { type: ["string", "null"] };
const date = { type: "string", format: "date-time" };
const nullableDate = { type: ["string", "null"], format: "date-time" };
const nullableInt = { type: ["integer", "null"], minimum: 0 };
const generated = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, properties, required });
const errors = Object.fromEntries([400, 401, 403, 404, 413, 429, 500].map((code) => [String(code), { description: ({ 400: "Invalid envelope or query", 401: "Missing, invalid, expired, or revoked integration key", 403: "Scope or source denied; batch has no mutations", 404: "Listing is unavailable", 413: "Body exceeds configured limit", 429: "Rate limit exceeded; retry with the same operation IDs", 500: "Temporary failure; retry with the same operation IDs" } as Record<number, string>)[code], content: json(ref("ErrorResponse")), ...(code === 429 ? { headers: { "Retry-After": { schema: { type: "integer" }, description: "Seconds before retry" } } } : {}) }]));
const integrationSecurity = [{ integrationKey: [] }];
const idParameter = { name: "id", in: "path", required: true, schema: string };
const queryParameter = (name: string, schema: unknown, required = false) => ({ name, in: "query", required, schema });
const listingProperties = {
  id: string, title: string, description: nullableString, startsAt: nullableDate, endsAt: nullableDate, timeZone: string,
  venueName: nullableString, venueAddress: nullableString, areaCode: nullableString, areaLabel: nullableString,
  skillLevel: ref("CommunitySkillLevel"), skillText: nullableString, feeVnd: nullableInt, feeBasis: ref("CommunityFeeBasis"), feeText: nullableString,
  requestedPlayers: nullableInt, organizerName: nullableString, contacts: { type: "array", maxItems: 5, items: ref("CommunityContact") },
  source: object({ id: string, name: string, platform: { const: "FACEBOOK" }, url: { type: "string", format: "uri" } }),
  sourceUrl: { type: "string", format: "uri" }, sourcePostedAt: nullableDate, lastVerifiedAt: date,
  effectiveStatus: ref("CommunityEffectiveStatus"), stale: { type: "boolean" }
};
export const communityOpenApiSchemas = {
  CommunitySkillLevel: generated(CommunitySkillLevelSchema), CommunityFeeBasis: generated(CommunityFeeBasisSchema),
  CommunitySourceStatus: generated(CommunitySourceStatusSchema), CommunityPublicationStatus: generated(CommunityPublicationStatusSchema),
  CommunityEffectiveStatus: generated(CommunityEffectiveStatusSchema), CommunityContact: generated(CommunityContactSchema),
  CommunityIngestItem: generated(CommunityIngestItemSchema),
  CommunityBatch: object({ schemaVersion: { const: 1 }, runId: { type: "string", minLength: 1, maxLength: 128 }, dryRun: { type: "boolean", default: false }, items: { type: "array", minItems: 1, maxItems: 25, items: ref("CommunityIngestItem") } }, ["schemaVersion", "runId", "items"]),
  CommunityItemError: object({ code: { type: "string", enum: ["INVALID_ITEM", "FUTURE_OBSERVATION", "SOURCE_DISABLED", "INVALID_SOURCE_URL", "SOURCE_MISMATCH", "RESTORE_REQUIRES_OPERATOR", "INVALID_CONTACT", "INVALID_AREA", "INVALID_SOURCE_TIMESTAMP", "OBSERVATION_CONFLICT", "IDEMPOTENCY_CONFLICT", "TEMPORARY_FAILURE"] }, field: nullableString, message: string }),
  CommunityItemResult: object({ index: { type: "integer", minimum: 0 }, operationId: nullableString,
    outcome: { type: "string", enum: ["created", "updated", "unchanged", "ignored_stale", "needs_review", "rejected", "retryable_error"] }, replayed: { type: "boolean" }, listingId: nullableString,
    publicationStatus: { anyOf: [ref("CommunityPublicationStatus"), { type: "null" }] }, effectiveStatus: { anyOf: [ref("CommunityEffectiveStatus"), { type: "null" }] }, publicUrl: nullableString,
    warnings: { type: "array", items: { type: "string", enum: ["AVAILABILITY_UNCONFIRMED", "POSSIBLE_DUPLICATE"] } }, errors: { type: "array", items: ref("CommunityItemError") } }),
  CommunityBatchResponse: object({ runId: string, dryRun: { type: "boolean" }, results: { type: "array", items: ref("CommunityItemResult") } }),
  CommunityListing: object(listingProperties),
  CommunityListingFeed: object({ listings: { type: "array", items: ref("CommunityListing") }, nextCursor: nullableString }),
  CommunityListingDetail: object({ listing: ref("CommunityListing") }),
  CommunityIntegrationListing: object({ id: string, sourceId: string, sourcePostId: string, sourceUrl: string, publicationStatus: ref("CommunityPublicationStatus"), sourceStatus: ref("CommunitySourceStatus"), effectiveStatus: ref("CommunityEffectiveStatus"), startsAt: nullableDate, observedAt: date, sourceUpdatedAt: nullableDate, firstSeenAt: date, lastVerifiedAt: date, version: { type: "integer" }, reviewReasons: { type: "array", items: string }, publicUrl: nullableString }),
  CommunityIntegrationFeed: object({ listings: { type: "array", items: ref("CommunityIntegrationListing") }, nextCursor: nullableString }),
  CommunityReport: generated(CommunityReportSchema),
  CommunityReportResponse: object({ reportId: string, status: { const: "OPEN" } }),
  CommunityAreas: object({ areas: { type: "array", items: object({ code: string, label: string }) } })
};
export const communityOpenApiPaths = {
  "/community-listings/{id}/events": { post: { summary: "Record a public listing view or contact click", security: [], parameters: [idParameter], description: "Structured counters only: no user identifier, contact data, attendance or reservation changes. 120 requests/minute per IP. Hidden listings return 404.", requestBody: { required: true, content: json({ oneOf: [object({ type: { const: "VIEW" } }), object({ type: { const: "CONTACT" }, contactType: { type: "string", enum: ["SOURCE", "ZALO", "PHONE", "FACEBOOK"] } })] }) }, responses: { "204": { description: "Event recorded" }, ...errors } } },
  "/integrations/community-listings/batch": { post: {
    summary: "Import source snapshots or deletion tombstones", security: integrationSecurity,
    description: "Requires community:write and every source in the client scope. Maximum 25 items and 1 MiB; 30 requests/minute per stable client, 120 authentication attempts/minute per IP. Item errors are returned in HTTP 200; duplicate operation IDs invalidate the envelope. Each item and operation ledger commit atomically. Dry run never writes. Publication requires schedule and venue evidence excerpts present in rawText; missing or unmatched excerpts yield NEEDS_REVIEW. Retry with the original operationId and payload; runId is not part of idempotency. Source URL must be a direct HTTPS Facebook group post. Deletion wins equal observation timestamps. Deleted/suppressed listings require an audited operator restore. Public URLs are null for unpublishable listings or when production web origin is not configured.",
    requestBody: { required: true, content: json(ref("CommunityBatch")) }, responses: { "200": { description: "Per-item outcomes (does not imply all items succeeded)", content: json(ref("CommunityBatchResponse")) }, ...errors }
  } },
  "/integrations/community-listings": { get: {
    summary: "Read source-scoped recheck queue", security: integrationSecurity,
    description: "Requires community:read. With needsRecheck=true, includes future FULL/CANCELLED listings and undated NEEDS_REVIEW listings first seen in the last seven days; excludes deleted, suppressed and anonymized rows. Ordered by lastVerifiedAt and ID, with a scan-time cursor cutoff that excludes rows changed while paging. 120 reads/minute per client.",
    parameters: [queryParameter("sourceId", string, true), queryParameter("needsRecheck", { type: "boolean", default: true }), queryParameter("cursor", string), queryParameter("limit", { type: "integer", default: 25, minimum: 1, maximum: 50 })],
    responses: { "200": { description: "Source-scoped listing status", content: json(ref("CommunityIntegrationFeed")) }, ...errors }
  } },
  "/integrations/community-listings/{id}": { get: { summary: "Read current source-scoped listing status", security: integrationSecurity, parameters: [idParameter], responses: { "200": { description: "Current listing status, independent of replayed result", content: json(object({ listing: ref("CommunityIntegrationListing") })) }, ...errors } } },
  "/community-listings": { get: {
    summary: "Discover public community listings", security: [], description: "Only published, future recruiting/unknown listings from publicly enabled sources. Expiry is evaluated in the database query. Pagination orders by startsAt and ID. Contacts and source availability are unverified; OPEN does not guarantee a place.",
    parameters: [queryParameter("areaCode", string), queryParameter("date", { type: "string", format: "date" }), queryParameter("timeZone", { type: "string", default: "Asia/Ho_Chi_Minh" }), queryParameter("skillLevel", ref("CommunitySkillLevel")), queryParameter("cursor", string), queryParameter("limit", { type: "integer", minimum: 1, maximum: 50, default: 20 })],
    responses: { "200": { description: "Anonymous allowlisted feed", content: json(ref("CommunityListingFeed")) }, ...errors }
  } },
  "/community-listings/areas": { get: { summary: "List configured public area filters", security: [], responses: { "200": { description: "Enabled areas", content: json(ref("CommunityAreas")) }, ...errors } } },
  "/community-listings/{id}": { get: { summary: "Read public listing detail", security: [], parameters: [idParameter], description: "Expired, full and cancelled listings retain status detail. Review, deleted, suppressed, anonymized, and disabled-source listings return 404. No raw text, evidence, integration identities, reports or moderation fields are exposed.", responses: { "200": { description: "Public listing", content: json(ref("CommunityListingDetail")) }, ...errors } } },
  "/community-listings/{id}/reports": { post: { summary: "Report an issue with a public listing", security: [], parameters: [idParameter], description: "10 reports/hour per IP, maximum body 8 KiB. Reporter contact is optional and private. Reports never automatically modify listing status.", requestBody: { required: true, content: json(ref("CommunityReport")) }, responses: { "201": { description: "Report queued for operator review", content: json(ref("CommunityReportResponse")) }, ...errors } } }
};
