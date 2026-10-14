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

  it("shows only name, quantity and read-only stock unit per ingredient (no yield, note or banner)", () => {
    setup({ id: "r1", ingredients, activeFormulation: null });
    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.getByText("White Urad Dal")).toBeInTheDocument();
    expect(screen.getAllByText("KG")).toHaveLength(2); // stock units, as text not inputs
    expect(screen.queryByText(/Reference yield/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Change note/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Not Configured/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
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
    expect(qty("White Urad Dal").value).toBe("0.25"); // 250 g shown in its stock unit
    rerender({ targetQty: 6 });
    expect(qty("Rice").value).toBe("2");
    expect(qty("White Urad Dal").value).toBe("0.5");
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

  it("refuses to save without a valid production target", async () => {
    setup({ id: "r1", ingredients, activeFormulation: null }, 0, "KG");
    fireEvent.change(qty("Rice"), { target: { value: "1" } });
    fireEvent.change(qty("White Urad Dal"), { target: { value: "1" } });
    fireEvent.click(screen.getByText("Save Formulation"));
    expect(await screen.findByText(/production target quantity first/)).toBeInTheDocument();
    expect(saveFormulationMock).not.toHaveBeenCalled();
  });
});
