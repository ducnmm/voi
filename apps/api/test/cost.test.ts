import { describe, expect, it } from "vitest";
import {
  calculatePerPlayerCostVnd,
  calculateTotalCostVnd
} from "../src/services/cost.js";

describe("cost service", () => {
  it("uses integer VND amounts", () => {
    expect(
      calculateTotalCostVnd({
        feeTotalVnd: 240000,
        shuttlecockCostVnd: 60000
      })
    ).toBe(300000);
  });

  it("splits cost across joined players", () => {
    expect(
      calculatePerPlayerCostVnd({
        feeTotalVnd: 240000,
        shuttlecockCostVnd: 60000,
        joinedPlayerCount: 8
      })
    ).toBe(37500);
  });

  it("does not divide by zero", () => {
    expect(
      calculatePerPlayerCostVnd({
        feeTotalVnd: 240000,
        shuttlecockCostVnd: 60000,
        joinedPlayerCount: 0
      })
    ).toBeNull();
  });

  it("uses the fixed per-player price when the host sets one", () => {
    expect(
      calculatePerPlayerCostVnd({
        feePerPlayerVnd: 80000,
        joinedPlayerCount: 5
      })
    ).toBe(80000);
  });

  it("keeps the fixed price even with zero joined players", () => {
    expect(
      calculatePerPlayerCostVnd({
        feePerPlayerVnd: 80000,
        joinedPlayerCount: 0
      })
    ).toBe(80000);
  });

  it("totals the fixed price across joined players", () => {
    expect(
      calculateTotalCostVnd({
        feePerPlayerVnd: 80000,
        joinedPlayerCount: 6
      })
    ).toBe(480000);
  });
});
