import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, draftsFrom, estimateManufacturing, expenseSummary, expensesPayloadFrom } from "../recipe-expenses";

const saved = [
  { category: "MANPOWER", label: "Manpower", enabled: true, basis: "PER_BATCH", rate: 15, sizeRates: [] },
  { category: "ELECTRICITY", label: "Electricity", enabled: true, basis: "PER_KG", rate: 2, sizeRates: [] },
  { category: "OTHER", label: "Other Expenses", enabled: true, basis: "PER_PACKET", rate: 1, sizeRates: [] },
  { category: "PACKAGING_MATERIAL", label: "Packaging Materials", enabled: true, basis: "PER_PACKET", rate: null, sizeRates: [{ packetSize: "250g", rate: 2 }, { packetSize: "1kg", rate: 5 }] },
];

describe("recipe additional expenses", () => {
  it("starts with four disabled categories and sends ₹0 / no common rate when nothing is entered", () => {
    const drafts = draftsFrom(null, DEFAULT_CATEGORIES);
    expect(drafts.map((d) => d.category)).toEqual(["MANPOWER", "ELECTRICITY", "OTHER", "PACKAGING_MATERIAL"]);
    const { payload, error } = expensesPayloadFrom(drafts);
    expect(error).toBeNull();
    expect(payload.every((p) => !p.enabled)).toBe(true);
    expect(payload[0].rate).toBe(0);
    expect(payload[3].rate).toBeNull();
  });

  it("round-trips a saved configuration", () => {
    const { payload, error } = expensesPayloadFrom(draftsFrom(saved, DEFAULT_CATEGORIES));
    expect(error).toBeNull();
    expect(payload).toEqual(saved.map(({ label, ...rest }) => rest));
  });

  it("rejects negative and invalid amounts and bad pack sizes", () => {
    const drafts = draftsFrom(saved, DEFAULT_CATEGORIES);
    expect(expensesPayloadFrom(drafts.map((d) => (d.category === "MANPOWER" ? { ...d, rate: "-5" } : d))).error).toMatch(/cannot be negative/);
    expect(expensesPayloadFrom(drafts.map((d) => (d.category === "MANPOWER" ? { ...d, rate: "1e999" } : d))).error).toMatch(/valid amount/);
    const pm = drafts[3];
    expect(expensesPayloadFrom([{ ...pm, sizeRates: [{ key: "a", packetSize: "big", rate: "2" }] }]).error).toMatch(/number with a unit/);
    expect(expensesPayloadFrom([{ ...pm, sizeRates: [{ key: "a", packetSize: "250g", rate: "" }] }]).error).toMatch(/enter an amount/);
  });

  it("estimates manufacturing expenses like Complete Production (₹15 + ₹2 × 15 KG; per packet deferred)", () => {
    const est = estimateManufacturing(saved, 15, "KG");
    expect(est.total).toBe(45);
    expect(est.lines.map((l) => [l.category, l.amount])).toEqual([["MANPOWER", 15], ["ELECTRICITY", 30]]);
    expect(est.deferred).toEqual([{ category: "OTHER", label: "Other Expenses", rate: 1 }]);
    expect(estimateManufacturing(saved, 15000, "G").total).toBe(45);
    expect(estimateManufacturing(saved, 10, "PCS").error).toMatch(/Per KG/);
  });

  it("summarises enabled expenses for the recipe list", () => {
    expect(expenseSummary(saved)).toEqual(["Manpower ₹15/batch", "Electricity ₹2/kg", "Other Expenses ₹1/pkt", "Packaging Materials ₹2–5/pkt"]);
    expect(expenseSummary(null)).toEqual([]);
  });
});
