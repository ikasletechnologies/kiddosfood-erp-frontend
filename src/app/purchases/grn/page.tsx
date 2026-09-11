"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Scan as ScanIcon,
  RefreshCw
} from "lucide-react";
import { purchaseOrdersApi, grnApi, purchaseReturnsApi, vendorsApi, inventoryApi, settingsApi } from "@/lib/api";
import { clsx } from "clsx";
import { formatERPNumber, formatDate } from "@/lib/utils";
import WarehouseFormSidebar from "@/components/modals/WarehouseFormSidebar";
import GSTInvoice from "@/components/documents/GSTInvoice";

// ── MiniCalendar ──────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function MiniCalendar({ value, onChange, onClose }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : today;
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const isSelected = (d: number) => Boolean(value) && selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

  const currentYear = today.getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - 15 + i);

  return (
    <div className="bg-white dark:bg-[#13151f] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 p-3 w-64 select-none">
      <div className="flex items-center justify-between mb-2 gap-1">
        <button type="button" onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-slate-400 cursor-pointer">
          <ChevronDownIcon size={14} className="rotate-90" />
        </button>
        <div className="flex items-center gap-1">
          <select
            value={viewMonth}
            onChange={e => setViewMonth(Number(e.target.value))}
            className="text-xs font-semibold text-gray-800 dark:text-white bg-transparent border-0 outline-none cursor-pointer hover:text-orange-600 dark:hover:text-orange-400"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx} className="dark:bg-[#13151f]">{m}</option>
            ))}
          </select>
          <select
            value={viewYear}
            onChange={e => setViewYear(Number(e.target.value))}
            className="text-xs font-semibold text-gray-800 dark:text-white bg-transparent border-0 outline-none cursor-pointer hover:text-orange-600 dark:hover:text-orange-400"
          >
            {years.map(y => (
              <option key={y} value={y} className="dark:bg-[#13151f]">{y}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-slate-400 cursor-pointer">
          <ChevronDownIcon size={14} className="-rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button key={i}
            type="button"
            onClick={() => { onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`); onClose(); }}
            className={clsx("w-full aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition-colors cursor-pointer",
              isSelected(d) && "bg-orange-500 text-white",
              !isSelected(d) && isToday(d) && "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400",
              !isSelected(d) && !isToday(d) && "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10"
            )}
          >{d}</button>
        ))}
      </div>
    </div>
  );
}

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
  inventoryItem: { id: string; name: string; unit: string; taxRate?: number; gstRate?: number };
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
  subtotal?: number;
  discountAmount?: number;
  freightCost?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
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
  price: number;           // actual received unit price (editable)
  poPrice: number;         // PO unit price — reference only, never edited
  gstRate?: number;
  priceOverrideReason?: string;
  vendorBatchNo?: string;
  mfgDate?: string;
  expDate?: string;
  lotNumber?: string;
  warehouseId?: string;
  inventoryItem?: { name: string; unit: string; taxRate?: number; gstRate?: number };
}

function computeCommercialsFromPO(
  po: PO | null,
  items: GRNItem[]
) {
  let acceptedSubtotal = 0;
  let acceptedValueAtPoPrice = 0;
  let totalTax = 0;
  const taxRateMap: Record<number, number> = {};

  items.forEach(gi => {
    const acceptedQty = Number(gi.acceptedQty) || 0;
    const price = Number(gi.price) || 0;
    const lineSubtotal = acceptedQty * price;
    const rate = Number(gi.gstRate ?? 0);
    const lineTax = (lineSubtotal * rate) / 100;

    acceptedSubtotal += lineSubtotal;
    totalTax += lineTax;
    // Fulfillment ratio (below) must reflect how much of the ORDER was
    // received, not how much the price happened to change at receipt — using
    // the actual (possibly overridden) price here would let a price increase
    // alone inflate the ratio past 1 and scale the PO's discount up with it,
    // silently clawing back part of a price override the operator just made.
    acceptedValueAtPoPrice += acceptedQty * (Number(gi.poPrice) || price);

    if (rate > 0 && acceptedQty > 0) {
      taxRateMap[rate] = (taxRateMap[rate] || 0) + lineTax;
    }
  });

  const poSubtotal = Number(po?.subtotal) > 0
    ? Number(po?.subtotal)
    : (po?.poItems || []).reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0) || 1;

  const ratio = poSubtotal > 0 ? acceptedValueAtPoPrice / poSubtotal : 0;
  const poDiscount = Number(po?.discountAmount) || 0;
  const poFreight = Number(po?.freightCost) || 0;

  const proRataDiscount = Number((poDiscount * ratio).toFixed(2));
  const proRataFreight = Number((poFreight * ratio).toFixed(2));

  const goodsValue = Number(acceptedSubtotal.toFixed(2));
  const taxAmount = Number(totalTax.toFixed(2));
  const finalPayable = Number((goodsValue + taxAmount - proRataDiscount + proRataFreight).toFixed(2));

  return {
    goodsValue,
    taxAmount,
    taxRateMap,
    discountAmount: proRataDiscount,
    freightCost: proRataFreight,
    finalPayable,
  };
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
  
  // Received History Search & Date Filters
  const [historySearch, setHistorySearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const fromCalRef = useRef<HTMLDivElement>(null);
  const toCalRef = useRef<HTMLDivElement>(null);

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

  const fmtDateDisplay = (iso: string) => {
    if (!iso) return "—";
    const parts = iso.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };

  // Close calendar popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fromCalRef.current && !fromCalRef.current.contains(e.target as Node)) {
        setShowFromCal(false);
      }
      if (toCalRef.current && !toCalRef.current.contains(e.target as Node)) {
        setShowToCal(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
  const [generatingLotIdx, setGeneratingLotIdx] = useState<number | null>(null);

  // Fetch Pending POs
  const loadPOs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await purchaseOrdersApi.getAll();
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
    } catch (err) {
      console.error("Failed to load POs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch GRN History
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const r = await grnApi.getAll();
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
    } catch (err) {
      console.error("Failed to load GRN history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Pending POs or History based on view
  useEffect(() => {
    if (view === "NEW") {
      loadPOs();
    } else {
      loadHistory();
    }
  }, [view, loadPOs, loadHistory]);

  const selectPO = (po: PO) => {
    setSelectedPO(po);
    setGrnItems(
      (po.poItems || []).map(item => {
        const gstRate = item.gstRate ?? (item.inventoryItem as any)?.taxRate ?? (item.inventoryItem as any)?.gstRate ?? 0;
        return {
          materialId: item.inventoryItem.id,
          quantity: item.quantity,
          receivedQty: item.quantity,
          acceptedQty: item.quantity,
          rejectedQty: 0,
          price: item.price,
          poPrice: item.price,
          gstRate: Number(gstRate) || 0,
          priceOverrideReason: "",
          vendorBatchNo: "",
          mfgDate: "",
          expDate: "",
          lotNumber: "",
          warehouseId: po.warehouseId || defaultWarehouseId || "",
          inventoryItem: item.inventoryItem,
        };
      })
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

  // Actual received unit price — kept separate from PO price, which is
  // never mutated. Clearing the override reason when price is reset back
  // to the PO price avoids a stale reason lingering on a non-overridden line.
  const updateItemPrice = (idx: number, val: number) => {
    setGrnItems(prev => {
      const next = [...prev];
      const price = Math.max(0, val);
      const currentItem = { ...next[idx], price };
      if (Math.abs(price - currentItem.poPrice) < 0.001) {
        currentItem.priceOverrideReason = "";
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

  const handleAutoBatch = async (idx: number) => {
    setGeneratingLotIdx(idx);
    try {
      const res = await grnApi.generateLotNumber();
      updateItemStr(idx, "lotNumber", res.data.lotNumber);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to generate lot number.");
    } finally {
      setGeneratingLotIdx(null);
    }
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

    // Any line where the actual received price differs from the PO price
    // requires a reason — the PO price itself is never touched, but the
    // vendor liability that gets posted at approval uses this actual price.
    const missingReason = itemsToSubmit.some(
      item => Math.abs(item.price - item.poPrice) > 0.001 && !item.priceOverrideReason?.trim()
    );
    if (missingReason) {
      toast.error("Please provide a reason for every line where the actual price differs from the PO price.");
      return;
    }

    // Validate Batch Number and EXP Date for all items with acceptedQty > 0
    for (let i = 0; i < itemsToSubmit.length; i++) {
      const item = itemsToSubmit[i];
      const itemName = item.inventoryItem?.name || selectedPO.poItems[i]?.inventoryItem?.name || `Item #${i + 1}`;
      if (item.acceptedQty > 0) {
        if (!item.lotNumber || !item.lotNumber.trim()) {
          toast.error(`Please provide a Batch/Lot Number for "${itemName}".`);
          return;
        }
        if (!item.expDate || isNaN(new Date(item.expDate).getTime())) {
          toast.error(`Please select a valid Expiry (EXP) Date for "${itemName}".`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // 1. Create and Approve GRN (Impacts Inventory)
      const res = await grnApi.createFromPO(selectedPO.id, { items: itemsToSubmit });
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

  const filteredHistory = history.filter((grn) => {
    // 1. Search filter: Vendor, Reference PO #, GRN #, items, lot numbers
    const term = historySearch.trim().toLowerCase();
    let matchSearch = true;
    if (term) {
      const vendorName = grn.procurementOrder?.vendor?.name?.toLowerCase() || "";
      const poNumber = (grn.procurementOrder?.poNumber || grn.procurementOrder?.id || "")?.toLowerCase();
      const grnId = grn.id?.toLowerCase() || "";
      const grnErpNumber = formatERPNumber("GRN", grn.id, grn.createdAt)?.toLowerCase() || "";
      const itemNames = (grn.items || [])
        .map((i: any) => i.inventoryItem?.name?.toLowerCase() || "")
        .join(" ");
      const lotNumbers = (grn.items || [])
        .map((i: any) => (i.lotNumber || i.vendorBatchNo || "")?.toLowerCase())
        .join(" ");

      matchSearch =
        vendorName.includes(term) ||
        poNumber.includes(term) ||
        grnId.includes(term) ||
        grnErpNumber.includes(term) ||
        itemNames.includes(term) ||
        lotNumbers.includes(term);
    }

    // 2. Date filter: use real GRN / receipt date (grn.receivedAt, fallback grn.createdAt)
    const rawDate = grn.receivedAt || grn.createdAt;
    let matchDate = true;
    if (rawDate) {
      const d = new Date(rawDate);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const grnDateStr = `${yyyy}-${mm}-${dd}`;

      if (dateFrom && grnDateStr < dateFrom) {
        matchDate = false;
      }
      if (dateTo && grnDateStr > dateTo) {
        matchDate = false;
      }
    }

    return matchSearch && matchDate;
  });

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

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 w-full min-w-0">
        {view === "HISTORY" ? (
          /* ── HISTORY VIEW ── */
          <div className="space-y-4">
            {/* ── Search & Date Filter Bar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                {/* Search Vendor or PO #... */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search Vendor or PO #..."
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 transition-colors"
                  />
                  {historySearch && (
                    <X
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      onClick={() => setHistorySearch("")}
                    />
                  )}
                </div>

                {/* Date Filter: From Date → To Date */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* From Date */}
                  <div className="relative" ref={fromCalRef}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:border-[#f58220] transition-colors">
                      <button
                        type="button"
                        onClick={() => { setShowFromCal(v => !v); setShowToCal(false); }}
                        className="outline-none cursor-pointer"
                      >
                        {dateFrom ? fmtDateDisplay(dateFrom) : "From Date"}
                      </button>
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => { setShowFromCal(v => !v); setShowToCal(false); }}
                          className="text-[#f58220] cursor-pointer"
                          title="Choose from date"
                        >
                          <CalendarIcon size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDateFrom(""); }}
                          className={clsx(
                            "text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all cursor-pointer",
                            dateFrom ? "opacity-100" : "opacity-0 pointer-events-none"
                          )}
                          title="Clear from date"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                    {showFromCal && (
                      <div className="absolute left-0 top-full mt-1 z-50">
                        <MiniCalendar value={dateFrom} onChange={v => { setDateFrom(v); setShowFromCal(false); }} onClose={() => setShowFromCal(false)} />
                      </div>
                    )}
                  </div>

                  <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">to</span>

                  {/* To Date */}
                  <div className="relative" ref={toCalRef}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:border-[#f58220] transition-colors">
                      <button
                        type="button"
                        onClick={() => { setShowToCal(v => !v); setShowFromCal(false); }}
                        className="outline-none cursor-pointer"
                      >
                        {dateTo ? fmtDateDisplay(dateTo) : "To Date"}
                      </button>
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => { setShowToCal(v => !v); setShowFromCal(false); }}
                          className="text-[#f58220] cursor-pointer"
                          title="Choose to date"
                        >
                          <CalendarIcon size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDateTo(""); }}
                          className={clsx(
                            "text-gray-400 hover:text-gray-600 dark:hover:text-white transition-all cursor-pointer",
                            dateTo ? "opacity-100" : "opacity-0 pointer-events-none"
                          )}
                          title="Clear to date"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                    {showToCal && (
                      <div className="absolute left-0 top-full mt-1 z-50">
                        <MiniCalendar value={dateTo} onChange={v => { setDateTo(v); setShowToCal(false); }} onClose={() => setShowToCal(false)} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={loadHistory}
                className="p-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-card rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                title="Refresh GRN History"
              >
                <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
              </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0">
              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-sm min-w-[760px]">
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
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-gray-500 dark:text-slate-400 text-sm font-semibold">
                        {history.length === 0 ? (
                          "No receipt history found"
                        ) : (
                          <div className="space-y-2">
                            <p>No receipt history matches your search or date filter</p>
                            {(historySearch || dateFrom || dateTo) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setHistorySearch("");
                                  setDateFrom("");
                                  setDateTo("");
                                }}
                                className="text-xs font-bold text-[#f58220] hover:underline cursor-pointer"
                              >
                                Clear all filters
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : filteredHistory.map((grn) => (
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
            </div>
          </div>
        ) : step === 1 ? (
          /* ── STEP 1: SELECT PO ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search Vendor or PO #..."
                  value={poSearch}
                  onChange={e => setPoSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
                {poSearch && (
                  <X 
                    size={14} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                    onClick={() => setPoSearch("")} 
                  />
                )}
              </div>
              <button
                type="button"
                onClick={loadPOs}
                className="p-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-card rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                title="Refresh Purchase Orders"
              >
                <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
              </button>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0">
              {[
                { label: "Ordered Quantity", value: grnItems.reduce((s, i) => s + i.quantity, 0), color: "text-gray-800 dark:text-slate-200", dot: "bg-gray-400" },
                { label: "Received Quantity", value: grnItems.reduce((s, i) => s + i.receivedQty, 0), color: "text-[#f58220]", dot: "bg-[#f58220]" },
                { label: "Rejected Quantity", value: grnItems.reduce((s, i) => s + i.rejectedQty, 0), color: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
                { label: "Accepted Quantity", value: grnItems.reduce((s, i) => s + i.acceptedQty, 0), color: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
              ].map(stat => (
                <div key={stat.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 shadow-sm min-w-0">
                  <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", stat.dot)} />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{stat.label}</p>
                    <p className={clsx("text-base sm:text-lg font-bold mt-0.5 truncate", stat.color)}>{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Verify Shipment Header Card */}
            <div className="bg-white dark:bg-card p-4 rounded-xl border border-gray-200 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full min-w-0">
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
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0">
              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-sm min-w-[850px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                      <th className="px-4 py-3 text-left">Material</th>
                      <th className="px-4 py-3 text-left">Traceability</th>
                      <th className="px-4 py-3 text-left">Warehouse</th>
                      <th className="px-4 py-3 text-left">Pricing</th>
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
                      const variance = item.price - item.poPrice;
                      const isOverridden = Math.abs(variance) > 0.001;
                      const actualLineAmount = item.acceptedQty * item.price;

                      const isLotMissing = item.acceptedQty > 0 && (!item.lotNumber || !item.lotNumber.trim());
                      const isExpMissing = item.acceptedQty > 0 && (!item.expDate || isNaN(new Date(item.expDate).getTime()));

                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-800 dark:text-white text-xs">{originalItem?.inventoryItem.name}</div>
                            <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Unit: {originalItem?.inventoryItem.unit}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5 min-w-[240px]">
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
                                    "w-36 px-2.5 py-1 bg-white dark:bg-[#13151f] border rounded-lg text-xs outline-none focus:border-[#f58220] text-gray-800 dark:text-white transition-colors",
                                    isLotMissing
                                      ? "border-rose-400 dark:border-rose-500/60 bg-rose-50/20 dark:bg-rose-500/10"
                                      : "border-gray-200 dark:border-white/10"
                                  )}
                                />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <div className={clsx(
                                  "relative flex items-center gap-1.5 border px-2.5 py-1 rounded-lg overflow-hidden group hover:border-[#f58220] transition-colors w-full max-w-[210px]",
                                  isExpMissing
                                    ? "border-rose-400 dark:border-rose-500/60 bg-rose-50/20 dark:bg-rose-500/10"
                                    : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5"
                                )}>
                                  <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-tight whitespace-nowrap">Exp Date:</span>
                                  <span className="text-xs text-gray-800 dark:text-slate-200 pointer-events-none min-w-[75px] flex items-center justify-between flex-1">
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

                              {(isLotMissing || isExpMissing) && (
                                <div className="pt-0.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 px-1.5 py-0.5 rounded">
                                    {isLotMissing && isExpMissing ? "Lot No & EXP date required" : isLotMissing ? "Lot Number required" : "EXP Date required"}
                                  </span>
                                </div>
                              )}
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
                          <td className="px-4 py-3">
                            {(() => {
                              const lineGoodsValue = item.acceptedQty * item.price;
                              const lineGstRate = Number(item.gstRate ?? 0);
                              const lineGstAmount = (lineGoodsValue * lineGstRate) / 100;
                              const lineTotal = lineGoodsValue + lineGstAmount;

                              return (
                                <div className="space-y-1.5 min-w-[190px]">
                                  <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-slate-400">
                                    <span className="uppercase tracking-tight font-semibold">PO Price</span>
                                    <span className="font-semibold text-gray-600 dark:text-slate-300">₹{item.poPrice.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">Actual</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={item.price}
                                      onChange={e => updateItemPrice(idx, Number(e.target.value))}
                                      title="Actual Unit Price — the PO price is never changed"
                                      className={clsx(
                                        "w-full px-2 py-1 border rounded-lg text-xs font-semibold outline-none focus:border-[#f58220]",
                                        isOverridden
                                          ? "border-amber-300 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                          : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white"
                                      )}
                                    />
                                  </div>
                                  {isOverridden && (
                                    <>
                                      <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                        <AlertTriangleIcon size={10} />
                                        {variance > 0 ? "+" : ""}₹{variance.toFixed(2)}/unit ({item.poPrice > 0 ? (variance > 0 ? "+" : "") + ((variance / item.poPrice) * 100).toFixed(2) + "%" : "—"})
                                      </div>
                                      <input
                                        type="text"
                                        placeholder="Override reason *"
                                        value={item.priceOverrideReason || ""}
                                        onChange={e => updateItemStr(idx, "priceOverrideReason", e.target.value)}
                                        className={clsx(
                                          "w-full px-2 py-1 border rounded-lg text-[11px] outline-none focus:border-[#f58220] text-gray-800 dark:text-white bg-white dark:bg-[#13151f]",
                                          !item.priceOverrideReason?.trim()
                                            ? "border-red-300 dark:border-red-500/40 bg-red-50/30 dark:bg-red-500/10"
                                            : "border-gray-200 dark:border-white/10"
                                        )}
                                      />
                                    </>
                                  )}

                                  <div className="pt-1.5 mt-1 border-t border-gray-100 dark:border-white/5 text-[10px] space-y-0.5">
                                    <div className="flex justify-between text-gray-500 dark:text-slate-400">
                                      <span>Goods Value:</span>
                                      <span className="font-semibold text-gray-700 dark:text-slate-300">₹{lineGoodsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-500 dark:text-slate-400">
                                      <span>GST ({lineGstRate}%):</span>
                                      <span className="font-semibold text-gray-700 dark:text-slate-300">₹{lineGstAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-0.5">
                                      <span>Line Total:</span>
                                      <span>₹{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-mono text-xs font-bold text-gray-600 dark:text-slate-300">{item.quantity}</span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              value={item.receivedQty}
                              onChange={e => updateItem(idx, "receivedQty", Number(e.target.value))}
                              className="w-16 px-2 py-1 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-center outline-none focus:border-[#f58220] text-gray-800 dark:text-white"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              max={item.receivedQty}
                              value={item.rejectedQty}
                              onChange={e => updateItem(idx, "rejectedQty", Number(e.target.value))}
                              className="w-16 px-2 py-1 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-center outline-none focus:border-[#f58220] text-gray-800 dark:text-white"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-mono text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-md">
                              {item.acceptedQty}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.receivedQty > 0 ? (
                              item.rejectedQty === 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full">
                                  <CheckCircle2Icon size={10} /> Full
                                </span>
                              ) : item.acceptedQty > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                                  <AlertTriangleIcon size={10} /> Partial
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">
                                  <XCircleIcon size={10} /> Reject
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {(() => {
              const poValue = grnItems.reduce((s, i) => s + i.quantity * i.poPrice, 0);
              const actualGoodsValue = grnItems.reduce((s, i) => s + i.acceptedQty * i.price, 0);
              const variance = actualGoodsValue - poValue;
              const variancePct = poValue > 0 ? (variance / poValue) * 100 : 0;
              const hasOverride = grnItems.some(i => Math.abs(i.price - i.poPrice) > 0.001);

              const commercials = computeCommercialsFromPO(selectedPO, grnItems);

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-card p-5 rounded-lg border border-gray-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Goods Value Comparison</span>
                      {hasOverride && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                          <AlertTriangleIcon size={10} /> Price Overridden
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
                        <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400">PO Baseline (Ordered)</div>
                        <div className="text-base font-bold font-mono text-gray-800 dark:text-white mt-0.5">
                          ₹{poValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="p-3 bg-orange-50/50 dark:bg-orange-500/5 rounded-lg border border-orange-100 dark:border-orange-500/10">
                        <div className="text-[10px] uppercase font-bold text-[#f58220]">Actual Accepted Value</div>
                        <div className="text-base font-bold font-mono text-[#f58220] mt-0.5">
                          ₹{actualGoodsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {hasOverride && (
                      <div className="text-xs text-gray-500 dark:text-slate-400 pt-1 flex items-center justify-between">
                        <span>Variance vs PO Baseline:</span>
                        <span className={clsx("font-bold font-mono", variance >= 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400")}>
                          {variance >= 0 ? "+" : ""}₹{variance.toFixed(2)} ({variancePct >= 0 ? "+" : ""}{variancePct.toFixed(2)}%)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-card p-5 rounded-lg border border-gray-200 dark:border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">Purchase Bill Preview</span>
                      <span className="text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 px-2 py-0.5 rounded">
                        Posts on Approval
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300 pt-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Accepted Goods Value</span>
                        <span className="font-mono font-semibold text-gray-700 dark:text-slate-300">₹{commercials.goodsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">GST (Total)</span>
                        <span className="font-mono font-semibold text-gray-700 dark:text-slate-300">+₹{commercials.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {commercials.discountAmount > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span className="text-gray-600 dark:text-slate-400">Discount</span>
                          <span className="font-mono font-semibold text-gray-700 dark:text-slate-300">-₹{commercials.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {commercials.freightCost > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Freight Cost</span>
                          <span className="font-mono font-semibold text-gray-700 dark:text-slate-300">+₹{commercials.freightCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-200 dark:border-white/10 flex justify-between items-center font-bold">
                        <span className="text-xs uppercase text-gray-900 dark:text-white tracking-wider">Final Vendor Payable</span>
                        <span className="text-base font-mono text-[#f58220]">₹{commercials.finalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const totalAccepted = grnItems.reduce((s, i) => s + (Number(i.acceptedQty) || 0), 0);
              const hasIncompleteBatchInfo = grnItems.some(item => {
                if (item.acceptedQty <= 0) return false;
                if (!item.lotNumber || !item.lotNumber.trim()) return true;
                if (!item.expDate || isNaN(new Date(item.expDate).getTime())) return true;
                return false;
              });
              const isApproveDisabled = submitting || grnItems.length === 0 || totalAccepted === 0 || hasIncompleteBatchInfo;

              return (
                <div className="bg-white dark:bg-card px-6 py-4 rounded-lg border border-gray-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-gray-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                    <span>
                      <span className="font-semibold text-gray-800 dark:text-white">{grnItems.length}</span> material item(s) • Total Accepted: <span className="font-bold text-green-600 dark:text-green-400">{totalAccepted}</span> units
                    </span>
                    {hasIncompleteBatchInfo && totalAccepted > 0 && (
                      <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/40">
                        Batch No &amp; EXP date required
                      </span>
                    )}
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
                      title={hasIncompleteBatchInfo ? "Please fill Batch No & EXP Date for all items" : "Approve GRN and synchronize stock"}
                      className={clsx(
                        "px-5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5",
                        isApproveDisabled
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none"
                          : "bg-[#f58220] hover:bg-[#e8740e] text-white active:scale-95 cursor-pointer"
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
                        <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-widest text-right">Price</th>
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
                          <td className="px-4 py-3 text-right">
                            <div className="font-semibold text-slate-700 dark:text-slate-300">₹{Number(item.price).toFixed(2)}</div>
                            {item.priceOverridden && (
                              <div className="text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-0.5" title={`Overridden by ${item.priceOverrideBy || "—"} · ${item.priceOverrideAt ? formatDate(item.priceOverrideAt) : ""}\nReason: ${item.priceOverrideReason || "—"}`}>
                                was ₹{Number(item.poPrice).toFixed(2)} ⚠
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{item.warehouse?.name || (
                            <span className="text-rose-500 italic font-medium">Update Warehouse</span>
                          )}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Historical Commercial Breakdown */}
                {(() => {
                  const po = viewingGRNDetails.procurementOrder;
                  const items = (viewingGRNDetails.items || []).map((item: any) => {
                    const poItem = po?.poItems?.find((pi: any) => pi.inventoryItemId === item.materialId || pi.id === item.materialId);
                    const gstRate = item.gstRate ?? poItem?.gstRate ?? item.inventoryItem?.taxRate ?? item.inventoryItem?.gstRate ?? 0;
                    return {
                      materialId: item.materialId,
                      acceptedQty: item.acceptedQty ?? item.quantity,
                      price: item.price,
                      quantity: item.quantity,
                      poPrice: item.poPrice || item.price,
                      gstRate: Number(gstRate) || 0,
                    };
                  });
                  const comm = computeCommercialsFromPO(po, items);
                  const rates = Object.keys(comm.taxRateMap).map(Number);
                  let gstLabel = "GST";
                  if (rates.length === 1) gstLabel = `GST (${rates[0]}%)`;
                  else if (rates.length > 1) gstLabel = `GST (${rates.sort((a, b) => a - b).map(r => r + "%").join(", ")})`;
                  else gstLabel = "GST (0%)";

                  return (
                    <div className="bg-slate-50 dark:bg-[#0b0c14] border border-slate-100 dark:border-white/5 p-4 rounded-2xl space-y-2 mt-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Commercial Breakdown Preview</h4>
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/20">Final Payable</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs pt-1">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Goods Value</span>
                          <span className="font-bold text-slate-800 dark:text-white">₹{comm.goodsValue.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">{gstLabel}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{comm.taxAmount.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Discount</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">-₹{comm.discountAmount.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Freight</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">+₹{comm.freightCost.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Total Payable</span>
                          <span className="font-extrabold text-[#f58220]">₹{comm.finalPayable.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Price Override Audit — always visible, not tooltip-only, so
                  "why was this vendor charged X instead of PO Y" is
                  answerable months later without digging through app logs. */}
              {viewingGRNDetails.items?.some((item: any) => item.priceOverridden) && (
                <div className="space-y-3">
                  <h3 className="text-[11px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
                    <AlertTriangleIcon size={12} /> Price Override Audit
                  </h3>
                  <div className="space-y-2">
                    {viewingGRNDetails.items
                      .filter((item: any) => item.priceOverridden)
                      .map((item: any, idx: number) => (
                        <div key={idx} className="bg-amber-50/60 dark:bg-amber-500/[0.06] border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4">
                          <p className="text-xs font-black text-slate-800 dark:text-white mb-3">{item.inventoryItem?.name}</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">PO Price</p>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">₹{Number(item.poPrice).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Received Price</p>
                              <p className="text-xs font-bold text-amber-700 dark:text-amber-400">₹{Number(item.price).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Override</p>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Yes</p>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Changed By</p>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{item.priceOverrideBy || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Changed At</p>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.priceOverrideAt ? formatDate(item.priceOverrideAt) : "—"}</p>
                            </div>
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Reason</p>
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.priceOverrideReason || "—"}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
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
