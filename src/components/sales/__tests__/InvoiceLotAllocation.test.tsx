import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import InvoiceLotAllocation from "../InvoiceLotAllocation";
import LotSelector from "../LotSelector";
import { invoiceLotPool, SaleLot } from "@/lib/lot-pricing";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), legacy: vi.fn() }));
vi.mock("@/lib/api/base", () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock("@/lib/api", () => ({ lotPricingApi: { saleLotOptions: mocks.legacy } }));
const lot = (id: string, quantity: number): SaleLot => ({ id, lotNumber: id, batchNumber: id, productId: "p", productName: "APPAM 500g", sku: "FG-APPA-500G", unit: "PC", packSize: "500g", productionBatchCode: null, productionDate: "2026-10-01", packagingDate: "2026-10-10", expiryDate: "2027-11-05", warehouse: { id: "w", name: "Main" }, location: "HQ", producedQty: quantity, currentQty: quantity, reservedQty: 0, availableQty: quantity, unitCost: 60, taxPercent: 5, selectable: true });
const a = lot("A", 5), b = lot("B", 10);
const props = { productId: "p", productName: "APPAM 500g", sku: "FG-APPA-500G", quantity: 8, unit: "PC", price: 100, showCost: true, onManualApply: vi.fn() };
describe("conditional invoice lot selection", () => {
  afterEach(cleanup);
  beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: { lots: [a, b] } }); mocks.legacy.mockResolvedValue({ data: { lots: [b, a] } }); });
  it("never selects among multiple lots or displays automatic/profit messages", async () => {
    render(<InvoiceLotAllocation {...props} />);
    expect(await screen.findByText("2 Lots Available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Lots" })).toBeInTheDocument();
    expect(screen.queryByText(/Auto-selected|Estimated|FEFO/)).toBeNull();
    expect(props.onManualApply).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
  });
  it("opens the manual picker after entering a positive quantity for multiple lots", async () => {
    const { rerender } = render(<InvoiceLotAllocation {...props} quantity={0} autoPrompt />);
    await screen.findByText("2 Lots Available");
    expect(screen.queryByText(/SELECT STOCK LOTS/)).toBeNull();
    rerender(<InvoiceLotAllocation {...props} quantity={8} autoPrompt />);
    expect(await screen.findByLabelText("Quantity from lot A")).toHaveValue(0);
    expect(screen.getByLabelText("Quantity from lot B")).toHaveValue(0);
    expect(props.onManualApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    rerender(<InvoiceLotAllocation {...props} quantity={8} autoPrompt price={101} />);
    expect(screen.queryByLabelText("Quantity from lot A")).toBeNull();
    rerender(<InvoiceLotAllocation {...props} quantity={9} autoPrompt />);
    expect(await screen.findByLabelText("Quantity from lot A")).toHaveValue(0);
  });
  it("does not prompt again for an existing manual allocation", async () => {
    render(<InvoiceLotAllocation {...props} autoPrompt selections={[{ lotId: "A", lotNumber: "A", quantity: 5, batchNumber: "A", unitCost: 60, price: 100, taxPercent: 5 }]} />);
    await screen.findByRole("button", { name: "Change" });
    expect(screen.queryByLabelText("Quantity from lot A")).toBeNull();
    expect(props.onManualApply).not.toHaveBeenCalled();
  });
  it.each([8, 3])("associates only one lot up to availability for quantity %s without a popup", async quantity => {
    mocks.get.mockResolvedValue({ data: { lots: [a] } });
    render(<InvoiceLotAllocation {...props} quantity={quantity} autoPrompt />);
    await waitFor(() => expect(props.onManualApply).toHaveBeenCalledWith([expect.objectContaining({ lotId: "A", quantity: Math.min(quantity, 5) })]));
    expect(screen.queryByRole("button", { name: "Select Lots" })).toBeNull();
    expect(screen.queryByText(/SELECT STOCK LOTS/)).toBeNull();
  });
  it("shows saved splits compactly and keeps proposed quantities pending actual fulfilment", async () => {
    render(<InvoiceLotAllocation {...props} selections={[{ lotId: "A", lotNumber: "A", quantity: 2, batchNumber: "A", unitCost: 60, price: 100, taxPercent: 5 }, { lotId: "B", lotNumber: "B", quantity: 6, batchNumber: "B", unitCost: 60, price: 100, taxPercent: 5 }]} />);
    expect(await screen.findByText(/2 Lots Selected/)).toHaveTextContent("8 PC");
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
    expect(props.onManualApply).not.toHaveBeenCalled();
  });
  it("permits zero stock with no selection and no fabricated cost", async () => {
    mocks.get.mockResolvedValue({ data: { lots: [] } }); render(<InvoiceLotAllocation {...props} quantity={10} autoPrompt />);
    expect(await screen.findByText("Out of Stock")).toBeInTheDocument();
    expect(screen.getByText("10 PC pending fulfilment")).toBeInTheDocument(); expect(props.onManualApply).not.toHaveBeenCalled();
  });
  it("starts multi-lot inputs at zero, rejects over-allocation, and confirms partial allocations", async () => {
    const apply = vi.fn(); render(<InvoiceLotAllocation {...props} onManualApply={apply} />);
    fireEvent.click(await screen.findByRole("button", { name: "Select Lots" }));
    const first = await screen.findByLabelText("Quantity from lot A"); const second = screen.getByLabelText("Quantity from lot B");
    expect(first).toHaveValue(0); expect(second).toHaveValue(0); expect(screen.queryByRole("button", { name: /Auto Select|Fill.*oldest/ })).toBeNull();
    fireEvent.change(first, { target: { value: "6" } }); expect(screen.getByRole("button", { name: "Apply Lots" })).toBeDisabled();
    fireEvent.change(first, { target: { value: "5" } }); fireEvent.change(second, { target: { value: "4" } });
    expect(screen.getByText("Selected quantity exceeds the required quantity.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear Selection" })); fireEvent.change(first, { target: { value: "2" } });
    expect(screen.getByRole("button", { name: "Apply Lots" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Keep 6 PC/ })); fireEvent.click(screen.getByRole("button", { name: "Apply Lots" }));
    expect(apply).toHaveBeenCalledWith([expect.objectContaining({ lotId: "A", quantity: 2 })]);
  });
  it("refreshes the exact product/warehouse and reports stale selected quantities", async () => {
    const { rerender } = render(<InvoiceLotAllocation {...props} warehouseId="w" selectedLotId="A" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Lot availability changed");
    mocks.get.mockResolvedValue({ data: { lots: [] } });
    rerender(<InvoiceLotAllocation {...props} productId="other" warehouseId="other-w" />);
    await screen.findByText("Out of Stock");
    expect(mocks.get).toHaveBeenLastCalledWith(expect.any(String), { params: expect.objectContaining({ productId: "other", warehouseId: "other-w" }) });
  });
  it("applies a full manual split without preselection or a pending confirmation", async () => {
    const apply = vi.fn(); render(<InvoiceLotAllocation {...props} onManualApply={apply} />);
    fireEvent.click(await screen.findByRole("button", { name: "Select Lots" }));
    fireEvent.change(await screen.findByLabelText("Quantity from lot A"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Quantity from lot B"), { target: { value: "3" } });
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply Lots" }));
    expect(apply).toHaveBeenCalledWith([expect.objectContaining({ lotId: "A", quantity: 5 }), expect.objectContaining({ lotId: "B", quantity: 3 })]);
  });
  it("subtracts peer selections without claiming unselected invoice rows", () => {
    expect(invoiceLotPool([a,b], { A: 2, B: 4 }).map(l => l.availableQty)).toEqual([3,6]);
  });
  it("keeps the existing FIFO modal behavior for POS and other callers", async () => {
    const apply = vi.fn(); render(<LotSelector open onClose={vi.fn()} productId="p" productName="APPAM" quantity={8} price={100} onApply={apply} />);
    fireEvent.click(await screen.findByRole("button", { name: /Fill 8 oldest first/ })); fireEvent.click(screen.getByRole("button", { name: "Apply lot" }));
    expect(apply).toHaveBeenCalledWith([expect.objectContaining({ lotId: "B", quantity: 8 })]); expect(mocks.get).not.toHaveBeenCalled();
  });
});
