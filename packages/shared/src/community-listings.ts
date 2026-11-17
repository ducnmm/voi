import { z } from "zod";

export const CommunitySkillLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "OPEN", "UNKNOWN"]);
export const CommunityFeeBasisSchema = z.enum(["PER_PERSON", "PER_HOUR", "TOTAL", "OTHER", "UNKNOWN"]);
export const CommunitySourceStatusSchema = z.enum(["RECRUITING", "FULL", "CANCELLED", "DELETED", "UNKNOWN"]);
export const CommunityPublicationStatusSchema = z.enum(["PUBLISHED", "NEEDS_REVIEW", "SUPPRESSED"]);
export const CommunityEffectiveStatusSchema = z.enum(["OPEN", "FULL", "CANCELLED", "EXPIRED", "UNAVAILABLE"]);
const isoDate = z.string().datetime({ offset: true });
const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();
export const CommunityContactSchema = z.object({
  type: z.enum(["ZALO", "FACEBOOK", "PHONE"]), value: z.string().trim().min(1).max(500)
}).strict();
export const CommunitySnapshotSchema = z.object({
  title: z.string().trim().min(1).max(160), description: nullableText(2000),
  startsAt: isoDate.nullable(), endsAt: isoDate.nullable(),
  timeZone: z.string().min(1).max(80).refine((zone) => {
    try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; }
  }, "Invalid time zone"),
  venueName: nullableText(200), venueAddress: nullableText(500), areaCode: nullableText(80),
  skillLevel: CommunitySkillLevelSchema, skillText: nullableText(200),
  feeVnd: z.number().int().min(0).max(2147483647).nullable(), feeBasis: CommunityFeeBasisSchema,
  feeText: nullableText(200), requestedPlayers: z.number().int().min(0).max(1000).nullable(),
  organizerName: nullableText(160), contacts: z.array(CommunityContactSchema).max(5),
  sourceStatus: CommunitySourceStatusSchema.exclude(["DELETED"]),
  scheduleKind: z.enum(["SINGLE", "MULTIPLE", "RECURRING", "UNCLEAR"]).default("SINGLE")
}).strict().superRefine((value, ctx) => {
  if (value.endsAt && (!value.startsAt || Date.parse(value.endsAt) <= Date.parse(value.startsAt))) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must follow start" });
  }
});
const itemBase = {
  operationId: z.string().min(1).max(128), sourceId: z.string().min(1).max(128),
  sourcePostId: z.string().regex(/^\d{1,40}$/), sourceUrl: z.string().url().max(1000), observedAt: isoDate
};
export const CommunityIngestItemSchema = z.discriminatedUnion("action", [
  z.object({ ...itemBase, action: z.literal("UPSERT"), sourcePostedAt: isoDate.nullable(), sourceUpdatedAt: isoDate.nullable(),
    rawText: z.string().max(20000), listing: CommunitySnapshotSchema,
    evidence: z.object({ schedule: z.string().max(1000).optional(), venue: z.string().max(1000).optional(), fee: z.string().max(1000).optional(), requestedPlayers: z.string().max(1000).optional(), contacts: z.string().max(1000).optional(), sourceStatus: z.string().max(1000).optional() }).strict()
  }).strict(),
  z.object({ ...itemBase, action: z.literal("SOURCE_DELETED") }).strict()
]);
export const CommunityBatchSchema = z.object({
  schemaVersion: z.literal(1), runId: z.string().min(1).max(128), dryRun: z.boolean().default(false), items: z.array(z.unknown()).min(1).max(25)
}).strict().superRefine((batch, ctx) => {
  const ids = new Set<string>();
  batch.items.forEach((item, index) => {
    const id = item && typeof item === "object" && "operationId" in item ? item.operationId : undefined;
    if (typeof id === "string") {
      if (ids.has(id)) ctx.addIssue({ code: "custom", path: ["items", index, "operationId"], message: "Duplicate operationId" });
      ids.add(id);
    }
  });
});
export const CommunityFeedQuerySchema = z.object({
  areaCode: z.string().min(1).max(80).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  timeZone: z.string().max(80).refine((zone) => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }, "Invalid time zone").default("Asia/Ho_Chi_Minh"), skillLevel: CommunitySkillLevelSchema.optional(),
  cursor: z.string().min(1).max(1000).optional(), limit: z.coerce.number().int().min(1).max(50).default(20)
}).strict();
export const CommunityRecheckQuerySchema = z.object({
  sourceId: z.string().min(1).max(128), needsRecheck: z.enum(["true", "false"]).default("true"),
  cursor: z.string().min(1).max(1000).optional(), limit: z.coerce.number().int().min(1).max(50).default(25)
}).strict();
export const CommunityReportSchema = z.object({
  type: z.enum(["WRONG_INFO", "FULL", "CANCELLED", "REMOVAL_REQUEST"]),
  note: z.string().trim().max(1000).optional(), reporterContact: z.string().trim().max(200).optional()
}).strict();
export type CommunityIngestItem = z.infer<typeof CommunityIngestItemSchema>;
export type CommunityBatchInput = z.infer<typeof CommunityBatchSchema>;
export type CommunityContact = z.infer<typeof CommunityContactSchema>;
export type CommunityFeedQuery = z.infer<typeof CommunityFeedQuerySchema>;
export type CommunityReportInput = z.infer<typeof CommunityReportSchema>;
export type CommunityEffectiveStatus = z.infer<typeof CommunityEffectiveStatusSchema>;
export type CommunityPublicationStatus = z.infer<typeof CommunityPublicationStatusSchema>;
export type CommunityItemResult = {
  index: number; operationId: string | null; outcome: "created" | "updated" | "unchanged" | "ignored_stale" | "needs_review" | "rejected" | "retryable_error";
  replayed: boolean; listingId: string | null; publicationStatus: CommunityPublicationStatus | null;
  effectiveStatus: CommunityEffectiveStatus | null; publicUrl: string | null; warnings: string[];
  errors: { code: string; field: string | null; message: string }[];
};
export type CommunityBatchResponse = { runId: string; dryRun: boolean; results: CommunityItemResult[] };
export type CommunityListingDTO = {
  id: string; title: string; description: string | null; startsAt: string | null; endsAt: string | null; timeZone: string;
  venueName: string | null; venueAddress: string | null; areaCode: string | null; areaLabel: string | null;
  skillLevel: z.infer<typeof CommunitySkillLevelSchema>; skillText: string | null;
  feeVnd: number | null; feeBasis: z.infer<typeof CommunityFeeBasisSchema>; feeText: string | null;
  requestedPlayers: number | null; organizerName: string | null; contacts: CommunityContact[];
  source: { id: string; name: string; platform: "FACEBOOK"; url: string };
  sourceUrl: string; sourcePostedAt: string | null; lastVerifiedAt: string; effectiveStatus: CommunityEffectiveStatus; stale: boolean;
};
export type CommunityListingFeedResponse = { listings: CommunityListingDTO[]; nextCursor: string | null };
export type CommunityListingDetailResponse = { listing: CommunityListingDTO };
