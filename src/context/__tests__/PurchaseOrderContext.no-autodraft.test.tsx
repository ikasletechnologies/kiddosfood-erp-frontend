// New-PO form keeps unsaved edits in React memory only: no API mutation and no
// browser storage on open or on edit, and a stale stored draft is never
// restored. (Automatic draft persistence was removed.)
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => {
  const mutation = () => vi.fn(async () => ({ data: {} }));
  return {
    purchaseOrdersApi: { getById: vi.fn(async () => ({ data: null })), create: mutation(), update: mutation(), delete: mutation(), cancel: mutation() },
    vendorsApi: { getAll: vi.fn(async () => ({ data: [] })), getById: vi.fn(async () => ({ data: null })), create: mutation() },
    draftsApi: { getDrafts: vi.fn(async () => ({ data: [] })), saveDraft: mutation(), deleteDraft: mutation() },
  };
});
vi.mock("@/lib/api", () => ({ default: {}, ...api }));

import { PurchaseOrderProvider, usePurchaseOrder } from "@/context/PurchaseOrderContext";

const mutations = () => [
  api.purchaseOrdersApi.create, api.purchaseOrdersApi.update, api.purchaseOrdersApi.delete, api.purchaseOrdersApi.cancel,
  api.vendorsApi.create, api.draftsApi.saveDraft, api.draftsApi.deleteDraft,
];

let ctx: ReturnType<typeof usePurchaseOrder>;
function Probe() {
  ctx = usePurchaseOrder();
  return null;
}

describe("PurchaseOrderContext — no automatic drafts", () => {
  let setItem: any;
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    setItem = vi.spyOn(Storage.prototype, "setItem");
  });
  afterEach(() => setItem.mockRestore());

  it("opening a new PO makes zero mutations and writes nothing to storage", async () => {
    render(<PurchaseOrderProvider><Probe /></PurchaseOrderProvider>);
    await waitFor(() => expect(ctx).toBeTruthy());
    for (const m of mutations()) expect(m).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("editing fields stays in memory: zero mutations, no draft written", async () => {
    render(<PurchaseOrderProvider><Probe /></PurchaseOrderProvider>);
    await waitFor(() => expect(ctx).toBeTruthy());
    await act(async () => {
      ctx.setSelectedVendor({ id: "v1", name: "Vendor One" } as any);
      ctx.addItem();
      ctx.setNotes("deliver before noon");
    });
    expect(ctx.notes).toBe("deliver before noon");
    expect(ctx.selectedVendor?.id).toBe("v1");
    for (const m of mutations()) expect(m).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalledWith("draftPurchaseOrder", expect.anything());
    expect(localStorage.getItem("draftPurchaseOrder")).toBeNull();
  });

  it("a stale stored draft from the old auto-save is NOT restored (refresh/back discard)", async () => {
    localStorage.setItem("draftPurchaseOrder", JSON.stringify({
      selectedVendor: { id: "old-v", name: "Old Vendor" },
      items: [{ id: "1", materialId: "m1", name: "Old Item", quantity: 9, unit: "KG", price: 5, gstRate: 5 }],
      notes: "old notes",
    }));
    render(<PurchaseOrderProvider><Probe /></PurchaseOrderProvider>);
    await waitFor(() => expect(ctx).toBeTruthy());
    expect(ctx.selectedVendor).toBeNull();
    expect(ctx.notes).toBe("");
    expect(ctx.items.some((i: any) => i.name === "Old Item")).toBe(false);
    expect(api.vendorsApi.getById).not.toHaveBeenCalled();
  });
});
