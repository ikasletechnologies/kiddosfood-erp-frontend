// PO form: Cancel creates nothing; Create PO creates exactly one record, even
// when double-clicked.
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => {
  let resolveCreate: (v: any) => void = () => {};
  return {
    push: vi.fn(),
    create: vi.fn(() => new Promise((res) => { resolveCreate = res; })),
    update: vi.fn(async () => ({ data: {} })),
    resolve: (v: any) => resolveCreate(v),
    setIsSubmitting: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", () => ({
  inventoryApi: { getWarehouses: vi.fn(async () => ({ data: [] })) },
  purchaseOrdersApi: { create: h.create, update: h.update },
}));
vi.mock("@/lib/purchase-dates", () => ({ purchaseBusinessDate: () => "2026-11-23", purchaseFormDateError: () => null }));
vi.mock("@/components/documents/DocumentHeader", () => ({ default: () => null }));
vi.mock("@/components/documents/BillingSection", () => ({ default: () => null }));
vi.mock("@/components/documents/LineItemsTable", () => ({ default: () => null }));
vi.mock("@/components/documents/DocumentSummary", () => ({ default: () => null }));
vi.mock("@/components/modals/WarehouseFormSidebar", () => ({ default: () => null }));

// A complete, valid PO in context (only the submit/cancel handlers are under test).
vi.mock("@/context/PurchaseOrderContext", () => {
  const noop = () => {};
  const state: any = {
    poNumber: "", setPoNumber: noop, invoiceNo: "", setInvoiceNo: noop,
    purchaseDate: "2026-11-23", setPurchaseDate: noop, dueDate: "", setDueDate: noop,
    expectedDeliveryDate: "2026-11-23", setExpectedDeliveryDate: noop, originalExpectedDeliveryDate: null,
    warehouseId: "", setWarehouseId: noop, purchaseType: "RAW_MATERIAL", setPurchaseType: noop,
    isBulkPurchase: false, setIsBulkPurchase: noop, paymentTerms: "", setPaymentTerms: noop,
    poStatus: "APPROVED", discountAmount: 0, setDiscountAmount: noop, freightCost: 0, setFreightCost: noop,
    internalNotes: "", setInternalNotes: noop, vendorNotes: "", setVendorNotes: noop,
    setSelectedVendor: noop, isValid: true, errors: {}, isSubmitting: false, setIsSubmitting: h.setIsSubmitting,
    selectedVendor: { id: "v1", name: "Vendor One", status: "ACTIVE" },
    items: [{ id: "1", materialId: "m1", name: "Sugar", quantity: 2, unit: "KG", price: 10, gstRate: 5 }],
    updateItem: noop, notes: "", contextMessage: null, setContextMessage: noop,
    totals: { subtotal: 20, taxAmount: 1, grandTotal: 21, appliedAdvance: 0, total: 21, cgst: 0.5, sgst: 0.5, igst: 0 },
  };
  return {
    usePurchaseOrder: () => state,
    PurchaseOrderProvider: ({ children }: any) => children,
  };
});

import { NewPurchaseContent } from "@/components/modules/purchases/PurchaseFormContent";

describe("PO form submit / cancel", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("Cancel creates nothing", async () => {
    render(<NewPurchaseContent />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect(h.push).toHaveBeenCalledWith("/purchases/orders");
  });

  it("Create PO submits exactly one record, even on a double-click", async () => {
    render(<NewPurchaseContent />);
    const create = screen.getByRole("button", { name: /Create PO/ });
    // Both clicks land while the first request is still in flight.
    await act(async () => {
      fireEvent.click(create);
      fireEvent.click(create);
    });
    expect(h.create).toHaveBeenCalledTimes(1);
    await act(async () => { h.resolve({ data: { poNumber: "PO-2026-001" } }); });
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/purchases/orders"));
    expect(h.create).toHaveBeenCalledTimes(1);
  });
});
