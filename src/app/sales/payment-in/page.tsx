"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wallet, Plus, RefreshCw, ChevronDown, X, Search,
  Share2, Trash2, ArrowLeft, ArrowRight,
  Calendar, Check, Printer, Pencil
} from "lucide-react";
import { clsx } from "clsx";
import { useSearchParams } from "next/navigation";
import { customersApi, dealersApi, franchiseApi, draftsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatERPNumber, formatDate } from "@/lib/utils";
import api from "@/lib/api/base";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_MODES = ["Cash", "Cheque", "Online Transfer", "UPI", "Card", "Bank Transfer"];

const PARTY_TYPES: { value: "CUSTOMER" | "DEALER" | "FRANCHISE"; label: string }[] = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "DEALER", label: "Dealer" },
  { value: "FRANCHISE", label: "Franchise" },
];

// Normalizes Customer / Dealer / Franchise master rows (different shapes)
// into the one shape the party dropdown needs — same pattern as
// EstimationsPageClient's normalizeParty.
function normalizeParty(partyType: "CUSTOMER" | "DEALER" | "FRANCHISE", raw: any) {
  if (partyType === "FRANCHISE") {
    return { id: raw.id, name: raw.name, phone: raw.contactNum || "", raw };
  }
  if (partyType === "DEALER") {
    return { id: raw.id, name: raw.name, phone: raw.phone || "", raw };
  }
  return { id: raw.id, name: raw.name, phone: raw.phone || "", raw };
}

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
      <div className="absolute inset-0 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
        <div className="w-20 h-16 rounded-lg bg-white dark:bg-card border-2 border-orange-100 dark:border-white/10 flex flex-col gap-1.5 items-start justify-center px-3 shadow-sm">
          <div className="w-10 h-1.5 rounded bg-orange-200 dark:bg-orange-500/30" />
          <div className="w-6 h-1.5 rounded bg-orange-100 dark:bg-orange-500/20" />
          <div className="w-8 h-1.5 rounded bg-orange-100 dark:bg-orange-500/20" />
        </div>
        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-500/20 border-2 border-orange-200 dark:border-orange-500/30 flex items-center justify-center">
          <Wallet size={12} className="text-[#f58220] dark:text-orange-400" />
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
    <div className="bg-white dark:bg-[#13151f] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 p-3 w-64 select-none">
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
              !isSelected(d) && !isToday(d) && "text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5"
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
  const [partyType, setPartyType] = useState<"CUSTOMER" | "DEALER" | "FRANCHISE">("CUSTOMER");
  const [dealers, setDealers] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDrop, setShowCustomerDrop] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  // One receipt can be allocated across several invoices for the same
  // party — replaces the old single `selectedInvoiceId`. A single selected
  // invoice is just a one-entry array; FinanceService.createPayment treats
  // that identically to the legacy single-invoice payload.
  const [allocations, setAllocations] = useState<{ invoiceId: string; amount: string }[]>([]);
  const [addInvoiceSel, setAddInvoiceSel] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [description, setDescription] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [showShareDrop, setShowShareDrop] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

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

  // Dealers and Franchises are also valid Tax Invoice parties (see
  // Order.partyType) — the invoice/payment flow must not assume Customer.
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

  // Tax Invoices with an outstanding balance — a payment must be recorded
  // against a specific invoice (see FinanceService.createPayment's
  // invoiceId-driven paid/outstanding recompute); without this the page had
  // no invoice concept at all.
  const fetchInvoices = useCallback(async () => {
    try {
      const res = await api.get("/api/finance/invoices");
      setInvoices((res as any).data || []);
    } catch {}
  }, []);

  // Cash/Bank/UPI accounts a payment can actually be posted to — the same
  // list AccountService.validateAccountForPayment checks against server-side.
  // Without collecting this, the backend has no account to post to for any
  // mode other than a franchise's sole CASH account, and rejects the save.
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get("/api/accounts");
      const list = Array.isArray((res as any).data) ? (res as any).data : ((res as any).data?.data || []);
      setAccounts(list.filter((a: any) => a.status === "ACTIVE"));
    } catch {}
  }, []);

  useEffect(() => {
    fetchPayments(); fetchCustomers(); fetchDealers(); fetchFranchises(); fetchInvoices(); fetchAccounts();
  }, [fetchPayments, fetchCustomers, fetchDealers, fetchFranchises, fetchInvoices, fetchAccounts]);

  // Mirrors AccountService.validateAccountForPayment's mode→account-type
  // eligibility exactly, so the dropdown never offers an account the
  // backend would reject.
  const eligibleAccountTypes = (mode: string): string[] => {
    if (mode === "Cash") return ["CASH"];
    if (mode === "UPI" || mode === "Card") return ["UPI", "BANK"];
    // Cheque, Online Transfer, Bank Transfer all resolve to BANK_TRANSFER/CHEQUE
    // server-side, both of which require a BANK-type account.
    return ["BANK"];
  };
  const eligibleAccounts = accounts.filter((a: any) => eligibleAccountTypes(paymentMode).includes(a.type));

  // Auto-pick the obvious choice (one eligible account) and clear the
  // selection when it's no longer valid for the newly-chosen mode, instead
  // of silently carrying over an account of the wrong type.
  useEffect(() => {
    if (eligibleAccounts.length === 1) {
      setSelectedAccountId(eligibleAccounts[0].id);
    } else if (!eligibleAccounts.some((a: any) => a.id === selectedAccountId)) {
      setSelectedAccountId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMode, accounts]);

  const partySourceList = partyType === "DEALER" ? dealers : partyType === "FRANCHISE" ? franchises : customers;

  // A Tax Invoice's party is identified by partyId+partyType (Order's
  // generic fields), not customerId — customerId is only ever populated
  // for partyType CUSTOMER.
  const customerInvoices = selectedCustomer
    ? invoices.filter((inv: any) => {
        const order = inv.order || {};
        const invPartyType = order.partyType || "CUSTOMER";
        const invPartyId = invPartyType === "CUSTOMER" ? (order.partyId || order.customerId) : order.partyId;
        return invPartyType === partyType && invPartyId === selectedCustomer.id && inv.status !== "PAID" && inv.status !== "CANCELLED";
      })
    : [];

  // Deep-link from the Tax Invoice view's "Record Payment" button
  // (?invoiceId=&partyType=&partyId=). Runs once invoices/parties are
  // loaded so the matching invoice/party rows actually exist to select.
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
    setView("create");
    // Deferred one tick below once `customerInvoices` for this party has
    // actually been computed, so the outstanding default is correct.
    setPendingDeepLinkInvoiceId(linkedInvoiceId);
  }, [searchParamsHook, invoices, customers, dealers, franchises]);

  // Per-invoice paid-so-far / outstanding — same calc as before, now run
  // once per row instead of once for a single selected invoice.
  const invoiceOutstandingOf = (inv: any) => {
    const paidSoFar = (inv?.payments || []).filter((p: any) => p.status === "PAID" && !p.isCancelled).reduce((s: number, p: any) => s + (p.paidAmount || 0), 0);
    return { paidSoFar, outstanding: Math.max(0, (inv?.finalAmount || 0) - paidSoFar) };
  };

  const selectedInvoiceIds = allocations.map(a => a.invoiceId);
  // Rows for the allocation table — dropped (not shown) if the invoice is no
  // longer in `customerInvoices` (e.g. party/invoices changed underneath).
  const allocationRows = allocations
    .map(a => {
      const invoice = customerInvoices.find((inv: any) => inv.id === a.invoiceId);
      if (!invoice) return null;
      const { paidSoFar, outstanding } = invoiceOutstandingOf(invoice);
      return { invoiceId: a.invoiceId, amountStr: a.amount, invoice, paidSoFar, outstanding };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  const totalOutstanding = allocationRows.reduce((s, r) => s + r.outstanding, 0);
  const totalAllocation = allocationRows.reduce((s, r) => s + (Number(r.amountStr) || 0), 0);

  // Deep-link needs the invoice's own outstanding as the default allocation
  // — resolved here once its row is actually available in customerInvoices.
  const [pendingDeepLinkInvoiceId, setPendingDeepLinkInvoiceId] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingDeepLinkInvoiceId) return;
    const inv = customerInvoices.find((i: any) => i.id === pendingDeepLinkInvoiceId);
    if (!inv) return;
    const { outstanding } = invoiceOutstandingOf(inv);
    setAllocations([{ invoiceId: inv.id, amount: outstanding > 0 ? outstanding.toFixed(2) : "" }]);
    setPendingDeepLinkInvoiceId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDeepLinkInvoiceId, customerInvoices]);

  // Amount Received auto-tracks the allocation total by default — the
  // common case needs zero typing in that field. The user can still type a
  // different figure afterward; handleSave then requires the two to match
  // (mirrors "Total allocation must equal payment amount").
  useEffect(() => {
    if (allocationRows.length > 0) {
      setAmount(totalAllocation > 0 ? totalAllocation.toFixed(2) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAllocation]);

  const addInvoiceToAllocations = (invoiceId: string) => {
    if (!invoiceId || selectedInvoiceIds.includes(invoiceId)) return;
    const inv = customerInvoices.find((i: any) => i.id === invoiceId);
    const { outstanding } = invoiceOutstandingOf(inv);
    setAllocations(prev => [...prev, { invoiceId, amount: outstanding > 0 ? outstanding.toFixed(2) : "" }]);
    setAddInvoiceSel("");
  };
  const removeInvoiceFromAllocations = (invoiceId: string) => {
    setAllocations(prev => prev.filter(a => a.invoiceId !== invoiceId));
  };
  const updateAllocationAmount = (invoiceId: string, value: string) => {
    setAllocations(prev => prev.map(a => a.invoiceId === invoiceId ? { ...a, amount: value } : a));
  };

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
      if (allocationRows.length === 0) { showToast("Select at least one Tax Invoice this payment is against", "error"); return; }
      for (const row of allocationRows) {
        const rowAmt = Number(row.amountStr) || 0;
        if (rowAmt <= 0) {
          showToast(`Enter an allocation amount for ${row.invoice.order?.invoiceNum || "the selected invoice"}`, "error");
          return;
        }
        if (rowAmt > row.outstanding + 0.01) {
          showToast(`Allocation for ${row.invoice.order?.invoiceNum || "an invoice"} (₹${rowAmt.toFixed(2)}) exceeds its outstanding balance (₹${row.outstanding.toFixed(2)})`, "error");
          return;
        }
      }
      if (Math.abs(totalAllocation - Number(amount)) > 0.01) {
        showToast(`Total allocation (₹${totalAllocation.toFixed(2)}) must equal the payment amount (₹${Number(amount).toFixed(2)})`, "error");
        return;
      }
      if (!selectedAccountId) {
        showToast(
          eligibleAccounts.length === 0
            ? `No active ${paymentMode === "Cash" ? "Cash" : paymentMode === "UPI" || paymentMode === "Card" ? "UPI/Bank" : "Bank"} account is configured. Please add one under Banking before receiving this payment.`
            : "Select the account this payment should be received into",
          "error"
        );
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
              allocations,
              amount,
              paymentMode,
              description,
              chequeNo,
              receiptDate,
              selectedAccountId
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
      // resolved server-side via a fixed map), `linkedDocType: 'INVOICE'`
      // (the only value the LinkedDocType enum actually has for this —
      // 'CUSTOMER_RECEIPT' and 'CUSTOMER_PAYMENT' below are not valid enum
      // values and would fail), and `sourceAccount` — AccountService.
      // validateAccountForPayment rejects every mode except a franchise's
      // sole CASH account without one.
      //
      // `allocations` [{invoiceId, amount}] is how the receipt is split
      // across one or more Tax Invoices — FinanceService.createPayment
      // treats a single-entry list exactly like the legacy one-invoice
      // `invoiceId` field (see its `singleInvoiceId` normalization), so a
      // one-invoice payment here behaves identically to before; only a
      // 2+-entry list takes the new PaymentAllocation path server-side.
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
        sourceAccount: selectedAccountId || undefined,
        entityId: selectedCustomer.id,
        entityType: partyType,
        entity: selectedCustomer.name,
        allocations: allocationRows.map(row => ({ invoiceId: row.invoiceId, amount: Number(row.amountStr) })),
        linkedDocType: "INVOICE",
        // Only meaningful (and only sent) for a true single-invoice
        // receipt — a multi-invoice one has no single underlying document.
        linkedDocId: allocationRows.length === 1 ? allocationRows[0].invoice.orderId : undefined,
        type: "INVOICE_LINKED",
        sourceModule: "MANUAL",
        reference: chequeNo || description || undefined,
        note: description || undefined,
        createdBy: "SYSTEM",
        // The receipt date the user actually picked — previously never sent,
        // so every payment silently recorded at submit-time instead.
        createdAt: receiptDate ? new Date(receiptDate).toISOString() : undefined,
        // AccountService.validateAccountForPayment's CHEQUE branch requires
        // both, in addition to sourceAccount above.
        ...(paymentMode === "Cheque" ? { chequeNumber: chequeNo, chequeDate: receiptDate } : {}),
        // One key per logical "Record Payment" submission — a retry/
        // double-click that races past the `disabled={saving}` guard hits
        // FinanceService.createPayment's idempotency check and returns the
        // already-created Payment instead of posting a second one.
        idempotencyKey,
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
      // FinanceController.recordPayment's validation-error branch responds
      // with `{ message }`, not `{ error }` — reading only `.error` here
      // silently discarded the real reason (missing account, overpayment,
      // etc.) and showed this generic fallback for every failure.
      showToast(e?.response?.data?.message || e?.response?.data?.error || "Failed to record payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setDraftId(null);
    setPartyType("CUSTOMER");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setAllocations([]);
    setAddInvoiceSel("");
    setAmount("");
    setPaymentMode("Cash");
    setDescription("");
    setChequeNo("");
    setReceiptDate(new Date().toISOString().split("T")[0]);
    setSelectedAccountId("");
    setIdempotencyKey(crypto.randomUUID());
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

  const loadDraft = (p: any) => {
    setDraftId(p.id);
    const raw = p._rawState || {};
    const pt: "CUSTOMER" | "DEALER" | "FRANCHISE" = raw.partyType || p.partyType || "CUSTOMER";
    setPartyType(pt);

    const list = pt === "DEALER" ? dealers : pt === "FRANCHISE" ? franchises : customers;
    const rawParty = raw.selectedCustomer || p.entity || list.find((x: any) => x.id === (p.partyId || p.customerId)) || null;
    const party = rawParty ? normalizeParty(pt, rawParty) : null;

    setSelectedCustomer(party);
    setCustomerSearch(raw.customerSearch || (party ? party.name : "") || p.customerName || "");
    setReceiptDate(raw.receiptDate || (p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]));
    // Backward-compatible with drafts saved before multi-invoice support
    // (they only have the old single `selectedInvoiceId`).
    const legacyInvoiceId = raw.selectedInvoiceId || p.invoiceId;
    setAllocations(
      Array.isArray(raw.allocations) && raw.allocations.length > 0
        ? raw.allocations
        : legacyInvoiceId
        ? [{ invoiceId: legacyInvoiceId, amount: raw.amount || (p.paidAmount ? String(p.paidAmount) : "") }]
        : []
    );
    setAmount(raw.amount || (p.paidAmount ? String(p.paidAmount) : ""));
    setPaymentMode(raw.paymentMode || p.paymentMode || "Cash");
    setDescription(raw.description || p.remarks || p.notes || "");
    setChequeNo(raw.chequeNo || p.referenceNo || p.chequeNo || "");
    setSelectedAccountId(raw.selectedAccountId || p.accountId || "");
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
      if (statusFilter === "SUCCESS" && p.status === "DRAFT") return false; 
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
  const totalReceived = filtered.filter((p: any) => p.status === "PAID" || p.status === "SUCCESS")
    .reduce((s: number, p: any) => s + (p.paidAmount || 0), 0);

  const periodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label || "This Month";

  // ── CREATE VIEW ────────────────────────────────────────────────────────────
  if (view === "create") {
    return (
      <div className="flex flex-col bg-[#f1f5f9] dark:bg-background overflow-hidden text-slate-800 dark:text-slate-100" style={{ height: 'calc(100vh - 104px)' }}>

        {/* Top bar */}
        <div className="bg-white dark:bg-card border-b border-slate-200 dark:border-white/5 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Payment-In</h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Receipt No: <strong className="text-[#f58220] font-bold">Auto</strong></span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* Party type toggle */}
          <div className="flex items-center gap-2">
            {PARTY_TYPES.map(pt => (
              <button
                key={pt.value}
                onClick={() => {
                  if (pt.value === partyType) return;
                  setPartyType(pt.value);
                  setSelectedCustomer(null);
                  setCustomerSearch("");
                  setAllocations([]);
                  setAddInvoiceSel("");
                  setAmount("");
                }}
                className={clsx(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors",
                  partyType === pt.value
                    ? "bg-[#f58220] text-white border-[#f58220]"
                    : "bg-white dark:bg-card text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {/* Party + Date row */}
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm px-6 py-5 flex flex-wrap gap-4 items-start">

            {/* Party dropdown */}
            <div className="relative" ref={customerDropRef}>
              <div
                className={clsx(
                  "flex items-center gap-1 min-w-[220px] bg-white dark:bg-[#13151f] border rounded px-3 py-2 cursor-pointer",
                  showCustomerDrop ? "border-[#f58220]" : "border-slate-300 dark:border-white/10"
                )}
                onClick={() => setShowCustomerDrop(v => !v)}
              >
                <div className="flex-1">
                  <div className="text-[10px] text-[#f58220] font-medium leading-none mb-0.5">Party *</div>
                  <input
                    className="w-full text-sm text-gray-700 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder-slate-500"
                    placeholder={`Search ${partyType === "CUSTOMER" ? "customers" : partyType === "DEALER" ? "dealers" : "franchises"} by Name/Phone`}
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); }}
                    onClick={e => { e.stopPropagation(); setShowCustomerDrop(true); }}
                  />
                </div>
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
                <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded shadow-lg max-h-56 overflow-y-auto custom-scrollbar">
                  {filteredParties.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-400 dark:text-slate-500 text-center">
                      No {partyType === "CUSTOMER" ? "customers" : partyType === "DEALER" ? "dealers" : "franchises"} found
                    </div>
                  ) : filteredParties.map((c: any) => (
                    <button
                      key={c.id}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-50 dark:border-white/5 last:border-0"
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerDrop(false); setAllocations([]); setAddInvoiceSel(""); setAmount(""); }}
                    >
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-800 dark:text-white">{c.name}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-500">{c.phone || "—"}</div>
                      </div>
                      {c.balance > 0 && (
                        <div className="flex items-center gap-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-0.5 rounded">
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
              <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-1">Receipt No</div>
              <div className="bg-white dark:bg-[#13151f] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-gray-400 dark:text-slate-500 min-w-[120px]">Auto</div>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Date */}
            <div className="flex flex-col items-end">
              <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-1">Receipt Date</div>
              <div className="flex items-center gap-1 border border-gray-300 dark:border-white/10 rounded px-3 py-2 bg-white dark:bg-[#13151f]">
                <input
                  type="date"
                  value={receiptDate}
                  onChange={e => setReceiptDate(e.target.value)}
                  className="text-sm text-gray-700 dark:text-white outline-none bg-transparent"
                />
                <Calendar size={13} className="text-[#f58220] shrink-0" />
              </div>
            </div>
          </div>

          {/* Invoice selection — multi-select + per-invoice allocation.
              A receipt can be split across several Tax Invoices for this
              party; each gets its own "Pay Now" amount, defaulting to its
              outstanding balance. */}
          {selectedCustomer && (
            <div className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm p-6 space-y-3">
              <div className="text-sm font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2">Tax Invoices</div>
              {customerInvoices.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-slate-500">No outstanding Tax Invoices found for {selectedCustomer.name}.</p>
              ) : (
                <>
                  <select
                    value={addInvoiceSel}
                    onChange={e => addInvoiceToAllocations(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-gray-700 dark:text-white outline-none bg-white dark:bg-[#13151f] focus:border-[#f58220]"
                  >
                    <option value="" disabled>+ Add invoice...</option>
                    {customerInvoices
                      .filter((inv: any) => !selectedInvoiceIds.includes(inv.id))
                      .map((inv: any) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.order?.invoiceNum} — ₹{inv.finalAmount} ({inv.status})
                        </option>
                      ))}
                  </select>

                  {allocationRows.length > 0 && (
                    <div className="overflow-x-auto custom-scrollbar rounded-lg border border-gray-100 dark:border-white/5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-white/[0.02] text-[10px] uppercase font-semibold text-gray-400 dark:text-slate-500">
                            <th className="text-left px-3 py-2">Invoice</th>
                            <th className="text-left px-3 py-2">Date</th>
                            <th className="text-right px-3 py-2">Total</th>
                            <th className="text-right px-3 py-2">Paid</th>
                            <th className="text-right px-3 py-2">Outstanding</th>
                            <th className="text-right px-3 py-2 w-32">Pay Now</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                          {allocationRows.map(row => (
                            <tr key={row.invoiceId}>
                              <td className="px-3 py-2 font-medium text-gray-800 dark:text-white">{row.invoice.order?.invoiceNum || "—"}</td>
                              <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{row.invoice.createdAt ? formatDate(row.invoice.createdAt) : "—"}</td>
                              <td className="px-3 py-2 text-right text-gray-700 dark:text-slate-200">₹{row.invoice.finalAmount.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">₹{row.paidSoFar.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right text-rose-600 dark:text-rose-400 font-semibold">₹{row.outstanding.toFixed(2)}</td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={row.outstanding}
                                  value={row.amountStr}
                                  onChange={e => updateAllocationAmount(row.invoiceId, e.target.value)}
                                  className="w-full border border-gray-300 dark:border-white/10 rounded px-2 py-1.5 text-right text-sm text-gray-800 dark:text-white outline-none bg-white dark:bg-[#13151f] focus:border-[#f58220]"
                                />
                              </td>
                              <td className="px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeInvoiceFromAllocations(row.invoiceId)}
                                  className="text-gray-400 hover:text-rose-500 transition-colors"
                                  title="Remove"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 dark:bg-white/[0.02] font-semibold">
                            <td className="px-3 py-2 text-gray-600 dark:text-slate-300" colSpan={4}>Total</td>
                            <td className="px-3 py-2 text-right text-rose-600 dark:text-rose-400">₹{totalOutstanding.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-[#f58220]">₹{totalAllocation.toFixed(2)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Amount + Mode */}
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm p-6 space-y-4">
            <div className="text-sm font-semibold text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-white/5 pb-2">Payment Details</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Amount */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Amount Received (₹) *</label>
                <div className="flex items-center border border-gray-300 dark:border-white/10 rounded bg-white dark:bg-[#13151f] overflow-hidden focus-within:border-[#f58220]">
                  <span className="px-3 py-2 text-gray-400 dark:text-slate-500 text-sm border-r border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">₹</span>
                  <input
                    type="number"
                    min={0}
                    max={allocationRows.length > 0 ? totalOutstanding : undefined}
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm text-gray-800 dark:text-white outline-none font-semibold bg-transparent"
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  className="w-full border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-gray-700 dark:text-white outline-none bg-white dark:bg-[#13151f] focus:border-[#f58220]"
                >
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Account — which Cash/Bank/UPI account this payment lands in.
                  Required by AccountService.validateAccountForPayment for
                  every mode except a franchise's sole CASH account. */}
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">
                  {paymentMode === "Cash" ? "Cash Account" : paymentMode === "UPI" || paymentMode === "Card" ? "UPI / Bank Account" : "Bank Account"} *
                </label>
                {eligibleAccounts.length === 0 ? (
                  <div className="w-full border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 rounded px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                    No active account configured for this mode.
                  </div>
                ) : (
                  <select
                    value={selectedAccountId}
                    onChange={e => setSelectedAccountId(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-gray-700 dark:text-white outline-none bg-white dark:bg-[#13151f] focus:border-[#f58220]"
                  >
                    <option value="" disabled>Select account...</option>
                    {eligibleAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type}) — ₹{(a.balance ?? 0).toLocaleString("en-IN")}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Cheque No (shown if Cheque mode) */}
              {paymentMode === "Cheque" && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Cheque No.</label>
                  <input
                    type="text"
                    placeholder="Enter cheque number"
                    value={chequeNo}
                    onChange={e => setChequeNo(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                  />
                </div>
              )}

              {/* Description */}
              <div className={paymentMode === "Cheque" ? "md:col-span-2" : ""}>
                <label className="text-xs text-gray-500 dark:text-slate-400 mb-1 block">Description / Narration</label>
                <input
                  type="text"
                  placeholder="Optional note..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                />
              </div>
            </div>
          </div>

          {/* Total display */}
          {amount && Number(amount) > 0 && (
            <div className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Amount to be Received</span>
              <span className="text-lg font-bold text-[#f58220]">₹{Number(amount).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="bg-white dark:bg-card border-t border-slate-200 dark:border-white/5 px-6 py-3 flex items-center justify-end gap-3 shrink-0 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
          <button onClick={() => { resetForm(); setView("list"); }} className="px-4 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
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
              <div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded shadow-lg text-sm min-w-[140px] z-50">
                <button className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 flex items-center gap-2">
                  <Printer size={13} /> Print
                </button>
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200"
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
            className="px-4 py-1.5 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-800 dark:hover:text-white bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded disabled:opacity-60"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-6 py-1.5 text-sm font-semibold text-white bg-[#f58220] hover:bg-[#e8740e] rounded disabled:opacity-60 shadow-sm"
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
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100">

      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-end">
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
            { label: "Total Amount Received", value: `₹${totalAmount.toLocaleString("en-IN")}`, color: "text-gray-700 dark:text-slate-200", dot: "bg-gray-400" },
            { label: "Confirmed Payments",    value: `₹${totalReceived.toLocaleString("en-IN")}`,  color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full", s.dot)} />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
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
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-card">
            {["ALL", "SUCCESS", "DRAFT"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-2 text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-[#f58220] text-white" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {s === "ALL" ? "All" : s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-card text-sm text-gray-700 dark:text-slate-200 relative">
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900 dark:hover:text-white" onClick={() => setShowFromCal(v => !v)}>
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{fmt(dateFrom)}</span>
            </div>
            {showFromCal && (
              <div className="absolute top-full left-0 mt-1 z-50" ref={fromCalRef}>
                <MiniCalendar value={dateFrom} onChange={setDateFrom} onClose={() => setShowFromCal(false)} />
              </div>
            )}
            <span className="text-gray-300 dark:text-slate-600 px-1">to</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900 dark:hover:text-white" onClick={() => setShowToCal(v => !v)}>
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
          <button onClick={fetchPayments} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* ── Empty State ── */}
        {loading ? (
          <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center">
              <Wallet className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 dark:text-white font-semibold">No Payments Found</p>
              <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Record a payment to track your cashflow.</p>
            </div>
            <button
              onClick={() => setView("create")}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors shadow-sm"
            >
              Add Payment-In
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
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
                        isDraft ? "hover:bg-orange-50/50 dark:hover:bg-orange-500/10 cursor-pointer bg-orange-50/30 dark:bg-orange-500/5" : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      )}
                      onClick={() => {
                        if (isDraft) loadDraft(p);
                      }}
                    >
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 dark:text-slate-200 text-xs">
                        {p.paymentNumber ? formatERPNumber("RCPT", p.paymentNumber, p.createdAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium text-gray-800 dark:text-white">
                            {(typeof p.entity === "string" ? p.entity : p.entity?.name) || p.entityId || "—"}
                          </span>
                          {!isDraft && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-white/10">
                              {p.entityType || "UNKNOWN"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">
                        {p.paymentMode || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-white">
                        ₹ {(p.paidAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isDraft ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20 uppercase">
                            Draft
                          </span>
                        ) : p.isCancelled ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 uppercase">
                            Cancelled
                          </span>
                        ) : p.status === "PAID" ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 uppercase">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 uppercase">
                            {p.status || "Pending"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); loadDraft(p); }}
                            className="p-1 text-gray-400 hover:text-[#f58220] hover:bg-orange-50 dark:hover:bg-white/5 rounded transition-colors"
                            title="Edit Payment"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {isDraft ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDraft(p.id); }}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                              title="Delete Draft"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
                                title="Print"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
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
