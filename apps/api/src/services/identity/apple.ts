import { createPublicKey, verify, type KeyObject } from "node:crypto";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const KEY_CACHE_MS = 60 * 60 * 1000;
const EXPIRY_SKEW_SEC = 60;

export interface AppleIdentity {
  sub: string;
  email?: string;
}

interface AppleJwk extends JsonWebKey {
  kid: string;
}

let keyCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;

export function clearAppleKeyCache(): void {
  keyCache = null;
}

/**
 * Verifies a Sign in with Apple identity token (RS256) against Apple's JWKS.
 * `audience` is the iOS bundle id (`aud` on a native token).
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  audience: string
): Promise<AppleIdentity> {
  const parts = identityToken.split(".");
  const headerPart = parts[0];
  const payloadPart = parts[1];
  const signaturePart = parts[2];
  if (
    parts.length !== 3 ||
    !headerPart ||
    !payloadPart ||
    !signaturePart
  ) {
    throw new Error("Invalid Apple token");
  }

  const header = decodePart(headerPart);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new Error("Invalid Apple token header");
  }

  const jwk = await signingKey(header.kid);
  const key = publicKeyFromJwk(jwk);
  const signed = Buffer.from(`${headerPart}.${payloadPart}`);
  const signature = Buffer.from(signaturePart, "base64url");
  if (!verify("RSA-SHA256", signed, key, signature)) {
    throw new Error("Invalid Apple token signature");
  }

  const payload = decodePart(payloadPart);
  if (payload.iss !== APPLE_ISSUER) {
    throw new Error("Invalid Apple token issuer");
  }
  if (!audienceMatches(payload.aud, audience)) {
    throw new Error("Invalid Apple token audience");
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + EXPIRY_SKEW_SEC <= now) {
    throw new Error("Apple token expired");
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Apple token missing subject");
  }

  return { sub: payload.sub, email: verifiedEmail(payload) };
}

function publicKeyFromJwk(jwk: AppleJwk): KeyObject {
  if (jwk.kty !== "RSA" || typeof jwk.n !== "string" || typeof jwk.e !== "string") {
    throw new Error("Invalid Apple signing key");
  }
  return createPublicKey({
    key: { kty: "RSA", n: jwk.n, e: jwk.e },
    format: "jwk"
  });
}

async function signingKey(kid: string): Promise<AppleJwk> {
  const cached = await loadKeys(false);
  const found = cached.find((key) => key.kid === kid);
  if (found) {
    return found;
  }
  const refreshed = await loadKeys(true);
  const retry = refreshed.find((key) => key.kid === kid);
  if (!retry) {
    throw new Error("Unknown Apple signing key");
  }
  return retry;
}

async function loadKeys(force: boolean): Promise<AppleJwk[]> {
  if (!force && keyCache && Date.now() - keyCache.fetchedAt < KEY_CACHE_MS) {
    return keyCache.keys;
  }
  const response = await fetch(APPLE_KEYS_URL);
  if (!response.ok) {
    throw new Error("Could not load Apple signing keys");
  }
  const body = (await response.json()) as { keys?: AppleJwk[] };
  if (!body.keys?.length) {
    throw new Error("Apple signing keys were empty");
  }
  keyCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

function decodePart(part: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid Apple token");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Apple token");
  }
  return value as Record<string, unknown>;
}

function audienceMatches(aud: unknown, expected: string): boolean {
  if (typeof aud === "string") {
    return aud === expected;
  }
  return Array.isArray(aud) && aud.some((value) => value === expected);
}

function verifiedEmail(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.email !== "string" || !payload.email.includes("@")) {
    return undefined;
  }
  const verified =
    payload.email_verified === true || payload.email_verified === "true";
  if (!verified) {
    throw new Error("Apple email is not verified");
  }
  return payload.email;
}
