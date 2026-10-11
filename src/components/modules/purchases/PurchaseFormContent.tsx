"use client";

import DocumentHeader from "@/components/documents/DocumentHeader";
import BillingSection from "@/components/documents/BillingSection";
import LineItemsTable from "@/components/documents/LineItemsTable";
import DocumentSummary from "@/components/documents/DocumentSummary";
import { ChevronDown, Calendar, Plus, Warehouse, CreditCard, Tag, FileText, CheckCircle2, Package, X, ArrowLeft } from "lucide-react";
import { PurchaseOrderProvider, usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { useState, useEffect } from "react";
import { clsx } from "clsx";

import WarehouseFormSidebar from "@/components/modals/WarehouseFormSidebar";
import { inventoryApi, purchaseOrdersApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

const formatDateToDMY = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
};

export function NewPurchaseContent({ editId }: { editId?: string }) {
  const {
    poNumber, setPoNumber,
    invoiceNo, setInvoiceNo,
    purchaseDate, setPurchaseDate,
    dueDate, setDueDate,
    expectedDeliveryDate, setExpectedDeliveryDate,
    warehouseId, setWarehouseId,
    purchaseType, setPurchaseType,
    paymentTerms, setPaymentTerms,
    poStatus,
    discountAmount, setDiscountAmount,
    freightCost, setFreightCost,
    internalNotes, setInternalNotes,
    vendorNotes, setVendorNotes,
    setSelectedVendor,
    isValid, errors, isSubmitting, setIsSubmitting,
    selectedVendor, items, totals, notes,
    contextMessage, setContextMessage
  } = usePurchaseOrder();

  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"items" | "notes">("items");
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await inventoryApi.getWarehouses();
        setWarehouses(response.data);
      } catch (error) {
        console.error("Failed to fetch warehouses", error);
      }
    };
    fetchWarehouses();
  }, []);

  const handleCancel = () => {
    if (!editId) localStorage.removeItem('draftPurchaseOrder');
    router.push("/purchases/orders");
  };

  const handleCreatePO = async () => {
    if (!selectedVendor) {
      toast.error("Please select a vendor.");
      return;
    }
    if (selectedVendor.status && selectedVendor.status !== 'ACTIVE') {
      toast.error("This vendor is blocked and cannot be used for Purchase Orders.");
      return;
    }
    if (!expectedDeliveryDate) {
      toast.error("Expected Delivery date is mandatory.");
      return;
    }
    const parsedDiscount = Number(discountAmount);
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
      toast.error("Discount must be a valid non-negative number.");
      return;
    }
    if (parsedDiscount > totals.subtotal) {
      toast.error("Discount cannot exceed subtotal.");
      return;
    }
    if (!isValid) {
      toast.error("Please fill in all required fields and resolve errors.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        vendorId: selectedVendor!.id,
        advancePaid: totals.appliedAdvance,
        notes: notes || internalNotes || undefined,
        internalNotes: internalNotes || notes || undefined,
        vendorNotes: vendorNotes || undefined,
        deliveryInstructions: vendorNotes || undefined,
        warehouseId: warehouseId || undefined,
        franchiseId: (warehouses.find(w => w.id === warehouseId) as any)?.franchiseId || undefined,
        paymentTerms: paymentTerms || undefined,
        purchaseType: purchaseType,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : undefined,
        discountAmount: discountAmount || 0,
        freightCost: freightCost || 0,
        items: items.map(item => ({
          inventoryItemId: item.materialId,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          gstRate: item.gstRate
        }))
      };
      if (editId) {
        // Real in-place update — preserves the PO's id/history instead of the
        // previous delete+recreate workaround. Blocked server-side once the PO
        // has a GRN/Invoice against it.
        await purchaseOrdersApi.update(editId, payload);
        localStorage.removeItem('draftPurchaseOrder');
        toast.success("Purchase Order updated successfully!");
      } else {
        // The backend assigns the PO number atomically inside the create
        // transaction — the frontend never sends one. We pick up the real,
        // persisted number from the response so anything shown after this
        // point (toast, redirect target) reflects it.
        const { data: created } = await purchaseOrdersApi.create(payload);
        if (created?.poNumber) setPoNumber(created.poNumber);
        localStorage.removeItem('draftPurchaseOrder');
        toast.success(created?.poNumber ? `Purchase Order ${created.poNumber} created successfully!` : "Purchase Order created successfully!");
      }
      router.push("/purchases/orders");
    } catch (error: any) {
      console.error("Failed to Create Purchase Order", error);
      toast.error(error.response?.data?.error || "Failed to create Purchase Order. Please check your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedVendor) {
      toast.error("Please select a vendor to save as draft.");
      return;
    }
    if (selectedVendor.status && selectedVendor.status !== 'ACTIVE') {
      toast.error("This vendor is blocked and cannot be used for Purchase Orders.");
      return;
    }
    const parsedDiscount = Number(discountAmount);
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
      toast.error("Discount must be a valid non-negative number.");
      return;
    }
    if (parsedDiscount > totals.subtotal) {
      toast.error("Discount cannot exceed subtotal.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        vendorId: selectedVendor.id,
        advancePaid: totals.appliedAdvance || 0,
        notes: notes || internalNotes || "",
        internalNotes: internalNotes || notes || undefined,
        vendorNotes: vendorNotes || undefined,
        deliveryInstructions: vendorNotes || undefined,
        warehouseId: warehouseId || undefined,
        franchiseId: (warehouses.find(w => w.id === warehouseId) as any)?.franchiseId || undefined,
        paymentTerms: paymentTerms || undefined,
        purchaseType: purchaseType,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : undefined,
        discountAmount: discountAmount || 0,
        freightCost: freightCost || 0,
        status: "DRAFT",
        items: items
          .filter(item => item.materialId)
          .map(item => ({
            inventoryItemId: item.materialId,
            quantity: item.quantity || 0,
            unit: item.unit,
            price: item.price || 0,
            gstRate: item.gstRate
          }))
      };

      const { data: created } = await purchaseOrdersApi.create(payload);
      if (created?.poNumber) setPoNumber(created.poNumber);
      localStorage.removeItem('draftPurchaseOrder');
      toast.success("Draft Purchase Order saved successfully!");
      router.push("/purchases/orders");
    } catch (error: any) {
      console.error("Failed to save draft", error);
      const msg = error?.response?.data?.error || error?.message || "Failed to save draft. Please check your inputs.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-background min-h-full text-slate-800 dark:text-foreground">
      <WarehouseFormSidebar
        isOpen={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        onSuccess={(warehouse) => {
          setWarehouses(prev => [...prev, warehouse]);
          setWarehouseId(warehouse.id);
        }}
      />

      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-[#0B0D14]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push("/purchases/orders")}
            className="p-2 -ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
            title="Back to Purchase Orders"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="p-2 sm:p-2.5 bg-orange-50 dark:bg-orange-950/30 text-[#f58220] rounded-xl border border-orange-100 dark:border-orange-900/30 shrink-0">
            <Package size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {editId ? "Edit Purchase Order" : "New Purchase Order"}
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-mono">{poNumber ? `#${poNumber}` : "Auto-generated on save"}</p>
          </div>
        </div>

      </div>

      <div className="p-3 sm:p-4 md:p-5 max-w-[1600px] mx-auto space-y-3.5 w-full min-w-0 pb-24">
        {contextMessage && (
          <div className="bg-orange-50/80 border border-orange-200 p-3.5 rounded-xl flex items-center justify-between shadow-sm gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-[#f58220] text-white rounded-lg shrink-0"><Package size={16} /></div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-orange-950 uppercase tracking-tight">{contextMessage}</h3>
                <p className="text-xs text-orange-700 mt-0.5">Quantities are pre-filled from the shortage. Select a vendor and confirm the price.</p>
              </div>
            </div>
            <button type="button" onClick={() => setContextMessage(null)} className="text-orange-400 hover:text-orange-600 p-1 hover:bg-orange-100 rounded-lg"><X size={15} /></button>
          </div>
        )}

        {/* Order details */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Order details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Purchase type</label>
              <select value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)} className="w-full h-10 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-semibold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-950 outline-none focus:border-[#f58220] focus:ring-2 focus:ring-orange-100">
                <option value="ALL">All</option><option value="RAW_MATERIAL">Raw Material</option><option value="PACKAGING">Packaging</option><option value="EQUIPMENT">Equipment</option><option value="CONSUMABLES">Consumables</option><option value="SERVICES">Services</option><option value="OTHERS">Others</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Purchase date</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full h-10 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-semibold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-950 outline-none focus:border-[#f58220] focus:ring-2 focus:ring-orange-100" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Expected delivery <span className="text-rose-500">*</span></label>
              <input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="w-full h-10 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-semibold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-950 outline-none focus:border-[#f58220] focus:ring-2 focus:ring-orange-100" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Payment terms</label>
              <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full h-10 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-semibold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-950 outline-none focus:border-[#f58220] focus:ring-2 focus:ring-orange-100">
                <option value="">Select terms</option><option value="IMMEDIATE">Immediate</option><option value="ADVANCE_100">Advance Payment (100%)</option><option value="ADVANCE_PARTIAL">Advance Payment (Partial)</option><option value="NET_7">Net 7 Days</option><option value="NET_15">Net 15 Days</option><option value="NET_30">Net 30 Days</option><option value="NET_45">Net 45 Days</option><option value="NET_60">Net 60 Days</option>
              </select>
            </div>
          </div>
        </section>

        {/* Vendor and billing */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Vendor &amp; billing</h2>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)] gap-4">
            <BillingSection fromLabel="Bill to" fromSubLabel="Your Details" toLabel="Vendor" toSubLabel="Vendor Details" targetType="vendor" onAddTarget={() => { if (typeof window !== "undefined") { router.push(`/vendors?action=new&returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); } else { router.push(`/vendors?action=new&returnTo=/purchases/new`); } }} />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Delivery warehouse</label>
                <button type="button" onClick={() => setShowWarehouseModal(true)} className="text-[11px] font-semibold text-[#f58220] hover:text-[#e8740e]">+ New</button>
              </div>
              <div className="min-h-[96px] p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center">
                <select value={warehouseId} onChange={(e) => { if (e.target.value === "ADD_NEW") setShowWarehouseModal(true); else setWarehouseId(e.target.value); }} className="w-full h-10 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-xs font-semibold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-950 outline-none focus:border-[#f58220] focus:ring-2 focus:ring-orange-100">
                  <option value="">Select warehouse</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}<option value="ADD_NEW">+ Add New Warehouse...</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Material items */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Material items</h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">{items.filter(i => i.materialId).length} items</span>
          </div>
          <LineItemsTable />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] gap-3.5 items-start">
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Notes &amp; terms</h2>
            <div className="space-y-4">
              <div><label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Notes</label><textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Add purchase order notes..." className="w-full min-h-[90px] p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-[#f58220] focus:ring-2 focus:ring-orange-100 resize-y" /></div>
              <div><label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Terms &amp; conditions</label><textarea value={vendorNotes} onChange={(e) => setVendorNotes(e.target.value)} placeholder="Add terms and conditions..." className="w-full min-h-[90px] p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-[#f58220] focus:ring-2 focus:ring-orange-100 resize-y" /></div>
            </div>
          </section>
          <DocumentSummary />
        </div>
      </div>

      {/* Bottom actions */}
      <div className="sticky bottom-0 z-30 bg-white/95 dark:bg-[#0B0D14]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
        <button type="button" onClick={handleCancel} disabled={isSubmitting} className="px-5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">Cancel</button>
        <button type="button" onClick={handleCreatePO} disabled={!isValid || isSubmitting} className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"><CheckCircle2 size={15} /> {isSubmitting ? (editId ? "Updating..." : "Creating...") : (editId ? "Update PO" : "Create PO")}</button>
      </div>
    </div>
  );
}
