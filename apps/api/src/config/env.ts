import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16).default("development-jwt-secret"),
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
  GOOGLE_IOS_CLIENT_ID: z.string().optional(),
  APPLE_BUNDLE_ID: z.string().optional(),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  APNS_KEY_PATH: z.string().optional(),
  APNS_BUNDLE_ID: z.string().optional(),
  APNS_ENV: z.enum(["sandbox", "production"]).default("sandbox")
});

export const env = EnvSchema.parse(process.env);

export function getCorsOrigins(): true | string[] {
  if (env.CORS_ORIGINS === "*") {
    return true;
  }

  return env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
