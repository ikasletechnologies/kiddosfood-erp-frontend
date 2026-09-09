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
        const { data: created } = await purchaseOrdersApi.create(payload);
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
      
      await purchaseOrdersApi.create(payload);
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCreatePO}
            disabled={!isValid || isSubmitting}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 text-xs font-bold uppercase tracking-wider bg-[#f58220] hover:bg-[#e8740e] text-white rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            <CheckCircle2 size={15} /> {isSubmitting ? (editId ? "Updating..." : "Creating...") : (editId ? "Update PO" : "Create PO")}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto space-y-4 sm:space-y-5 w-full min-w-0">
        {contextMessage && (
          <div className="bg-orange-50/80 border border-orange-200 p-3.5 sm:p-4 rounded-xl flex items-center justify-between shadow-2xs gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-[#f58220] text-white rounded-lg shadow-2xs shrink-0">
                <Package size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-orange-950 uppercase tracking-tight">{contextMessage}</h3>
                <p className="text-xs text-orange-700 mt-0.5">The quantities have been pre-filled with the calculated shortage amount. Please select a vendor and confirm the price.</p>
              </div>
            </div>
            <button 
              onClick={() => setContextMessage(null)}
              className="text-orange-400 hover:text-orange-600 p-1 hover:bg-orange-100 rounded-lg transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-4 sm:gap-5 w-full min-w-0">
          {/* Left Main Content */}
          <div className="col-span-12 lg:col-span-9 space-y-4 sm:space-y-5 min-w-0">

            {/* Meta Information Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Tag size={13} className="text-[#f58220]" /> Purchase Type
                  </label>
                  <select
                    value={purchaseType}
                    onChange={(e) => setPurchaseType(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900 outline-none focus:border-[#f58220] focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer"
                  >
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="PACKAGING_MATERIAL">Packaging Material</option>
                    <option value="CONSUMABLES">Consumables</option>
                    <option value="FIXED_ASSET">Fixed Asset</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Warehouse size={13} className="text-[#f58220]" /> Warehouse
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowWarehouseModal(true)}
                      className="text-[10px] font-bold text-[#f58220] hover:text-[#e8740e] flex items-center gap-0.5 uppercase tracking-wide"
                    >
                      + Add New
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={warehouseId}
                      onChange={(e) => {
                        if (e.target.value === "ADD_NEW") {
                          setShowWarehouseModal(true);
                        } else {
                          setWarehouseId(e.target.value);
                        }
                      }}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900 outline-none focus:border-[#f58220] focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer truncate"
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                      <option value="ADD_NEW" className="font-bold text-orange-500">+ Add New Warehouse...</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowWarehouseModal(true)}
                      className="p-2 border border-slate-200 dark:border-slate-700 hover:border-[#f58220] hover:bg-orange-50 text-slate-500 hover:text-[#f58220] rounded-lg transition-all shrink-0"
                      title="Add New Warehouse"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#f58220]" /> Expected Delivery <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className={clsx(
                        "w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg py-2 text-xs font-bold outline-none focus:border-[#f58220] focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all pl-3",
                        expectedDeliveryDate ? "pr-16 text-transparent" : "pr-8 text-slate-800 dark:text-white"
                      )}
                    />
                    {expectedDeliveryDate && (
                      <span className="absolute left-3 pointer-events-none text-xs font-bold text-slate-800 dark:text-slate-200">
                        {formatDateToDMY(expectedDeliveryDate)}
                      </span>
                    )}
                    <div className="absolute right-2.5 flex items-center gap-1">
                      {expectedDeliveryDate && (
                        <button
                          type="button"
                          onClick={() => setExpectedDeliveryDate("")}
                          className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                          title="Clear Date"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <CreditCard size={13} className="text-[#f58220]" /> Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900 outline-none focus:border-[#f58220] focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer"
                  >
                    <option value="">Select Terms</option>
                    <option value="IMMEDIATE">Immediate</option>
                    <option value="ADVANCE_100">Advance Payment (100%)</option>
                    <option value="ADVANCE_PARTIAL">Advance Payment (Partial)</option>
                    <option value="NET_7">Net 7 Days</option>
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_45">Net 45 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Purchase Order No.</label>
                  <div className="text-xs font-bold text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg inline-block border border-slate-200 dark:border-slate-700">
                    {poNumber || "Auto-generated on save"}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#f58220]" /> Purchase Date
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className={clsx(
                        "w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-lg py-2 text-xs font-bold outline-none focus:border-[#f58220] focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all pl-3",
                        purchaseDate ? "pr-16 text-transparent" : "pr-8 text-slate-800 dark:text-white"
                      )}
                    />
                    {purchaseDate && (
                      <span className="absolute left-3 pointer-events-none text-xs font-bold text-slate-800 dark:text-slate-200">
                        {formatDateToDMY(purchaseDate)}
                      </span>
                    )}
                    <div className="absolute right-2.5 flex items-center gap-1">
                      {purchaseDate && (
                        <button
                          type="button"
                          onClick={() => setPurchaseDate("")}
                          className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                          title="Clear Date"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vendor & Entity Selection */}
            <BillingSection
              fromLabel="Billed To (Entity)"
              fromSubLabel="Your Details"
              toLabel="Billed By (Vendor)"
              toSubLabel="Vendor's Details"
              targetType="vendor"
              onAddTarget={() => {
                if (typeof window !== "undefined") {
                  router.push(`/vendors?action=new&returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
                } else {
                  router.push(`/vendors?action=new&returnTo=/purchases/new`);
                }
              }}
            />

            {/* Section 3: Material Table & Accordions */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-visible">
              <div className="flex bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 rounded-t-xl overflow-hidden px-2">
                <button 
                  type="button"
                  onClick={() => setActiveTab("items")}
                  className={clsx(
                    "px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer",
                    activeTab === "items" 
                      ? "border-[#f58220] text-[#f58220]" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Package size={14} /> Material Items
                  <span className={clsx(
                    "px-1.5 py-0.2 text-[10px] rounded font-bold",
                    activeTab === "items" ? "bg-orange-100 text-[#f58220]" : "bg-slate-200 text-slate-500"
                  )}>
                    {items.filter(i => i.materialId).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("notes")}
                  className={clsx(
                    "px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer",
                    activeTab === "notes" 
                      ? "border-[#f58220] text-[#f58220]" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  <FileText size={14} /> Notes & Terms
                </button>
              </div>
              <div className="p-0">
                {activeTab === "items" && <LineItemsTable />}
                {activeTab === "notes" && (
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Internal Remarks</label>
                        <textarea 
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          placeholder="Internal collaboration notes for team..."
                          className="w-full min-h-[140px] p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none focus:border-[#f58220] focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Supplier Instructions</label>
                        <textarea 
                          value={vendorNotes}
                          onChange={(e) => setVendorNotes(e.target.value)}
                          placeholder="Delivery instructions, shipping terms, packaging requirements..."
                          className="w-full min-h-[140px] p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none focus:border-[#f58220] focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sticky Sidebar */}
          <div className="col-span-12 lg:col-span-3 min-w-0">
            <div className="sticky top-20 space-y-4">
              <DocumentSummary />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
