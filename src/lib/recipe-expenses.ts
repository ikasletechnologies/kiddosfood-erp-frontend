// Recipe Master "Additional Expenses": the editable form state and the payload
// sent with the recipe. The server (production-costing.ts
// normalizeRecipeExpenses) validates again and is authoritative.

export type ExpenseBasis = "PER_BATCH" | "PER_KG" | "PER_PACKET";
export const PACKAGING_MATERIAL = "PACKAGING_MATERIAL";

export interface ExpenseCategory { code: string; label: string }

export interface SizeRateDraft { key: string; packetSize: string; rate: string }
export interface RecipeExpenseDraft {
  category: string;
  label: string;
  enabled: boolean;
  basis: ExpenseBasis;
  /** "" = not entered (₹0; for Packaging Materials: no common rate). */
  rate: string;
  sizeRates: SizeRateDraft[];
}

export interface RecipeExpensePayload {
  category: string;
  enabled: boolean;
  basis: ExpenseBasis;
  rate: number | null;
  sizeRates: Array<{ packetSize: string; rate: number }>;
}

export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { code: "MANPOWER", label: "Manpower" },
  { code: "ELECTRICITY", label: "Electricity" },
  { code: "OTHER", label: "Other Expenses" },
  { code: PACKAGING_MATERIAL, label: "Packaging Materials" },
];

const PACK_SIZE = /^\d+(?:\.\d+)?\s*(g|gm|gms|kg|kgs|ml|l|ltr|litre|pc|pcs|unit|units|nos)$/i;
const newKey = () => `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const isPackaging = (code: string) => code === PACKAGING_MATERIAL;

/** One draft per category, from a recipe's saved `additionalExpenses` (or blank). */
export function draftsFrom(saved: any[] | null | undefined, categories: ExpenseCategory[]): RecipeExpenseDraft[] {
  return categories.map((c) => {
    const s = (saved || []).find((e) => e?.category === c.code);
    return {
      category: c.code,
      label: c.label,
      enabled: !!s?.enabled,
      basis: (s?.basis as ExpenseBasis) || (isPackaging(c.code) ? "PER_PACKET" : "PER_BATCH"),
      // A saved ₹0 shows as blank so "not entered" and "0" read the same.
      rate: s?.rate == null || Number(s.rate) === 0 ? "" : String(s.rate),
      sizeRates: (s?.sizeRates || []).map((r: any) => ({ key: newKey(), packetSize: String(r.packetSize), rate: String(r.rate) })),
    };
  });
}

export const newSizeRate = (): SizeRateDraft => ({ key: newKey(), packetSize: "", rate: "" });

const parseAmount = (raw: string, what: string): { value: number | null; error: string | null } => {
  const t = raw.trim();
  if (t === "") return { value: null, error: null };
  const n = Number(t);
  if (!Number.isFinite(n)) return { value: null, error: `${what}: enter a valid amount in ₹.` };
  if (n < 0) return { value: null, error: `${what}: amount cannot be negative.` };
  return { value: n, error: null };
};

/** Payload for the recipe save, or the first problem to show. */
export function expensesPayloadFrom(drafts: RecipeExpenseDraft[]): { payload: RecipeExpensePayload[]; error: string | null } {
  const payload: RecipeExpensePayload[] = [];
  for (const d of drafts) {
    const rate = parseAmount(d.rate, d.label);
    if (rate.error) return { payload, error: rate.error };
    const seen = new Set<string>();
    const sizeRates: Array<{ packetSize: string; rate: number }> = [];
    const sized = isPackaging(d.category) && d.basis !== "PER_BATCH";
    for (const s of sized ? d.sizeRates : []) {
      if (!s.packetSize.trim() && !s.rate.trim()) continue;
      const size = s.packetSize.trim();
      if (!PACK_SIZE.test(size)) return { payload, error: `${d.label}: pack size "${size || "(blank)"}" must be a number with a unit, e.g. 250g or 1kg.` };
      const key = size.toLowerCase().replace(/\s+/g, "");
      if (seen.has(key)) return { payload, error: `${d.label}: pack size ${size} is listed more than once.` };
      seen.add(key);
      const r = parseAmount(s.rate, `${d.label} (${size})`);
      if (r.error) return { payload, error: r.error };
      if (r.value === null) return { payload, error: `${d.label} (${size}): enter an amount.` };
      sizeRates.push({ packetSize: size, rate: r.value });
    }
    payload.push({
      category: d.category,
      enabled: d.enabled,
      basis: d.basis,
      // Blank = ₹0, except Packaging Materials where blank means "no common rate".
      rate: rate.value ?? (isPackaging(d.category) && d.basis !== "PER_BATCH" ? null : 0),
      sizeRates,
    });
  }
  return { payload, error: null };
}

/** Short summary for the recipe list, e.g. "Manpower ₹15/batch · Packaging ₹2–5/pkt". */
export function expenseSummary(saved: any[] | null | undefined): string[] {
  const unit: Record<string, string> = { PER_BATCH: "/batch", PER_KG: "/kg", PER_PACKET: "/pkt" };
  return (saved || [])
    .filter((e) => e?.enabled)
    .map((e) => {
      const rates = [...(e.sizeRates || []).map((s: any) => Number(s.rate)), ...(e.rate != null ? [Number(e.rate)] : [])];
      if (!rates.length) return `${e.label || e.category}: no rate`;
      const lo = Math.min(...rates);
      const hi = Math.max(...rates);
      const amount = lo === hi ? `₹${lo}` : `₹${lo}–${hi}`;
      return `${e.label || e.category} ${amount}${unit[e.basis] || ""}`;
    });
}

export interface ManufacturingEstimate {
  lines: Array<{ category: string; label: string; basis: ExpenseBasis; rate: number; amount: number }>;
  /** Per-packet manufacturing expenses: charged at packaging, not estimated here. */
  deferred: Array<{ category: string; label: string; rate: number }>;
  total: number;
  error: string | null;
}

/**
 * Production Planning estimate of the recipe's manufacturing expenses for a
 * planned output — the same rules Complete Production applies to the actual
 * output (Per Batch once, Per KG × KG, Per Packet at packaging).
 */
export function estimateManufacturing(saved: any[] | null | undefined, outputQty: number, unit: string): ManufacturingEstimate {
  const u = String(unit || "").toUpperCase();
  const kg = u === "KG" || u === "L" ? outputQty : u === "G" || u === "ML" ? outputQty / 1000 : null;
  const out: ManufacturingEstimate = { lines: [], deferred: [], total: 0, error: null };
  for (const e of saved || []) {
    if (!e?.enabled || isPackaging(e.category)) continue;
    const rate = Number(e.rate) || 0;
    const label = e.label || e.category;
    if (e.basis === "PER_PACKET") { if (rate > 0) out.deferred.push({ category: e.category, label, rate }); continue; }
    if (e.basis === "PER_KG" && kg === null) { out.error = `${label} is set Per KG but this recipe is produced in ${u}.`; continue; }
    const amount = Math.round(rate * (e.basis === "PER_KG" ? kg! : 1) * 10000) / 10000;
    out.lines.push({ category: e.category, label, basis: e.basis, rate, amount });
    out.total = Math.round((out.total + amount) * 10000) / 10000;
  }
  return out;
}
