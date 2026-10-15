// Recipe Master list search and filters. Read-only over the recipe list as
// the API returns it (active formulation included; `isImported` = any
// formulation version came from a Word import).

export type RecipeFilter = "ALL" | "IMPORTED" | "MANUAL" | "CONFIGURED" | "MISSING";

export const RECIPE_FILTERS: Array<{ value: RecipeFilter; label: string }> = [
  { value: "ALL", label: "All Recipes" },
  { value: "IMPORTED", label: "Imported Recipes" },
  { value: "MANUAL", label: "Manually Created" },
  { value: "CONFIGURED", label: "Formulation Configured" },
  { value: "MISSING", label: "Formulation Missing" },
];

const isImported = (r: any) => !!r?.isImported || r?.activeFormulation?.source === "IMPORT";

export function matchesRecipeFilter(r: any, filter: RecipeFilter): boolean {
  switch (filter) {
    case "IMPORTED": return isImported(r);
    case "MANUAL": return !isImported(r);
    case "CONFIGURED": return !!r?.activeFormulation;
    case "MISSING": return !r?.activeFormulation;
    default: return true;
  }
}

/** Every name a recipe's ingredients go by: material names, names as written in an imported document, and "As Required" lines. */
function ingredientTerms(r: any): string[] {
  const f = r?.activeFormulation;
  return [
    ...(r?.ingredients ?? []).map((i: any) => i?.inventoryItem?.name),
    ...(r?.recipeItems ?? []).map((i: any) => i?.inventoryItem?.name),
    ...(f?.items ?? []).flatMap((i: any) => [i?.inventoryItem?.name, i?.sourceName]),
    ...(Array.isArray(f?.unresolvedItems) ? f.unresolvedItems.map((u: any) => u?.sourceName) : []),
  ].filter(Boolean);
}

/** Recipe name, product name, category, code or any ingredient name contains the query. */
export function matchesRecipeSearch(r: any, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [r?.name, r?.product?.name, r?.category, r?.recipeCode, ...ingredientTerms(r)]
    .some((t) => String(t || "").toLowerCase().includes(q));
}
