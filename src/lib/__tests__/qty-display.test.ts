import { describe, expect, it } from "vitest";
import { autoQty, convertQty, defaultDisplayUnit, formatQty, maxMultiplierFor, roundForDisplay, roundRequirement } from "../qty-display";

describe("ingredient quantity display", () => {
  it.each([
    [0.08877, "89 g"],
    [0.02427, "25 g"],
    [0.16181, "162 g"],
    [0.48544, "486 g"],
    [0.5, "500 g"],
    [0.025, "25 g"],
    [0.001, "1 g"],
    [1, "1 KG"],
    [1.5, "1.5 KG"],
    [1.375405, "1.375 KG"],
    [10, "10 KG"],
  ])("%s KG shows as %s", (kg, text) => {
    expect(formatQty(kg, "KG")).toBe(text);
    expect(formatQty(kg, "kg")).toBe(text);
  });

  it("rounds grams up to the whole gram from a gram unit too", () => {
    expect(formatQty(88.77, "G")).toBe("89 g");
    expect(formatQty(250, "G")).toBe("250 g");
    expect(formatQty(1534, "G")).toBe("1.534 KG");
  });

  it("whole grams are not bumped by float noise", () => {
    expect(formatQty(0.1 * 3, "KG")).toBe("300 g");
    expect(formatQty(0.025, "KG")).toBe("25 g");
  });

  it("stock on hand rounds down, never claiming more than there is", () => {
    expect(formatQty(0.08877, "KG", "down")).toBe("88 g");
    expect(formatQty(1.375905, "KG", "down")).toBe("1.375 KG");
    expect(formatQty(0.9999, "KG", "down")).toBe("999 g");
    expect(formatQty(0.0004, "KG", "down")).toBe("0.4 g");
  });

  it("volume: below 1 L in ml, from 1 L in L", () => {
    expect(formatQty(0.95, "L")).toBe("950 ml");
    expect(formatQty(1.25, "L")).toBe("1.25 L");
    expect(formatQty(1500, "ML")).toBe("1.5 L");
  });

  it("count units are left as they are", () => {
    expect(formatQty(12, "PCS")).toBe("12 PCS");
    expect(formatQty(0.5, "BOX")).toBe("0.5 BOX");
    expect(convertQty(1, "PCS", "KG")).toBeNull();
    expect(convertQty(1, "KG", "L")).toBeNull();
  });

  it("never shows a small positive requirement as 0", () => {
    expect(formatQty(0.000001, "KG")).toBe("1 g");
    expect(roundForDisplay(0.0004, 2)).toBe(0.0004);
    expect(formatQty(0, "KG")).toBe("0 g");
  });

  it("does not show 1000 g for a value that rounds to 1 KG", () => {
    expect(formatQty(0.9992, "KG")).toBe("1 KG");
  });

  it("keeps the exact value alongside the rounded one, and converts exactly", () => {
    const d = autoQty(0.0242718446, "KG");
    expect(d.unit).toBe("g");
    expect(d.shown).toBe(25);
    expect(d.value).toBeCloseTo(24.2718446, 9);
    expect(convertQty(24.27, "g", "KG")).toBe(0.02427);
    expect(convertQty(400, "g", "kg")).toBe(0.4);
    expect(defaultDisplayUnit("kg")).toBe("KG");
    expect(defaultDisplayUnit("G")).toBe("g");
  });
});

describe("planning requirement rounding policy", () => {
  it("weights below 1 KG are consumed up to the next whole gram", () => {
    expect(roundRequirement(0.08877, "KG")).toBe(0.089);
    expect(roundRequirement(24.27, "G")).toBe(25);
    expect(roundRequirement(999.2, "G")).toBe(1000);
    expect(roundRequirement(0.025, "KG")).toBe(0.025);
  });

  it("from 1 KG, volumes and count units are used as calculated", () => {
    expect(roundRequirement(1.375405, "KG")).toBe(1.375405);
    expect(roundRequirement(0.08877, "L")).toBe(0.08877);
    expect(roundRequirement(2.5, "PCS")).toBe(2.5);
    expect(roundRequirement(0, "KG")).toBe(0);
  });

  it("the requirement shown is exactly the requirement consumed", () => {
    const need = roundRequirement(0.0242718, "KG");
    expect(formatQty(need, "KG")).toBe("25 g");
    expect(need).toBe(0.025);
  });

  it("max batch accounts for the whole-gram round-up", () => {
    // 24.27 g per unit, 24.5 g in stock: 1 unit would need 25 g → not enough.
    const m = maxMultiplierFor(24.27, 24.5, "G");
    expect(roundRequirement(24.27 * m, "G")).toBeLessThanOrEqual(24.5);
    expect(m).toBeCloseTo(24 / 24.27, 9);
    // Above 1 KG nothing is rounded.
    expect(maxMultiplierFor(1.2, 2.4, "KG")).toBe(2);
  });
});
