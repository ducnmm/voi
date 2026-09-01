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
 * Verifies a Google ID token (issued to the iOS app) against Google's public
 * keys and our configured client ID, returning the verified identity.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!env.GOOGLE_IOS_CLIENT_ID) {
    throw new Error("Google sign-in is not configured");
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_IOS_CLIENT_ID
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new Error("Invalid Google token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture
  };
}
