"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wallet, Plus, RefreshCw, ChevronDown, X, Search,
  Share2, Trash2, ArrowLeft, ArrowRight,
  Calendar, Check, Printer
} from "lucide-react";
import { clsx } from "clsx";
import { customersApi, draftsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatERPNumber, formatDate } from "@/lib/utils";
import api from "@/lib/api/base";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_MODES = ["Cash", "Cheque", "Online Transfer", "UPI", "Card", "Bank Transfer"];

const PERIOD_OPTIONS = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "This Quarter", value: "this_quarter" },
  { label: "This Year", value: "this_year" },
  { label: "Custom", value: "custom" },
];

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

// ── Empty state illustration ──────────────────────────────────────────────────

function EmptyIllustration() {
  return (
    <div className="w-28 h-28 mx-auto mb-4 relative">
      <div className="absolute inset-0 rounded-full bg-orange-50 flex items-center justify-center">
        <div className="w-20 h-16 rounded-lg bg-white border-2 border-blue-100 flex flex-col gap-1.5 items-start justify-center px-3 shadow-sm">
          <div className="w-10 h-1.5 rounded bg-orange-200" />
          <div className="w-6 h-1.5 rounded bg-orange-100" />
          <div className="w-8 h-1.5 rounded bg-orange-100" />
        </div>
        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-orange-100 border-2 border-orange-200 flex items-center justify-center">
          <Wallet size={12} className="text-blue-400" />
        </div>
      </div>
    </div>
  );
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
  const [period, setPeriod] = useState("this_month");
  const [showPeriodDrop, setShowPeriodDrop] = useState(false);
  const [dateRange, setDateRange] = useState(getPeriodDates("this_month"));
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // form state
  const [view, setView] = useState<"list" | "create">("list");
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [description, setDescription] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  const periodDropRef = useRef<HTMLDivElement>(null);
  const customerDropRef = useRef<HTMLDivElement>(null);
  const shareDropRef = useRef<HTMLDivElement>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/accounting/payments", {
        params: { type: "INFLOW", startDate: dateFrom, endDate: dateTo }
      }).catch(() => ({ data: [] }));
      
      let apiPayments = (res as any).data?.payments || (res as any).data || [];

      // Merge server-persisted drafts (previously localStorage-only, so drafts
      // were invisible to other devices/users and lost if storage was cleared)
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

  // Tax Invoices with an outstanding balance — a customer payment must be
  // recorded against a specific invoice (see FinanceService.createPayment's
  // invoiceId-driven paid/outstanding recompute); without this the page had
  // no invoice concept at all.
  const fetchInvoices = useCallback(async () => {
    try {
      const res = await api.get("/api/finance/invoices");
      setInvoices((res as any).data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchPayments(); fetchCustomers(); fetchInvoices(); }, [fetchPayments, fetchCustomers, fetchInvoices]);

  const customerInvoices = selectedCustomer
    ? invoices.filter((inv: any) => inv.order?.customerId === selectedCustomer.id && inv.status !== "PAID")
    : [];
  const selectedInvoice = customerInvoices.find((inv: any) => inv.id === selectedInvoiceId) || null;
  const invoicePaidSoFar = selectedInvoice
    ? (selectedInvoice.payments || []).filter((p: any) => p.status === "PAID" && !p.isCancelled).reduce((s: number, p: any) => s + (p.paidAmount || 0), 0)
    : 0;
  const invoiceOutstanding = selectedInvoice ? Math.max(0, selectedInvoice.finalAmount - invoicePaidSoFar) : 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (periodDropRef.current && !periodDropRef.current.contains(e.target as Node))
        setShowPeriodDrop(false);
      if (customerDropRef.current && !customerDropRef.current.contains(e.target as Node))
        setShowCustomerDrop(false);
      if (shareDropRef.current && !shareDropRef.current.contains(e.target as Node))
        setShowShareDrop(false);
      if (fromCalRef.current && !fromCalRef.current.contains(e.target as Node))
        setShowFromCal(false);
      if (toCalRef.current && !toCalRef.current.contains(e.target as Node))
        setShowToCal(false);
      if (false)
        setShowShareDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handlePeriodSelect = (val: string) => {
    setPeriod(val);
    if (val !== "custom") setDateRange(getPeriodDates(val));
    setShowPeriodDrop(false);
  };

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
              selectedCustomer,
              customerSearch,
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
      } catch (e) {
        showToast("Failed to save draft", "error");
      }
      return;
    }

    setSaving(true);
    try {
      // FinanceService.createPayment's actual contract: `amount` (not
      // paidAmount), `flow: 'IN'` (required — every submission errored on
      // this alone before), `method` (not paymentMode — the mode string is
      // resolved server-side via a fixed map), `invoiceId` so the payment
      // is actually linked to a Tax Invoice and its paid/outstanding gets
      // recomputed, and `linkedDocType: 'INVOICE'` (the only value the
      // LinkedDocType enum actually has for this — 'CUSTOMER_RECEIPT' and
      // 'CUSTOMER_PAYMENT' below are not valid enum values and would fail).
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
        entityType: "CUSTOMER",
        entity: selectedCustomer.name,
        invoiceId: selectedInvoice.id,
        linkedDocType: "INVOICE",
        linkedDocId: selectedInvoice.orderId,
        type: "INVOICE_LINKED",
        sourceModule: "MANUAL",
        reference: chequeNo || description || undefined,
        createdBy: "SYSTEM",
      });

      // If we saved a payment that was previously a draft, remove the draft
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
    setSelectedCustomer(null);
    setCustomerSearch("");
    setSelectedInvoiceId("");
    setAmount("");
    setPaymentMode("Cash");
    setDescription("");
    setChequeNo("");
    setReceiptDate(new Date().toISOString().split("T")[0]);
  };


  const handleDeleteDraft = async (id: string) => {
    try {
      await draftsApi.deleteDraft(id);
      showToast("Draft deleted", "success");
      fetchPayments();
    } catch (e) {
      showToast("Failed to delete draft", "error");
    }
  };

  const loadDraft = (draft: any) => {
    setDraftId(draft.id);
    const raw = draft._rawState || {};
    setSelectedCustomer(raw.selectedCustomer || null);
    setCustomerSearch(raw.customerSearch || "");
    setAmount(raw.amount || "");
    setPaymentMode(raw.paymentMode || "Cash");
    setDescription(raw.description || "");
    setChequeNo(raw.chequeNo || "");
    setReceiptDate(raw.receiptDate || new Date().toISOString().split("T")[0]);
    setView("create");
  };

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );


  const filtered = payments.filter(p => {
    if (statusFilter !== "ALL") {
      if (statusFilter === "DRAFT" && p.status !== "DRAFT") return false;
      if (statusFilter === "SUCCESS" && p.status === "DRAFT") return false; 
    }
    if (search) {
      const q = search.toLowerCase();
      const entityName = (p.entity?.name || "").toLowerCase();
      const num = (p.paymentNumber || "").toLowerCase();
      if (!entityName.includes(q) && !num.includes(q)) return false;
    }
    return true;
  });

  const totalAmount = filtered.reduce((s: number, p: any) => s + (p.paidAmount || 0), 0);
  const totalReceived = filtered.filter((p: any) => p.status === "PAID" || p.status === "SUCCESS")
    .reduce((s: number, p: any) => s + (p.paidAmount || 0), 0);

  const periodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label || "This Month";

  // ── CREATE VIEW ────────────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div className="flex flex-col bg-[#f1f5f9] overflow-hidden text-slate-800" style={{ height: 'calc(100vh - 104px)' }}>

        {/* Top bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800">Payment-In</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">Receipt No: <strong className="text-[#f58220] font-bold">Auto</strong></span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Party + Date row */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5 flex flex-wrap gap-4 items-start">

            {/* Party dropdown */}
            <div className="relative" ref={customerDropRef}>
              <div
                className={clsx(
                  "flex items-center gap-1 min-w-[220px] bg-white border rounded px-3 py-2 cursor-pointer",
                  showCustomerDrop ? "border-[#f58220]" : "border-slate-300"
                )}
                onClick={() => setShowCustomerDrop(v => !v)}
              >
                <div className="flex-1">
                  <div className="text-[10px] text-[#f58220] font-medium leading-none mb-0.5">Party *</div>
                  <input
                    className="w-full text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
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
                </div>
                <ChevronDown size={14} className="text-gray-400 shrink-0" />
              </div>

              {showCustomerDrop && (
                <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-y-auto">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#f58220] hover:bg-orange-50 border-b border-gray-100"
                    onClick={() => setShowCustomerDrop(false)}
                  >
                    <Plus size={14} /> Add Party
                  </button>
                  {filteredCustomers.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-400 text-center">No customers found</div>
                  ) : filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerDrop(false); setSelectedInvoiceId(""); setAmount(""); }}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-800">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.phone || "—"}</div>
                      </div>
                      {c.balance > 0 && (
                        <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded">
                          {c.balance} <Check size={10} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Receipt No (auto) */}
            <div className="flex flex-col">
              <div className="text-[10px] text-gray-500 mb-1">Receipt No</div>
              <div className="bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-400 min-w-[120px]">Auto</div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Date */}
            <div className="flex flex-col items-end">
              <div className="text-[10px] text-gray-500 mb-1">Receipt Date</div>
              <div className="flex items-center gap-1 border border-gray-300 rounded px-3 py-2 bg-white">
                <input
                  type="date"
                  value={receiptDate}
                  onChange={e => setReceiptDate(e.target.value)}
                  className="text-sm text-gray-700 outline-none bg-transparent"
                />
                <Calendar size={13} className="text-[#f58220] shrink-0" />
              </div>
            </div>
          </div>

          {/* Invoice selection — a customer payment must be recorded
              against a specific Tax Invoice so paid/outstanding can be
              recomputed for it. */}
          {selectedCustomer && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
              <div className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Tax Invoice</div>
              {customerInvoices.length === 0 ? (
                <p className="text-xs text-gray-400">No outstanding Tax Invoices found for {selectedCustomer.name}.</p>
              ) : (
                <>
                  <select
                    value={selectedInvoiceId}
                    onChange={e => { setSelectedInvoiceId(e.target.value); setAmount(""); }}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 outline-none bg-white focus:border-[#f58220]"
                  >
                    <option value="" disabled>Select invoice...</option>
                    {customerInvoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.order?.invoiceNum} — ₹{inv.finalAmount} ({inv.status})
                      </option>
                    ))}
                  </select>
                  {selectedInvoice && (
                    <div className="grid grid-cols-3 gap-3 pt-1 text-center">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Invoice Total</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">₹{selectedInvoice.finalAmount.toFixed(2)}</p>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded-lg">
                        <p className="text-[10px] text-emerald-600 uppercase font-semibold">Already Paid</p>
                        <p className="text-sm font-bold text-emerald-600 mt-0.5">₹{invoicePaidSoFar.toFixed(2)}</p>
                      </div>
                      <div className="p-2 bg-rose-50 rounded-lg">
                        <p className="text-[10px] text-rose-600 uppercase font-semibold">Outstanding</p>
                        <p className="text-sm font-bold text-rose-600 mt-0.5">₹{invoiceOutstanding.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Amount + Mode */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">Payment Details</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Amount */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount Received (₹) *</label>
                <div className="flex items-center border border-gray-300 rounded bg-white overflow-hidden focus-within:border-[#f58220]">
                  <span className="px-3 py-2 text-gray-400 text-sm border-r border-gray-200 bg-gray-50">₹</span>
                  <input
                    type="number"
                    min={0}
                    max={selectedInvoice ? invoiceOutstanding : undefined}
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none font-semibold"
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 outline-none bg-white focus:border-[#f58220]"
                >
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Cheque No (shown if Cheque mode) */}
              {paymentMode === "Cheque" && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Cheque No.</label>
                  <input
                    type="text"
                    placeholder="Enter cheque number"
                    value={chequeNo}
                    onChange={e => setChequeNo(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220]"
                  />
                </div>
              )}

              {/* Description */}
              <div className={paymentMode === "Cheque" ? "md:col-span-2" : ""}>
                <label className="text-xs text-gray-500 mb-1 block">Description / Narration</label>
                <input
                  type="text"
                  placeholder="Optional note..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220]"
                />
              </div>
            </div>
          </div>

          {/* Total display */}
          {amount && Number(amount) > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Amount to be Received</span>
              <span className="text-lg font-bold text-[#f58220]">₹{Number(amount).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-end gap-3 shrink-0 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
          <button onClick={() => { resetForm(); setView("list"); }} className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>

          {/* Share dropdown */}
          <div className="relative" ref={shareDropRef}>
            <div className="flex">
              <button
                onClick={() => showToast("Share feature coming soon", "info")}
                className="px-4 py-1.5 text-sm font-medium text-white bg-[#f58220] hover:bg-[#e8740e] rounded-l border-r border-[#e8740e]"
              >
                Share
              </button>
              <button onClick={() => setShowShareDrop(v => !v)} className="px-2 py-1.5 text-white bg-[#f58220] hover:bg-[#e8740e] rounded-r">
                <ChevronDown size={14} />
              </button>
            </div>
            {showShareDrop && (
              <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded shadow-lg text-sm min-w-[140px] z-50">
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                  <Printer size={13} /> Print
                </button>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700"
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
            className="px-4 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded disabled:opacity-60"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-6 py-1.5 text-sm font-semibold text-white bg-[#f58220] hover:bg-[#e8740e] rounded disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  const fmt = (d: string) => formatDate(d);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[#f58220]" />
          Payment-In
        </h1>
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Payment-In
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Total Amount Received", value: `₹${totalAmount.toLocaleString("en-IN")}`, color: "text-gray-700", dot: "bg-gray-400" },
            { label: "Confirmed Payments",    value: `₹${totalReceived.toLocaleString("en-IN")}`,  color: "text-emerald-600", dot: "bg-emerald-500" },
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
              placeholder="Search payment or customer..."
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
            {["ALL", "SUCCESS", "DRAFT"].map(s => (
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
          <button onClick={fetchPayments} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* ── Empty State ── */}
        {loading ? (
          <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <Wallet className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Payments Found</p>
              <p className="text-gray-500 text-sm mt-1">Record a payment to track your cashflow.</p>
            </div>
            <button
              onClick={() => setView("create")}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Add Payment-In
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Receipt No.</th>
                  <th className="text-left px-4 py-3">Party Name</th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((p: any) => {
                  const isDraft = p.status === "DRAFT";
                  return (
                    <tr 
                      key={p.id} 
                      className={clsx(
                        "transition-colors",
                        isDraft ? "hover:bg-orange-50/50 cursor-pointer bg-orange-50/30" : "hover:bg-gray-50"
                      )}
                      onClick={() => {
                        if (isDraft) loadDraft(p);
                      }}
                    >
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">
                        {p.paymentNumber ? formatERPNumber("RCPT", p.paymentNumber, p.createdAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium text-gray-800">
                          {p.entity?.name || p.entityId || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {p.paymentMode || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        ₹ {(p.paidAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isDraft ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-yellow-50 text-yellow-700 border-yellow-200 uppercase">
                            Draft
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 uppercase">
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isDraft ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDraft(p.id); }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete Draft"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                title="Print"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
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
