import { describe, it, expect } from "vitest";
import { plannedYieldOf, yieldVariance, fmtSigned } from "../production-yield";

describe("production-yield", () => {
  it("uses the stored plan when present, never the current recipe", () => {
    expect(plannedYieldOf({ plannedYieldQty: 10, plannedYieldUnit: "KG", quantity: 4, recipe: { yieldQty: 3, yieldUnit: "KG" } }))
      .toEqual({ qty: 10, unit: "KG" });
  });

  it("derives the plan for older runs as runs × recipe yield", () => {
    expect(plannedYieldOf({ quantity: 2, recipe: { yieldQty: 10, yieldUnit: "KG" } })).toEqual({ qty: 20, unit: "KG" });
    expect(plannedYieldOf({ quantity: 0, recipe: { yieldQty: 10 } }).qty).toBeNull();
    expect(plannedYieldOf(null)).toEqual({ qty: null, unit: "KG" });
  });

  it("computes difference and variance % (10 → 15 = +5, +50%; lower and equal)", () => {
    expect(yieldVariance(10, 15)).toEqual({ difference: 5, pct: 50 });
    expect(yieldVariance(10, 8)).toEqual({ difference: -2, pct: -20 });
    expect(yieldVariance(10, 10)).toEqual({ difference: 0, pct: 0 });
    expect(yieldVariance(10, 10.125)).toEqual({ difference: 0.125, pct: 1.25 });
    expect(yieldVariance(null, 10)).toEqual({ difference: null, pct: null });
    expect(yieldVariance(0, 10).pct).toBeNull();
  });

  it("formats signed values", () => {
    expect(fmtSigned(5, " KG")).toBe("+5 KG");
    expect(fmtSigned(-20, "%")).toBe("-20%");
    expect(fmtSigned(null)).toBe("—");
  });
});
