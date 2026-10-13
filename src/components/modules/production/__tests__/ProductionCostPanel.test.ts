import { describe, it, expect } from "vitest";
import { expensesPayload, ExpenseDraft } from "../ProductionCostPanel";

const rows = [{ key: "r500" }, { key: "r1kg" }];
const line = (p: Partial<ExpenseDraft>): ExpenseDraft => ({ id: Math.random().toString(), category: "MANPOWER", basis: "PER_PACKET", amount: "1", rowKey: "", ...p });

describe("expensesPayload", () => {
  it("sends ₹5 per packet across four categories, for all pack sizes", () => {
    const { lines, error } = expensesPayload([
      line({ category: "MANPOWER", amount: "1" }),
      line({ category: "ELECTRICITY", amount: "1" }),
      line({ category: "OTHER", amount: "1" }),
      line({ category: "PACKAGING_MATERIAL", amount: "2" }),
    ], rows);
    expect(error).toBeNull();
    expect(lines.reduce((s, l) => s + l.rate, 0)).toBe(5);
    expect(lines.every((l) => l.row === null)).toBe(true);
  });

  it("maps a pack-size-specific line to its row index; per-batch lines never carry a row", () => {
    const { lines } = expensesPayload([
      line({ category: "PACKAGING_MATERIAL", rowKey: "r1kg", amount: "3" }),
      line({ category: "MANPOWER", basis: "PER_BATCH", amount: "240", rowKey: "r500" }),
    ], rows);
    expect(lines[0].row).toBe(1);
    expect(lines[1]).toEqual({ category: "MANPOWER", basis: "PER_BATCH", rate: 240, row: null });
  });

  it("ignores blank amounts; rejects negative amounts, removed rows and duplicate per-batch categories", () => {
    expect(expensesPayload([line({ amount: "" })], rows)).toEqual({ lines: [], error: null }); // ticked but no amount yet: not charged
    expect(expensesPayload([line({ amount: "-1" })], rows).error).toMatch(/amount/);
    expect(expensesPayload([line({ rowKey: "gone" })], rows).error).toMatch(/removed/);
    expect(expensesPayload([line({ basis: "PER_BATCH", amount: "1" }), line({ basis: "PER_BATCH", amount: "2" })], rows).error).toMatch(/one per-batch/);
  });
});
