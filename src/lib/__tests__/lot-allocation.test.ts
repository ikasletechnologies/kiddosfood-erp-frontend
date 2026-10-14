import { describe, it, expect } from "vitest";
import { fifoDraft, allocatedTotal, allocationCost, allocationError, toPayload, UNTRACKED, MaterialLots } from "../lot-allocation";

const rice: MaterialLots = {
  inventoryItemId: "rice",
  name: "Rice",
  unit: "KG",
  averageCost: 150,
  untrackedQty: 0,
  lots: [
    { id: "A", lotNumber: "LOT-A", supplier: "Sri Mills", receivedAt: null, expDate: null, availableQty: 10, unitCost: 100 },
    { id: "B", lotNumber: "LOT-B", supplier: "Agro", receivedAt: null, expDate: null, availableQty: 10, unitCost: 200 },
  ],
};

describe("lot-allocation", () => {
  it("prefills oldest lot first", () => {
    expect(fifoDraft(rice, 12)).toEqual({ A: "10", B: "2" });
    expect(fifoDraft(rice, 4)).toEqual({ A: "4", B: "" });
  });

  it("costs a split allocation: 5 KG @ ₹100 + 5 KG @ ₹200 = ₹1,500", () => {
    const draft = { A: "5", B: "5" };
    expect(allocatedTotal(draft)).toBe(10);
    expect(allocationCost(rice, draft)).toBe(1500);
    expect(allocationError(rice, draft, 10)).toBeNull();
    expect(toPayload(draft)).toEqual([{ batchId: "A", qty: 5 }, { batchId: "B", qty: 5 }]);
  });

  it("requires the total to match and each lot to hold its share", () => {
    expect(allocationError(rice, { A: "4", B: "5" }, 10)).toMatch(/Allocate 1 KG more/);
    expect(allocationError(rice, { A: "6", B: "5" }, 10)).toMatch(/too much/);
    expect(allocationError(rice, { A: "11", B: "" }, 11)).toMatch(/LOT-A has only 10 KG/);
    expect(allocationError(rice, { A: "-1", B: "11" }, 10)).toMatch(/0 or more/);
  });

  it("uses untracked stock at average cost after the lots", () => {
    const m = { ...rice, untrackedQty: 3 };
    const d = fifoDraft(m, 22);
    expect(d).toEqual({ A: "10", B: "10", [UNTRACKED]: "2" });
    expect(allocationCost(m, d)).toBe(1000 + 2000 + 300);
    expect(toPayload(d)).toContainEqual({ batchId: null, qty: 2 });
  });
});
