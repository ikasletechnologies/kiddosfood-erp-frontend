"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Truck, Plus, Search, RefreshCw, X, FileText,
  User, Check, Package, Calendar,
  MapPin, Hash, ArrowRight,
  ChevronDown, Trash2, MoreVertical,
  ArrowLeft, Download, FileSpreadsheet, Printer, Pencil,
  Loader2
} from "lucide-react";
import { clsx } from "clsx";
import { customersApi, dealersApi, productsFullApi, franchiseApi, inventoryApi, salesApi, productBatchesApi, settingsApi, posApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatERPNumber, formatDate, calculateSalesDocumentTotals } from "@/lib/utils";
import GSTInvoice from "@/components/documents/GSTInvoice";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

// ── Constants (Unified with Invoice Page) ────────────────────────────────────

const UNITS = [
  { label: "None",              short: "None",  code: "NONE" },
  { label: "Bags (Bag)",        short: "Bag",   code: "BAG" },
  { label: "Bottles (Btl)",     short: "Btl",   code: "BTL" },
  { label: "Box (Box)",         short: "Box",   code: "BOX" },
  { label: "Bundles (Bdl)",     short: "Bdl",   code: "BDL" },
  { label: "Carats (Ct)",       short: "Ct",    code: "CT" },
  { label: "Cms",               short: "Cms",   code: "CMS" },
  { label: "Dozens (Dzn)",      short: "Dzn",   code: "DZN" },
  { label: "Grams (Grm)",       short: "Grm",   code: "GRM" },
  { label: "Kilograms (Kgs)",   short: "Kgs",   code: "KGS" },
  { label: "Liters (Ltr)",      short: "Ltr",   code: "LTR" },
  { label: "Meters (Mtr)",      short: "Mtr",   code: "MTR" },
  { label: "Numbers (Nos)",     short: "Nos",   code: "NOS" },
  { label: "Packs (Pkt)",       short: "Pkt",   code: "PKT" },
  { label: "Pieces (Pcs)",      short: "Pcs",   code: "PCS" },
  { label: "Rolls",             short: "Roll",  code: "ROLL" },
  { label: "Square Feet (Sqf)", short: "Sqf",   code: "SQF" },
  { label: "Tons (Tne)",        short: "Tne",   code: "TNE" },
  { label: "Units (Unt)",       short: "Unt",   code: "UNT" },
];

const TAX_OPTIONS = [
  { label: "NONE", value: 0 },
  { label: "GST@0%", value: 0 },
  { label: "IGST@0%", value: 0 },
  { label: "GST@5%", value: 5 },
  { label: "IGST@5%", value: 5 },
  { label: "GST@12%", value: 12 },
  { label: "IGST@12%", value: 12 },
  { label: "GST@18%", value: 18 },
  { label: "IGST@18%", value: 18 },
  { label: "GST@28%", value: 28 },
  { label: "IGST@28%", value: 28 },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi",
  "Jammu & Kashmir","Ladakh",
];

// Unified Color Coding (from Invoice Page status colors)
const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:      { label: "Draft",       color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-50 dark:bg-white/5",   border: "border-slate-200 dark:border-white/10" },
  IN_TRANSIT: { label: "In Transit",  color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20" },
  CLOSED:     { label: "Delivered",   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  CONVERTED:  { label: "Converted",   color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10", border: "border-indigo-200 dark:border-indigo-500/20" },
  CANCELLED:  { label: "Cancelled",   color: "text-slate-400 dark:text-slate-500",   bg: "bg-slate-100 dark:bg-white/5",  border: "border-slate-200 dark:border-white/10" },
};

// ── Helper Functions for Product Units ───────────────────────────────────────

function normalizeUnit(raw: string | undefined | null): string {
  if (!raw) return "NONE";
  const s = raw.trim().toUpperCase();
  if (!s || s === "NONE") return "NONE";

  if (s === "KG" || s === "KGS" || s === "KILOGRAM" || s === "KILOGRAMS") return "KGS";
  if (s === "G" || s === "GRM" || s === "GRAM" || s === "GRAMS" || s === "GM") return "GRM";
  if (s === "L" || s === "LTR" || s === "LITER" || s === "LITERS" || s === "LITRE" || s === "LITRES") return "LTR";
  if (s === "PC" || s === "PCS" || s === "PIECE" || s === "PIECES") return "PCS";
  if (s === "NO" || s === "NOS" || s === "NUMBER" || s === "NUMBERS") return "NOS";
  if (s === "BOX" || s === "BOXES") return "BOX";
  if (s === "BAG" || s === "BAGS") return "BAG";
  if (s === "BDL" || s === "BUNDLE" || s === "BUNDLES") return "BDL";
  if (s === "CT" || s === "CARAT" || s === "CARATS") return "CT";
  if (s === "CMS" || s === "CENTIMETER" || s === "CENTIMETERS") return "CMS";
  if (s === "DZN" || s === "DOZEN" || s === "DOZENS") return "DZN";
  if (s === "MTR" || s === "METER" || s === "METERS" || s === "METRE") return "MTR";
  if (s === "PKT" || s === "PACK" || s === "PACKS" || s === "PACKET" || s === "PACKETS") return "PKT";
  if (s === "ROLL" || s === "ROLLS") return "ROLL";
  if (s === "SQF" || s === "SQFT" || s === "SQUARE FEET") return "SQF";
  if (s === "TNE" || s === "TON" || s === "TONS") return "TNE";
  if (s === "UNT" || s === "UNIT" || s === "UNITS") return "UNT";

  const match = UNITS.find(u => u.code === s || u.short.toUpperCase() === s || u.label.toUpperCase().includes(s));
  return match ? match.code : s;
}

function getUnitOptions(item: LineItem): { code: string; short: string; label: string }[] {
  if (!item.productId) return UNITS;
  const configured: { code: string; short: string; label: string }[] = [];
  const seen = new Set<string>();

  const addUnit = (codeOrName: string, labelStr?: string) => {
    if (!codeOrName) return;
    const norm = normalizeUnit(codeOrName);
    const existingUnit = UNITS.find(u => u.code === norm);
    const code = existingUnit ? existingUnit.code : norm;
    const short = existingUnit ? existingUnit.short : codeOrName;
    const label = labelStr || (existingUnit ? existingUnit.label : short);

    if (!seen.has(code)) {
      seen.add(code);
      configured.push({ code, short, label });
    }
  };

  if (item.unit && item.unit !== "NONE") {
    addUnit(item.unit);
  }
  if (item.baseUnit) {
    const baseName = typeof item.baseUnit === "string" ? item.baseUnit : item.baseUnit.shortName || item.baseUnit.name;
    addUnit(baseName);
  }
  (item.conversions || []).forEach((c: any) => {
    const convUnit = c.unit ? (typeof c.unit === "string" ? c.unit : c.unit.shortName || c.unit.name) : c.unitId;
    if (convUnit) addUnit(convUnit);
  });

  return configured.length > 0 ? configured : UNITS;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  productId: string;
  itemSearch: string;
  qty: number;
  unit: string;
  rate: number;
  discountPct?: number;
  discountAmount?: number;
  taxPct: number;
  taxLabel: string;
  batchNumber: string;
  remarks: string;
  baseUnit?: any;
  conversions?: any[];
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
    discountAmount: 0,
    taxPct: 0,
    taxLabel: "NONE",
    batchNumber: "",
    remarks: "",
  };
}

function computeRow(item: LineItem, withTax: boolean) {
  const gross = (item.qty || 0) * (item.rate || 0);
  const discAmt = item.discountAmount !== undefined && item.discountAmount > 0
    ? item.discountAmount
    : parseFloat((gross * (item.discountPct || 0) / 100).toFixed(2));
  const taxable = Math.max(0, gross - discAmt);
  const taxPct = item.taxPct || 0;

  if (withTax) {
    const taxAmt = parseFloat((taxable * taxPct / (100 + taxPct)).toFixed(2));
    const baseTaxable = parseFloat((taxable - taxAmt).toFixed(2));
    return { gross, discAmt, taxable: baseTaxable, taxAmt, amount: parseFloat(taxable.toFixed(2)) };
  }

  const taxAmt = parseFloat((taxable * taxPct / 100).toFixed(2));
  const lineTotal = parseFloat((taxable + taxAmt).toFixed(2));
  return { gross, discAmt, taxable, taxAmt, amount: lineTotal };
}

// A batch is dispatchable when it has passed QC, isn't under an active recall,
// hasn't expired, and still has packaged stock on hand.
function batchIsUsable(b: any) {
  const qcOk = b.qcStatus === "APPROVED" || b.qcStatus === "PARTIALLY_APPROVED";
  const notRecalled = !(b.recall && (b.recall.status === "IN_PROGRESS" || b.recall.status === "COMPLETED"));
  const notExpired = b.expiryStatus !== "EXPIRED";
  const hasStock = (b.availableQuantity || 0) > 0;
  return qcOk && notRecalled && notExpired && hasStock;
}

const isValidPhone = (v: string) => v === "" || /^\d{10}$/.test(v);

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DeliveryChallanPage() {
  const { user } = useAuth();
  const isFranchiseUser = user?.role === "FRANCHISE_ADMIN" || Boolean(user?.franchiseId);
  const franchiseBranchId = user?.franchiseId || "";

  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation State
  const [view, setView] = useState<"list" | "create" | "edit" | "transit">(searchParams.get("sourceInvoiceId") ? "create" : "list");
  const [transitStock, setTransitStock] = useState<any[]>([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [sourceInvoiceIdState, setSourceInvoiceIdState] = useState<string | null>(searchParams.get("sourceInvoiceId"));
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customers, setCustomers] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);

  // List filter state
  const [dateFilter, setDateFilter] = useState("THIS_MONTH");
  const [firmFilter, setFirmFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  });

  // Active Challan Form State
  const [destType, setDestType] = useState<"CUSTOMER" | "DEALER" | "FRANCHISE">("CUSTOMER");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedDealer, setSelectedDealer] = useState<any>(null);
  const [selectedFranchise, setSelectedFranchise] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  // Scoped to the logged-in franchise branch for franchise users, or HQ for super admins
  const [sourceFranchiseId, setSourceFranchiseId] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [challanNo, setChallanNo] = useState<string>("1");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [stateOfSupply, setStateOfSupply] = useState("");
  const [items, setItems] = useState<LineItem[]>([makeItem(), makeItem()]);
  const [priceMode, setPriceMode] = useState<"without_tax" | "with_tax">("without_tax");
  const [showPriceDrop, setShowPriceDrop] = useState(false);
  
  // Dialog drop/floating states
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [activeInputEl, setActiveInputEl] = useState<HTMLInputElement | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);

  const calculateDropdownPosition = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropWidth = Math.min(Math.max(rect.width, 380), viewportWidth - 24);

    let left = rect.left;
    if (left + dropWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - dropWidth - 12);
    }
    if (left < 12) left = 12;

    const spaceBelow = viewportHeight - rect.bottom;
    let top = rect.bottom + 6;
    let maxHeight = Math.min(340, spaceBelow - 16);

    // If tight below but plenty above, flip upwards
    if (spaceBelow < 220 && rect.top > 240) {
      maxHeight = Math.min(340, rect.top - 20);
      top = Math.max(10, rect.top - maxHeight - 6);
    } else {
      maxHeight = Math.max(160, maxHeight);
    }

    return { top, left, width: dropWidth, maxHeight };
  }, []);

  // Sync portal position on scroll and resize
  useEffect(() => {
    if (activeItemIndex === null || !activeInputEl) return;
    const updatePos = () => {
      const rect = activeInputEl.getBoundingClientRect();
      if (rect.bottom < 40 || rect.top > window.innerHeight - 40) {
        // Scrolled out of view
        setActiveItemIndex(null);
        return;
      }
      setDropdownRect(calculateDropdownPosition(activeInputEl));
    };
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [activeItemIndex, activeInputEl, calculateDropdownPosition]);

  // Close portal dropdown on click outside
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (activeItemIndex === null) return;
      if (activeInputEl && activeInputEl.contains(e.target as Node)) return;
      if (dropdownPortalRef.current && dropdownPortalRef.current.contains(e.target as Node)) return;
      setActiveItemIndex(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [activeItemIndex, activeInputEl]);

  const [openUnitDrop, setOpenUnitDrop] = useState<string | null>(null);
  const [openTaxDrop, setOpenTaxDrop] = useState<string | null>(null);
  
  // Custom Notes / Terms Fields
  const [termsText, setTermsText] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [description, setDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [showRowMenu, setShowRowMenu] = useState<string | null>(null);
  const [previewingChallan, setPreviewingChallan] = useState<any>(null);
  const [deliveringChallan, setDeliveringChallan] = useState<any>(null);
  const [returningChallan, setReturningChallan] = useState<any>(null);
  const [convertingChallan, setConvertingChallan] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const currentCompany = companyProfile || FALLBACK_COMPANY;

  // Refs for closing dropdowns
  const customerDropRef = useRef<HTMLDivElement>(null);
  const priceDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);
  const exportDropRef = useRef<HTMLDivElement>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (exportDropRef.current && !exportDropRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
      if (customerDropRef.current && !customerDropRef.current.contains(e.target as Node)) {
        setShowCustomerDrop(false);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // Guarantee franchise user cannot have destination = FRANCHISE
  useEffect(() => {
    if (isFranchiseUser && destType === "FRANCHISE") {
      setDestType("CUSTOMER");
      setSelectedFranchise(null);
      setCustomerSearch("");
    }
  }, [isFranchiseUser, destType]);

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const targetFranchise = isFranchiseUser ? franchiseBranchId : (sourceFranchiseId || undefined);
      const [cRes, dlRes, pRes, fRes, wRes, dcRes, cpRes] = await Promise.allSettled([
        customersApi.getAll(targetFranchise ? { franchiseId: targetFranchise } : {}),
        dealersApi.getAll(),
        productsFullApi.getAll(targetFranchise ? { franchiseId: targetFranchise, includeAll: false } : { includeAll: true }),
        franchiseApi.getAll(),
        inventoryApi.getWarehouses(),
        salesApi.getDeliveryChallans(targetFranchise ? { franchiseId: targetFranchise } : {}),
        settingsApi.getCompanyProfile(),
      ]);

      let apiChallans = dcRes.status === "fulfilled" ? (dcRes.value as any).data || [] : [];

      // Load from LocalStorage
      try {
        const localData = localStorage.getItem("sale_delivery_challans");
        if (localData) {
          const locals = JSON.parse(localData);
          // Filter out API duplicates if they have overlapping IDs
          const apiIds = new Set(apiChallans.map((c: any) => c.id));
          const uniqueLocals = locals.filter((l: any) => !apiIds.has(l.id));
          apiChallans = [...uniqueLocals, ...apiChallans];
        }
      } catch (e) {
        console.error("Failed to load local storage challans", e);
      }

      // Resolve lists
      const customerList = cRes.status === "fulfilled" ? (cRes.value as any).data || [] : [];
      const dealerList = dlRes.status === "fulfilled" ? (dlRes.value as any).data || [] : [];
      const franchiseList = fRes.status === "fulfilled" ? (fRes.value as any).data || [] : [];

      // Map to frontend structure
      const mappedChallans = apiChallans.map((dc: any) => {
        let name = dc.customerName;
        let phone = dc.customerPhone || "";
        if (dc.customerId) {
          const c = customerList.find((x: any) => x.id === dc.customerId);
          if (c) {
            name = c.name;
            phone = c.phone || phone;
          } else if (dc.customer) {
            name = dc.customer.name;
            phone = dc.customer.phone || phone;
          }
        } else if (dc.dealerId) {
          const dl = dealerList.find((x: any) => x.id === dc.dealerId);
          if (dl) {
            name = dl.name;
            phone = dl.phone || phone;
          } else if (dc.dealer) {
            name = dc.dealer.name;
            phone = dc.dealer.phone || phone;
          }
        } else if (dc.franchiseId) {
          const f = franchiseList.find((x: any) => x.id === dc.franchiseId);
          if (f) {
            name = f.name;
            phone = f.phone || phone;
          }
        }
        return {
          ...dc,
          status: dc.status === "OPEN" ? "IN_TRANSIT" : dc.status,
          challanNo: formatERPNumber("DC", dc.challanNo || dc.challanNumber || dc.id, dc.createdAt || dc.challanDate),
          invoiceDate: dc.invoiceDate || (dc.challanDate ? dc.challanDate.split("T")[0] : new Date().toISOString().split("T")[0]),
          dueDate: dc.dueDate ? dc.dueDate.split("T")[0] : dc.invoiceDate || new Date().toISOString().split("T")[0],
          customerName: name || "Unknown Party",
          customerPhone: phone,
          finalAmount: dc.finalAmount || dc.totalAmount || 0,
        };
      });

      setChallans(mappedChallans);
      if (cRes.status === "fulfilled") {
        const d = (cRes.value as any).data;
        setCustomers(Array.isArray(d) ? d : d?.data || []);
      }
      if (dlRes.status === "fulfilled") {
        const d = (dlRes.value as any).data;
        setDealers(Array.isArray(d) ? d : d?.data || []);
      }
      if (pRes.status === "fulfilled") {
        const d = (pRes.value as any).data;
        setProducts(Array.isArray(d) ? d : d?.data || []);
      }
      if (fRes.status === "fulfilled") {
        const d = (fRes.value as any).data;
        setFranchises(Array.isArray(d) ? d : d?.data || []);
      }
      if (wRes.status === "fulfilled") {
        const d = (wRes.value as any).data;
        setWarehouses(Array.isArray(d) ? d : d?.data || []);
      }
      if (cpRes.status === "fulfilled" && (cpRes.value as any).data) {
        setCompanyProfile((cpRes.value as any).data);
      }
      return mappedChallans;
    } finally {
      setLoading(false);
    }
  }, [isFranchiseUser, franchiseBranchId, sourceFranchiseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // For franchise users, lock to their own franchise ID.
  // For Super Admins, prefer the real HQ franchise.
  const defaultSourceFranchiseId = useCallback(() => {
    if (isFranchiseUser && franchiseBranchId) {
      return franchiseBranchId;
    }
    return franchises.find((f: any) => f.isHQ)?.id || franchises[0]?.id || "";
  }, [isFranchiseUser, franchiseBranchId, franchises]);

  // Dynamically re-fetch products when sourceFranchiseId changes
  useEffect(() => {
    if (!sourceFranchiseId) return;
    let cancelled = false;
    const isHq = !isFranchiseUser && sourceFranchiseId === defaultSourceFranchiseId();
    productsFullApi.getAll({
      franchiseId: sourceFranchiseId,
      includeAll: isHq
    }).then((res: any) => {
      if (!cancelled && res?.data) {
        const d = res.data;
        setProducts(Array.isArray(d) ? d : d?.data || []);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sourceFranchiseId, isFranchiseUser, defaultSourceFranchiseId]);

  // Transit Stock — derived from IN_TRANSIT challans server-side (see
  // SalesService.getTransitStock), not its own manual-entry page.
  useEffect(() => {
    if (view !== "transit") return;
    let cancelled = false;
    setTransitLoading(true);
    salesApi.getTransitStock().then((res: any) => {
      if (!cancelled) setTransitStock(res.data || []);
    }).catch(() => { if (!cancelled) setTransitStock([]); })
      .finally(() => { if (!cancelled) setTransitLoading(false); });
    return () => { cancelled = true; };
  }, [view]);

  // Load from Tax Invoice if creating via sourceInvoiceId
  useEffect(() => {
    if (sourceInvoiceIdState && view === "create" && !loading) {
      posApi.getOrderById(sourceInvoiceIdState).then((res: any) => {
        const order = res.data;
        if (!order) return;
        
        const pType = order.partyType || (order.customerId ? "CUSTOMER" : "UNKNOWN");
        setDestType(pType === "UNKNOWN" ? "CUSTOMER" : pType);
        
        if (pType === "CUSTOMER" && order.customer) {
          setSelectedCustomer(order.customer);
          setCustomerSearch(order.customer.name);
          setCustomerPhone(order.customer.phone || "");
        } else if (pType === "DEALER" && order.dealer) {
          setSelectedDealer(order.dealer);
          setCustomerSearch(order.dealer.name);
          setCustomerPhone(order.dealer.phone || "");
        } else if (pType === "FRANCHISE" && order.franchise) {
          setSelectedFranchise(order.franchise);
          setCustomerSearch(order.franchise.name);
          setCustomerPhone(order.franchise.phone || "");
        } else if (order.customerId) {
           // fallback if relation was not joined
           customersApi.getById(order.customerId).then((cRes: any) => {
             if (cRes.data) {
                setSelectedCustomer(cRes.data);
                setCustomerSearch(cRes.data.name);
                setCustomerPhone(cRes.data.phone || "");
             }
           });
        }
        
        setStateOfSupply(order.stateOfSupply || "");
        
        if (order.orderItems && order.orderItems.length > 0) {
          const newItems = order.orderItems.map((it: any) => {
            const taxPct = (it.taxAmount / (it.quantity * it.price)) * 100 || 0;
            return {
              id: Math.random().toString(36).slice(2),
              productId: it.productId,
              itemSearch: it.product?.name || "",
              qty: it.quantity,
              unit: it.unit || "NONE",
              rate: it.price,
              taxPct: isNaN(taxPct) ? 0 : Math.round(taxPct),
              taxLabel: isNaN(taxPct) ? "NONE" : "GST",
              batchNumber: it.batchNumber || "",
              remarks: "",
            };
          });
          setItems(newItems);
        }
      }).catch(err => {
        console.error("Failed to fetch source invoice:", err);
      });
    }
  }, [sourceInvoiceIdState, view, loading]);

  // Resume an in-progress challan after a round trip to /customers/add,
  // /franchise/dealers/add, or /franchise/add (see openQuickAdd below) —
  // those are real, separately-navigable pages (not inline modals), so
  // without this the in-progress draft would simply be lost on navigation.
  const restoredQuickAddRef = useRef(false);
  useEffect(() => {
    if (loading || restoredQuickAddRef.current) return;
    restoredQuickAddRef.current = true;
    try {
      const draftRaw = sessionStorage.getItem("dc_draft_before_quickadd");
      if (!draftRaw) return;

      const readFresh = (key: string) => {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Date.now() - parsed.at < 5 * 60 * 1000 ? parsed : null;
      };
      const newCustomer = readFresh("lastCreatedCustomer");
      const newDealer = readFresh("lastCreatedDealer");
      const newFranchise = readFresh("lastCreatedFranchise");
      if (!newCustomer && !newDealer && !newFranchise) return;

      const draft = JSON.parse(draftRaw);
      setDraftId(draft.draftId ?? null);
      setChallanNo(draft.challanNo ?? "1");
      setDestType(draft.destType ?? "CUSTOMER");
      setCustomerPhone(draft.customerPhone ?? "");
      setSourceFranchiseId(draft.sourceFranchiseId ?? "");
      setVehicleNo(draft.vehicleNo ?? "");
      setDriverName(draft.driverName ?? "");
      setInvoiceDate(draft.invoiceDate ?? new Date().toISOString().split("T")[0]);
      setDueDate(draft.dueDate ?? new Date().toISOString().split("T")[0]);
      setStateOfSupply(draft.stateOfSupply ?? "");
      setItems(draft.items ?? [makeItem(), makeItem()]);
      setPriceMode(draft.priceMode ?? "without_tax");
      setTermsText(draft.termsText ?? "");
      setShowTerms(draft.showTerms ?? false);
      setDescription(draft.description ?? "");
      setShowDesc(draft.showDesc ?? false);
      setRoundOffEnabled(draft.roundOffEnabled ?? true);

      if (newCustomer) {
        setSelectedCustomer({ id: newCustomer.id, name: newCustomer.name });
        setCustomerSearch(newCustomer.name);
      } else if (newDealer) {
        setSelectedDealer({ id: newDealer.id, name: newDealer.name });
        setCustomerSearch(newDealer.name);
      } else if (newFranchise) {
        setSelectedFranchise({ id: newFranchise.id, name: newFranchise.name });
        setCustomerSearch(newFranchise.name);
      } else {
        setCustomerSearch(draft.customerSearch ?? "");
      }

      setView("create");
    } catch (e) {
      console.error("Failed to restore delivery challan draft after quick-add", e);
    } finally {
      sessionStorage.removeItem("dc_draft_before_quickadd");
      sessionStorage.removeItem("lastCreatedCustomer");
      sessionStorage.removeItem("lastCreatedDealer");
      sessionStorage.removeItem("lastCreatedFranchise");
    }
  }, [loading]);

  // Stash the in-progress draft, then navigate to the relevant master's
  // quick-add page (which redirects back here via ?returnTo=).
  const openQuickAdd = (type: "CUSTOMER" | "DEALER" | "FRANCHISE") => {
    try {
      sessionStorage.setItem("dc_draft_before_quickadd", JSON.stringify({
        draftId, challanNo, destType, customerSearch, customerPhone, sourceFranchiseId,
        vehicleNo, driverName, invoiceDate, dueDate, stateOfSupply, items, priceMode,
        termsText, showTerms, description, showDesc, roundOffEnabled,
      }));
    } catch { /* ignore unavailable storage */ }
    const returnTo = encodeURIComponent("/sales/delivery-challan");
    if (type === "CUSTOMER") router.push(`/customers`);
    else if (type === "DEALER") router.push(`/franchise/dealers`);
    else router.push(`/franchise`);
  };

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropRef.current && !customerDropRef.current.contains(e.target as Node)) {
        setShowCustomerDrop(false);
      }
      if (priceDropRef.current && !priceDropRef.current.contains(e.target as Node)) {
        setShowPriceDrop(false);
      }
      if (shareDropRef.current && !shareDropRef.current.contains(e.target as Node)) {
        setShowShareDrop(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch batches for the currently selected source warehouse/branch whenever it
  // changes (including on entering the create/edit form), so the Batch No dropdown
  // reflects real production/finished-goods inventory instead of staying empty.
  useEffect(() => {
    if (view !== "create" && view !== "edit") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await productBatchesApi.getAll({ franchiseId: sourceFranchiseId });
        const d = (res as any).data;
        if (!cancelled) setBatches(Array.isArray(d) ? d : d?.data || []);
      } catch (e) {
        console.error("Failed to load batches", e);
        if (!cancelled) setBatches([]);
      }
    })();
    return () => { cancelled = true; };
  }, [view, sourceFranchiseId]);

  // Keep each row's batch selection valid for the current source warehouse: drop it if
  // it's no longer usable there, and auto-pick the single valid batch when there's only one.
  useEffect(() => {
    setItems(prev => prev.map(it => {
      if (!it.productId) return it;
      const valid = batches.filter(b => b.productId === it.productId && b.franchiseId === sourceFranchiseId && batchIsUsable(b));
      const stillValid = valid.some(b => (b.batchCode || b.id) === it.batchNumber);
      if (stillValid) return it;
      return { ...it, batchNumber: valid.length === 1 ? (valid[0].batchCode || valid[0].id) : "" };
    }));
  }, [batches, sourceFranchiseId]);

  // ── Calculations ────────────────────────────────────────────────────────────

  const withTax = priceMode === "with_tax";
  const rowData = items.map(item => ({ item, ...computeRow(item, withTax) }));

  // Batches for a product at the current source warehouse that are actually dispatchable.
  const getValidBatches = (productId: string) =>
    batches.filter(b => b.productId === productId && b.franchiseId === sourceFranchiseId && batchIsUsable(b));
  // A product is "batch-controlled" if production has ever recorded a batch for it at
  // this warehouse — such items must have a batch selected before the challan can save.
  const isBatchControlled = (productId: string) =>
    batches.some(b => b.productId === productId && b.franchiseId === sourceFranchiseId);
  // A product is batch-controlled SOMEWHERE (any franchise) but not usable
  // here — that's the "not dispatchable from this location" case the item
  // search should hide. A product with no batch records anywhere is simply
  // not batch-tracked at all and stays searchable everywhere (e.g. a
  // packaging item dispatched without a production batch).
  const isDispatchableHere = (productId: string) =>
    !batches.some(b => b.productId === productId) || getValidBatches(productId).length > 0;
  
  // Rows with no item selected yet don't count toward the total — otherwise blank
  // rows (which default to qty 1) inflate Total Qty before a product is even picked.
  const calcResult = calculateSalesDocumentTotals(items, priceMode, roundOffEnabled);
  const totalQty = items.reduce((s, i) => s + (i.itemSearch.trim() !== "" ? (Number(i.qty) || 0) : 0), 0);
  const subTotal = calcResult.subTotal;
  const totalDisc = calcResult.totalDiscount;
  const totalTax = calcResult.totalTax;
  const totalBeforeRound = calcResult.totalBeforeRound;
  const roundOff = calcResult.roundOff;
  const finalTotal = calcResult.finalTotal;

  // Auto-increment Challan Number
  useEffect(() => {
    if (view === "create" && !draftId) {
      const numericNos = challans
        .map(c => parseInt(c.challanNo))
        .filter(n => !isNaN(n));
      const nextNo = numericNos.length > 0 ? Math.max(...numericNos) + 1 : 1;
      setChallanNo(String(nextNo));
    }
  }, [view, challans, draftId]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const selectCustomer = (c: any) => {
    if (destType === "CUSTOMER") {
      setSelectedCustomer(c);
    } else if (destType === "DEALER") {
      setSelectedDealer(c);
    } else {
      setSelectedFranchise(c);
    }
    setCustomerSearch(c.name);
    setCustomerPhone(c.phone || "");
    setShowCustomerDrop(false);
  };

  // Channel prices default to 0 (unconfigured, not "genuinely free") on
  // items that predate these fields — only a positive value counts as
  // configured, otherwise fall back to the generic base price. destType
  // maps 1:1 to the channel since a DC's destination is mutually
  // exclusive (customerId/dealerId/franchiseId). Mirrors pos/page.tsx's
  // getPrice().
  const getChannelPrice = (p: any, type: "CUSTOMER" | "DEALER" | "FRANCHISE") => {
    if (type === "DEALER" && p.dealerPrice > 0) return p.dealerPrice;
    if (type === "FRANCHISE" && p.franchisePrice > 0) return p.franchisePrice;
    if (p.customerPrice > 0) return p.customerPrice;
    return p.basePrice || p.price || 0;
  };

  const selectProduct = (idx: number, p: any) => {
    const validBatches = getValidBatches(p.id);
    const autoBatch = validBatches.length === 1 ? (validBatches[0].batchCode || validBatches[0].id) : "";
    const rawUnit = p.unit || (p.baseUnit ? (typeof p.baseUnit === 'string' ? p.baseUnit : p.baseUnit.shortName || p.baseUnit.name) : "NONE");
    const normalizedUnit = normalizeUnit(rawUnit);
    setItems(prev => prev.map((it, i) =>
      i === idx ? {
        ...it,
        productId: p.id,
        itemSearch: p.name,
        rate: getChannelPrice(p, destType),
        unit: normalizedUnit,
        taxPct: p.taxPercent || 0,
        taxLabel: TAX_OPTIONS.find(o => o.value === (p.taxPercent || 0))?.label || "NONE",
        batchNumber: autoBatch,
        baseUnit: p.baseUnit || p.unit,
        conversions: p.unitConversions || p.conversions || [],
      } : it
    ));
    setActiveItemIndex(null);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      const gross = (updated.qty || 0) * (updated.rate || 0);

      if (field === "discountPct") {
        const pct = Number(value) || 0;
        updated.discountPct = pct;
        updated.discountAmount = gross > 0 ? parseFloat((gross * pct / 100).toFixed(2)) : 0;
      } else if (field === "discountAmount") {
        const amt = Number(value) || 0;
        updated.discountAmount = amt;
        updated.discountPct = gross > 0 ? parseFloat(((amt / gross) * 100).toFixed(2)) : 0;
      } else if (field === "qty" || field === "rate") {
        if (updated.discountPct) {
          updated.discountAmount = parseFloat((gross * updated.discountPct / 100).toFixed(2));
        }
      }
      return updated;
    }));
  };

  // Line items are priced at selection-time; if the destination type
  // changes after items are already picked, re-derive each line's rate
  // against the newly selected channel so the form never shows a stale
  // Customer rate while Dealer/Franchise is now the destination.
  useEffect(() => {
    if (!products.length) return;
    setItems(prev => prev.map(it => {
      if (!it.productId) return it;
      const p = products.find((pr: any) => pr.id === it.productId);
      if (!p) return it;
      const rate = getChannelPrice(p, destType);
      if (rate === it.rate) return it;
      const updated = { ...it, rate };
      if (updated.discountPct) {
        const gross = (updated.qty || 0) * rate;
        updated.discountAmount = parseFloat((gross * updated.discountPct / 100).toFixed(2));
      }
      return updated;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destType, products]);

  const addRow = () => setItems(prev => [...prev, makeItem()]);

  const removeRow = (idx: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== idx));
    } else {
      setItems([makeItem()]);
    }
  };



  // Sync source warehouse to branch for franchise users or default for super admins
  useEffect(() => {
    if (isFranchiseUser && franchiseBranchId) {
      if (sourceFranchiseId !== franchiseBranchId) {
        setSourceFranchiseId(franchiseBranchId);
      }
    } else if (!sourceFranchiseId && franchises.length > 0) {
      setSourceFranchiseId(defaultSourceFranchiseId());
    }
  }, [isFranchiseUser, franchiseBranchId, franchises, sourceFranchiseId, defaultSourceFranchiseId]);

  const resetForm = () => {
    setDraftId(null);
    setIdempotencyKey(crypto.randomUUID());
    setSourceInvoiceIdState(null);
    setSelectedCustomer(null);
    setSelectedDealer(null);
    setSelectedFranchise(null);
    setCustomerSearch("");
    setCustomerPhone("");
    setSourceFranchiseId(defaultSourceFranchiseId());
    setVehicleNo("");
    setDriverName("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate(new Date().toISOString().split("T")[0]);
    setStateOfSupply("");
    setItems([makeItem(), makeItem()]);
    setPriceMode("without_tax");
    setTermsText("");
    setShowTerms(false);
    setDescription("");
    setShowDesc(false);
    setRoundOffEnabled(true);
  };

  const handleSave = async (status: "DRAFT" | "IN_TRANSIT") => {
    // Security check: Franchise users cannot create Delivery Challans for Franchise destinations
    if (isFranchiseUser && destType === "FRANCHISE") {
      showToast("Franchise destination is not permitted for Franchise portal.", "error");
      return;
    }

    // Applies to both Save Draft and Save Challan, and whether the number was typed
    // or auto-filled from the selected customer/franchise record.
    if (!isValidPhone(customerPhone)) {
      showToast("Enter a valid 10-digit mobile number.", "error");
      return;
    }
    if (destType === "CUSTOMER" && !selectedCustomer && status === "IN_TRANSIT") {
      showToast("Please select a customer", "error");
      return;
    }
    if (destType === "DEALER" && !selectedDealer && status === "IN_TRANSIT") {
      showToast("Please select a dealer", "error");
      return;
    }
    if (destType === "FRANCHISE" && !selectedFranchise && status === "IN_TRANSIT") {
      showToast("Please select a franchise destination", "error");
      return;
    }
    const validItems = items.filter(it => it.itemSearch.trim() !== "" && it.qty > 0);
    if (validItems.length === 0 && status === "IN_TRANSIT") {
      showToast("Add at least one item with valid quantity", "error");
      return;
    }


    setSaving(true);
    const apiPayload = {
      // Explicit null (not undefined) for the two inactive destination
      // fields — undefined gets dropped by JSON serialization entirely,
      // which on an update would leave a stale customerId/dealerId/
      // franchiseId in place from before a destination-type switch instead
      // of actually clearing it.
      customerId: destType === "CUSTOMER" ? (selectedCustomer?.id || null) : null,
      dealerId: destType === "DEALER" ? (selectedDealer?.id || null) : null,
      franchiseId: destType === "FRANCHISE" ? (selectedFranchise?.id || null) : null,
      sourceFranchiseId,
      sourceInvoiceId: sourceInvoiceIdState || undefined,
      vehicleNo: vehicleNo || undefined,
      driverName: driverName || undefined,
      status,
      challanDate: invoiceDate,
      dueDate,
      stateOfSupply: stateOfSupply || undefined,
      termsConditions: termsText || undefined,
      notes: description || undefined,
      items: validItems.map(it => {
        const gross = (it.qty || 0) * (it.rate || 0);
        const discAmt = it.discountAmount !== undefined && it.discountAmount > 0
          ? it.discountAmount
          : parseFloat((gross * (it.discountPct || 0) / 100).toFixed(2));
        const discPct = it.discountPct !== undefined && it.discountPct > 0
          ? it.discountPct
          : gross > 0 ? parseFloat(((discAmt / gross) * 100).toFixed(2)) : 0;
        return {
          productId: it.productId || undefined,
          productName: it.itemSearch,
          batchNumber: it.batchNumber || undefined,
          quantity: it.qty,
          unit: it.unit,
          rate: it.rate,
          discountPercent: discPct,
          discountPct: discPct,
          discountAmount: discAmt,
          discount: discAmt,
          taxPercent: it.taxPct,
        };
      }),
    };

    try {
      let res: any = null;
      if (draftId) {
        res = await salesApi.updateDeliveryChallan(draftId, apiPayload);
        showToast("Delivery Challan updated successfully", "success");
      } else {
        res = await salesApi.createDeliveryChallan({ ...apiPayload, idempotencyKey });
        showToast("Delivery Challan saved successfully", "success");
      }
      const list = await fetchData();
      if (status === "IN_TRANSIT") {
        const targetId = res?.data?.id || res?.data?._id || draftId;
        const matched = Array.isArray(list) ? list.find((x: any) => x.id === targetId || x._id === targetId) : null;
        setPreviewingChallan(matched || res?.data);
      }
      setView("list");
      resetForm();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Error saving Delivery Challan", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (dc: any) => {
    setDraftId(dc.id);
    setChallanNo(dc.challanNo);
    const raw = dc._rawState || {};
    
    // Resolve destination type
    if (dc.franchiseId) {
      setDestType("FRANCHISE");
      const f = franchises.find(x => x.id === dc.franchiseId);
      setSelectedFranchise(f || null);
      setSelectedCustomer(null);
      setSelectedDealer(null);
    } else if (dc.dealerId) {
      setDestType("DEALER");
      const dl = dealers.find(x => x.id === dc.dealerId);
      setSelectedDealer(dl || null);
      setSelectedCustomer(null);
      setSelectedFranchise(null);
    } else {
      setDestType("CUSTOMER");
      const c = customers.find(x => x.id === dc.customerId);
      setSelectedCustomer(c || null);
      setSelectedDealer(null);
      setSelectedFranchise(null);
    }

    setCustomerSearch(raw.customerSearch || dc.customerName);
    setCustomerPhone(raw.customerPhone || dc.customerPhone || "");
    setVehicleNo(raw.vehicleNo || dc.vehicleNo || "");
    setDriverName(raw.driverName || dc.driverName || "");
    setSourceFranchiseId(raw.sourceFranchiseId || dc.sourceFranchiseId || defaultSourceFranchiseId());
    setInvoiceDate(raw.invoiceDate || dc.invoiceDate);
    setDueDate(raw.dueDate || dc.dueDate);
    setStateOfSupply(raw.stateOfSupply || dc.stateOfSupply || "");
    setPriceMode(raw.priceMode || "without_tax");
    setTermsText(raw.termsText || "");
    setShowTerms(raw.showTerms || !!raw.termsText);
    setDescription(raw.description || dc.remarks || "");
    setShowDesc(raw.showDesc || !!raw.description || !!dc.remarks);
    setRoundOffEnabled(raw.roundOffEnabled ?? true);
    
    if (raw.items && raw.items.length > 0) {
      setItems(raw.items);
    } else if (dc.items && dc.items.length > 0) {
      const parentDiscount = Number(dc.discountAmount ?? dc.discount ?? 0);
      const totalGross = dc.items.reduce((s: number, i: any) => {
        const q = Number(i.quantity ?? i.qty ?? 1);
        const r = Number(i.rate ?? i.unitPrice ?? 0);
        return s + (q * r);
      }, 0);
      const hasExplicitItemDiscounts = dc.items.some((i: any) => Number(i.discountAmount ?? i.discount ?? i.discountPct ?? i.discountPercent ?? 0) > 0);

      setItems(dc.items.map((it: any) => {
        const taxPct = Number(it.taxPercent ?? it.taxPct ?? 0);
        const qty = Number(it.quantity ?? it.qty ?? 1);
        const rate = Number(it.rate ?? it.unitPrice ?? 0);
        const gross = qty * rate;

        let discAmt = Number(it.discountAmount ?? it.discount ?? 0);
        let discPct = Number(it.discountPercent ?? it.discountPct ?? 0);

        if (!hasExplicitItemDiscounts && parentDiscount > 0 && totalGross > 0) {
          discAmt = parseFloat((parentDiscount * (gross / totalGross)).toFixed(2));
          discPct = gross > 0 ? parseFloat(((discAmt / gross) * 100).toFixed(2)) : 0;
        } else if (!discPct && gross > 0 && discAmt > 0) {
          discPct = parseFloat(((discAmt / gross) * 100).toFixed(2));
        }

        const calculatedDiscAmt = discAmt || (discPct > 0 ? parseFloat((gross * discPct / 100).toFixed(2)) : 0);
        return {
          id: it.id || Math.random().toString(36).slice(2),
          productId: it.productId || "",
          itemSearch: it.productName || it.description || "",
          qty,
          unit: it.unit || "NONE",
          rate,
          discountPct: discPct,
          discountAmount: calculatedDiscAmt,
          taxPct,
          taxLabel: TAX_OPTIONS.find(o => o.value === taxPct)?.label || "NONE",
          batchNumber: it.batchNumber || "",
          remarks: it.remarks || "",
        };
      }));
    } else {
      setItems([makeItem()]);
    }
    
    setView("edit");
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Delivery Challan?")) return;
    try {
      const localData = localStorage.getItem("sale_delivery_challans");
      if (localData) {
        let locals = JSON.parse(localData);
        locals = locals.filter((x: any) => x.id !== id);
        localStorage.setItem("sale_delivery_challans", JSON.stringify(locals));
      }
      showToast("Challan deleted successfully", "success");
      fetchData();
    } catch (e) {
      showToast("Failed to delete challan", "error");
    }
  };

  const convertToSale = async (dc: any) => {
    try {
      const res = await salesApi.convertDeliveryChallanToSale(dc.id);
      showToast(`Challan #${dc.challanNo} successfully converted to Sale!`, "success");
      fetchData();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Conversion failed", "error");
    }
  };

  // ── Filters & Formatting ─────────────────────────────────────────────────────

  const getFilteredChallans = () => {
    return challans.filter(dc => {
      const matchSearch = !search ||
        dc.challanNo.toLowerCase().includes(search.toLowerCase()) ||
        dc.customerName.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "ALL" || dc.status === statusFilter;
      
      // Date filter
      let matchDate = true;
      if (dateFilter === "THIS_MONTH") {
        const d = new Date(dc.invoiceDate);
        const now = new Date();
        matchDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (dateFilter === "TODAY") {
        matchDate = dc.invoiceDate === new Date().toISOString().split("T")[0];
      } else if (dateFilter === "CUSTOM") {
        matchDate = dc.invoiceDate >= dateFrom && dc.invoiceDate <= dateTo;
      }
      
      return matchSearch && matchStatus && matchDate;
    });
  };

  const filteredChallans = getFilteredChallans();

  const filteredCustomers = customers.filter(c => {
    if (isFranchiseUser && c.franchiseId && c.franchiseId !== franchiseBranchId) return false;
    return (
      !customerSearch ||
      c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone?.includes(customerSearch)
    );
  });

  const filteredDealers = dealers.filter(d =>
    !customerSearch ||
    d.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    d.phone?.includes(customerSearch)
  );

  const filteredFranchisesForDest = franchises.filter(f =>
    !customerSearch || f.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Which destination-master list backs the picker dropdown for the
  // currently selected destination type.
  const destinationOptions = destType === "CUSTOMER" ? filteredCustomers
    : destType === "DEALER" ? filteredDealers
    : filteredFranchisesForDest;

  const stats = {
    total: challans.length,
    inTransit: challans.filter(d => d.status === "IN_TRANSIT").length,
    closed: challans.filter(d => d.status === "CLOSED").length,
    converted: challans.filter(d => d.status === "CONVERTED").length,
    draft: challans.filter(d => d.status === "DRAFT").length,
  };

  const handleExportExcel = () => {
    setExportDropdownOpen(false);
    const headers = ["Date", "Party", "Challan No", "Due Date", "Amount", "Status"];
    const rows = [
      ["DELIVERY CHALLAN REPORT"],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      headers,
      ...filteredChallans.map((dc: any) => [
        formatDate(dc.invoiceDate),
        dc.customerName || "—",
        `#${dc.challanNo}`,
        formatDate(dc.dueDate),
        `₹${Number(dc.finalAmount || 0).toFixed(2)}`,
        STATUS_STYLES[dc.status]?.label || dc.status,
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Delivery_Challans_${new Date().toISOString().split("T")[0]}.csv`);
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
    const tableRows = filteredChallans.map((dc: any) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(dc.invoiceDate)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${dc.customerName || "—"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold; color: #f58220;">#${dc.challanNo}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(dc.dueDate)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₹${Number(dc.finalAmount || 0).toFixed(2)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${STATUS_STYLES[dc.status]?.label || dc.status}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Delivery Challans Summary — ${new Date().toLocaleDateString()}</title>
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
          <h1>DELIVERY CHALLANS REGISTRY</h1>
          <p>Generated on ${new Date().toLocaleString()} | Dispatch & Logistics</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Party</th>
                <th>Challan No</th>
                <th>Due Date</th>
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

  // ════════════════════════════════════════════════════════════════════════════
  // 1. FORM VIEW (Screen 2 Layout - Full Page Creation View)
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "create" || view === "edit") {
    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0 overflow-x-hidden" style={{ minHeight: "calc(100vh - 80px)" }}>
        {/* Top bar */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-2xs w-full min-w-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                setView("list");
                resetForm();
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 transition-colors shrink-0"
              title="Back to Challans"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                {view === "create" ? "Add Delivery Challan" : `Edit Challan #${challanNo}`}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                {isFranchiseUser ? "Create challan for Customer or Dealer dispatch" : "Issue and dispatch goods to recipient"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isFranchiseUser && (
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
                Franchise Portal
              </span>
            )}
            <span className="text-xs font-mono text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/10">
              DC #{challanNo}
            </span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-5 custom-scrollbar w-full max-w-7xl mx-auto min-w-0">

          {/* 1. DESTINATION SECTION */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-slate-200">Destination &amp; Recipient</span>
              </div>
              <span className="text-[11px] text-gray-400 dark:text-slate-500">* Required</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-2">
                  Destination Type <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDestType("CUSTOMER");
                      setCustomerSearch("");
                      setSelectedCustomer(null);
                      setSelectedDealer(null);
                      setSelectedFranchise(null);
                    }}
                    className={clsx(
                      "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 border",
                      destType === "CUSTOMER"
                        ? "bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-300 shadow-2xs"
                        : "bg-white dark:bg-[#13151f] border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:border-gray-300"
                    )}
                  >
                    <span className={clsx("w-2 h-2 rounded-full", destType === "CUSTOMER" ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600")} />
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDestType("DEALER");
                      setCustomerSearch("");
                      setSelectedCustomer(null);
                      setSelectedDealer(null);
                      setSelectedFranchise(null);
                    }}
                    className={clsx(
                      "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 border",
                      destType === "DEALER"
                        ? "bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-300 shadow-2xs"
                        : "bg-white dark:bg-[#13151f] border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:border-gray-300"
                    )}
                  >
                    <span className={clsx("w-2 h-2 rounded-full", destType === "DEALER" ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600")} />
                    Dealer
                  </button>
                  {!isFranchiseUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setDestType("FRANCHISE");
                        setCustomerSearch("");
                        setSelectedCustomer(null);
                        setSelectedDealer(null);
                        setSelectedFranchise(null);
                      }}
                      className={clsx(
                        "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 border",
                        destType === "FRANCHISE"
                          ? "bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-300 shadow-2xs"
                          : "bg-white dark:bg-[#13151f] border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:border-gray-300"
                      )}
                    >
                      <span className={clsx("w-2 h-2 rounded-full", destType === "FRANCHISE" ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600")} />
                      Franchise
                    </button>
                  )}
                </div>
              </div>

              {/* Recipient Search Input */}
              <div className="relative" ref={customerDropRef}>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">
                  {destType === "CUSTOMER" ? "Customer" : destType === "DEALER" ? "Dealer" : "Franchise Branch"} <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className={clsx(
                      "flex-1 flex items-center gap-2 border rounded-xl px-3.5 py-2.5 bg-white dark:bg-[#13151f] transition-all cursor-pointer",
                      showCustomerDrop ? "border-orange-400 ring-2 ring-orange-100 dark:ring-orange-500/10" : "border-gray-300 dark:border-white/10 hover:border-gray-400"
                    )}
                    onClick={() => setShowCustomerDrop(v => !v)}
                  >
                    <Search size={16} className="text-gray-400 dark:text-slate-500 shrink-0" />
                    <input
                      className="flex-1 text-xs sm:text-sm text-gray-800 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder-slate-500"
                      placeholder={`Search / select ${destType === "CUSTOMER" ? "customer" : destType === "DEALER" ? "dealer" : "franchise"}...`}
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                      onClick={e => { e.stopPropagation(); setShowCustomerDrop(true); }}
                    />
                    {customerSearch && (
                      <X
                        size={15}
                        className="text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomerSearch("");
                          setSelectedCustomer(null);
                          setSelectedDealer(null);
                          setSelectedFranchise(null);
                        }}
                      />
                    )}
                    <ChevronDown size={15} className="text-gray-400 dark:text-slate-500 shrink-0" />
                  </div>
                  <button
                    type="button"
                    onClick={() => openQuickAdd(destType)}
                    title={`Create new ${destType === "CUSTOMER" ? "Customer" : destType === "DEALER" ? "Dealer" : "Franchise"}`}
                    className="shrink-0 px-3.5 py-2.5 border border-gray-300 dark:border-white/10 hover:border-orange-400 rounded-xl text-gray-600 dark:text-slate-300 hover:text-orange-500 bg-white dark:bg-[#13151f] transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-semibold"
                  >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Add {destType === "CUSTOMER" ? "Customer" : destType === "DEALER" ? "Dealer" : "Franchise"}</span>
                  </button>
                </div>

                {showCustomerDrop && (
                  <div className="absolute top-full left-0 z-50 mt-1.5 w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-gray-50 dark:divide-white/5">
                      {destinationOptions.length === 0 ? (
                        <div className="px-4 py-5 text-xs text-gray-400 dark:text-slate-500 text-center">
                          No {destType.toLowerCase()}s found matching &quot;{customerSearch}&quot;
                        </div>
                      ) : destinationOptions.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50/70 dark:hover:bg-white/5 text-left transition-colors"
                          onClick={() => selectCustomer(c)}
                        >
                          <div>
                            <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">{c.name}</div>
                            <div className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5 flex items-center gap-3">
                              {c.phone && <span>Phone: <strong className="font-mono text-gray-600 dark:text-slate-300">{c.phone}</strong></span>}
                              {c.email && <span>{c.email}</span>}
                              {c.state && <span>State: {c.state}</span>}
                            </div>
                          </div>
                          <div className="text-xs text-orange-500 font-semibold shrink-0">Select</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. DELIVERY DETAILS SECTION */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-slate-200">Delivery Details</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">Phone</label>
                <input
                  className={clsx(
                    "w-full border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 dark:text-white outline-none bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder-slate-500 transition-colors",
                    customerPhone && !isValidPhone(customerPhone) ? "border-red-400 focus:border-red-500" : "border-gray-300 dark:border-white/10 focus:border-orange-400"
                  )}
                  placeholder="10-digit phone number"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
                {customerPhone && !isValidPhone(customerPhone) && (
                  <p className="text-[11px] text-red-500 mt-1">Enter a valid 10-digit mobile number.</p>
                )}
              </div>

              {/* Source Warehouse */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">Source Warehouse</label>
                {isFranchiseUser ? (
                  <div className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 dark:bg-white/[0.03] text-gray-700 dark:text-slate-200 flex items-center justify-between">
                    <span className="truncate font-medium">
                      {franchises.find((f: any) => f.id === sourceFranchiseId)?.name || "Current Branch"}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded shrink-0">
                      Branch
                    </span>
                  </div>
                ) : (
                  <select
                    value={sourceFranchiseId}
                    onChange={e => setSourceFranchiseId(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]"
                  >
                    {franchises.length === 0 && <option value="" disabled>Loading warehouses…</option>}
                    {franchises.map((f: any) => {
                      const primaryWarehouse = warehouses.find((w: any) => w.id === f.primaryWarehouseId);
                      return (
                        <option key={f.id} value={f.id}>
                          {primaryWarehouse ? `${primaryWarehouse.name} — ${f.name}` : f.name}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Challan Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">Challan Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">Due Date</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>

              {/* State of Supply */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">State of Supply</label>
                <select
                  value={stateOfSupply}
                  onChange={e => setStateOfSupply(e.target.value)}
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]"
                >
                  <option value="">Select state...</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Vehicle Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">Vehicle Number</label>
                <input
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder-slate-500"
                  placeholder="e.g. MH 12 AB 1234"
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                />
              </div>

              {/* Driver Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1.5">Driver Name</label>
                <input
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder-slate-500"
                  placeholder="Driver Name"
                  value={driverName}
                  onChange={e => setDriverName(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 3. ITEMS SECTION */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs space-y-0">
            <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-slate-200">Items &amp; Dispatch</span>
                <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">({items.length} line{items.length === 1 ? "" : "s"})</span>
              </div>
              <button
                type="button"
                onClick={() => setPriceMode(priceMode === "without_tax" ? "with_tax" : "without_tax")}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-white/10 rounded-xl px-3 py-1.5 bg-white dark:bg-[#13151f] hover:border-gray-400 transition-colors shadow-2xs"
              >
                Price: <span className="text-orange-600 dark:text-orange-400">{priceMode === "without_tax" ? "Excl. Tax" : "Incl. Tax"}</span>
              </button>
            </div>

            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[940px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 font-semibold text-xs border-b border-gray-200 dark:border-white/5 uppercase">
                    <th rowSpan={2} className="text-center px-3 py-2.5 w-10 align-middle">#</th>
                    <th rowSpan={2} className="text-left px-3 py-2.5 align-middle min-w-[280px]">Product</th>

                    <th rowSpan={2} className="text-center px-2 py-2.5 min-w-[75px] w-[80px] align-middle">Quantity</th>
                    <th rowSpan={2} className="text-center px-2 py-2.5 min-w-[85px] w-[95px] align-middle">Unit</th>
                    <th rowSpan={2} className="text-right px-2 py-2.5 min-w-[95px] w-[105px] align-middle">Price</th>
                    <th colSpan={2} className="text-center px-2 py-1.5 border-b border-gray-200 dark:border-white/5">Discount</th>
                    <th rowSpan={2} className="text-center px-2 py-2.5 min-w-[100px] w-[105px] align-middle">Tax</th>
                    <th rowSpan={2} className="text-right px-3 py-2.5 min-w-[105px] w-[115px] align-middle">Amount</th>
                    <th rowSpan={2} className="w-10 align-middle"></th>
                  </tr>
                  <tr className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 font-semibold text-[10px] border-b border-gray-200 dark:border-white/5 uppercase">
                    <th className="text-center px-1.5 py-1 min-w-[60px] w-[65px]">%</th>
                    <th className="text-right px-2 py-1 min-w-[85px] w-[90px]">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {items.map((it, idx) => {
                    const comp = computeRow(it, withTax);
                    const isCurrentActiveRow = activeItemIndex === idx;

                    return (
                      <tr key={it.id} className={clsx("transition-colors group", isCurrentActiveRow ? "bg-orange-50/30 dark:bg-orange-500/5" : "hover:bg-gray-50/40 dark:hover:bg-white/[0.02]")}>
                        {/* Row Index */}
                        <td className="px-3 py-3 text-center text-xs text-gray-400 dark:text-slate-500 align-top font-medium">
                          {idx + 1}
                        </td>

                        {/* Product Column */}
                        <td className="px-3 py-2.5 align-top min-w-[280px]">
                          <div className="relative">
                            <input
                              value={it.itemSearch}
                              onFocus={(e) => {
                                setActiveItemIndex(idx);
                                setActiveInputEl(e.currentTarget);
                                setDropdownRect(calculateDropdownPosition(e.currentTarget));
                              }}
                              onClick={(e) => {
                                setActiveItemIndex(idx);
                                setActiveInputEl(e.currentTarget);
                                setDropdownRect(calculateDropdownPosition(e.currentTarget));
                              }}
                              onChange={(e) => {
                                updateItem(idx, "itemSearch", e.target.value);
                                if (!e.target.value) {
                                  updateItem(idx, "productId", "");
                                }
                                setActiveItemIndex(idx);
                                setActiveInputEl(e.currentTarget);
                                setDropdownRect(calculateDropdownPosition(e.currentTarget));
                              }}
                              placeholder="Search product by name or SKU..."
                              className="w-full text-xs sm:text-sm text-gray-800 dark:text-white outline-none bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 focus:border-orange-500 placeholder-gray-400 dark:placeholder-slate-500 pr-7 transition-colors shadow-2xs"
                            />
                            {it.itemSearch && (
                              <X 
                                size={14} 
                                className="absolute right-2 top-2.5 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0" 
                                onClick={() => {
                                  updateItem(idx, "itemSearch", "");
                                  updateItem(idx, "productId", "");
                                  setActiveItemIndex(null);
                                }} 
                              />
                            )}
                          </div>

                          {it.productId && (
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                              <span className="font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-gray-600 dark:text-slate-300 font-medium">
                                SKU: {products.find(p => p.id === it.productId)?.sku || "—"}
                              </span>
                            </div>
                          )}

                          <input
                            value={it.remarks}
                            onChange={e => updateItem(idx, "remarks", e.target.value)}
                            placeholder="Optional line notes..."
                            className="w-full text-[11px] text-gray-400 dark:text-slate-500 outline-none bg-transparent mt-1 focus:text-gray-700 dark:focus:text-slate-200"
                          />
                        </td>


                        {/* Quantity */}
                        <td className="px-2 py-2.5 align-top min-w-[75px]">
                          <input
                            type="number"
                            min={0}
                            value={it.qty}
                            onChange={e => updateItem(idx, "qty", Number(e.target.value) || 0)}
                            className="w-full text-xs sm:text-sm text-center outline-none bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:border-orange-500 text-gray-800 dark:text-white font-mono shadow-2xs"
                          />
                        </td>

                        {/* Unit */}
                        <td className="px-2 py-2.5 align-top min-w-[85px]">
                          <select
                            value={it.unit}
                            onChange={e => updateItem(idx, "unit", e.target.value)}
                            className="w-full text-xs text-gray-700 dark:text-white bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-1.5 py-1.5 outline-none focus:border-orange-500 cursor-pointer text-center shadow-2xs"
                          >
                            {getUnitOptions(it).map(u => (
                              <option key={u.code} value={u.code} className="dark:bg-card">{u.short}</option>
                            ))}
                          </select>
                        </td>

                        {/* Price */}
                        <td className="px-2 py-2.5 align-top min-w-[95px]">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.rate || ""}
                            onChange={e => updateItem(idx, "rate", Number(e.target.value) || 0)}
                            className="w-full text-xs sm:text-sm text-right outline-none bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:border-orange-500 text-gray-800 dark:text-white font-mono shadow-2xs"
                            placeholder="0.00"
                          />
                        </td>

                        {/* Discount */}
                        <td className="px-1.5 py-2.5 align-top min-w-[60px]">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={it.discountPct || ""}
                            onChange={e => updateItem(idx, "discountPct", Number(e.target.value))}
                            placeholder="0"
                            className="w-full text-xs text-center outline-none bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-1 py-1.5 focus:border-orange-500 text-gray-700 dark:text-white font-mono shadow-2xs"
                          />
                        </td>
                        <td className="px-2 py-2.5 align-top min-w-[85px]">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.discountAmount || ""}
                            onChange={e => updateItem(idx, "discountAmount", Number(e.target.value))}
                            placeholder="0.00"
                            className="w-full text-xs text-right outline-none bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 focus:border-orange-500 text-gray-700 dark:text-white font-mono shadow-2xs"
                          />
                        </td>

                        {/* Tax */}
                        <td className="px-2 py-2.5 align-top min-w-[100px]">
                          <select
                            value={it.taxPct}
                            onChange={e => {
                              const val = Number(e.target.value);
                              const opt = TAX_OPTIONS.find(x => x.value === val);
                              updateItem(idx, "taxPct", val);
                              updateItem(idx, "taxLabel", opt?.label || "NONE");
                            }}
                            className="w-full text-xs text-gray-700 dark:text-white bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-1.5 py-1.5 outline-none focus:border-orange-500 cursor-pointer text-center shadow-2xs"
                          >
                            {TAX_OPTIONS.map(t => (
                              <option key={t.label} value={t.value} className="dark:bg-card">{t.label}</option>
                            ))}
                          </select>
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-3 align-top text-right text-xs sm:text-sm font-bold text-gray-900 dark:text-white font-mono whitespace-nowrap min-w-[105px]">
                          ₹{comp.amount.toFixed(2)}
                        </td>

                        {/* Delete action */}
                        <td className="px-2 py-3 text-center align-top w-10">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 sm:px-6 py-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/40 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 border border-orange-200 dark:border-orange-500/20 hover:border-orange-300 px-3.5 py-2 rounded-xl transition-colors bg-white dark:bg-[#13151f] shadow-2xs"
              >
                <Plus className="h-4 w-4" /> Add Row
              </button>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Total Qty: <span className="font-bold text-gray-800 dark:text-slate-200 font-mono text-sm">{totalQty}</span>
              </span>
            </div>
          </div>

          {/* 4. TERMS & SUMMARY SECTION */}
          <div className="flex flex-col lg:flex-row gap-5 items-stretch lg:items-start pb-4 w-full min-w-0">
            {/* Notes & Terms */}
            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTerms(v => !v)}
                  className={clsx(
                    "flex items-center gap-2 text-xs font-semibold border rounded-xl px-3.5 py-2 transition-colors",
                    showTerms
                      ? "border-orange-300 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      : "border-gray-200 dark:border-white/10 bg-white dark:bg-card text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" /> Terms &amp; Conditions
                </button>
                <button
                  type="button"
                  onClick={() => setShowDesc(v => !v)}
                  className={clsx(
                    "flex items-center gap-2 text-xs font-semibold border rounded-xl px-3.5 py-2 transition-colors",
                    showDesc
                      ? "border-orange-300 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      : "border-gray-200 dark:border-white/10 bg-white dark:bg-card text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" /> Remarks / Description
                </button>
              </div>

              {showTerms && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">Terms &amp; Conditions</label>
                  <textarea
                    rows={3}
                    value={termsText}
                    onChange={e => setTermsText(e.target.value)}
                    placeholder="Enter delivery terms &amp; conditions..."
                    className="w-full text-xs text-gray-800 dark:text-white border border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] rounded-xl px-3.5 py-2.5 outline-none resize-none placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-orange-400"
                  />
                </div>
              )}

              {showDesc && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">Remarks / Notes</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Enter any additional notes..."
                    className="w-full text-xs text-gray-800 dark:text-white border border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] rounded-xl px-3.5 py-2.5 outline-none resize-none placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-orange-400"
                  />
                </div>
              )}
            </div>

            {/* Totals Summary */}
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-5 w-full lg:w-80 shrink-0 space-y-3 shadow-2xs">
              <div className="flex justify-between text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="text-gray-800 dark:text-white font-mono font-semibold">₹ {subTotal.toFixed(2)}</span>
              </div>
              {totalDisc > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono font-semibold">- ₹ {totalDisc.toFixed(2)}</span>
                </div>
              )}
              {totalTax > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                  <span>Total Tax</span>
                  <span className="text-gray-800 dark:text-white font-mono font-semibold">+ ₹ {totalTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs sm:text-sm text-gray-500 dark:text-slate-400 border-t border-gray-100 dark:border-white/5 pt-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="roundoff"
                    checked={roundOffEnabled}
                    onChange={e => setRoundOffEnabled(e.target.checked)}
                    className="w-4 h-4 accent-orange-500 rounded"
                  />
                  <span className="text-xs font-medium">Round Off</span>
                </label>
                <span className="text-xs font-mono font-semibold text-gray-700 dark:text-slate-300">
                  {roundOff >= 0 ? "+" : ""}₹ {roundOff.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 dark:border-white/10 pt-3">
                <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Grand Total</span>
                <span className="text-lg sm:text-xl font-black text-orange-500 font-mono">
                  ₹ {finalTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. ACTION BAR */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-2xs w-full min-w-0 sticky bottom-0 z-30">
          <button
            type="button"
            onClick={() => { setView("list"); resetForm(); }}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => handleSave("DRAFT")}
              disabled={saving}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-60"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave("IN_TRANSIT")}
              disabled={saving}
              className="flex items-center gap-2 px-5 sm:px-6 py-2 text-xs sm:text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-50 transition-all shadow-sm active:scale-95"
            >
              <Check className="h-4 w-4" /> {saving ? "Saving..." : "Save Challan"}
            </button>
          </div>
        </div>

        {/* VIEWPORT-SAFE PORTAL PRODUCT DROPDOWN */}
        {mounted && activeItemIndex !== null && dropdownRect && createPortal(
          <div
            ref={dropdownPortalRef}
            className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100"
            style={{
              position: "fixed",
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              maxHeight: dropdownRect.maxHeight,
              zIndex: 999999,
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                <span>Loading products...</span>
              </div>
            ) : (() => {
              const activeSearch = (items[activeItemIndex]?.itemSearch || "").toLowerCase().trim();
              const matchingProducts = products.filter(p => {
                if (!activeSearch) return true;
                const nameMatch = p.name?.toLowerCase().includes(activeSearch);
                const skuMatch = p.sku && p.sku.toLowerCase().includes(activeSearch);
                const barcodeMatch = p.barcode && p.barcode.toLowerCase().includes(activeSearch);
                return Boolean(nameMatch || skuMatch || barcodeMatch);
              });

              if (matchingProducts.length === 0) {
                return (
                  <div className="px-4 py-8 text-center text-xs text-gray-400 dark:text-slate-500">
                    No products found matching <span className="font-semibold text-gray-600 dark:text-slate-300">&quot;{items[activeItemIndex]?.itemSearch}&quot;</span>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {matchingProducts.map(p => {
                    const price = getChannelPrice(p, destType);
                    const stock = p.currentStock ?? 0;
                    const isCurrentSelected = items[activeItemIndex]?.productId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectProduct(activeItemIndex, p);
                        }}
                        className={clsx(
                          "w-full flex items-start sm:items-center justify-between px-4 py-3 text-left transition-colors gap-3 group cursor-pointer",
                          isCurrentSelected
                            ? "bg-orange-50/90 dark:bg-orange-500/15"
                            : "hover:bg-orange-50/60 dark:hover:bg-white/5"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-snug break-words">
                              {p.name}
                            </span>
                            {p.unit && p.unit !== "NONE" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100/80 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 font-semibold uppercase tracking-wider shrink-0">
                                {p.unit}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-slate-400 mt-1 flex-wrap">
                            <span>
                              SKU: <strong className="font-mono text-gray-700 dark:text-slate-300 font-semibold">{p.sku || "—"}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              Stock:{" "}
                              <strong className={clsx("font-mono font-semibold", stock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400")}>
                                {stock}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pt-0.5 sm:pt-0">
                          <div className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 font-bold font-mono">
                            ₹{Number(price).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-medium">
                            {destType} Rate
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>,
          document.body
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2a. TRANSIT STOCK VIEW — read-only, derived from IN_TRANSIT challans
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "transit") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-2xs w-full min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setView("list")} className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors">Challans</button>
            <button className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-white bg-orange-500 rounded-xl shadow-sm">Transit Stock</button>
          </div>
          <button onClick={() => salesApi.getTransitStock().then((res: any) => setTransitStock(res.data || []))} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 transition-colors" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", transitLoading && "animate-spin text-orange-500")} />
          </button>
        </div>
        <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 w-full min-w-0">
          {transitLoading ? (
            <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
          ) : transitStock.length === 0 ? (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl py-16 text-center text-gray-400 dark:text-slate-500 text-sm shadow-2xs">Nothing currently in transit.</div>
          ) : (
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-sm min-w-[780px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                      <th className="text-left px-4 py-3 whitespace-nowrap">Challan No</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">Source</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">Party</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">From</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">Item</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">Batch</th>
                      <th className="text-right px-4 py-3 whitespace-nowrap">Qty</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">Dispatched</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">Vehicle / Driver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {transitStock.map((r: any, i: number) => (
                      <tr key={`${r.challanId}-${i}`} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 dark:text-slate-200 whitespace-nowrap">{r.challanNumber}</td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold border", r.sourceDocument === "SALES_INVOICE" ? "bg-orange-50 dark:bg-orange-500/10 text-[#f58220] dark:text-orange-400 border-orange-200 dark:border-orange-500/20" : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-white/10")}>
                            {r.sourceDocument === "SALES_INVOICE" ? "Sales Invoice" : "Direct"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-slate-300 whitespace-nowrap">{r.partyName || "—"} <span className="text-gray-400 dark:text-slate-500">({r.partyType})</span></td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">{r.sourceWarehouseName || "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-slate-300 whitespace-nowrap">{r.productName}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{r.batchNumber || "—"}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800 dark:text-white whitespace-nowrap">{r.quantity} {r.unit}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{formatDate(r.dispatchDate)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">{r.vehicleNo || "—"} {r.driverName ? `/ ${r.driverName}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. LIST VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">

      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Truck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Delivery Challans
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">
              Issue, dispatch, and track goods in transit
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setView("transit")}
            className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 transition-colors shrink-0"
          >
            Transit Stock
          </button>
          <button
            onClick={() => { resetForm(); setView("create"); }}
            className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" /> <span>New Challan</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0">
          {[
            { label: "Total Challans", value: stats.total,     color: "text-gray-700 dark:text-slate-200",    dot: "bg-gray-400" },
            { label: "In Transit",     value: stats.inTransit, color: "text-orange-600 dark:text-orange-400",    dot: "bg-[#f58220]" },
            { label: "Delivered",      value: stats.closed,    color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
            { label: "Converted",      value: stats.converted,    color: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
            { label: "Drafts",         value: stats.draft,     color: "text-amber-600 dark:text-amber-400",   dot: "bg-amber-500" },
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
              placeholder="Search challan or party..."
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
            {["ALL", "DRAFT", "IN_TRANSIT", "CLOSED", "CONVERTED"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-1.5 sm:py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 rounded-lg",
                  statusFilter === s ? "bg-[#f58220] text-white shadow-2xs" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {s === "ALL" ? "All" : STATUS_STYLES[s]?.label || s}
              </button>
            ))}
          </div>

          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-card text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220] transition-colors"
          >
            <option value="THIS_MONTH">This Month</option>
            <option value="TODAY">Today</option>
            <option value="CUSTOM">Custom Range</option>
          </select>
          {dateFilter === "CUSTOM" && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white text-xs outline-none focus:border-[#f58220]" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white text-xs outline-none focus:border-[#f58220]" />
            </div>
          )}

          <div className="flex-1 hidden sm:block" />

          {/* Export Dropdown */}
          <div className="relative" ref={exportDropRef}>
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
        {filteredChallans.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl py-16 sm:py-20 flex flex-col items-center justify-center text-center space-y-4 px-4 shadow-2xs">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center">
              <Truck className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base">No Delivery Challans</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Create your first delivery challan to get started.</p>
            </div>
            <button
              onClick={() => { resetForm(); setView("create"); }}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-sm"
            >
              Create Challan
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
                  <th className="text-left px-4 py-3 whitespace-nowrap">Party</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Challan No.</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Due Date</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Amount</th>
                  <th className="text-center px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredChallans.map(dc => {
                  const style = STATUS_STYLES[dc.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr key={dc.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(dc.invoiceDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-800 dark:text-white text-xs sm:text-sm">{dc.customerName}</div>
                        {dc.customerPhone && <div className="text-[11px] text-gray-400 dark:text-slate-500">{dc.customerPhone}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-[#f58220] text-xs whitespace-nowrap">
                        #{dc.challanNo}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(dc.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-white text-xs sm:text-sm whitespace-nowrap">
                        ₹{Number(dc.finalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {dc.status === "DRAFT" && (
                            <button
                              onClick={() => handleEdit(dc)}
                              className="px-2.5 py-1 text-xs font-medium text-[#f58220] hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded transition-colors"
                            >
                              Resume
                            </button>
                          )}
                          {dc.status === "IN_TRANSIT" && (
                            <button
                              onClick={() => setDeliveringChallan(dc)}
                              className="px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-colors"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {dc.status === "CLOSED" && (
                            <button
                              onClick={() => setConvertingChallan(dc)}
                              className="px-2.5 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded transition-colors cursor-pointer"
                            >
                              Convert to Sale
                            </button>
                          )}
                          {dc.status === "CONVERTED" && (
                            <div className="flex gap-2">
                              {dc.convertedOrderId && (
                                <a
                                  href={`/sales/order?search=${dc.convertedOrderId}`}
                                  className="px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition-colors"
                                >
                                  View Sale
                                </a>
                              )}
                              {dc.convertedInvoiceId && (
                                <a
                                  href={`/sales/tax-invoice?search=${dc.convertedInvoiceId}`}
                                  className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors"
                                >
                                  View Invoice
                                </a>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => handleEdit(dc)}
                            className="p-1 text-gray-400 hover:text-[#f58220] hover:bg-orange-50 dark:hover:bg-white/5 rounded transition-colors"
                            title="Edit Delivery Challan"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setShowRowMenu(showRowMenu === dc.id ? null : dc.id)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {showRowMenu === dc.id && (
                              <div className="absolute right-0 top-8 z-50 w-32 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg py-1 text-left">
                                <button
                                  onClick={() => { handleEdit(dc); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-700 dark:text-slate-200 text-left"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => { setPreviewingChallan(dc); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-700 dark:text-slate-200 text-left"
                                >
                                  Print
                                </button>
                                <button
                                  onClick={() => { handleDelete(dc.id); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs text-red-600 dark:text-red-400 text-left border-t border-gray-100 dark:border-white/5"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
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

      {previewingChallan && (
        <GSTInvoice
          order={{
            poNumber: previewingChallan.challanNo,
            createdAt: previewingChallan.invoiceDate,
            items: (previewingChallan.items || []).map((it: any) => ({
              itemName: it.description || it.productName || "Item",
              quantity: it.qty ?? it.quantity ?? 0,
              price: it.rate ?? it.unitPrice ?? 0,
              gstRate: it.taxPct ?? it.taxPercent ?? 0,
            })),
          }}
          vendor={{
            name: previewingChallan.customerName,
            address: previewingChallan.stateOfSupply,
            state: previewingChallan.stateOfSupply,
            phone: previewingChallan.customerPhone,
          }}
          companyDetails={currentCompany}
          documentType="DELIVERY_CHALLAN"
          onClose={() => setPreviewingChallan(null)}
        />
      )}

      {deliveringChallan && (
        <MarkDeliveredModal
          challan={deliveringChallan}
          products={products}
          onClose={() => setDeliveringChallan(null)}
          onDelivered={() => { setDeliveringChallan(null); fetchData(); }}
          showToast={showToast}
        />
      )}

      {returningChallan && (
        <ReturnGoodsModal
          challan={returningChallan}
          onClose={() => setReturningChallan(null)}
          onReturned={() => { setReturningChallan(null); fetchData(); }}
          showToast={showToast}
        />
      )}

      {convertingChallan && (
        <ConvertChallanToSaleModal
          challan={convertingChallan}
          products={products}
          onClose={() => setConvertingChallan(null)}
          onSuccess={() => {
            setConvertingChallan(null);
            fetchData();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── Mark Delivered modal ─────────────────────────────────────────────────────
function MarkDeliveredModal({
  challan,
  products = [],
  onClose,
  onDelivered,
  showToast,
}: {
  challan: any;
  products?: any[];
  onClose: () => void;
  onDelivered: () => void;
  showToast: (msg: string, type?: any) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [currentChallan, setCurrentChallan] = useState<any>(challan);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    // If challan has items already loaded, use them
    if (challan?.items && Array.isArray(challan.items) && challan.items.length > 0) {
      setCurrentChallan(challan);
      return;
    }
    // Fallback: fetch full challan details if items array is missing or empty
    if (challan?.id) {
      setLoadingItems(true);
      salesApi
        .getDeliveryChallanById(challan.id)
        .then((res: any) => {
          if (res?.data) {
            setCurrentChallan((prev: any) => ({ ...prev, ...res.data }));
          }
        })
        .catch((e: any) => console.error("Failed to load delivery challan items:", e))
        .finally(() => setLoadingItems(false));
    }
  }, [challan]);

  const submit = async () => {
    setSaving(true);
    try {
      await salesApi.markDeliveryChallanDelivered(challan.id, {});
      showToast("Delivery confirmed", "success");
      onDelivered();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to confirm delivery", "error");
    } finally {
      setSaving(false);
    }
  };

  const recipientName =
    currentChallan.customerName ||
    currentChallan.customer?.name ||
    currentChallan.dealer?.name ||
    currentChallan.franchise?.name ||
    currentChallan.partyName ||
    "—";

  const itemsList: any[] =
    Array.isArray(currentChallan.items) && currentChallan.items.length > 0
      ? currentChallan.items
      : Array.isArray(currentChallan.lineItems)
      ? currentChallan.lineItems
      : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => { if (!saving) onClose(); }}>
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Mark as Delivered</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Confirm Delivery</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { if (!saving) onClose(); }}
            disabled={saving}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300">
            Are you sure you want to mark this delivery challan as delivered?
          </p>

          {/* Dynamic Challan Details Card */}
          <div className="bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/5 rounded-xl p-3.5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-slate-400 font-medium">Challan:</span>
              <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                {currentChallan.challanNo || currentChallan.challanNumber}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-slate-400 font-medium">Recipient:</span>
              <span className="font-medium text-gray-800 dark:text-slate-200">{recipientName}</span>
            </div>

            {/* Products Section */}
            <div className="pt-2.5 border-t border-gray-200 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between font-semibold text-gray-700 dark:text-slate-300 pb-0.5">
                <span>Products {itemsList.length > 0 && `(${itemsList.length})`}</span>
                <span className="text-[11px] text-gray-500 dark:text-slate-400 font-normal">Quantity</span>
              </div>

              {loadingItems ? (
                <div className="flex items-center justify-center py-4 gap-2 text-gray-400 dark:text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  <span>Loading product details...</span>
                </div>
              ) : itemsList.length === 0 ? (
                <div className="py-2 text-center text-gray-400 dark:text-slate-500 italic">
                  No products listed on this challan
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-200/60 dark:divide-white/5">
                  {itemsList.map((it: any, idx: number) => {
                    const matchedProduct = products.find(
                      (p: any) =>
                        (it.productId && p.id === it.productId) ||
                        (it.sku && p.sku === it.sku)
                    );
                    const prodName =
                      it.productName ||
                      it.product?.name ||
                      matchedProduct?.name ||
                      `Product #${idx + 1}`;
                    const prodSku =
                      it.sku ||
                      it.product?.sku ||
                      matchedProduct?.sku ||
                      null;
                    const qty = it.quantity ?? it.qty ?? 0;
                    const unit = it.unit || matchedProduct?.unit || it.product?.unit || "PCS";

                    return (
                      <div
                        key={it.id || it.productId || idx}
                        className="flex items-start justify-between gap-3 pt-2 first:pt-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-800 dark:text-slate-200 leading-snug break-words">
                            {prodName}
                          </p>
                          {prodSku && (
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                              SKU: {prodSku}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-gray-900 dark:text-white font-mono">
                            {qty}
                          </span>{" "}
                          <span className="font-normal text-gray-500 dark:text-slate-400 text-[11px]">
                            {unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed bg-blue-50/60 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 rounded-lg p-2.5">
            ℹ️ This will close the transit quantity and update the challan status to <span className="font-semibold text-emerald-600 dark:text-emerald-400">Delivered</span>.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-white dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl transition-all shadow-sm disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Mark Delivered</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Return Goods modal ───────────────────────────────────────────────────────
const RETURN_REASONS = ["Unused Goods", "Demo Completed", "Sample Returned", "Excess Quantity", "Customer Rejected", "Damaged", "Wrong Product", "Replacement Return", "Job Work Returned", "Other"];
const RETURN_CONDITIONS = ["GOOD", "DAMAGED", "EXPIRED", "REJECTED", "QUARANTINE"];

function ReturnGoodsModal({ challan, onClose, onReturned, showToast }: { challan: any; onClose: () => void; onReturned: () => void; showToast: (msg: string, type?: any) => void }) {
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [condition, setCondition] = useState("GOOD");
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const items = (challan.items || []) as any[];

  const submit = async () => {
    const lines = items
      .map(it => ({ challanItemId: it.id, quantity: Number(qtyByItem[it.id] || 0) }))
      .filter(l => l.quantity > 0);
    if (lines.length === 0) {
      showToast("Enter a return quantity for at least one item", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await salesApi.createDeliveryChallanReturn({
        challanId: challan.id,
        reason,
        otherReason: reason === "Other" ? (otherReason || undefined) : undefined,
        items: lines,
        idempotencyKey,
      });
      const ret = (res as any).data;
      const itemConditions = (ret.items || []).map((ri: any) => ({ returnItemId: ri.id, condition }));
      const receiveRes = await salesApi.receiveDeliveryChallanReturn(ret.id, itemConditions);
      const receivedItems = (receiveRes as any)?.data?.items || [];
      const recallFlagged = receivedItems.some((ri: any) => !!ri.recallId);
      if (recallFlagged) {
        showToast(
          `Return ${ret.returnNumber} recorded — one or more items traced back to a RECALLED batch and were kept in quarantine, not restocked as saleable, regardless of the condition selected.`,
          "warning"
        );
      } else {
        showToast(`Return ${ret.returnNumber} recorded`, "success");
      }
      onReturned();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to record return", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar border border-gray-200 dark:border-white/10" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="text-base font-bold text-gray-800 dark:text-white">Return Goods</h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{challan.challanNo || challan.challanNumber}</p>
        </div>

        <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2">Dispatched</th>
                <th className="text-right px-3 py-2 w-28">Return Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {items.map(it => (
                <tr key={it.id}>
                  <td className="px-3 py-2 text-gray-700 dark:text-slate-200">{it.productName}</td>
                  <td className="px-3 py-2 text-right text-gray-500 dark:text-slate-400">{it.quantity} {it.unit}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0} max={it.quantity}
                      value={qtyByItem[it.id] || ""}
                      onChange={e => setQtyByItem(prev => ({ ...prev, [it.id]: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white rounded px-2 py-1 text-right outline-none focus:border-orange-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]">
              {RETURN_REASONS.map(r => <option key={r} value={r} className="dark:bg-card">{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Condition on Receipt</label>
            <select value={condition} onChange={e => setCondition(e.target.value)} className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]">
              {RETURN_CONDITIONS.map(c => <option key={c} value={c} className="dark:bg-card">{c}</option>)}
            </select>
          </div>
        </div>
        {reason === "Other" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Note</label>
            <input value={otherReason} onChange={e => setOtherReason(e.target.value)} className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]" />
          </div>
        )}
        {condition !== "GOOD" && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2">
            {condition} condition returns are logged for traceability but are NOT added to available warehouse stock.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 shadow-sm">
            {saving ? "Saving..." : "Record Return"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Convert Challan to Sale modal ──────────────────────────────────────────
function ConvertChallanToSaleModal({
  challan,
  products = [],
  onClose,
  onSuccess,
  showToast
}: {
  challan: any;
  products: any[];
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: any) => void;
}) {
  const router = useRouter();
  const items = (challan.items || []) as any[];

  // Return quantities by line item id (strings for controlled inputs)
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    items.forEach(it => {
      init[it.id] = "0";
    });
    return init;
  });

  const [saving, setSaving] = useState(false);

  // Helper to resolve product SKU
  const getProductSku = (it: any) => {
    if (it.sku) return it.sku;
    if (it.productId) {
      const match = products.find(p => p.id === it.productId || (p.sku && p.sku === it.productId));
      if (match?.sku) return match.sku;
    }
    return it.productId || "—";
  };

  // Compute stats per row
  const rowData = useMemo(() => {
    return items.map(it => {
      const dispatched = Number(it.quantity ?? it.qty ?? 0);
      const returnRaw = returnQtys[it.id];
      const returnNum = parseFloat(returnRaw) || 0;
      const isInvalid = isNaN(returnNum) || returnNum < 0 || returnNum > dispatched;
      const sold = isInvalid ? 0 : Math.max(0, dispatched - returnNum);
      const sku = getProductSku(it);
      return {
        item: it,
        dispatched,
        returnRaw: returnRaw === undefined ? "0" : returnRaw,
        returnNum,
        sold,
        isInvalid,
        sku
      };
    });
  }, [items, returnQtys, products]);

  const hasAnyInvalid = rowData.some(r => r.isInvalid);
  const totalDispatched = rowData.reduce((sum, r) => sum + r.dispatched, 0);
  const totalReturned = rowData.reduce((sum, r) => sum + (r.isInvalid ? 0 : r.returnNum), 0);
  const totalSold = rowData.reduce((sum, r) => sum + (r.isInvalid ? 0 : r.sold), 0);

  const handleReturnQtyChange = (itemId: string, value: string) => {
    setReturnQtys(prev => ({ ...prev, [itemId]: value }));
  };

  const handleContinue = async () => {
    if (hasAnyInvalid) {
      showToast("Please correct the invalid return quantities before continuing.", "error");
      return;
    }

    if (totalSold <= 0) {
      showToast("Cannot continue to Sale Invoice: All items have been returned (0 sold quantity).", "error");
      return;
    }

    setSaving(true);
    try {
      // 1. Record returns for any items with return quantity > 0
      const returnLines = rowData
        .filter(r => r.returnNum > 0)
        .map(r => ({
          challanItemId: r.item.id,
          quantity: r.returnNum
        }));

      if (returnLines.length > 0) {
        const retRes: any = await salesApi.createDeliveryChallanReturn({
          challanId: challan.id,
          reason: "Excess Quantity",
          items: returnLines,
          idempotencyKey: crypto.randomUUID()
        });

        const createdReturn = retRes?.data;
        if (createdReturn?.id) {
          const itemConditions = (createdReturn.items || []).map((ri: any) => ({
            returnItemId: ri.id,
            condition: "GOOD"
          }));
          await salesApi.receiveDeliveryChallanReturn(createdReturn.id, itemConditions);
        }
      }

      // 2. Prepare items for the Sale Invoice (ONLY products where sold > 0)
      const soldItemsForInvoice = rowData
        .filter(r => r.sold > 0)
        .map(r => {
          const it = r.item;
          return {
            id: it.id || Math.random().toString(36).slice(2),
            productId: it.productId || "",
            productName: it.productName || it.description || "Product",
            itemSearch: it.productName || it.description || "Product",
            qty: r.sold,
            unit: it.unit || "NONE",
            rate: Number(it.rate ?? it.unitPrice ?? 0),
            discountPct: Number(it.discountPercent ?? it.discountPct ?? 0),
            taxPct: Number(it.taxPercent ?? it.taxPct ?? 0),
            batchNumber: it.batchNumber || "",
            sku: r.sku
          };
        });

      // 3. Cache the conversion payload in sessionStorage for seamless transfer
      const conversionPayload = {
        challanId: challan.id,
        challanNumber: challan.challanNo || challan.challanNumber,
        partyId: challan.customerId || challan.dealerId || challan.franchiseId,
        partyType: challan.dealerId ? "DEALER" : challan.franchiseId ? "FRANCHISE" : "CUSTOMER",
        partyName: challan.customerName || challan.customer?.name || challan.dealer?.name || challan.franchiseName || "",
        partyPhone: challan.customerPhone || challan.customer?.phone || challan.dealer?.phone || "",
        stateOfSupply: challan.stateOfSupply || "",
        items: soldItemsForInvoice,
        timestamp: Date.now()
      };

      try {
        sessionStorage.setItem(`convert_dc_to_sale_${challan.id}`, JSON.stringify(conversionPayload));
      } catch (e) {
        console.warn("Failed to set sessionStorage conversionPayload", e);
      }

      showToast("Redirecting to Sale Invoice with sold quantities...", "success");
      onSuccess();
      router.push(`/sales/invoices?view=create&sourceDeliveryChallanId=${challan.id}`);
    } catch (e: any) {
      console.error("Convert to sale error:", e);
      showToast(e?.response?.data?.error || "Failed to initiate conversion to Sale Invoice", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[#0e1017] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-white/10 overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Convert Challan to Sale</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Enter any return quantities below. Only remaining sold quantities will continue to the Sale Invoice.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Challan Metadata Bar */}
        <div className="px-5 py-3 bg-gray-50/75 dark:bg-white/[0.01] border-b border-gray-100 dark:border-white/5 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">Challan Number</span>
            <span className="font-bold text-gray-800 dark:text-slate-200">#{challan.challanNo || challan.challanNumber}</span>
          </div>
          <div>
            <span className="text-gray-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">Party</span>
            <span className="font-bold text-gray-800 dark:text-slate-200 truncate block">
              {challan.customerName || challan.customer?.name || challan.dealer?.name || challan.franchiseName || "Customer"}
            </span>
          </div>
          <div className="text-right">
            <span className="text-gray-400 dark:text-slate-500 block text-[10px] uppercase font-semibold">Challan Date</span>
            <span className="font-medium text-gray-700 dark:text-slate-300">
              {formatDate(challan.invoiceDate || challan.challanDate || new Date())}
            </span>
          </div>
        </div>

        {/* Table of Product Rows */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
          <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.03] text-gray-500 dark:text-slate-400 font-semibold border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="text-left px-3 py-2.5">Product</th>
                  <th className="text-left px-3 py-2.5 hidden sm:table-cell">SKU</th>
                  <th className="text-right px-3 py-2.5">Dispatched</th>
                  <th className="text-right px-3 py-2.5 w-32">Return Qty</th>
                  <th className="text-right px-3 py-2.5 font-bold text-purple-600 dark:text-purple-400">Sold Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {rowData.map(r => (
                  <tr key={r.item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-gray-900 dark:text-white">{r.item.productName || r.item.description}</div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-500 sm:hidden">SKU: {r.sku}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 dark:text-slate-400 font-mono hidden sm:table-cell">
                      {r.sku}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">
                      {r.dispatched} {r.item.unit || "PCS"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={r.dispatched}
                          value={r.returnRaw}
                          onChange={e => handleReturnQtyChange(r.item.id, e.target.value)}
                          className={clsx(
                            "w-full px-2.5 py-1 text-right text-xs font-semibold rounded-lg outline-none border transition-colors bg-white dark:bg-[#13151f]",
                            r.isInvalid
                              ? "border-red-500 text-red-600 focus:ring-1 focus:ring-red-500"
                              : "border-gray-300 dark:border-white/10 text-gray-800 dark:text-white focus:border-purple-500"
                          )}
                        />
                      </div>
                      {r.isInvalid && (
                        <div className="text-[10px] text-red-500 mt-0.5">0 to {r.dispatched} only</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className={clsx(
                        "font-black text-xs px-2 py-0.5 rounded",
                        r.sold > 0 
                          ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40" 
                          : "text-gray-400 dark:text-slate-500"
                      )}>
                        {r.sold} {r.item.unit || "PCS"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 bg-slate-50/75 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-gray-400 dark:text-slate-500 text-[10px] uppercase font-semibold block">Total Dispatched</span>
              <span className="font-bold text-gray-800 dark:text-slate-200">{totalDispatched}</span>
            </div>
            <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />
            <div>
              <span className="text-gray-400 dark:text-slate-500 text-[10px] uppercase font-semibold block">Total Returned</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{totalReturned}</span>
            </div>
            <div className="w-px h-6 bg-gray-200 dark:bg-white/10" />
            <div>
              <span className="text-gray-400 dark:text-slate-500 text-[10px] uppercase font-semibold block">Total Sold</span>
              <span className="font-black text-purple-600 dark:text-purple-400">{totalSold}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={saving || hasAnyInvalid || totalSold <= 0}
              className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>{saving ? "Processing..." : "Continue to Sale Invoice"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

