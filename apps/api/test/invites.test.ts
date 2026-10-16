import { describe, expect, it } from "vitest";
import {
  buildCreateSessionUrl,
  buildInviteUrl,
  isInviteExpired
} from "../src/services/invites.js";

describe("isInviteExpired", () => {
  it("treats a missing expiry as expired", () => {
    expect(isInviteExpired({ expiresAt: null })).toBe(true);
  });

  it("treats a past expiry as expired", () => {
    expect(isInviteExpired({ expiresAt: new Date(Date.now() - 1000) })).toBe(true);
  });

  it("treats a future expiry as active", () => {
    expect(isInviteExpired({ expiresAt: new Date(Date.now() + 60_000) })).toBe(
      false
    );
  });
});

describe("invite URLs", () => {
  it("builds create / session-join / group-join links", () => {
    expect(buildCreateSessionUrl()).toMatch(/create$/);
    expect(buildInviteUrl("session", "abc")).toContain("join/session/abc");
    expect(buildInviteUrl("group", "xyz")).toContain("join/group/xyz");
  });
});
