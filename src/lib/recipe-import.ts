// Word recipe import review: the editable draft for one extracted recipe and
// the decision sent to confirm it. The server (recipe-import.service.ts)
// re-validates everything and is authoritative; this only shows problems early.

export type LineAction = "MAP" | "CREATE" | "UNRESOLVED";

export interface ImportedIngredient {
  index: number;
  sourceName: string;
  sourceText: string;
  qtyText: string | null;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  group: string | null;
  issues: string[];
  match: {
    confidence: "EXACT" | "LEARNED" | "ALIAS" | "FUZZY" | "UNMATCHED" | "AMBIGUOUS";
    inventoryItemId: string | null;
    candidates: Array<{ id: string; name: string; unit: string; reason: string }>;
  };
}

export interface ImportedOutput { stage: string; stageText: string; quantity: number | null; qtyText: string | null; unit: string | null; note: string | null; sourceText: string }

export interface ImportedRecipe {
  key: string;
  title: string;
  category: string | null;
  ingredients: ImportedIngredient[];
  outputs: ImportedOutput[];
  notes: string[];
  issues: string[];
  defaultOutputIndex: number;
  status: { state: "PENDING" | "IMPORTED" | "UNCHANGED" | "SKIPPED"; recipeId?: string; version?: number; message?: string };
  existingRecipes: Array<{
    id: string; name: string; category: string | null; productionCount: number;
    activeFormulation: null | { id: string; version: number; yieldQty: number; yieldUnit: string; source: string; outputStage: string | null; items: Array<{ inventoryItemId: string; name: string; quantity: number; unit: string }> };
  }>;
  products: Array<{ id: string; name: string; sku: string | null; category: string | null; basePrice: number | null; reason: string; linkedRecipeId: string | null; linkedRecipeName: string | null }>;
}

export interface LineDraft {
  index: number;
  action: LineAction;
  inventoryItemId: string;
  quantity: string;
  unit: string;
  newName: string;
  newUnit: string;
}

export interface RecipeDraft {
  mode: "CREATE" | "NEW_VERSION";
  existingRecipeId: string;
  name: string;
  category: string;
  instructions: string;
  outputIndex: number;
  stageConfirmed: boolean;
  yieldQty: string;
  yieldUnit: string;
  lines: LineDraft[];
  productIds: string[];
  /** Updating an existing recipe: replace its Additional Expenses with the defaults. */
  replaceExpenses?: boolean;
}

export const QTY_UNITS = ["G", "KG", "MG", "ML", "L", "PCS"];
const NO_QTY = ["AS_REQUIRED", "QTY_MISSING", "RANGE", "UNPARSED"];

const isAllCaps = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();
export const tidyTitle = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return isAllCaps(t) ? t.toLowerCase().replace(/(^|[\s/(-])([a-z])/g, (_, a, b) => a + b.toUpperCase()) : t;
};

const defaultMaterialUnit = (unit: string | null) => (unit === "ML" || unit === "L" ? "L" : unit === "PCS" ? "pcs" : "kg");

/** Starting draft: suggested matches selected, lines without a quantity left unresolved. */
export function initialDraft(r: ImportedRecipe): RecipeDraft {
  const out = r.outputs[r.defaultOutputIndex];
  const existing = r.existingRecipes[0];
  return {
    mode: existing ? "NEW_VERSION" : "CREATE",
    existingRecipeId: existing?.id || "",
    name: tidyTitle(r.title),
    category: r.category || "",
    instructions: r.notes.join("\n"),
    outputIndex: Math.max(0, r.defaultOutputIndex),
    stageConfirmed: r.outputs.length <= 1,
    yieldQty: out?.quantity != null ? String(out.quantity) : out?.qtyText || "",
    yieldUnit: out?.unit || "",
    lines: r.ingredients.map((ing) => ({
      index: ing.index,
      action: ing.issues.some((i) => NO_QTY.includes(i)) ? "UNRESOLVED" : "MAP",
      inventoryItemId: ing.match.inventoryItemId || "",
      quantity: ing.quantity != null ? String(ing.quantity) : "",
      unit: ing.unit || "",
      newName: tidyTitle(ing.sourceName),
      newUnit: defaultMaterialUnit(ing.unit),
    })),
    productIds: r.products.filter((p) => !p.linkedRecipeId).map((p) => p.id),
  };
}

/** What still stops this recipe being confirmed. */
export function draftProblems(d: RecipeDraft, r: ImportedRecipe): string[] {
  const out: string[] = [];
  if (!d.name.trim()) out.push("Enter the recipe name.");
  if (!d.category.trim()) out.push("Enter the category.");
  if (d.mode === "NEW_VERSION" && !d.existingRecipeId) out.push("Choose the recipe to update.");
  if (r.outputs.length === 0) out.push("The document has no output for this recipe.");
  if (r.outputs.length > 1 && !d.stageConfirmed) out.push("Confirm which output stage production targets.");
  const y = Number(d.yieldQty);
  if (!(Number.isFinite(y) && y > 0)) out.push("Enter the reference output quantity.");
  if (!d.yieldUnit) out.push("Choose the reference output unit.");
  d.lines.forEach((l) => {
    const ing = r.ingredients.find((i) => i.index === l.index)!;
    if (l.action === "UNRESOLVED") return;
    const q = Number(l.quantity);
    if (!(Number.isFinite(q) && q > 0)) out.push(`${ing.sourceName}: enter an approved quantity or leave it unresolved.`);
    if (!l.unit) out.push(`${ing.sourceName}: choose the unit.`);
    if (l.action === "MAP" && !l.inventoryItemId) out.push(`${ing.sourceName}: choose the raw material.`);
    if (l.action === "CREATE" && !l.newName.trim()) out.push(`${ing.sourceName}: name the new raw material.`);
  });
  if (!d.lines.some((l) => l.action !== "UNRESOLVED")) out.push("At least one ingredient needs a material and quantity.");
  return out;
}

/** Decision payload for POST …/confirm. */
export function toDecision(d: RecipeDraft) {
  return {
    mode: d.mode,
    existingRecipeId: d.mode === "NEW_VERSION" ? d.existingRecipeId : undefined,
    name: d.name.trim(),
    category: d.category.trim(),
    instructions: d.instructions.trim() || undefined,
    outputIndex: d.outputIndex,
    stageConfirmed: d.stageConfirmed,
    yieldQty: Number(d.yieldQty),
    yieldUnit: d.yieldUnit,
    ingredients: d.lines.map((l) => ({
      index: l.index,
      action: l.action,
      inventoryItemId: l.action === "MAP" ? l.inventoryItemId : l.inventoryItemId || undefined,
      quantity: l.action === "UNRESOLVED" ? undefined : Number(l.quantity),
      unit: l.action === "UNRESOLVED" ? undefined : l.unit,
      newMaterial: l.action === "CREATE" ? { name: l.newName.trim(), unit: l.newUnit } : undefined,
    })),
    productIds: d.productIds,
    // New recipes always get the default expenses; an update keeps the
    // recipe's own unless this is ticked.
    replaceExpenses: d.mode === "NEW_VERSION" ? !!d.replaceExpenses : undefined,
  };
}

export const ISSUE_LABEL: Record<string, string> = {
  AS_REQUIRED: "As required",
  QTY_MISSING: "No quantity",
  UNIT_MISSING: "No unit",
  RANGE: "Range",
  UNKNOWN_UNIT: "Unknown unit",
  UNPARSED: "Unreadable",
  REPEATED: "Listed twice",
};

export const MATCH_LABEL: Record<string, string> = {
  EXACT: "Exact",
  LEARNED: "Mapped before",
  ALIAS: "Alias",
  FUZZY: "Check spelling",
  UNMATCHED: "Unmatched material",
  AMBIGUOUS: "Several matches",
};
