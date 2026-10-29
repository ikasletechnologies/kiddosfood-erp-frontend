import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SemiFinishedStockClient from "../SemiFinishedStockClient";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/api/semi-finished.api", () => ({ semiFinishedApi: { list: mocks.list } }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("@/components/ui/Modal", () => ({ Modal: ({ title, children }: any) => <div role="dialog"><h2>{title}</h2>{children}</div> }));
const row = { id: "lot-1", inventoryItemId: "item", productBatchId: "batch-1", familyId: "product-1", familyCode: "APPAM", productName: "APPAM", lotNumber: "BULK-A", sourceBatchCode: "PURCHASE-A", sourceType: "PURCHASE", warehouse: { id: "w1", name: "Main Warehouse" }, originalQty: 20, packagedQty: 9, remainingQty: 11, reservedQty: 0, availableQty: 11, unit: "KG", unitCost: 100, remainingValue: 1100, productionDate: "2026-10-28T00:00:00Z", expiryDate: "2099-12-31T00:00:00Z", expiryStatus: "VALID", status: "READY", supplier: "Supplier A", purchaseOrderId: "po-1", purchaseOrderNumber: "PO-1", goodsReceiptId: "grn-1", franchiseId: "hq", packagingUrl: "/packaging?batchId=batch-1&bulkLotId=lot-1&franchiseId=hq", unreleased: false };
const data = { rows: [row], warehouses: [row.warehouse], showCost: true, summary: { productFamilies: 1, availableByUnit: { KG: 11, L: 5 }, activeLots: 2, manufacturedByUnit: { L: 5 }, purchasedByUnit: { KG: 11 }, expiringSoonLots: 0 } };
describe("Semi-Finished Goods Stock Hub", () => {
  afterEach(cleanup);
  beforeEach(() => mocks.list.mockReset().mockResolvedValue({ data }));
  it("loads both source totals without combining KG and L and links the exact lot to Packaging", async () => {
    render(<SemiFinishedStockClient />);
    await screen.findByText("BULK-A");
    const card = screen.getByText("Available Unpacked Quantity").parentElement!;
    expect(within(card).getByText("11 KG · 5 L")).toBeInTheDocument();
    expect(screen.getByText("Purchased Bulk", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Packaging/ })).toHaveAttribute("href", row.packagingUrl);
    fireEvent.click(screen.getByRole("button", { name: "View Source Purchase Lot" }));
    expect(within(screen.getByRole("dialog")).getByText("grn-1")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("Supplier A")).toBeInTheDocument();
  });
  it("sends search, warehouse, source and expiry filters to the backend", async () => {
    render(<SemiFinishedStockClient />); await screen.findByText("BULK-A");
    fireEvent.change(screen.getByLabelText("Search semi-finished goods"), { target: { value: "APPAM" } });
    fireEvent.change(screen.getByLabelText("Warehouse"), { target: { value: "w1" } });
    fireEvent.change(screen.getByLabelText("Source type"), { target: { value: "PURCHASE" } });
    fireEvent.change(screen.getByLabelText("Expiry status"), { target: { value: "VALID" } });
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith({ search: "APPAM", warehouseId: "w1", sourceType: "PURCHASE", expiryStatus: "VALID" }));
  });
  it("refreshes live quantities and prevents packaging expired stock", async () => {
    render(<SemiFinishedStockClient />); await screen.findByText("BULK-A");
    mocks.list.mockResolvedValue({ data: { ...data, rows: [{ ...row, remainingQty: 2, availableQty: 0, status: "EXPIRED" }] } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByText("EXPIRED", { selector: "span" });
    expect(screen.queryByRole("link", { name: /Go to Packaging/ })).toBeNull();
  });
  it("shows an error and supports retry and an empty state", async () => {
    mocks.list.mockRejectedValueOnce(new Error("offline"));
    render(<SemiFinishedStockClient />);
    await screen.findByRole("alert");
    mocks.list.mockResolvedValueOnce({ data: { ...data, rows: [] } });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No unpacked bulk lots match your filters.")).toBeInTheDocument();
  });
});
