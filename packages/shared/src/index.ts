import { z } from "zod";

export const DEFAULT_CURRENCY = "VND" as const;

export const SkillLevelSchema = z.enum([
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "OPEN"
]);

export const RsvpStatusSchema = z.enum([
  "JOINED",
  "MAYBE",
  "DECLINED",
  "WAITLISTED",
  "CANCELLED"
]);

export const PaymentStatusSchema = z.enum([
  "NOT_REQUIRED",
  "UNPAID",
  "PAID"
]);

export const SessionVisibilitySchema = z.enum([
  "PRIVATE_LINK",
  "GROUP_ONLY"
]);

export type SkillLevel = z.infer<typeof SkillLevelSchema>;
export type RsvpStatus = z.infer<typeof RsvpStatusSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export type SessionVisibility = z.infer<typeof SessionVisibilitySchema>;

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).optional(),
  defaultVenueName: z.string().trim().max(120).optional(),
  defaultSkillLevel: SkillLevelSchema.default("OPEN")
});

export const CreateSessionSchema = z.object({
  title: z.string().trim().max(120).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  venueName: z.string().trim().min(1).max(120),
  venueNote: z.string().trim().max(240).optional(),
  courtCount: z.number().int().min(1).max(20),
  maxPlayers: z.number().int().min(1).max(80).optional(),
  feeTotalVnd: z.number().int().min(0).optional(),
  shuttlecockCostVnd: z.number().int().min(0).optional(),
  skillLevel: SkillLevelSchema.default("OPEN"),
  visibility: SessionVisibilitySchema.default("PRIVATE_LINK"),
  costTrackingEnabled: z.boolean().default(false),
  feePerPlayerVnd: z.number().int().min(0).optional(),
  venueLat: z.number().min(-90).max(90).optional(),
  venueLng: z.number().min(-180).max(180).optional(),
  imageUrls: z.array(z.string().url().max(500)).max(6).optional()
});

export const UpdateSessionSchema = z.object({
  title: z.string().trim().max(120).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  venueName: z.string().trim().min(1).max(120).optional(),
  venueNote: z.string().trim().max(240).optional(),
  courtCount: z.number().int().min(1).max(20).optional(),
  maxPlayers: z.number().int().min(1).max(80).optional(),
  feeTotalVnd: z.number().int().min(0).optional(),
  shuttlecockCostVnd: z.number().int().min(0).optional(),
  skillLevel: SkillLevelSchema.optional(),
  visibility: SessionVisibilitySchema.optional(),
  costTrackingEnabled: z.boolean().optional(),
  feePerPlayerVnd: z.number().int().min(0).nullable().optional(),
  venueLat: z.number().min(-90).max(90).nullable().optional(),
  venueLng: z.number().min(-180).max(180).nullable().optional(),
  imageUrls: z.array(z.string().url().max(500)).max(6).optional()
});

export const SessionFeedQuerySchema = z.object({
  scope: z.enum(["upcoming", "past"]).default("upcoming"),
  skill: SkillLevelSchema.optional(),
  venue: z.string().trim().min(1).max(120).optional(),
  availableOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  savedOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  sort: z.enum(["date", "price", "spots"]).default("date"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).optional()
});

export type SessionFeedQuery = z.infer<typeof SessionFeedQuerySchema>;

export const CreateMatchResultSchema = z.object({
  label: z.string().trim().min(1).max(40),
  scoreA: z.number().int().min(0).max(99),
  scoreB: z.number().int().min(0).max(99)
});

export type CreateMatchResultInput = z.infer<typeof CreateMatchResultSchema>;

export const CreateReviewSchema = z.object({
  subjectId: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional()
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const SendMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const GoogleLoginSchema = z.object({
  idToken: z.string().min(1)
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

export type GoogleLoginInput = z.infer<typeof GoogleLoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export const DevLoginSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(80).optional()
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
  defaultSkillLevel: SkillLevelSchema.optional()
});

export const RegisterPushDeviceSchema = z.object({
  deviceToken: z.string().trim().min(16).max(512),
  platform: z.literal("IOS").default("IOS"),
  appVersion: z.string().trim().max(40).optional()
});

export const UpdateNotificationPreferenceSchema = z.object({
  remindersEnabled: z.boolean().optional(),
  statusChangesEnabled: z.boolean().optional(),
  waitlistEnabled: z.boolean().optional(),
  reminderLeadMinutes: z.number().int().min(15).max(1440).optional()
});
