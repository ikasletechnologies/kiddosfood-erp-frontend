"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Receipt, Plus, Search, RefreshCw, X, User,
  Printer, ChevronDown, Trash2, Check, Share2, Calendar,
  AlignLeft, FileText, ArrowLeft, Truck
} from "lucide-react";
import { clsx } from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { customersApi, productsFullApi, draftsApi, franchiseApi, settingsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatERPNumber, formatDate } from "@/lib/utils";
import api from "@/lib/api/base";
import AddPartyModal from "@/components/modals/AddPartyModal";
import AddInventoryProductForm from "@/components/modules/inventory/AddInventoryProductForm";
import GSTInvoice from "@/components/documents/GSTInvoice";

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
  SENT:     { label: "Sent",     color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20" },
  PAID:     { label: "Paid",     color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  PARTIAL:  { label: "Partial",  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",   border: "border-amber-200 dark:border-amber-500/20" },
  OVERDUE:  { label: "Overdue",  color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-500/10",    border: "border-rose-200 dark:border-rose-500/20" },
  CANCELLED:{ label: "Cancelled",color: "text-slate-400 dark:text-slate-500",   bg: "bg-slate-100 dark:bg-white/5",  border: "border-slate-200 dark:border-white/10" },
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
    <div className="bg-white dark:bg-card rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 p-3 w-64 select-none animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400">
          <ChevronDown size={14} className="rotate-90" />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-white">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400">
          <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 py-0.5">{d}</div>
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
              isSelected(d) && "bg-[#f58220] text-white",
              !isSelected(d) && isToday(d) && "bg-orange-100 dark:bg-orange-500/20 text-[#f58220]",
              !isSelected(d) && !isToday(d) && "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5"
            )}
          >{d}</button>
        ))}
      </div>
      {/* Footer */}
      <div className="mt-2 flex justify-between items-center border-t border-gray-100 dark:border-white/5 pt-2">
        <button
          onClick={() => {
            const t = new Date();
            const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
            onChange(iso);
            onClose();
          }}
          className="text-[11px] font-semibold text-[#f58220] hover:text-[#e8740e]"
        >Today</button>
        <button onClick={onClose} className="text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Close</button>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function SalesInvoicesClient({ initialView = "list" }: { initialView?: "list" | "create" }) {
  const { showToast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const isFranchiseUser = user?.role?.toUpperCase() === "FRANCHISE_ADMIN";

  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>(user?.franchiseId || "");

  // shared
  const [view, setView] = useState<"list" | "create">(initialView);
  const [viewInvoice, setViewInvoice] = useState<any>(null); // Tax Invoice deep-link view
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [printingInvoice, setPrintingInvoice] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // list date filters
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
  const [showToCal,   setShowToCal]   = useState(false);
  const fromCalRef = useRef<HTMLDivElement>(null);
  const toCalRef   = useRef<HTMLDivElement>(null);

  // create form
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [stateOfSupply, setStateOfSupply] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [items, setItems] = useState<LineItem[]>([makeItem(), makeItem()]);
  const [priceMode, setPriceMode] = useState<"without_tax" | "with_tax">("without_tax");
  const [showPriceDrop, setShowPriceDrop] = useState(false);
  const [openItemDrop, setOpenItemDrop] = useState<string | null>(null);
  const [itemDropRect, setItemDropRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [openUnitDrop, setOpenUnitDrop] = useState<string | null>(null);
  const [unitDropRect, setUnitDropRect] = useState<{ top: number; left: number } | null>(null);
  const [termsText, setTermsText] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [description, setDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT">("CASH");
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  // Add Party inline form
  const [showAddParty, setShowAddParty] = useState(false);
  const [newParty, setNewParty] = useState({ name: "", phone: "", email: "", gstin: "", gstType: "Unregistered/Consumer", state: "", city: "", pincode: "", billingAddress: "", shippingAddress: "", openingBalance: "", creditLimit: "" });

  // Add Item inline form
  const [showAddItem, setShowAddItem] = useState(false);
  const [addingItemIdx, setAddingItemIdx] = useState<number | null>(null);

  // Custom calendar
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const customerDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef    = useRef<HTMLDivElement>(null);
  const priceDropRef    = useRef<HTMLDivElement>(null);

  // Deep-link handling (?id=...) & Query param view handling
  useEffect(() => {
    const action = searchParams.get("action");
    const viewParam = searchParams.get("view");
    if (action === "new" || action === "create" || viewParam === "create" || initialView === "create") {
      setView("create");
    }

    const id = searchParams.get("id");
    if (!id) return;
    const loadDeepLinked = async () => {
      try {
        const res = await api.get(`/api/sales/invoices/${id}`);
        if (res.data) setViewInvoice(res.data);
      } catch {
        try {
          const res = await api.get(`/api/sales/orders/${id}`);
          if (res.data) setViewInvoice(res.data);
        } catch {
          showToast("Failed to load invoice details", "error");
        }
      }
    };
    loadDeepLinked();
  }, [searchParams, initialView, showToast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, custRes, prodRes, franRes] = await Promise.allSettled([
        api.get(`/api/sales/invoices?startDate=${dateFrom}&endDate=${dateTo}`).catch(() => ({ data: [] })),
        customersApi.getAll(),
        productsFullApi.getAll(),
        franchiseApi.getAll(),
      ]);

      if (invRes.status === "fulfilled") {
        setInvoices(invRes.value.data || []);
      }
      if (custRes.status === "fulfilled") {
        const cData = custRes.value.data?.customers || custRes.value.data || [];
        setCustomers(Array.isArray(cData) ? cData : []);
      }
      if (prodRes.status === "fulfilled") {
        const pData = prodRes.value.data?.data || prodRes.value.data || [];
        setProducts(Array.isArray(pData) ? pData : []);
      }
      if (franRes.status === "fulfilled") {
        const fData = (franRes.value.data as any)?.franchises || franRes.value.data || [];
        setFranchises(Array.isArray(fData) ? fData : []);
      }
    } catch {
      showToast("Failed to load invoices", "error");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => setCompanyProfile(res.data))
      .catch(() => {});
  }, []);

  // Close popups on outside click
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
      if (fromCalRef.current && !fromCalRef.current.contains(e.target as Node))
        setShowFromCal(false);
      if (toCalRef.current && !toCalRef.current.contains(e.target as Node))
        setShowToCal(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Computed totals ────────────────────────────────────────────────────────
  const withTax = priceMode === "with_tax";
  const rowData = items.map(item => ({ item, ...computeRow(item, withTax) }));
  const totalQty = items
    .filter(i => i.productId || i.itemSearch.trim())
    .reduce((s, i) => s + i.qty, 0);
  const totalDisc = rowData.reduce((s, r) => s + r.discAmt, 0);
  const totalTax = rowData.reduce((s, r) => s + r.taxAmt, 0);
  const totalAmount = rowData.reduce((s, r) => s + r.amount, 0);
  const roundOff = roundOffEnabled ? (Math.round(totalAmount) - totalAmount) : 0;
  const finalTotal = totalAmount + roundOff;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setDraftId(null);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerPhone("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setStateOfSupply("");
    setInvoiceNumber("");
    setItems([makeItem(), makeItem()]);
    setPriceMode("without_tax");
    setTermsText("");
    setShowTerms(false);
    setDescription("");
    setShowDesc(false);
    setRoundOffEnabled(true);
    setPaymentType("CASH");
    setView("create");
  };

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name || "");
    setCustomerPhone(c.contact || c.phone || "");
    if (c.state) setStateOfSupply(c.state);
    setShowCustomerDrop(false);
  };

  const selectProduct = (idx: number, p: any) => {
    const taxPct = p.gstRate ?? p.taxPercent ?? 0;
    const validBatches = Array.isArray(p.batches) 
      ? p.batches.filter((b: any) => (b.quantity || b.currentStock || 0) > 0)
      : [];
    const firstBatch = validBatches.length > 0 ? validBatches[0].batchCode : "";

    setItems(prev => prev.map((it, i) =>
      i === idx ? {
        ...it,
        productId: p.id,
        itemSearch: p.name,
        rate: p.basePrice || p.price || 0,
        basePrice: p.basePrice || p.price || 0,
        unit: p.unit?.code || p.unit || "NONE",
        baseUnit: p.baseUnit || p.unit,
        conversions: p.conversions || [],
        availableStock: p.currentStock !== undefined ? p.currentStock : (p.stock || 0),
        taxPct,
        taxLabel: TAX_OPTIONS.find(o => o.value === taxPct)?.label || "NONE",
        batchNumber: firstBatch,
        batches: validBatches,
      } : it
    ));
    setOpenItemDrop(null);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addRow = () => setItems(prev => [...prev, makeItem()]);

  const removeRow = (idx: number) => {
    if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (isDraft = false) => {
    const hasAnyData = !!selectedCustomer || !!customerSearch.trim() || items.some(i => i.productId || i.itemSearch.trim());
    if (isDraft && !hasAnyData) {
      setView("list");
      return;
    }
    if (!isDraft && !selectedCustomer) { showToast("Please select a customer", "error"); return; }

    const validItems = items.filter(i => (i.productId || i.itemSearch.trim()) && i.qty > 0 && i.rate > 0);
    if (!isDraft && validItems.length === 0) { showToast("Add at least one item with price", "error"); return; }

    const itemsToSave = isDraft ? items.filter(i => i.productId || i.itemSearch.trim()) : validItems;

    setSaving(true);
    try {
      const payload: any = {
        franchiseId: selectedFranchiseId || undefined,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer ? selectedCustomer.name : (customerSearch || undefined),
        customerPhone,
        invoiceNum: invoiceNumber.trim() || undefined,
        invoiceDate,
        stateOfSupply: stateOfSupply || undefined,
        paymentType,
        isDraft,
        items: itemsToSave.map(i => ({
          productId: i.productId || undefined,
          productName: i.itemSearch,
          quantity: i.qty || 0,
          unit: i.unit,
          price: i.rate || 0,
          taxPercent: i.taxPct,
          discountAmount: (i.qty * i.rate * (i.discountPct || 0)) / 100,
          batchNumber: i.batchNumber || undefined,
        })),
        discountAmount: totalDisc,
        termsConditions: showTerms ? (termsText || undefined) : undefined,
        notes: showDesc ? (description || undefined) : undefined,
      };

      if (isDraft) {
        const dRes: any = await draftsApi.saveDraft({
          id: draftId || undefined,
          type: "SALES_INVOICE",
          name: selectedCustomer?.name || customerSearch || "Draft Invoice",
          state: { ...payload, items, priceMode, showTerms, termsText, showDesc, description, roundOffEnabled }
        });
        if (dRes?.data?.id) setDraftId(dRes.data.id);
        showToast("Draft saved successfully", "success");
      } else {
        await api.post("/api/sales/invoices", payload);
        if (draftId) {
          await draftsApi.deleteDraft(draftId).catch(() => {});
        }
        showToast("Invoice created successfully", "success");
      }

      fetchData();
      if (initialView === "create") {
        router.push("/sales/invoices");
      } else {
        setView("list");
      }
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to save invoice", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await draftsApi.deleteDraft(id);
      showToast("Draft deleted", "success");
      fetchData();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to delete draft", "error");
    }
  };

  const loadDraft = (inv: any) => {
    const raw = inv.order || inv;
    const rawState = raw._rawState || {};
    setDraftId(inv.id);
    setSelectedCustomer(rawState.selectedCustomer || raw.customer || null);
    setCustomerSearch(rawState.customerSearch || raw.customer?.name || raw.customerName || "");
    setCustomerPhone(rawState.customerPhone || raw.customerPhone || raw.customer?.phone || "");
    setInvoiceDate(rawState.invoiceDate || raw.invoiceDate || new Date().toISOString().split("T")[0]);
    setStateOfSupply(rawState.stateOfSupply || raw.stateOfSupply || "");
    setInvoiceNumber(rawState.invoiceNumber || raw.invoiceNum || "");
    setPaymentType(rawState.paymentType || raw.paymentType || "CASH");
    if (rawState.items && rawState.items.length > 0) {
      setItems(rawState.items);
    } else if (raw.orderItems && raw.orderItems.length > 0) {
      setItems(raw.orderItems.map((oi: any) => ({
        id: Math.random().toString(36).slice(2),
        productId: oi.productId || "",
        itemSearch: oi.product?.name || oi.productName || "",
        qty: oi.quantity || 1,
        unit: oi.unit || "NONE",
        rate: oi.price || 0,
        basePrice: oi.price || 0,
        discountPct: oi.discountAmount ? (oi.discountAmount / (oi.quantity * oi.price)) * 100 : 0,
        taxPct: oi.taxPercent || oi.gstRate || 0,
        taxLabel: TAX_OPTIONS.find(o => o.value === (oi.taxPercent || oi.gstRate || 0))?.label || "NONE",
        batchNumber: oi.batchNumber || "",
        batches: [],
      })));
    } else {
      setItems([makeItem(), makeItem()]);
    }
    setPriceMode(rawState.priceMode || "without_tax");
    setTermsText(rawState.termsText || raw.termsConditions || "");
    setShowTerms(rawState.showTerms || !!raw.termsConditions);
    setDescription(rawState.description || raw.notes || "");
    setShowDesc(rawState.showDesc || !!raw.notes);
    setRoundOffEnabled(rawState.roundOffEnabled ?? true);
    setView("create");
  };

  const handlePrint = (inv: any) => {
    setPrintingInvoice(inv);
  };

  const handleBack = () => {
    const hasAnyData = !!selectedCustomer || !!customerSearch.trim() || items.some(i => i.productId || i.itemSearch.trim());
    if (hasAnyData) {
      handleSave(true);
    } else {
      if (initialView === "create") {
        router.push("/sales/invoices");
      } else {
        setView("list");
      }
    }
  };

  const filtered = invoices.filter(inv => {
    const matchSearch = !search ||
      (inv.order?.invoiceNum || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.order?.customer?.name || inv.customerName || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const nonDraft     = filtered.filter(i => i.status !== "DRAFT");
  const totalAmt     = nonDraft.reduce((s, i) => s + (i.finalAmount || 0), 0);
  const receivedAmt  = nonDraft.filter(i => i.status === "PAID").reduce((s, i) => s + (i.finalAmount || 0), 0);
  const balanceAmt   = totalAmt - receivedAmt;

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    (c.name || "").toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.contact && c.contact.includes(customerSearch)) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  // ══════════════════════════════════════════════════════════════════════════
  // TAX INVOICE DEEP-LINK VIEW (read-only, populated from ?id= param)
  // ══════════════════════════════════════════════════════════════════════════
  if (viewInvoice) {
    const inv = viewInvoice;
    const items = inv.orderItems || [];
    const customer = inv.customer || {};
    const invoice = inv.invoice || {};
    const payments = inv.payments || [];
    const paidAmt = payments
      .filter((p: any) => p.status === "PAID" && !p.isCancelled)
      .reduce((s: number, p: any) => s + (p.paidAmount || 0), 0);
    const balance = Math.max(0, (inv.totalAmount || 0) - paidAmt);

    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 min-h-screen w-full min-w-0">
        {/* Top bar */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xs w-full min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                setViewInvoice(null);
                window.history.replaceState({}, "", window.location.pathname);
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 transition-colors shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                Tax Invoice — {inv.invoiceNum || "—"}
              </h2>
              {inv.sourceProformaInvoiceId && (
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                  Source Proforma: <span className="font-mono font-semibold text-[#f58220]">{inv.sourceProformaNumber || inv.sourceProformaInvoiceId}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className={clsx(
              "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border",
              invoice.status === "PAID" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
              : invoice.status === "PARTIAL" ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
              : "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
            )}>
              {invoice.status || inv.paymentStatus || "UNPAID"}
            </span>
            {invoice.id && balance > 0.01 && (
              <button
                onClick={() => router.push(
                  `/sales/payment-in?invoiceId=${invoice.id}&partyType=${inv.partyType || "CUSTOMER"}&partyId=${inv.partyId || inv.customerId || ""}`
                )}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#f58220] hover:bg-[#e8740e] rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                Record Payment
              </button>
            )}
            <button
              onClick={() => router.push(`/sales/delivery-challan?sourceInvoiceId=${inv.id}`)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-card border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            >
              Create Delivery Challan
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 md:p-6 space-y-4 w-full min-w-0">
          {/* Party + Invoice Meta */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 w-full min-w-0 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full min-w-0">
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Party Details</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Type: <span className="text-gray-800 dark:text-white font-bold">{inv.partyType || "CUSTOMER"}</span></p>
                <p className="text-base font-bold text-gray-900 dark:text-white truncate">{customer.name || inv.customerName || "—"}</p>
                {customer.contact && <p className="text-sm text-gray-600 dark:text-slate-300">{customer.contact}</p>}
                {customer.phone && <p className="text-sm text-gray-600 dark:text-slate-300">{customer.phone}</p>}
                {customer.email && <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{customer.email}</p>}
                {customer.gstNumber && <p className="text-xs text-gray-500 dark:text-slate-400 font-mono">GSTIN: {customer.gstNumber}</p>}
              </div>
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Invoice Information</p>
                <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">Invoice No.</span><span className="font-mono font-bold text-gray-900 dark:text-white">{inv.invoiceNum || "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">Date</span><span className="text-gray-700 dark:text-slate-300">{inv.createdAt ? formatDate(inv.createdAt) : "—"}</span></div>
                {inv.stateOfSupply && <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">State of Supply</span><span className="text-gray-700 dark:text-slate-300">{inv.stateOfSupply}</span></div>}
                <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">Payment Type</span><span className="text-gray-700 dark:text-slate-300">{inv.paymentType || inv.paymentMode || "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">Order Type</span><span className="text-gray-700 dark:text-slate-300">{inv.orderType || "TAX_INVOICE"}</span></div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0 shadow-2xs">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Items</span>
            </div>
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left w-8">#</th>
                    <th className="px-4 py-2.5 text-left">Product</th>
                    <th className="px-4 py-2.5 text-center">Qty</th>
                    <th className="px-4 py-2.5 text-center">UOM</th>
                    <th className="px-4 py-2.5 text-right">Rate</th>
                    <th className="px-4 py-2.5 text-center">Tax %</th>
                    <th className="px-4 py-2.5 text-right">Tax Amt</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {items.map((it: any, idx: number) => (
                    <tr key={it.id || idx} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-gray-900 dark:text-white">{it.product?.name || it.productName || "—"}</div>
                        {it.productId && <div className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">{it.productId}</div>}
                        {it.batchNumber && <div className="text-[10px] text-gray-500 dark:text-slate-400">Batch: {it.batchNumber}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-center dark:text-slate-200">{it.quantity}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500 dark:text-slate-400">{it.unit || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono dark:text-slate-200">₹{Number(it.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500 dark:text-slate-400">{it.taxPercent ?? it.gstRate ?? "—"}%</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300">₹{Number(it.taxAmount || 0).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900 dark:text-white">₹{Number(it.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals + Payment */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start w-full min-w-0">
            {/* Payment history */}
            {payments.length > 0 && (
              <div className="flex-1 bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 min-w-0 shadow-2xs">
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Payment History</p>
                <div className="space-y-1.5">
                  {payments.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-50 dark:border-white/5 last:border-0">
                      <span className={clsx("text-gray-600 dark:text-slate-300", (p.isCancelled || p.status !== "PAID") && "line-through opacity-60")}>
                        {p.paymentMode || "Payment"} — {p.createdAt ? formatDate(p.createdAt) : ""}
                        {p.isCancelled ? " (Cancelled)" : p.status !== "PAID" ? ` (${p.status})` : ""}
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹{Number(p.paidAmount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary card */}
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 w-full lg:w-80 shrink-0 space-y-2 shadow-2xs">
              <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">Subtotal</span><span className="font-mono font-semibold text-gray-700 dark:text-slate-200">₹{(inv.subTotal || 0).toFixed(2)}</span></div>
              {(inv.taxAmount > 0) && <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">Tax</span><span className="font-mono text-gray-600 dark:text-slate-300">₹{Number(inv.taxAmount || 0).toFixed(2)}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-gray-500 dark:text-slate-400">Round Off</span><span className="font-mono text-gray-600 dark:text-slate-300">₹{Number(inv.roundOff || 0).toFixed(2)}</span></div>
              <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex justify-between"><span className="font-bold text-gray-800 dark:text-white">Total</span><span className="text-lg font-bold font-mono text-[#f58220]">₹{Number(inv.totalAmount || 0).toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-emerald-600 dark:text-emerald-400 font-medium">Paid</span><span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">₹{paidAmt.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm font-semibold"><span className={balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>Balance</span><span className={clsx("font-mono", balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>₹{balance.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE VIEW — Full-page form
  // ══════════════════════════════════════════════════════════════════════════
  if (view === "create") {
    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 min-h-screen w-full min-w-0">

        {/* Top bar */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xs w-full min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={handleBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 transition-colors cursor-pointer shrink-0">
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
              {draftId ? "Edit Draft Invoice" : "New Sale Invoice"}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {!isFranchiseUser && (
              <select
                value={selectedFranchiseId}
                onChange={e => setSelectedFranchiseId(e.target.value)}
                className="text-xs font-semibold border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 outline-none bg-white dark:bg-[#13151f] text-gray-700 dark:text-slate-200"
              >
                {franchises.length === 0 && <option value="" className="dark:bg-card">No branches found</option>}
                {franchises.map((f: any) => (
                  <option key={f.id} value={f.id} className="dark:bg-card">{f.name}</option>
                ))}
              </select>
            )}
            <span className="text-xs text-gray-400 dark:text-slate-500">
              Invoice No: <span className="text-[#f58220] font-bold font-mono">{invoiceNumber || "Auto"}</span>
            </span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 md:p-6 space-y-4 w-full min-w-0">

          {/* Customer + Invoice Details */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 w-full min-w-0 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full min-w-0">
              {/* Left: Customer */}
              <div className="space-y-3 sm:space-y-4 min-w-0">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Customer *</label>
                  <div className="relative" ref={customerDropRef}>
                    <div
                      className={clsx(
                        "flex items-center gap-2 border rounded-xl px-3 py-2 cursor-pointer bg-white dark:bg-[#13151f] transition-all",
                        showCustomerDrop ? "border-orange-400 ring-1 ring-orange-200 dark:ring-orange-500/20" : "border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20"
                      )}
                      onClick={() => setShowCustomerDrop(v => !v)}
                    >
                      <User size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
                      <input
                        className="flex-1 text-xs sm:text-sm text-gray-700 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder:text-slate-500"
                        placeholder="Search by Name/Phone"
                        value={customerSearch}
                        onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                        onClick={e => { e.stopPropagation(); setShowCustomerDrop(true); }}
                      />
                      {customerSearch && (
                        <X 
                          size={14} 
                          className="text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0" 
                          onClick={() => setCustomerSearch("")} 
                        />
                      )}
                      <ChevronDown size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
                    </div>
                    {showCustomerDrop && (
                      <div className="absolute top-full left-0 z-50 mt-1 w-full max-w-[calc(100vw-2rem)] bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm text-[#f58220] dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 border-b border-gray-100 dark:border-white/5 font-semibold"
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
                          Add Party
                        </button>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                          {filteredCustomers.length === 0 ? (
                            <div className="px-3 py-4 text-xs sm:text-sm text-gray-400 dark:text-slate-500 text-center">No customers found</div>
                          ) : (
                            filteredCustomers.map(c => (
                              <button
                                key={c.id}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors"
                                onClick={() => selectCustomer(c)}
                              >
                                <div className="text-left">
                                  <div className="text-xs sm:text-sm font-medium text-gray-800 dark:text-white">{c.name}</div>
                                  <div className="text-[11px] text-gray-400 dark:text-slate-500">{c.phone || c.contact || "—"}</div>
                                </div>
                                {(c.balance !== undefined && c.balance !== 0) && (
                                  <div className="flex items-center gap-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-0.5 rounded">
                                    ₹{c.balance}<Check size={10} />
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
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Phone</label>
                  <input
                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder:text-slate-500 transition-colors"
                    placeholder="Phone Number"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Right: Invoice Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Invoice Number</label>
                  <input
                    type="text"
                    placeholder="Auto"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Invoice Date</label>
                  <div className="relative" ref={calendarRef}>
                    <button
                      type="button"
                      onClick={() => setShowCalendar(v => !v)}
                      className="w-full flex items-center justify-between text-xs sm:text-sm text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-[#13151f] hover:border-orange-400 transition-colors"
                    >
                      <span className="truncate">{invoiceDate ? formatDate(invoiceDate + "T00:00:00") : "Pick date"}</span>
                      <Calendar size={14} className="text-[#f58220] shrink-0" />
                    </button>
                    {showCalendar && (
                      <div className="absolute right-0 top-full mt-1.5 z-[200]">
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
                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-[#13151f] text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-400 transition-colors"
                  >
                    <option value="" className="dark:bg-card">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s} className="dark:bg-card">{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0 shadow-2xs">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Items</span>
              <div className="relative" ref={priceDropRef}>
                <button
                  type="button"
                  onClick={() => setShowPriceDrop(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1 bg-white dark:bg-[#13151f] hover:border-orange-400 transition-colors"
                >
                  Price: {priceMode === "without_tax" ? "Excl. Tax" : "Incl. Tax"}
                  <ChevronDown size={12} />
                </button>
                {showPriceDrop && (
                  <div className="absolute top-full right-0 mt-1 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl text-xs w-48 z-50 overflow-hidden">
                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 font-medium" onClick={() => { setPriceMode("without_tax"); setShowPriceDrop(false); }}>Excl. Tax (Without Tax)</button>
                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 font-medium" onClick={() => { setPriceMode("with_tax"); setShowPriceDrop(false); }}>Incl. Tax (With Tax)</button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="w-8 px-3 py-2.5 text-center">#</th>
                    <th className="px-3 py-2.5 text-left">Item</th>
                    <th className="w-28 px-2 py-2.5 text-center">Batch No.</th>
                    <th className="w-16 px-2 py-2.5 text-center">Qty</th>
                    <th className="w-24 px-2 py-2.5 text-center">Unit</th>
                    <th className="w-24 px-3 py-2.5 text-right">Price/Unit</th>
                    <th className="w-16 px-2 py-2.5 text-center">Disc%</th>
                    <th className="w-36 px-2 py-2.5 text-center">Tax</th>
                    <th className="w-24 px-3 py-2.5 text-right">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {items.map((item, idx) => {
                    const { discAmt, taxAmt, amount } = computeRow(item, withTax);
                    const filtProd = products.filter(p =>
                      !item.itemSearch || (p.name || "").toLowerCase().includes(item.itemSearch.toLowerCase())
                    ).slice(0, 10);

                    return (
                      <tr key={item.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-orange-50/20 dark:hover:bg-white/[0.02] group transition-colors">
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400 dark:text-slate-500">{idx + 1}</td>

                        {/* ITEM */}
                        <td className="px-3 py-2" style={{ position: "relative", overflow: "visible" }}>
                          <input
                            className="w-full text-sm text-gray-700 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder:text-slate-500"
                            placeholder="Search item..."
                            value={item.itemSearch}
                            onChange={e => {
                              updateItem(idx, "itemSearch", e.target.value);
                              updateItem(idx, "productId", "");
                              setOpenItemDrop(item.id);
                            }}
                            onFocus={e => {
                              setOpenItemDrop(item.id);
                              if (typeof window !== "undefined") {
                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                const dropWidth = Math.min(300, window.innerWidth - 32);
                                const leftPos = Math.max(16, Math.min(rect.left, window.innerWidth - dropWidth - 16));
                                setItemDropRect({ top: rect.bottom, left: leftPos, width: dropWidth });
                              }
                            }}
                          />
                          {item.itemSearch && (
                            <X 
                              size={14} 
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                              onClick={() => updateItem(idx, "itemSearch", "")} 
                            />
                          )}
                          
                          {item.productId && (
                            <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-1 leading-tight">
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
                                    {isInsufficient && <span className="text-red-500 dark:text-red-400 font-semibold block mt-0.5">❌ Insufficient Stock</span>}
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {openItemDrop === item.id && itemDropRect && (
                            <div
                              className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                              style={{ position: "fixed", top: itemDropRect.top + 4, left: itemDropRect.left, width: itemDropRect.width, zIndex: 9999 }}
                            >
                              <button
                                type="button"
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm text-[#f58220] dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 font-semibold text-left transition-colors cursor-pointer"
                                onMouseDown={(e) => { 
                                  e.preventDefault(); 
                                  setAddingItemIdx(idx);
                                  setShowAddItem(true); 
                                  setOpenItemDrop(null);
                                }}
                              >
                                <span className="w-4 h-4 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-[#f58220] font-bold text-xs leading-none">+</span>
                                Add Item
                              </button>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {filtProd.length === 0 ? (
                                  <div className="px-3 py-4 text-xs text-gray-400 dark:text-slate-500 text-center">No matching products</div>
                                ) : (
                                  filtProd.map(p => (
                                    <button
                                      key={p.id}
                                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-orange-50 dark:hover:bg-white/5 text-left border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors"
                                      onMouseDown={() => selectProduct(idx, p)}
                                    >
                                      <div>
                                        <div className="text-xs sm:text-sm font-medium text-gray-800 dark:text-white">{p.name}</div>
                                        <div className="text-xs text-gray-400 dark:text-slate-500">₹{p.basePrice || p.price || 0}</div>
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
                              className="w-full text-xs text-gray-700 dark:text-slate-200 outline-none bg-transparent cursor-pointer border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1"
                            >
                              <option value="" className="dark:bg-card">Select Batch</option>
                              {item.batches.map((b: any) => (
                                <option key={b.id} value={b.batchCode} className="dark:bg-card">
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
                              className="w-full text-xs text-gray-700 dark:text-white text-center outline-none bg-transparent placeholder-gray-400 dark:placeholder:text-slate-500 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1"
                            />
                          )}
                        </td>

                        {/* QTY */}
                        <td className="px-2 py-2.5">
                          <input
                            type="number" min={0}
                            value={item.qty}
                            onChange={e => updateItem(idx, "qty", Number(e.target.value))}
                            className="w-full text-sm text-gray-700 dark:text-white text-center outline-none bg-transparent"
                          />
                        </td>

                        {/* UNIT */}
                        <td style={{ position: "relative", overflow: "visible" }}>
                          <button
                            type="button"
                            className="w-full flex items-center justify-center gap-1 px-2 py-2.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer rounded-lg"
                            onClick={e => {
                              if (typeof window !== "undefined") {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                const dropWidth = 180;
                                const leftPos = Math.max(16, Math.min(rect.left, window.innerWidth - dropWidth - 16));
                                setUnitDropRect({ top: rect.bottom, left: leftPos });
                                setOpenUnitDrop(v => v === item.id ? null : item.id);
                              }
                            }}
                          >
                            <span>{UNITS.find(u => u.code === item.unit)?.short ?? item.unit}</span>
                            <ChevronDown size={11} className="text-gray-400 dark:text-slate-500 shrink-0" />
                          </button>
                          {openUnitDrop === item.id && unitDropRect && (
                            <div
                              className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-y-auto custom-scrollbar"
                              style={{ position: "fixed", top: unitDropRect.top + 2, left: unitDropRect.left, width: 180, maxHeight: 220, zIndex: 9999 }}
                            >
                              {UNITS.map(u => (
                                <button
                                  key={u.code}
                                  className={clsx(
                                    "w-full text-left px-3 py-2 text-xs border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-orange-50 dark:hover:bg-white/5",
                                    item.unit === u.code ? "text-orange-600 dark:text-orange-400 font-semibold bg-orange-50 dark:bg-orange-500/10" : "text-gray-700 dark:text-slate-200"
                                  )}
                                  onMouseDown={() => { updateItem(idx, "unit", u.code); setOpenUnitDrop(null); }}
                                >
                                  <span className="font-medium">{u.short}</span>
                                  <span className="text-gray-400 dark:text-slate-500 ml-1">– {u.label}</span>
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
                            className="w-full text-sm text-gray-700 dark:text-white text-right outline-none bg-transparent"
                          />
                        </td>

                        {/* DISC% */}
                        <td className="px-2 py-2.5">
                          <input
                            type="number" min={0} max={100}
                            value={item.discountPct || ""}
                            placeholder="0"
                            onChange={e => updateItem(idx, "discountPct", Number(e.target.value))}
                            className="w-full text-sm text-gray-700 dark:text-white text-center outline-none bg-transparent"
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
                            className="w-full text-xs text-gray-700 dark:text-slate-200 outline-none bg-transparent cursor-pointer"
                          >
                            {TAX_OPTIONS.map((t, index) => <option key={index} value={t.label} className="dark:bg-card">{t.label}</option>)}
                          </select>
                        </td>

                        {/* AMOUNT */}
                        <td className="px-3 py-2.5 text-right text-sm font-semibold text-gray-800 dark:text-white">
                          {amount > 0 ? `₹${amount.toFixed(2)}` : "—"}
                        </td>

                        {/* DELETE */}
                        <td className="pr-2">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-opacity p-1 cursor-pointer rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/40 dark:bg-white/[0.01]">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#f58220] hover:text-[#e8740e] border border-orange-200 dark:border-orange-500/20 hover:border-orange-300 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Row
              </button>
              <span className="text-xs text-gray-500 dark:text-slate-400">Total Qty: <span className="font-bold text-gray-800 dark:text-slate-200">{totalQty}</span></span>
            </div>
          </div>

          {/* Notes + Summary */}
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-start gap-4 pt-4 px-4 pb-8 bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 w-full min-w-0 shadow-2xs">
            {/* Left: Terms and Conditions & Description */}
            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowTerms(v => !v)}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all",
                    showTerms ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10 text-[#f58220]" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  <AlignLeft size={14} /> Terms & Conditions
                </button>
                <button
                  type="button"
                  onClick={() => setShowDesc(v => !v)}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all",
                    showDesc ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10 text-[#f58220]" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  <FileText size={14} /> Description
                </button>
              </div>

              {showTerms && (
                <div>
                  <textarea
                    value={termsText}
                    onChange={e => setTermsText(e.target.value)}
                    rows={3}
                    placeholder="Terms and conditions..."
                    className="w-full text-xs sm:text-sm text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] rounded-xl px-3 py-2 outline-none resize-none focus:border-orange-400 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}

              {showDesc && (
                <div>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Description..."
                    className="w-full text-xs sm:text-sm text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] rounded-xl px-3 py-2 outline-none resize-none focus:border-orange-400 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}

              {/* Payment Mode */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Payment Mode</label>
                <select
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value as any)}
                  className="border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm outline-none bg-white dark:bg-[#13151f] text-gray-800 dark:text-slate-200 focus:border-orange-400"
                >
                  <option value="CASH" className="dark:bg-card">Cash</option>
                  <option value="CREDIT" className="dark:bg-card">Credit</option>
                </select>
              </div>
            </div>

            {/* Right: Summary */}
            <div className="w-full lg:w-80 space-y-2.5 p-4 bg-gray-50/50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-gray-500 dark:text-slate-400">Subtotal</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-white">₹{totalAmount.toFixed(2)}</span>
              </div>
              {totalTax > 0 && (
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Tax</span>
                  <span className="font-mono text-gray-700 dark:text-slate-300">₹{totalTax.toFixed(2)}</span>
                </div>
              )}
              {totalDisc > 0 && (
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Discount</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">-₹{totalDisc.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <label htmlFor="inv_roundoff" className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    id="inv_roundoff"
                    checked={roundOffEnabled}
                    onChange={e => setRoundOffEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-[#f58220]"
                  />
                  <span>Round Off</span>
                </label>
                <span className="text-gray-500 dark:text-slate-400 text-xs font-mono">{roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
                <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">Grand Total</span>
                <span className="text-lg sm:text-xl font-bold font-mono text-[#f58220]">₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Action Bar */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0 shadow-2xs w-full min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-60 transition-colors cursor-pointer"
            >
              Save Draft
            </button>

            {/* Share dropdown */}
            <div className="relative" ref={shareDropRef}>
              <div className="flex rounded-xl overflow-hidden shadow-sm border border-orange-200 dark:border-orange-500/20">
                <button
                  type="button"
                  onClick={() => showToast("Share feature coming soon", "info")}
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#f58220] hover:bg-[#e8740e] border-r border-orange-400/50 transition-colors cursor-pointer"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => setShowShareDrop(v => !v)}
                  className="px-2 py-2 text-xs sm:text-sm text-white bg-[#f58220] hover:bg-[#e8740e] transition-colors cursor-pointer"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              {showShareDrop && (
                <div className="absolute bottom-full right-0 mb-1.5 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl text-xs w-44 z-50 p-1 animate-in zoom-in-95 duration-150">
                  <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-lg cursor-pointer">Generate e-Invoice</button>
                  <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-lg flex items-center gap-2 cursor-pointer">
                    <Share2 size={13} /> Share
                  </button>
                  <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-lg flex items-center gap-2 cursor-pointer">
                    <Printer size={13} /> Print
                  </button>
                  <button
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-lg cursor-pointer"
                    onClick={async () => { setShowShareDrop(false); await handleSave(false); openCreate(); }}
                  >
                    Save &amp; New
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 sm:px-6 py-2 text-xs sm:text-sm font-bold text-white bg-[#f58220] hover:bg-[#e8740e] rounded-xl shadow-sm active:scale-95 disabled:opacity-60 transition-all cursor-pointer"
            >
              <Check size={16} /> <span>{saving ? "Saving..." : "Save"}</span>
            </button>
          </div>
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
          <div className="fixed inset-0 z-[999] bg-white dark:bg-background overflow-y-auto w-full h-full p-4">
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

  // ════════════════════════════════════════════════════════════════════════════
  // LIST VIEW — Simplified Clean UI
  // ════════════════════════════════════════════════════════════════════════════
  const fmt = (d: string) => formatDate(d + "T00:00:00");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 w-full min-w-0">

      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Tax Invoices
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">
              Create, track, and manage GST tax invoices
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4 shrink-0" /> <span>New Invoice</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full min-w-0">
          {[
            { label: "Total Sales",   value: `₹${totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,     color: "text-gray-700 dark:text-slate-200",    dot: "bg-gray-400" },
            { label: "Received",      value: `₹${receivedAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,  color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
            { label: "Balance Due",   value: `₹${balanceAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,   color: "text-rose-600 dark:text-rose-400",    dot: "bg-rose-500" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-3.5 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0 shadow-2xs">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{s.label}</p>
                <p className={clsx("text-base sm:text-xl font-bold truncate", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative flex-1 min-w-0 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice or customer..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end min-w-0">
            <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-x-auto max-w-full custom-scrollbar p-0.5 bg-white dark:bg-card shrink-0">
              {["ALL", "SENT", "PAID", "DRAFT"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={clsx(
                    "px-3 py-1.5 sm:py-2 text-xs font-medium transition-colors rounded-lg whitespace-nowrap shrink-0",
                    statusFilter === s ? "bg-[#f58220] text-white shadow-2xs" : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  {s === "ALL" ? "All" : s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-card text-xs sm:text-sm text-gray-700 dark:text-slate-200 relative shrink-0">
              <div className="flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-white" onClick={() => setShowFromCal(v => !v)}>
                <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
                <span className="font-medium">{fmt(dateFrom)}</span>
              </div>
              {showFromCal && (
                <div className="absolute top-full left-0 mt-1.5 z-50" ref={fromCalRef}>
                  <MiniCalendar value={dateFrom} onChange={setDateFrom} onClose={() => setShowFromCal(false)} />
                </div>
              )}
              <span className="text-gray-300 dark:text-slate-600 px-0.5">to</span>
              <div className="flex items-center gap-1 cursor-pointer hover:text-gray-900 dark:hover:text-white" onClick={() => setShowToCal(v => !v)}>
                <span className="font-medium">{fmt(dateTo)}</span>
                <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
              </div>
              {showToCal && (
                <div className="absolute top-full right-0 mt-1.5 z-50" ref={toCalRef}>
                  <MiniCalendar value={dateTo} onChange={setDateTo} onClose={() => setShowToCal(false)} />
                </div>
              )}
            </div>

            <button 
              onClick={fetchData} 
              className="p-2 sm:p-2.5 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 transition-colors cursor-pointer shrink-0" 
              title="Refresh"
              aria-label="Refresh Invoices"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* ── Empty State ── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-[#f58220] opacity-70" />
            <p className="text-xs text-gray-500 dark:text-slate-400">Loading invoices...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-2xs w-full min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center">
              <Receipt className="h-7 w-7 sm:h-8 sm:w-8 text-[#f58220]" />
            </div>
            <div className="max-w-md">
              <p className="text-gray-900 dark:text-white font-bold text-base sm:text-lg">No Invoices Found</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
                {search || statusFilter !== "ALL"
                  ? "No tax invoices match your search or filter criteria."
                  : "Create an invoice to start billing your customers."}
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Create Invoice
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-semibold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
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
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
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
                          isDraft ? "hover:bg-orange-50/50 dark:hover:bg-orange-500/10 cursor-pointer bg-orange-50/30 dark:bg-orange-500/5" : "hover:bg-orange-50/20 dark:hover:bg-white/[0.02]"
                        )}
                        onClick={() => {
                          if (isDraft) loadDraft(inv);
                        }}
                      >
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(inv.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-orange-600 dark:text-orange-400 text-xs whitespace-nowrap">
                          {inv.order?.invoiceNum
                            ? formatERPNumber("INV", inv.order.invoiceNum, inv.createdAt)
                            : (inv.status === "DRAFT" ? "Not yet numbered" : "Lite Sale")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1 max-w-[200px] sm:max-w-[260px]">
                            <span className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate w-full" title={inv.order?.customer?.name || inv.customerName || "Walk-In Customer"}>
                              {inv.order?.customer?.name || inv.customerName || "Walk-In Customer"}
                            </span>
                            {!isDraft && inv.order?.customer && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10">
                                {inv.order?.partyType || (inv.order?.customerId ? "CUSTOMER" : "UNKNOWN")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {inv.order?.paymentType === "CREDIT" ? "Credit" : "Cash"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-gray-900 dark:text-white text-xs sm:text-sm whitespace-nowrap">
                          ₹{(inv.finalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-xs sm:text-sm whitespace-nowrap">
                          {balance > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400">₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isDraft ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteDraft(inv.id); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-colors"
                                title="Delete Draft"
                                aria-label="Delete Draft"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => { 
                                     e.stopPropagation(); 
                                     router.push(`/sales/delivery-challan?sourceInvoiceId=${inv.order?.id || inv.orderId}`);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg border border-transparent hover:border-orange-200 dark:hover:border-orange-500/20 transition-colors"
                                  title="Create Delivery Challan"
                                  aria-label="Create Delivery Challan"
                                >
                                  <Truck className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePrint(inv); }}
                                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-transparent hover:border-gray-200 dark:border-white/10 transition-colors"
                                  title="Print"
                                  aria-label="Print Invoice"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); showToast("Share feature coming soon", "info"); }}
                                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-transparent hover:border-gray-200 dark:border-white/10 transition-colors"
                                  title="Share"
                                  aria-label="Share Invoice"
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
                gstRate: it.taxAmount > 0 && it.quantity && it.price ? ((it.taxAmount / (it.quantity * it.price)) * 100).toFixed(0) : 0,
                hsnCode: it.product?.hsnCode || '—'
              }))
            }}
            vendor={printingInvoice.order?.customer || { name: 'Walk-In Customer' }}
            companyDetails={companyProfile || FALLBACK_COMPANY}
            documentType="TAX_INVOICE"
            onClose={() => setPrintingInvoice(null)}
          />
        )}
      </div>
    </div>
  );
}
