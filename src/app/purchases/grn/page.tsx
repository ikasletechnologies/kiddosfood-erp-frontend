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
import { useAuth } from "@/context/AuthContext";

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
  // Authoritative remaining-receivable quantity (ordered minus cumulative
  // received from COMPLETED GRNs) — from GRNService.getRemainingQuantities.
  // Falls back to `quantity` if the lookup fails, so the field is always
  // present once selectPO resolves; the backend re-validates regardless.
  remaining?: number;
  previouslyReceived?: number;
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
  const { user } = useAuth();
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
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Received History Search & Date Filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyWarehouseFilter, setHistoryWarehouseFilter] = useState("ALL");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const fromCalRef = useRef<HTMLDivElement>(null);
  const toCalRef = useRef<HTMLDivElement>(null);

  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>("");
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  // Full-rejection confirmation (every received unit rejected).
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  // Product-wise summary shown before a normal approval.
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [previewGRN, setPreviewGRN] = useState(false);

  const formatDisplayDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "DD/MM/YYYY";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const formatDeliveryDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const day = String(d.getDate()).padStart(2, "0");
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatLotPreview = (baseLot: string, indexOffset: number) => {
    const match = baseLot.match(/^(LOT-\d{8}-)(\d{5})$/);
    if (!match) return baseLot;
    const seqNum = parseInt(match[2], 10) + indexOffset;
    return `${match[1]}${String(seqNum).padStart(5, '0')}`;
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

  // Fetch Warehouses on mount (Role-aware: HQ gets HQ warehouses via forGRN scope; Franchise gets their own warehouse)
  useEffect(() => {
    const isFranchiseUser = !!(user?.franchiseId || (user as any)?.franchise?.id || (user?.role || (user as any)?.role?.name || "").toUpperCase() === "FRANCHISE_ADMIN");
    const params = isFranchiseUser ? {} : { forGRN: true, scope: "HQ" };

    inventoryApi.getWarehouses(params)
      .then(res => {
        const list = res.data || [];
        const userFranchiseId = user?.franchiseId || (user as any)?.franchise?.id;

        let filtered = list;
        if (isFranchiseUser) {
          // Franchise User: Show their own franchise warehouse(s)
          const franchiseOnly = list.filter((w: any) =>
            w.franchiseId === userFranchiseId ||
            w.id === (user as any)?.primaryWarehouseId ||
            w.isFranchise ||
            w.type === "FRANCHISE"
          );
          filtered = franchiseOnly.length > 0 ? franchiseOnly : list;
        } else {
          // HQ / Headquarter User: Show Headquarter / Company warehouses (exclude franchise warehouses)
          const hqOnly = list.filter((w: any) => !w.isFranchise && !w.franchiseId);
          filtered = hqOnly.length > 0 ? hqOnly : list;
        }
        setWarehouses(filtered);
        if (filtered.length > 0) {
          setDefaultWarehouseId(prev => prev || filtered[0].id);
        }
      })
      .catch(err => {
        console.error("Failed to fetch warehouses:", err);
      });
  }, [user]);

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
      const statusCandidates = orders.filter(
        (p: PO) => p.status === "PENDING" || p.status === "APPROVED" || p.status === "SENT" || p.status === "PARTIALLY_RECEIVED"
      );
      // Status can be stale for older GRNs. Keep a PO in the receipt queue only
      // while the backend reports at least one genuinely receivable unit.
      const remainingChecks = await Promise.all(statusCandidates.map(async (po: PO) => {
        try {
          const remainingResponse = await grnApi.getRemainingQuantities(po.id);
          const hasRemaining = (remainingResponse.data || []).some((item: any) => Number(item.remaining) > 0.0001);
          return hasRemaining ? po : null;
        } catch {
          return po; // Preserve access if the advisory lookup is temporarily unavailable.
        }
      }));
      const pending = remainingChecks.filter((po): po is PO => po !== null);
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

  const selectPO = async (po: PO) => {
    setSelectedPO(po);

    // Authoritative remaining-receivable quantity per line (ordered minus
    // cumulative received from COMPLETED GRNs) — a partially-received PO
    // must default/cap to what's actually still outstanding, not the full
    // original ordered quantity again. Falls back to the raw ordered
    // quantity if the lookup fails; the backend still rejects any
    // over-receipt on submit regardless of what the UI shows.
    let remainingByMaterial = new Map<string, { remaining: number; previouslyReceived: number }>();
    try {
      const res = await grnApi.getRemainingQuantities(po.id);
      (res.data || []).forEach((r: any) => {
        if (r.materialId) remainingByMaterial.set(r.materialId, { remaining: r.remaining, previouslyReceived: r.previouslyReceived });
      });
    } catch (e) {
      console.error("Failed to load remaining receivable quantities:", e);
      toast.error("Could not load remaining receivable quantity for this PO — showing full ordered quantity, but the server will still block over-receiving.");
    }

    let baseLotStr = "";
    try {
      const res = await grnApi.generateLotNumber();
      baseLotStr = res.data.lotNumber || "";
    } catch (e) {
      console.error(e);
    }

    setGrnItems(
      (po.poItems || []).map((item, idx) => {
        const gstRate = item.gstRate ?? (item.inventoryItem as any)?.taxRate ?? (item.inventoryItem as any)?.gstRate ?? 0;
        const remainingInfo = remainingByMaterial.get(item.inventoryItem.id);
        const remaining = remainingInfo ? remainingInfo.remaining : item.quantity;
        const autoLotStr = baseLotStr ? formatLotPreview(baseLotStr, idx) : "[AUTO]";
        return {
          materialId: item.inventoryItem.id,
          quantity: item.quantity,
          remaining,
          previouslyReceived: remainingInfo?.previouslyReceived ?? 0,
          receivedQty: remaining,
          acceptedQty: remaining,
          rejectedQty: 0,
          price: item.price,
          poPrice: item.price,
          gstRate: Number(gstRate) || 0,
          priceOverrideReason: "",
          vendorBatchNo: "",
          mfgDate: "",
          expDate: "",
          lotNumber: autoLotStr,
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

      if (field === "acceptedQty") {
        // The operator enters the usable quantity. The balance of this PO
        // receipt is damaged/rejected and is sent to Purchase Returns.
        const receiptQty = currentItem.remaining ?? currentItem.quantity;
        currentItem.receivedQty = receiptQty;
        currentItem.acceptedQty = Math.min(receiptQty, parsedVal);
        currentItem.rejectedQty = Math.max(0, receiptQty - currentItem.acceptedQty);
      } else if (field === "rejectedQty") {
        currentItem.rejectedQty = Math.min(currentItem.receivedQty, parsedVal);
        currentItem.acceptedQty = Math.max(0, currentItem.receivedQty - currentItem.rejectedQty);
      }
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
      const lotStr = res.data.lotNumber ? formatLotPreview(res.data.lotNumber, idx) : "[AUTO]";
      updateItemStr(idx, "lotNumber", lotStr);
    } catch (e: any) {
      updateItemStr(idx, "lotNumber", "[AUTO]");
    } finally {
      setGeneratingLotIdx(null);
    }
  };

  const handleCreateAndApprove = async (rejectionReason?: string, confirmed?: boolean) => {
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
        if (!item.expDate || isNaN(new Date(item.expDate).getTime())) {
          toast.error(`Please select a valid Expiry (EXP) Date for "${itemName}".`);
          return;
        }
      }
    }

    // Everything checks out — show the product-wise summary for verification
    // first; the summary's Confirm calls back here with confirmed = true.
    // (A full rejection has its own confirmation with the rejection reason.)
    if (!rejectionReason && !confirmed) {
      setShowApproveConfirm(true);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create and Approve GRN (Impacts Inventory)
      const res = await grnApi.createFromPO(selectedPO.id, { items: itemsToSubmit });
      const grnId = res.data.id;
      // A fully rejected receipt is finalized as REJECTED server-side (reason
      // required, no stock or vendor bill posted).
      await grnApi.approve(grnId, rejectionReason ? { rejectionReason } : undefined);
      setApprovedId(grnId);

      // 2. Handle Rejections (Auto-create Purchase Return & Credit Adjustment)
      const rejectedItems = itemsToSubmit.filter(item => item.rejectedQty > 0);
      if (rejectedItems.length > 0) {
        const vendorId = selectedPO.vendorId || selectedPO.vendor?.id;

        if (vendorId) {
          // Create Purchase Return document
          await purchaseReturnsApi.create({
            procurementOrderId: selectedPO.id,
            vendorId,
            reason: rejectionReason ? `GRN FULL REJECTION: ${rejectionReason}` : "PENDING_RETURN_REASON",
            returnSource: "GRN_REJECTION",
            status: "PENDING",
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

      toast.success(rejectionReason
        ? "Shipment fully rejected. GRN recorded as Fully Rejected — no stock added."
        : rejectedItems.length > 0
          ? `GRN approved: accepted stock posted and ${rejectedItems.reduce((sum, item) => sum + item.rejectedQty, 0)} rejected unit(s) sent to Purchase Returns for reason confirmation.`
          : "GRN approved successfully! Accepted stock and vendor bill updated.");
      setShowRejectConfirm(false);
      setShowApproveConfirm(false);
      setRejectReason("");

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

  const filteredPOs = pos.filter(p => {
    const term = poSearch.trim().toLowerCase();
    const matchSearch =
      !term ||
      p.vendor.name.toLowerCase().includes(term) ||
      (p.poNumber || "").toLowerCase().includes(term);

    const matchWarehouse =
      warehouseFilter === "ALL" ||
      p.warehouseId === warehouseFilter ||
      (p as any).warehouse?.id === warehouseFilter ||
      (p as any).warehouse?.name === warehouseFilter;

    const isPartial = p.status === "PARTIALLY_RECEIVED";
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "PARTIALLY_RECEIVED" && isPartial) ||
      (statusFilter === "NOT_RECEIVED" && !isPartial) ||
      p.status === statusFilter;

    return matchSearch && matchWarehouse && matchStatus;
  });

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

    const historyWarehouseId = grn.warehouseId || grn.procurementOrder?.warehouseId || grn.items?.[0]?.warehouseId || grn.items?.[0]?.warehouse?.id;
    const matchWarehouse = historyWarehouseFilter === "ALL" || historyWarehouseId === historyWarehouseFilter;
    const matchStatus = historyStatusFilter === "ALL"
      || (historyStatusFilter === "APPROVED" ? ["APPROVED", "COMPLETED"].includes(grn.status) : grn.status === historyStatusFilter);
    return matchSearch && matchDate && matchWarehouse && matchStatus;
  });

  const exportHistory = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = filteredHistory.map((grn) => {
      const warehouseName = grn.warehouse?.name || grn.procurementOrder?.warehouse?.name || grn.items?.[0]?.warehouse?.name || "";
      return [
        formatERPNumber("GRN", grn.id, grn.createdAt),
        formatDate(grn.receivedAt || grn.createdAt),
        grn.procurementOrder ? formatERPNumber("PO", grn.procurementOrder.poNumber || grn.procurementOrder.id, grn.procurementOrder.createdAt) : "",
        grn.procurementOrder?.vendor?.name || "",
        warehouseName,
        grn.status || "",
      ];
    });
    const csv = [["GRN No.", "Receipt date", "PO No.", "Vendor", "Warehouse", "Status"], ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `GRN_History_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100">
      <WarehouseFormSidebar
        isOpen={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        onSuccess={handleWarehouseCreated}
      />

      {/* ── Top Header / Tab Bar ── */}
      <div className="bg-white dark:bg-[#13151f] border-b border-gray-200 dark:border-white/5 px-4 sm:px-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
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
              className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer mr-1"
              title="Go Back"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>

            {step === 1 ? (
              <div className="flex items-center gap-8">
                <button
                  type="button"
                  onClick={() => { setView("NEW"); setStep(1); }}
                  className={clsx(
                    "py-3.5 text-sm font-bold transition-all relative cursor-pointer border-b-2",
                    view === "NEW"
                      ? "text-[#f58220] border-[#f58220]"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white border-transparent"
                  )}
                >
                  New Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setView("HISTORY")}
                  className={clsx(
                    "py-3.5 text-sm font-bold transition-all relative cursor-pointer border-b-2",
                    view === "HISTORY"
                      ? "text-[#f58220] border-[#f58220]"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white border-transparent"
                  )}
                >
                  Received History
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-3.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">Step 2:</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">Verify Shipment Content</span>
                <span className="text-xs text-orange-600 dark:text-orange-400 font-mono font-semibold ml-1">({selectedPO?.poNumber})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 w-full min-w-0">
        {view === "HISTORY" ? (
          /* ── HISTORY VIEW ── */
          <div className="space-y-3.5">
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Goods Receipt (GRN)</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage incoming materials and receipt history</p>
            </div>

            <div className="bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_190px_180px_170px] gap-3 items-end shadow-sm">
              <div><label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Search</label><div className="relative"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search GRN, PO or vendor" className="w-full h-10 pl-9 pr-9 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#13151f] text-xs outline-none focus:border-[#f58220] focus:ring-2 focus:ring-orange-100" />{historySearch && <button type="button" onClick={() => setHistorySearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={14} /></button>}</div></div>
              <div><label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Date range</label><div className="grid grid-cols-2 gap-1"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="min-w-0 h-10 px-2 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#13151f] text-[10px] outline-none focus:border-[#f58220]" /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="min-w-0 h-10 px-2 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#13151f] text-[10px] outline-none focus:border-[#f58220]" /></div></div>
              <div><label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Warehouse</label><select value={historyWarehouseFilter} onChange={(e) => setHistoryWarehouseFilter(e.target.value)} className="w-full h-10 px-3 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#13151f] text-xs outline-none focus:border-[#f58220]"><option value="ALL">All warehouses</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
              <div><label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Status</label><select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)} className="w-full h-10 px-3 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#13151f] text-xs outline-none focus:border-[#f58220]"><option value="ALL">All statuses</option><option value="PENDING">Pending approval</option><option value="APPROVED">Approved</option><option value="REJECTED">Fully rejected</option></select></div>
            </div>

            <section className="bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-white/10"><h2 className="text-sm font-bold text-slate-900 dark:text-white">GRN History</h2><div className="flex items-center gap-3"><span className="text-[10px] text-slate-400">{filteredHistory.length} receipts</span><button type="button" onClick={exportHistory} disabled={filteredHistory.length === 0} className="px-3 py-1.5 border border-slate-200 dark:border-white/10 rounded-md text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:border-[#f58220] hover:text-[#f58220] disabled:opacity-40">Export</button><button type="button" onClick={loadHistory} className="p-1.5 text-slate-400 hover:text-[#f58220]" title="Refresh"><RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} /></button></div></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="bg-slate-50 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10"><th className="px-4 py-2.5 text-left">GRN No.</th><th className="px-4 py-2.5 text-left">Receipt date</th><th className="px-4 py-2.5 text-left">PO No.</th><th className="px-4 py-2.5 text-left">Vendor</th><th className="px-4 py-2.5 text-left">Warehouse</th><th className="px-4 py-2.5 text-left">Status</th><th className="px-4 py-2.5 text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">{loading ? <tr><td colSpan={7} className="py-14 text-center"><Loader2Icon className="mx-auto h-5 w-5 animate-spin text-[#f58220]" /></td></tr> : filteredHistory.length === 0 ? <tr><td colSpan={7} className="py-14 text-center text-slate-500">No GRN history matches the current filters.</td></tr> : filteredHistory.map((grn) => { const warehouseName = grn.warehouse?.name || grn.procurementOrder?.warehouse?.name || grn.items?.[0]?.warehouse?.name || "—"; const isPending = grn.status === "PENDING" || grn.status === "DRAFT"; const isRejected = grn.status === "REJECTED"; return <tr key={grn.id} className={clsx("hover:bg-slate-50 dark:hover:bg-white/[0.02]", isPending && "bg-orange-50/40 dark:bg-orange-500/[0.03]")}><td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{formatERPNumber("GRN", grn.id, grn.createdAt)}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(grn.receivedAt || grn.createdAt)}</td><td className="px-4 py-3 text-slate-700 dark:text-slate-300">{grn.procurementOrder ? formatERPNumber("PO", grn.procurementOrder.poNumber || grn.procurementOrder.id, grn.procurementOrder.createdAt) : "—"}</td><td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{grn.procurementOrder?.vendor?.name || "—"}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-400">{warehouseName}</td><td className="px-4 py-3"><span className={clsx("inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium", isRejected ? "bg-rose-100 text-rose-700" : isPending ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{isRejected ? "Fully rejected" : isPending ? "Pending approval" : "Approved"}</span></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setViewingGRNDetails(grn)} className="text-[11px] font-semibold text-blue-600 hover:underline">View details</button></td></tr>; })}</tbody>
              </table></div>
            </section>
          </div>        ) : step === 1 ? (
          /* ── STEP 1: SELECT PO ── */
          <div className="space-y-5">
            {/* ── Filters Bar (Matching Screenshot) ── */}
            <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 w-full">
              {/* Search Box */}
              <div className="flex-1 min-w-[260px]">
                <div className="relative">
                  <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search vendor or PO number..."
                    value={poSearch}
                    onChange={e => setPoSearch(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[#f58220] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 shadow-2xs transition-colors"
                  />
                  {poSearch && (
                    <X
                      size={14}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      onClick={() => setPoSearch("")}
                    />
                  )}
                </div>
              </div>

              {/* Warehouse Dropdown */}
              <div className="w-full md:w-56">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Warehouse
                </label>
                <div className="relative">
                  <select
                    value={warehouseFilter}
                    onChange={e => setWarehouseFilter(e.target.value)}
                    className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-colors cursor-pointer shadow-2xs"
                  >
                    <option value="ALL" className="dark:bg-[#13151f]">All warehouses</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id} className="dark:bg-[#13151f]">{w.name}</option>
                    ))}
                  </select>
                  <ChevronDownIcon size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Status Dropdown */}
              <div className="w-full md:w-52">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-colors cursor-pointer shadow-2xs"
                  >
                    <option value="ALL" className="dark:bg-[#13151f]">All statuses</option>
                    <option value="PARTIALLY_RECEIVED" className="dark:bg-[#13151f]">Partially received</option>
                    <option value="NOT_RECEIVED" className="dark:bg-[#13151f]">Not received</option>
                  </select>
                  <ChevronDownIcon size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons: Scanner & Refresh */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="p-2.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-card hover:border-[#f58220] rounded-xl text-gray-600 dark:text-slate-300 hover:text-[#f58220] transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5 text-xs font-semibold"
                  title="Scan PO Barcode"
                >
                  <ScanIcon className="h-4 w-4" />
                  <span className="hidden xl:inline">Scan</span>
                </button>
                <button
                  type="button"
                  onClick={loadPOs}
                  className="p-2.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-card rounded-xl text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer shadow-2xs"
                  title="Refresh Purchase Orders"
                >
                  <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
                </button>
              </div>
            </div>

            {/* ── Purchase Orders Table Card (Matching Screenshot) ── */}
            <div className="bg-white dark:bg-[#13151f] rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs">
              <div className="px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  Purchase orders ready to receive
                </h2>
                <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                  {filteredPOs.length} {filteredPOs.length === 1 ? "order" : "orders"}
                </span>
              </div>

              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="bg-gray-50/70 dark:bg-white/[0.02] text-gray-400 dark:text-slate-500 text-xs font-semibold border-b border-gray-100 dark:border-white/5">
                      <th className="px-5 py-3.5 text-left font-medium w-12">#</th>
                      <th className="px-5 py-3.5 text-left font-medium">PO number</th>
                      <th className="px-5 py-3.5 text-left font-medium">Vendor</th>
                      <th className="px-5 py-3.5 text-left font-medium">Warehouse</th>
                      <th className="px-5 py-3.5 text-left font-medium">Expected delivery</th>
                      <th className="px-5 py-3.5 text-center font-medium">Items</th>
                      <th className="px-5 py-3.5 text-left font-medium">Status</th>
                      <th className="px-5 py-3.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <Loader2Icon className="mx-auto text-[#f58220] animate-spin h-6 w-6" />
                        </td>
                      </tr>
                    ) : filteredPOs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-gray-500 dark:text-slate-400">
                          <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-[#f58220]">
                            <PackageIcon className="h-6 w-6" />
                          </div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-white">No Purchase Orders Found</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                            {pos.length === 0
                              ? "There are no approved purchase orders ready for receiving."
                              : "No purchase orders match your filter criteria."}
                          </p>
                          {(poSearch || warehouseFilter !== "ALL" || statusFilter !== "ALL") && (
                            <button
                              type="button"
                              onClick={() => {
                                setPoSearch("");
                                setWarehouseFilter("ALL");
                                setStatusFilter("ALL");
                              }}
                              className="mt-3 text-xs font-bold text-[#f58220] hover:underline cursor-pointer"
                            >
                              Reset filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredPOs.map((po, index) => {
                        const isPartial = po.status === "PARTIALLY_RECEIVED";
                        const warehouseName =
                          warehouses.find(w => w.id === po.warehouseId)?.name ||
                          (po as any).warehouse?.name ||
                          "Main Warehouse";
                        const deliveryDate = formatDeliveryDate(
                          (po as any).expectedDeliveryDate || (po as any).deliveryDate || (po as any).expectedDate || po.createdAt
                        );
                        const itemsCount = po.poItems?.length || 0;

                        return (
                          <tr
                            key={po.id}
                            className={clsx(
                              "transition-colors",
                              index === 0
                                ? "bg-orange-50/40 dark:bg-orange-950/10 hover:bg-orange-50/60 dark:hover:bg-orange-950/20"
                                : "hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
                            )}
                          >
                            <td className="px-5 py-4 text-xs font-medium text-gray-400 dark:text-slate-500">
                              {String(index + 1).padStart(2, "0")}
                            </td>
                            <td className="px-5 py-4 font-semibold text-xs text-gray-900 dark:text-white">
                              {po.poNumber || "PO-PENDING"}
                            </td>
                            <td className="px-5 py-4 font-semibold text-sm text-gray-900 dark:text-white">
                              {po.vendor?.name}
                            </td>
                            <td className="px-5 py-4 font-semibold text-xs text-gray-900 dark:text-white">
                              {warehouseName}
                            </td>
                            <td className="px-5 py-4 text-xs font-medium text-gray-700 dark:text-slate-300">
                              {deliveryDate}
                            </td>
                            <td className="px-5 py-4 text-xs font-semibold text-center text-gray-700 dark:text-slate-300">
                              {itemsCount}
                            </td>
                            <td className="px-5 py-4">
                              {isPartial ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  Partially received
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  Not received
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => selectPO(po)}
                                className="inline-flex items-center justify-center px-4 py-1.5 border border-[#f58220] text-[#f58220] hover:bg-[#f58220] hover:text-white rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shadow-2xs active:scale-95"
                              >
                                Receive Items
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
                      <th className="px-4 py-3 text-center">Accepted / Good</th>
                      <th className="px-4 py-3 text-center">Damaged / Return</th>
                      <th className="px-4 py-3 text-center">Total Receipt</th>
                      <th className="px-4 py-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {grnItems.map((item, idx) => {
                      const originalItem = selectedPO?.poItems[idx];
                      const variance = item.price - item.poPrice;
                      const isOverridden = Math.abs(variance) > 0.001;
                      const actualLineAmount = item.acceptedQty * item.price;

                      const isAutoLot = !item.lotNumber || !item.lotNumber.trim() || item.lotNumber.trim() === "[AUTO]" || item.lotNumber.trim().toUpperCase().endsWith("-[AUTO]");
                      const isExpMissing = item.acceptedQty > 0 && (!item.expDate || isNaN(new Date(item.expDate).getTime()));

                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-800 dark:text-white text-xs">{originalItem?.inventoryItem.name}</div>
                            <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Unit: {originalItem?.inventoryItem.unit}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1.5 min-w-[280px]">
                              <div className="flex items-center gap-1.5 w-full">
                                <button
                                  type="button"
                                  title="Set to Auto-Generate Lot Number on Save"
                                  disabled={generatingLotIdx === idx}
                                  onClick={() => handleAutoBatch(idx)}
                                  className={clsx(
                                    "px-2 py-1 rounded text-[11px] font-semibold transition-colors shrink-0 cursor-pointer border",
                                    isAutoLot
                                      ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                                      : "bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-[#f58220] border-orange-200 dark:border-orange-500/20"
                                  )}
                                >
                                  {generatingLotIdx === idx ? "Generating..." : "Auto Batch"}
                                </button>
                                <input
                                  type="text"
                                  placeholder="Auto-Generated on Save"
                                  value={item.lotNumber || ""}
                                  title={isAutoLot ? "Permanent lot number will be allocated on Save" : item.lotNumber}
                                  onChange={e => updateItemStr(idx, "lotNumber", e.target.value)}
                                  className={clsx(
                                    "flex-1 min-w-[170px] px-2.5 py-1 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-mono outline-none focus:border-[#f58220] transition-colors",
                                    isAutoLot ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-gray-800 dark:text-white"
                                  )}
                                />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <div className={clsx(
                                  "relative flex items-center gap-1.5 border px-2.5 py-1 rounded-lg overflow-hidden group hover:border-[#f58220] transition-colors w-full max-w-[270px]",
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

                              {isExpMissing && (
                                <div className="pt-0.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 px-1.5 py-0.5 rounded">
                                    EXP Date required
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
                            {(item.previouslyReceived ?? 0) > 0 && (
                              <div className="mt-1 space-y-0.5">
                                <div className="text-[10px] text-gray-400 dark:text-slate-500">Received so far: {item.previouslyReceived}</div>
                                <div className="text-[10px] font-semibold text-[#f58220]">Remaining: {item.remaining}</div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              max={item.remaining ?? item.quantity}
                              value={item.acceptedQty}
                              onChange={e => updateItem(idx, "acceptedQty", Number(e.target.value))}
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
                              {item.receivedQty}
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

                    {/* Product-wise lines — same per-line math as computeCommercialsFromPO
                        (accepted qty × actual price, GST on that), so they add up to the totals below. */}
                    {(() => {
                      const fmtAmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      const lines = grnItems
                        .filter(gi => (Number(gi.acceptedQty) || 0) > 0)
                        .map(gi => {
                          const qty = Number(gi.acceptedQty) || 0;
                          const price = Number(gi.price) || 0;
                          const rate = Number(gi.gstRate ?? 0);
                          const taxable = qty * price;
                          const tax = (taxable * rate) / 100;
                          return { key: gi.materialId, name: gi.inventoryItem?.name || "Item", unit: gi.inventoryItem?.unit || "", qty, price, rate, tax, total: taxable + tax };
                        });
                      if (lines.length === 0) {
                        return <p className="text-xs text-gray-400 dark:text-slate-500 italic pt-1">No accepted items yet.</p>;
                      }
                      return (
                        <div className="overflow-x-auto custom-scrollbar -mx-1 pt-1">
                          <table className="w-full text-[11px] min-w-[420px]">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-white/10">
                                <th className="text-left font-semibold px-1 py-1.5">Product</th>
                                <th className="text-right font-semibold px-1 py-1.5">Accepted</th>
                                <th className="text-right font-semibold px-1 py-1.5">Unit Price</th>
                                <th className="text-right font-semibold px-1 py-1.5">GST</th>
                                <th className="text-right font-semibold px-1 py-1.5">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-700 dark:text-slate-300">
                              {lines.map(l => (
                                <tr key={l.key}>
                                  <td className="px-1 py-1.5 font-medium text-gray-800 dark:text-slate-200 max-w-[140px] truncate" title={l.name}>{l.name}</td>
                                  <td className="px-1 py-1.5 text-right font-mono whitespace-nowrap">{l.qty} {l.unit}</td>
                                  <td className="px-1 py-1.5 text-right font-mono whitespace-nowrap">₹{fmtAmt(l.price)}</td>
                                  <td className="px-1 py-1.5 text-right font-mono whitespace-nowrap">
                                    ₹{fmtAmt(l.tax)} <span className="text-gray-400 dark:text-slate-500">({l.rate}%)</span>
                                  </td>
                                  <td className="px-1 py-1.5 text-right font-mono font-semibold text-gray-900 dark:text-white whitespace-nowrap">₹{fmtAmt(l.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}

                    <div className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300 pt-1 border-t border-gray-100 dark:border-white/5">
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
              const totalReceived = grnItems.reduce((s, i) => s + (Number(i.receivedQty) || 0), 0);
              // Goods arrived but every unit was rejected: finalized through
              // the full-rejection confirmation instead of a dead button.
              const isFullRejection = grnItems.length > 0 && totalReceived > 0 && totalAccepted === 0;
              const isApproveDisabled = submitting || grnItems.length === 0 || (totalAccepted === 0 && !isFullRejection) || hasIncompleteBatchInfo;

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
                      onClick={() => (isFullRejection ? setShowRejectConfirm(true) : handleCreateAndApprove())}
                      disabled={isApproveDisabled}
                      title={hasIncompleteBatchInfo ? "Please fill Batch No & EXP Date for all items" : isFullRejection ? "Every received unit is rejected — finalize the rejection" : "Approve GRN and synchronize stock"}
                      className={clsx(
                        "px-5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5",
                        isApproveDisabled
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none"
                          : isFullRejection
                          ? "bg-rose-600 hover:bg-rose-700 text-white active:scale-95 cursor-pointer"
                          : "bg-[#f58220] hover:bg-[#e8740e] text-white active:scale-95 cursor-pointer"
                      )}
                    >
                      {submitting ? <Loader2Icon size={14} className="animate-spin" /> : <ClipboardCheckIcon size={14} />}
                      {isFullRejection ? "Finalize Rejection" : "Approve & Sync"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Approval Confirmation (product-wise summary) ── */}
      {showApproveConfirm && selectedPO && (() => {
        // Same figures the Purchase Bill Preview shows and approval posts.
        const c = computeCommercialsFromPO(selectedPO, grnItems);
        const money = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const lines = grnItems.filter(i => (Number(i.receivedQty) || 0) > 0);
        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[999999] p-4" onClick={() => !submitting && setShowApproveConfirm(false)}>
            <div className="bg-white dark:bg-[#181b2a] border border-gray-200 dark:border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">Confirm GRN approval</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  PO {selectedPO.poNumber} · {selectedPO.vendor?.name} — verify before stock and the vendor bill are posted.
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.02] text-[10px] uppercase font-semibold text-gray-500 dark:text-slate-400">
                      <th className="text-left px-3 py-2">Product</th>
                      <th className="text-right px-2 py-2">Accepted</th>
                      <th className="text-right px-2 py-2">Rejected</th>
                      <th className="text-right px-2 py-2">Unit Price</th>
                      <th className="text-right px-2 py-2">GST</th>
                      <th className="text-right px-3 py-2">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                    {lines.map((i, idx) => {
                      const accepted = Number(i.acceptedQty) || 0;
                      const value = accepted * (Number(i.price) || 0);
                      const rate = Number(i.gstRate ?? 0);
                      const gst = (value * rate) / 100;
                      const unit = i.inventoryItem?.unit || "";
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-medium text-gray-800 dark:text-white">
                            {i.inventoryItem?.name || "Material"}
                            {Math.abs((Number(i.price) || 0) - (Number(i.poPrice) || 0)) > 0.001 && (
                              <span className="block text-[10px] font-normal text-amber-600">PO price {money(i.poPrice)} — changed at receipt</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{accepted} {unit}</td>
                          <td className="px-2 py-2 text-right text-rose-600 dark:text-rose-400">{Number(i.rejectedQty) || 0} {unit}</td>
                          <td className="px-2 py-2 text-right font-mono">{money(i.price)}</td>
                          <td className="px-2 py-2 text-right font-mono">{money(gst)} <span className="text-gray-400">({rate}%)</span></td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">{money(value + gst)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="ml-auto max-w-xs space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">Accepted Goods Value</span><span className="font-mono">{money(c.goodsValue)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">GST (Total)</span><span className="font-mono">+{money(c.taxAmount)}</span></div>
                {c.discountAmount > 0 && <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">Discount</span><span className="font-mono">-{money(c.discountAmount)}</span></div>}
                {c.freightCost > 0 && <div className="flex justify-between"><span className="text-gray-500 dark:text-slate-400">Freight Cost</span><span className="font-mono">+{money(c.freightCost)}</span></div>}
                <div className="flex justify-between pt-1.5 border-t border-gray-200 dark:border-white/10 font-bold">
                  <span className="uppercase tracking-wider text-gray-900 dark:text-white">Total Payable</span>
                  <span className="font-mono text-[#f58220] text-sm">{money(c.finalPayable)}</span>
                </div>
              </div>

              {lines.some(i => (Number(i.rejectedQty) || 0) > 0) && (
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Rejected quantities are not added to stock or billed; a purchase return is raised for vendor tracking.</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
                <button type="button" disabled={submitting} onClick={() => setShowApproveConfirm(false)} className="px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Back to Edit
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleCreateAndApprove(undefined, true)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-[#f58220] hover:bg-[#e8740e] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? <Loader2Icon size={14} className="animate-spin" /> : <ClipboardCheckIcon size={14} />}
                  Confirm & Approve
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Full Rejection Confirmation ── */}
      {showRejectConfirm && selectedPO && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[999999] p-4" onClick={() => !submitting && setShowRejectConfirm(false)}>
          <div className="bg-white dark:bg-[#181b2a] border border-gray-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Reject entire shipment?</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                PO {selectedPO.poNumber} · {selectedPO.vendor?.name}
              </p>
            </div>
            <ul className="text-xs text-gray-700 dark:text-slate-200 space-y-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3">
              {grnItems.filter(i => (Number(i.receivedQty) || 0) > 0).map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>{i.inventoryItem?.name || "Material"}</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">{i.rejectedQty} {i.inventoryItem?.unit || ""} rejected</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              The GRN will be recorded as <b>Fully Rejected</b>. No stock is added to inventory and no vendor bill is created; the PO quantity stays open for a replacement delivery. A purchase return is raised for vendor tracking.
            </p>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 block mb-1">Rejection reason *</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Damaged packaging, failed quality check, wrong material"
                className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white outline-none focus:border-rose-400 bg-white dark:bg-white/5 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={submitting} onClick={() => setShowRejectConfirm(false)} className="px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5">
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || rejectReason.trim().length < 3}
                onClick={() => handleCreateAndApprove(rejectReason.trim())}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting && <Loader2Icon size={14} className="animate-spin" />}
                Confirm Full Rejection
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <span className={clsx(
                    "inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border",
                    viewingGRNDetails.status === "REJECTED" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}>
                    {viewingGRNDetails.status === "REJECTED" ? "Fully Rejected" : viewingGRNDetails.status}
                  </span>
                  {viewingGRNDetails.status === "REJECTED" && viewingGRNDetails.rejectionReason && (
                    <p className="text-[11px] text-rose-600 mt-1.5">Reason: {viewingGRNDetails.rejectionReason}</p>
                  )}
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
