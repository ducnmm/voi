import { describe, expect, it } from "vitest";
import {
  compareSessionsBy,
  decodeSessionCursor,
  encodeSessionCursor
} from "../src/services/session-feed.js";

describe("session feed cursor", () => {
  it("round-trips a cursor", () => {
    const startsAt = new Date("2026-07-01T12:00:00.000Z");
    const decoded = decodeSessionCursor(
      encodeSessionCursor({ startsAt, id: "abc" })
    );
    expect(decoded?.id).toBe("abc");
    expect(decoded?.startsAt.toISOString()).toBe(startsAt.toISOString());
  });

  it("rejects malformed cursors", () => {
    expect(decodeSessionCursor("nonsense")).toBeNull();
    expect(decodeSessionCursor("not-a-date|abc")).toBeNull();
  });

  it("keeps an id that contains the separator character", () => {
    const startsAt = new Date("2026-07-01T12:00:00.000Z");
    const decoded = decodeSessionCursor(
      encodeSessionCursor({ startsAt, id: "a|b" })
    );
    expect(decoded?.id).toBe("a|b");
  });
});

describe("session feed sort", () => {
  const at = new Date("2026-07-01T12:00:00.000Z");

  it("sorts by price cheapest first", () => {
    const rows = [
      { startsAt: at, id: "a", perPlayerCostVnd: 80000, availableSlots: 2 },
      { startsAt: at, id: "b", perPlayerCostVnd: 50000, availableSlots: 1 }
    ];
    expect(rows.sort(compareSessionsBy("price", "upcoming"))[0].id).toBe("b");
  });

  it("treats a null price as most expensive", () => {
    const rows = [
      { startsAt: at, id: "a", perPlayerCostVnd: null, availableSlots: 1 },
      { startsAt: at, id: "b", perPlayerCostVnd: 90000, availableSlots: 1 }
    ];
    expect(rows.sort(compareSessionsBy("price", "upcoming"))[0].id).toBe("b");
  });

  it("sorts by spots most-open first", () => {
    const rows = [
      { startsAt: at, id: "a", perPlayerCostVnd: 0, availableSlots: 1 },
      { startsAt: at, id: "b", perPlayerCostVnd: 0, availableSlots: 5 }
    ];
    expect(rows.sort(compareSessionsBy("spots", "upcoming"))[0].id).toBe("b");
  });

  it("orders upcoming dates soonest-first", () => {
    const rows = [
      {
        startsAt: new Date("2026-07-02T12:00:00.000Z"),
        id: "a",
        perPlayerCostVnd: 0,
        availableSlots: 0
      },
      {
        startsAt: new Date("2026-07-01T12:00:00.000Z"),
        id: "b",
        perPlayerCostVnd: 0,
        availableSlots: 0
      }
    ];
    expect(rows.sort(compareSessionsBy("date", "upcoming"))[0].id).toBe("b");
  });
});
