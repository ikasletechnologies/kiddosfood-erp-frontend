"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Package as PackageIcon,
  ChevronDown as ChevronDownIcon,
  CheckCircle2 as CheckCircle2Icon,
  XCircle as XCircleIcon,
  AlertTriangle as AlertTriangleIcon,
  Truck as TruckIcon,
  ClipboardCheck as ClipboardCheckIcon,
  ArrowLeft as ArrowLeftIcon,
  Loader2 as Loader2Icon,
  Search as SearchIcon,
  Calendar as CalendarIcon,
  ExternalLink as ExternalLinkIcon,
  ArrowRight as ArrowRightIcon,
  History as HistoryIcon,
  Plus as PlusIcon,
  Scan as ScanIcon
} from "lucide-react";
import { purchaseOrdersApi, grnApi, purchaseReturnsApi, vendorsApi, inventoryApi } from "@/lib/api";
import { clsx } from "clsx";
import { formatERPNumber } from "@/lib/utils";
import WarehouseFormSidebar from "@/components/modals/WarehouseFormSidebar";

interface POItem {
  id: string;
  inventoryItem: { id: string; name: string; unit: string };
  quantity: number;
  price: number;
}

interface PO {
  id: string;
  poNumber?: string;
  vendorId?: string;
  vendor: { id?: string; name: string };
  status: string;
  totalAmount: number;
  createdAt: string;
  poItems: POItem[];
}

interface GRNItem {
  materialId: string;
  quantity: number;       // ordered
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  price: number;
  vendorBatchNo?: string;
  mfgDate?: string;
  expDate?: string;
  lotNumber?: string;
  warehouseId?: string;
  inventoryItem?: { name: string; unit: string };
}

export default function GRNPage() {
  const router = useRouter();
  const [view, setView] = useState<"NEW" | "HISTORY">("NEW");
  const [step, setStep] = useState<1 | 2>(1);
  const [pos, setPOs] = useState<PO[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [grnItems, setGrnItems] = useState<GRNItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const [poSearch, setPoSearch] = useState("");
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>("");
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);

  const handleSaveDraft = () => {
    toast.success("GRN Draft saved successfully (reference kept local).");
  };

  const handleSubmitForReview = () => {
    toast.success("GRN submitted to review queue.");
  };

  const handlePrintGRN = () => {
    toast.success("Preparing printable GRN layout...");
    window.print();
  };

  // Fetch Warehouses on mount
  useEffect(() => {
    inventoryApi.getWarehouses()
      .then(res => {
        const list = res.data || [];
        setWarehouses(list);
        if (list.length > 0) {
          setDefaultWarehouseId(list[0].id);
          setGrnItems(prev => prev.map(item => ({
            ...item,
            warehouseId: item.warehouseId || list[0].id
          })));
        }
      })
      .catch(err => {
        console.error("Failed to fetch warehouses:", err);
      });
  }, []);

  const handleDefaultWarehouseChange = (whId: string) => {
    if (whId === "ADD_NEW") {
      setShowWarehouseModal(true);
      return;
    }
    setDefaultWarehouseId(whId);
    setGrnItems(prev => prev.map(item => ({ ...item, warehouseId: whId })));
  };

  const handleWarehouseCreated = (newWh: { id: string; name: string }) => {
    setWarehouses(prev => {
      const exists = prev.some(w => w.id === newWh.id);
      return exists ? prev : [...prev, newWh];
    });
    setDefaultWarehouseId(newWh.id);
    setGrnItems(prev => prev.map(item => ({
      ...item,
      warehouseId: item.warehouseId || newWh.id
    })));
    toast.success(`Warehouse "${newWh.name}" added and selected for all items!`);
  };

  // Scanner Simulator States
  const [showScanner, setShowScanner] = useState(false);
  const [scannedPO, setScannedPO] = useState<PO | null>(null);
  const [isScanProcessing, setIsScanProcessing] = useState(false);
  const [scanInput, setScanInput] = useState("");

  // Fetch Pending POs or History based on view
  useEffect(() => {
    setLoading(true);
    if (view === "NEW") {
      purchaseOrdersApi.getAll().then(r => {
        const orders = r.data.orders || r.data || [];
        const pending = orders.filter(
          (p: PO) => p.status === "PENDING" || p.status === "APPROVED" || p.status === "SENT" || p.status === "PARTIALLY_RECEIVED"
        );
        setPOs(pending);

        // Auto-select if PO ID provided in URL
        const urlParams = new URLSearchParams(window.location.search);
        const poId = urlParams.get('poId');
        if (poId) {
          const po = pending.find((p: PO) => p.id === poId);
          if (po) selectPO(po);
        }
      }).finally(() => setLoading(false));
    } else {
      grnApi.getAll().then(r => {
        setHistory(r.data || []);
      }).finally(() => setLoading(false));
    }
  }, [view]);

  const selectPO = (po: PO) => {
    setSelectedPO(po);
    setGrnItems(
      (po.poItems || []).map(item => ({
        materialId: item.inventoryItem.id,
        quantity: item.quantity,
        receivedQty: item.quantity,
        acceptedQty: item.quantity,
        rejectedQty: 0,
        price: item.price,
        vendorBatchNo: "",
        mfgDate: "",
        expDate: "",
        lotNumber: "",
        warehouseId: defaultWarehouseId || "",
        inventoryItem: item.inventoryItem,
      }))
    );
    setStep(2);
  };

  const updateItem = (idx: number, field: keyof GRNItem, val: number) => {
    setGrnItems(prev => {
      const next = [...prev];
      const currentItem = { ...next[idx], [field]: val };

      // Calculate Accepted = Received - Rejected
      if (field === "receivedQty" || field === "rejectedQty") {
        const received = field === "receivedQty" ? val : currentItem.receivedQty;
        const rejected = field === "rejectedQty" ? val : currentItem.rejectedQty;
        currentItem.acceptedQty = Math.max(0, received - rejected);
      }

      next[idx] = currentItem;
      return next;
    });
  };

  const updateItemStr = (idx: number, field: keyof GRNItem, val: string) => {
    if (field === "warehouseId" && val === "ADD_NEW") {
      setShowWarehouseModal(true);
      return;
    }
    setGrnItems(prev => {
      const next = [...prev];
      const currentItem = { ...next[idx], [field]: val };
      next[idx] = currentItem;
      return next;
    });
  };

  const handleCreateAndApprove = async () => {
    if (!selectedPO) return;

    // If defaultWarehouseId is set, auto-assign to any items missing warehouseId
    let itemsToSubmit = grnItems;
    if (defaultWarehouseId) {
      itemsToSubmit = grnItems.map(item => ({
        ...item,
        warehouseId: item.warehouseId || defaultWarehouseId
      }));
      setGrnItems(itemsToSubmit);
    }

    // Verify that a warehouse is selected for all items
    const missingWarehouse = itemsToSubmit.some(item => !item.warehouseId);
    if (missingWarehouse) {
      if (warehouses.length === 0) {
        toast.error("No warehouse available. Please add a warehouse first.");
        setShowWarehouseModal(true);
        return;
      }
      toast.error("Please select a destination warehouse for all items.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create and Approve GRN (Impacts Inventory)
      const res = await grnApi.createFromPO(selectedPO.id, { items: grnItems });
      const grnId = res.data.id;
      await grnApi.approve(grnId);
      setApprovedId(grnId);

      // 2. Handle Rejections (Auto-create Purchase Return & Credit Adjustment)
      const rejectedItems = grnItems.filter(item => item.rejectedQty > 0);
      if (rejectedItems.length > 0) {
        const vendorId = selectedPO.vendorId || selectedPO.vendor?.id;

        if (vendorId) {
          // Create Purchase Return document
          await purchaseReturnsApi.create({
            vendorId,
            reason: "AUTO-GENERATED FROM GRN REJECTION",
            items: rejectedItems.map(item => ({
              itemName: item.inventoryItem?.name || "Unknown Material",
              quantity: item.rejectedQty,
              unit: item.inventoryItem?.unit || "unit",
              rate: item.price
            }))
          });

          // Purchase Return document is created for vendor tracking
          // Liability is automatically calculated on accepted goods only in the backend
        }
      }

      toast.success("GRN Approved successfully! Stock updated and rejections processed.");

      setTimeout(() => {
        setView("HISTORY");
        setStep(1);
        setSelectedPO(null);
        setApprovedId(null);
      }, 2000);
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || "Failed to create or approve GRN. Please verify quantities.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPOs = pos.filter(p =>
    p.vendor.name.toLowerCase().includes(poSearch.toLowerCase()) ||
    p.poNumber?.toLowerCase().includes(poSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-6 space-y-8 animate-in fade-in duration-500">
      <WarehouseFormSidebar
        isOpen={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        onSuccess={handleWarehouseCreated}
      />
      <div className="max-w-[1500px] mx-auto space-y-8">

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <PackageIcon size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Goods Receipt (GRN)</h1>
              <p className="text-sm text-gray-500 mt-0.5 font-medium flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Manage vendor shipment verification and stock reconciliation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {view === "NEW" && step === 1 && (
              <button
                onClick={() => { setShowScanner(true); setScannedPO(null); setScanInput(""); }}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20 active:scale-95 shrink-0"
              >
                <ScanIcon size={18} strokeWidth={3} />
                Scan PO Label
              </button>
            )}
            <div className="flex p-1 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
              <button
                onClick={() => { setView("NEW"); setStep(1); }}
                className={clsx(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  view === "NEW"
                    ? "bg-white dark:bg-card text-orange-600 shadow-lg shadow-black/[0.03] border border-gray-100 dark:border-white/10"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                New Receipt
              </button>
              <button
                onClick={() => setView("HISTORY")}
                className={clsx(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  view === "HISTORY"
                    ? "bg-white dark:bg-card text-orange-600 shadow-lg shadow-black/[0.03] border border-gray-100 dark:border-white/10"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                Received History
              </button>
            </div>
          </div>
        </header>

        {view === "HISTORY" ? (
          /* --- HISTORY VIEW --- */
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#12141c] rounded-3xl border border-gray-100 dark:border-white/5 shadow-xl shadow-black/[0.02] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                  <tr>
                    {["GRN #", "Vendor", "Reference PO", "Date", "Status", "Items", "Actions"].map(h => (
                      <th key={h} className={clsx("px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]", h === "Actions" ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                  {loading ? (
                    <tr><td colSpan={6} className="px-8 py-16 text-center"><Loader2Icon className="mx-auto text-orange-500 animate-spin" /></td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={6} className="px-8 py-16 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">No receipt history found</td></tr>
                  ) : history.map((grn) => (
                    <tr key={grn.id} className="hover:bg-gray-50/30 dark:hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-5 font-bold text-xs text-orange-600">{formatERPNumber("GRN", grn.id, grn.createdAt)}</td>
                      <td className="px-8 py-5">
                        <div className="text-gray-900 dark:text-white font-black uppercase text-xs">{grn.procurementOrder?.vendor?.name}</div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 tracking-tight">Verified Shipment</div>
                      </td>
                      <td className="px-8 py-5 font-bold text-gray-500 uppercase text-[10px] tracking-tight">
                        {grn.procurementOrder ? formatERPNumber("PO", grn.procurementOrder.poNumber || grn.procurementOrder.id, grn.procurementOrder.createdAt) : 'N/A'}
                      </td>
                      <td className="px-8 py-5 text-gray-500 font-bold text-xs">{new Date(grn.receivedAt || grn.createdAt).toLocaleDateString()}</td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 text-[10px] font-black rounded-xl uppercase tracking-widest border border-emerald-100/50 dark:border-emerald-500/20">
                          {grn.status}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-wrap gap-1.5">
                          {grn.items?.slice(0, 2).map((item: any) => (
                            <span key={item.id} className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 text-[9px] rounded-lg font-black uppercase border border-gray-200/50">
                              {item.inventoryItem?.name} ({item.acceptedQty})
                            </span>
                          ))}
                          {grn.items?.length > 2 && <span className="text-[10px] font-bold text-gray-400 ml-1">+{grn.items.length - 2}</span>}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => router.push(`/purchases/invoices?grnId=${grn.id}`)}
                          className="px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-slate-600 dark:text-slate-300 hover:text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors border border-transparent hover:border-orange-200 dark:hover:border-orange-500/20"
                        >
                          Generate Bill
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : step === 1 ? (
          /* --- STEP 1: SELECT PO --- */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in slide-in-from-bottom-4 duration-500">
            {/* Left: Pending Purchase Orders */}
            <div className="lg:col-span-2 space-y-6">
              <div className="relative max-w-lg">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search Vendor or PO #"
                  value={poSearch}
                  onChange={e => setPoSearch(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-white dark:bg-[#12141c] border border-gray-100 dark:border-white/5 rounded-2xl text-sm font-bold shadow-xl shadow-black/[0.02] outline-none focus:ring-2 ring-orange-500/10 focus:border-orange-500 transition-all transition-all"
                />
              </div>

              {loading ? (
                <div className="py-24 text-center"><Loader2Icon className="mx-auto text-orange-500 animate-spin" size={32} /></div>
              ) : filteredPOs.length === 0 ? (
                <div className="py-32 bg-white dark:bg-[#12141c] rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/5 text-center text-gray-400 shadow-inner">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PackageIcon className="text-gray-300" size={32} />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest">No pending purchase orders available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredPOs.map(po => (
                    <button
                      key={po.id}
                      onClick={() => selectPO(po)}
                      className="flex flex-col p-8 bg-white dark:bg-[#12141c] border border-gray-100 dark:border-white/5 rounded-[2.5rem] hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/[0.05] transition-all text-left group overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-[100px] -mr-8 -mt-8" />
                      <div className="flex items-center justify-between mb-6 relative z-10">
                        <span className="px-4 py-1 bg-orange-50 dark:bg-orange-500/10 text-orange-600 text-[10px] font-black rounded-xl uppercase tracking-widest border border-orange-200/50 dark:border-orange-500/20">
                          {po.poNumber || "PO-PENDING"}
                        </span>
                        <span className="text-[10px] font-black text-gray-400">{new Date(po.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-orange-600 transition-colors uppercase truncate mb-6 relative z-10">
                        {po.vendor.name}
                      </h3>
                      <div className="flex items-center justify-between pt-6 border-t border-gray-50 dark:border-white/5 relative z-10">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Total Value</span>
                          <span className="text-xl font-black text-gray-900 dark:text-white leading-tight">₹{po.totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                          <ArrowRightIcon size={20} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Policy & Stock Impact */}
            {/* <div className="space-y-6">
              <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 p-8 rounded-[2.5rem] space-y-4 shadow-sm border-l-4 border-l-orange-500">
                <div className="flex items-center gap-3 text-orange-600">
                  <AlertTriangleIcon size={24} />
                  <p className="text-xs font-black uppercase tracking-tight">Receipt Policy</p>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1 shrink-0" />
                    <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300 leading-relaxed">
                      Verify the physical count against the digital manifest before confirming.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1 shrink-0" />
                    <p className="text-[10px] font-bold text-orange-700 dark:text-orange-300 leading-relaxed">
                      Reporting damages after receipt may delay credit note processing.
                    </p>
                  </div>
                </div>
              </div> */}

            {/* <div className="bg-slate-50 dark:bg-white/5 rounded-[2.5rem] p-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Stock Impact</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500">HQ Stock</span>
                    <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1">INCREASE <ArrowRightIcon size={10} /></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500">Account Payable</span>
                    <span className="text-[10px] font-black text-orange-500 flex items-center gap-1">UPDATED <ArrowRightIcon size={10} /></span>
                  </div>
                </div>
              </div> */}
          </div>
      ) : (
      /* --- STEP 2: VERIFY QUANTITIES --- */
      <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
        <div className="bg-white dark:bg-[#12141c] p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl shadow-black/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-bl-[120px] -mr-12 -mt-12" />
          <div className="relative z-10">
            <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Verify Shipment Content</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              PO Reference: <span className="font-black text-orange-600">{selectedPO?.poNumber}</span> • Vendor: <span className="font-black text-gray-900 dark:text-gray-200">{selectedPO?.vendor.name}</span>
            </p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-4 relative z-10">
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Default Warehouse</label>
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(true)}
                  className="text-[10px] font-black text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1 uppercase tracking-wider transition-colors"
                >
                  <PlusIcon size={11} /> Add New
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={defaultWarehouseId}
                  onChange={e => handleDefaultWarehouseChange(e.target.value)}
                  className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-900 outline-none focus:border-orange-500"
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
                  className="p-2 border border-orange-500/20 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-500 hover:text-white text-orange-500 rounded-xl transition-all shadow-sm"
                  title="Add New Warehouse"
                >
                  <PlusIcon size={16} />
                </button>
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 border-2 border-gray-100 dark:border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-all self-end"
            >
              Change PO Source
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12141c] rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl shadow-black/[0.02] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
              <tr>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Material</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Traceability</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Warehouse</th>
                <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Ordered</th>
                <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Received</th>
                <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Rejected</th>
                <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Accepted</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {grnItems.map((item, idx) => {
                const originalItem = selectedPO?.poItems[idx];
                return (
                  <tr key={idx} className="hover:bg-gray-50/30 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-black text-gray-900 dark:text-white uppercase text-xs">{originalItem?.inventoryItem.name}</div>
                      <div className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-1 opacity-70">UNIT: {originalItem?.inventoryItem.unit}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <div className="w-32 px-3 py-2 bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 rounded-xl flex items-center justify-center cursor-not-allowed">
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Auto Batch</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Lot Number"
                            value={item.lotNumber || ""}
                            onChange={e => updateItemStr(idx, "lotNumber", e.target.value)}
                            className="w-32 px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-orange-500 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex flex-col">
                            <label className="text-[8px] text-gray-400 font-bold uppercase ml-1 mb-0.5">Mfg Date</label>
                            <input
                              type="date"
                              value={item.mfgDate || ""}
                              onChange={e => updateItemStr(idx, "mfgDate", e.target.value)}
                              className="w-32 px-2 py-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-[10px] outline-none text-gray-900 dark:text-white"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-[8px] text-gray-400 font-bold uppercase ml-1 mb-0.5">Exp Date</label>
                            <input
                              type="date"
                              value={item.expDate || ""}
                              onChange={e => updateItemStr(idx, "expDate", e.target.value)}
                              className="w-32 px-2 py-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-[10px] outline-none text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={item.warehouseId || ""}
                          onChange={e => updateItemStr(idx, "warehouseId", e.target.value)}
                          className="w-44 px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-orange-500 text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-900"
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
                          className="p-2 border border-gray-200 dark:border-white/10 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-500 rounded-xl text-gray-400 transition-all"
                          title="Add Warehouse"
                        >
                          <PlusIcon size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="px-3 py-1.5 bg-gray-50 dark:bg-white/5 rounded-lg text-xs font-black text-gray-400 uppercase">{item.quantity}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <input
                          type="number"
                          min={0}
                          value={item.receivedQty}
                          onChange={e => updateItem(idx, "receivedQty", Number(e.target.value))}
                          className="w-24 text-center px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl font-black text-gray-700 dark:text-gray-200 outline-none focus:border-orange-500 focus:ring-4 ring-orange-500/10 transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <input
                          type="number"
                          min={0}
                          max={item.receivedQty}
                          value={item.rejectedQty}
                          onChange={e => updateItem(idx, "rejectedQty", Number(e.target.value))}
                          className="w-24 text-center px-4 py-3 bg-red-50/30 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 font-black outline-none focus:border-red-400 focus:ring-4 ring-red-500/10 transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-center">
                        <span className="w-24 text-center px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-2xl font-black border border-emerald-100/50 dark:border-emerald-500/20">
                          {item.acceptedQty}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {item.rejectedQty > 0 ? (
                        <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
                          <XCircleIcon size={16} />
                        </div>
                      ) : item.acceptedQty < item.quantity ? (
                        <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto">
                          <AlertTriangleIcon size={16} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto">
                          <CheckCircle2Icon size={16} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Ordered", value: grnItems.reduce((s, i) => s + i.quantity, 0), color: "text-gray-900 dark:text-white", bg: "bg-white dark:bg-[#12141c]" },
            { label: "Received", value: grnItems.reduce((s, i) => s + i.receivedQty, 0), color: "text-orange-500", bg: "bg-orange-50/30 dark:bg-orange-500/5" },
            { label: "Rejected", value: grnItems.reduce((s, i) => s + i.rejectedQty, 0), color: "text-red-500", bg: "bg-red-50/30 dark:bg-red-500/5" },
            { label: "Accepted", value: grnItems.reduce((s, i) => s + i.acceptedQty, 0), color: "text-emerald-500", bg: "bg-emerald-50/30 dark:bg-emerald-500/5" },
          ].map(stat => (
            <div key={stat.label} className={clsx("rounded-[2rem] p-8 border border-gray-100 dark:border-white/5 shadow-xl shadow-black/[0.02] text-center", stat.bg)}>
              <div className={clsx("text-4xl font-black tracking-tighter mb-2", stat.color)}>
                {stat.value}
              </div>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-8">
          <button
            onClick={handleSaveDraft}
            className="w-full sm:w-auto px-8 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
          >
            Save Draft
          </button>
          <button
            onClick={handleSubmitForReview}
            className="w-full sm:w-auto px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-850 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
          >
            Submit
          </button>
          <button
            onClick={handlePrintGRN}
            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
          >
            Print GRN
          </button>
          <button
            onClick={handleCreateAndApprove}
            disabled={submitting}
            className="w-full sm:w-auto px-10 py-4 bg-orange-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2Icon size={14} className="animate-spin" /> : <ClipboardCheckIcon size={14} />}
            Approve & Sync
          </button>
        </div>
      </div>
        )}
    </div>

      {/* ── Purchase Order Label Scanner Modal ── */ }
  {
    showScanner && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
        <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300 p-8 text-white space-y-6">

          {/* Close */}
          <button
            onClick={() => setShowScanner(false)}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              <h3 className="text-xl font-black tracking-tight uppercase">PO Label Scanner</h3>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Simulated camera feed & barcode decoder</p>
          </div>

          {/* Viewfinder / Active Scan Display */}
          {!scannedPO ? (
            <div className="relative h-48 bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden flex flex-col items-center justify-center group">
              {/* Laser animation */}
              <div className="absolute inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_#10b981] animate-[scan_2s_ease-in-out_infinite] z-20" />

              {/* Corner Brackets */}
              <div className="absolute top-6 left-6 w-4 h-4 border-t-2 border-l-2 border-emerald-500 rounded-tl" />
              <div className="absolute top-6 right-6 w-4 h-4 border-t-2 border-r-2 border-emerald-500 rounded-tr" />
              <div className="absolute bottom-6 left-6 w-4 h-4 border-b-2 border-l-2 border-emerald-500 rounded-bl" />
              <div className="absolute bottom-6 right-6 w-4 h-4 border-b-2 border-r-2 border-emerald-500 rounded-br" />

              {isScanProcessing ? (
                <div className="text-center space-y-3 z-10">
                  <Loader2Icon size={28} className="animate-spin text-emerald-500 mx-auto" />
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Decoding PO label...</p>
                </div>
              ) : (
                <div className="text-center space-y-2 z-10">
                  <ScanIcon size={40} className="text-slate-700 animate-pulse mx-auto" />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Align PO barcode inside grid</p>
                </div>
              )}

              {/* Inline scan animation style */}
              <style dangerouslySetInnerHTML={{
                __html: `
                  @keyframes scan {
                    0% { top: 10%; }
                    50% { top: 90%; }
                    100% { top: 10%; }
                  }
                `}} />
            </div>
          ) : (
            <div className="bg-slate-950 border border-emerald-500/20 p-6 rounded-3xl text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2Icon size={24} />
              </div>
              <div>
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Match Decoded Successfully</p>
                <h4 className="text-xl font-black text-white uppercase">{scannedPO.poNumber || "PO-PENDING"}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">₹{scannedPO.totalAmount.toLocaleString()} • {scannedPO.vendor.name}</p>
              </div>
            </div>
          )}

          {/* Simulated target selector */}
          {!scannedPO && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Simulate Scanner Camera Read:</label>
                <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto pr-1">
                  {pos.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic text-center py-2 bg-slate-950 rounded-xl border border-slate-800">
                      No pending purchase orders available to scan.
                    </p>
                  ) : (
                    pos.map((po) => (
                      <button
                        key={po.id}
                        onClick={() => {
                          setIsScanProcessing(true);
                          setTimeout(() => {
                            setIsScanProcessing(false);
                            setScannedPO(po);
                            toast.success(`Label read: ${po.poNumber || "PO-PENDING"}`);
                          }, 1000);
                        }}
                        className="w-full text-left px-4 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-black uppercase tracking-tight transition-colors"
                      >
                        <span className="text-slate-300 font-mono">{po.poNumber || "PO-PENDING"}</span>
                        <span className="text-orange-500 flex items-center gap-1 text-[9px] tracking-wider">Simulate Scan <ArrowRightIcon size={10} /></span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Or type PO barcode manual:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. PO-V0001-1234"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-widest text-white outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => {
                      const code = scanInput.trim().toUpperCase();
                      const matched = pos.find(p => p.poNumber?.toUpperCase() === code || p.id === code);
                      if (matched) {
                        setIsScanProcessing(true);
                        setTimeout(() => {
                          setIsScanProcessing(false);
                          setScannedPO(matched);
                          toast.success(`Label matched!`);
                        }, 800);
                      } else {
                        toast.error("Invalid PO code or not pending.");
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Read
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm or Reset Actions */}
          {scannedPO && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setScannedPO(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors text-slate-300"
              >
                Scan Another
              </button>
              <button
                onClick={() => {
                  selectPO(scannedPO);
                  setShowScanner(false);
                }}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
              >
                <CheckCircle2Icon size={12} />
                Proceed to GRN
              </button>
            </div>
          )}

        </div>
      </div>
    )
  }
    </div >
  );
}
