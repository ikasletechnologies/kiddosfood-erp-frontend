"use client";

import DocumentHeader from "@/components/documents/DocumentHeader";
import BillingSection from "@/components/documents/BillingSection";
import LineItemsTable from "@/components/documents/LineItemsTable";
import DocumentSummary from "@/components/documents/DocumentSummary";
import DocumentOptions from "@/components/documents/DocumentOptions";
import { ChevronDown, Calendar, Plus, Warehouse, CreditCard, Tag, FileText, CheckCircle2, Package, X, ArrowLeft } from "lucide-react";
import { PurchaseOrderProvider, usePurchaseOrder } from "@/context/PurchaseOrderContext";
import { useState, useEffect } from "react";
import { clsx } from "clsx";

import VendorFormModal from "@/components/modals/VendorFormModal";
import WarehouseFormSidebar from "@/components/modals/WarehouseFormSidebar";
import { inventoryApi, purchaseOrdersApi, settingsApi } from "@/lib/api";
import GSTInvoice from "@/components/documents/GSTInvoice";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

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
    internalNotes, setInternalNotes,
    vendorNotes, setVendorNotes,
    setSelectedVendor,
    isValid, errors, isSubmitting, setIsSubmitting,
    selectedVendor, items, totals, notes,
    contextMessage, setContextMessage
  } = usePurchaseOrder();
  
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"items" | "notes">("items");
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([]);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await inventoryApi.getWarehouses();
        setWarehouses(response.data);
      } catch (error) {
        console.error("Failed to fetch warehouses", error);
      }
    };
    const fetchCompanyProfile = async () => {
      try {
        const response = await settingsApi.getCompanyProfile();
        setCompanyProfile(response.data);
      } catch (error) {
        console.error("Failed to fetch company profile", error);
      }
    };
    fetchWarehouses();
    fetchCompanyProfile();
  }, []);

  const handleCreatePO = async () => {
    if (!expectedDeliveryDate) {
      toast.error("Expected Delivery date is mandatory.");
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
        notes: notes || internalNotes,
        warehouseId: warehouseId,
        purchaseType: purchaseType,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : undefined,
        items: items.map(item => ({
          inventoryItemId: item.materialId,
          quantity: item.quantity,
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
        await purchaseOrdersApi.create(payload);
        localStorage.removeItem('draftPurchaseOrder');
        toast.success("Purchase Order created successfully!");
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
    
    setIsSubmitting(true);
    try {
      const payload = {
        vendorId: selectedVendor.id,
        advancePaid: totals.appliedAdvance || 0,
        notes: notes || internalNotes || "",
        warehouseId: warehouseId || undefined,
        purchaseType: purchaseType,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : undefined,
        status: "DRAFT",
        items: items
          .filter(item => item.materialId)
          .map(item => ({
            inventoryItemId: item.materialId,
            quantity: item.quantity || 0,
            price: item.price || 0,
            gstRate: item.gstRate
          }))
      };
      
      await purchaseOrdersApi.create(payload);
      localStorage.removeItem('draftPurchaseOrder');
      toast.success("Draft Purchase Order saved successfully!");
      router.push("/purchases/orders");
    } catch (error) {
      console.error("Failed to save draft", error);
      toast.error("Failed to save draft. Please check your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-full">
      <VendorFormModal
        isOpen={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onSuccess={(vendor) => { setSelectedVendor(vendor); }}
      />
      <WarehouseFormSidebar
        isOpen={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        onSuccess={(warehouse) => {
          setWarehouses(prev => [...prev, warehouse]);
          setWarehouseId(warehouse.id);
        }}
      />

      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-white dark:bg-[#0B0D14] border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/purchases/orders")}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Purchase Orders"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="p-2 bg-orange-100 rounded-lg">
            <Package size={18} className="text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">{editId ? "Edit Purchase Order" : "New Purchase Order"}</h1>
            <p className="text-xs text-gray-400 font-mono">#{poNumber}</p>
          </div>
          <span className={clsx(
            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border",
            poStatus === "DRAFT" ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-orange-50 text-orange-600 border-orange-100"
          )}>
            {poStatus}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(true)}
            className="px-4 py-2 text-sm font-semibold border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 transition-colors flex items-center gap-1.5"
          >
            <FileText size={14} /> Preview
          </button>
          <button
            onClick={handleCreatePO}
            disabled={!isValid || isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={15} /> {isSubmitting ? (editId ? "Updating..." : "Creating...") : (editId ? "Update Purchase Order" : "Create Purchase Order")}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {contextMessage && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <Package size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-orange-800">{contextMessage}</h3>
                <p className="text-xs text-orange-600">The quantities have been pre-filled with the calculated shortage amount. Please select a vendor and confirm the price.</p>
              </div>
            </div>
            <button 
              onClick={() => setContextMessage(null)}
              className="text-orange-400 hover:text-orange-600 p-1 hover:bg-orange-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-5">
          {/* Left Main Content */}
          <div className="col-span-12 lg:col-span-9 space-y-4">

            {/* Meta Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                    <Tag size={14} className="text-slate-400" /> Purchase Type
                  </label>
                  <select
                    value={purchaseType}
                    onChange={(e) => setPurchaseType(e.target.value)}
                    className="w-full border border-slate-350 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-orange-500 transition-colors"
                  >
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="PACKAGING_MATERIAL">Packaging Material</option>
                    <option value="CONSUMABLES">Consumables</option>
                    <option value="FIXED_ASSET">Fixed Asset</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-500 flex items-center gap-1">
                    <Warehouse size={14} className="text-slate-400" /> Warehouse
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowWarehouseModal(true)}
                      className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
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
                      className="w-full border border-slate-355 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-orange-500 transition-colors"
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
                      className="p-2 border border-slate-350 dark:border-slate-700 hover:border-orange-500 hover:bg-orange-50/50 text-slate-500 hover:text-orange-600 rounded-lg transition-all"
                      title="Add New Warehouse"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                    <Calendar size={14} className="text-slate-400" /> Expected Delivery <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className={clsx(
                        "w-full border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg py-2 text-sm outline-none focus:border-orange-500 transition-colors pl-3",
                        expectedDeliveryDate ? "pr-16 text-transparent" : "pr-8 text-slate-700"
                      )}
                    />
                    {expectedDeliveryDate && (
                      <span className="absolute left-3 pointer-events-none text-sm text-slate-700 dark:text-slate-200">
                        {formatDateToDMY(expectedDeliveryDate)}
                      </span>
                    )}
                    <div className="absolute right-2.5 flex items-center gap-1">
                      {expectedDeliveryDate && (
                        <button
                          type="button"
                          onClick={() => setExpectedDeliveryDate("")}
                          className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title="Clear Date"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                    <CreditCard size={14} className="text-slate-400" /> Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full border border-slate-350 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-orange-500 transition-colors"
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
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Purchase Order No.</label>
                  <div className="text-sm font-bold text-gray-800 font-mono">{poNumber}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                    <Calendar size={14} className="text-slate-400" /> Purchase Date
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className={clsx(
                        "w-full border border-slate-350 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg py-2 text-sm outline-none focus:border-orange-500 transition-colors pl-3",
                        purchaseDate ? "pr-16 text-transparent" : "pr-8 text-slate-700"
                      )}
                    />
                    {purchaseDate && (
                      <span className="absolute left-3 pointer-events-none text-sm text-slate-700 dark:text-slate-200">
                        {formatDateToDMY(purchaseDate)}
                      </span>
                    )}
                    <div className="absolute right-2.5 flex items-center gap-1">
                      {purchaseDate && (
                        <button
                          type="button"
                          onClick={() => setPurchaseDate("")}
                          className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title="Clear Date"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vendor Selection */}
            <BillingSection
              fromLabel="Billed To (Entity)"
              fromSubLabel="Your Details"
              toLabel="Billed By (Vendor)"
              toSubLabel="Vendor's Details"
              targetType="vendor"
              onAddTarget={() => setShowVendorModal(true)}
            />

          {/* Section 3: Material Table & Accordions */}
          <div className="bg-white dark:bg-[#0A0D14] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-visible">
             <div className="flex bg-slate-50/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 rounded-t-2xl overflow-hidden">
                <button 
                  onClick={() => setActiveTab("items")}
                  className={clsx(
                    "px-6 py-3 text-xs font-semibold uppercase tracking-wide transition-all border-b-2",
                    activeTab === "items" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400 hover:text-gray-600"
                  )}
                >
                  Material Items
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={clsx(
                    "px-6 py-3 text-xs font-semibold uppercase tracking-wide transition-all border-b-2",
                    activeTab === "notes" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-400 hover:text-gray-600"
                  )}
                >
                  Notes & Terms
                </button>
             </div>
              <div className="p-0">
                {activeTab === "items" && <LineItemsTable />}
                {activeTab === "notes" && (
                  <div className="p-6 space-y-6">
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Internal Remarks</label>
                           <textarea 
                             value={internalNotes}
                             onChange={(e) => setInternalNotes(e.target.value)}
                             placeholder="Internal collaboration notes..."
                             className="w-full min-h-[140px] p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-orange-500 transition-colors resize-none"
                           />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Supplier Instructions</label>
                           <textarea 
                             value={vendorNotes}
                             onChange={(e) => setVendorNotes(e.target.value)}
                             placeholder="Delivery instructions, terms, etc..."
                             className="w-full min-h-[140px] p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-orange-500 transition-colors resize-none"
                           />
                        </div>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Right Sticky Sidebar */}
        <div className="col-span-12 lg:col-span-3">
          <div className="sticky top-24 space-y-8">
             <DocumentSummary />
           </div>
        </div>
      </div>
      </div>

      {showPreview && (
        <GSTInvoice
          order={{
            poNumber: poNumber || "DRAFT-00001",
            createdAt: purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString(),
            poItems: items.map((item, idx) => ({
              itemName: item.name || `Material #${idx + 1}`,
              quantity: item.quantity || 0,
              price: item.price || 0,
              gstRate: item.gstRate || 0,
              unit: item.unit || "unit"
            })),
            advancePaid: totals.appliedAdvance || 0,
            paid: totals.appliedAdvance || 0
          }}
          vendor={selectedVendor || {
            name: "NO VENDOR SELECTED",
            address: "Please select a vendor in the form",
            gstin: "",
            phone: ""
          }}
          companyDetails={companyProfile || FALLBACK_COMPANY}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
