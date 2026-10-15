// Ingredient quantities for Production Planning — one shared, unit-safe place
// for how a quantity is shown and for the planning rounding policy:
//
//  • Display: weights below 1 KG in whole grams, rounded UP (88.77 g → 89 g);
//    from 1 KG in KG to 3 decimals (1.375405 KG → 1.375 KG). Volumes below
//    1 L in ml (2 dp), from 1 L in L (3 dp). Count units (PCS, BOX …) as is.
//    Stock on hand is shown rounded DOWN instead, so the screen never claims
//    more stock than there is.
//  • Policy (roundRequirement): a planned ingredient requirement that is a
//    weight below 1 KG is consumed rounded up to the next whole gram — the
//    backend deducts, allocates and costs exactly that (see
//    requirement-rounding.ts in the backend), so what is shown is what is used.
//
// Saved formulations and imported reference measurements are never rounded.

type Dim = { kind: "weight" | "volume"; toBase: number };

// Factor to the dimension's base unit (grams / millilitres).
const UNITS: Record<string, Dim> = {
  MG: { kind: "weight", toBase: 0.001 },
  G: { kind: "weight", toBase: 1 },
  GM: { kind: "weight", toBase: 1 },
  GMS: { kind: "weight", toBase: 1 },
  GRAM: { kind: "weight", toBase: 1 },
  GRAMS: { kind: "weight", toBase: 1 },
  KG: { kind: "weight", toBase: 1000 },
  KGS: { kind: "weight", toBase: 1000 },
  ML: { kind: "volume", toBase: 1 },
  L: { kind: "volume", toBase: 1000 },
  LTR: { kind: "volume", toBase: 1000 },
  LITRE: { kind: "volume", toBase: 1000 },
  LITER: { kind: "volume", toBase: 1000 },
};

const dimOf = (unit: string | null | undefined): Dim | null => UNITS[String(unit || "").trim().toUpperCase()] ?? null;

/** Display units: small and large for each dimension. */
const SMALL = { weight: "g", volume: "ml" } as const;
const LARGE = { weight: "KG", volume: "L" } as const;
const DP = { g: 0, ml: 2, large: 3 };
const BASE_PER_LARGE = 1000;

// Strips binary floating-point noise from a unit conversion (0.02427000000000001 → 0.02427).
const clean = (n: number) => Number(n.toPrecision(12));
// Noise-free value for a ceil/floor, so 25.000000000000004 g stays 25 g.
const settle = (n: number) => Number(n.toFixed(6));

/** "up" for requirements and shortfalls; "down" for stock on hand. */
export type Rounding = "up" | "down";

/** Converts between units of the same dimension; null when they aren't convertible. */
export function convertQty(qty: number, from: string, to: string): number | null {
  const f = dimOf(from);
  const t = dimOf(to);
  if (!f || !t || f.kind !== t.kind) return String(from).toUpperCase() === String(to).toUpperCase() ? qty : null;
  return clean((qty * f.toBase) / t.toBase);
}

/** Rounds for display; a small positive amount is never shown as 0. */
export function roundForDisplay(value: number, dp: number): number {
  if (!Number.isFinite(value)) return 0;
  const r = Number(value.toFixed(dp));
  if (r === 0 && value !== 0) return Number(value.toPrecision(2));
  return r;
}

/** Rounds to `dp` decimals in the given direction; a positive amount rounded down to 0 keeps 2 significant digits. */
function roundDirected(value: number, dp: number, rounding: Rounding): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** dp;
  const r = clean((rounding === "up" ? Math.ceil(settle(value * f)) : Math.floor(settle(value * f))) / f);
  if (r === 0 && value > 0) return Number(value.toPrecision(2));
  return r;
}

/**
 * Planning policy: a weight below 1 KG rounded up to the next whole gram,
 * returned in `unit`; anything else unchanged. Mirrors the backend rule.
 */
export function roundRequirement(qty: number, unit: string): number {
  const d = dimOf(unit);
  if (!d || d.kind !== "weight" || !Number.isFinite(qty) || qty <= 0) return qty;
  const grams = settle(qty * d.toBase);
  if (grams >= BASE_PER_LARGE) return qty;
  return clean(Math.ceil(grams) / d.toBase);
}

export interface DisplayQty {
  /** Exact value in `unit` (unrounded). */
  value: number;
  /** Rounded for display. */
  shown: number;
  unit: string;
  /** Decimal places used for this unit. */
  dp: number;
}

/** Value shown in the small unit (g / ml) under the display rules. */
function shownSmall(base: number, kind: Dim["kind"], rounding: Rounding): number {
  if (kind === "volume") return roundForDisplay(base, DP.ml);
  return roundDirected(base, DP.g, rounding);
}

/** Picks g/KG (ml/L) by size; other units are returned unchanged. */
export function autoQty(qty: number, unit: string, rounding: Rounding = "up"): DisplayQty {
  const d = dimOf(unit);
  if (!d || !Number.isFinite(qty)) {
    return { value: qty, shown: roundForDisplay(qty, DP.large), unit: String(unit || "").toUpperCase(), dp: DP.large };
  }
  const base = qty * d.toBase;
  // Decide on the value as it would be shown, so 999.2 g reads "1 KG", not "1000 g".
  const small = shownSmall(base, d.kind, rounding);
  if (Math.abs(small) < BASE_PER_LARGE) {
    return { value: convertQty(qty, unit, SMALL[d.kind])!, shown: small, unit: SMALL[d.kind], dp: d.kind === "weight" ? DP.g : DP.ml };
  }
  const value = convertQty(qty, unit, LARGE[d.kind])!;
  // Below 1 large unit only when the small value rounded up to 1000 (999.2 g → "1 KG").
  const shown = Math.abs(value) < 1 ? Math.sign(value) : rounding === "down" ? roundDirected(value, DP.large, "down") : roundForDisplay(value, DP.large);
  return { value, shown, unit: LARGE[d.kind], dp: DP.large };
}

/** "486 g", "1.375 KG", "12 PCS". */
export function formatQty(qty: number, unit: string, rounding: Rounding = "up"): string {
  const d = autoQty(qty, unit, rounding);
  return `${d.shown.toLocaleString("en-IN", { maximumFractionDigits: 6 })} ${d.unit}`;
}

/** Display unit matching the stock unit itself (kg → "KG", g → "g"), for empty inputs. */
export function defaultDisplayUnit(unit: string): string {
  const d = dimOf(unit);
  if (!d) return String(unit || "").toUpperCase();
  return d.toBase >= 1000 ? LARGE[d.kind] : SMALL[d.kind];
}

/** The two display units offered for an input ("g"/"KG", "ml"/"L"), or none for count units. */
export function displayUnitsFor(unit: string): string[] {
  const d = dimOf(unit);
  return d ? [SMALL[d.kind], LARGE[d.kind]] : [];
}

/**
 * Largest scaling multiplier that `available` covers for a line needing
 * `perUnit` × multiplier, given that requirement is consumed under
 * roundRequirement (both in `unit`).
 */
export function maxMultiplierFor(perUnit: number, available: number, unit: string): number {
  if (!(perUnit > 0)) return Infinity;
  const exact = available / perUnit;
  const d = dimOf(unit);
  if (!d || d.kind !== "weight") return exact;
  // In the whole-gram range, ceil(need) ≤ available ⇔ need ≤ floor(available in g).
  const wholeGrams = Math.floor(settle(available * d.toBase));
  const capped = wholeGrams / d.toBase / perUnit;
  return roundRequirement(perUnit * exact, unit) <= available + 1e-9 ? exact : capped;
}

/**
 * `qty` (in `unit`) as an input value in an explicitly chosen display unit of
 * the same dimension: whole grams rounded up (as shown everywhere else),
 * other units at up to 6 decimals. Null when the units aren't convertible —
 * e.g. KG → PCS, which needs an item-specific factor this system doesn't hold.
 */
export function inputValueIn(qty: number, unit: string, displayUnit: string): string | null {
  const v = convertQty(qty, unit, displayUnit);
  if (v == null || !Number.isFinite(v)) return null;
  const d = dimOf(displayUnit);
  const shown = d && d.kind === "weight" && d.toBase === 1 ? roundDirected(v, DP.g, "up") : Number(v.toFixed(6));
  return String(shown);
}

/** Units a material's quantity may be entered in: g/KG or ml/L when its stock unit is a weight/volume, otherwise only its own unit. */
export function entryUnitsFor(stockUnit: string): string[] {
  const units = displayUnitsFor(stockUnit);
  return units.length ? units : [String(stockUnit || "").trim().toUpperCase()].filter(Boolean);
}
