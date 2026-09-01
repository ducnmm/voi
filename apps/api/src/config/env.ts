import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16).optional(),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(43187),
  API_VERSION: z.literal("v1").default("v1"),
  APP_BASE_URL: z.string().default("voi://"),
  DEFAULT_CURRENCY: z.literal("VND").default("VND"),
  CORS_ORIGINS: z.string().default("*"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  REDIS_URL: z
    .union([z.string().url(), z.literal("")])
    .optional(),
  INVITE_TTL_DAYS: z.coerce.number().int().positive().max(365).default(7),
  CHAT_RATE_MAX: z.coerce.number().int().positive().default(20),
  CHAT_RATE_WINDOW_SEC: z.coerce.number().int().positive().default(10),
  GOOGLE_IOS_CLIENT_ID: z.string().optional(),
  APPLE_BUNDLE_ID: z.string().optional(),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_KEY_PATH: z.string().optional(),
  APNS_BUNDLE_ID: z.string().optional(),
  APNS_ENV: z.enum(["sandbox", "production"]).default("sandbox")
});

const parsed = EnvSchema.parse(process.env);

if (parsed.NODE_ENV === "production" && !parsed.JWT_SECRET) {
  throw new Error("JWT_SECRET is required when NODE_ENV=production");
}

export const env = {
  ...parsed,
  JWT_SECRET: parsed.JWT_SECRET ?? "development-jwt-secret",
  REDIS_URL: parsed.REDIS_URL ? parsed.REDIS_URL : undefined
};

export function getCorsOrigins(): true | string[] {
  if (env.CORS_ORIGINS === "*") {
    // Native iOS does not need CORS. Reflecting any Origin in production
    // would let a browser page call the API with the user's cookies/tokens.
    if (env.NODE_ENV === "production") {
      return [];
    }
    return true;
  }

  return env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
