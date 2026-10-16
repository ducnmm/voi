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
  // PaaS injects PORT; local .env uses API_PORT. Either is enough.
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().optional(),
  API_VERSION: z.literal("v1").default("v1"),
  APP_BASE_URL: z.string().default("voi://"),
  // Origin only (no /v1). Used for absolute upload URLs behind a proxy.
  PUBLIC_API_URL: z
    .union([z.string().url(), z.literal("")])
    .optional(),
  RAILWAY_PUBLIC_DOMAIN: z.string().min(1).optional(),
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

export function resolveListenPort(input: {
  apiPort?: number;
  port?: number;
}): number {
  return input.apiPort ?? input.port ?? 43187;
}

export function resolvePublicApiOrigin(input: {
  publicApiUrl?: string;
  railwayPublicDomain?: string;
  protocol: string;
  host: string;
}): string {
  if (input.publicApiUrl) {
    return originFromUrl(input.publicApiUrl);
  }
  if (input.railwayPublicDomain) {
    return originFromUrl(`https://${input.railwayPublicDomain}`);
  }
  return `${input.protocol}://${input.host}`;
}

/** Strip path (/v1) so upload URLs hit the static /uploads mount. */
export function originFromUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return trimmed.replace(/\/v1$/i, "");
  }
}

export function corsOriginsFor(
  nodeEnv: string,
  corsOrigins: string
): true | string[] {
  if (corsOrigins === "*") {
    if (nodeEnv === "production") {
      return [];
    }
    return true;
  }

  return corsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function missingProductionSecrets(input: {
  nodeEnv: string;
  jwtSecret?: string;
  googleIosClientId?: string;
}): string[] {
  if (input.nodeEnv !== "production") {
    return [];
  }
  const missing: string[] = [];
  if (!input.jwtSecret?.trim()) {
    missing.push("JWT_SECRET");
  }
  if (!input.googleIosClientId?.trim()) {
    missing.push("GOOGLE_IOS_CLIENT_ID");
  }
  return missing;
}

const parsed = EnvSchema.parse(process.env);

const missing = missingProductionSecrets({
  nodeEnv: parsed.NODE_ENV,
  jwtSecret: parsed.JWT_SECRET,
  googleIosClientId: parsed.GOOGLE_IOS_CLIENT_ID
});
if (missing.length > 0) {
  const verb = missing.length === 1 ? "is" : "are";
  throw new Error(`${missing.join(", ")} ${verb} required when NODE_ENV=production`);
}

export const env = {
  ...parsed,
  API_PORT: resolveListenPort({
    apiPort: parsed.API_PORT,
    port: parsed.PORT
  }),
  JWT_SECRET: parsed.JWT_SECRET ?? "development-jwt-secret",
  REDIS_URL: parsed.REDIS_URL ? parsed.REDIS_URL : undefined,
  PUBLIC_API_URL: parsed.PUBLIC_API_URL ? parsed.PUBLIC_API_URL : undefined
};

export function getCorsOrigins(): true | string[] {
  return corsOriginsFor(env.NODE_ENV, env.CORS_ORIGINS);
}

export function publicApiOrigin(protocol: string, host: string): string {
  return resolvePublicApiOrigin({
    publicApiUrl: env.PUBLIC_API_URL || undefined,
    railwayPublicDomain: env.RAILWAY_PUBLIC_DOMAIN,
    protocol,
    host
  });
}
