import { describe, expect, it } from "vitest";
import {
  backoffMs,
  buildPayload,
  preferenceAllows
} from "../src/services/notification-delivery.js";

describe("backoffMs", () => {
  it("grows exponentially and caps at one hour", () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(240_000);
    expect(backoffMs(20)).toBe(60 * 60_000);
  });
});

describe("preferenceAllows", () => {
  const pref = (over: Record<string, boolean>) =>
    ({
      remindersEnabled: true,
      statusChangesEnabled: true,
      waitlistEnabled: true,
      ...over
    }) as any;

  it("defaults to allow when there is no preference row", () => {
    expect(preferenceAllows("SESSION_REMINDER", null)).toBe(true);
  });

  it("maps each type to its preference flag", () => {
    expect(preferenceAllows("SESSION_REMINDER", pref({ remindersEnabled: false }))).toBe(false);
    expect(preferenceAllows("WAITLIST_PROMOTION", pref({ waitlistEnabled: false }))).toBe(false);
    expect(preferenceAllows("SESSION_CANCELLED", pref({ statusChangesEnabled: false }))).toBe(false);
    expect(preferenceAllows("SESSION_CHANGED", pref({ statusChangesEnabled: false }))).toBe(false);
    expect(preferenceAllows("SESSION_REMINDER", pref({}))).toBe(true);
  });
});

describe("buildPayload", () => {
  it("builds a per-type title/body using the session name", () => {
    expect(buildPayload("SESSION_REMINDER", { title: "Friday" }).body).toContain("Friday");
    expect(buildPayload("SESSION_CANCELLED", { title: "Friday" }).title).toBe("Session cancelled");
    expect(buildPayload("WAITLIST_PROMOTION", null).body).toContain("your session");
  });
});
