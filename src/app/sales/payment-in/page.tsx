"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wallet, Plus, RefreshCw, ChevronDown, X, Search,
  Share2, Trash2, ArrowLeft, Calendar, Check, Printer, Ban
} from "lucide-react";
import { clsx } from "clsx";
import { useSearchParams } from "next/navigation";
import { customersApi, dealersApi, franchiseApi, draftsApi, accountingApi, settingsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatERPNumber, formatDate } from "@/lib/utils";
import api from "@/lib/api/base";
import GSTInvoice from "@/components/documents/GSTInvoice";

const FALLBACK_COMPANY = {
  name: "My Restaurant",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "Tamil Nadu"
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_MODES = ["Cash", "Cheque", "Online Transfer", "UPI", "Card", "Bank Transfer"];

const PARTY_TYPES: { value: "CUSTOMER" | "DEALER" | "FRANCHISE"; label: string }[] = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "DEALER", label: "Dealer" },
  { value: "FRANCHISE", label: "Franchise" },
];

function normalizeParty(partyType: "CUSTOMER" | "DEALER" | "FRANCHISE", raw: any) {
  if (partyType === "FRANCHISE") {
    return { id: raw.id, name: raw.name, phone: raw.contactNum || "", raw };
  }
  if (partyType === "DEALER") {
    return { id: raw.id, name: raw.name, phone: raw.phone || "", raw };
  }
  return { id: raw.id, name: raw.name, phone: raw.phone || "", raw };
}

function getPeriodDates(period: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === "this_month") {
    return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
  }
  if (period === "last_month") {
    return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) };
  }
  if (period === "this_quarter") {
    const q = Math.floor(m / 3);
    return { start: iso(new Date(y, q * 3, 1)), end: iso(new Date(y, q * 3 + 3, 0)) };
  }
  if (period === "this_year") {
    return { start: iso(new Date(y, 0, 1)), end: iso(new Date(y, 11, 31)) };
  }
  return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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
    <div className="bg-white dark:bg-[#13151f] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 p-3 w-64 select-none animate-in fade-in duration-150">
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
              isSelected(d) && "bg-[#f58220] text-white",
              !isSelected(d) && isToday(d) && "bg-orange-50 dark:bg-orange-500/10 text-[#f58220]",
              !isSelected(d) && !isToday(d) && "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5"
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
          className="text-[11px] font-semibold text-[#f58220] hover:text-[#e8740e]"
        >Today</button>
        <button onClick={onClose} className="text-[11px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">Close</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PaymentInPage() {
  const { showToast } = useToast();

  // filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState(getPeriodDates("this_month").start);
  const [dateTo, setDateTo] = useState(getPeriodDates("this_month").end);
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);
  const fromCalRef = useRef<HTMLDivElement>(null);
  const toCalRef = useRef<HTMLDivElement>(null);

  // list state
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [printingPayment, setPrintingPayment] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<any>(null);

  // form state
  const [view, setView] = useState<"list" | "create">("list");
  const [saving, setSaving] = useState(false);
  const [partyType, setPartyType] = useState<"CUSTOMER" | "DEALER" | "FRANCHISE">("CUSTOMER");
  const [dealers, setDealers] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [description, setDescription] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  const customerDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/accounting/payments", {
        params: { type: "INFLOW", startDate: dateFrom, endDate: dateTo }
      }).catch(() => ({ data: [] }));
      
      let apiPayments = (res as any).data?.payments || (res as any).data || [];

      // Merge server-persisted drafts
      const dRes = await draftsApi.getDrafts("payment_in").catch(() => ({ data: [] }));
      const rawDrafts = (dRes as any).data || [];
      const formattedDrafts = rawDrafts.map((d: any) => ({
        id: d.id,
        status: "DRAFT",
        createdAt: d.createdAt,
        entity: d.data?.entity || { name: "Unknown Customer" },
        paymentNumber: "DRAFT",
        paymentMode: d.data?.paymentMode,
        paidAmount: d.data?.paidAmount || 0,
        _rawState: d.data?._rawState,
      }));
      apiPayments = [...formattedDrafts, ...apiPayments];

      setPayments(apiPayments);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await customersApi.getAll();
      setCustomers((res as any).data || []);
    } catch {}
  }, []);

  const fetchDealers = useCallback(async () => {
    try {
      const res = await dealersApi.getAll();
      setDealers(((res as any).data || []).map((d: any) => normalizeParty("DEALER", d)));
    } catch {}
  }, []);

  const fetchFranchises = useCallback(async () => {
    try {
      const res = await franchiseApi.getAll();
      setFranchises(((res as any).data || []).map((f: any) => normalizeParty("FRANCHISE", f)));
    } catch {}
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await api.get("/api/finance/invoices");
      setInvoices((res as any).data || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPayments(); fetchCustomers(); fetchDealers(); fetchFranchises(); fetchInvoices();
  }, [fetchPayments, fetchCustomers, fetchDealers, fetchFranchises, fetchInvoices]);

  useEffect(() => {
    settingsApi.getCompanyProfile()
      .then(res => setCompanyProfile(res.data))
      .catch(() => {});
  }, []);

  const partySourceList = partyType === "DEALER" ? dealers : partyType === "FRANCHISE" ? franchises : customers;

  const customerInvoices = selectedCustomer
    ? invoices.filter((inv: any) => {
        const order = inv.order || {};
        const invPartyType = order.partyType || "CUSTOMER";
        const invPartyId = invPartyType === "CUSTOMER" ? (order.partyId || order.customerId) : order.partyId;
        return invPartyType === partyType && invPartyId === selectedCustomer.id && inv.status !== "PAID";
      })
    : [];

  const searchParamsHook = useSearchParams();

  useEffect(() => {
    const linkedInvoiceId = searchParamsHook.get("invoiceId");
    const linkedPartyType = searchParamsHook.get("partyType") as "CUSTOMER" | "DEALER" | "FRANCHISE" | null;
    const linkedPartyId = searchParamsHook.get("partyId");
    if (!linkedInvoiceId || !linkedPartyId) return;
    if (invoices.length === 0) return;
    if (customers.length === 0 && dealers.length === 0 && franchises.length === 0) return;

    const pt = linkedPartyType || "CUSTOMER";
    const sourceList = pt === "DEALER" ? dealers : pt === "FRANCHISE" ? franchises : customers;
    const party = sourceList.find((p: any) => p.id === linkedPartyId);
    if (!party) return;

    setPartyType(pt);
    setSelectedCustomer(party);
    setCustomerSearch(party.name);
    setSelectedInvoiceId(linkedInvoiceId);
    setView("create");
  }, [searchParamsHook, invoices, customers, dealers, franchises]);

  const selectedInvoice = customerInvoices.find((inv: any) => inv.id === selectedInvoiceId) || null;
  const invoicePaidSoFar = selectedInvoice
    ? (selectedInvoice.payments || []).filter((p: any) => p.status === "PAID" && !p.isCancelled).reduce((s: number, p: any) => s + (p.paidAmount || 0), 0)
    : 0;
  const invoiceOutstanding = selectedInvoice ? Math.max(0, selectedInvoice.finalAmount - invoicePaidSoFar) : 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropRef.current && !customerDropRef.current.contains(e.target as Node))
        setShowCustomerDrop(false);
      if (shareDropRef.current && !shareDropRef.current.contains(e.target as Node))
        setShowShareDrop(false);
      if (fromCalRef.current && !fromCalRef.current.contains(e.target as Node))
        setShowFromCal(false);
      if (toCalRef.current && !toCalRef.current.contains(e.target as Node))
        setShowToCal(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSave = async (isDraft = false) => {
    if (!selectedCustomer && !isDraft) { showToast("Please select a party", "error"); return; }
    if ((!amount || Number(amount) <= 0) && !isDraft) { showToast("Enter a valid amount", "error"); return; }
    if (!isDraft) {
      if (!selectedInvoice) { showToast("Select the Tax Invoice this payment is against", "error"); return; }
      if (Number(amount) > invoiceOutstanding + 0.01) {
        showToast(`Amount exceeds the outstanding balance (₹${invoiceOutstanding.toFixed(2)}) on this invoice`, "error");
        return;
      }
    }

    if (isDraft && !selectedCustomer && (!amount || Number(amount) <= 0)) {
      setView("list");
      resetForm();
      return;
    }

    if (isDraft) {
      try {
        await draftsApi.saveDraft({
          id: draftId || undefined,
          type: "payment_in",
          data: {
            entity: selectedCustomer || { name: "Unknown Customer" },
            paymentMode: paymentMode,
            paidAmount: Number(amount) || 0,
            _rawState: {
              partyType,
              selectedCustomer,
              customerSearch,
              selectedInvoiceId,
              amount,
              paymentMode,
              description,
              chequeNo,
              receiptDate
            }
          }
        });
        showToast("Draft saved successfully", "success");
        fetchPayments();
        setView("list");
        resetForm();
      } catch {
        showToast("Failed to save draft", "error");
      }
      return;
    }

    setSaving(true);
    try {
      const methodMap: Record<string, string> = {
        Cash: "CASH",
        Cheque: "CHEQUE",
        "Online Transfer": "BANK_TRANSFER",
        UPI: "UPI",
        Card: "CARD",
        "Bank Transfer": "BANK_TRANSFER",
      };
      await api.post("/api/accounting/payments", {
        amount: Number(amount),
        flow: "IN",
        status: "PAID",
        method: methodMap[paymentMode] || "CASH",
        entityId: selectedCustomer.id,
        entityType: partyType,
        entity: selectedCustomer.name,
        invoiceId: selectedInvoice.id,
        linkedDocType: "INVOICE",
        linkedDocId: selectedInvoice.orderId,
        type: "INVOICE_LINKED",
        sourceModule: "MANUAL",
        reference: chequeNo || description || undefined,
        createdBy: "SYSTEM",
        idempotencyKey,
      });

      if (draftId) {
        try {
          await draftsApi.deleteDraft(draftId);
        } catch (e) {
          console.error("Failed to clear draft", e);
        }
      }

      showToast("Payment recorded successfully", "success");
      resetForm();
      fetchPayments();
      setView("list");
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to record payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setDraftId(null);
    setPartyType("CUSTOMER");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setSelectedInvoiceId("");
    setAmount("");
    setPaymentMode("Cash");
    setDescription("");
    setChequeNo("");
    setReceiptDate(new Date().toISOString().split("T")[0]);
    setIdempotencyKey(crypto.randomUUID());
  };

  const handleDeleteDraft = async (id: string) => {
    try {
      await draftsApi.deleteDraft(id);
      showToast("Draft deleted", "success");
      fetchPayments();
    } catch {
      showToast("Failed to delete draft", "error");
    }
  };

  const handleCancelPayment = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel / reverse this payment receipt?")) return;
    try {
      await accountingApi.cancelPayment(id);
      showToast("Payment cancelled successfully", "success");
      fetchPayments();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to cancel payment", "error");
    }
  };

  const loadDraft = (draft: any) => {
    setDraftId(draft.id);
    const raw = draft._rawState || {};
    setPartyType(raw.partyType || "CUSTOMER");
    setSelectedCustomer(raw.selectedCustomer || null);
    setCustomerSearch(raw.customerSearch || "");
    setSelectedInvoiceId(raw.selectedInvoiceId || "");
    setAmount(raw.amount || "");
    setPaymentMode(raw.paymentMode || "Cash");
    setDescription(raw.description || "");
    setChequeNo(raw.chequeNo || "");
    setReceiptDate(raw.receiptDate || new Date().toISOString().split("T")[0]);
    setIdempotencyKey(crypto.randomUUID());
    setView("create");
  };

  const filteredParties = partySourceList.filter((c: any) =>
    !customerSearch ||
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const filtered = payments.filter(p => {
    if (statusFilter !== "ALL") {
      if (statusFilter === "DRAFT" && p.status !== "DRAFT") return false;
      if (statusFilter === "SUCCESS" && p.status !== "PAID" && p.status !== "SUCCESS") return false;
      if (statusFilter === "CANCELLED" && !p.isCancelled) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const entityName = (typeof p.entity === "string" ? p.entity : p.entity?.name || "").toLowerCase();
      const num = (p.paymentNumber || "").toLowerCase();
      if (!entityName.includes(q) && !num.includes(q)) return false;
    }
    return true;
  });

  const totalAmount = filtered.reduce((s: number, p: any) => s + (p.paidAmount || 0), 0);
  const totalReceived = filtered.filter((p: any) => (p.status === "PAID" || p.status === "SUCCESS") && !p.isCancelled)
    .reduce((s: number, p: any) => s + (p.paidAmount || 0), 0);
  const totalDrafts = filtered.filter((p: any) => p.status === "DRAFT").length;

  // ── CREATE VIEW ────────────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 min-h-screen w-full min-w-0">

        {/* Top bar */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xs w-full min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => { resetForm(); setView("list"); }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 dark:text-slate-400 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
              {draftId ? "Edit Draft Payment" : "Record Payment-In"}
            </h2>
          </div>
          <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">
            Receipt No: <strong className="text-[#f58220] font-bold">Auto</strong>
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 custom-scrollbar w-full min-w-0">

          {/* Party type toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {PARTY_TYPES.map(pt => (
              <button
                key={pt.value}
                onClick={() => {
                  if (pt.value === partyType) return;
                  setPartyType(pt.value);
                  setSelectedCustomer(null);
                  setCustomerSearch("");
                  setSelectedInvoiceId("");
                  setAmount("");
                }}
                className={clsx(
                  "px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer",
                  partyType === pt.value
                    ? "bg-[#f58220] text-white border-[#f58220] shadow-2xs"
                    : "bg-white dark:bg-card text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {/* Party + Date row */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs p-4 sm:p-5 w-full min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 items-start w-full min-w-0">

              {/* Party dropdown */}
              <div className="relative min-w-0 col-span-1 sm:col-span-2 md:col-span-1" ref={customerDropRef}>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Party *</label>
                <div
                  className={clsx(
                    "flex items-center gap-2 border rounded-xl px-3 py-2 cursor-pointer bg-white dark:bg-[#13151f] transition-all",
                    showCustomerDrop ? "border-[#f58220] ring-1 ring-orange-200 dark:ring-orange-500/20" : "border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20"
                  )}
                  onClick={() => setShowCustomerDrop(v => !v)}
                >
                  <div className="flex-1 min-w-0">
                    <input
                      className="w-full text-xs sm:text-sm text-gray-700 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder:text-slate-500"
                      placeholder={`Search ${partyType === "CUSTOMER" ? "customers" : partyType === "DEALER" ? "dealers" : "franchises"}...`}
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                      onClick={e => { e.stopPropagation(); setShowCustomerDrop(true); }}
                    />
                  </div>
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
                  <div className="absolute top-full left-0 z-50 mt-1 w-full max-w-[calc(100vw-2rem)] sm:w-80 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl max-h-56 overflow-y-auto custom-scrollbar">
                    {filteredParties.length === 0 ? (
                      <div className="px-3 py-4 text-xs sm:text-sm text-gray-400 dark:text-slate-500 text-center">
                        No {partyType === "CUSTOMER" ? "customers" : partyType === "DEALER" ? "dealers" : "franchises"} found
                      </div>
                    ) : filteredParties.map((c: any) => (
                      <button
                        key={c.id}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-orange-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0 text-left transition-colors cursor-pointer"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerDrop(false); setSelectedInvoiceId(""); setAmount(""); }}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs sm:text-sm font-medium text-gray-800 dark:text-white truncate">{c.name}</div>
                          <div className="text-[11px] text-gray-400 dark:text-slate-500">{c.phone || "—"}</div>
                        </div>
                        {c.balance > 0 && (
                          <div className="flex items-center gap-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-0.5 rounded shrink-0">
                            ₹{c.balance} <Check size={10} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Receipt No */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Receipt No</label>
                <div className="bg-gray-50 dark:bg-[#13151f] border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-500 dark:text-slate-400 font-mono">
                  Auto
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Receipt Date</label>
                <div className="flex items-center gap-2 border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-[#13151f]">
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={e => setReceiptDate(e.target.value)}
                    className="w-full text-xs sm:text-sm text-gray-700 dark:text-white outline-none bg-transparent"
                  />
                  <Calendar size={14} className="text-[#f58220] shrink-0" />
                </div>
              </div>

            </div>
          </div>

          {/* Invoice selection */}
          {selectedCustomer && (
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs p-4 sm:p-5 space-y-3 w-full min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2">
                Tax Invoice Linkage
              </div>
              {customerInvoices.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-slate-500 py-1">
                  No unpaid or partially paid Tax Invoices found for {selectedCustomer.name}.
                </p>
              ) : (
                <div className="space-y-3">
                  <select
                    value={selectedInvoiceId}
                    onChange={e => { setSelectedInvoiceId(e.target.value); setAmount(""); }}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none bg-white dark:bg-[#13151f] focus:border-[#f58220]"
                  >
                    <option value="" disabled className="dark:bg-card">Select invoice...</option>
                    {customerInvoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id} className="dark:bg-card">
                        {inv.order?.invoiceNum || inv.id} — Total: ₹{Number(inv.finalAmount || 0).toFixed(2)} ({inv.status})
                      </option>
                    ))}
                  </select>
                  {selectedInvoice && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-center">
                      <div className="p-2.5 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-semibold">Invoice Total</p>
                        <p className="text-sm sm:text-base font-bold font-mono text-gray-800 dark:text-white mt-0.5">₹{Number(selectedInvoice.finalAmount || 0).toFixed(2)}</p>
                      </div>
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">Already Paid</p>
                        <p className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">₹{invoicePaidSoFar.toFixed(2)}</p>
                      </div>
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-100 dark:border-rose-500/20">
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">Outstanding</p>
                        <p className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">₹{invoiceOutstanding.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Amount + Mode */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs p-4 sm:p-5 space-y-4 w-full min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2">
              Payment Details
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 block">Amount Received (₹) *</label>
                <div className="flex items-center border border-gray-300 dark:border-white/10 rounded-xl bg-white dark:bg-[#13151f] overflow-hidden focus-within:border-[#f58220]">
                  <span className="px-3 py-2 text-gray-400 dark:text-slate-500 text-xs sm:text-sm border-r border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">₹</span>
                  <input
                    type="number"
                    min={0}
                    max={selectedInvoice ? invoiceOutstanding : undefined}
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs sm:text-sm text-gray-800 dark:text-white outline-none font-semibold bg-transparent"
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 block">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none bg-white dark:bg-[#13151f] focus:border-[#f58220]"
                >
                  {PAYMENT_MODES.map(m => <option key={m} value={m} className="dark:bg-card">{m}</option>)}
                </select>
              </div>

              {/* Cheque / Reference No */}
              {(paymentMode === "Cheque" || paymentMode === "Online Transfer" || paymentMode === "UPI" || paymentMode === "Bank Transfer" || paymentMode === "Card") && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 block">
                    {paymentMode === "Cheque" ? "Cheque No." : "Transaction / Reference No."}
                  </label>
                  <input
                    type="text"
                    placeholder={`Enter ${paymentMode === "Cheque" ? "cheque number" : "reference number"}`}
                    value={chequeNo}
                    onChange={e => setChequeNo(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                  />
                </div>
              )}

              {/* Description */}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 block">Description / Note</label>
                <input
                  type="text"
                  placeholder="Optional notes or remarks..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                />
              </div>
            </div>
          </div>

          {/* Total display */}
          {amount && Number(amount) > 0 && (
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">Amount to be Received</span>
              <span className="text-base sm:text-lg font-bold font-mono text-[#f58220]">₹{Number(amount).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0 shadow-2xs w-full min-w-0">
          <button
            onClick={() => { resetForm(); setView("list"); }}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Share dropdown */}
            <div className="relative" ref={shareDropRef}>
              <div className="flex rounded-xl overflow-hidden shadow-sm border border-orange-200 dark:border-orange-500/20">
                <button
                  onClick={() => showToast("Share feature coming soon", "info")}
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-[#f58220] hover:bg-[#e8740e] border-r border-orange-400/50 transition-colors cursor-pointer"
                >
                  Share
                </button>
                <button
                  onClick={() => setShowShareDrop(v => !v)}
                  className="px-2 py-2 text-xs sm:text-sm text-white bg-[#f58220] hover:bg-[#e8740e] transition-colors cursor-pointer"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              {showShareDrop && (
                <div className="absolute bottom-full right-0 mb-1.5 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl text-xs w-44 z-50 p-1 animate-in zoom-in-95 duration-150">
                  <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-lg flex items-center gap-2 cursor-pointer">
                    <Printer size={13} /> Print
                  </button>
                  <button
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-lg cursor-pointer"
                    onClick={async () => { setShowShareDrop(false); await handleSave(); }}
                  >
                    Save &amp; New
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-60 transition-colors cursor-pointer"
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 sm:px-6 py-2 text-xs sm:text-sm font-bold text-white bg-[#f58220] hover:bg-[#e8740e] rounded-xl shadow-sm active:scale-95 disabled:opacity-60 transition-all cursor-pointer"
            >
              <Check size={16} /> <span>{saving ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  const fmt = (d: string) => formatDate(d + "T00:00:00");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 w-full min-w-0">

      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Payments In
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">
              Record, track, and manage incoming customer payments
            </p>
          </div>
        </div>
        <button
          onClick={() => setView("create")}
          className="flex items-center justify-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4 shrink-0" /> <span>Add Payment-In</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full min-w-0">
          {[
            { label: "Total Amount Received", value: `₹${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-gray-700 dark:text-slate-200", dot: "bg-gray-400" },
            { label: "Confirmed Payments",    value: `₹${totalReceived.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,  color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
            { label: "Draft Records",         value: `${totalDrafts}`,                                                        color: "text-amber-600 dark:text-amber-400",    dot: "bg-amber-500" },
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
              placeholder="Search payment or customer..."
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
              {["ALL", "SUCCESS", "DRAFT", "CANCELLED"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={clsx(
                    "px-3 py-1.5 sm:py-2 text-xs font-medium transition-colors rounded-lg whitespace-nowrap shrink-0",
                    statusFilter === s ? "bg-[#f58220] text-white shadow-2xs" : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  {s === "ALL" ? "All" : s === "SUCCESS" ? "Paid" : s === "CANCELLED" ? "Cancelled" : "Draft"}
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
              onClick={fetchPayments}
              className="p-2 sm:p-2.5 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 transition-colors cursor-pointer shrink-0"
              title="Refresh"
              aria-label="Refresh Payments"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* ── Empty State ── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-[#f58220] opacity-70" />
            <p className="text-xs text-gray-500 dark:text-slate-400">Loading payments...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-2xs w-full min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center">
              <Wallet className="h-7 w-7 sm:h-8 sm:w-8 text-[#f58220]" />
            </div>
            <div className="max-w-md">
              <p className="text-gray-900 dark:text-white font-bold text-base sm:text-lg">No Payments Found</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
                {search || statusFilter !== "ALL"
                  ? "No payments match your search or filter criteria."
                  : "Record a payment to track your cashflow and settle customer invoices."}
              </p>
            </div>
            <button
              onClick={() => setView("create")}
              className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Payment-In
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-semibold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Receipt No.</th>
                    <th className="text-left px-4 py-3">Party Name</th>
                    <th className="text-left px-4 py-3">Mode</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filtered.map((p: any) => {
                    const isDraft = p.status === "DRAFT";
                    return (
                      <tr 
                        key={p.id} 
                        className={clsx(
                          "transition-colors",
                          isDraft ? "hover:bg-orange-50/50 dark:hover:bg-orange-500/10 cursor-pointer bg-orange-50/30 dark:bg-orange-500/5" : "hover:bg-orange-50/20 dark:hover:bg-white/[0.02]"
                        )}
                        onClick={() => {
                          if (isDraft) loadDraft(p);
                        }}
                      >
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-orange-600 dark:text-orange-400 text-xs whitespace-nowrap">
                          {p.paymentNumber && p.paymentNumber !== "DRAFT" ? formatERPNumber("RCPT", p.paymentNumber, p.createdAt) : (isDraft ? "Draft" : "—")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1 max-w-[200px] sm:max-w-[260px]">
                            <span className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate w-full" title={(typeof p.entity === "string" ? p.entity : p.entity?.name) || p.entityId || "—"}>
                              {(typeof p.entity === "string" ? p.entity : p.entity?.name) || p.entityId || "—"}
                            </span>
                            {!isDraft && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10">
                                {p.entityType || "CUSTOMER"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-slate-400 text-xs whitespace-nowrap">
                          {p.paymentMode || p.method || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-gray-900 dark:text-white text-xs sm:text-sm whitespace-nowrap">
                          ₹{(p.paidAmount || p.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {isDraft ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20">
                              Draft
                            </span>
                          ) : p.isCancelled ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10">
                              Cancelled
                            </span>
                          ) : p.status === "PAID" || p.status === "SUCCESS" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20">
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20">
                              {p.status || "Pending"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isDraft ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteDraft(p.id); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-200 dark:hover:border-red-500/20 transition-colors cursor-pointer"
                                title="Delete Draft"
                                aria-label="Delete Draft"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPrintingPayment(p); }}
                                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-transparent hover:border-gray-200 dark:border-white/10 transition-colors cursor-pointer"
                                  title="Print Receipt"
                                  aria-label="Print Receipt"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); showToast("Share feature coming soon", "info"); }}
                                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg border border-transparent hover:border-gray-200 dark:border-white/10 transition-colors cursor-pointer"
                                  title="Share Receipt"
                                  aria-label="Share Receipt"
                                >
                                  <Share2 className="h-4 w-4" />
                                </button>
                                {!p.isCancelled && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleCancelPayment(p.id); }}
                                    className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 transition-colors cursor-pointer"
                                    title="Cancel / Reverse Payment"
                                    aria-label="Cancel Payment"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </button>
                                )}
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

        {/* Print Receipt Modal */}
        {printingPayment && (
          <GSTInvoice
            order={{
              ...printingPayment,
              id: printingPayment.id,
              poNumber: printingPayment.paymentNumber ? (printingPayment.paymentNumber.startsWith('RCPT') ? printingPayment.paymentNumber : `RCPT-${printingPayment.paymentNumber}`) : undefined,
              createdAt: printingPayment.createdAt,
              items: [
                {
                  itemName: `Payment against Invoice / Account (${printingPayment.paymentMode || printingPayment.method || 'Cash'})`,
                  quantity: 1,
                  price: printingPayment.paidAmount || printingPayment.amount || 0,
                  gstRate: 0,
                  hsnCode: '9971'
                }
              ]
            }}
            vendor={typeof printingPayment.entity === "object" ? printingPayment.entity : { name: printingPayment.entity || "Customer" }}
            companyDetails={companyProfile || FALLBACK_COMPANY}
            documentType="PAYOUT_RECEIPT"
            onClose={() => setPrintingPayment(null)}
          />
        )}
      </div>
    </div>
  );
}
