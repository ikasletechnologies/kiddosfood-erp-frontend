// Centralized unit normalization for mass/volume quantities — mirrors
// src/lib/conversion.ts on the backend. RecipeItem.unit (e.g. "g") and
// InventoryItem.unit (e.g. "KG") are independent free-text fields with no
// guarantee they match, so any screen comparing a recipe quantity against a
// stock quantity must convert through here first instead of comparing the
// raw numbers directly.

const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kgs: 1000,
  kilogram: 1000,
  kilograms: 1000,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  ltr: 1000,
  litre: 1000,
  litres: 1000,
  liter: 1000,
  liters: 1000,
};

function key(unit?: string | null): string {
  return (unit || "").trim().toLowerCase();
}

/**
 * Converts `quantity` from `fromUnit` to the equivalent amount in `toUnit`.
 * Only mass<->mass (g/kg) and volume<->volume (ml/l) pairs are converted,
 * canonicalizing through grams / milliliters respectively. Anything else
 * (identical units, or a pair with no known physical conversion — "pcs",
 * "packet", cross-dimension pairs) returns `quantity` unchanged rather than
 * guessing.
 */
export function convertUnit(quantity: number, fromUnit?: string | null, toUnit?: string | null): number {
  const from = key(fromUnit);
  const to = key(toUnit);
  if (from === to) return quantity;

  if (from in MASS_TO_GRAMS && to in MASS_TO_GRAMS) {
    return (quantity * MASS_TO_GRAMS[from]) / MASS_TO_GRAMS[to];
  }
  if (from in VOLUME_TO_ML && to in VOLUME_TO_ML) {
    return (quantity * VOLUME_TO_ML[from]) / VOLUME_TO_ML[to];
  }

  return quantity;
}
