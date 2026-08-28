// Canonical unit vocabulary for recipe yields and recipe ingredient quantities.
// Recipe Master and Production Planning must share this exact list (same values,
// same casing) so a recipe's yieldUnit always matches an <option> in every unit
// dropdown that reads or sets it — a mismatch here causes a controlled <select>
// to silently fall back to displaying its first option while the real state
// stays whatever was actually stored, desyncing the visible unit from the one
// used in scaling calculations.
export const RECIPE_UNITS = [
  "KG",
  "G",
  "L",
  "ML",
  "PCS",
  "PKT",
  "BOX",
  "DOZEN",
] as const;

export type RecipeUnit = typeof RECIPE_UNITS[number];
