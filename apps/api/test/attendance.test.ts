import { describe, expect, it } from "vitest";
import {
  calculateNextWaitlistPosition,
  resolveJoinStatus
} from "../src/services/attendance.js";

describe("attendance service", () => {
  it("joins when capacity is available", () => {
    expect(
      resolveJoinStatus({
        joinedCount: 7,
        maxPlayers: 8
      })
    ).toBe("JOINED");
  });

  it("waitlists when capacity is full", () => {
    expect(
      resolveJoinStatus({
        joinedCount: 8,
        maxPlayers: 8
      })
    ).toBe("WAITLISTED");
  });

  it("keeps an existing joined participant joined", () => {
    expect(
      resolveJoinStatus({
        joinedCount: 8,
        maxPlayers: 8,
        existingStatus: "JOINED"
      })
    ).toBe("JOINED");
  });

  it("calculates the next stable waitlist position", () => {
    expect(calculateNextWaitlistPosition([1, 2, null, 4])).toBe(5);
  });
});
