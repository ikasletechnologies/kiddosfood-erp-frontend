import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

const getFormulationsMock = vi.fn();
vi.mock("@/lib/api", () => ({
  recipesApi: { getFormulations: (...args: any[]) => getFormulationsMock(...args) },
}));

import RecipeFormulationView from "../RecipeFormulationView";
import { matchesRecipeFilter, matchesRecipeSearch } from "@/lib/recipe-master-filter";

// Idli / Dosa Batter as imported from MEASUREMENTS.docx.
const active = {
  id: "f2", version: 2, yieldQty: 1.534, yieldUnit: "KG", source: "IMPORT", isActive: true,
  outputStage: "After Fermentation",
  sourceReference: { document: "MEASUREMENTS.docx" },
  unresolvedItems: [{ sourceName: "Alkaline Water", sourceText: "Alkaline Water - As Required", reason: "AS_REQUIRED" }],
  items: [
    { inventoryItemId: "rice", quantity: 500, unit: "G", sourceName: "Parboiled Rice", inventoryItem: { name: "Parboiled Rice" } },
    { inventoryItemId: "urad", quantity: 125, unit: "G", sourceName: "Urad", inventoryItem: { name: "Urad Dal" } },
    { inventoryItemId: "methi", quantity: 2, unit: "G", sourceName: "Fenugreek", inventoryItem: { name: "Fenugreek" } },
  ],
};
const v1 = {
  ...active, id: "f1", version: 1, isActive: false, createdAt: "2026-09-01T00:00:00Z",
  items: [{ inventoryItemId: "rice", quantity: 480, unit: "G", inventoryItem: { name: "Parboiled Rice" } }],
};

const setup = (onEdit = vi.fn()) => {
  render(<RecipeFormulationView recipeId="r1" recipeName="Idli / Dosa Batter" active={active as any} onEdit={onEdit} />);
  return { onEdit };
};
const qtyOf = (name: string) => within(screen.getByText(name).closest("tr")!).getAllByRole("cell")[1].textContent;

describe("RecipeFormulationView", () => {
  beforeEach(() => getFormulationsMock.mockReset());
  afterEach(cleanup);

  it("shows the saved reference output, stage, source and version", () => {
    setup();
    expect(screen.getByText("1.534 KG")).toBeInTheDocument();
    expect(screen.getByText("After Fermentation")).toBeInTheDocument();
    expect(screen.getByText("MEASUREMENTS.docx")).toBeInTheDocument();
    expect(screen.getByText("v2 · Active")).toBeInTheDocument();
    expect(screen.getByText(/Idli \/ Dosa Batter/)).toBeInTheDocument();
  });

  it("shows ingredient measurements exactly as saved", () => {
    setup();
    expect(qtyOf("Parboiled Rice")).toBe("500 g");
    expect(qtyOf("Urad Dal")).toBe("125 g");
    expect(qtyOf("Fenugreek")).toBe("2 g");
    expect(screen.getByText("as written: Urad")).toBeInTheDocument();
  });

  it("shows As Required lines without a fabricated quantity", () => {
    setup();
    expect(qtyOf("Alkaline Water")).toBe("As Required");
    expect(screen.getByText("Not calculated or deducted")).toBeInTheDocument();
  });

  it("is read-only: no inputs, and Edit Formulation hands over to the existing workflow", () => {
    const { onEdit } = setup();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(screen.getByText("Edit Formulation"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("loads history on request and marks an older version as historical", async () => {
    getFormulationsMock.mockResolvedValue({ data: [active, v1] });
    setup();
    expect(getFormulationsMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Version history"));
    await waitFor(() => expect(screen.getByText(/v1/, { selector: "button" })).toBeInTheDocument());
    expect(getFormulationsMock).toHaveBeenCalledWith("r1");
    fireEvent.click(screen.getByText(/v1/, { selector: "button" }));
    expect(screen.getByText("v1 · Historical")).toBeInTheDocument();
    expect(screen.getByText(/Production uses v2/)).toBeInTheDocument();
    expect(qtyOf("Parboiled Rice")).toBe("480 g");
    fireEvent.click(screen.getByText(/v2 \(active\)/));
    expect(screen.getByText("v2 · Active")).toBeInTheDocument();
    expect(qtyOf("Parboiled Rice")).toBe("500 g");
  });
});

describe("Recipe Master search and filters", () => {
  const imported = { name: "Idli / Dosa Batter", category: "Batters", isImported: true, activeFormulation: active };
  const reSaved = { name: "Sambar Mix", category: "Masala", isImported: true, activeFormulation: { ...active, source: "PLANNING", items: [], unresolvedItems: [] } };
  const manual = { name: "Khakhra", category: "Snacks", isImported: false, activeFormulation: { ...active, source: "PLANNING", items: [], unresolvedItems: [] }, ingredients: [{ inventoryItem: { name: "Wheat Flour" } }] };
  const missing = { name: "New Mix", category: "Snacks", activeFormulation: null };

  it("searches name, category and ingredient names (incl. as written and As Required)", () => {
    expect(matchesRecipeSearch(imported, "dosa")).toBe(true);
    expect(matchesRecipeSearch(imported, "batters")).toBe(true);
    expect(matchesRecipeSearch(imported, "fenugreek")).toBe(true);
    expect(matchesRecipeSearch(imported, "alkaline")).toBe(true);
    expect(matchesRecipeSearch(manual, "wheat")).toBe(true);
    expect(matchesRecipeSearch(manual, "fenugreek")).toBe(false);
    expect(matchesRecipeSearch(missing, "")).toBe(true);
  });

  it("filters imported / manual / configured / missing", () => {
    const all = [imported, reSaved, manual, missing];
    const names = (f: any) => all.filter((r) => matchesRecipeFilter(r, f)).map((r) => r.name);
    expect(names("ALL")).toHaveLength(4);
    expect(names("IMPORTED")).toEqual(["Idli / Dosa Batter", "Sambar Mix"]);
    expect(names("MANUAL")).toEqual(["Khakhra", "New Mix"]);
    expect(names("CONFIGURED")).toEqual(["Idli / Dosa Batter", "Sambar Mix", "Khakhra"]);
    expect(names("MISSING")).toEqual(["New Mix"]);
  });
});
