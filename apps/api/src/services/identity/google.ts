import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";

const client = new OAuth2Client();

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Verifies a Google ID token (issued to the iOS or web app) against Google's public
 * keys and our configured client ID, returning the verified identity.
 */
export async function verifyGoogleIdToken(
  idToken: string,
): Promise<GoogleIdentity> {
  const audiences = [env.GOOGLE_IOS_CLIENT_ID, env.GOOGLE_WEB_CLIENT_ID].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  if (audiences.length === 0) {
    throw new Error("Google sign-in is not configured");
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: audiences,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new Error("Invalid Google token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}
