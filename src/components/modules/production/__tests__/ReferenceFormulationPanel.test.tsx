import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

const saveFormulationMock = vi.fn();

vi.mock("@/lib/api", () => ({
  // Rejections are thrown by the wrapper, not returned from the spy: vitest's
  // spy tracking reports a rejected promise returned by a mock as unhandled
  // even when the component catches it.
  recipesApi: {
    saveFormulation: async (...args: any[]) => {
      const result = saveFormulationMock(...args);
      if (result && result.reject) throw result.reject;
      return result;
    },
  },
}));
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ReferenceFormulationPanel, { isUsableFormulation } from "../ReferenceFormulationPanel";

const rice = { id: "rice", name: "Rice", sku: "RM-RICE", unit: "KG" };
const dal = { id: "dal", name: "White Urad Dal", sku: "RM-DAL", unit: "kg" };
const ingredients = [
  { inventoryItemId: "rice", inventoryItem: rice },
  { inventoryItemId: "dal", inventoryItem: dal },
];
// Saved for 3 KG: Rice 1 KG, Dal 250 g.
const saved = {
  id: "f1", version: 1, yieldQty: 3, yieldUnit: "KG",
  items: [
    { inventoryItemId: "rice", quantity: 1, unit: "KG", inventoryItem: rice },
    { inventoryItemId: "dal", quantity: 250, unit: "G", inventoryItem: dal },
  ],
};

function setup(recipe: any, targetQty = 3, targetUnit = "KG", outdated = false) {
  const onDraftChange = vi.fn();
  const onSaved = vi.fn();
  const props = { recipe, outdated, targetQty, targetUnit, onDraftChange, onSaved };
  const view = render(<ReferenceFormulationPanel {...props} />);
  const rerender = (patch: Partial<typeof props>) => view.rerender(<ReferenceFormulationPanel {...props} {...patch} />);
  return { onDraftChange, onSaved, rerender };
}
const qty = (name: string) => screen.getByLabelText(`${name} quantity`) as HTMLInputElement;

describe("ReferenceFormulationPanel (simplified)", () => {
  beforeEach(() => saveFormulationMock.mockReset());
  afterEach(() => cleanup());

  it("shows only name, quantity and unit per ingredient (no yield, note or banner)", () => {
    setup({ id: "r1", ingredients, activeFormulation: null });
    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("White Urad Dal")).toBeInTheDocument();
    // Unit dropdowns, starting in each stock unit's own scale.
    expect((screen.getByLabelText("Rice unit") as HTMLSelectElement).value).toBe("KG");
    expect((screen.getByLabelText("White Urad Dal unit") as HTMLSelectElement).value).toBe("KG");
    expect(screen.queryByText(/Reference yield/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Change note/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Not Configured/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(2); // one unit dropdown per ingredient
    expect(qty("Rice").value).toBe(""); // nothing fabricated
    expect(screen.getByText("Save Formulation")).toBeInTheDocument();
  });

  it("does not crash when the recipe payload lacks ingredients/formulation", () => {
    setup({ id: "r1" });
    expect(screen.getByText(/No ingredients selected/)).toBeInTheDocument();
  });

  it("rejects malformed formulations", () => {
    expect(isUsableFormulation(null)).toBe(false);
    expect(isUsableFormulation({ ...saved, yieldQty: 0 })).toBe(false);
    expect(isUsableFormulation(saved)).toBe(true);
  });

  it("requires a positive quantity for every ingredient before saving", async () => {
    setup({ id: "r1", ingredients, activeFormulation: null });
    fireEvent.change(qty("Rice"), { target: { value: "1" } });
    fireEvent.click(screen.getByText("Save Formulation"));
    expect(await screen.findByText(/greater than 0 for White Urad Dal/)).toBeInTheDocument();
    expect(saveFormulationMock).not.toHaveBeenCalled();
  });

  it("saves the entered quantities against the current target as the reference yield", async () => {
    saveFormulationMock.mockResolvedValue({ data: { ...saved, id: "f2" } });
    const { onSaved, onDraftChange } = setup({ id: "r1", ingredients, activeFormulation: null }, 3, "KG");
    fireEvent.change(qty("Rice"), { target: { value: "1" } });
    fireEvent.change(qty("White Urad Dal"), { target: { value: "0.25" } });
    expect(onDraftChange.mock.calls.at(-1)?.[0]).toMatchObject({ yieldQty: 3, yieldUnit: "KG" });
    fireEvent.click(screen.getByText("Save Formulation"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveFormulationMock).toHaveBeenCalledWith("r1", {
      yieldQty: 3, yieldUnit: "KG",
      items: [
        { inventoryItemId: "rice", quantity: 1, unit: "KG" },
        { inventoryItemId: "dal", quantity: 0.25, unit: "KG" },
      ],
    });
  });

  it("scales a saved formulation to the target without changing it (3 → 6 → 12 KG)", () => {
    const { rerender, onDraftChange } = setup({ id: "r1", ingredients, activeFormulation: saved }, 3, "KG");
    expect(qty("Rice").value).toBe("1");
    expect(qty("White Urad Dal").value).toBe("250"); // below 1 KG: shown in grams
    expect((screen.getByLabelText("White Urad Dal unit") as HTMLSelectElement).value).toBe("g");
    rerender({ targetQty: 6 });
    expect(qty("Rice").value).toBe("2");
    expect(qty("White Urad Dal").value).toBe("500");
    rerender({ targetQty: 12 });
    expect(qty("Rice").value).toBe("4");
    expect(qty("White Urad Dal").value).toBe("1");
    rerender({ targetQty: 12000, targetUnit: "G" });
    expect(qty("Rice").value).toBe("4");
    // Unchanged saved version: parent keeps scaling from it; nothing to save.
    expect(onDraftChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("Save Formulation").closest("button")).toBeDisabled();
    expect(saveFormulationMock).not.toHaveBeenCalled();
  });

  it("edited quantities stay put when the target changes, and save against the current target", async () => {
    saveFormulationMock.mockResolvedValue({ data: saved });
    const { rerender } = setup({ id: "r1", ingredients, activeFormulation: saved }, 12, "KG");
    fireEvent.change(qty("Rice"), { target: { value: "5" } });
    rerender({ targetQty: 6 });
    expect(qty("Rice").value).toBe("5");
    expect(qty("White Urad Dal").value).toBe("1"); // frozen at the value shown when editing began
    fireEvent.click(screen.getByText("Save Formulation"));
    await waitFor(() => expect(saveFormulationMock).toHaveBeenCalled());
    expect(saveFormulationMock.mock.calls[0][1]).toMatchObject({ yieldQty: 6, yieldUnit: "KG" });
  });

  it("records a G target in the saved formulation's unit (recipe yield unit stays fixed)", async () => {
    saveFormulationMock.mockResolvedValue({ data: saved });
    setup({ id: "r1", ingredients, activeFormulation: saved }, 3000, "G");
    fireEvent.change(qty("Rice"), { target: { value: "1.1" } });
    fireEvent.click(screen.getByText("Save Formulation"));
    await waitFor(() => expect(saveFormulationMock).toHaveBeenCalled());
    expect(saveFormulationMock.mock.calls[0][1]).toMatchObject({ yieldQty: 3, yieldUnit: "KG" });
  });

  it("shows the API error and keeps the entries when saving fails", async () => {
    // Axios rejects with an Error carrying `response`; mirror that shape.
    saveFormulationMock.mockReturnValue({ reject: Object.assign(new Error("Request failed"), { response: { data: { error: "Server says no." } } }) });
    const { onSaved } = setup({ id: "r1", ingredients, activeFormulation: null });
    fireEvent.change(qty("Rice"), { target: { value: "1" } });
    fireEvent.change(qty("White Urad Dal"), { target: { value: "0.25" } });
    fireEvent.click(screen.getByText("Save Formulation"));
    expect(await screen.findByText("Server says no.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(qty("Rice").value).toBe("1");
  });

  it("shows small scaled quantities in grams but saves the exact stock-unit value", async () => {
    saveFormulationMock.mockResolvedValue({ data: saved });
    // 3 KG reference: Rice 1 KG, Dal 0.0728155 KG → at a 1 KG target: 0.333… KG and 0.024271… KG.
    const f = { ...saved, items: [saved.items[0], { inventoryItemId: "dal", quantity: 0.0728155, unit: "KG", inventoryItem: dal }] };
    setup({ id: "r1", ingredients, activeFormulation: f }, 1, "KG");
    expect(qty("White Urad Dal").value).toBe("25"); // 24.27 g shown rounded up to the whole gram
    expect(qty("Rice").value).toBe("334");
    // Editing Rice in grams: 400 g saved as 0.4 KG; Dal (untouched) keeps full precision.
    fireEvent.change(qty("Rice"), { target: { value: "400" } });
    fireEvent.click(screen.getByText("Save Formulation"));
    await waitFor(() => expect(saveFormulationMock).toHaveBeenCalled());
    const items = saveFormulationMock.mock.calls[0][1].items;
    expect(items[0]).toEqual({ inventoryItemId: "rice", quantity: 0.4, unit: "KG" });
    expect(items[1].unit).toBe("KG");
    expect(items[1].quantity).toBeCloseTo(0.0728155 / 3, 12);
  });

  it("an empty row is typed in the stock unit's own scale (KG), not grams", async () => {
    saveFormulationMock.mockResolvedValue({ data: saved });
    setup({ id: "r1", ingredients, activeFormulation: null }, 3, "KG");
    fireEvent.change(qty("Rice"), { target: { value: "0.5" } });
    fireEvent.change(qty("White Urad Dal"), { target: { value: "2" } });
    fireEvent.click(screen.getByText("Save Formulation"));
    await waitFor(() => expect(saveFormulationMock).toHaveBeenCalled());
    expect(saveFormulationMock.mock.calls[0][1].items[0]).toEqual({ inventoryItemId: "rice", quantity: 0.5, unit: "KG" });
  });

  it("refuses to save without a valid production target", async () => {
    setup({ id: "r1", ingredients, activeFormulation: null }, 0, "KG");
    fireEvent.change(qty("Rice"), { target: { value: "1" } });
    fireEvent.change(qty("White Urad Dal"), { target: { value: "1" } });
    fireEvent.click(screen.getByText("Save Formulation"));
    expect(await screen.findByText(/production target quantity first/)).toBeInTheDocument();
    expect(saveFormulationMock).not.toHaveBeenCalled();
  });
});

describe("ReferenceFormulationPanel — empty target and unit selection", () => {
  beforeEach(() => saveFormulationMock.mockReset());
  afterEach(() => cleanup());

  // Beetroot Dosa: reference 0.9 KG, beetroot 50 g (stocked in KG), salt by the piece.
  const beet = { id: "beet", name: "Beetroot", sku: "RM-BEET", unit: "KG" };
  const sachet = { id: "sachet", name: "Spice Sachet", sku: "RM-SACHET", unit: "PCS" };
  const beetIngredients = [
    { inventoryItemId: "beet", inventoryItem: beet },
    { inventoryItemId: "sachet", inventoryItem: sachet },
  ];
  const beetSaved = {
    id: "fb", version: 2, yieldQty: 0.9, yieldUnit: "KG", source: "IMPORT", sourceReference: { document: "MEASUREMENTS.docx" },
    items: [
      { inventoryItemId: "beet", quantity: 50, unit: "G", inventoryItem: beet },
      { inventoryItemId: "sachet", quantity: 1, unit: "PCS", inventoryItem: sachet },
    ],
  };
  const unit = (name: string) => screen.getByLabelText(`${name} unit`) as HTMLSelectElement;
  const recipe = { id: "r2", ingredients: beetIngredients, activeFormulation: beetSaved };

  it("with no target, shows the saved reference quantities for the reference output", () => {
    const { onDraftChange } = setup(recipe, 0, "KG");
    expect(qty("Beetroot").value).toBe("50");
    expect(unit("Beetroot").value).toBe("g");
    expect(screen.getByText(/for 0.9 KG \(reference output\)/)).toBeInTheDocument();
    expect(screen.getByText(/imported from MEASUREMENTS.docx/)).toBeInTheDocument();
    expect(onDraftChange).toHaveBeenLastCalledWith(null); // nothing changed, nothing to save
    expect(screen.getByText("Save Formulation").closest("button")).toBeDisabled();
  });

  it("scales with the target (9 KG → 500 g) and a unit change never changes the result", () => {
    const { onDraftChange } = setup(recipe, 9, "KG");
    expect(qty("Beetroot").value).toBe("500");
    fireEvent.change(unit("Beetroot"), { target: { value: "KG" } });
    expect(qty("Beetroot").value).toBe("0.5");
    fireEvent.change(unit("Beetroot"), { target: { value: "g" } });
    expect(qty("Beetroot").value).toBe("500");
    expect(onDraftChange).toHaveBeenLastCalledWith(null); // display only: not an edit
  });

  it("converts typed values exactly: 800 g → 0.8 KG, 1.5 KG → 1500 g, 250 g → 0.25 KG, and back", () => {
    setup(recipe, 0, "KG");
    fireEvent.change(qty("Beetroot"), { target: { value: "800" } });
    fireEvent.change(unit("Beetroot"), { target: { value: "KG" } });
    expect(qty("Beetroot").value).toBe("0.8");
    fireEvent.change(qty("Beetroot"), { target: { value: "1.5" } });
    fireEvent.change(unit("Beetroot"), { target: { value: "g" } });
    expect(qty("Beetroot").value).toBe("1500");
    fireEvent.change(qty("Beetroot"), { target: { value: "250" } });
    fireEvent.change(unit("Beetroot"), { target: { value: "KG" } });
    expect(qty("Beetroot").value).toBe("0.25");
    fireEvent.change(unit("Beetroot"), { target: { value: "g" } });
    expect(qty("Beetroot").value).toBe("250");
  });

  it("count units offer no weight conversion (KG → PCS is not possible)", () => {
    setup(recipe, 9, "KG");
    expect(unit("Spice Sachet").disabled).toBe(true);
    expect(Array.from(unit("Spice Sachet").options).map((o) => o.value)).toEqual(["PCS"]);
    expect(Array.from(unit("Beetroot").options).map((o) => o.value)).toEqual(["g", "KG"]);
    // Even if a stale/forced value arrives, it is rejected and nothing changes.
    fireEvent.change(unit("Beetroot"), { target: { value: "PCS" } });
    expect(qty("Beetroot").value).toBe("500");
  });

  it("saves a quantity entered in another unit in the stock unit, only on Save, against the reference output when no target", async () => {
    saveFormulationMock.mockResolvedValue({ data: { ...beetSaved, id: "fb3", version: 3 } });
    const { onSaved } = setup(recipe, 0, "KG");
    fireEvent.change(unit("Beetroot"), { target: { value: "KG" } });
    fireEvent.change(qty("Beetroot"), { target: { value: "0.06" } });
    expect(saveFormulationMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Save Formulation"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveFormulationMock).toHaveBeenCalledWith("r2", {
      yieldQty: 0.9, yieldUnit: "KG",
      items: [
        { inventoryItemId: "beet", quantity: 0.06, unit: "KG" },
        { inventoryItemId: "sachet", quantity: 1, unit: "PCS" },
      ],
    });
  });
});
