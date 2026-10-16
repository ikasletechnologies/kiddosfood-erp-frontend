// Purchase-lot allocation for a production material. Quantities are in the
// material's stock unit. The backend re-validates everything at start.
import type { LotAllocation } from "@/lib/api/inventory.api";

export interface LotOption {
  id: string;
  lotNumber: string;
  billNumber?: string | null;
  supplier: string | null;
  receivedAt: string | null;
  expDate: string | null;
  availableQty: number;
  unitCost: number;
}

export interface MaterialLots {
  inventoryItemId: string;
  name: string;
  sku?: string | null;
  unit: string;
  averageCost: number;
  lots: LotOption[];
  // Lots with stock that production can't use (expired, held, other
  // warehouse), each with the reason — shown, never allocatable.
  unavailableLots?: Array<LotOption & { status: string; warehouse: string | null; reasonCode: string; reason: string }>;
  // Stock in this warehouse that isn't in any lot (valued at averageCost).
  untrackedQty: number;
}

/** Allocation input values keyed by lot id, or UNTRACKED for stock with no lot. */
export type AllocationDraft = Record<string, string>;
export const UNTRACKED = "__untracked";
const EPS = 0.0005;

export const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const num = (s: string | undefined) => {
  const n = Number(s);
  return s === undefined || String(s).trim() === "" || !Number.isFinite(n) ? 0 : n;
};

/** Oldest lot first, then untracked stock — a starting point the operator can change. */
export function fifoDraft(material: MaterialLots, required: number): AllocationDraft {
  const draft: AllocationDraft = {};
  let left = required;
  for (const lot of material.lots) {
    const take = Math.min(lot.availableQty, Math.max(0, left));
    draft[lot.id] = take > 0 ? String(round3(take)) : "";
    left = round3(left - take);
  }
  if (material.untrackedQty > 0) {
    const take = Math.min(material.untrackedQty, Math.max(0, left));
    draft[UNTRACKED] = take > 0 ? String(round3(take)) : "";
  }
  return draft;
}

export function allocatedTotal(draft: AllocationDraft): number {
  return round3(Object.values(draft).reduce((s, v) => s + num(v), 0));
}

export function allocationCost(material: MaterialLots, draft: AllocationDraft): number {
  let cost = 0;
  for (const [key, v] of Object.entries(draft)) {
    const qty = num(v);
    if (!qty) continue;
    cost += qty * (key === UNTRACKED ? material.averageCost : material.lots.find((l) => l.id === key)?.unitCost ?? 0);
  }
  return Math.round(cost * 100) / 100;
}

/** First problem with the allocation, or null when it can be submitted. */
export function allocationError(material: MaterialLots, draft: AllocationDraft, required: number): string | null {
  for (const [key, v] of Object.entries(draft)) {
    if (String(v ?? "").trim() === "") continue;
    const qty = Number(v);
    if (!Number.isFinite(qty) || qty < 0) return "Enter quantities of 0 or more.";
    const cap = key === UNTRACKED ? material.untrackedQty : material.lots.find((l) => l.id === key)?.availableQty ?? 0;
    if (qty > cap + EPS) {
      const name = key === UNTRACKED ? "Stock without a lot" : material.lots.find((l) => l.id === key)?.lotNumber || "Lot";
      return `${name} has only ${round3(cap)} ${material.unit} available.`;
    }
  }
  const total = allocatedTotal(draft);
  if (Math.abs(total - required) > Math.max(EPS, required * 1e-6)) {
    return total < required
      ? `Allocate ${round3(required - total)} ${material.unit} more (${round3(total)} of ${round3(required)}).`
      : `Allocated ${round3(total - required)} ${material.unit} too much (${round3(total)} of ${round3(required)}).`;
  }
  return null;
}

export function toPayload(draft: AllocationDraft): LotAllocation[] {
  return Object.entries(draft)
    .map(([key, v]) => ({ batchId: key === UNTRACKED ? null : key, qty: round3(num(v)) }))
    .filter((a) => a.qty > 0);
}
