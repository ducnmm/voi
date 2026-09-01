import { env } from "../config/env.js";
import { notFound } from "../utils/api-error.js";

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
