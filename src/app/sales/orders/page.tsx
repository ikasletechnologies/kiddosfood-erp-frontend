"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, RefreshCw, Calendar, 
  ChevronRight, ArrowUpRight, Filter, ShoppingBag,
  Clock, CheckCircle2, XCircle, Printer, Plus,
  ChevronDown, Trash2, ArrowLeft, FileSpreadsheet,
  Check, User, ClipboardList, Wallet, Sparkles, Image as ImageIcon, Link as LinkIcon,
  AlertTriangle, X } from "lucide-react";
import { clsx } from "clsx";
import { customersApi, productsFullApi, settingsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import api from "@/lib/api/base";
import { formatDate } from "@/lib/utils";
import GSTInvoice from "@/components/documents/GSTInvoice";

// No hardcoded state here — the seller's GST registration state must come
// from the real HQ franchise (see SettingsService.getCompanyProfile),
// never a guessed default, or CGST+SGST vs IGST silently disagrees with
// what Proforma/Tax Invoice compute for the same document.
const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: ""
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

// Matches the actual SalesOrderStatus enum (prisma/schema.prisma) — the
// previous DRAFT/OPEN/OVERDUE/CLOSED vocabulary here didn't match what the
// backend ever actually sends, so every non-DRAFT/CANCELLED order silently
// fell back to the DRAFT style regardless of its real status.
const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:          { label: "Draft",           color: "text-slate-600 dark:text-slate-400",   bg: "bg-slate-50 dark:bg-white/5",   border: "border-slate-200 dark:border-white/10" },
  PENDING:        { label: "Pending",         color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",   border: "border-amber-200 dark:border-amber-500/20" },
  CONFIRMED:      { label: "Confirmed",       color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10",    border: "border-blue-200 dark:border-blue-500/20" },
  PROCESSING:     { label: "Processing",      color: "text-orange-600 dark:text-orange-400",  bg: "bg-orange-50 dark:bg-orange-500/10",  border: "border-orange-200 dark:border-orange-500/20" },
  SHIPPED:        { label: "Shipped",         color: "text-indigo-600 dark:text-indigo-400",  bg: "bg-indigo-50 dark:bg-indigo-500/10",  border: "border-indigo-200 dark:border-indigo-500/20" },
  DELIVERED:      { label: "Delivered",       color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  CANCELLED:      { label: "Cancelled",       color: "text-slate-400 dark:text-slate-500",   bg: "bg-slate-100 dark:bg-white/5",  border: "border-slate-200 dark:border-white/10" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  productId: string;
  itemSearch: string;
  qty: number;
  unit: string;
  rate: number;
  taxPct: number;
  taxLabel: string;
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
    taxPct: 0,
    taxLabel: "NONE",
    remarks: "",
  };
}

function computeRow(item: LineItem, withTax: boolean) {
  const gross = item.qty * item.rate;
  if (withTax) {
    const taxAmt = parseFloat((gross * item.taxPct / (100 + item.taxPct)).toFixed(2));
    const netAmt = gross - taxAmt;
    return { taxAmt, amount: parseFloat(gross.toFixed(2)) };
  }
  const taxAmt = parseFloat((gross * item.taxPct / 100).toFixed(2));
  return { taxAmt, amount: parseFloat((gross + taxAmt).toFixed(2)) };
}

// Item Master (InventoryItem) configured UOMs: base unit + any configured conversion units.
// Falls back to the generic UNITS list when an item has no configured UOMs (e.g. no product selected yet).
function getUnitOptions(item: LineItem): { code: string; short: string; label: string }[] {
  const configured: { code: string; short: string; label: string }[] = [];
  const seen = new Set<string>();
  const addUnit = (u: any) => {
    const short = u?.shortName || u?.name;
    if (!short || seen.has(short)) return;
    seen.add(short);
    configured.push({ code: short, short, label: u?.name || short });
  };
  if (item.baseUnit) addUnit(item.baseUnit);
  (item.conversions || []).forEach((c: any) => addUnit(c.unit));
  return configured.length > 0 ? configured : UNITS;
}

// GST (same state) vs IGST (inter-state) determination against the company's home state.
// "GST@..." and "IGST@..." labels are mutually exclusive prefixes, so a plain startsWith is enough.
function taxOptionsFor(isSameState: boolean) {
  const prefix = isSameState ? "GST" : "IGST";
  return TAX_OPTIONS.filter(t => t.label === "NONE" || t.label.startsWith(prefix));
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SalesOrdersPage() {
  const { showToast } = useToast();
  const router = useRouter();

  // Navigation state
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // List view filters
  const [dateFilter, setDateFilter] = useState("THIS_MONTH");
  const [firmFilter, setFirmFilter] = useState("ALL");
  // Local Y/M/D components, not .toISOString() — for a UTC+ locale,
  // .toISOString() on a local midnight date shifts it back a day (e.g.
  // "This Month" for August rendered as 31 Jul -> 30 Aug). Matches the
  // fix already applied on the Estimate page.
  const toLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => {
    const now = new Date();
    return toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });

  // Active Sale Order Form State
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNo, setOrderNo] = useState<string>("1");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [stateOfSupply, setStateOfSupply] = useState("");
  // Set only for an order converted from an Estimate (order.quotationId).
  // Customer / Order Date / State of Supply must stay locked to what the
  // customer already accepted in that Estimate — changing State of Supply
  // in particular can flip CGST+SGST vs IGST and desync the order from the
  // totals already agreed. Due Date is deliberately NOT gated by this: it's
  // a separate fulfilment/payment commitment, not something the Estimate
  // ever fixed (see Quotation.validUntil, a price-offer expiry — not this).
  const [sourceQuotationId, setSourceQuotationId] = useState<string | null>(null);
  const [companyState, setCompanyState] = useState("");
  const [items, setItems] = useState<LineItem[]>([makeItem(), makeItem()]);
  const [priceMode, setPriceMode] = useState<"without_tax" | "with_tax">("without_tax");
  const [paymentType, setPaymentType] = useState("Cash");
  
  // Custom dialogs & options
  const [showTerms, setShowTerms] = useState(false);
  const [termsText, setTermsText] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [description, setDescription] = useState("");
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  // One key per "New Sales Order" form session — a retry/double-click that
  // races past disabled={saving} hits SalesService.createSalesOrder's
  // idempotency check server-side and returns the already-created order
  // instead of posting a second one (this form has no source Estimate to
  // dedup against, unlike Estimate -> Convert).
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [showRowMenu, setShowRowMenu] = useState<string | null>(null);
  const [previewingOrder, setPreviewingOrder] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);
  // companyProfile resolves to {} (truthy, not falsy) when the fetch
  // succeeds but returns no state — `|| FALLBACK_COMPANY` alone never
  // catches that case, so check the field that actually matters.
  const currentCompany = companyProfile?.state ? companyProfile : FALLBACK_COMPANY;

  // Read-only "view" mode — reuses the edit form's layout (via a disabled
  // fieldset) instead of a separate component, since it needs to show
  // exactly the same fields. viewOrderRef carries the loaded order's
  // status/id so the footer can offer Confirm / Create Proforma without
  // re-fetching, and gets patched in-place after those actions succeed.
  const [readOnly, setReadOnly] = useState(false);
  const [viewOrderRef, setViewOrderRef] = useState<any>(null);
  const autoOpenedIdRef = useRef<string | null>(null);

  // Dropdown floating close triggers
  const [openItemDrop, setOpenItemDrop] = useState<string | null>(null);
  const [itemDropRect, setItemDropRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const customerDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openItemDrop) return;
    const updatePosition = () => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).placeholder === "Search item...") {
        const rect = activeEl.getBoundingClientRect();
        setItemDropRect({ top: rect.bottom, left: rect.left, width: Math.max(320, rect.width) });
      }
    };
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [openItemDrop]);

  // ── Data Syncing ─────────────────────────────────────────────────────────────

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, prodRes, ordRes, companyRes] = await Promise.allSettled([
        customersApi.getAll(),
        productsFullApi.getAll(),
        api.get("/api/sales/orders").catch(() => ({ data: [] })),
        settingsApi.getCompanyProfile().catch(() => ({ data: null })),
      ]);

      // The API returns the raw SalesOrder shape (orderNumber, totalAmount,
      // createdAt, customer.name, ...) — the table below reads
      // orderNo/finalAmount/balance/invoiceDate, which don't exist on that
      // shape at all, so real API-backed orders rendered as blank/undefined
      // everywhere except locally-cached drafts (which already used the
      // display field names). Alias them here, once, keeping every original
      // field via spread so status/id/proformaInvoiceId/quotationId etc.
      // stay intact for the chain-action buttons below.
      let salesOrders = ordRes.status === "fulfilled" ? ((ordRes.value as any).data || []).map((o: any) => ({
        ...o,
        orderNo: o.orderNumber || o.orderNo,
        invoiceDate: o.invoiceDate || o.createdAt,
        dueDate: o.dueDate || o.deliveryDate || o.createdAt,
        finalAmount: o.finalAmount ?? o.totalAmount ?? 0,
        balance: o.balance ?? (o.paymentStatus === "PAID" ? 0 : (o.totalAmount ?? 0)),
        customerName: o.customerName || o.customer?.name || "Unknown Party",
        customerPhone: o.customerPhone || o.customer?.phone || "",
      })) : [];

      // LocalStorage Merge
      try {
        const localData = localStorage.getItem("sale_orders");
        if (localData) {
          const locals = JSON.parse(localData);
          const apiIds = new Set(salesOrders.map((o: any) => o.id));
          const uniqueLocals = locals.filter((l: any) => !apiIds.has(l.id));
          salesOrders = [...uniqueLocals, ...salesOrders];
        }
      } catch (err) {
        console.error("Failed to load local sales orders", err);
      }

      setOrders(salesOrders);
      if (custRes.status === "fulfilled") setCustomers((custRes.value as any).data || []);
      if (prodRes.status === "fulfilled") setProducts((prodRes.value as any).data || []);
      if (companyRes.status === "fulfilled") {
        setCompanyState((companyRes.value as any).data?.state || "");
        if ((companyRes.value as any).data) setCompanyProfile((companyRes.value as any).data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Deep-link from Estimate's "View Sales Order" / post-Convert redirect
  // (?id=<salesOrderId>) — open that order directly (read-only) instead of
  // landing on a blank "New Order" form or just filtering the list.
  // autoOpenedIdRef guards against re-opening on every later orders
  // refresh (e.g. after Confirm) once the user has navigated away.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || autoOpenedIdRef.current === id) return;
    
    const loadDeepLinkedOrder = async () => {
      try {
        const res = await api.get(`/api/sales/orders/${id}`);
        if (res.data) {
          autoOpenedIdRef.current = id;
          const o = res.data;
          // Alias fields just like fetchAllData so the UI consumes them correctly
          const match = {
            ...o,
            orderNo: o.orderNumber || o.orderNo,
            invoiceDate: o.invoiceDate || o.createdAt,
            dueDate: o.dueDate || o.deliveryDate || o.createdAt,
            finalAmount: o.finalAmount ?? o.totalAmount ?? 0,
            balance: o.balance ?? (o.paymentStatus === "PAID" ? 0 : (o.totalAmount ?? 0)),
            customerName: o.customerName || o.customer?.name || "Unknown Party",
            customerPhone: o.customerPhone || o.customer?.phone || "",
          };
          openOrderView(match);
        }
      } catch (err) {
        console.error("Failed to fetch deep-linked order", err);
      }
    };
    loadDeepLinkedOrder();
  }, []);

  // Click outside logic
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (customerDropRef.current && !customerDropRef.current.contains(e.target as Node)) {
        setShowCustomerDrop(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ── Auto Computations ────────────────────────────────────────────────────────

  const withTax = priceMode === "with_tax";
  // Same-state supply -> GST, inter-state -> IGST. Unknown state defaults to GST (same-state).
  const isSameState = !companyState || !stateOfSupply || companyState.trim().toLowerCase() === stateOfSupply.trim().toLowerCase();
  const rowData = items.map(item => ({ item, ...computeRow(item, withTax) }));

  const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const totalTax = parseFloat(rowData.reduce((s, r) => s + r.taxAmt, 0).toFixed(2));
  const totalAmount = parseFloat(rowData.reduce((s, r) => s + r.amount, 0).toFixed(2));
  const roundOff = roundOffEnabled ? parseFloat((Math.round(totalAmount) - totalAmount).toFixed(2)) : 0;
  const finalTotal = parseFloat((totalAmount + roundOff).toFixed(2));

  // Auto-increment Order ID
  useEffect(() => {
    if (view === "create" && !draftId) {
      const numericNos = orders
        .map(o => parseInt(o.orderNo))
        .filter(n => !isNaN(n));
      const nextNo = numericNos.length > 0 ? Math.max(...numericNos) + 1 : 1;
      setOrderNo(String(nextNo));
    }
  }, [view, orders, draftId]);

  // Keep each row's GST/IGST label in sync with the state-of-supply comparison
  // (the numeric tax % from the Item Master never changes, only the GST/IGST split).
  useEffect(() => {
    setItems(prev => prev.map(it => {
      const opts = taxOptionsFor(isSameState);
      const match = opts.find(o => o.value === it.taxPct);
      return match && match.label !== it.taxLabel ? { ...it, taxLabel: match.label } : it;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSameState]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setCustomerPhone(c.phone || "");
    setShowCustomerDrop(false);
  };

  const selectProduct = (idx: number, p: any) => {
    const taxPct = p.taxPercent || 0;
    const taxLabel = taxOptionsFor(isSameState).find(o => o.value === taxPct)?.label || "NONE";
    const baseUnit = p.baseUnit;
    const conversions = p.conversions || [];
    const unitOptions = getUnitOptions({ baseUnit, conversions } as LineItem);
    const defaultUnit = unitOptions === UNITS ? (p.unit || "NONE") : unitOptions[0].code;

    setItems(prev => prev.map((it, i) =>
      i === idx ? {
        ...it,
        productId: p.id,
        itemSearch: p.name,
        rate: p.basePrice || p.price || 0,
        unit: defaultUnit,
        taxPct,
        taxLabel,
        baseUnit,
        conversions,
      } : it
    ));
    setOpenItemDrop(null);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addRow = () => setItems(prev => [...prev, makeItem()]);

  const removeRow = (idx: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== idx));
    } else {
      setItems([makeItem()]);
    }
  };

  const resetForm = () => {
    setDraftId(null);
    setIdempotencyKey(crypto.randomUUID());
    setReadOnly(false);
    setViewOrderRef(null);
    setSourceQuotationId(null);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerPhone("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setDueDate(new Date().toISOString().split("T")[0]);
    setStateOfSupply("");
    setItems([makeItem(), makeItem()]);
    setPriceMode("without_tax");
    setPaymentType("Cash");
    setTermsText("");
    setShowTerms(false);
    setDescription("");
    setShowDesc(false);
    setRoundOffEnabled(true);
  };

  const handleSave = async (status: "DRAFT" | "OPEN" | "OVERDUE") => {
    if (!selectedCustomer && status !== "DRAFT") {
      showToast("Please select a customer", "error");
      return;
    }
    if (customerPhone && customerPhone.length !== 10 && status !== "DRAFT") {
      showToast("Enter a valid 10-digit phone number", "error");
      return;
    }
    const validItems = items.filter(it => it.itemSearch.trim() !== "" && it.qty > 0);
    if (validItems.length === 0 && status !== "DRAFT") {
      showToast("Add at least one item with valid quantity", "error");
      return;
    }

    if (status === "DRAFT" && !selectedCustomer && validItems.length === 0) {
      setView("list");
      resetForm();
      return;
    }

    setSaving(true);
    
    // Auto-overdue check on dates
    let finalStatus = status;
    if (status === "OPEN" && new Date(dueDate) < new Date(new Date().setHours(0,0,0,0))) {
      finalStatus = "OVERDUE";
    }

    const apiPayload = {
      customerId: selectedCustomer?.id || undefined,
      customerName: selectedCustomer?.name || customerSearch || undefined,
      customerPhone: customerPhone || undefined,
      orderDate: orderDate || undefined,
      dueDate: dueDate || undefined,
      stateOfSupply: stateOfSupply || undefined,
      deliveryDate: dueDate || undefined,
      notes: description || undefined,
      discountAmount: undefined,
      items: validItems.map(it => ({
        productId: it.productId || undefined,
        productName: it.itemSearch,
        quantity: it.qty,
        unit: it.unit,
        rate: it.rate,
        taxPercent: it.taxPct,
      })),
    };

    try {
      if (draftId) {
        // Editing an existing order — update it, never create another one.
        await api.patch(`/api/sales/orders/${draftId}`, apiPayload);
      } else {
        const res = await api.post("/api/sales/orders", { ...apiPayload, idempotencyKey });
        // Track the new record's ID so subsequent saves in the same session
        // update it rather than creating yet another duplicate.
        if (res?.data?.id) setDraftId(res.data.id);
      }
      showToast(draftId ? "Sales Order updated successfully" : "Sales Order saved successfully", "success");
      fetchAllData();
      setView("list");
      resetForm();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Error saving Sales Order", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (order: any) => {
    setReadOnly(false);
    setViewOrderRef(null);
    // Real, persisted order.quotationId — not the locally-cached _rawState —
    // is what gates the Customer/Order Date/State of Supply lock below, so
    // it must survive a page reload the same way the order itself does.
    setSourceQuotationId(order.quotationId || null);
    setDraftId(order.id);
    setOrderNo(order.orderNo);
    const raw = order._rawState || {};
    setSelectedCustomer(raw.selectedCustomer || null);
    setCustomerSearch(raw.customerSearch || order.customerName);
    setCustomerPhone(raw.customerPhone || order.customerPhone || "");
    // order.orderDate/dueDate are real DB DateTime values (full ISO) once
    // persisted — the <input type="date"> needs just the date portion.
    // raw._rawState (a same-session local cache) already stores plain
    // "YYYY-MM-DD" strings, so only the DB-sourced values need slicing.
    setOrderDate(raw.orderDate || (order.orderDate ? new Date(order.orderDate).toISOString().split("T")[0] : order.invoiceDate));
    setDueDate(raw.dueDate || (order.dueDate ? new Date(order.dueDate).toISOString().split("T")[0] : ""));
    setStateOfSupply(raw.stateOfSupply || order.stateOfSupply || "");
    setPriceMode(raw.priceMode || "without_tax");
    setPaymentType(raw.paymentType || order.paymentType || "Cash");
    setTermsText(raw.termsText || "");
    setShowTerms(raw.showTerms || !!raw.termsText);
    setDescription(raw.description || order.remarks || "");
    setShowDesc(raw.showDesc || !!raw.description || !!order.remarks);
    setRoundOffEnabled(raw.roundOffEnabled ?? true);

    if (raw.items && raw.items.length > 0) {
      setItems(raw.items);
    } else if (order.items && order.items.length > 0) {
      // API SalesOrderItem shape is productName/quantity/taxPercent, not the
      // description/qty/taxPct fields this used to read (those only ever
      // existed on locally-cached draft items) — real orders rendered every
      // item row blank until this matched the actual field names.
      setItems(order.items.map((it: any) => ({
        id: it.id || Math.random().toString(36).slice(2),
        productId: it.productId || "",
        itemSearch: it.productName ?? it.description ?? "",
        qty: it.quantity ?? it.qty ?? 0,
        unit: it.unit || "NONE",
        rate: it.rate || 0,
        taxPct: it.taxPercent ?? it.taxPct ?? 0,
        taxLabel: TAX_OPTIONS.find(o => o.value === (it.taxPercent ?? it.taxPct ?? 0))?.label || "NONE",
        remarks: it.remarks || "",
      })));
    } else {
      setItems([makeItem()]);
    }

    setView("edit");
  };

  // Read-only view for a specific Sales Order (deep-linked via ?id=, e.g.
  // right after converting an Estimate). Reuses handleEdit's field
  // population — same layout, same data — then locks it down: the form's
  // inputs go inside a disabled <fieldset> and the footer swaps Save
  // buttons for Confirm / Create Proforma Invoice.
  const openOrderView = (order: any) => {
    handleEdit(order);
    setReadOnly(true);
    setViewOrderRef(order);
  };

  // DRAFT -> CONFIRMED. Only a CONFIRMED Sales Order can generate a
  // Proforma Invoice (enforced server-side too, see
  // SalesService.convertSalesOrderToProforma).
  const handleConfirm = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.patch(`/api/sales/orders/${order.id}`, { status: "CONFIRMED" });
      showToast("Sales Order confirmed", "success");
      fetchAllData();
      setViewOrderRef((prev: any) => (prev && prev.id === order.id ? { ...prev, status: "CONFIRMED" } : prev));
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to confirm Sales Order", "error");
    }
  };

  // Sales Order -> Proforma Invoice.
  const handleCreateProforma = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setConvertingId(order.id);
    try {
      const res = await api.post(`/api/sales/orders/${order.id}/convert`, {});
      showToast("Proforma Invoice created", "success");
      const proformaId = res?.data?.id;
      router.push(proformaId ? `/sales/proforma-invoice?id=${proformaId}` : "/sales/proforma-invoice");
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to create Proforma Invoice", "error");
    } finally {
      setConvertingId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Sales Order?")) return;
    try {
      const localData = localStorage.getItem("sale_orders");
      if (localData) {
        let locals = JSON.parse(localData);
        locals = locals.filter((x: any) => x.id !== id);
        localStorage.setItem("sale_orders", JSON.stringify(locals));
      }
      showToast("Order deleted successfully", "success");
      fetchAllData();
    } catch (e) {
      showToast("Failed to delete order", "error");
    }
  };

  const convertToSale = async (order: any) => {
    try {
      const localData = localStorage.getItem("sale_orders");
      if (localData) {
        const locals = JSON.parse(localData);
        const updated = locals.map((x: any) => x.id === order.id ? { ...x, status: "CLOSED", balance: 0 } : x);
        localStorage.setItem("sale_orders", JSON.stringify(updated));
      }
      showToast(`Sales Order #${order.orderNo} successfully converted to Sale Invoice!`, "success");
      fetchAllData();
    } catch (e) {
      showToast("Conversion failed", "error");
    }
  };

  // ── Filter Computations ──────────────────────────────────────────────────────

  const getFilteredOrders = () => {
    return orders.filter(o => {
      const matchSearch = !search ||
        o.orderNo.toLowerCase().includes(search.toLowerCase()) ||
        o.customerName.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "ALL" || o.status === statusFilter;

      let matchDate = true;
      if (dateFilter === "THIS_MONTH") {
        const d = new Date(o.invoiceDate);
        const now = new Date();
        matchDate = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (dateFilter === "TODAY") {
        matchDate = o.invoiceDate === new Date().toISOString().split("T")[0];
      } else if (dateFilter === "CUSTOM") {
        matchDate = o.invoiceDate >= dateFrom && o.invoiceDate <= dateTo;
      }

      return matchSearch && matchStatus && matchDate;
    });
  };

  const filteredOrders = getFilteredOrders();

  // Customer / Order Date / State of Supply are locked (not the whole form —
  // Due Date and line items stay editable) once this order has a source
  // Estimate. See sourceQuotationId's declaration for why.
  const lockFromQuotation = !!sourceQuotationId;

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const stats = {
    total: orders.length,
    open: orders.filter(o => o.status === "OPEN").length,
    overdue: orders.filter(o => o.status === "OVERDUE").length,
    closed: orders.filter(o => o.status === "CLOSED").length,
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 1. CREATE/EDIT FORM VIEW (Viewport Height Locked to calc(100vh - 56px))
  // ════════════════════════════════════════════════════════════════════════════
  if (view === "create" || view === "edit") {
    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background" style={{ height: "calc(100vh - 104px)" }}>
        {/* Top Header */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (readOnly) {
                  setView("list");
                  resetForm();
                  window.history.replaceState({}, "", window.location.pathname);
                  return;
                }
                const hasInput = selectedCustomer || items.some(it => it.itemSearch !== "");
                if (hasInput) {
                  handleSave("DRAFT");
                } else {
                  setView("list");
                  resetForm();
                }
              }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#f58220]" />
                {readOnly ? `Sales Order ${orderNo}` : view === "create" ? "Sale Order" : `Edit Order #${orderNo}`}
              </h2>
              {viewOrderRef?.quotation?.quotationNumber && (
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 mt-0.5 pl-7">
                  Source Estimate: {viewOrderRef.quotation.quotationNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <fieldset
          disabled={readOnly}
          style={{ border: 0, margin: 0, padding: 0, display: "contents" }}
        >
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {/* Customer + Order Details */}
          {/* Customer + Order Details */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 w-full min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 w-full min-w-0">
              {/* Left: Party + Phone */}
              <div className="space-y-3 sm:space-y-4 min-w-0">
                <div className="relative" ref={customerDropRef}>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Party *</label>
                  <div
                    className={clsx(
                      "flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer bg-white dark:bg-[#13151f] transition-all",
                      showCustomerDrop ? "border-orange-400 ring-1 ring-orange-200" : "border-gray-300 dark:border-white/10 hover:border-gray-400"
                    )}
                    onClick={() => { if (!lockFromQuotation) setShowCustomerDrop(v => !v); }}
                  >
                    <input
                      className="flex-1 text-sm text-gray-700 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder-slate-500"
                      placeholder="Select or search party"
                      value={customerSearch}
                      disabled={lockFromQuotation}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                      onClick={e => { e.stopPropagation(); if (!lockFromQuotation) setShowCustomerDrop(true); }}
                    />
                    {customerSearch && (
                      <X 
                        size={14} 
                        className="text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomerSearch("");
                          setSelectedCustomer(null);
                        }} 
                      />
                    )}
                    <ChevronDown size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
                  </div>
                  {showCustomerDrop && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg overflow-hidden">
                      <div className="max-h-52 overflow-y-auto custom-scrollbar">
                        {filteredCustomers.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500 text-center">No customers found</div>
                        ) : (
                          filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-orange-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0 text-left"
                              onClick={() => selectCustomer(c)}
                            >
                              <div>
                                <div className="text-sm font-semibold text-gray-800 dark:text-white">{c.name}</div>
                                <div className="text-xs text-gray-400 dark:text-slate-500">{c.phone || "—"}</div>
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
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]"
                    placeholder="10-digit phone number"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                </div>
              </div>

              {/* Right: Order No, Order Date, Due Date, State of Supply */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Order No</label>
                  <div className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-white/[0.02] font-mono">{orderNo || "Auto"}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Order Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]"
                    value={orderDate}
                    disabled={lockFromQuotation}
                    onChange={e => setOrderDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Due Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">State of Supply</label>
                  <select
                    value={stateOfSupply}
                    onChange={e => setStateOfSupply(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f]"
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Items</span>
              <button
                type="button"
                onClick={() => setPriceMode(priceMode === "without_tax" ? "with_tax" : "without_tax")}
                className="px-2.5 py-1 bg-white dark:bg-card border border-gray-200 dark:border-white/10 hover:border-orange-300 text-xs font-semibold rounded-md text-gray-600 dark:text-slate-300 transition-colors"
              >
                Price: {priceMode === "without_tax" ? "Excl. Tax" : "Incl. Tax"}
              </button>
            </div>
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs border-b border-gray-100 dark:border-white/5">
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
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {items.map((it, idx) => {
                  const comp = computeRow(it, withTax);
                  const isItemDropOpen = openItemDrop === it.id;
                  return (
                    <tr key={it.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02]" style={{ position: "relative", zIndex: isItemDropOpen ? 100 : 1 }}>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-400 dark:text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2.5" style={{ position: "relative", zIndex: isItemDropOpen ? 100 : 1 }}>
                        <input
                          value={it.itemSearch}
                          onChange={e => {
                            updateItem(idx, "itemSearch", e.target.value);
                            setOpenItemDrop(it.id);
                            const rect = e.target.getBoundingClientRect();
                            setItemDropRect({ top: rect.bottom, left: rect.left, width: Math.max(320, rect.width) });
                          }}
                          onFocus={e => {
                            setOpenItemDrop(it.id);
                            const rect = e.target.getBoundingClientRect();
                            setItemDropRect({ top: rect.bottom, left: rect.left, width: Math.max(320, rect.width) });
                          }}
                          placeholder="Search item..."
                          className="w-full px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-md text-sm outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                        />
            {it.itemSearch && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setOpenItemDrop("")} 
              />
            )}
                        {isItemDropOpen && (
                          <div
                            className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl overflow-hidden max-h-44 overflow-y-auto custom-scrollbar item-dropdown-container"
                            style={
                              itemDropRect
                                ? {
                                    position: "fixed",
                                    top: itemDropRect.top + 4,
                                    left: itemDropRect.left,
                                    width: itemDropRect.width,
                                    zIndex: 9999,
                                  }
                                : {
                                    position: "absolute",
                                    left: 0,
                                    top: "100%",
                                    marginTop: "4px",
                                    width: "320px",
                                    zIndex: 9999,
                                  }
                            }
                          >
                            {products.filter(p => p.name.toLowerCase().includes(it.itemSearch.toLowerCase())).length === 0 ? (
                              <div className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500">No items found</div>
                            ) : (
                              products.filter(p => p.name.toLowerCase().includes(it.itemSearch.toLowerCase())).map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-orange-50 dark:hover:bg-white/5 text-left border-b border-gray-50 dark:border-white/5 last:border-0 text-xs"
                                  onClick={() => selectProduct(idx, p)}
                                >
                                  <div>
                                    <strong className="text-gray-800 dark:text-white">{p.name}</strong>
                                    <div className="text-gray-400 dark:text-slate-500">SKU: {p.sku || "—"}</div>
                                  </div>
                                  <span className="text-[#f58220] font-mono font-bold">₹{p.basePrice || p.price || 0}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                        <input
                          value={it.remarks}
                          onChange={e => updateItem(idx, "remarks", e.target.value)}
                          placeholder="Remarks / delivery details"
                          className="w-full px-3 py-1 text-xs text-gray-400 dark:text-slate-500 outline-none bg-transparent mt-1 focus:text-gray-700 dark:focus:text-slate-200"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={e => updateItem(idx, "qty", Number(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-md text-sm text-center outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={it.unit}
                          onChange={e => updateItem(idx, "unit", e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-md text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none focus:border-orange-400"
                        >
                          {getUnitOptions(it).map(u => <option key={u.code} value={u.code}>{u.short}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-slate-500">₹</span>
                          <input
                            type="number"
                            min={0}
                            value={it.rate || ""}
                            onChange={e => updateItem(idx, "rate", Number(e.target.value) || 0)}
                            className="w-full pl-6 pr-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-md text-sm text-right outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white"
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={it.taxPct}
                          onChange={e => {
                            const val = Number(e.target.value);
                            const opt = taxOptionsFor(isSameState).find(x => x.value === val);
                            updateItem(idx, "taxPct", val);
                            updateItem(idx, "taxLabel", opt?.label || "NONE");
                          }}
                          className="w-full px-2 py-1.5 border border-gray-200 dark:border-white/10 rounded-md text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none focus:border-orange-400"
                        >
                          {taxOptionsFor(isSameState).map(t => <option key={t.label} value={t.value}>{t.label}</option>)}
                        </select>
                        <div className="text-[10px] text-right text-gray-400 dark:text-slate-500 mt-0.5 font-mono">₹{comp.taxAmt.toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-gray-700 dark:text-slate-200">
                        ₹{comp.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-300 dark:text-slate-600 hover:text-red-500 rounded transition-colors"
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
            <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
              <div className="flex items-center gap-5 text-xs text-gray-400 dark:text-slate-500">
                <span>Qty: <strong className="text-gray-700 dark:text-slate-200">{totalQty}</strong></span>
                <span>Tax: <strong className="text-gray-700 dark:text-slate-200 font-mono">₹{totalTax.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>

          {/* Notes + Summary */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start w-full min-w-0">
            {/* Left: Add-ons */}
            <div className="flex-1 bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 space-y-3 min-w-0">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowTerms(v => !v)}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all",
                    showTerms ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  <ClipboardList className="h-3.5 w-3.5" /> Terms & Conditions
                </button>
                <button
                  type="button"
                  onClick={() => setShowDesc(v => !v)}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all",
                    showDesc ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" /> Description
                </button>
                <button
                  type="button"
                  onClick={() => showToast("Attachment feature is active on POS terminal only.", "warning")}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300"
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Image
                </button>
                <button
                  type="button"
                  onClick={() => showToast("Attachment feature is active on POS terminal only.", "warning")}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300"
                >
                  <LinkIcon className="h-3.5 w-3.5" /> Document
                </button>
              </div>

              {/* Payment Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Payment Type</label>
                <div className="flex flex-wrap items-center gap-2">
                  {["Cash", "Credit", "Cheque", "Online"].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPaymentType(type)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                        paymentType === type
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-white dark:bg-card text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:border-orange-300"
                      )}
                    >
                      {type === "Online" ? "Online/UPI" : type}
                    </button>
                  ))}
                </div>
              </div>

              {showTerms && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Terms & Conditions</label>
                  <textarea
                    rows={3}
                    value={termsText}
                    onChange={e => setTermsText(e.target.value)}
                    placeholder="Enter sales terms, delivery instructions..."
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none resize-none focus:border-orange-400 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
              {showDesc && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Order Remarks / Memo</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Internal remarks or packaging instructions..."
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none resize-none focus:border-orange-400 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
            </div>

            {/* Right: Summary */}
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 w-full lg:w-72 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-slate-400">Subtotal</span>
                <span className="font-mono font-semibold text-gray-700 dark:text-slate-200">₹{totalAmount.toFixed(2)}</span>
              </div>
              {totalTax > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Tax</span>
                  <span className="font-mono text-gray-600 dark:text-slate-300">₹{totalTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <label htmlFor="so_roundoff" className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    id="so_roundoff"
                    checked={roundOffEnabled}
                    onChange={e => setRoundOffEnabled(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 dark:border-white/20"
                  />
                  Round Off
                </label>
                <span className="font-mono text-gray-500 dark:text-slate-400 text-xs">{roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                <span className="font-bold text-gray-800 dark:text-white">Total</span>
                <span className="text-xl font-bold font-mono text-[#f58220]">₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        </fieldset>

        {/* Action Bar */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          {readOnly ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  resetForm();
                  window.history.replaceState({}, "", window.location.pathname);
                }}
                className="px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-gray-600 dark:text-slate-300 transition-colors"
              >
                Back to List
              </button>
              {viewOrderRef?.status === "DRAFT" && (
                <button
                  type="button"
                  onClick={(e) => handleConfirm(viewOrderRef, e)}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
                >
                  <Check className="h-4 w-4" /> Confirm Order
                </button>
              )}
              {viewOrderRef?.status === "CONFIRMED" && !viewOrderRef?.proformaInvoiceId && (
                <button
                  type="button"
                  onClick={(e) => handleCreateProforma(viewOrderRef, e)}
                  disabled={convertingId === viewOrderRef?.id}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  {convertingId === viewOrderRef?.id ? "Creating..." : "Create Proforma Invoice"}
                </button>
              )}
              {viewOrderRef?.proformaInvoiceId && (
                <a
                  href={`/sales/proforma-invoice?id=${viewOrderRef.proformaInvoiceId}`}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                >
                  View Proforma Invoice
                </a>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setView("list"); resetForm(); }}
                className="px-4 py-2 text-sm font-semibold border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-gray-600 dark:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave("OPEN")}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                <Check className="h-4 w-4" /> {saving ? "Updating..." : "Update Order"}
              </button>
            </>
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
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-end w-full min-w-0">
          <button
            onClick={() => { resetForm(); setView("create"); }}
            className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-2 rounded-xl shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> New Order
          </button>
        </div>

        <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0">

          {/* ── Summary Stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0">
            {[
              { label: "Total Orders", value: stats.total, color: "text-gray-700 dark:text-slate-200", dot: "bg-gray-400" },
              { label: "Open Orders",  value: stats.open,  color: "text-blue-600 dark:text-blue-400",   dot: "bg-blue-500" },
              { label: "Overdue",      value: stats.overdue, color: "text-red-600 dark:text-red-400",   dot: "bg-red-500" },
              { label: "Closed",       value: stats.closed, color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 px-3.5 sm:px-4 py-3 flex items-center gap-3 min-w-0">
                <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 truncate">{s.label}</p>
                  <p className={clsx("text-base sm:text-lg font-bold truncate", s.color)}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Filters Row ── */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search order or party..."
                className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-500 bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              {search && (
                <X 
                  size={14} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                  onClick={() => setSearch("")} 
                />
              )}
            </div>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-card text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none"
            >
              <option value="THIS_MONTH">This Month</option>
              <option value="TODAY">Today</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
            {dateFilter === "CUSTOM" && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white text-xs outline-none" />
                <span className="text-gray-400 text-xs">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white text-xs outline-none" />
              </div>
            )}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-card text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none"
            >
              <option value="ALL">All Orders</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={fetchAllData} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors" title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Empty State ── */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl py-16 sm:py-20 flex flex-col items-center justify-center text-center space-y-4 px-4">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
                <ShoppingBag className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <p className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base">No Sales Orders</p>
                <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Record sales bookings and convert them to invoices.</p>
              </div>
              <button
                onClick={() => { resetForm(); setView("create"); }}
                className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors"
              >
                Create Order
              </button>
            </div>
          ) : (
            /* ── Table ── */
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0">
              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                  <th className="text-left px-4 py-3">Party</th>
                  <th className="text-left px-4 py-3">Order No.</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Due Date</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredOrders.map(o => {
                  const style = STATUS_STYLES[o.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <div className="font-medium text-gray-800 dark:text-white text-sm">{o.customerName}</div>
                          {o.customerPhone && <div className="text-xs text-gray-400 dark:text-slate-500">{o.customerPhone}</div>}
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-white/10">
                            {o.partyType || (o.customerId ? "CUSTOMER" : "UNKNOWN")}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-600 dark:text-slate-400 text-xs">
                        {o.orderNo}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">
                        {formatDate(o.invoiceDate)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">
                        {formatDate(o.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-white text-sm">
                        ₹{Number(o.finalAmount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400 text-sm">
                        ₹{Number(o.balance).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {o.status === "DRAFT" && (
                            <>
                              <button
                                onClick={() => handleEdit(o)}
                                className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors"
                              >
                                Resume
                              </button>
                              <button
                                onClick={(e) => handleConfirm(o, e)}
                                className="px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded transition-colors"
                              >
                                Confirm
                              </button>
                            </>
                          )}
                          {o.status === "CONFIRMED" && !o.proformaInvoiceId && (
                            <button
                              onClick={(e) => handleCreateProforma(o, e)}
                              disabled={convertingId === o.id}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors disabled:opacity-50"
                            >
                              {convertingId === o.id ? "..." : "Create Proforma Invoice"}
                            </button>
                          )}
                          {o.proformaInvoiceId && (
                            <a
                              href={`/sales/proforma-invoice?id=${o.proformaInvoiceId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors"
                            >
                              View Proforma Invoice
                            </a>
                          )}
                          {o.status === "DELIVERED" && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <Check className="h-3 w-3" /> Done
                            </span>
                          )}
                          <div className="relative">
                            <button
                              onClick={() => setShowRowMenu(showRowMenu === o.id ? null : o.id)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
                            >
                              <ChevronRight className="h-4 w-4 rotate-90" />
                            </button>
                            {showRowMenu === o.id && (
                              <div className="absolute right-0 top-8 z-50 w-32 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg shadow-lg py-1 text-left">
                                <button
                                  onClick={() => { handleEdit(o); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-700 dark:text-slate-200 text-left"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => { setPreviewingOrder(o); setShowRowMenu(null); }}
                                  className="w-full px-3 py-2 hover:bg-gray-50 text-xs text-gray-700 text-left"
                                >
                                  Print
                                </button>
                                <button
                                  onClick={() => { handleDelete(o.id); setShowRowMenu(null); }}
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

      {previewingOrder && (
        <GSTInvoice
          order={{
            poNumber: previewingOrder.orderNo,
            createdAt: previewingOrder.invoiceDate,
            items: (previewingOrder.items || []).map((it: any) => ({
              itemName: it.description || it.productName || "Item",
              quantity: it.qty ?? it.quantity ?? 0,
              price: it.rate ?? it.unitPrice ?? 0,
              gstRate: it.taxPct ?? it.taxPercent ?? 0,
            })),
          }}
          vendor={{
            name: previewingOrder.customerName,
            address: previewingOrder.stateOfSupply,
            state: previewingOrder.stateOfSupply,
            phone: previewingOrder.customerPhone,
          }}
          companyDetails={currentCompany}
          documentType="SALES_ORDER"
          dueDateDays={(() => {
            const from = previewingOrder.invoiceDate ? new Date(previewingOrder.invoiceDate).getTime() : NaN;
            const to = previewingOrder.dueDate ? new Date(previewingOrder.dueDate).getTime() : NaN;
            if (isNaN(from) || isNaN(to)) return 15;
            const days = Math.round((to - from) / 86400000);
            return days >= 0 ? days : 15;
          })()}
          onClose={() => setPreviewingOrder(null)}
        />
      )}
    </div>
  );
}

