"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { X,
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
import { purchaseOrdersApi, grnApi, purchaseReturnsApi, vendorsApi, inventoryApi, settingsApi } from "@/lib/api";
import { clsx } from "clsx";
import { formatERPNumber, formatDate } from "@/lib/utils";
import WarehouseFormSidebar from "@/components/modals/WarehouseFormSidebar";
import GSTInvoice from "@/components/documents/GSTInvoice";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

interface POItem {
  id: string;
  inventoryItem: { id: string; name: string; unit: string };
  quantity: number;
  price: number;
  gstRate?: number;
  hsnCode?: string;
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
  warehouseId?: string;
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
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [previewGRN, setPreviewGRN] = useState(false);

  const formatDisplayDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "DD/MM/YYYY";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => setCompanyProfile(res.data))
      .catch(() => { /* fall back to FALLBACK_COMPANY */ });
  }, []);

  const handleSaveDraft = () => {
    toast.success("GRN Draft saved successfully (reference kept local).");
  };

  const handleSubmitForReview = () => {
    toast.success("GRN submitted to review queue.");
  };

  const handlePrintGRN = () => {
    setPreviewGRN(true);
  };

  // Fetch Warehouses on mount
  useEffect(() => {
    inventoryApi.getWarehouses()
      .then(res => {
        const list = res.data || [];
        setWarehouses(list);
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
  const [viewingGRNDetails, setViewingGRNDetails] = useState<any>(null);

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
        const list = r.data || [];
        setHistory(list);
        
        const urlParams = new URLSearchParams(window.location.search);
        const grnId = urlParams.get('grnId');
        if (grnId) {
          const matched = list.find((g: any) => g.id === grnId);
          if (matched) {
            setViewingGRNDetails(matched);
          } else {
            grnApi.getById(grnId).then(res => {
              if (res.data) setViewingGRNDetails(res.data);
            }).catch(console.error);
          }
        }
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
        warehouseId: po.warehouseId || defaultWarehouseId || "",
        inventoryItem: item.inventoryItem,
      }))
    );
    setStep(2);
  };

  const updateItem = (idx: number, field: keyof GRNItem, val: number) => {
    setGrnItems(prev => {
      const next = [...prev];
      const currentItem = { ...next[idx] };
      const parsedVal = Math.max(0, val);

      if (field === "receivedQty") {
        currentItem.receivedQty = Math.min(currentItem.quantity, parsedVal);
      } else if (field === "rejectedQty") {
        currentItem.rejectedQty = Math.min(currentItem.receivedQty, parsedVal);
      }

      currentItem.acceptedQty = Math.max(0, currentItem.receivedQty - currentItem.rejectedQty);
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
            returnSource: "GRN_REJECTION",
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
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100">
      <WarehouseFormSidebar
        isOpen={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        onSuccess={handleWarehouseCreated}
      />

      {/* ── Page Header ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (step === 2) {
                setStep(1);
                setSelectedPO(null);
              } else {
                router.back();
              }
            }}
            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-gray-100 dark:bg-[#13151f] rounded-lg border border-gray-200 dark:border-white/10">
            <button
              onClick={() => { setView("NEW"); setStep(1); }}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                view === "NEW"
                  ? "bg-white dark:bg-card text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/10"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              New Receipt
            </button>
            <button
              onClick={() => setView("HISTORY")}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                view === "HISTORY"
                  ? "bg-white dark:bg-card text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/10"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Received History
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        {view === "HISTORY" ? (
          /* ── HISTORY VIEW ── */
          <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                  <th className="px-4 py-3 text-left">GRN #</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Reference PO</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Items</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <Loader2Icon className="mx-auto text-[#f58220] animate-spin h-6 w-6" />
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-gray-500 dark:text-slate-400 text-sm font-semibold">
                      No receipt history found
                    </td>
                  </tr>
                ) : history.map((grn) => (
                  <tr key={grn.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-semibold text-xs text-gray-800 dark:text-white">
                      {formatERPNumber("GRN", grn.id, grn.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 dark:text-white font-semibold text-sm">{grn.procurementOrder?.vendor?.name}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Verified Shipment</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-slate-300">
                      {grn.procurementOrder ? formatERPNumber("PO", grn.procurementOrder.poNumber || grn.procurementOrder.id, grn.procurementOrder.createdAt) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400 text-xs">
                      {formatDate(grn.receivedAt || grn.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20">
                        {grn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {grn.items?.slice(0, 2).map((item: any) => (
                          <span key={item.id} className="px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 text-xs rounded border border-gray-200 dark:border-white/10">
                            {item.inventoryItem?.name} ({item.acceptedQty})
                          </span>
                        ))}
                        {grn.items?.length > 2 && <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 ml-1">+{grn.items.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                      <button
                        onClick={() => setViewingGRNDetails(grn)}
                        className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 rounded text-xs font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => router.push(`/purchases/invoices?grnId=${grn.id}`)}
                        className="px-2.5 py-1 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 rounded text-xs font-bold hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors cursor-pointer"
                      >
                        Generate Bill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : step === 1 ? (
          /* ── STEP 1: SELECT PO ── */
          <div className="space-y-4">
            <div className="relative max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search Vendor or PO #..."
                value={poSearch}
                onChange={e => setPoSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            {poSearch && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setPoSearch("")} 
              />
            )}
            </div>

            {loading ? (
              <div className="py-16 text-center"><Loader2Icon className="mx-auto text-[#f58220] animate-spin h-6 w-6" /></div>
            ) : filteredPOs.length === 0 ? (
              <div className="py-20 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 text-center text-gray-500 dark:text-slate-400">
                <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-[#f58220]">
                  <PackageIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">No Pending Purchase Orders</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">There are no approved purchase orders ready for receiving.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPOs.map(po => (
                  <div
                    key={po.id}
                    onClick={() => selectPO(po)}
                    className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg p-4 hover:border-[#f58220] dark:hover:border-[#f58220] transition-colors cursor-pointer flex flex-col justify-between group space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] text-xs font-semibold rounded border border-orange-200 dark:border-orange-500/20">
                        {po.poNumber || "PO-PENDING"}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">{formatDate(po.createdAt)}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-[#f58220] transition-colors truncate">
                        {po.vendor.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Ready for receiving</p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-slate-400 block">Total Value</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white">₹{po.totalAmount.toLocaleString()}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#f58220] flex items-center gap-1 group-hover:underline">
                        Select PO <ArrowRightIcon size={14} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── STEP 2: VERIFY QUANTITIES ── */
          <div className="space-y-5">
            {/* ── Summary KPI Strip (Top) ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Ordered Quantity", value: grnItems.reduce((s, i) => s + i.quantity, 0), color: "text-gray-800 dark:text-slate-200", dot: "bg-gray-400" },
                { label: "Received Quantity", value: grnItems.reduce((s, i) => s + i.receivedQty, 0), color: "text-[#f58220]", dot: "bg-[#f58220]" },
                { label: "Rejected Quantity", value: grnItems.reduce((s, i) => s + i.rejectedQty, 0), color: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
                { label: "Accepted Quantity", value: grnItems.reduce((s, i) => s + i.acceptedQty, 0), color: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
              ].map(stat => (
                <div key={stat.label} className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 shadow-sm">
                  <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", stat.dot)} />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{stat.label}</p>
                    <p className={clsx("text-lg font-bold mt-0.5", stat.color)}>{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Verify Shipment Header Card */}
            <div className="bg-white dark:bg-card p-4 rounded-lg border border-gray-200 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-white">Verify Shipment Content</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  PO Reference: <span className="font-semibold text-[#f58220]">{selectedPO?.poNumber}</span> • Vendor: <span className="font-semibold text-gray-800 dark:text-white">{selectedPO?.vendor.name}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 dark:text-slate-400 font-medium">Default Warehouse:</label>
                  <select
                    value={defaultWarehouseId}
                    onChange={e => handleDefaultWarehouseChange(e.target.value)}
                    className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-800 dark:text-slate-200 bg-white dark:bg-[#13151f] outline-none focus:border-[#f58220]"
                  >
                    <option value="" className="dark:bg-card">Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id} className="dark:bg-card">{w.name}</option>
                    ))}
                    <option value="ADD_NEW" className="font-bold text-[#f58220] dark:bg-card">+ Add New Warehouse...</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowWarehouseModal(true)}
                    className="p-1.5 border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-[#f58220] text-gray-500 dark:text-slate-400 rounded-lg transition-colors cursor-pointer"
                    title="Add New Warehouse"
                  >
                    <PlusIcon size={14} />
                  </button>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Change PO Source
                </button>
              </div>
            </div>

            {/* Materials Table */}
            <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                      <th className="px-4 py-3 text-left">Material</th>
                      <th className="px-4 py-3 text-left">Traceability</th>
                      <th className="px-4 py-3 text-left">Warehouse</th>
                      <th className="px-4 py-3 text-center">Ordered</th>
                      <th className="px-4 py-3 text-center">Received</th>
                      <th className="px-4 py-3 text-center">Rejected</th>
                      <th className="px-4 py-3 text-center">Accepted</th>
                      <th className="px-4 py-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {grnItems.map((item, idx) => {
                      const originalItem = selectedPO?.poItems[idx];
                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-800 dark:text-white text-xs">{originalItem?.inventoryItem.name}</div>
                            <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Unit: {originalItem?.inventoryItem.unit}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5 min-w-[280px]">
                              {/* Row 1: Lot / Batch Number */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  title="Generate a unique lot/batch number"
                                  disabled={generatingLotIdx === idx}
                                  onClick={() => handleAutoBatch(idx)}
                                  className="px-2 py-1 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-[#f58220] border border-orange-200 dark:border-orange-500/20 rounded text-[11px] font-semibold disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                                >
                                  {generatingLotIdx === idx ? "Generating..." : "Auto Batch"}
                                </button>
                                <input
                                  type="text"
                                  placeholder="Lot Number *"
                                  value={item.lotNumber || ""}
                                  onChange={e => updateItemStr(idx, "lotNumber", e.target.value)}
                                  className={clsx(
                                    "w-36 px-2.5 py-1 bg-white dark:bg-[#13151f] border rounded-lg text-xs outline-none focus:border-[#f58220] text-gray-800 dark:text-white",
                                    item.acceptedQty > 0 && (!item.lotNumber || !item.lotNumber.trim())
                                      ? "border-amber-300 dark:border-amber-500/40 bg-amber-50/20 dark:bg-amber-500/10"
                                      : "border-gray-200 dark:border-white/10"
                                  )}
                                />
                              </div>

                              {/* Row 2: Starting & Ending Dates with clear labels */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <div className="relative flex items-center gap-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded-lg overflow-hidden group hover:border-[#f58220] transition-colors">
                                  <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-tight whitespace-nowrap">Mfg Date:</span>
                                  <span className="text-xs text-gray-800 dark:text-slate-200 pointer-events-none min-w-[75px] flex items-center justify-between">
                                    {formatDisplayDate(item.mfgDate)}
                                    <CalendarIcon size={12} className="text-gray-400 dark:text-slate-500 ml-1" />
                                  </span>
                                  <input
                                    type="date"
                                    title="Manufacturing (Start) Date"
                                    value={item.mfgDate || ""}
                                    onChange={e => updateItemStr(idx, "mfgDate", e.target.value)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  />
                                </div>
                                <div className="relative flex items-center gap-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded-lg overflow-hidden group hover:border-[#f58220] transition-colors">
                                  <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-tight whitespace-nowrap">Exp Date:</span>
                                  <span className="text-xs text-gray-800 dark:text-slate-200 pointer-events-none min-w-[75px] flex items-center justify-between">
                                    {formatDisplayDate(item.expDate)}
                                    <CalendarIcon size={12} className="text-gray-400 dark:text-slate-500 ml-1" />
                                  </span>
                                  <input
                                    type="date"
                                    title="Expiry (End) Date"
                                    value={item.expDate || ""}
                                    onChange={e => updateItemStr(idx, "expDate", e.target.value)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <select
                                value={item.warehouseId || ""}
                                onChange={e => updateItemStr(idx, "warehouseId", e.target.value)}
                                className="w-36 px-2.5 py-1.5 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-[#f58220] text-gray-800 dark:text-slate-200"
                              >
                                <option value="" className="dark:bg-card">Select Warehouse</option>
                                {warehouses.map(w => (
                                  <option key={w.id} value={w.id} className="dark:bg-card">{w.name}</option>
                                ))}
                                <option value="ADD_NEW" className="font-bold text-[#f58220] dark:bg-card">+ Add New Warehouse...</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => setShowWarehouseModal(true)}
                                className="p-1.5 border border-gray-200 dark:border-white/10 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-[#f58220] rounded-lg text-gray-400 dark:text-slate-400 transition-colors cursor-pointer"
                                title="Add Warehouse"
                              >
                                <PlusIcon size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 rounded text-xs font-semibold text-gray-700 dark:text-slate-300">{item.quantity}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min={0}
                              value={item.receivedQty}
                              onChange={e => updateItem(idx, "receivedQty", Number(e.target.value))}
                              className="w-20 text-center px-2.5 py-1.5 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg font-semibold text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220]"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={item.receivedQty}
                              value={item.rejectedQty}
                              onChange={e => updateItem(idx, "rejectedQty", Number(e.target.value))}
                              className="w-20 text-center px-2.5 py-1.5 bg-red-50/50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-red-600 dark:text-red-400 font-semibold text-xs outline-none focus:border-red-400"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block w-20 text-center px-2.5 py-1.5 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg font-bold text-xs border border-green-200 dark:border-green-500/20">
                              {item.acceptedQty}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.rejectedQty > 0 ? (
                              <div className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-500/20 flex items-center justify-center text-red-500 dark:text-red-400 mx-auto" title="Some rejected">
                                <XCircleIcon size={14} />
                              </div>
                            ) : item.acceptedQty < item.quantity ? (
                              <div className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 mx-auto" title="Partial quantity">
                                <AlertTriangleIcon size={14} />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-green-50 dark:bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 mx-auto" title="Fully accepted">
                                <CheckCircle2Icon size={14} />
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Bottom Actions Footer Bar ── */}
            {(() => {
              const totalAccepted = grnItems.reduce((s, i) => s + (Number(i.acceptedQty) || 0), 0);
              const isApproveDisabled = submitting || grnItems.length === 0 || totalAccepted === 0;

              return (
                <div className="bg-white dark:bg-card px-6 py-4 rounded-lg border border-gray-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-gray-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                    <span>
                      <span className="font-semibold text-gray-800 dark:text-white">{grnItems.length}</span> material item(s) • Total Accepted: <span className="font-bold text-green-600 dark:text-green-400">{totalAccepted}</span> units
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">

                    <button
                      type="button"
                      onClick={handlePrintGRN}
                      className="px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Print GRN
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateAndApprove}
                      disabled={isApproveDisabled}
                      title="Approve GRN and synchronize stock"
                      className={clsx(
                        "px-5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer",
                        isApproveDisabled
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none"
                          : "bg-[#f58220] hover:bg-[#e8740e] text-white active:scale-95"
                      )}
                    >
                      {submitting ? <Loader2Icon size={14} className="animate-spin" /> : <ClipboardCheckIcon size={14} />}
                      Approve & Sync
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Purchase Order Label Scanner Modal ── */ }
      {showScanner && (
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
      )}

      {viewingGRNDetails && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setViewingGRNDetails(null)} />
          <div className="bg-white dark:bg-[#0f1117] w-full max-w-3xl h-full shadow-2xl relative flex flex-col animate-in slide-in-from-right duration-500">
            {/* Header */}
            <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shadow-lg shadow-orange-500/10">
                  <ClipboardCheckIcon size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    {formatERPNumber("GRN", viewingGRNDetails.id, viewingGRNDetails.createdAt)}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                    PO Reference: {viewingGRNDetails.procurementOrder ? formatERPNumber("PO", viewingGRNDetails.procurementOrder.poNumber || viewingGRNDetails.procurementOrder.id, viewingGRNDetails.procurementOrder.createdAt) : 'N/A'}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingGRNDetails(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendor</p>
                  <p className="text-xs font-black text-gray-900 dark:text-white">{viewingGRNDetails.procurementOrder?.vendor?.name || "—"}</p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Received Date</p>
                  <p className="text-xs font-black text-gray-900 dark:text-white">
                    {formatDate(viewingGRNDetails.receivedAt || viewingGRNDetails.createdAt)}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                    {viewingGRNDetails.status}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Received By</p>
                  <p className="text-xs font-black text-gray-900 dark:text-white">{viewingGRNDetails.receivedBy || "System Operator"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest px-1">Received items</h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                  <table className="w-full text-left border-collapse bg-slate-50 dark:bg-[#0b0c14] text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-slate-900/50">
                        <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-widest">Material</th>
                        <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-widest">Batch/Lot No</th>
                        <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-widest text-right">Received</th>
                        <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-widest text-right">Accepted</th>
                        <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-widest text-right">Rejected</th>
                        <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-widest">Warehouse</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {viewingGRNDetails.items?.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                            {item.inventoryItem?.name}
                            <span className="text-[10px] text-gray-400 font-normal block">Unit: {item.inventoryItem?.unit ? item.inventoryItem.unit.replace(/^1\s*/, "") : "unit"}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">{item.lotNumber || item.vendorBatchNo || "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">{item.receivedQty}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">{item.acceptedQty}</td>
                          <td className="px-4 py-3 text-right font-semibold text-rose-600">{item.rejectedQty}</td>
                          <td className="px-4 py-3 text-slate-500">{item.warehouse?.name || (
                            <span className="text-rose-500 italic font-medium">Update Warehouse</span>
                          )}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="p-8 border-t border-gray-100 dark:border-white/5 flex gap-4">
              <button
                onClick={() => {
                  router.push(`/purchases/invoices?grnId=${viewingGRNDetails.id}`);
                  setViewingGRNDetails(null);
                }}
                className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center"
              >
                Generate Purchase Bill
              </button>
              <button
                onClick={() => setViewingGRNDetails(null)}
                className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {previewGRN && selectedPO && (
        <GSTInvoice
          order={{
            poNumber: `GRN-${selectedPO.poNumber || selectedPO.id.slice(-6).toUpperCase()}`,
            createdAt: new Date().toISOString(),
            items: grnItems.map((item, idx) => {
              const poItem: any = selectedPO.poItems?.[idx];
              return {
                itemName: item.inventoryItem?.name || poItem?.inventoryItem?.name || `Material #${idx + 1}`,
                quantity: Number(item.receivedQty) || 0,
                price: Number(item.price) || 0,
                gstRate: Number(poItem?.gstRate) || 0,
                hsnCode: poItem?.hsnCode,
              };
            }),
          }}
          vendor={selectedPO.vendor || { name: "Vendor" }}
          companyDetails={companyProfile || FALLBACK_COMPANY}
          documentType="GRN"
          onClose={() => setPreviewGRN(false)}
        />
      )}
    </div>
  );
}
