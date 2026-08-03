"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Calculator, Plus, Search, RefreshCw, X, User,
  Printer, ChevronDown, Trash2, Check, Share2, Calendar,
  AlignLeft, FileText, ArrowLeft, ArrowRight, FileClock, Pencil, Truck
} from "lucide-react";
import { clsx } from "clsx";
import { customersApi, productsFullApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api/base";
import AddPartyModal from "@/components/modals/AddPartyModal";
import AddInventoryProductForm from "@/components/modules/inventory/AddInventoryProductForm";

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
  ACCEPTED: { label: "Accepted", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  REJECTED: { label: "Rejected", color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200" },
  CONVERTED:{ label: "Converted",color: "text-orange-600",  bg: "bg-orange-50", border: "border-orange-200" },
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
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-64 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronDown size={14} className="rotate-90" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronDown size={14} className="-rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>
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
              !isSelected(d) && isToday(d) && "bg-red-50 text-[#ff4d4f]",
              !isSelected(d) && !isToday(d) && "text-gray-700 hover:bg-gray-100"
            )}
          >{d}</button>
        ))}
      </div>
      <div className="mt-2 flex justify-between items-center border-t border-gray-100 pt-2">
        <button
          onClick={() => {
            const t = new Date();
            const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
            onChange(iso);
            onClose();
          }}
          className="text-[11px] font-semibold text-[#ff4d4f] hover:text-red-700"
        >Today</button>
        <button onClick={onClose} className="text-[11px] text-gray-400 hover:text-gray-600">Close</button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EstimationsPage() {
  const { showToast } = useToast();

  // shared
  const [view, setView] = useState<"list" | "create">("list");
  const [estimations, setEstimations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // list date filters
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
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
  const [draftId, setDraftId] = useState<string | null>(null);

  // Convert to Sales Order & Tracking Modals
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedEstForConvert, setSelectedEstForConvert] = useState<any>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierName, setCourierName] = useState("");

  const [showEditTrackingModal, setShowEditTrackingModal] = useState(false);
  const [selectedEstForTracking, setSelectedEstForTracking] = useState<any>(null);
  const [editTrackingNumber, setEditTrackingNumber] = useState("");
  const [editCourierName, setEditCourierName] = useState("");

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, cRes, pRes] = await Promise.allSettled([
        api.get("/api/sales/quotations").catch(() => ({ data: [] })),
        customersApi.getAll(),
        productsFullApi.getAll(),
      ]);
      
      let apiEstimations = eRes.status === "fulfilled" ? (eRes.value as any).data || [] : [];

      // Drafts are already real Quotation rows (status: "DRAFT") saved through the
      // normal /api/sales/quotations endpoint below — no separate local draft store.
      setEstimations(apiEstimations);
      if (cRes.status === "fulfilled") setCustomers((cRes.value as any).data || []);
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
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalDisc = parseFloat(rowData.reduce((s, r) => s + r.discAmt, 0).toFixed(2));
  const totalTax = parseFloat(rowData.reduce((s, r) => s + r.taxAmt, 0).toFixed(2));
  const totalAmount = parseFloat(rowData.reduce((s, r) => s + r.amount, 0).toFixed(2));
  const roundOff = roundOffEnabled ? parseFloat((Math.round(totalAmount) - totalAmount).toFixed(2)) : 0;
  const finalTotal = parseFloat((totalAmount + roundOff).toFixed(2));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setDraftId(null);
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
    const raw = draft._rawState || {};
    if (draft._rawState) {
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
      const customer = customers.find((c: any) => c.id === draft.customerId) || null;
      setSelectedCustomer(customer);
      setCustomerSearch(draft.customerName || (customer ? customer.name : ""));
      setCustomerPhone(draft.customerPhone || (customer ? customer.contact || customer.phone : ""));
      setInvoiceDate(draft.validUntil ? new Date(draft.validUntil).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
      setStateOfSupply(customer?.state || "");
      setRefNo(draft.quotationNumber || "");
      
      const mappedItems = draft.items && draft.items.length > 0
        ? draft.items.map((i: any) => ({
            id: i.id || `item_${Math.random()}`,
            productId: i.productId,
            itemSearch: i.productName,
            qty: i.quantity,
            unit: i.unit || "NONE",
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

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setCustomerPhone(c.contact || c.phone || "");
    if (c.state) {
      setStateOfSupply(c.state);
    }
    setShowCustomerDrop(false);
  };

  const selectProduct = (idx: number, p: any) => {
    setItems(prev => prev.map((it, i) =>
      i === idx ? {
        ...it,
        productId: p.id,
        itemSearch: p.name,
        rate: p.basePrice || p.price || 0,
        unit: p.unit || "NONE",
        taxPct: p.taxPercent || 0,
        taxLabel: TAX_OPTIONS.find(o => o.value === (p.taxPercent || 0))?.label || "NONE",
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
    if (!selectedCustomer && !isDraft) { showToast("Please select a party", "error"); return; }
    const validItems = items.filter(i => (i.productId || i.itemSearch.trim()) && i.qty > 0 && i.rate > 0);
    if (validItems.length === 0 && !isDraft) { showToast("Add at least one item with price", "error"); return; }
    
    if (isDraft && !selectedCustomer && validItems.length === 0) {
       setView("list");
       return;
    }

    setSaving(true);
    try {
      const payload: any = {
        quotationNumber: refNo.trim() || undefined,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer ? undefined : customerSearch,
        customerPhone,
        validUntil: invoiceDate,
        status: isDraft ? "DRAFT" : "SENT",
        items: validItems.map(i => ({
          productId: i.productId || undefined,
          productName: i.itemSearch,
          quantity: i.qty,
          unit: i.unit,
          rate: i.rate,
          taxPercent: i.taxPct,
        })),
        discountAmount: totalDisc,
        termsConditions: showTerms ? (termsText || undefined) : undefined,
        notes: showDesc ? (description || undefined) : undefined,
      };

      if (draftId) {
        await api.patch(`/api/sales/quotations/${draftId}`, payload);
      } else {
        await api.post("/api/sales/quotations", payload);
      }

      showToast(isDraft ? "Draft saved successfully" : "Estimation saved successfully", "success");
      fetchData();
      setView("list");
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to save estimation", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    const hasData = selectedCustomer || items.some(i => i.productId || i.itemSearch.trim());
    if (hasData) {
       handleSave(true);
    } else {
       setView("list");
    }
  };

  const handleOpenConvertModal = (est: any) => {
    setSelectedEstForConvert(est);
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setDeliveryAddress("");
    setTrackingNumber("");
    setCourierName("");
    setShowConvertModal(true);
  };

  const submitConvert = async () => {
    if (!selectedEstForConvert) return;
    setConverting(selectedEstForConvert.id);
    try {
      await api.post(`/api/sales/quotations/${selectedEstForConvert.id}/convert`, {
        deliveryDate: deliveryDate || undefined,
        deliveryAddress: deliveryAddress || undefined,
        trackingNumber: trackingNumber || undefined,
        courierName: courierName || undefined
      });
      showToast("Converted to Sales Order successfully", "success");
      setShowConvertModal(false);
      fetchData();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Conversion failed", "error");
    } finally {
      setConverting(null);
    }
  };

  const handleOpenEditTracking = (est: any) => {
    setSelectedEstForTracking(est);
    setEditTrackingNumber(est.trackingNumber || "");
    setEditCourierName(est.courierName || "");
    setShowEditTrackingModal(true);
  };

  const submitEditTracking = async () => {
    if (!selectedEstForTracking) return;
    try {
      await api.patch(`/api/sales/quotations/${selectedEstForTracking.id}`, {
        trackingNumber: editTrackingNumber,
        courierName: editCourierName
      });
      showToast("Tracking details updated successfully", "success");
      setShowEditTrackingModal(false);
      fetchData();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Update failed", "error");
    }
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = estimations.filter(est => {
    const matchSearch = !search ||
      est.quotationNumber?.toLowerCase().includes(search.toLowerCase()) ||
      est.customerName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || est.status === statusFilter;
    // Add date filtering logic if required here
    return matchSearch && matchStatus;
  });

  const totalQuotations = filtered.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalConverted = filtered.filter(i => i.status === "CONVERTED").reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalOpen = filtered.filter(i => i.status === "SENT" || i.status === "DRAFT").reduce((s, i) => s + (i.totalAmount || 0), 0);

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

        {/* ── Top bar ── */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-lg font-bold text-gray-800">Estimate / Quotation</h2>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">

          {/* Customer + Meta info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 gap-8">
              {/* Left: Party + Phone */}
              <div className="space-y-4">
                <div className="relative" ref={customerDropRef}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Party *</label>
                  <div
                    className={clsx(
                      "flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer bg-white transition-all",
                      showCustomerDrop ? "border-orange-400 ring-1 ring-orange-200" : "border-gray-300 hover:border-gray-400"
                    )}
                    onClick={() => setShowCustomerDrop(v => !v)}
                  >
                    <input
                      className="flex-1 text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
                      placeholder="Select or search party"
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                      onClick={e => { e.stopPropagation(); setShowCustomerDrop(true); }}
                    />
                    <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  </div>

                  {showCustomerDrop && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-[400px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
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
                        <span className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-[#f58220] font-bold text-base leading-none">+</span>
                        Add New Party
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
                                <div className="text-xs text-gray-400">{c.contact || c.phone || "—"}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phone</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
                    placeholder="Phone number"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Right: Ref No, Valid Until, State of Supply */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Ref No</label>
                  <input
                    type="text"
                    placeholder="Auto"
                    value={refNo}
                    onChange={e => setRefNo(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Valid Until</label>
                  <div className="relative" ref={calendarRef}>
                    <button
                      type="button"
                      onClick={() => setShowCalendar(v => !v)}
                      className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white hover:border-orange-400 transition-colors"
                    >
                      <span className="font-medium text-gray-700">
                        {invoiceDate ? new Date(invoiceDate + "T00:00:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "Pick date"}
                      </span>
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                    </button>
                    {showCalendar && (
                      <div className="absolute right-0 top-full mt-1.5 z-[200]">
                        <MiniCalendar value={invoiceDate} onChange={setInvoiceDate} onClose={() => setShowCalendar(false)} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">State of Supply</label>
                  <select
                    value={stateOfSupply}
                    onChange={e => setStateOfSupply(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white"
                  >
                    <option value="">Select state</option>
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
              <button
                type="button"
                onClick={() => setPriceMode(priceMode === "without_tax" ? "with_tax" : "without_tax")}
                className="px-2.5 py-1 bg-white border border-gray-200 hover:border-orange-300 text-xs font-semibold rounded-md text-gray-600 transition-colors"
              >
                Price: {priceMode === "without_tax" ? "Excl. Tax" : "Incl. Tax"}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 w-10 font-medium">#</th>
                  <th className="text-left px-4 py-2.5 font-medium">Item</th>
                  <th className="text-center px-4 py-2.5 w-20 font-medium">Qty</th>
                  <th className="text-left px-4 py-2.5 w-28 font-medium">Unit</th>
                  <th className="text-right px-4 py-2.5 w-28 font-medium">Price/Unit</th>
                  <th className="text-left px-4 py-2.5 w-36 font-medium">Tax</th>
                  <th className="text-right px-4 py-2.5 w-32 font-medium">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => {
                  const { taxAmt, amount } = computeRow(item, withTax);
                  const filtProd = products.filter(p =>
                    !item.itemSearch || p.name?.toLowerCase().includes(item.itemSearch.toLowerCase())
                  ).slice(0, 10);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-center text-xs text-gray-400 align-top">
                        <div className="py-1.5">
                          {idx + 1}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 relative align-top">
                        <input
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm outline-none focus:border-orange-400"
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
                            setItemDropRect({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: 320 });
                          }}
                        />
                        {openItemDrop === item.id && itemDropRect && (
                          <div
                            className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden flex flex-col item-dropdown-container"
                            style={{ position: "fixed", top: itemDropRect.top + 4, left: itemDropRect.left, width: itemDropRect.width, zIndex: 9999 }}
                          >
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-orange-600 hover:bg-orange-50 border-b border-gray-100 font-semibold shrink-0"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setActiveItemIdx(idx);
                                setShowAddProduct(true);
                                setOpenItemDrop(null);
                              }}
                            >
                              <span className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center text-[#f58220] font-bold text-xs leading-none">+</span>
                              Add New Product
                            </button>
                            <div className="max-h-48 overflow-y-auto">
                              {filtProd.length === 0 ? (
                                <div className="px-3 py-4 text-xs text-gray-400 text-center">No products found</div>
                              ) : (
                                filtProd.map(p => (
                                  <button
                                    key={p.id}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-orange-50 text-left border-b border-gray-50 last:border-0"
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
                      <td className="px-4 py-2.5 align-top">
                        <input
                          type="number"
                          min={0}
                          value={item.qty === 0 ? "" : item.qty}
                          onChange={e => updateItem(idx, "qty", Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm text-center outline-none focus:border-orange-400"
                        />
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <select
                          value={item.unit}
                          onChange={e => updateItem(idx, "unit", e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white outline-none focus:border-orange-400"
                        >
                          {UNITS.map(u => <option key={u.code} value={u.code}>{u.short}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                          <input
                            type="number"
                            min={0}
                            value={item.rate === 0 ? "" : item.rate}
                            onChange={e => updateItem(idx, "rate", Number(e.target.value))}
                            className="w-full pl-6 pr-2 py-1.5 border border-gray-200 rounded-md text-sm text-right outline-none focus:border-orange-400"
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
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white outline-none focus:border-orange-400"
                        >
                          {TAX_OPTIONS.map((o, index) => (
                            <option key={index} value={o.label}>{o.label}</option>
                          ))}
                        </select>
                        <div className="text-[10px] text-right text-gray-400 mt-0.5">₹{taxAmt > 0 ? taxAmt.toFixed(2) : "0.00"}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-semibold text-gray-700 align-top">
                        <div className="py-1.5">
                          {amount > 0 ? `₹${amount.toFixed(2)}` : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center align-top">
                        <div className="py-1">
                          <button
                            onClick={() => removeRow(idx)}
                            className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-orange-300 hover:bg-orange-50 rounded-lg text-xs font-semibold text-gray-600 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
              <div className="flex items-center gap-5 text-xs text-gray-400">
                <span>Qty: <strong className="text-gray-700">{totalQty}</strong></span>
                <span>Tax: <strong className="text-gray-700 font-sans">₹{totalTax.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>

          {/* Notes + Summary */}
          <div className="flex gap-4 items-start">
            <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setShowTerms(v => {
                      if (v) setTermsText("");
                      return !v;
                    });
                  }}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all",
                    showTerms ? "border-orange-400 bg-orange-50 text-orange-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <AlignLeft className="h-3.5 w-3.5" /> Terms & Conditions
                </button>
                <button
                  onClick={() => {
                    setShowDesc(v => {
                      if (v) setDescription("");
                      return !v;
                    });
                  }}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all",
                    showDesc ? "border-orange-400 bg-orange-50 text-orange-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" /> Description
                </button>

              </div>
              {showTerms && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Terms & Conditions</label>
                  <textarea
                    rows={3}
                    value={termsText}
                    onChange={e => setTermsText(e.target.value)}
                    placeholder="Add terms..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:border-orange-400"
                  />
                </div>
              )}
              {showDesc && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add description..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:border-orange-400"
                  />
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 w-64 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold text-gray-700">₹{totalAmount.toFixed(2)}</span>
              </div>
              {totalTax > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Tax</span>
                  <span className="text-gray-600">₹{totalTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="est_roundoff" className="flex items-center gap-1.5 text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    id="est_roundoff"
                    checked={roundOffEnabled}
                    onChange={e => setRoundOffEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  Round Off
                </label>
                <span className="text-gray-500 text-xs">{roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="font-bold text-gray-800">Total</span>
                <span className="text-xl font-bold text-[#f58220]">₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Action Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-700 transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          <div className="relative" ref={shareDropRef}>
            <button
              onClick={() => setShowShareDrop(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-orange-200 hover:bg-orange-50 rounded-lg text-[#f58220] transition-colors"
            >
              <Share2 size={15} /> Share <ChevronDown size={13} />
            </button>
            {showShareDrop && (
              <div className="absolute bottom-full mb-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg w-32 overflow-hidden text-sm z-50">
                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700">WhatsApp</button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700">Email</button>
              </div>
            )}
          </div>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </button>
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
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-5xl mx-4 min-h-[680px] max-h-[90vh] overflow-y-auto p-6 relative">
              <button
                type="button"
                onClick={() => setShowAddProduct(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg bg-gray-50 border border-gray-200"
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

        {/* Convert to Sales Order Modal */}
        {showConvertModal && selectedEstForConvert && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-150 w-full max-w-lg mx-4 overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200 animate-out fade-out slide-out-to-top-5">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-[#f58220] px-6 py-4 flex items-center justify-between text-white">
                <div>
                  <h3 className="font-bold text-lg">Convert to Sales Order</h3>
                  <p className="text-white/80 text-xs mt-0.5">{selectedEstForConvert.quotationNumber} • {selectedEstForConvert.customerName || "No Customer Name"}</p>
                </div>
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-sm text-gray-700">
                <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-orange-600 font-semibold uppercase tracking-wider">Total Payable</div>
                    <div className="text-2xl font-bold text-gray-800 mt-0.5">₹ {(selectedEstForConvert.totalAmount || 0).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Items</div>
                    <div className="text-sm font-semibold text-gray-700 mt-0.5">{selectedEstForConvert.items?.length || 0} line items</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Calendar size={12} /> Delivery Date
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={e => setDeliveryDate(e.target.value)}
                      className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Truck size={12} /> Courier Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Delhivery, BlueDart"
                      value={courierName}
                      onChange={e => setCourierName(e.target.value)}
                      className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <AlignLeft size={12} /> Tracking / Waybill Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Tracking ID / AWB Number"
                    value={trackingNumber}
                    onChange={e => setTrackingNumber(e.target.value)}
                    className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <FileText size={12} /> Delivery Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter the shipping/delivery address..."
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-150 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-2.5 text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-white rounded-xl border border-gray-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={submitConvert}
                  disabled={!!converting}
                  className="px-5 py-2.5 bg-green-600 text-white text-xs font-black rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95 disabled:opacity-50"
                >
                  {converting ? "Converting..." : "Convert to SO"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Tracking Modal */}
        {showEditTrackingModal && selectedEstForTracking && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-150 w-full max-w-md mx-4 overflow-hidden relative transform transition-all animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="bg-[#f58220] px-6 py-4 flex items-center justify-between text-white">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Truck size={20} /> Update Tracking Info
                  </h3>
                  <p className="text-white/80 text-xs mt-0.5">{selectedEstForTracking.quotationNumber} • Converted</p>
                </div>
                <button
                  onClick={() => setShowEditTrackingModal(false)}
                  className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-sm text-gray-700">
                <div className="flex flex-col">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    Courier Partner Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Delhivery, BlueDart, Professional Courier"
                    value={editCourierName}
                    onChange={e => setEditCourierName(e.target.value)}
                    className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    Tracking / Waybill Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter Tracking ID / AWB Number"
                    value={editTrackingNumber}
                    onChange={e => setEditTrackingNumber(e.target.value)}
                    className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-150 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowEditTrackingModal(false)}
                  className="px-4 py-2.5 text-xs font-black text-gray-500 uppercase tracking-widest hover:bg-white rounded-xl border border-gray-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEditTracking}
                  className="px-5 py-2.5 bg-[#f58220] text-white text-xs font-black rounded-xl shadow-lg shadow-orange-100 hover:bg-[#e8740e] transition-all flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW — Simplified Clean UI
  // ══════════════════════════════════════════════════════════════════════════
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-[#f58220]" />
          Estimations
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Estimate
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Estimations", value: `₹${totalQuotations.toLocaleString("en-IN")}`, color: "text-gray-700", dot: "bg-gray-400" },
            { label: "Converted",         value: `₹${totalConverted.toLocaleString("en-IN")}`,  color: "text-emerald-600", dot: "bg-emerald-500" },
            { label: "Open",              value: `₹${totalOpen.toLocaleString("en-IN")}`,       color: "text-[#f58220]",   dot: "bg-[#f58220]" },
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
              placeholder="Search estimate or customer..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
            />
          </div>

          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            {["ALL", "SENT", "CONVERTED", "DRAFT"].map(s => (
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
              <Calculator className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Estimations Found</p>
              <p className="text-gray-500 text-sm mt-1">Create an estimate to share with your customers.</p>
            </div>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Create Estimate
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Est No</th>
                  <th className="text-left px-4 py-3">Party Name</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((est) => {
                  const style = STATUS_STYLES[est.status] || STATUS_STYLES.DRAFT;
                  const isDraft = est.status === "DRAFT";
                  return (
                    <tr 
                      key={est.id} 
                      className={clsx(
                        "transition-colors",
                        isDraft ? "hover:bg-orange-50/50 cursor-pointer bg-orange-50/30" : "hover:bg-gray-50"
                      )}
                      onClick={() => {
                        if (isDraft) loadDraft(est);
                      }}
                    >
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(est.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 text-xs">
                        <div>{est.quotationNumber}</div>
                        {est.status === "CONVERTED" && est.convertedOrderNumber && (
                          <div className="text-[10px] text-green-600 font-bold mt-1 bg-green-50 px-1.5 py-0.5 rounded inline-block">
                            Order: {est.convertedOrderNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium text-gray-800">
                          {est.customerName || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        ₹ {(est.totalAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                        {est.status === "CONVERTED" && (est.trackingNumber || est.courierName) && (
                          <div className="text-[10px] text-gray-500 mt-1 font-medium">
                            {est.courierName ? `${est.courierName}: ` : ""}{est.trackingNumber || "No Tracking ID"}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {est.status !== "CONVERTED" && !isDraft && (
                             <button
                               onClick={(e) => { e.stopPropagation(); handleOpenConvertModal(est); }}
                               disabled={!!converting}
                               className="px-2 py-1 bg-green-50 text-green-600 border border-green-200 rounded text-xs font-bold hover:bg-green-100 transition-colors mr-2"
                             >
                               {converting === est.id ? "..." : "Convert"}
                             </button>
                          )}
                          {isDraft ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); loadDraft(est); }}
                                className="p-1 text-gray-400 hover:text-[#f58220] hover:bg-orange-50 rounded transition-colors"
                                title="Edit Draft"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteDraft(est.id); }}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete Draft"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              {est.status === "CONVERTED" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditTracking(est); }}
                                  className="p-1 text-gray-400 hover:text-[#f58220] hover:bg-orange-50 rounded transition-colors mr-1"
                                  title="Edit Tracking"
                                >
                                  <Truck className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="Print"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => e.stopPropagation()}
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
      </div>
    </div>
  );
}

