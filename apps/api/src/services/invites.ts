import { env } from "../config/env.js";
import { notFound } from "../utils/api-error.js";

function appBase(): string {
  return env.APP_BASE_URL.replace(/\/?$/, "/");
}

export type InviteKind = "session" | "group";

/** QR/share URL that opens create-session after the person signs in as host. */
export function buildCreateSessionUrl(): string {
  return `${appBase()}create`;
}

export function buildInviteUrl(kind: InviteKind, token: string): string {
  return `${appBase()}join/${kind}/${token}`;
}

export function inviteExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isInviteExpired(invite: { expiresAt: Date | null }): boolean {
  if (!invite.expiresAt) {
    return true;
  }
  return invite.expiresAt.getTime() <= Date.now();
}

export function assertInviteActive(invite: { expiresAt: Date | null }): void {
  if (isInviteExpired(invite)) {
    throw notFound("Invite expired");
  }
}
