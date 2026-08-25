"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Receipt, Plus, Search, RefreshCw, X, User,
  Printer, ChevronDown, Trash2, Check, Share2, Calendar,
  AlignLeft, FileText, ArrowLeft
} from "lucide-react";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { customersApi, productsFullApi, draftsApi, franchiseApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatERPNumber, formatDate } from "@/lib/utils";
import api from "@/lib/api/base";
import AddPartyModal from "@/components/modals/AddPartyModal";
import AddInventoryProductForm from "@/components/modules/inventory/AddInventoryProductForm";
import GSTInvoice from "@/components/documents/GSTInvoice";

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
  DRAFT:    { label: "Draft",    color: "text-slate-600",   bg: "bg-slate-50",   border: "border-slate-200" },
  SENT:     { label: "Sent",     color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
  PAID:     { label: "Paid",     color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  PARTIAL:  { label: "Partial",  color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
  OVERDUE:  { label: "Overdue",  color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200" },
  CANCELLED:{ label: "Cancelled",color: "text-slate-400",   bg: "bg-slate-100",  border: "border-slate-200" },
};

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
  baseUnit?: any;
  conversions?: any[];
  availableStock?: number;
  basePrice: number;
  batchNumber?: string;
  batches?: any[];
}

function makeItem(): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    productId: "",
    itemSearch: "",
    qty: 1,
    unit: "NONE",
    rate: 0,
    basePrice: 0,
    discountPct: 0,
    taxPct: 0,
    taxLabel: "NONE",
    batchNumber: "",
    batches: [],
  };
}

function computeRow(item: LineItem, withTax: boolean) {
  const gross = item.qty * item.rate;
  const discAmt = parseFloat((gross * item.discountPct / 100).toFixed(2));
  if (withTax) {
    const netAmt = gross - discAmt;
    const taxAmt = parseFloat((netAmt * item.taxPct / (100 + item.taxPct)).toFixed(2));
    return { discAmt, taxAmt, amount: parseFloat(netAmt.toFixed(2)) };
  }
  const taxable = gross - discAmt;
  const taxAmt = parseFloat((taxable * item.taxPct / 100).toFixed(2));
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
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-64 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronDown size={14} className="rotate-90" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>
        ))}
      </div>
      {/* Day grid */}
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
              isSelected(d) && "bg-orange-500 text-white",
              !isSelected(d) && isToday(d) && "bg-orange-100 text-orange-600",
              !isSelected(d) && !isToday(d) && "text-gray-700 hover:bg-gray-100"
            )}
          >{d}</button>
        ))}
      </div>
      {/* Footer */}
      <div className="mt-2 flex justify-between items-center border-t border-gray-100 pt-2">
        <button
          onClick={() => {
            const t = new Date();
            const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
            onChange(iso);
            onClose();
          }}
          className="text-[11px] font-semibold text-orange-500 hover:text-orange-700"
        >Today</button>
        <button onClick={onClose} className="text-[11px] text-gray-400 hover:text-gray-600">Close</button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SalesInvoicesPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const isFranchiseUser = user?.role?.toUpperCase() === "FRANCHISE_ADMIN";

  // A franchise-scoped user always has one; SUPER_ADMIN doesn't, and the
  // backend requires a franchiseId to save an Order (it's a required FK) —
  // without this, submitting as SUPER_ADMIN crashed with a raw Prisma
  // "Argument `franchise` is missing" error instead of ever asking who the
  // sale is for.
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>(user?.franchiseId || "");

  // shared
  const [view, setView] = useState<"list" | "create">("list");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [printingInvoice, setPrintingInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // list date filters — local Y/M/D components, not .toISOString() (which
  // shifts a local midnight date back a day in a UTC+ locale, e.g. "This
  // Month" for August rendering as 31 Jul -> 30 Aug).
  const now = new Date();
  const toLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const firstOfMonth = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastOfMonth  = toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
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
  const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT">("CASH");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [stateOfSupply, setStateOfSupply] = useState("");
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
  const [draftId, setDraftId] = useState<string | null>(null);

  // Add Party modal state
  const [showAddParty, setShowAddParty] = useState(false);
  const [partyTab, setPartyTab] = useState<"GST" | "CREDIT">("GST");
  const [newParty, setNewParty] = useState({
    name: "", phone: "", email: "", gstin: "", gstType: "Unregistered/Consumer",
    state: "", city: "", pincode: "", billingAddress: "", shippingAddress: "", openingBalance: "", creditLimit: ""
  });
  const [savingParty, setSavingParty] = useState(false);
  const [fetchingGst, setFetchingGst] = useState(false);

  // Add Item modal state
  const [showAddItem, setShowAddItem] = useState(false);
  const [addingItemIdx, setAddingItemIdx] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({
    name: "", sku: "", basePrice: "", taxPercent: 5, description: ""
  });
  const [savingItem, setSavingItem] = useState(false);

  // Item dropdown fixed position
  const [itemDropRect, setItemDropRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Custom calendar
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const customerDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);
  const priceDropRef = useRef<HTMLDivElement>(null);

  const fetchGstDetails = async (gstin: string) => {
    const cleanGst = gstin.trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGst)) {
      return;
    }

    setFetchingGst(true);
    try {
      const res = await fetch(`/api/gst-verify/${cleanGst}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch GST details");
      }
      
      const data = await res.json();
      if (data.success) {
        setNewParty((prev) => ({
          ...prev,
          name: data.legalName || prev.name,
          billingAddress: data.address || prev.billingAddress,
          state: data.state || prev.state,
          city: data.city || prev.city,
          pincode: data.pinCode || prev.pincode
        }));
        showToast(
          `Successfully auto-filled details for "${data.legalName}"${data.mocked ? " (Demo Mode)" : ""}`,
          "success"
        );
      }
    } catch (err: any) {
      console.error("Auto-fetch GST details failed:", err);
      showToast(err.message || "Could not auto-fetch GST details. Please enter manually.", "warning");
    } finally {
      setFetchingGst(false);
    }
  };

  const handleSaveItem = async () => {
    if (!newItem.name.trim()) {
      showToast("Item Name is required", "error");
      return;
    }
    const priceNum = Number(newItem.basePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast("Please enter a valid Price/Unit", "error");
      return;
    }

    setSavingItem(true);
    try {
      const res = await productsFullApi.create({
        name: newItem.name.trim(),
        sku: newItem.sku.trim() || undefined,
        basePrice: priceNum,
        taxPercent: newItem.taxPercent,
        description: newItem.description.trim() || undefined,
      });
      const createdProd = (res as any).data;
      showToast("Item created successfully", "success");

      // Update local products list
      setProducts(prev => [...prev, createdProd].sort((a, b) => a.name.localeCompare(b.name)));

      // If we are currently editing a row, auto-select it!
      if (addingItemIdx !== null) {
        selectProduct(addingItemIdx, createdProd);
      }

      // Close modal & reset
      setShowAddItem(false);
      setNewItem({ name: "", sku: "", basePrice: "", taxPercent: 5, description: "" });
      setAddingItemIdx(null);
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to create item", "error");
    } finally {
      setSavingItem(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [iRes, cRes, pRes, dRes, vRes, fRes] = await Promise.allSettled([
        api.get("/api/finance/invoices").catch(() => ({ data: [] })),
        customersApi.getAll(),
        productsFullApi.getAll(),
        draftsApi.getDrafts("invoice").catch(() => ({ data: [] })),
        api.get("/api/vendors").catch(() => ({ data: [] })),
        isFranchiseUser ? Promise.resolve({ data: [] }) : franchiseApi.getAll().catch(() => ({ data: [] })),
      ]);

      if (fRes.status === "fulfilled") {
        const franchiseList = (fRes.value as any).data || [];
        setFranchises(franchiseList);
        setSelectedFranchiseId(prev => prev || user?.franchiseId || franchiseList[0]?.id || "");
      }

      let apiInvoices = iRes.status === "fulfilled" ? (iRes.value as any).data || [] : [];
      let drafts = dRes.status === "fulfilled" ? (dRes.value as any).data || [] : [];
      
      // Format drafts to match invoice structure
      const formattedDrafts = drafts.map((d: any) => ({
        id: d.id,
        status: "DRAFT",
        createdAt: d.createdAt,
        finalAmount: d.data.finalTotal || 0,
        order: {
          // The literal string "DRAFT" used to go here unconditionally — every
          // draft row then ran that SAME literal through formatERPNumber(),
          // which hashes an unrecognized string to a deterministic 4-digit
          // suffix ("DRAFT" always hashes to 7009), so every draft displayed
          // the identical fake "INV-2026-7009" no matter which draft it was.
          // A draft only has a real number once the user typed one in.
          invoiceNum: d.data._rawState?.invoiceNumber || null,
          customer: d.data._rawState?.selectedCustomer || { name: "Unknown Customer" },
          orderItems: d.data._rawState?.items?.map((i: any) => ({
            product: { name: i.itemSearch },
            quantity: i.qty,
            price: i.rate,
            taxAmount: (i.qty * i.rate * ((i.taxPct || 0) / 100)),
            totalAmount: (i.qty * i.rate) + (i.qty * i.rate * ((i.taxPct || 0) / 100)),
          })) || []
        },
        _rawState: d.data._rawState
      }));
      
      setInvoices([...formattedDrafts, ...apiInvoices]);
      
      let allCustomers = cRes.status === "fulfilled" ? (cRes.value as any).data || [] : [];
      let allVendors = vRes.status === "fulfilled" ? (vRes.value as any).data || [] : [];
      
      allVendors.forEach((v: any) => {
        const exists = allCustomers.find((c: any) => 
          (c.phone && c.phone === v.contact) || 
          (c.email && c.email === v.email) || 
          (c.name.toLowerCase() === v.name.toLowerCase())
        );
        if (!exists) {
          allCustomers.push({ ...v, isVendorOnly: true, phone: v.contact });
        }
      });
      setCustomers(allCustomers);

      if (pRes.status === "fulfilled") setProducts((pRes.value as any).data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Computed totals ────────────────────────────────────────────────────────
  const withTax = priceMode === "with_tax";
  const rowData = items.map(item => ({ item, ...computeRow(item, withTax) }));
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalDisc = parseFloat(rowData.reduce((s, r) => s + r.discAmt, 0).toFixed(2));
  const totalTax = parseFloat(rowData.reduce((s, r) => s + r.taxAmt, 0).toFixed(2));
  const totalAmount = parseFloat(rowData.reduce((s, r) => s + r.amount, 0).toFixed(2));
  const roundOff = roundOffEnabled ? parseFloat((Math.round(totalAmount) - totalAmount).toFixed(2)) : 0;
  const finalTotal = parseFloat((totalAmount + roundOff).toFixed(2));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setDraftId(null);
    setPaymentType("CASH");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerPhone("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setInvoiceNumber("");
    setStateOfSupply("");
    setItems([makeItem(), makeItem()]);
    setPriceMode("without_tax");
    setTermsText("");
    setShowTerms(false);
    setDescription("");
    setShowDesc(false);
    setRoundOffEnabled(true);
    setView("create");
  };

  const loadDraft = (draft: any) => {
    setDraftId(draft.id);
    const raw = draft._rawState || {};
    setPaymentType(raw.paymentType || "CASH");
    setSelectedCustomer(raw.selectedCustomer || null);
    setCustomerSearch(raw.customerSearch || "");
    setCustomerPhone(raw.customerPhone || "");
    setInvoiceDate(raw.invoiceDate || new Date().toISOString().split("T")[0]);
    setInvoiceNumber(raw.invoiceNumber || "");
    setStateOfSupply(raw.stateOfSupply || "");
    setItems(raw.items && raw.items.length > 0 ? raw.items : [makeItem(), makeItem()]);
    setPriceMode(raw.priceMode || "without_tax");
    setTermsText(raw.termsText || "");
    setShowTerms(raw.showTerms || !!raw.termsText);
    setDescription(raw.description || "");
    setShowDesc(raw.showDesc || !!raw.description);
    setRoundOffEnabled(raw.roundOffEnabled ?? true);
    setView("create");
  };

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setCustomerPhone(c.contact || c.phone || "");
    setShowCustomerDrop(false);
  };

  const selectProduct = async (idx: number, p: any) => {
    let productBatches: any[] = [];
    try {
      const res = await api.get(`/api/production/batches?productId=${p.id}`);
      productBatches = res.data || [];
    } catch (err) {
      console.error("Failed to fetch product batches", err);
    }

    setItems(prev => prev.map((it, i) =>
      i === idx ? {
        ...it,
        productId: p.id,
        itemSearch: p.name,
        basePrice: p.basePrice || p.price || 0,
        rate: p.basePrice || p.price || 0,
        unit: p.unit || "NONE",
        taxPct: p.taxPercent || 0,
        taxLabel: TAX_OPTIONS.find(o => o.value === (p.taxPercent || 0))?.label || "NONE",
        baseUnit: p.baseUnit,
        conversions: p.conversions || [],
        availableStock: p.currentStock || 0,
        batches: productBatches,
        batchNumber: productBatches.length > 0 ? productBatches[0].batchCode : "",
      } : it
    ));
    setOpenItemDrop(null);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      
      if (field === "unit") {
        const u = String(value).toUpperCase();
        const conv = it.conversions?.find((c: any) => 
          c.unitId === value || 
          c.unit?.code === value || 
          c.unit?.name?.toUpperCase() === u || 
          c.unit?.shortName?.toUpperCase() === u
        );
        if (conv) {
          updated.rate = Number((updated.basePrice * conv.multiplier).toFixed(2));
        } else {
          updated.rate = updated.basePrice;
        }
      }
      return updated;
    }));
  };

  const addRow = () => setItems(prev => [...prev, makeItem()]);

  const removeRow = (idx: number) => {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (isDraft = false) => {
    if (!selectedCustomer && !isDraft) { showToast("Please select a customer", "error"); return; }
    const validItems = items.filter(i => i.productId && i.qty > 0 && i.rate > 0);
    if (validItems.length === 0 && !isDraft) { showToast("Add at least one item with price", "error"); return; }
    
    // Unit conversion and stock validation check
    if (!isDraft) {
      for (const i of validItems) {
        let req = i.qty;
        const u = String(i.unit).toUpperCase();
        let conv = i.conversions?.find((c: any) => 
          c.unitId === i.unit || 
          c.unit?.code === i.unit || 
          c.unit?.name?.toUpperCase() === u || 
          c.unit?.shortName?.toUpperCase() === u
        );
        if (conv) req = i.qty * conv.multiplier;
        
        if (req > (i.availableStock || 0)) {
          showToast(`Insufficient stock for ${i.itemSearch}. Required: ${req}, Available: ${i.availableStock || 0}`, "error");
          return;
        }
      }
    }

    // Draft with NO items and NO customer is basically empty, just close it
    if (isDraft && !selectedCustomer && validItems.length === 0) {
       setView("list");
       return;
    }

    const draftData = {
      finalTotal,
      _rawState: {
        selectedCustomer,
        customerSearch,
        customerPhone,
        invoiceDate,
        invoiceNumber,
        stateOfSupply,
        paymentType,
        items,
        priceMode,
        termsText,
        description,
        roundOffEnabled
      }
    };

    if (isDraft) {
      setSaving(true);
      try {
        await draftsApi.saveDraft({
          id: draftId || undefined,
          type: "invoice",
          data: draftData
        });
        showToast("Draft saved successfully", "success");
        fetchData();
        setView("list");
      } catch (e) {
        showToast("Failed to save draft", "error");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!selectedFranchiseId) {
      showToast("Please select a branch/franchise for this invoice", "error");
      return;
    }

    setSaving(true);
    try {
      let finalCustomerId = selectedCustomer?.id;
      
      if (selectedCustomer?.isVendorOnly) {
        try {
          const res = await customersApi.create({
            name: selectedCustomer.name,
            phone: selectedCustomer.contact || selectedCustomer.phone,
            email: selectedCustomer.email,
            address: selectedCustomer.address,
            gstNumber: selectedCustomer.gstNumber,
            gstType: selectedCustomer.gstType,
            category: selectedCustomer.category,
          });
          finalCustomerId = (res as any).data.id;
          
          // Update the list of customers so it isn't created again if they reuse the page
          setCustomers(prev => {
            const newList = prev.filter(c => c.id !== selectedCustomer.id);
            newList.push((res as any).data);
            return newList;
          });
          
        } catch (e: any) {
          showToast(e?.response?.data?.error || "Failed to link vendor to customer", "error");
          setSaving(false);
          return;
        }
      }

      const receivedAmount = (paymentType === "CASH") ? finalTotal : 0;
      const payload: any = {
        invoiceDate,
        invoiceNumber: invoiceNumber.trim() || undefined,
        franchiseId: selectedFranchiseId,
        stateOfSupply: stateOfSupply || undefined,
        paymentType,
        status: "SENT",
        items: validItems.map(i => ({
          productId: i.productId,
          qty: i.qty,
          unit: i.unit,
          rate: i.rate,
          gst: i.taxPct,
          discount: i.discountPct,
          batchNumber: i.batchNumber || undefined
        })),
        receivedAmount,
        paymentMode: paymentType === "CASH" ? "CASH" : "CREDIT",
        roundOff,
        termsAndConditions: termsText || undefined,
        description: description || undefined,
      };
      if (finalCustomerId) payload.customerId = finalCustomerId;

      await api.post("/api/finance/invoices", payload);
      
      // If we saved an invoice that was previously a draft, remove the draft
      if (draftId) {
        try {
          await draftsApi.deleteDraft(draftId);
        } catch (e) {}
      }

      showToast("Invoice saved successfully", "success");
      fetchData();
      setView("list");
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to save invoice", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;
    try {
      await draftsApi.deleteDraft(id);
      showToast("Draft deleted", "success");
      fetchData();
    } catch (e) {
      showToast("Failed to delete draft", "error");
    }
  };

  const handleBack = () => {
    const hasData = selectedCustomer || items.some(i => i.productId || i.itemSearch.trim() !== "");
    if (hasData) {
       handleSave(true);
    } else {
       setView("list");
    }
  };

  const handlePrint = (inv: any) => {
    setPrintingInvoice(inv);
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = invoices.filter(inv => {
    const matchSearch = !search ||
      inv.order?.invoiceNum?.toLowerCase().includes(search.toLowerCase()) ||
      inv.order?.customer?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filtered.reduce((s, i) => s + (i.finalAmount || 0), 0);
  const totalPaid = filtered.filter(i => i.status === "PAID").reduce((s, i) => s + (i.finalAmount || 0), 0);
  const totalOutstanding = filtered
    .filter(i => ["SENT", "PARTIAL", "OVERDUE", "PENDING"].includes(i.status))
    .reduce((s, i) => s + (i.finalAmount || 0), 0);

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.contact && c.contact.includes(customerSearch)) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE VIEW — Vyapar-style full-page form
  // ══════════════════════════════════════════════════════════════════════════
  if (view === "create") {
    return (
      <div className="flex flex-col bg-gray-50" style={{ height: 'calc(100vh - 104px)' }}>

        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ArrowLeft size={17} />
            </button>
            <h2 className="text-base font-semibold text-gray-800">{draftId ? "Edit Draft Invoice" : "New Sale Invoice"}</h2>
          </div>
          <div className="flex items-center gap-4">
            {!isFranchiseUser && (
              <select
                value={selectedFranchiseId}
                onChange={e => setSelectedFranchiseId(e.target.value)}
                className="text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none bg-white text-gray-700"
              >
                {franchises.length === 0 && <option value="">No branches found</option>}
                {franchises.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
            <span className="text-xs text-gray-400">Invoice No: <span className="text-orange-500 font-semibold">{invoiceNumber || "Auto"}</span></span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4">

          {/* Customer + Invoice Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 gap-8">
              {/* Left: Customer */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Customer *</label>
                  <div className="relative" ref={customerDropRef}>
                    <div
                      className={clsx(
                        "flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer bg-white transition-colors",
                        showCustomerDrop ? "border-orange-400 ring-1 ring-orange-100" : "border-gray-300 hover:border-gray-400"
                      )}
                      onClick={() => setShowCustomerDrop(v => !v)}
                    >
                      <User size={14} className="text-gray-400 shrink-0" />
                      <input
                        className="flex-1 text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
                        placeholder="Search by Name/Phone"
                        value={customerSearch}
                        onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                        onClick={e => { e.stopPropagation(); setShowCustomerDrop(true); }}
                      />
            {customerSearch && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setCustomerSearch("")} 
              />
            )}
                      <ChevronDown size={13} className="text-gray-400 shrink-0" />
                    </div>
                    {showCustomerDrop && (
                      <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-b border-gray-100 font-medium"
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
                          <Plus size={15} /> Add Party
                        </button>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredCustomers.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-400 text-center">No customers found</div>
                          ) : (
                            filteredCustomers.map(c => (
                              <button
                                key={c.id}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                onClick={() => selectCustomer(c)}
                              >
                                <div className="text-left">
                                  <div className="text-sm font-medium text-gray-800">{c.name}</div>
                                  <div className="text-xs text-gray-400">{c.phone || "—"}</div>
                                </div>
                                {(c.balance !== undefined && c.balance !== 0) && (
                                  <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded">
                                    {c.balance}<Check size={10} />
                                  </div>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors"
                    placeholder="Phone Number"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Right: Invoice Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium text-gray-500">Invoice Number</span>
                  <input
                    type="text"
                    placeholder="Auto"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="text-sm font-semibold text-gray-700 bg-transparent border-b border-dashed border-gray-300 outline-none w-24 text-right focus:border-orange-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Invoice Date</span>
                  <div className="relative" ref={calendarRef}>
                    <button
                      onClick={() => setShowCalendar(v => !v)}
                      className="flex items-center gap-2 text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:border-orange-400 transition-colors"
                    >
                      <Calendar size={13} className="text-orange-500 shrink-0" />
                      {invoiceDate ? formatDate(invoiceDate + "T00:00:00") : "Pick date"}
                    </button>
                    {showCalendar && (
                      <div className="absolute right-0 top-full mt-1 z-[200]">
                        <MiniCalendar value={invoiceDate} onChange={setInvoiceDate} onClose={() => setShowCalendar(false)} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">State of Supply</span>
                  <select
                    value={stateOfSupply}
                    onChange={e => setStateOfSupply(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-sm text-gray-700 outline-none focus:border-orange-400 w-44 transition-colors"
                  >
                    <option value="">Select</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</span>
              <div className="relative" ref={priceDropRef}>
                <button
                  onClick={() => setShowPriceDrop(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg px-2.5 py-1 bg-white hover:border-gray-400 transition-colors"
                >
                  Price: {priceMode === "without_tax" ? "Excl. Tax" : "Incl. Tax"}
                  <ChevronDown size={11} />
                </button>
                {showPriceDrop && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg text-xs w-44 z-50">
                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 text-gray-700" onClick={() => { setPriceMode("without_tax"); setShowPriceDrop(false); }}>Excl. Tax (Without Tax)</button>
                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 text-gray-700" onClick={() => { setPriceMode("with_tax"); setShowPriceDrop(false); }}>Incl. Tax (With Tax)</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                    <th className="w-8 px-3 py-2.5 text-center">#</th>
                    <th className="px-3 py-2.5 text-left">Item</th>
                    <th className="w-28 px-2 py-2.5 text-center">Batch No.</th>
                    <th className="w-16 px-2 py-2.5 text-center">Qty</th>
                    <th className="w-20 px-2 py-2.5 text-center">Unit</th>
                    <th className="w-24 px-3 py-2.5 text-right">Price/Unit</th>
                    <th className="w-16 px-2 py-2.5 text-center">Disc%</th>
                    <th className="w-36 px-2 py-2.5 text-center">Tax</th>
                    <th className="w-24 px-3 py-2.5 text-right">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const { discAmt, taxAmt, amount } = computeRow(item, withTax);
                    const filtProd = products.filter(p =>
                      !item.itemSearch || p.name?.toLowerCase().includes(item.itemSearch.toLowerCase())
                    ).slice(0, 10);

                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-orange-50/30 group">
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400">{idx + 1}</td>

                        {/* ITEM */}
                        <td className="px-3 py-2" style={{ position: "relative", overflow: "visible" }}>
                          <input
                            className="w-full text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
                            placeholder="Search item..."
                            value={item.itemSearch}
                            onChange={e => {
                              updateItem(idx, "itemSearch", e.target.value);
                              updateItem(idx, "productId", "");
                              setOpenItemDrop(item.id);
                            }}
                            onFocus={e => {
                              setOpenItemDrop(item.id);
                              const rect = (e.target as HTMLElement).getBoundingClientRect();
                              setItemDropRect({ top: rect.bottom, left: rect.left, width: 300 });
                            }}
                          />
            {item.itemSearch && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => updateItem(idx, "itemSearch", "")} 
              />
            )}
                          
                          {item.productId && (
                            <div className="text-[10px] text-gray-500 mt-1 leading-tight">
                              {(() => {
                                let req = item.qty;
                                const u = String(item.unit).toUpperCase();
                                let conv = item.conversions?.find((c: any) => 
                                  c.unitId === item.unit || 
                                  c.unit?.code === item.unit || 
                                  c.unit?.name?.toUpperCase() === u || 
                                  c.unit?.shortName?.toUpperCase() === u
                                );
                                if (conv) req = item.qty * conv.multiplier;
                                
                                const baseName = item.baseUnit?.shortName || item.baseUnit?.name || "Units";
                                const isInsufficient = req > (item.availableStock || 0);
                                
                                return (
                                  <>
                                    Available: {item.availableStock || 0} {baseName}
                                    {req > 0 && ` | Req: ${req} ${baseName}`}
                                    {isInsufficient && <span className="text-red-500 font-semibold block mt-0.5">❌ Insufficient Stock</span>}
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {openItemDrop === item.id && itemDropRect && (
                            <div
                              className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                              style={{ position: "fixed", top: itemDropRect.top + 4, left: itemDropRect.left, width: itemDropRect.width, zIndex: 9999 }}
                            >
                              <button
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50 border-b border-gray-100 font-semibold text-left transition-colors"
                                onMouseDown={(e) => { 
                                  e.preventDefault(); 
                                  setAddingItemIdx(idx);
                                  setShowAddItem(true); 
                                  setOpenItemDrop(null);
                                }}
                              >
                                <Plus size={15} /> Add Item
                              </button>
                              <div className="max-h-48 overflow-y-auto">
                                {filtProd.length === 0 ? (
                                  <div className="px-3 py-4 text-xs text-gray-400 text-center">No matching products</div>
                                ) : (
                                  filtProd.map(p => (
                                    <button
                                      key={p.id}
                                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-orange-50 text-left border-b border-gray-50 last:border-0"
                                      onMouseDown={() => selectProduct(idx, p)}
                                    >
                                      <div>
                                        <div className="text-sm font-medium text-gray-800">{p.name}</div>
                                        <div className="text-xs text-gray-400">₹{p.basePrice || p.price || 0}</div>
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* BATCH NO */}
                        <td className="px-2 py-2.5">
                          {item.batches && item.batches.length > 0 ? (
                            <select
                              value={item.batchNumber || ""}
                              onChange={e => updateItem(idx, "batchNumber", e.target.value)}
                              className="w-full text-xs text-gray-700 outline-none bg-transparent cursor-pointer border border-gray-200 rounded px-1 py-0.5"
                            >
                              <option value="">Select Batch</option>
                              {item.batches.map((b: any) => (
                                <option key={b.id} value={b.batchCode}>
                                  {b.batchCode}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Batch No."
                              value={item.batchNumber || ""}
                              onChange={e => updateItem(idx, "batchNumber", e.target.value)}
                              className="w-full text-xs text-gray-700 text-center outline-none bg-transparent placeholder-gray-400 border border-gray-200 rounded px-1 py-0.5"
                            />
                          )}
                        </td>

                        {/* QTY */}
                        <td className="px-2 py-2.5">
                          <input
                            type="number" min={0}
                            value={item.qty}
                            onChange={e => updateItem(idx, "qty", Number(e.target.value))}
                            className="w-full text-sm text-gray-700 text-center outline-none bg-transparent"
                          />
                        </td>

                        {/* UNIT */}
                        <td style={{ position: "relative", overflow: "visible" }}>
                          <button
                            className="w-full flex items-center justify-center gap-0.5 px-2 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                            onClick={e => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setUnitDropRect({ top: rect.bottom, left: rect.left });
                              setOpenUnitDrop(v => v === item.id ? null : item.id);
                            }}
                          >
                            <span>{UNITS.find(u => u.code === item.unit)?.short ?? item.unit}</span>
                            <ChevronDown size={9} className="text-gray-400 shrink-0" />
                          </button>
                          {openUnitDrop === item.id && unitDropRect && (
                            <div
                              className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-y-auto"
                              style={{ position: "fixed", top: unitDropRect.top + 2, left: unitDropRect.left, width: 180, maxHeight: 220, zIndex: 9999 }}
                            >
                              {UNITS.map(u => (
                                <button
                                  key={u.code}
                                  className={clsx(
                                    "w-full text-left px-3 py-2 text-xs border-b border-gray-50 last:border-0 hover:bg-orange-50",
                                    item.unit === u.code ? "text-orange-600 font-semibold bg-orange-50" : "text-gray-700"
                                  )}
                                  onMouseDown={() => { updateItem(idx, "unit", u.code); setOpenUnitDrop(null); }}
                                >
                                  <span className="font-medium">{u.short}</span>
                                  <span className="text-gray-400 ml-1">– {u.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* PRICE/UNIT */}
                        <td className="px-3 py-2.5">
                          <input
                            type="number" min={0}
                            value={item.rate || ""}
                            placeholder="0"
                            onChange={e => updateItem(idx, "rate", Number(e.target.value))}
                            className="w-full text-sm text-gray-700 text-right outline-none bg-transparent"
                          />
                        </td>

                        {/* DISC% */}
                        <td className="px-2 py-2.5">
                          <input
                            type="number" min={0} max={100}
                            value={item.discountPct || ""}
                            placeholder="0"
                            onChange={e => updateItem(idx, "discountPct", Number(e.target.value))}
                            className="w-full text-sm text-gray-700 text-center outline-none bg-transparent"
                          />
                        </td>

                        {/* TAX */}
                        <td className="px-2 py-2.5">
                          <select
                            value={item.taxLabel || "NONE"}
                            onChange={e => {
                              const label = e.target.value;
                              const option = TAX_OPTIONS.find(o => o.label === label);
                              const val = option ? option.value : 0;
                              updateItem(idx, "taxLabel", label);
                              updateItem(idx, "taxPct", val);
                            }}
                            className="w-full text-xs text-gray-700 outline-none bg-transparent cursor-pointer"
                          >
                            {TAX_OPTIONS.map((t, index) => <option key={index} value={t.label}>{t.label}</option>)}
                          </select>
                        </td>

                        {/* AMOUNT */}
                        <td className="px-3 py-2.5 text-right text-sm font-medium text-gray-800">
                          {amount > 0 ? amount.toFixed(2) : "—"}
                        </td>

                        {/* DELETE */}
                        <td className="pr-2">
                          <button
                            onClick={() => removeRow(idx)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 border border-orange-200 hover:border-orange-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={13} /> Add Row
              </button>
              <span className="text-xs text-gray-500">Total Qty: <span className="font-semibold text-gray-700">{totalQty}</span></span>
            </div>
          </div>

          {/* Notes + Summary */}
          <div className="flex justify-between items-start pt-4 px-4 pb-8 bg-gray-50/30">
            {/* Left: Terms and Conditions */}
            <div className="w-64">
              {!showTerms ? (
                <button onClick={() => setShowTerms(true)} className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-600 border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded px-4 py-2 transition-colors uppercase w-full justify-center shadow-sm">
                  <AlignLeft size={14} /> ADD TERMS AND CONDITIONS
                </button>
              ) : (
                <textarea value={termsText} onChange={e => setTermsText(e.target.value)} rows={3} placeholder="Terms and conditions..." className="w-full text-xs text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none resize-none shadow-sm" />
              )}
            </div>

            {/* Middle: Payment Type and Attachments */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-start w-32 relative mt-2">
                <span className="text-[10px] text-gray-500 absolute -top-2 left-2 bg-gray-50 px-1 z-10">Payment Type</span>
                <select
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value as any)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none bg-transparent appearance-none"
                >
                  <option value="CASH">Cash</option>
                  <option value="CREDIT">Credit</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-2 text-gray-400 pointer-events-none" />
                <button className="text-[10px] text-blue-500 hover:text-blue-600 font-bold mt-1.5 self-start">+ Add Payment type</button>
              </div>

              <div className="flex flex-col gap-2 w-40">
                {!showDesc ? (
                  <button onClick={() => setShowDesc(true)} className="flex items-center gap-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded px-3 py-1.5 transition-colors uppercase justify-center w-full shadow-sm">
                    <FileText size={12} /> ADD DESCRIPTION
                  </button>
                ) : (
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Description..." className="w-full text-xs text-gray-700 border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none resize-none shadow-sm" />
                )}

              </div>
            </div>

            {/* Right: Summary */}
            <div className="w-72 flex flex-col items-end gap-2 text-xs font-semibold text-gray-700">
              <div className="flex items-center gap-3 w-full justify-end">
                <label className="flex items-center gap-1.5 cursor-pointer mr-2">
                  <input type="checkbox" checked={roundOffEnabled} onChange={e => setRoundOffEnabled(e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                  <span className="text-[11px] text-gray-500">Round Off</span>
                </label>
                <input type="text" readOnly value={roundOff >= 0 ? roundOff.toFixed(2) : roundOff.toFixed(2)} className="w-16 border border-gray-200 rounded px-2 py-1 bg-white text-right text-[11px]" />
                <span className="w-12 text-right text-gray-600">Total</span>
                <input type="text" readOnly value={finalTotal.toFixed(2)} className="w-24 border border-gray-200 bg-gray-50 rounded px-2 py-1 text-right font-bold text-gray-800 shadow-inner" />
              </div>
              <div className="flex items-center gap-3 w-full justify-end">
                <span className="w-16 text-right text-gray-600">Received</span>
                <input type="number" placeholder="0" className="w-24 border border-gray-200 rounded px-2 py-1 bg-white text-right outline-none focus:border-blue-400 shadow-sm" />
              </div>
              <div className="flex items-center gap-3 w-full justify-end pr-[104px] mt-1">
                <span className="w-16 text-right text-gray-800 font-bold">Balance</span>
                <span className="w-auto text-right font-bold text-gray-800">{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Action Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-60"
          >
            Save Draft
          </button>
          <button
            onClick={handleBack}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
          >
            Cancel
          </button>

          {/* Share dropdown */}
          <div className="relative" ref={shareDropRef}>
            <div className="flex rounded-lg overflow-hidden">
              <button
                onClick={() => showToast("Share feature coming soon", "info")}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 border-r border-orange-400"
              >
                Share
              </button>
              <button
                onClick={() => setShowShareDrop(v => !v)}
                className="px-2 py-2 text-sm text-white bg-orange-500 hover:bg-orange-600"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            {showShareDrop && (
              <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg text-sm min-w-[160px] z-50">
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700">Generate e-Invoice</button>
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                  <Share2 size={13} /> Share
                </button>
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                  <Printer size={13} /> Print
                </button>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700"
                  onClick={async () => { setShowShareDrop(false); await handleSave(false); openCreate(); }}
                >
                  Save &amp; New
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-6 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      {/* ── Add Party Modal ── */}
      <AddPartyModal
        isOpen={showAddParty}
        onClose={() => {
          setShowAddParty(false);
          setNewParty({ name: "", phone: "", email: "", gstin: "", gstType: "Unregistered/Consumer", state: "", city: "", pincode: "", billingAddress: "", shippingAddress: "", openingBalance: "", creditLimit: "" });
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
            setNewParty({ name: "", phone: "", email: "", gstin: "", gstType: "Unregistered/Consumer", state: "", city: "", pincode: "", billingAddress: "", shippingAddress: "", openingBalance: "", creditLimit: "" });
          } catch (e: any) {
            showToast(e?.response?.data?.error || "Failed to create party", "error");
            throw e;
          }
        }}
      />

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 z-[999] bg-white overflow-y-auto w-full h-full">
          <AddInventoryProductForm
            isModal={true}
            onCancel={() => {
              setShowAddItem(false);
              setAddingItemIdx(null);
            }}
            onSuccess={(createdProduct) => {
              setShowAddItem(false);
              setProducts((prev) => [...prev, createdProduct].sort((a, b) => a.name.localeCompare(b.name)));
              if (addingItemIdx !== null) {
                selectProduct(addingItemIdx, createdProduct);
              }
              setAddingItemIdx(null);
            }}
          />
        </div>
      )}

    </div>
  );
}
  // LIST VIEW — Simplified Clean UI
  // ════════════════════════════════════════════════════════════════════════════
  const fmt = (d: string) => formatDate(d + "T00:00:00");

  const nonDraft     = filtered.filter(i => i.status !== "DRAFT");
  const totalAmt     = nonDraft.reduce((s, i) => s + (i.finalAmount || 0), 0);
  const receivedAmt  = nonDraft.filter(i => i.status === "PAID").reduce((s, i) => s + (i.finalAmount || 0), 0);
  const balanceAmt   = totalAmt - receivedAmt;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#f58220]" />
          Sale Invoices
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Sales",   value: `₹${totalAmt.toLocaleString("en-IN")}`,     color: "text-gray-700",    dot: "bg-gray-400" },
            { label: "Received",      value: `₹${receivedAmt.toLocaleString("en-IN")}`,  color: "text-emerald-600", dot: "bg-emerald-500" },
            { label: "Balance Due",   value: `₹${balanceAmt.toLocaleString("en-IN")}`,   color: "text-rose-600",    dot: "bg-rose-500" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full", s.dot)} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={clsx("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice or customer..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            {["ALL", "SENT", "PAID", "DRAFT"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-2 text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {s === "ALL" ? "All" : s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm text-gray-700 relative">
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900" onClick={() => setShowFromCal(v => !v)}>
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{fmt(dateFrom)}</span>
            </div>
            {showFromCal && (
              <div className="absolute top-full left-0 mt-1 z-50" ref={fromCalRef}>
                <MiniCalendar value={dateFrom} onChange={setDateFrom} onClose={() => setShowFromCal(false)} />
              </div>
            )}
            <span className="text-gray-300 px-1">to</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900" onClick={() => setShowToCal(v => !v)}>
              <span className="font-medium">{fmt(dateTo)}</span>
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            {showToCal && (
              <div className="absolute top-full right-0 mt-1 z-50" ref={toCalRef}>
                <MiniCalendar value={dateTo} onChange={setDateTo} onClose={() => setShowToCal(false)} />
              </div>
            )}
          </div>

          <div className="flex-1" />
          <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* ── Empty State ── */}
        {loading ? (
          <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <Receipt className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Invoices Found</p>
              <p className="text-gray-500 text-sm mt-1">Create an invoice to start billing your customers.</p>
            </div>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Create Invoice
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Invoice No</th>
                  <th className="text-left px-4 py-3">Party Name</th>
                  <th className="text-left px-4 py-3">Pay Type</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((inv) => {
                  const isPaid   = inv.status === "PAID";
                  const isDraft  = inv.status === "DRAFT";
                  const balance  = isPaid || isDraft ? 0 : (inv.finalAmount || 0);
                  const style = STATUS_STYLES[inv.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr 
                      key={inv.id} 
                      className={clsx(
                        "transition-colors",
                        isDraft ? "hover:bg-orange-50/50 cursor-pointer bg-orange-50/30" : "hover:bg-gray-50"
                      )}
                      onClick={() => {
                        if (isDraft) loadDraft(inv);
                      }}
                    >
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">
                        {inv.order?.invoiceNum
                          ? formatERPNumber("INV", inv.order.invoiceNum, inv.createdAt)
                          : (inv.status === "DRAFT" ? "Not yet numbered" : "Lite Sale")}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium text-gray-800">
                          {inv.order?.customer?.name || "Walk-In Customer"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {/* Source of truth is the order's own paymentType — `inv.paymentMode`
                            isn't a field the Invoice API returns, so that half of the old check
                            was always false. Falling through to "Credit" for a missing/unmapped
                            value was also backwards: the Order schema's own default is CASH, so
                            anything not explicitly CREDIT should read as Cash, not the other way
                            around. */}
                        {inv.order?.paymentType === "CREDIT" ? "Credit" : "Cash"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        ₹ {(inv.finalAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-rose-600">
                        {balance > 0 ? `₹ ${balance.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isDraft ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDraft(inv.id); }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Draft"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePrint(inv); }}
                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="Print"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); }}
                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="Share"
                              >
                                <Share2 className="h-4 w-4" />
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
        )}

        {printingInvoice && (
          <GSTInvoice
            order={{
              ...printingInvoice,
              id: printingInvoice.id,
              poNumber: printingInvoice.order?.invoiceNum ? (printingInvoice.order.invoiceNum.startsWith('INV') ? printingInvoice.order.invoiceNum : `INV-${printingInvoice.order.invoiceNum}`) : undefined,
              createdAt: printingInvoice.createdAt,
              items: (printingInvoice.order?.orderItems || []).map((it: any) => ({
                itemName: it.product?.name || "Unknown Item",
                quantity: it.quantity,
                price: it.price,
                gstRate: it.taxAmount > 0 ? ((it.taxAmount / (it.quantity * it.price)) * 100).toFixed(0) : 0,
                hsnCode: it.product?.hsnCode || '—'
              }))
            }}
            vendor={printingInvoice.order?.customer || { name: 'Walk-In Customer' }}
            companyDetails={{
              name: 'Kiddos Food',
              address: '123 Business Park, Block A\nBengaluru, Karnataka - 560001',
              gstin: '29ABCDE1234F1Z5',
              state: 'Karnataka',
              email: 'hello@kiddosfood.com',
              phone: '+91 98765 43210'
            }}
            onClose={() => setPrintingInvoice(null)}
          />
        )}
      </div>
    </div>
  );
}
