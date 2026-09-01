import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consumeToken,
  resetMemoryRateLimits
} from "../src/services/rate-limit.js";

afterEach(() => {
  resetMemoryRateLimits();
  vi.useRealTimers();
});

describe("consumeToken (memory)", () => {
  it("allows up to max uses in the window then rejects", async () => {
    expect(await consumeToken("k", 2, 10)).toBe(true);
    expect(await consumeToken("k", 2, 10)).toBe(true);
    expect(await consumeToken("k", 2, 10)).toBe(false);
  });

  it("resets after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T12:00:00Z"));
    expect(await consumeToken("k2", 1, 1)).toBe(true);
    expect(await consumeToken("k2", 1, 1)).toBe(false);
    vi.setSystemTime(new Date("2026-09-01T12:00:01.050Z"));
    expect(await consumeToken("k2", 1, 1)).toBe(true);
  });

  it("tracks keys independently", async () => {
    expect(await consumeToken("a", 1, 10)).toBe(true);
    expect(await consumeToken("b", 1, 10)).toBe(true);
    expect(await consumeToken("a", 1, 10)).toBe(false);
  });
});
