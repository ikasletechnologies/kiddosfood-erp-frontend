"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator, Plus, Search, RefreshCw, X, User,
  Printer, ChevronDown, Trash2, Check, Share2, Download, Calendar,
  AlignLeft, FileText, ArrowLeft, ArrowRight, FileClock, Pencil, Truck,
  FileSpreadsheet, Copy
} from "lucide-react";
import { clsx } from "clsx";
import { customersApi, dealersApi, franchiseApi, rawMaterialsApi, settingsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api/base";
import AddPartyModal from "@/components/modals/AddPartyModal";
import AddInventoryProductForm from "@/components/modules/inventory/AddInventoryProductForm";
import GSTInvoice from "@/components/documents/GSTInvoice";
import { formatDate } from "@/lib/utils";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

// ── Constants ────────────────────────────────────────────────────────────────

const UNITS = [
  { label: "None",              short: "None",  code: "NONE" },
  { label: "Bags (Bag)",       short: "Bag",   code: "BAG" },
  { label: "Bottles (Btl)",    short: "Btl",   code: "BTL" },
  { label: "Box (Box)",        short: "Box",   code: "BOX" },
  { label: "Bundles (Bdl)",    short: "Bdl",   code: "BDL" },
  { label: "Carats (Ct)",      short: "Ct",    code: "CT" },
  { label: "Cms",              short: "Cms",   code: "CMS" },
  { label: "Dozens (Dzn)",     short: "Dzn",   code: "DZN" },
  { label: "Grams (Grm)",      short: "Grm",   code: "GRM" },
  { label: "Kilograms (Kgs)",  short: "Kgs",   code: "KGS" },
  { label: "Liters (Ltr)",     short: "Ltr",   code: "LTR" },
  { label: "Meters (Mtr)",     short: "Mtr",   code: "MTR" },
  { label: "Numbers (Nos)",    short: "Nos",   code: "NOS" },
  { label: "Packs (Pkt)",      short: "Pkt",   code: "PKT" },
  { label: "Pieces (Pcs)",     short: "Pcs",   code: "PCS" },
  { label: "Rolls",            short: "Roll",  code: "ROLL" },
  { label: "Square Feet (Sqf)",short: "Sqf",   code: "SQF" },
  { label: "Tons (Tne)",       short: "Tne",   code: "TNE" },
  { label: "Units (Unt)",      short: "Unt",   code: "UNT" },
];

const TAX_OPTIONS = [
  { label: "NONE", value: 0 },
  { label: "IGST@0%", value: 0 },
  { label: "GST@0%", value: 0 },
  { label: "IGST@0.25%", value: 0.25 },
  { label: "GST@0.25%", value: 0.25 },
  { label: "IGST@3%", value: 3 },
  { label: "GST@3%", value: 3 },
  { label: "IGST@5%", value: 5 },
  { label: "GST@5%", value: 5 },
  { label: "IGST@12%", value: 12 },
  { label: "GST@12%", value: 12 },
  { label: "IGST@18%", value: 18 },
  { label: "GST@18%", value: 18 },
  { label: "IGST@28%", value: 28 },
  { label: "GST@28%", value: 28 },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi",
  "Jammu & Kashmir","Ladakh",
];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:    { label: "Draft",    color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-50 dark:bg-white/5",   border: "border-slate-200 dark:border-white/10" },
  SENT:     { label: "Sent",     color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10",    border: "border-blue-200 dark:border-blue-500/20" },
  ACCEPTED: { label: "Accepted", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  REJECTED: { label: "Rejected", color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-500/10",    border: "border-rose-200 dark:border-rose-500/20" },
  CONVERTED:{ label: "Converted",color: "text-orange-600 dark:text-orange-400",  bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20" },
};

// Proforma Invoice shares this exact Estimate/Quotation form and backend model —
// only the on-screen wording changes depending on which sidebar entry brought the user here.
export type DocumentType = "ESTIMATE" | "PROFORMA";

const DOC_LABELS: Record<DocumentType, {
  formHeading: string;
  listHeading: string;
  newButton: string;
  statLabel: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptySubtitle: string;
  emptyButton: string;
  docWord: string;
  savedToast: string;
  noColumn: string;
}> = {
  ESTIMATE: {
    formHeading: "Estimate / Quotation",
    listHeading: "Estimations",
    newButton: "New Estimate",
    statLabel: "Total Estimations",
    searchPlaceholder: "Search estimate or customer...",
    emptyTitle: "No Estimations Found",
    emptySubtitle: "Create an estimate to share with your customers.",
    emptyButton: "Create Estimate",
    docWord: "Estimate",
    savedToast: "Estimation saved successfully",
    noColumn: "Est No",
  },
  PROFORMA: {
    formHeading: "Proforma Invoice",
    listHeading: "Proforma Invoices",
    newButton: "New Proforma Invoice",
    statLabel: "Total Proforma Invoices",
    searchPlaceholder: "Search proforma invoice or customer...",
    emptyTitle: "No Proforma Invoices Found",
    emptySubtitle: "Create a proforma invoice to share with your customers.",
    emptyButton: "Create Proforma Invoice",
    docWord: "Proforma Invoice",
    savedToast: "Proforma Invoice saved successfully",
    noColumn: "PI No",
  },
};

const PARTY_TYPES: { value: "CUSTOMER" | "DEALER" | "FRANCHISE"; label: string }[] = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "DEALER", label: "Dealer" },
  { value: "FRANCHISE", label: "Franchise" },
];

// Normalizes Customer / Dealer / Franchise master rows (different shapes)
// into the one shape the party dropdown + auto-fill logic needs. Dealer has
// no `state`/GSTIN field at all; Franchise has neither — those just come
// back undefined, and the caller only auto-fills whatever is present.
function normalizeParty(partyType: "CUSTOMER" | "DEALER" | "FRANCHISE", raw: any) {
  if (partyType === "FRANCHISE") {
    return {
      id: raw.id,
      name: raw.name,
      phone: raw.contactNum || "",
      state: undefined as string | undefined,
      gstin: undefined as string | undefined,
      billingAddress: raw.location || "",
      shippingAddress: raw.location || "",
      raw,
    };
  }
  if (partyType === "DEALER") {
    return {
      id: raw.id,
      name: raw.name,
      phone: raw.phone || "",
      state: undefined as string | undefined,
      gstin: undefined as string | undefined,
      billingAddress: raw.address || "",
      shippingAddress: raw.address || "",
      raw,
    };
  }
  return {
    id: raw.id,
    name: raw.name,
    phone: raw.contact || raw.phone || "",
    state: raw.state || undefined,
    gstin: raw.gstNumber || raw.gstin || undefined,
    billingAddress: raw.billingAddress || raw.address || "",
    shippingAddress: raw.shippingAddress || raw.billingAddress || raw.address || "",
    raw,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  productId: string;
  itemSearch: string;
  qty: number;
  unit: string;
  rate: number;
  discountPct: number;
  taxPct: number;
  taxLabel?: string;
}

// InventoryItem.unit is free-text from Item Master (e.g. "kg", "Ltr") and
// won't exact-match the <select>'s uppercase codes (KGS, LTR, ...), which
// silently renders as "None" even though the raw value round-trips fine —
// resolve it to the matching UNITS code so the dropdown actually shows it.
function normalizeUnit(raw: string | undefined | null): string {
  if (!raw) return "NONE";
  const needle = raw.trim().toUpperCase();
  if (!needle || needle === "NONE") return "NONE";
  const match = UNITS.find(u => {
    const short = u.short.toUpperCase();
    return u.code === needle || short === needle || short.startsWith(needle) || needle.startsWith(short);
  });
  return match ? match.code : "NONE";
}

function makeItem(): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    productId: "",
    itemSearch: "",
    qty: 1,
    unit: "NONE",
    rate: 0,
    discountPct: 0,
    taxPct: 0,
    taxLabel: "NONE",
  };
}

function computeRow(item: LineItem, withTax: boolean) {
  const qty = item.qty || 0;
  const rate = item.rate || 0;
  const discountPct = item.discountPct || 0;
  const taxPct = item.taxPct || 0;
  const gross = qty * rate;
  const discAmt = parseFloat((gross * discountPct / 100).toFixed(2));
  if (withTax) {
    const netAmt = gross - discAmt;
    const taxAmt = parseFloat((netAmt * taxPct / (100 + taxPct)).toFixed(2));
    return { discAmt, taxAmt, amount: parseFloat(netAmt.toFixed(2)) };
  }
  const taxable = gross - discAmt;
  const taxAmt = parseFloat((taxable * taxPct / 100).toFixed(2));
  return { discAmt, taxAmt, amount: parseFloat((taxable + taxAmt).toFixed(2)) };
}

// ── MiniCalendar ──────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function MiniCalendar({ value, onChange, onClose }: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
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
  const isSelected = (d: number) => selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d;
  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 p-3 w-64 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400">
          <ChevronDown size={14} className="rotate-90" />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-white">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400">
          <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => d === null ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            onClick={() => {
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              onChange(iso);
              onClose();
            }}
            className={clsx(
              "w-full aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition-colors",
              isSelected(d) && "bg-[#ff4d4f] text-white",
              !isSelected(d) && isToday(d) && "bg-red-50 dark:bg-red-500/10 text-[#ff4d4f]",
              !isSelected(d) && !isToday(d) && "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5"
            )}
          >{d}</button>
        ))}
      </div>
      <div className="mt-2 flex justify-between items-center border-t border-gray-100 dark:border-white/5 pt-2">
        <button
          onClick={() => {
            const t = new Date();
            const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
            onChange(iso);
            onClose();
          }}
          className="text-[11px] font-semibold text-[#ff4d4f] hover:text-red-700 dark:hover:text-red-400"
        >Today</button>
        <button onClick={onClose} className="text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Close</button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface EstimationsPageClientProps {
  documentType?: DocumentType;
  initialView?: "list" | "create";
  initialDraftData?: any | null;
  onCancel?: () => void;
}

export default function EstimationsPageClient({ 
  documentType = "ESTIMATE",
  initialView = "list",
  initialDraftData = null,
  onCancel,
}: EstimationsPageClientProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const L = DOC_LABELS[documentType];

  // shared
  const [view, setView] = useState<"list" | "create">(initialView);
  const [estimations, setEstimations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customers, setCustomers] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // list date filters
  const now = new Date();
  const getLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const firstOfMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastOfMonth  = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo,   setDateTo]   = useState(lastOfMonth);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const fromCalRef = useRef<HTMLDivElement>(null);
  const toCalRef = useRef<HTMLDivElement>(null);

  // Close calendar popups on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (fromCalRef.current && !fromCalRef.current.contains(e.target as Node)) setShowFromCal(false);
      if (toCalRef.current && !toCalRef.current.contains(e.target as Node)) setShowToCal(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // create form
  const [partyType, setPartyType] = useState<"CUSTOMER" | "DEALER" | "FRANCHISE">("CUSTOMER");
  // Holds the normalized party (see normalizeParty) — id/name/phone plus
  // whatever GSTIN/state/address the selected master record has.
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [stateOfSupply, setStateOfSupply] = useState("");
  const [refNo, setRefNo] = useState("");
  const [items, setItems] = useState<LineItem[]>([makeItem(), makeItem()]);
  const [priceMode, setPriceMode] = useState<"without_tax" | "with_tax">("without_tax");
  const [showPriceDrop, setShowPriceDrop] = useState(false);
  const [openItemDrop, setOpenItemDrop] = useState<string | null>(null);
  const [openUnitDrop, setOpenUnitDrop] = useState<string | null>(null);
  const [unitDropRect, setUnitDropRect] = useState<{ top: number; left: number } | null>(null);
  const [termsText, setTermsText] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [description, setDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(initialDraftData ? initialDraftData.id : null);
  // The status this record had when it was loaded — a brand-new/DRAFT
  // record is safe to silently resave on Back (that's the whole point of
  // "Save Draft"), but a SENT/CONVERTED/CANCELLED one is being VIEWED, not
  // edited: autosaving over it would either get rejected by the backend
  // (updateProformaInvoice/updateQuotation both reject non-DRAFT updates)
  // or, worse, silently regress its status back to DRAFT.
  const [loadedStatus, setLoadedStatus] = useState<string | null>(initialDraftData ? initialDraftData.status || null : null);

  // GSTInvoice preview/print/download/share modal
  const [previewEstimate, setPreviewEstimate] = useState<any>(null);
  const [previewAutoAction, setPreviewAutoAction] = useState<"download" | "share" | undefined>(undefined);
  const [companyProfile, setCompanyProfile] = useState<any>(null);

  // Convert to Sales Order & Tracking Modals
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedEstForConvert, setSelectedEstForConvert] = useState<any>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierName, setCourierName] = useState("");
  // Sales-order-specific fulfilment/payment commitment — deliberately NOT
  // derived from the Estimate's validUntil (a price-offer expiry, a
  // different business concept). Defaults to 7 days out at modal-open time,
  // matching the backend's own default when this is left unset.
  const [convertDueDate, setConvertDueDate] = useState("");

  // Add Party inline form
  const [showAddParty, setShowAddParty] = useState(false);
  const [newParty, setNewParty] = useState({ name: "", phone: "", email: "" });
  const [savingParty, setSavingParty] = useState(false);

  // Add Product inline form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);

  // Item dropdown fixed position
  const [itemDropRect, setItemDropRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Custom calendar
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const customerDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);
  const priceDropRef = useRef<HTMLDivElement>(null);
  const exportDropRef = useRef<HTMLDivElement>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const apiUrl = documentType === "PROFORMA" ? "/api/sales/proforma-invoices" : "/api/sales/quotations";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, cRes, pRes, dRes, fRes] = await Promise.allSettled([
        api.get(apiUrl).catch(() => ({ data: [] })),
        customersApi.getAll(),
        // Estimates sell finished goods, not raw materials/semi-finished/packaging —
        // exclude those categories to get the sellable Finished Goods catalog
        // (real InventoryItem rows, with a real `unit`, unlike the old Product
        // source this used to read from).
        rawMaterialsApi.getAll(false, undefined, "RAW_MATERIAL,SEMI_FINISHED,PACKAGING"),
        dealersApi.getAll(),
        franchiseApi.getAll(),
      ]);

      let apiEstimations = eRes.status === "fulfilled" ? (eRes.value as any).data || [] : [];

      // Drafts are already real Quotation rows (status: "DRAFT") saved through the
      // normal /api/sales/quotations endpoint below — no separate local draft store.
      setEstimations(apiEstimations);
      if (cRes.status === "fulfilled") setCustomers((cRes.value as any).data || []);
      if (pRes.status === "fulfilled") setProducts((pRes.value as any).data || []);
      if (dRes.status === "fulfilled") setDealers((dRes.value as any).data || []);
      if (fRes.status === "fulfilled") setFranchises((fRes.value as any).data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => setCompanyProfile(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropRef.current && !customerDropRef.current.contains(e.target as Node))
        setShowCustomerDrop(false);
      if (shareDropRef.current && !shareDropRef.current.contains(e.target as Node))
        setShowShareDrop(false);
      if (priceDropRef.current && !priceDropRef.current.contains(e.target as Node))
        setShowPriceDrop(false);
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node))
        setShowCalendar(false);
      if (exportDropRef.current && !exportDropRef.current.contains(e.target as Node))
        setExportDropdownOpen(false);

      // Close item drop if clicked outside
      if (openItemDrop) {
        const isInput = (e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).placeholder === "Search item...";
        const isDrop = (e.target as HTMLElement).closest(".item-dropdown-container");
        if (!isInput && !isDrop) {
          setOpenItemDrop(null);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Computed totals ────────────────────────────────────────────────────────
  const withTax = priceMode === "with_tax";
  const rowData = items.map(item => ({ item, ...computeRow(item, withTax) }));
  // Blank rows default qty to 1 for a nicer typing experience, but a row
  // with no item selected yet shouldn't count toward the displayed total.
  const totalQty = items
    .filter(i => i.productId || i.itemSearch.trim())
    .reduce((s, i) => s + i.qty, 0);
  const totalDisc = parseFloat(rowData.reduce((s, r) => s + r.discAmt, 0).toFixed(2));
  const totalTax = parseFloat(rowData.reduce((s, r) => s + r.taxAmt, 0).toFixed(2));
  const totalAmount = parseFloat(rowData.reduce((s, r) => s + r.amount, 0).toFixed(2));
  const roundOff = roundOffEnabled ? parseFloat((Math.round(totalAmount) - totalAmount).toFixed(2)) : 0;
  const finalTotal = parseFloat((totalAmount + roundOff).toFixed(2));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setDraftId(null);
    setPartyType("CUSTOMER");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerPhone("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setStateOfSupply("");
    setRefNo("");
    setItems([makeItem(), makeItem()]);
    setPriceMode("without_tax");
    setTermsText("");
    setShowTerms(false);
    setDescription("");
    setShowDesc(false);
    setRoundOffEnabled(true);
    setView("create");
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await api.delete(`/api/sales/quotations/${id}`);
      showToast("Draft deleted", "success");
      fetchData();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to delete draft", "error");
    }
  };

  const loadDraft = (draft: any) => {
    setDraftId(draft.id);
    // A locally-cached _rawState draft (draftsApi) is always a genuine
    // in-progress DRAFT — only a real API record (the `else` branch below)
    // can carry a finalized status like SENT/CONVERTED.
    setLoadedStatus(draft._rawState ? "DRAFT" : (draft.status || null));
    const raw = draft._rawState || {};
    if (draft._rawState) {
      setPartyType(raw.partyType || "CUSTOMER");
      setSelectedCustomer(raw.selectedCustomer || null);
      setCustomerSearch(raw.customerSearch || "");
      setCustomerPhone(raw.customerPhone || "");
      setInvoiceDate(raw.invoiceDate || new Date().toISOString().split("T")[0]);
      setStateOfSupply(raw.stateOfSupply || "");
      setRefNo(raw.refNo || "");
      setItems(raw.items && raw.items.length > 0 ? raw.items : [makeItem(), makeItem()]);
      setPriceMode(raw.priceMode || "without_tax");
      setTermsText(raw.termsText || "");
      setShowTerms(raw.showTerms || !!raw.termsText);
      setDescription(raw.description || "");
      setShowDesc(raw.showDesc || !!raw.description);
      setRoundOffEnabled(raw.roundOffEnabled ?? true);
    } else {
      // Legacy rows saved before partyType/partyId existed are always a
      // real Customer (that used to be the only option) — everything else
      // trusts the stored value.
      const draftPartyType: "CUSTOMER" | "DEALER" | "FRANCHISE" = draft.partyType || "CUSTOMER";
      const draftPartyId = draft.partyId || (draftPartyType === "CUSTOMER" ? draft.customerId : undefined);
      setPartyType(draftPartyType);

      const list = draftPartyType === "DEALER" ? dealers : draftPartyType === "FRANCHISE" ? franchises : customers;
      const rawParty = draft.customer || list.find((p: any) => p.id === draftPartyId) || null;
      const party = rawParty
        ? normalizeParty(draftPartyType, rawParty)
        : (draftPartyId ? { id: draftPartyId, name: draft.customerName || "", phone: draft.customerPhone || "", state: undefined as string | undefined } : null);

      setSelectedCustomer(party);
      setCustomerSearch((party ? party.name : "") || draft.customerName || "");
      setCustomerPhone(draft.customerPhone || party?.phone || "");
      setInvoiceDate(draft.validUntil ? new Date(draft.validUntil).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
      // Prefer the quotation's own persisted stateOfSupply — falling back to
      // the customer's current state only for legacy rows saved before this
      // field existed (a customer's state can drift after the fact; the
      // Estimate's own value is what was actually quoted against).
      setStateOfSupply(draft.stateOfSupply || party?.state || "");
      setRefNo(draft.quotationNumber || draft.proformaNumber || "");
      
      const mappedItems = draft.items && draft.items.length > 0
        ? draft.items.map((i: any) => ({
            id: i.id || `item_${Math.random()}`,
            productId: i.productId,
            itemSearch: i.productName,
            qty: i.quantity,
            unit: normalizeUnit(i.unit),
            rate: i.rate,
            discountPct: 0,
            taxPct: i.taxPercent || 0,
            taxLabel: TAX_OPTIONS.find(o => o.value === i.taxPercent)?.label || "NONE",
          }))
        : [makeItem(), makeItem()];
      setItems(mappedItems);
      setPriceMode("without_tax");
      setTermsText(draft.termsConditions || "");
      setShowTerms(!!draft.termsConditions);
      setDescription(draft.notes || "");
      setShowDesc(!!draft.notes);
      setRoundOffEnabled(true);
    }
    setView("create");
  };

  // `c` here is already the raw master row (Customer/Dealer/Franchise) —
  // normalize it before storing so downstream reads (save payload, print,
  // draft reopen) don't need to know which master table it came from.
  const selectCustomer = (c: any) => {
    const party = normalizeParty(partyType, c);
    setSelectedCustomer(party);
    setCustomerSearch(party.name);
    setCustomerPhone(party.phone || "");
    if (party.state) {
      setStateOfSupply(party.state);
    }
    setShowCustomerDrop(false);
  };

  // Switching Party Type must never leave a Dealer/Franchise selection
  // showing while the field label still says the old type — clear the
  // whole party selection so the next pick is unambiguous.
  const handlePartyTypeChange = (next: "CUSTOMER" | "DEALER" | "FRANCHISE") => {
    if (next === partyType) return;
    setPartyType(next);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerPhone("");
    setStateOfSupply("");
    setShowCustomerDrop(false);
  };

  const selectProduct = (idx: number, p: any) => {
    const taxPct = p.gstRate ?? p.taxPercent ?? 0;
    setItems(prev => prev.map((it, i) =>
      i === idx ? {
        ...it,
        productId: p.id,
        itemSearch: p.name,
        rate: p.customerPrice || p.basePrice || p.price || 0,
        unit: normalizeUnit(p.unit),
        taxPct,
        taxLabel: TAX_OPTIONS.find(o => o.value === taxPct)?.label || "NONE",
      } : it
    ));
    setOpenItemDrop(null);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  useEffect(() => {
    if (initialDraftData) {
      loadDraft(initialDraftData);
    }
  }, [initialDraftData]);

  const addRow = () => setItems(prev => [...prev, makeItem()]);

  const removeRow = (idx: number) => {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (isDraft = false) => {
    // A draft's whole point is to hold whatever's been typed so far, even
    // an item with no price yet — the strict qty/rate>0 filter below is
    // only for the real SENT path. Applying it to drafts too used to
    // silently drop every incomplete row (and skip the save outright if
    // that left nothing "valid"), so "Save Draft" would appear to just do
    // nothing whenever the party wasn't picked from the dropdown yet or an
    // item had no rate typed in.
    const hasAnyData = !!selectedCustomer || !!customerSearch.trim() || items.some(i => i.productId || i.itemSearch.trim());
    if (isDraft && !hasAnyData) {
      setView("list");
      return;
    }
    if (!isDraft && !selectedCustomer) { showToast("Please select a party", "error"); return; }

    const strictValidItems = items.filter(i => (i.productId || i.itemSearch.trim()) && i.qty > 0 && i.rate > 0);
    if (!isDraft && strictValidItems.length === 0) { showToast("Add at least one item with price", "error"); return; }

    const draftItems = items.filter(i => i.productId || i.itemSearch.trim());
    const itemsToSave = isDraft ? draftItems : strictValidItems;

    setSaving(true);
    try {
      const payload: any = {
        quotationNumber: refNo.trim() || undefined,
        partyType,
        partyId: selectedCustomer?.id,
        customerId: partyType === "CUSTOMER" ? selectedCustomer?.id : undefined,
        customerName: selectedCustomer ? selectedCustomer.name : (customerSearch || undefined),
        customerPhone,
        validUntil: invoiceDate,
        stateOfSupply: stateOfSupply || undefined,
        status: isDraft ? "DRAFT" : "SENT",
        items: itemsToSave.map(i => ({
          productId: i.productId || undefined,
          productName: i.itemSearch,
          quantity: i.qty || 0,
          unit: i.unit,
          rate: i.rate || 0,
          taxPercent: i.taxPct,
        })),
        discountAmount: totalDisc,
        termsConditions: showTerms ? (termsText || undefined) : undefined,
        notes: showDesc ? (description || undefined) : undefined,
      };

      if (draftId) {
        await api.put(`${apiUrl}/${draftId}`, payload);
      } else {
        const res = await api.post(apiUrl, payload);
        // Keep saving into the SAME record on repeat "Save Draft" clicks —
        // without this, every click created a brand-new Quotation.
        if (isDraft && res?.data?.id) setDraftId(res.data.id);
      }

      showToast(isDraft ? "Draft saved successfully" : L.savedToast, "success");
      fetchData();
      if (onCancel) onCancel();
      else setView("list");
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to save estimation", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    // Only auto-save-as-draft for a record that's actually still a DRAFT
    // (or brand new, loadedStatus === null) — never for one that was
    // opened already SENT/CONVERTED/CANCELLED. That's a VIEW, and
    // resaving it would either get rejected by the backend or silently
    // regress its status back to DRAFT (see loadedStatus above).
    const isEditableDraft = loadedStatus === null || loadedStatus === "DRAFT";
    const hasData = selectedCustomer || items.some(i => i.productId || i.itemSearch.trim());
    if (hasData && isEditableDraft) {
       handleSave(true);
    } else {
       if (onCancel) onCancel();
       else setView("list");
    }
  };

  const handleOpenConvertModal = (est: any) => {
    setSelectedEstForConvert(est);
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setDeliveryAddress("");
    setTrackingNumber("");
    setCourierName("");
    setConvertDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    setShowConvertModal(true);
  };

  const submitConvert = async () => {
    if (!selectedEstForConvert) return;
    setConverting(selectedEstForConvert.id);
    try {
      // Estimate -> Sales Order (never straight to a Tax Invoice — Proforma
      // and the actual Tax Invoice are separate later steps in the chain).
      const res = await api.post(`/api/sales/quotations/${selectedEstForConvert.id}/convert`, {
        deliveryDate: deliveryDate || undefined,
        deliveryAddress: deliveryAddress || undefined,
        trackingNumber: trackingNumber || undefined,
        courierName: courierName || undefined,
        dueDate: convertDueDate || undefined
      });
      showToast("Converted to Sales Order successfully", "success");
      setShowConvertModal(false);
      const salesOrderId = res?.data?.id;
      if (salesOrderId) {
        router.push(`/sales/orders?id=${salesOrderId}`);
      } else {
        fetchData();
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Conversion failed", "error");
    } finally {
      setConverting(null);
    }
  };

  // Isolates just the clicked estimate into the shared GSTInvoice preview
  // modal instead of printing the whole list page, and never touches any
  // other record. If the estimate's real validUntil date differs from a
  // flat 15-day offset, derive dueDateDays from the actual gap so the
  // "Valid Until" shown on the document matches the stored value.
  const handlePrintEstimate = (est: any) => {
    setPreviewAutoAction(undefined);
    setPreviewEstimate(est);
  };

  // Download reuses the exact same preview modal/document, just auto-fires
  // the Download action once it's painted — one PDF source for Print,
  // Download, and Share (see GSTInvoice), never a second layout.
  const handleDownloadEstimate = (est: any) => {
    setPreviewAutoAction("download");
    setPreviewEstimate(est);
  };

  const estimateDueDateDays = (est: any): number => {
    if (!est?.validUntil || !est?.createdAt) return 15;
    const created = new Date(est.createdAt).getTime();
    const validUntil = new Date(est.validUntil).getTime();
    if (Number.isNaN(created) || Number.isNaN(validUntil)) return 15;
    const days = Math.round((validUntil - created) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 15;
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  // Local Y/M/D (not toISOString) so a UTC+ browser doesn't shift the
  // estimate's created date back a day against the selected range.
  const toLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const filtered = estimations.filter(est => {
    const partyName = est.customer?.name || est.customerName;
    const matchSearch = !search ||
      est.quotationNumber?.toLowerCase().includes(search.toLowerCase()) ||
      partyName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || est.status === statusFilter;
    let matchDate = true;
    if (est.createdAt && (dateFrom || dateTo)) {
      const ymd = toLocalYMD(new Date(est.createdAt));
      matchDate = (!dateFrom || ymd >= dateFrom) && (!dateTo || ymd <= dateTo);
    }
    return matchSearch && matchStatus && matchDate;
  });

  const totalQuotations = filtered.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalConverted = filtered.filter(i => i.status === "CONVERTED").reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalOpen = filtered.filter(i => i.status === "SENT").reduce((s, i) => s + (i.totalAmount || 0), 0);

  const partySourceList = partyType === "DEALER" ? dealers : partyType === "FRANCHISE" ? franchises : customers;
  const filteredCustomers = partySourceList.filter((c: any) =>
    !customerSearch ||
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.contact && c.contact.includes(customerSearch)) ||
    (c.phone && c.phone.includes(customerSearch)) ||
    (c.contactNum && c.contactNum.includes(customerSearch))
  );

  const handleExportExcel = () => {
    setExportDropdownOpen(false);
    const headers = ["Date", L.noColumn, "Party Name", "Amount", "Status"];
    const rows = [
      [`${L.listHeading.toUpperCase()} REPORT`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      headers,
      ...filtered.map((est: any) => [
        formatDate(est.createdAt),
        est.quotationNumber || est.proformaNumber || "—",
        est.customer?.name || est.customerName || "—",
        `₹${Number(est.totalAmount || 0).toFixed(2)}`,
        STATUS_STYLES[est.status]?.label || est.status,
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${L.listHeading.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Excel (.csv) report downloaded!", "success");
  };

  const handleExportPDF = () => {
    setExportDropdownOpen(false);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Please allow pop-ups to export as PDF", "error");
      return;
    }
    const tableRows = filtered.map((est: any) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(est.createdAt)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-family: monospace; color: #f58220;">${est.quotationNumber || est.proformaNumber || "—"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${est.customer?.name || est.customerName || "—"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₹${Number(est.totalAmount || 0).toFixed(2)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${STATUS_STYLES[est.status]?.label || est.status}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${L.listHeading} Summary — ${new Date().toLocaleDateString()}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-size: 11px; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 24px; }
            h1 { font-size: 20px; font-weight: 900; margin: 0; text-transform: uppercase; }
            p { font-size: 11px; color: #64748b; margin: 4px 0 16px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; margin-top: 12px; }
            th { background-color: #f8fafc; padding: 8px; border-bottom: 2px solid #cbd5e1; font-weight: bold; text-transform: uppercase; font-size: 10px; color: #475569; }
          </style>
        </head>
        <body>
          <h1>${L.listHeading.toUpperCase()} REGISTRY</h1>
          <p>Generated on ${new Date().toLocaleString()} | Sales & Quotations</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>${L.noColumn}</th>
                <th>Party Name</th>
                <th style="text-align: right;">Amount</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShareWhatsApp = () => {
    setShowShareDrop(false);
    const text = `*${L.docWord} Summary*\nRef: ${refNo || "Draft"}\nParty: ${selectedCustomer?.name || customerSearch || "Customer"}\nTotal: ₹${finalTotal.toFixed(2)}\nValid Until: ${invoiceDate}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShareEmail = () => {
    setShowShareDrop(false);
    const subject = `${L.docWord} #${refNo || "Draft"} from ${companyProfile?.name || "Our Company"}`;
    const body = `Dear ${selectedCustomer?.name || customerSearch || "Customer"},\n\nPlease find the quotation details below:\nTotal Amount: ₹${finalTotal.toFixed(2)}\nValid Until: ${invoiceDate}\n\nThank you.`;
    window.open(`mailto:${selectedCustomer?.raw?.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  const handleShareCopyLink = () => {
    setShowShareDrop(false);
    const summary = `${L.docWord}: ${refNo || "Draft"} | Party: ${selectedCustomer?.name || customerSearch || "Customer"} | Total: ₹${finalTotal.toFixed(2)}`;
    navigator.clipboard.writeText(summary);
    showToast("Summary copied to clipboard!", "success");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE VIEW — Full-page form
  // ══════════════════════════════════════════════════════════════════════════
  if (view === "create") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 flex flex-col w-full min-w-0 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 animate-in fade-in duration-300">

        {/* ── Top bar ── */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0 shadow-2xs w-full min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={handleBack} 
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
              title="Back to List"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">{L.formHeading}</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">
                {draftId ? "Editing quotation draft" : "Create new customer quotation"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 space-y-4 sm:space-y-6 w-full min-w-0">

          {/* Customer + Meta info */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 w-full min-w-0 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full min-w-0">
              {/* Left: Party + Phone */}
              <div className="space-y-3 sm:space-y-4 min-w-0">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Party Type</label>
                  <div className="flex flex-wrap items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-card w-fit p-0.5">
                    {PARTY_TYPES.map(pt => (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() => handlePartyTypeChange(pt.value)}
                        className={clsx(
                          "px-3 py-1.5 text-xs font-semibold transition-colors rounded-lg cursor-pointer",
                          partyType === pt.value ? "bg-[#f58220] text-white shadow-2xs" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                        )}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative" ref={customerDropRef}>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Party *</label>
                  <div
                    className={clsx(
                      "flex items-center gap-2 border rounded-xl px-3 py-2 cursor-pointer bg-white dark:bg-[#13151f] transition-all",
                      showCustomerDrop ? "border-[#f58220] ring-1 ring-[#f58220]/20" : "border-gray-300 dark:border-white/10 hover:border-gray-400"
                    )}
                    onClick={() => setShowCustomerDrop(v => !v)}
                  >
                    <input
                      className="flex-1 text-xs sm:text-sm text-gray-700 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder-slate-500"
                      placeholder="Select or search party"
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                      onClick={e => { e.stopPropagation(); setShowCustomerDrop(true); }}
                    />
                    {customerSearch && (
                      <X 
                        size={14} 
                        className="text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0" 
                        onClick={(e) => { e.stopPropagation(); setCustomerSearch(""); setSelectedCustomer(null); }} 
                      />
                    )}
                    <ChevronDown size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
                  </div>

                  {showCustomerDrop && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-full max-w-[calc(100vw-2rem)] sm:w-[400px] bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
                      {partyType === "CUSTOMER" && (
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 font-semibold cursor-pointer"
                          onClick={() => {
                            const isPhone = /^[\d\s\-+()]{6,}$/.test(customerSearch.trim());
                            setNewParty(prev => ({
                              ...prev,
                              name: isPhone ? "" : customerSearch.trim(),
                              phone: isPhone ? customerSearch.trim() : "",
                            }));
                            setShowAddParty(true);
                            setShowCustomerDrop(false);
                          }}
                        >
                          <span className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-[#f58220] font-bold text-base leading-none">+</span>
                          Add New Party
                        </button>
                      )}
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredCustomers.length === 0 ? (
                          <div className="px-3 py-4 text-xs sm:text-sm text-gray-400 dark:text-slate-500 text-center">
                            No {partyType === "CUSTOMER" ? "customers" : partyType === "DEALER" ? "dealers" : "franchises"} found
                          </div>
                        ) : (
                          filteredCustomers.map((c: any) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors cursor-pointer text-left"
                              onClick={() => selectCustomer(c)}
                            >
                              <div>
                                <div className="text-xs sm:text-sm font-medium text-gray-800 dark:text-white">{c.name}</div>
                                <div className="text-[11px] text-gray-400 dark:text-slate-500">{c.contact || c.phone || c.contactNum || "—"}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Phone</label>
                  <input
                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder-slate-500"
                    placeholder="Phone number"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Right: Ref No, Valid Until, State of Supply */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Ref No</label>
                  <input
                    type="text"
                    placeholder="Auto"
                    value={refNo}
                    onChange={e => setRefNo(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Valid Until</label>
                  <div className="relative" ref={calendarRef}>
                    <button
                      type="button"
                      onClick={() => setShowCalendar(v => !v)}
                      className="w-full flex items-center justify-between border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] hover:border-[#f58220] transition-colors cursor-pointer"
                    >
                      <span className="font-medium text-gray-700 dark:text-white">
                        {invoiceDate ? formatDate(invoiceDate + "T00:00:00") : "Pick date"}
                      </span>
                      <Calendar size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
                    </button>
                    {showCalendar && (
                      <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-1.5 z-[200] max-w-[calc(100vw-2rem)]">
                        <MiniCalendar value={invoiceDate} onChange={setInvoiceDate} onClose={() => setShowCalendar(false)} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">State of Supply</label>
                  <select
                    value={stateOfSupply}
                    onChange={e => setStateOfSupply(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] cursor-pointer"
                  >
                    <option value="" className="dark:bg-card">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0 shadow-2xs">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
              <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wide">Estimate Items</span>
              <button
                type="button"
                onClick={() => setPriceMode(priceMode === "without_tax" ? "with_tax" : "without_tax")}
                className="px-2.5 py-1 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 hover:border-orange-300 text-xs font-semibold rounded-lg text-gray-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Price: {priceMode === "without_tax" ? "Excl. Tax" : "Incl. Tax"}
              </button>
            </div>

            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-semibold border-b border-gray-200 dark:border-white/5 uppercase">
                    <th className="text-left px-4 py-2.5 w-10">#</th>
                    <th className="text-left px-4 py-2.5">Item</th>
                    <th className="text-center px-4 py-2.5 w-20">Qty</th>
                    <th className="text-left px-4 py-2.5 w-28">Unit</th>
                    <th className="text-right px-4 py-2.5 w-28">Price/Unit</th>
                    <th className="text-left px-4 py-2.5 w-36">Tax</th>
                    <th className="text-right px-4 py-2.5 w-32">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {items.map((item, idx) => {
                    const { taxAmt, amount } = computeRow(item, withTax);
                    const filtProd = products.filter(p =>
                      !item.itemSearch ||
                      p.name?.toLowerCase().includes(item.itemSearch.toLowerCase()) ||
                      p.sku?.toLowerCase().includes(item.itemSearch.toLowerCase())
                    ).slice(0, 10);
                    return (
                      <tr key={item.id} className="hover:bg-orange-50/20 dark:hover:bg-orange-500/5 group">
                        <td className="px-4 py-2.5 text-center text-xs text-gray-400 dark:text-slate-500 align-top">
                          <div className="py-1.5">{idx + 1}</div>
                        </td>
                        <td className="px-4 py-2.5 relative align-top">
                          <input
                            className="w-full px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                            placeholder="Search item..."
                            value={item.itemSearch}
                            onChange={e => {
                              updateItem(idx, "itemSearch", e.target.value);
                              updateItem(idx, "productId", "");
                              setOpenItemDrop(item.id);
                            }}
                            onFocus={() => {
                              setOpenItemDrop(item.id);
                            }}
                          />
                          {item.itemSearch && (
                            <X 
                              size={14} 
                              className="absolute right-6 top-5 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                              onClick={() => updateItem(idx, "itemSearch", "")} 
                            />
                          )}
                          {openItemDrop === item.id && (
                            <div className="absolute left-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col z-50 item-dropdown-container">
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#f58220] hover:bg-orange-50 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 font-semibold shrink-0 cursor-pointer"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setActiveItemIdx(idx);
                                  setShowAddProduct(true);
                                  setOpenItemDrop(null);
                                }}
                              >
                                <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-[#f58220] font-bold text-xs leading-none">+</span>
                                Add New Product
                              </button>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {filtProd.length === 0 ? (
                                  <div className="px-3 py-4 text-xs text-gray-400 dark:text-slate-500 text-center">No products found</div>
                                ) : (
                                  filtProd.map(p => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-orange-50 dark:hover:bg-white/5 text-left border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors cursor-pointer"
                                      onMouseDown={() => selectProduct(idx, p)}
                                    >
                                      <div>
                                        <div className="text-sm font-medium text-gray-800 dark:text-white">{p.name}</div>
                                        <div className="text-xs text-gray-400 dark:text-slate-500">{p.sku ? `${p.sku} · ` : ""}₹{p.customerPrice || p.basePrice || p.price || 0}</div>
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <input
                            type="number"
                            min={0}
                            value={item.qty === 0 ? "" : item.qty}
                            onChange={e => updateItem(idx, "qty", Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-center outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <select
                            value={item.unit}
                            onChange={e => updateItem(idx, "unit", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none focus:border-[#f58220] cursor-pointer"
                          >
                            {UNITS.map(u => <option key={u.code} value={u.code} className="dark:bg-card">{u.short}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-slate-500">₹</span>
                            <input
                              type="number"
                              min={0}
                              value={item.rate === 0 ? "" : item.rate}
                              onChange={e => updateItem(idx, "rate", Number(e.target.value))}
                              className="w-full pl-6 pr-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-right outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top">
                          <select
                            value={item.taxLabel || "NONE"}
                            onChange={e => {
                              const label = e.target.value;
                              const option = TAX_OPTIONS.find(o => o.label === label);
                              const val = option ? option.value : 0;
                              updateItem(idx, "taxLabel", label);
                              updateItem(idx, "taxPct", val);
                            }}
                            className="w-full px-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none focus:border-[#f58220] cursor-pointer"
                          >
                            {TAX_OPTIONS.map((o, index) => (
                              <option key={index} value={o.label} className="dark:bg-card">{o.label}</option>
                            ))}
                          </select>
                          <div className="text-[10px] text-right text-gray-400 dark:text-slate-500 mt-0.5">₹{taxAmt > 0 ? taxAmt.toFixed(2) : "0.00"}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-700 dark:text-slate-200 align-top">
                          <div className="py-1.5 font-mono">
                            {amount > 0 ? `₹${amount.toFixed(2)}` : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center align-top">
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-gray-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="md:hidden p-3 space-y-3.5">
              {items.map((item, idx) => {
                const { taxAmt, amount } = computeRow(item, withTax);
                const filtProd = products.filter(p =>
                  !item.itemSearch ||
                  p.name?.toLowerCase().includes(item.itemSearch.toLowerCase()) ||
                  p.sku?.toLowerCase().includes(item.itemSearch.toLowerCase())
                ).slice(0, 10);

                return (
                  <div key={item.id} className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl space-y-3 relative">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f58220]/10 text-[#f58220] font-bold text-xs">
                        Item #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Product Search */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">
                        Product / Item *
                      </label>
                      <input
                        className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                        placeholder="Search product..."
                        value={item.itemSearch}
                        onChange={e => {
                          updateItem(idx, "itemSearch", e.target.value);
                          updateItem(idx, "productId", "");
                          setOpenItemDrop(item.id);
                        }}
                        onFocus={() => {
                          setOpenItemDrop(item.id);
                        }}
                      />
                      {item.itemSearch && (
                        <X 
                          size={14} 
                          className="absolute right-3 top-8 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                          onClick={() => updateItem(idx, "itemSearch", "")} 
                        />
                      )}
                      {openItemDrop === item.id && (
                        <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col z-50">
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[#f58220] hover:bg-orange-50 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 font-semibold shrink-0 cursor-pointer"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setActiveItemIdx(idx);
                              setShowAddProduct(true);
                              setOpenItemDrop(null);
                            }}
                          >
                            <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-[#f58220] font-bold text-xs leading-none">+</span>
                            Add New Product
                          </button>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {filtProd.length === 0 ? (
                              <div className="px-3 py-4 text-xs text-gray-400 dark:text-slate-500 text-center">No products found</div>
                            ) : (
                              filtProd.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-orange-50 dark:hover:bg-white/5 text-left border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors cursor-pointer"
                                  onMouseDown={() => selectProduct(idx, p)}
                                >
                                  <div>
                                    <div className="text-xs font-bold text-gray-800 dark:text-white">{p.name}</div>
                                    <div className="text-[10px] text-gray-400 dark:text-slate-500">{p.sku ? `${p.sku} · ` : ""}₹{p.customerPrice || p.basePrice || p.price || 0}</div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quantity & Unit Row */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={item.qty === 0 ? "" : item.qty}
                          onChange={e => updateItem(idx, "qty", Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">
                          Unit
                        </label>
                        <select
                          value={item.unit}
                          onChange={e => updateItem(idx, "unit", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none focus:border-[#f58220] cursor-pointer"
                        >
                          {UNITS.map(u => <option key={u.code} value={u.code} className="dark:bg-card">{u.short}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Price & Tax Row */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">
                          Price / Unit (₹)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={item.rate === 0 ? "" : item.rate}
                          onChange={e => updateItem(idx, "rate", Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">
                          Tax
                        </label>
                        <select
                          value={item.taxLabel || "NONE"}
                          onChange={e => {
                            const label = e.target.value;
                            const option = TAX_OPTIONS.find(o => o.label === label);
                            const val = option ? option.value : 0;
                            updateItem(idx, "taxLabel", label);
                            updateItem(idx, "taxPct", val);
                          }}
                          className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none focus:border-[#f58220] cursor-pointer"
                        >
                          {TAX_OPTIONS.map((o, index) => (
                            <option key={index} value={o.label} className="dark:bg-card">{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row Total Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-white/5 text-xs">
                      <span className="text-gray-400 font-semibold">Row Total</span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">
                          ₹{amount.toFixed(2)}
                        </span>
                        {taxAmt > 0 && (
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Tax: ₹{taxAmt.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table / Card Footer Toolbar */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 bg-gray-50/40 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 dark:border-white/10 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-white/5 rounded-xl text-xs font-bold text-[#f58220] transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Row
              </button>
              <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-slate-500">
                <span>Items: <strong className="text-gray-700 dark:text-slate-200">{items.length}</strong></span>
                <span>Qty: <strong className="text-gray-700 dark:text-slate-200">{totalQty}</strong></span>
                <span>Tax: <strong className="text-gray-700 dark:text-slate-200 font-mono">₹{totalTax.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>

          {/* Notes + Summary */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start w-full min-w-0">
            <div className="flex-1 bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 space-y-3 min-w-0 shadow-2xs">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTerms(v => {
                      if (v) setTermsText("");
                      return !v;
                    });
                  }}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all cursor-pointer",
                    showTerms ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10 text-[#f58220]" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  <AlignLeft className="h-3.5 w-3.5" /> Terms &amp; Conditions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDesc(v => {
                      if (v) setDescription("");
                      return !v;
                    });
                  }}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all cursor-pointer",
                    showDesc ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10 text-[#f58220]" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" /> Description
                </button>
              </div>
              {showTerms && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Terms &amp; Conditions</label>
                  <textarea
                    rows={3}
                    value={termsText}
                    onChange={e => setTermsText(e.target.value)}
                    placeholder="Add terms..."
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none resize-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
              {showDesc && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add description..."
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none resize-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 w-full lg:w-80 shrink-0 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-gray-500 dark:text-slate-400">Subtotal</span>
                <span className="font-semibold text-gray-700 dark:text-white font-mono">₹{totalAmount.toFixed(2)}</span>
              </div>
              {totalTax > 0 && (
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Tax</span>
                  <span className="text-gray-600 dark:text-slate-300 font-mono">₹{totalTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <label htmlFor="est_roundoff" className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="est_roundoff"
                    checked={roundOffEnabled}
                    onChange={e => setRoundOffEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-orange-500"
                  />
                  Round Off
                </label>
                <span className="text-gray-500 dark:text-slate-400 text-xs font-mono">{roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                <span className="font-bold text-gray-800 dark:text-white text-sm sm:text-base">Grand Total</span>
                <span className="text-lg sm:text-xl font-bold text-[#f58220] font-mono">₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Action Bar */}
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs w-full min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 text-xs sm:text-sm font-semibold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-600 dark:text-slate-400 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-gray-700 dark:text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Save Draft
            </button>
            <div className="relative" ref={shareDropRef}>
              <button
                type="button"
                onClick={() => setShowShareDrop(v => !v)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold border border-orange-200 dark:border-orange-500/20 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl text-[#f58220] transition-colors cursor-pointer"
              >
                <Share2 size={14} className="shrink-0" /> <span>Share</span> <ChevronDown size={12} className="shrink-0 opacity-70" />
              </button>
              {showShareDrop && (
                <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl w-36 overflow-hidden text-xs z-50 p-1 animate-in zoom-in-95 duration-150">
                  <button onClick={handleShareWhatsApp} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-lg">WhatsApp</button>
                  <button onClick={handleShareEmail} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-lg">Email</button>
                  <button onClick={handleShareCopyLink} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-lg">Copy Summary</button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 text-xs sm:text-sm font-bold bg-[#f58220] hover:bg-[#e8740e] text-white rounded-xl transition-all disabled:opacity-50 shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
            >
              <Check className="h-4 w-4" /> <span>{saving ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </div>

        {/* ── Add Party Modal ── */}
        <AddPartyModal
          isOpen={showAddParty}
          onClose={() => {
            setShowAddParty(false);
            setNewParty({ name: "", phone: "", email: "" });
          }}
          partyType="customer"
          title="ADD PARTY"
          initialData={newParty.name || newParty.phone ? newParty : undefined}
          onSave={async (data) => {
            try {
              const res = await customersApi.create({ ...data, phone: data.contact });
              const createdParty = (res as any).data;
              showToast("Party created successfully", "success");
              setCustomers(prev => [...prev, createdParty].sort((a, b) => a.name.localeCompare(b.name)));
              selectCustomer(createdParty);
              setShowAddParty(false);
              setNewParty({ name: "", phone: "", email: "" });
            } catch (e: any) {
              showToast(e?.response?.data?.error || "Failed to create party", "error");
              throw e;
            }
          }}
        />

        {showAddProduct && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white dark:bg-card rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-full max-w-5xl mx-auto min-h-[500px] max-h-[90vh] overflow-y-auto custom-scrollbar p-4 sm:p-6 relative">
              <button
                type="button"
                onClick={() => setShowAddProduct(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
              >
                <X size={18} />
              </button>
              <AddInventoryProductForm
                isModal={true}
                onCancel={() => setShowAddProduct(false)}
                onSuccess={(newProd) => {
                  showToast("Product created successfully", "success");
                  fetchData();
                  if (activeItemIdx !== null) {
                    selectProduct(activeItemIdx, newProd);
                  }
                  setShowAddProduct(false);
                }}
              />
            </div>
          </div>
        )}

      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW — Simplified Clean UI
  // ══════════════════════════════════════════════════════════════════════════
  const fmt = (d: string) => formatDate(d + "T00:00:00");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 w-full min-w-0 animate-in fade-in duration-300">

      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Calculator className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
              {L.listHeading}
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">
              Create, track, and convert sales quotations
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4 shrink-0" /> <span>{L.newButton}</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
          {[
            { label: L.statLabel, value: `₹${totalQuotations.toLocaleString("en-IN")}`, color: "text-gray-700 dark:text-slate-200", dot: "bg-gray-400" },
            { label: "Converted",         value: `₹${totalConverted.toLocaleString("en-IN")}`,  color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
            { label: "Open",              value: `₹${totalOpen.toLocaleString("en-IN")}`,       color: "text-[#f58220]",   dot: "bg-[#f58220]" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 px-3.5 sm:px-4 py-3 flex items-center gap-2.5 sm:gap-3 min-w-0 shadow-2xs">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 truncate">{s.label}</p>
                <p className={clsx("text-base sm:text-lg font-bold truncate", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative flex-1 min-w-[160px] xs:min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={L.searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-x-auto max-w-full custom-scrollbar bg-white dark:bg-card p-0.5 shrink-0">
            {["ALL", "SENT", "CONVERTED", "DRAFT"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-1.5 sm:py-2 text-xs font-medium transition-colors rounded-lg whitespace-nowrap shrink-0",
                  statusFilter === s ? "bg-[#f58220] text-white shadow-2xs" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {s === "ALL" ? "All" : s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-card text-xs sm:text-sm text-gray-700 dark:text-slate-200 relative shrink-0">
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900 dark:hover:text-white" onClick={() => setShowFromCal(v => !v)}>
              <Calendar className="h-4 w-4 text-gray-400 dark:text-slate-500 shrink-0" />
              <span className="font-medium">{fmt(dateFrom)}</span>
            </div>
            {showFromCal && (
              <div className="absolute top-full left-0 mt-1 z-50 max-w-[calc(100vw-2rem)]" ref={fromCalRef}>
                <MiniCalendar value={dateFrom} onChange={setDateFrom} onClose={() => setShowFromCal(false)} />
              </div>
            )}
            <span className="text-gray-300 dark:text-slate-600 px-1">to</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900 dark:hover:text-white" onClick={() => setShowToCal(v => !v)}>
              <span className="font-medium">{fmt(dateTo)}</span>
              <Calendar className="h-4 w-4 text-gray-400 dark:text-slate-500 shrink-0" />
            </div>
            {showToCal && (
              <div className="absolute top-full right-0 mt-1 z-50 max-w-[calc(100vw-2rem)]" ref={toCalRef}>
                <MiniCalendar value={dateTo} onChange={setDateTo} onClose={() => setShowToCal(false)} />
              </div>
            )}
          </div>

          <div className="flex-1 hidden sm:block" />

          {/* Export Dropdown */}
          <div className="relative shrink-0" ref={exportDropRef}>
            <button
              type="button"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 text-xs font-bold shadow-sm transition-all duration-150 active:scale-95 shrink-0"
              title="Export Options"
            >
              <Download size={14} className="shrink-0" />
              <span className="hidden xs:inline">Export</span>
              <ChevronDown size={12} className="shrink-0 opacity-70" />
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 z-50 mt-1.5 w-44 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden p-1 animate-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                  <FileSpreadsheet size={15} className="text-emerald-600 shrink-0" />
                  <span>Excel (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                >
                  <FileText size={15} className="text-rose-600 shrink-0" />
                  <span>PDF Document</span>
                </button>
              </div>
            )}
          </div>

          <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl transition-colors shrink-0 bg-white dark:bg-card" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-orange-500")} />
          </button>
        </div>

        {/* ── Empty State ── */}
        {loading ? (
          <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl py-16 sm:py-20 flex flex-col items-center justify-center text-center space-y-4 px-4 shadow-2xs">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center">
              <Calculator className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base">{L.emptyTitle}</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">{L.emptySubtitle}</p>
            </div>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-sm"
            >
              {L.emptyButton}
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0 shadow-2xs">
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">{L.noColumn}</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Party Name</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Amount</th>
                  <th className="text-center px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map((est) => {
                  const style = STATUS_STYLES[est.status] || STATUS_STYLES.DRAFT;
                  const isDraft = est.status === "DRAFT";
                  return (
                    <tr 
                      key={est.id} 
                      className={clsx(
                        "transition-colors",
                        isDraft ? "hover:bg-orange-50/50 dark:hover:bg-orange-500/10 cursor-pointer bg-orange-50/30 dark:bg-orange-500/5" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      )}
                      onClick={() => {
                        if (isDraft) loadDraft(est);
                      }}
                    >
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(est.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-200 text-xs whitespace-nowrap">
                        <div>{est.quotationNumber}</div>
                        {est.status === "CONVERTED" && est.convertedOrderNumber && (
                          <div className="text-[10px] text-green-600 dark:text-green-400 font-bold mt-1 bg-green-50 dark:bg-green-500/10 px-1.5 py-0.5 rounded inline-block">
                            Sales Order: {est.convertedOrderNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs sm:text-sm whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium text-gray-800 dark:text-white">
                            {est.customer?.name || est.customerName || "—"}
                          </span>
                          {!isDraft && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-white/10">
                              {est.partyType || (est.customerId ? "CUSTOMER" : "UNKNOWN")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-white text-xs sm:text-sm whitespace-nowrap font-mono">
                        ₹ {(est.totalAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                        {est.status === "CONVERTED" && (est.trackingNumber || est.courierName) && (
                          <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-1 font-medium">
                            {est.courierName ? `${est.courierName}: ` : ""}{est.trackingNumber || "No Tracking ID"}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {est.status === "CONVERTED" && est.convertedOrderNumber && (
                             <a
                               href={`/sales/orders?id=${est.convertedOrderId}`}
                               onClick={(e) => e.stopPropagation()}
                               className="px-2 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors mr-2"
                             >
                               View Sales Order
                             </a>
                          )}
                          {est.status === "SENT" && !isDraft && (
                             <button
                               onClick={(e) => { e.stopPropagation(); handleOpenConvertModal(est); }}
                               disabled={!!converting}
                               className="px-2.5 py-1 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20 rounded text-[10px] font-bold hover:bg-green-100 transition-colors mr-1"
                             >
                               {converting === est.id ? "..." : "Convert"}
                             </button>
                          )}
                          {isDraft ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); loadDraft(est); }}
                                className="p-1 text-gray-400 hover:text-[#f58220] hover:bg-orange-50 dark:hover:bg-white/5 rounded transition-colors"
                                title="Edit Draft"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteDraft(est.id); }}
                                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                                title="Delete Draft"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePrintEstimate(est); }}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
                                title="Print"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDownloadEstimate(est); }}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {previewEstimate && (
        <GSTInvoice
          order={{
            poNumber: previewEstimate.quotationNumber,
            createdAt: previewEstimate.createdAt,
            discount: previewEstimate.discountAmount || 0,
            items: (previewEstimate.items || []).map((it: any, idx: number) => ({
              itemName: it.productName || `Item #${idx + 1}`,
              quantity: it.quantity || 0,
              unit: it.unit,
              price: it.rate || 0,
              gstRate: it.taxPercent || 0,
            })),
          }}
          vendor={{
            name: previewEstimate.customer?.name || previewEstimate.customerName || "Customer",
            phone: previewEstimate.customerPhone || previewEstimate.customer?.contact || previewEstimate.customer?.phone || "",
            address: previewEstimate.customer?.billingAddress || previewEstimate.customer?.address || "",
            state: previewEstimate.customer?.state || "",
            gstin: previewEstimate.customer?.gstNumber || "",
          }}
          companyDetails={companyProfile || FALLBACK_COMPANY}
          documentType={documentType === "PROFORMA" ? "PROFORMA_INVOICE" : "QUOTATION"}
          dueDateDays={estimateDueDateDays(previewEstimate)}
          terms={previewEstimate.termsConditions ? previewEstimate.termsConditions.split("\n").filter((l: string) => l.trim()) : undefined}
          notes={previewEstimate.notes || undefined}
          autoAction={previewAutoAction}
          onClose={() => { setPreviewEstimate(null); setPreviewAutoAction(undefined); }}
        />
      )}

      {/* Convert to Sales Order Modal */}
      {showConvertModal && selectedEstForConvert && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4" onClick={() => setShowConvertModal(false)}>
          <div className="bg-white dark:bg-card rounded-2xl shadow-2xl border border-gray-150 dark:border-white/10 w-full max-w-lg mx-auto overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200 animate-out fade-out slide-out-to-top-5 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-[#f58220] px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between text-white shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-base sm:text-lg truncate">Convert to Sales Order</h3>
                <p className="text-white/80 text-xs mt-0.5 truncate">{selectedEstForConvert.quotationNumber} • {selectedEstForConvert.customer?.name || selectedEstForConvert.customerName || "No Customer Name"}</p>
              </div>
              <button
                onClick={() => setShowConvertModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-4 text-sm text-gray-700 dark:text-slate-300 overflow-y-auto custom-scrollbar flex-1">
              <div className="bg-orange-50/50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl p-3.5 sm:p-4 flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wider">Total Payable</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mt-0.5 font-mono">₹ {(selectedEstForConvert.totalAmount || 0).toLocaleString("en-IN")}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 dark:text-slate-500">Items</div>
                  <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-200 mt-0.5">{selectedEstForConvert.items?.length || 0} line items</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex flex-col">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Calendar size={12} /> Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-gray-800 dark:text-white text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Truck size={12} /> Courier Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Delhivery, BlueDart"
                    value={courierName}
                    onChange={e => setCourierName(e.target.value)}
                    className="px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-gray-800 dark:text-white text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <AlignLeft size={12} /> Tracking / Waybill Number
                </label>
                <input
                  type="text"
                  placeholder="Enter Tracking ID / AWB Number"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-gray-800 dark:text-white text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <FileText size={12} /> Delivery Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter the shipping/delivery address..."
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  className="px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-gray-800 dark:text-white text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-white/[0.02] border-t border-gray-150 dark:border-white/10 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0">
              <button
                onClick={() => setShowConvertModal(false)}
                className="px-3.5 sm:px-4 py-2 text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest hover:bg-white dark:hover:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={submitConvert}
                disabled={!!converting}
                className="px-4 sm:px-5 py-2 bg-green-600 text-white text-xs font-black rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95 disabled:opacity-50"
              >
                {converting ? "Converting..." : "Convert to SO"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
