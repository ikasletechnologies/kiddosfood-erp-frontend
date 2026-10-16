import { describe, it, expect } from "vitest";
import { allocationProfit, applyLotSelection, catalogPrice, currentLotQuantities, fifoSuggestion, priceCheck, splitRowIntoLots, summarizeAllocations, SaleLot } from "../lot-pricing";

const lot = (id: string, availableQty: number, selectable = true): SaleLot => ({
  id, lotNumber: `L-${id}`, batchNumber: `B-${id}`, productId: "p", productName: "APPAM 500g", sku: "FG-APM-500G", unit: "packet",
  packSize: "500g", productionBatchCode: null, productionDate: null, packagingDate: null, expiryDate: null, warehouse: null,
  location: "HQ", producedQty: availableQty, currentQty: availableQty, reservedQty: 0, availableQty, taxPercent: 5,
  pricingStatus: selectable ? "PRICED" : "PRICING_PENDING", sellingPrice: 100, priceTaxInclusive: false,
  sellingPriceExclTax: 100, sellingPriceInclTax: 105, masterPrice: null, selectable,
});

describe("lot-pricing", () => {
  it("totals lot allocations exactly; average is display only", () => {
    const s = summarizeAllocations([
      { quantity: 5, price: 100, unitCost: 80 },
      { quantity: 50, price: 200, unitCost: 170 },
    ]);
    expect(s.totalQuantity).toBe(55);
    expect(s.totalValue).toBe(10500);
    expect(s.weightedAvgPrice).toBe(190.91);
    expect(s.profit).toBe(1600);
    expect(s.weightedAvgCost).toBe(161.82); // (5×80 + 50×170) / 55
    // Rebuilding from the rounded average would give ₹10,500.05 — never used.
    expect(s.totalValue).not.toBe(190.91 * 55);
  });

  it("warns per lot when sold below cost, even if the order is profitable overall", () => {
    const a = allocationProfit({ lotNumber: "A", quantity: 5, price: 100, unitCost: 117 });
    expect(a.unitProfit).toBe(-17);
    expect(a.lineProfit).toBe(-85);
    expect(a.warning).toBe("Lot A is being sold ₹17 below production cost per packet. Estimated loss for 5 packets: ₹85.");
    expect(allocationProfit({ lotNumber: "B", quantity: 50, price: 200, unitCost: 170 }).warning).toBeNull();
  });

  it("Set Price check works on the price excluding GST", () => {
    expect(priceCheck(100, false, 5, 117).warning).toBe("Warning: Selling price is ₹17 below production cost per packet. Estimated loss: ₹17 per packet.");
    const incl = priceCheck(105, true, 5, 80);
    expect(incl.priceExclTax).toBe(100);
    expect(incl.unitProfit).toBe(20);
    expect(incl.marginPct).toBe(20);
    expect(priceCheck(100, false, 5, null).unitProfit).toBeNull();
  });

  it("suggests oldest selectable lots first and skips unpriced lots", () => {
    expect(fifoSuggestion([lot("A", 30), lot("P", 99, false), lot("B", 70)], 55)).toEqual({ A: 30, B: 25 });
    expect(fifoSuggestion([lot("A", 30)], 10)).toEqual({ A: 10 });
  });

  it("re-selecting lots replaces all lot rows of that product, in place", () => {
    type R = { id: string; productId: string; lotId?: string; qty: number };
    const rows: R[] = [
      { id: "1", productId: "other", qty: 1 },
      { id: "2", productId: "appam", lotId: "A", qty: 5 },
      { id: "3", productId: "appam", lotId: "B", qty: 50 },
      { id: "4", productId: "other2", qty: 2 },
    ];
    const key = (r: R) => ({ productId: r.productId, lotId: r.lotId, qty: r.qty });
    expect(currentLotQuantities(rows, "appam", key)).toEqual({ A: 5, B: 50 });
    const out = applyLotSelection(rows, 2, [
      { lotId: "B", lotNumber: "L-B", batchNumber: "B", quantity: 10, price: 200, unitCost: null, taxPercent: 5 },
    ], key, (base, a) => ({ ...base, id: `n-${a.lotId}`, lotId: a.lotId, qty: a.quantity }));
    expect(out.map((r) => `${r.id}:${r.lotId ?? ""}:${r.qty}`)).toEqual(["1::1", "n-B:B:10", "4::2"]);
    // A plain (non-lot) row becomes the lot rows where it stood.
    const plain = applyLotSelection([{ id: "x", productId: "appam", qty: 3 }, { id: "y", productId: "z", qty: 1 }] as R[], 0, [
      { lotId: "A", lotNumber: "L-A", batchNumber: "A", quantity: 3, price: 100, unitCost: null, taxPercent: 5 },
    ], key, (base, a) => ({ ...base, lotId: a.lotId }));
    expect(plain.map((r) => `${r.id}:${r.lotId ?? ""}`)).toEqual(["x:A", "y:"]);
  });

  it("search shows the lot price instead of ₹0 / No price", () => {
    const one = { pricedLots: 1, pendingLots: 1, pricedQty: 6, pendingQty: 2, minPrice: 500, maxPrice: 500 };
    expect(catalogPrice(0, one)).toMatchObject({ price: 500, label: "₹500", source: "LOT" });
    expect(catalogPrice(150, { ...one, pricedLots: 2, minPrice: 100, maxPrice: 200 })).toMatchObject({ price: null, label: "₹100–₹200", source: "LOT" });
    expect(catalogPrice(150, null)).toMatchObject({ price: 150, source: "MASTER" });
    expect(catalogPrice(0, { ...one, pricedLots: 0, minPrice: null, maxPrice: null })).toMatchObject({ label: "Awaiting Price", source: "PENDING" });
    expect(catalogPrice(0, null).label).toBe("No price");
  });

  it("splits one row into one row per lot, keeping other rows", () => {
    const rows = [{ id: "x" }, { id: "y" }, { id: "z" }];
    const out = splitRowIntoLots(rows, 1, [
      { lotId: "A", lotNumber: "L-A", batchNumber: "B-A", quantity: 5, price: 100, unitCost: null, taxPercent: 5 },
      { lotId: "B", lotNumber: "L-B", batchNumber: "B-B", quantity: 50, price: 200, unitCost: null, taxPercent: 5 },
    ], (base, a) => ({ id: `${base.id}-${a.lotId}` }));
    expect(out.map((r) => r.id)).toEqual(["x", "y-A", "y-B", "z"]);
  });
});
