import { describe, expect, it } from "vitest";
import { ImportedRecipe, draftProblems, initialDraft, tidyTitle, toDecision } from "../recipe-import";

const idli: ImportedRecipe = {
  key: "r1-idli-dosa-batter",
  title: "Idli/ Dosa Batter",
  category: "Batters",
  notes: [],
  issues: ["MULTIPLE_STAGES"],
  defaultOutputIndex: 1,
  status: { state: "PENDING" },
  existingRecipes: [],
  outputs: [
    { stage: "After Grinding", stageText: "After Griding", quantity: 1545, qtyText: "1545", unit: "G", note: null, sourceText: "Output (After Griding)- 1545 G" },
    { stage: "After Fermentation", stageText: "After Fermentation", quantity: 1534, qtyText: "1534", unit: "G", note: null, sourceText: "Output (After Fermentation)- 1534 G" },
  ],
  ingredients: [
    { index: 0, sourceName: "Parboiled Rice", sourceText: "Parboiled Rice- 500 G", qtyText: "500", quantity: 500, unit: "G", note: null, group: null, issues: [], match: { confidence: "UNMATCHED", inventoryItemId: null, candidates: [] } },
    { index: 1, sourceName: "Fenugreek", sourceText: "Fenugreek- 2g", qtyText: "2", quantity: 2, unit: "G", note: null, group: null, issues: [], match: { confidence: "ALIAS", inventoryItemId: "methi", candidates: [] } },
    { index: 2, sourceName: "Alkaline Water", sourceText: "Alkaline Water- As Required", qtyText: null, quantity: null, unit: null, note: null, group: null, issues: ["AS_REQUIRED"], match: { confidence: "UNMATCHED", inventoryItemId: null, candidates: [] } },
  ],
  products: [
    { id: "p900", name: "IDLI DOSA BATTER", sku: "FG-IDLI-900G", category: "NORMAL BATTER", basePrice: 45, reason: "Same name", linkedRecipeId: null, linkedRecipeName: null },
    { id: "pOther", name: "IDLI DOSA BATTER", sku: "FG-IDLI-450G", category: "NORMAL BATTER", basePrice: 25, reason: "Same name", linkedRecipeId: "x", linkedRecipeName: "Other" },
  ],
};

describe("recipe import review draft", () => {
  it("starts from the last output stage, unconfirmed, with As Required unresolved and unlinked products selected", () => {
    const d = initialDraft(idli);
    expect(d.outputIndex).toBe(1);
    expect(d.yieldQty).toBe("1534");
    expect(d.stageConfirmed).toBe(false);
    expect(d.lines[2].action).toBe("UNRESOLVED");
    expect(d.lines[1].inventoryItemId).toBe("methi");
    expect(d.productIds).toEqual(["p900"]);
    expect(d.mode).toBe("CREATE");
  });

  it("lists what blocks confirmation until the stage is confirmed and every material chosen", () => {
    const d = initialDraft(idli);
    const problems = draftProblems(d, idli);
    expect(problems).toContain("Confirm which output stage production targets.");
    expect(problems).toContain("Parboiled Rice: choose the raw material.");
    const fixed = { ...d, stageConfirmed: true, lines: d.lines.map((l) => (l.index === 0 ? { ...l, inventoryItemId: "rice" } : l)) };
    expect(draftProblems(fixed, idli)).toEqual([]);
  });

  it("never sends a quantity for an unresolved line and sends reviewer values otherwise", () => {
    const d = { ...initialDraft(idli), stageConfirmed: true };
    const dec = toDecision(d);
    expect(dec.ingredients[2]).toMatchObject({ action: "UNRESOLVED", quantity: undefined, unit: undefined });
    expect(dec.ingredients[0]).toMatchObject({ action: "MAP", quantity: 500, unit: "G" });
    expect(dec.yieldQty).toBe(1534);
  });

  it("tidies all-caps titles only", () => {
    expect(tidyTitle("SAMBAR THOOL")).toBe("Sambar Thool");
    expect(tidyTitle("Idli/ Dosa Batter")).toBe("Idli/ Dosa Batter");
  });
});
