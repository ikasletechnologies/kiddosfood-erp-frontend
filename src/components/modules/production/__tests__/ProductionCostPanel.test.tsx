import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

const summaryMock = vi.fn();
const previewMock = vi.fn();
vi.mock("@/lib/api", () => ({
  productionApi: {
    getBatchCostSummary: (...a: any[]) => summaryMock(...a),
    previewPackagingCost: (...a: any[]) => previewMock(...a),
  },
}));

import ProductionCostPanel from "../ProductionCostPanel";

const categories = [
  { code: "MANPOWER", label: "Manpower" },
  { code: "ELECTRICITY", label: "Electricity" },
  { code: "OTHER", label: "Other Expenses" },
  { code: "PACKAGING_MATERIAL", label: "Packaging Materials" },
];
const base = {
  batchId: "b1", unit: "KG", plannedYield: 10, actualYield: 9.5, materialCost: 950, additionalMaterialCost: 0,
  plannedMaterialCostPerUnit: 95, actualMaterialCostPerUnit: 100, categories, sharedExpenses: [],
};
const snapshotSummary = {
  ...base,
  expenseSource: "RECIPE_SNAPSHOT",
  expenseSnapshot: { configVersion: 3, expenses: [
    { category: "MANPOWER", label: "Manpower", basis: "PER_BATCH", rate: 200 },
    { category: "PACKAGING_MATERIAL", label: "Packaging Materials", basis: "PER_PACKET", rate: 2 },
  ] },
  manufacturingExpenses: [{ category: "MANPOWER", label: "Manpower", basis: "PER_BATCH", rate: 200, baseQty: 1, amount: 200 }],
  manufacturingExpenseTotal: 200, totalManufacturingCost: 1150, manufacturingCostPerUnit: 121.0526,
};
const legacySummary = { ...base, expenseSource: "LEGACY", expenseSnapshot: null };
const rowCost = { packets: 10, good: 10, damaged: 0, rawMaterialPerPacket: 60.53, expenseTotal: 20, totalCost: 625.3, costPerPacket: 62.53, costPerGoodPacket: 62.53, damageAbsorbed: 0, expenses: [{ category: "PACKAGING_MATERIAL", perPacket: 2, amount: 20 }] };
const rows = [{ key: "a", packetSize: "500g", packedQty: 10, damagedQty: 0, productId: "p1" }];

const setup = (onCostsChange = vi.fn()) => {
  render(<ProductionCostPanel batchId="b1" unit="KG" rows={rows} refreshKey={0} onCostsChange={onCostsChange} />);
  return { onCostsChange };
};

describe("ProductionCostPanel (read-only)", () => {
  beforeEach(() => {
    summaryMock.mockReset();
    previewMock.mockReset();
    previewMock.mockResolvedValue({ data: { rows: [rowCost] } });
  });
  afterEach(cleanup);

  it("has no expense inputs, toggles or basis selectors", async () => {
    for (const s of [snapshotSummary, legacySummary]) {
      summaryMock.mockResolvedValue({ data: s });
      setup();
      await screen.findByText("Raw Material Cost");
      expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
      expect(screen.queryAllByRole("textbox")).toHaveLength(0);
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
      expect(screen.queryByText(/Clear all|Select all/)).toBeNull();
      expect(screen.queryByText(/so they are entered here/)).toBeNull();
      cleanup();
    }
  });

  it("keeps the cost header: yields, raw material, planned and actual cost per KG", async () => {
    summaryMock.mockResolvedValue({ data: legacySummary });
    setup();
    expect(await screen.findByText("10 / 9.5 KG")).toBeInTheDocument();
    expect(screen.getByText("₹950")).toBeInTheDocument();
    expect(screen.getByText("Planned Cost/KG")).toBeInTheDocument();
    expect(screen.getByText("₹95")).toBeInTheDocument();
    expect(screen.getByText("Actual Cost/KG")).toBeInTheDocument();
    expect(screen.getByText("₹100")).toBeInTheDocument();
  });

  it("recipe-snapshot batch: expenses shown read-only from the snapshot", async () => {
    summaryMock.mockResolvedValue({ data: snapshotSummary });
    const { onCostsChange } = setup();
    expect(await screen.findByText("Additional expenses (from recipe)")).toBeInTheDocument();
    expect(screen.getByText("Total Manufacturing Cost")).toBeInTheDocument();
    expect(screen.queryByText(/Expense data unavailable/)).toBeNull();
    await waitFor(() => expect(onCostsChange).toHaveBeenLastCalledWith(expect.objectContaining({ a: expect.anything() }), false, "RECIPE_SNAPSHOT"), { timeout: 4000 });
  });

  it("older batch: says expense data is unavailable and never shows ₹0 for it", async () => {
    summaryMock.mockResolvedValue({ data: { ...legacySummary, sharedExpenses: [{ category: "MANPOWER", label: "Manpower", total: 300, allocatedBefore: 100, remaining: 200 }] } });
    const { onCostsChange } = setup();
    expect(await screen.findByText(/Expense data unavailable/)).toBeInTheDocument();
    expect(screen.getByText("₹300")).toBeInTheDocument(); // recorded earlier on this batch, read-only
    expect(screen.getByText(/₹100 already charged/)).toBeInTheDocument();
    await waitFor(() => expect(onCostsChange).toHaveBeenLastCalledWith(expect.anything(), false, "LEGACY"), { timeout: 4000 });
  });

  it("the cost preview never sends expense lines", async () => {
    summaryMock.mockResolvedValue({ data: legacySummary });
    setup();
    await waitFor(() => expect(previewMock).toHaveBeenCalled());
    const [, body] = previewMock.mock.calls[0];
    expect(body).not.toHaveProperty("expenses");
    expect(body.rows[0]).toEqual({ packetSize: "500g", packedQty: 10, damagedQty: 0, productId: "p1" });
  });

  it("keeps per-pack production cost; shows no selling price or profit/loss", async () => {
    summaryMock.mockResolvedValue({ data: snapshotSummary });
    setup();
    expect(await screen.findByText("Production cost / pkt")).toBeInTheDocument();
    expect(screen.getAllByText("₹62.53").length).toBeGreaterThan(0);
    expect(screen.getByText("Total production cost")).toBeInTheDocument();
    expect(screen.queryByText(/selling price/i)).toBeNull();
    expect(screen.queryByText(/profit/i)).toBeNull();
    expect(screen.queryByText(/sales value/i)).toBeNull();
  });
});
