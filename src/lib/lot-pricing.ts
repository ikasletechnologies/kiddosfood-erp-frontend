// Finished-goods lot pricing (Production > Set Price) and lot selection on sales
// documents / POS. The server is authoritative for every price, cost and
// stock check; these helpers only total and format what it returns, using
// the same rules (money in whole paise, averages for display only).

export const LOT_PRICING_PENDING = "PRICING_PENDING";
export const LOT_PRICED = "PRICED";

/** A lot as returned by /api/sales/lot-options and /api/sales/set-price/lots. */
export interface SaleLot {
  id: string;
  lotNumber: string;
  batchNumber: string;
  productId: string | null;
  productName: string;
  sku: string;
  unit: string;
  packSize: string | null;
  productionBatchCode: string | null;
  productionDate: string | null;
  packagingDate: string | null;
  expiryDate: string | null;
  warehouse: { id: string; name: string } | null;
  location: string;
  producedQty: number;
  currentQty: number;
  reservedQty: number;
  availableQty: number;
  taxPercent: number;
  pricingStatus: string;
  sellingPrice: number | null;
  priceTaxInclusive: boolean;
  sellingPriceExclTax: number | null;
  sellingPriceInclTax: number | null;
  masterPrice: number | null;
  /** Present only for roles allowed to see cost. */
  unitCost?: number | null;
  unitProfit?: number | null;
  marginPct?: number | null;
  belowCost?: boolean;
  sellable?: boolean;
  selectable?: boolean;
  pricedAt?: string | null;
  stockStatus?: string;
  category?: string | null;
}

/** Sellable Set Price lots of a product, as the product list API returns it (`lotPricing`). */
export interface LotPriceSummary {
  pricedLots: number;
  pendingLots: number;
  pricedQty: number;
  pendingQty: number;
  minPrice: number | null;
  maxPrice: number | null;
}

const rupee = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * The price a product search should show. Priced Set Price lots win (that is
 * what a lot sale charges): one price, or a range when lots differ. Otherwise
 * the master/channel price; otherwise "Awaiting Price" when lots exist but
 * none is priced yet; otherwise "No price". Never shows ₹0 as a price.
 */
export function catalogPrice(masterPrice: number | null | undefined, lots?: LotPriceSummary | null): {
  price: number | null; label: string; source: "LOT" | "MASTER" | "PENDING" | "NONE"; lotCount: number;
} {
  if (lots && lots.pricedLots > 0 && lots.minPrice != null) {
    const same = lots.maxPrice == null || Math.abs(lots.maxPrice - lots.minPrice) < 0.005;
    return {
      price: same ? lots.minPrice : null,
      label: same ? rupee(lots.minPrice) : `${rupee(lots.minPrice)}–${rupee(lots.maxPrice!)}`,
      source: "LOT",
      lotCount: lots.pricedLots,
    };
  }
  const master = Number(masterPrice) || 0;
  if (master > 0) return { price: master, label: rupee(master), source: "MASTER", lotCount: 0 };
  if (lots && lots.pendingLots > 0) return { price: null, label: "Awaiting Price", source: "PENDING", lotCount: 0 };
  return { price: null, label: "No price", source: "NONE", lotCount: 0 };
}

/** One lot's share of a sales line, as chosen in the lot selector. */
export interface LotAllocation {
  lotId: string;
  lotNumber: string;
  batchNumber: string;
  quantity: number;
  /** Selling price per packet excluding GST. */
  price: number;
  unitCost: number | null;
  taxPercent: number;
}

const paise = (rupees: number) => Math.round((Number(rupees) || 0) * 100);
const rupees = (p: number) => p / 100;

export const formatINR = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtAbs = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export interface AllocationSummary {
  totalQuantity: number;
  /** Σ quantity × lot price — exact, never rebuilt from the average. */
  totalValue: number;
  weightedAvgPrice: number | null;
  totalCost: number | null;
  weightedAvgCost: number | null;
  profit: number | null;
  marginPct: number | null;
  costUnavailableLots: number;
}

/** 5 × ₹100 + 50 × ₹200 → ₹10,500 over 55 packets; average ₹190.91 (display only). */
export function summarizeAllocations(allocations: Array<Pick<LotAllocation, "quantity" | "price" | "unitCost">>): AllocationSummary {
  const lines = allocations.filter((a) => Number(a.quantity) > 0);
  const qty = lines.reduce((s, a) => s + Number(a.quantity), 0);
  const valueP = lines.reduce((s, a) => s + Math.round(paise(a.price) * Number(a.quantity)), 0);
  const costed = lines.filter((a) => a.unitCost != null && Number.isFinite(Number(a.unitCost)));
  const costedQty = costed.reduce((s, a) => s + Number(a.quantity), 0);
  const costedValueP = costed.reduce((s, a) => s + Math.round(paise(a.price) * Number(a.quantity)), 0);
  const costP = costed.reduce((s, a) => s + Math.round(paise(a.unitCost as number) * Number(a.quantity)), 0);
  const profitP = costedValueP - costP;
  return {
    totalQuantity: qty,
    totalValue: rupees(valueP),
    weightedAvgPrice: qty > 0 ? rupees(Math.round(valueP / qty)) : null,
    totalCost: costed.length ? rupees(costP) : null,
    weightedAvgCost: costedQty > 0 ? rupees(Math.round(costP / costedQty)) : null,
    profit: costed.length ? rupees(profitP) : null,
    marginPct: costed.length && costedValueP > 0 ? Math.round((profitP / costedValueP) * 10000) / 100 : null,
    costUnavailableLots: lines.length - costed.length,
  };
}

/** Per-lot result for the selector: unit and line profit, and a warning when below cost. */
export function allocationProfit(a: Pick<LotAllocation, "lotNumber" | "quantity" | "price" | "unitCost">) {
  if (a.unitCost == null) return { unitProfit: null, lineProfit: null, warning: null as string | null };
  const unitP = paise(a.price) - paise(a.unitCost);
  const lineP = Math.round(unitP * Number(a.quantity || 0));
  return { unitProfit: rupees(unitP), lineProfit: rupees(lineP), warning: lotLossWarning(a.lotNumber, rupees(unitP), a.quantity, rupees(lineP)) };
}

/** "Lot A is being sold ₹17 below production cost per packet. Estimated loss for 5 packets: ₹85." */
export function lotLossWarning(label: string, unitProfit: number | null, quantity: number, lineProfit: number | null): string | null {
  if (unitProfit == null || lineProfit == null || !(lineProfit < 0)) return null;
  const qty = Number(quantity) || 0;
  const units = `${qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })} packet${qty === 1 ? "" : "s"}`;
  return `Lot ${label} is being sold ${fmtAbs(unitProfit)} below production cost per packet. Estimated loss for ${units}: ${fmtAbs(lineProfit)}.`;
}

/** Set Price check: "Warning: Selling price is ₹17 below production cost per packet. Estimated loss: ₹17 per packet." */
export function priceCheck(price: number, taxInclusive: boolean, taxPercent: number, unitCost: number | null | undefined) {
  const t = Math.max(0, Number(taxPercent) || 0);
  const exclP = taxInclusive ? Math.round(paise(price) / (1 + t / 100)) : paise(price);
  const inclP = taxInclusive ? paise(price) : Math.round(paise(price) * (1 + t / 100));
  if (unitCost == null || !(Number(unitCost) > 0)) {
    return { priceExclTax: rupees(exclP), priceInclTax: rupees(inclP), unitProfit: null, marginPct: null, belowCost: false, warning: null as string | null };
  }
  const profitP = exclP - paise(unitCost);
  return {
    priceExclTax: rupees(exclP),
    priceInclTax: rupees(inclP),
    unitProfit: rupees(profitP),
    marginPct: exclP > 0 ? Math.round((profitP / exclP) * 10000) / 100 : null,
    belowCost: profitP < 0,
    warning: profitP < 0
      ? `Warning: Selling price is ${fmtAbs(rupees(profitP))} below production cost per packet. Estimated loss: ${fmtAbs(rupees(profitP))} per packet.`
      : null,
  };
}

/** Suggested split of `quantity` over selectable lots, oldest first (what FIFO would issue). */
export function fifoSuggestion(lots: SaleLot[], quantity: number): Record<string, number> {
  let remaining = Math.max(0, Number(quantity) || 0);
  const out: Record<string, number> = {};
  for (const lot of lots) {
    if (!lot.selectable || remaining <= 0) continue;
    const take = Math.min(Math.floor(lot.availableQty), remaining);
    if (take > 0) { out[lot.id] = take; remaining -= take; }
  }
  return out;
}

export function toAllocation(lot: SaleLot, quantity: number): LotAllocation {
  return {
    lotId: lot.id,
    lotNumber: lot.lotNumber,
    batchNumber: lot.batchNumber,
    quantity,
    price: lot.sellingPriceExclTax ?? 0,
    unitCost: lot.unitCost ?? null,
    taxPercent: lot.taxPercent,
  };
}

/**
 * Lot selection on a document's lines. The clicked row and every other lot
 * row of the same product are replaced by one row per allocation, placed
 * where the first of them was — so re-opening the selector edits the whole
 * allocation instead of adding to it. `key` reads a row's product and lot.
 */
export function applyLotSelection<T>(
  rows: T[], idx: number, allocations: LotAllocation[],
  key: (r: T) => { productId?: string | null; lotId?: string | null },
  build: (base: T, a: LotAllocation, i: number) => T,
): T[] {
  const clicked = rows[idx];
  if (!clicked || !allocations.length) return rows;
  const productId = key(clicked).productId;
  const replaced = (r: T, i: number) => i === idx || (!!productId && key(r).productId === productId && !!key(r).lotId);
  const first = rows.findIndex(replaced);
  const kept = rows.filter((r, i) => !replaced(r, i));
  const insertAt = rows.slice(0, first).filter((r, i) => !replaced(r, i)).length;
  return [...kept.slice(0, insertAt), ...allocations.map((a, i) => build(clicked, a, i)), ...kept.slice(insertAt)];
}

/** Current quantities per lot for a product's lot rows (to re-open the selector with). */
export function currentLotQuantities<T>(rows: T[], productId: string, key: (r: T) => { productId?: string | null; lotId?: string | null; qty: number }): Record<string, number> {
  const out: Record<string, number> = {};
  rows.forEach((r) => { const k = key(r); if (k.productId === productId && k.lotId) out[k.lotId] = (out[k.lotId] || 0) + (Number(k.qty) || 0); });
  return out;
}

/**
 * Replaces row `idx` with one row per allocation (same product, the lot's
 * quantity and price), keeping every other row as is. `build` copies the
 * product fields from the original row onto each lot row.
 */
export function splitRowIntoLots<T>(rows: T[], idx: number, allocations: LotAllocation[], build: (base: T, a: LotAllocation, i: number) => T): T[] {
  const base = rows[idx];
  if (!base || !allocations.length) return rows;
  return [...rows.slice(0, idx), ...allocations.map((a, i) => build(base, a, i)), ...rows.slice(idx + 1)];
}
