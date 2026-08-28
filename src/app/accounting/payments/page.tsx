"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  RefreshCw,
  Landmark,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  RotateCcw,
  FileText,
} from "lucide-react";
import { clsx } from "clsx";
import { accountingApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

type FlowType = "ALL" | "IN" | "OUT";
type PaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "CARD" | "NEFT";
type PaymentStatus = "PAID" | "PENDING" | "FAILED";

interface Payment {
  id: string;
  paymentNumber?: string;
  date: string;
  entity: string;
  flow: "IN" | "OUT";
  method: string;
  amount: number;
  status: PaymentStatus;
  reference: string;
  type: string;
  sourceModule?: string;
  linkedDocType?: string;
  linkedDocId?: string;
  isCancelled?: boolean;
  accountName?: string;
}

const METHOD_OPTIONS: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { key: "CASH",          label: "Cash",          icon: <Banknote size={15} /> },
  { key: "UPI",           label: "UPI",           icon: <Smartphone size={15} /> },
  { key: "BANK_TRANSFER", label: "Bank Transfer", icon: <Building2 size={15} /> },
  { key: "CHEQUE",        label: "Cheque",        icon: <FileText size={15} /> },
  { key: "CARD",          label: "Card",          icon: <CreditCard size={15} /> },
  { key: "NEFT",          label: "NEFT",          icon: <ArrowUpRight size={15} /> },
];

const MODULE_COLORS: Record<string, string> = {
  POS: "bg-blue-50 text-blue-600 border-blue-100",
  PROCUREMENT: "bg-purple-50 text-purple-600 border-purple-100",
  PAYROLL: "bg-pink-50 text-pink-600 border-pink-100",
  FRANCHISE: "bg-amber-50 text-amber-600 border-amber-100",
  EXPENSE: "bg-orange-50 text-orange-600 border-orange-100",
  MANUAL: "bg-slate-50 text-slate-600 border-slate-100",
  TRANSFER: "bg-indigo-50 text-indigo-600 border-indigo-100",
};

// Words that indicate an outflow/expense — should NEVER be recorded as Inflow
const EXPENSE_KEYWORDS = [
  "expense", "rent", "salary", "wages", "bill", "utility", "electricity",
  "water", "gas", "fuel", "maintenance", "repair", "purchase", "vendor",
  "supplier", "payable", "outflow", "cost", "fee", "charge", "toll",
];

const EMPTY_FORM = {
  entity: "",
  flow: "IN" as "IN" | "OUT",
  amount: "",
  method: "CASH" as PaymentMethod,
  sourceAccount: "CASH_ACCOUNT" as "CASH_ACCOUNT" | "BANK_ACCOUNT" | "UPI_WALLET",
  linkedToType: "DIRECT" as "INVOICE" | "PO" | "DIRECT",
  linkedToId: "",
  date: new Date().toISOString().split("T")[0],
  reference: "",
  note: "",
  status: "PAID" as PaymentStatus,
};

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<FlowType>("ALL");
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [moduleFilter, setModuleFilter] = useState<string>("ALL");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");

  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [transferForm, setTransferForm] = useState({ fromAccountId: "", toAccountId: "", amount: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cashFlow, setCashFlow] = useState<any>(null);

  // Pagination & Detail state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const fetchFinancials = useCallback(async () => {
    try {
      const [paymentsRes, accountsRes, cashFlowRes] = await Promise.all([
        accountingApi.getPayments(),
        accountingApi.getAccounts(),
        accountingApi.getCashFlow()
      ]);
      setPayments(paymentsRes.data?.payments ?? paymentsRes.data ?? []);
      setAccounts(accountsRes.data || []);
      setCashFlow(cashFlowRes.data || null);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFinancials(); }, [fetchFinancials]);

  const filtered = payments.filter((p) => {
    if (activeTab !== "ALL" && p.flow !== activeTab) return false;
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (moduleFilter !== "ALL" && p.sourceModule !== moduleFilter) return false;
    if (methodFilter !== "ALL" && p.method !== methodFilter) return false;
    if (search && !p.entity?.toLowerCase().includes(search.toLowerCase()) && !p.paymentNumber?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [activeTab, search, statusFilter, moduleFilter, methodFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalIn  = payments.filter(p => p.flow === "IN"  && p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const totalOut = payments.filter(p => p.flow === "OUT" && p.status === "PAID").reduce((s, p) => s + p.amount, 0);

  const openModal = () => {
    setForm(EMPTY_FORM);
    setSubmitError(null);
    setSubmitSuccess(false);
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
  };

  const handleSubmit = async () => {
    if (!form.entity.trim()) { setSubmitError("Customer/Vendor Entity is required."); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setSubmitError("Enter a valid amount."); return; }
    if (!form.date) { setSubmitError("Payment Date is strictly required."); return; }
    if (form.linkedToType !== "DIRECT" && !form.linkedToId.trim()) { setSubmitError(`Please provide the ${form.linkedToType} reference ID.`); return; }

    // 🚨 Guard: Block expense-type entities from being logged as Inflow
    if (form.flow === "IN") {
      const entityLower = form.entity.trim().toLowerCase();
      const matchedKeyword = EXPENSE_KEYWORDS.find(kw => entityLower.includes(kw));
      if (matchedKeyword) {
        setSubmitError(
          `"${form.entity}" looks like an expense/outflow. ` +
          `Inflow is only for money received from customers. ` +
          `Please switch direction to "Vendor / Expense (OUT)" or use the Expenses module.`
        );
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await accountingApi.recordPayment({
        entity: form.entity.trim(),
        flow: form.flow,
        amount: parseFloat(form.amount),
        method: form.method,
        sourceAccount: form.sourceAccount,
        linkedToType: form.linkedToType,
        linkedToId: form.linkedToType !== "DIRECT" ? form.linkedToId.trim() : undefined,
        date: form.date,
        reference: form.reference.trim() || undefined,
        note: form.note.trim() || undefined,
        status: form.status,
      });
      setSubmitSuccess(true);
      await fetchFinancials();
      setTimeout(() => {
        setShowModal(false);
        setSubmitSuccess(false);
      }, 1400);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || err?.response?.data?.message || err.message || "Failed to record payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) {
      setSubmitError("Please fill all required transfer fields.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await accountingApi.transferFunds({
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: parseFloat(transferForm.amount),
        note: transferForm.note
      });
      setSubmitSuccess(true);
      await fetchFinancials();
      setTimeout(() => {
        setShowTransferModal(false);
        setSubmitSuccess(false);
      }, 1500);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPayment = async (id: string) => {
    if (!confirm("Are you sure you want to cancel and reverse this payment? This will update account balances.")) return;
    try {
      await accountingApi.cancelPayment(id);
      await fetchFinancials();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Cancellation failed.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-4 animate-in fade-in duration-700 text-slate-800 dark:text-slate-100">
      {/* Refined Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-gray-100 dark:border-white/5 pb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-orange-500 rounded-full" />
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Payments</h1>
          </div>
          <p className="text-sm font-medium text-slate-400 dark:text-slate-400 max-w-md leading-relaxed">
            Unified money control centre tracing all income and accounts payable.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={fetchFinancials}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all active:scale-90"
          >
            <RefreshCw size={18} className={clsx(loading && "animate-spin")} />
          </button>
          <button
            onClick={() => { setTransferForm({ fromAccountId: "", toAccountId: "", amount: "", note: "" }); setShowTransferModal(true); }}
            className="flex items-center gap-3 bg-white dark:bg-card border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 shadow-sm"
          >
            <RefreshCw size={16} /> Internal Transfer
          </button>
          <button
            onClick={openModal}
            className="flex items-center gap-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 pl-6 pr-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:bg-black dark:hover:bg-slate-200 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-slate-900/10"
          >
            <Plus size={16} strokeWidth={3} /> Record Payment
          </button>
        </div>
      </div>

      {/* Elegant Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8 px-2">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Total Inflow</p>
          <p className="text-xl font-black tabular-nums text-emerald-500 dark:text-emerald-400">₹{totalIn.toLocaleString()}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Total Outflow</p>
          <p className="text-xl font-black tabular-nums text-orange-500 dark:text-orange-400">₹{totalOut.toLocaleString()}</p>
        </div>
        <div className="space-y-1 border-l border-slate-100 dark:border-white/5 pl-8">
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Cash Balance</p>
          <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">₹{cashFlow?.breakdown?.cash.toLocaleString() || "0"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Bank Balance</p>
          <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">₹{cashFlow?.breakdown?.bank.toLocaleString() || "0"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">UPI Wallet</p>
          <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">₹{cashFlow?.breakdown?.upi.toLocaleString() || "0"}</p>
        </div>
      </div>

      {/* Minimalist Search & Filter */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex p-1 bg-slate-50 dark:bg-white/5 rounded-2xl shrink-0">
            {(["ALL", "IN", "OUT"] as FlowType[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={clsx("px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all",
                  activeTab === tab ? "bg-white dark:bg-card text-orange-500 shadow-sm" : "text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}>
                {tab === "ALL" ? "All History" : tab === "IN" ? "Customer (IN)" : "Vendor (OUT)"}
              </button>
            ))}
          </div>

          <div className="relative group w-full md:w-auto md:min-w-[400px]">
            <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500 group-focus-within:text-orange-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search payment # or entity..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-slate-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/5 outline-none transition-all" 
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
        </div>

        {/* Advanced Filters Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
            <Filter size={14} className="text-slate-400 dark:text-slate-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Filters:</span>
          </div>

          {/* Module Filter */}
          <select 
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            className="px-4 py-2.5 bg-white dark:bg-card border border-slate-100 dark:border-white/10 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-orange-500 transition-all cursor-pointer"
          >
            <option value="ALL">All Modules</option>
            {Object.keys(MODULE_COLORS).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Method Filter */}
          <select 
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="px-4 py-2.5 bg-white dark:bg-card border border-slate-100 dark:border-white/10 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-orange-500 transition-all cursor-pointer"
          >
            <option value="ALL">All Methods</option>
            {METHOD_OPTIONS.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white dark:bg-card border border-slate-100 dark:border-white/10 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-orange-500 transition-all cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>

          {(statusFilter !== "ALL" || moduleFilter !== "ALL" || methodFilter !== "ALL") && (
            <button 
              onClick={() => { setStatusFilter("ALL"); setModuleFilter("ALL"); setMethodFilter("ALL"); }}
              className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-600"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Elegant Table Area */}
      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/20 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Loading Payments</p>
        </div>
      ) : error ? (
        <div className="py-40 text-center space-y-6">
          <div className="p-8 bg-red-50 dark:bg-red-500/10 w-fit mx-auto rounded-[2.5rem] border border-red-100 dark:border-red-500/20">
            <XCircle size={48} className="text-red-300 dark:text-red-400" strokeWidth={1} />
          </div>
          <div className="space-y-2">
            <p className="text-red-400 font-medium">{error}</p>
            <button onClick={fetchFinancials} className="text-xs text-orange-500 hover:underline font-bold">Retry connection</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-40 text-center space-y-6">
          <div className="p-8 bg-slate-50 dark:bg-white/5 w-fit mx-auto rounded-[2.5rem] border border-slate-100 dark:border-white/5">
            <CreditCard size={48} className="text-slate-300 dark:text-slate-600" strokeWidth={1} />
          </div>
          <p className="text-slate-400 font-medium">No payment history matches your filters.</p>
        </div>
      ) : (
        <div className="border border-slate-100 dark:border-white/5 rounded-[2rem] overflow-hidden bg-white dark:bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                  <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-400">Date & No</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-400">Source & Link</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-400">Entity & Account</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-400">Flow Type</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-400">Method</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-400">Status</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-400 text-right">Amount</th>
                  <th className="px-6 py-5 text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {paginated.map(payment => (
                  <tr key={payment.id} 
                    onClick={() => setSelectedPayment(payment)}
                    className={clsx("hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer", payment.isCancelled && "opacity-60 bg-red-50/20 dark:bg-red-500/10")}>
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase">
                        {payment.paymentNumber || "N/A"}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        {formatDate(payment.date)} • {new Date(payment.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={clsx("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border", MODULE_COLORS[payment.sourceModule || "MANUAL"])}>
                          {payment.sourceModule || "MANUAL"}
                        </span>
                        {payment.linkedDocType && (
                          <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400">
                            {payment.linkedDocType}: {payment.linkedDocId || "—"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{payment.entity || "—"}</p>
                      <p className="text-[10px] text-slate-400 font-medium">via {payment.accountName || "Unknown Account"}</p>
                    </td>
                    <td className="px-6 py-4">
                      {payment.flow === "IN" ? (
                        <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400"><ArrowDownRight size={14} strokeWidth={3} /><span className="text-[10px] font-black uppercase tracking-widest">Inflow</span></div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-orange-500 dark:text-orange-400"><ArrowUpRight size={14} strokeWidth={3} /><span className="text-[10px] font-black uppercase tracking-widest">Outflow</span></div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-300">{payment.method || "—"}</span>
                    </td>
                    <td className="px-6 py-4">
                      {payment.isCancelled ? (
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400"><XCircle size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Cancelled</span></div>
                      ) : payment.status === "PAID" ? (
                        <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400"><CheckCircle2 size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Paid</span></div>
                      ) : payment.status === "PENDING" ? (
                        <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400"><Clock size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Pending</span></div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400"><XCircle size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Failed</span></div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className={clsx("text-sm font-black tabular-nums", payment.flow === "IN" ? "text-emerald-500 dark:text-emerald-400" : "text-slate-900 dark:text-white", payment.isCancelled && "line-through")}>
                        {payment.flow === "IN" ? "+" : "-"}₹{payment.amount.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!payment.isCancelled && payment.status === "PAID" && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCancelPayment(payment.id); }}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-300 dark:text-slate-500 hover:text-red-500 rounded-lg transition-all active:scale-90"
                          title="Cancel & Reverse"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Showing page {currentPage} of {totalPages} • {filtered.length} total entries
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-white dark:bg-card border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                >
                  Prev
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-white dark:bg-card border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Payment Detail Drawer ── */}
      {selectedPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-end">
          <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setSelectedPayment(null)} />
          <div className="relative z-10 w-full max-w-md h-full bg-white dark:bg-card shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-500 text-slate-800 dark:text-slate-100">
            <div className="px-8 py-10 border-b border-slate-100 dark:border-white/5 sticky top-0 bg-white/80 dark:bg-card/80 backdrop-blur-md z-10">
              <div className="flex justify-between items-start mb-6">
                <div className={clsx("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", MODULE_COLORS[selectedPayment.sourceModule || "MANUAL"])}>
                  {selectedPayment.sourceModule || "MANUAL"} Transaction
                </div>
                <button onClick={() => setSelectedPayment(null)} className="p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all text-slate-400 dark:text-slate-500">
                  <X size={20} />
                </button>
              </div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter mb-2">
                {selectedPayment.paymentNumber}
              </h2>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                ID: {selectedPayment.id}
              </p>
            </div>

            <div className="flex-1 p-8 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">Entity</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">{selectedPayment.entity}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">Amount</p>
                  <p className={clsx("text-lg font-black", selectedPayment.flow === "IN" ? "text-emerald-500 dark:text-emerald-400" : "text-slate-900 dark:text-white")}>
                    ₹{selectedPayment.amount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-6 bg-slate-50 dark:bg-white/[0.02] p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                <div>
                  <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">Linked Document</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedPayment.linkedDocType || "Direct"} - {selectedPayment.linkedDocId || "No Reference"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">Payment Method</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <CreditCard size={16} /> {selectedPayment.method}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">Settled In</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Landmark size={16} /> {selectedPayment.accountName}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">Reference Note</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed italic">
                  {selectedPayment.reference || "No additional reference notes provided for this transaction."}
                </p>
              </div>

              <div className="pt-8 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">Audit Status</p>
                    <div className="flex items-center gap-2">
                       {selectedPayment.isCancelled ? (
                         <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400"><XCircle size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Voided</span></div>
                       ) : (
                         <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400"><CheckCircle2 size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Verified Ledger Entry</span></div>
                       )}
                    </div>
                  </div>
                  {selectedPayment.isCancelled && (
                    <div className="px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-500/20">
                      Reversed
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!selectedPayment.isCancelled && selectedPayment.status === "PAID" && (
              <div className="p-8 border-t border-slate-100 dark:border-white/5 sticky bottom-0 bg-white dark:bg-card">
                <button 
                  onClick={() => { handleCancelPayment(selectedPayment.id); setSelectedPayment(null); }}
                  className="w-full py-4 border-2 border-red-100 dark:border-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} /> Reverse Transaction
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Manual Payment Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/20 dark:bg-black/60 backdrop-blur-sm" onClick={closeModal} />

          {/* Drawer */}
          <div className="relative z-10 w-full max-w-md h-full bg-white dark:bg-card shadow-[0_0_40px_rgba(0,0,0,0.05)] flex flex-col overflow-y-auto animate-in slide-in-from-right duration-500 text-slate-800 dark:text-slate-100">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-white/5 sticky top-0 bg-white/80 dark:bg-card/80 backdrop-blur-md z-10">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Record Payment</h2>
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">This will be logged in the payment ledger instantly</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 dark:text-slate-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 px-8 py-6 space-y-6">

              {/* Flow Direction */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Direction <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setForm(p => ({ ...p, flow: "IN" }))}
                    className={clsx("py-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all",
                      form.flow === "IN"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-100 dark:border-white/10 text-slate-400 hover:border-slate-200 dark:hover:border-white/20 bg-white dark:bg-white/5"
                    )}>
                    <ArrowDownRight size={20} strokeWidth={2.5} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Customer Receipt</span>
                    <span className="text-[9px] font-medium opacity-60">Money comes IN</span>
                  </button>
                  <button onClick={() => setForm(p => ({ ...p, flow: "OUT" }))}
                    className={clsx("py-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all",
                      form.flow === "OUT"
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        : "border-slate-100 dark:border-white/10 text-slate-400 hover:border-slate-200 dark:hover:border-white/20 bg-white dark:bg-white/5"
                    )}>
                    <ArrowUpRight size={20} strokeWidth={2.5} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Vendor / Expense</span>
                    <span className="text-[9px] font-medium opacity-60">Money goes OUT</span>
                  </button>
                </div>
                {/* Contextual hint */}
                <div className={clsx(
                  "px-4 py-2.5 rounded-xl text-[10px] font-bold flex items-start gap-2 leading-relaxed transition-all",
                  form.flow === "IN"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"
                    : "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20"
                )}>
                  {form.flow === "IN" ? (
                    <><ArrowDownRight size={12} className="mt-0.5 shrink-0" />
                    Use this when a <strong>customer pays you</strong> — e.g. sale receipt, advance payment.
                    </>
                  ) : (
                    <><ArrowUpRight size={12} className="mt-0.5 shrink-0" />
                    Use this when <strong>you pay someone</strong> — vendor, rent, salary, utilities, etc.
                    </>
                  )}
                </div>
              </div>

              {/* Entity — context-aware for IN vs OUT */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  {form.flow === "IN" ? "Customer Name" : "Vendor / Payee Name"} <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.entity}
                  onChange={e => setForm(p => ({ ...p, entity: e.target.value }))}
                  placeholder={
                    form.flow === "IN"
                      ? "e.g. Rahul Sharma, Walk-in Customer"
                      : "e.g. Spice Valley, Electricity Board, Landlord"
                  }
                  className={clsx(
                    "w-full px-4 py-4 bg-slate-50 dark:bg-[#13151f] border-2 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:bg-white dark:focus:bg-card focus:ring-4 transition-all",
                    // Warn in real-time if user types an expense keyword while direction is IN
                    form.flow === "IN" && EXPENSE_KEYWORDS.some(kw => form.entity.toLowerCase().includes(kw))
                      ? "border-red-300 dark:border-red-500/40 focus:ring-red-100 dark:focus:ring-red-500/10 bg-red-50 dark:bg-red-500/10"
                      : "border-transparent dark:border-white/10 focus:ring-slate-100 dark:focus:ring-white/5"
                  )}
                />
                {/* Real-time expense-in-inflow warning */}
                {form.flow === "IN" && EXPENSE_KEYWORDS.some(kw => form.entity.toLowerCase().includes(kw)) && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl animate-in fade-in duration-200">
                    <XCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-600 dark:text-red-400 leading-relaxed">
                      This looks like an <strong>expense/outflow</strong>. Switch direction to <strong>&ldquo;Vendor / Expense (OUT)&rdquo;</strong>, or use the <strong>Expenses</strong> module.
                    </p>
                  </div>
                )}
              </div>

              {/* Linked To */}
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                  Linked To Document
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["DIRECT", "INVOICE", "PO"] as const).map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, linkedToType: t, linkedToId: t === "DIRECT" ? "" : p.linkedToId }))}
                      className={clsx("py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                        form.linkedToType === t
                          ? "border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                          : "border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-400 bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-white/5"
                      )}>
                      {t}
                    </button>
                  ))}
                </div>
                {form.linkedToType !== "DIRECT" && (
                  <div className="pt-2">
                    <input
                      value={form.linkedToId}
                      onChange={e => setForm(p => ({ ...p, linkedToId: e.target.value }))}
                      placeholder={`Enter ${form.linkedToType} ID (e.g. ${form.linkedToType}-102)`}
                      className="w-full px-4 py-3 bg-white dark:bg-[#13151f] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Amount */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Amount (₹) <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={form.amount}
                      onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-4 bg-slate-50 dark:bg-[#13151f] border border-transparent dark:border-white/10 rounded-2xl text-sm font-black text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/5 transition-all"
                    />
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Payment Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-4 py-4 bg-slate-50 dark:bg-[#13151f] border border-transparent dark:border-white/10 rounded-2xl text-sm font-black text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/5 transition-all"
                  />
                </div>
              </div>

              {/* Source Account */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Source Account <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {accounts.map(acc => (
                    <button key={acc.id} onClick={() => setForm(p => ({ ...p, sourceAccount: acc.id }))}
                      className={clsx("px-4 py-3 rounded-2xl border-2 text-[9px] font-black uppercase tracking-[0.1em] transition-all flex items-center gap-3",
                        form.sourceAccount === acc.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "border-slate-100 dark:border-white/10 text-slate-400 hover:border-slate-200 dark:hover:border-white/20 bg-white dark:bg-white/5"
                      )}>
                      {acc.type === "CASH" ? <Banknote size={16} /> : acc.type === "BANK" ? <Building2 size={16} /> : <Smartphone size={16} />}
                      <div className="text-left">
                        <p className="text-slate-900 dark:text-white">{acc.name}</p>
                        <p className="text-[7px] opacity-60">Bal: ₹{acc.balance.toLocaleString()}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {METHOD_OPTIONS.map(m => (
                    <button key={m.key} onClick={() => setForm(p => ({ ...p, method: m.key }))}
                      className={clsx("py-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all text-[9px] font-black uppercase tracking-widest",
                        form.method === m.key
                          ? "border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                          : "border-slate-100 dark:border-white/10 text-slate-400 dark:text-slate-400 hover:border-slate-200 dark:hover:border-white/20 bg-white dark:bg-white/5"
                      )}>
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Status (Controls Balance Update)</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["PAID", "PENDING", "FAILED"] as PaymentStatus[]).map(s => (
                    <button key={s} onClick={() => setForm(p => ({ ...p, status: s }))}
                      className={clsx("py-3 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all text-center",
                        form.status === s
                          ? s === "PAID" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : s === "PENDING" ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                          : "border-slate-100 dark:border-white/10 text-slate-400 dark:text-slate-400 hover:bg-slate-50/50 dark:hover:bg-white/5 bg-white dark:bg-white/5"
                      )}>
                      {s}
                      {form.status === s && s === "PAID" && <span className="block text-[7px] text-emerald-400 mt-0.5">Adjusts ledger</span>}
                      {form.status === s && s === "PENDING" && <span className="block text-[7px] text-amber-400 mt-0.5">No change</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Reference / Tx ID <span className="text-slate-300 dark:text-slate-600 font-medium normal-case tracking-normal">(optional)</span></label>
                <input
                  value={form.reference}
                  onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                  placeholder="e.g. UPI-TXNID, CHQ-00123"
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-[#13151f] border border-transparent dark:border-white/10 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/5 transition-all"
                />
              </div>

              {/* Note */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Remarks <span className="text-slate-300 dark:text-slate-600 font-medium normal-case tracking-normal">(optional)</span></label>
                <textarea
                  value={form.note}
                  onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="e.g. Payment for March invoice"
                  rows={2}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-[#13151f] border border-transparent dark:border-white/10 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/5 transition-all resize-none"
                />
              </div>

            </div>

            {/* Drawer Footer */}
            <div className="px-8 py-6 border-t border-slate-100 dark:border-white/5 sticky bottom-0 bg-white dark:bg-card shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
              {/* Error */}
              {submitError && (
                <div className="flex items-center gap-2 p-4 mb-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-[11px] font-black uppercase tracking-widest animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <XCircle size={16} className="shrink-0" /> {submitError}
                </div>
              )}

              {/* Success */}
              {submitSuccess && (
                <div className="flex items-center gap-2 p-4 mb-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-widest animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <CheckCircle2 size={16} className="shrink-0" /> Payment recorded successfully!
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={closeModal} disabled={submitting}
                  className="flex-1 py-4 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={submitting || submitSuccess}
                  className={clsx("flex-[2] py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] text-white transition-all flex items-center justify-center gap-2 shadow-lg",
                    submitting || submitSuccess ? "bg-slate-300 dark:bg-white/20 cursor-not-allowed shadow-none" : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-200 active:translate-y-0.5 shadow-slate-900/20"
                  )}>
                  {submitting ? (
                    <><RefreshCw size={16} className="animate-spin" /> Saving...</>
                  ) : submitSuccess ? (
                    <><CheckCircle2 size={16} /> Saved!</>
                  ) : (
                    <><Plus size={16} /> Record Payment</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Internal Transfer Modal ── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div className="absolute inset-0 bg-slate-900/20 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowTransferModal(false)} />
          <div className="relative z-10 w-full max-w-md h-full bg-white dark:bg-card shadow-xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-500 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-white/5 sticky top-0 bg-white/80 dark:bg-card/80 backdrop-blur-md z-10">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Internal Fund Transfer</h2>
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">Move money between your internal accounts</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 dark:text-slate-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 px-8 py-6 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">From Account</label>
                <select 
                  value={transferForm.fromAccountId}
                  onChange={e => setTransferForm(p => ({ ...p, fromAccountId: e.target.value }))}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-[#13151f] border border-transparent dark:border-white/10 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/5 transition-all appearance-none"
                >
                  <option value="" className="dark:bg-card">Select Source</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id} className="dark:bg-card">{acc.name} (₹{acc.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center -my-2 relative z-10">
                <div className="bg-white dark:bg-card p-2 rounded-full border border-slate-100 dark:border-white/10 shadow-sm">
                  <ArrowUpRight className="text-slate-300 dark:text-slate-500 rotate-90" size={20} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">To Account</label>
                <select 
                  value={transferForm.toAccountId}
                  onChange={e => setTransferForm(p => ({ ...p, toAccountId: e.target.value }))}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-[#13151f] border border-transparent dark:border-white/10 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/5 transition-all appearance-none"
                >
                  <option value="" className="dark:bg-card">Select Destination</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id} className="dark:bg-card">{acc.name} (₹{acc.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Amount (₹)</label>
                <input
                  type="number"
                  value={transferForm.amount}
                  onChange={e => setTransferForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-[#13151f] border border-transparent dark:border-white/10 rounded-2xl text-sm font-black text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/5 transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Note</label>
                <textarea
                  value={transferForm.note}
                  onChange={e => setTransferForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="Reason for transfer..."
                  rows={2}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-[#13151f] border border-transparent dark:border-white/10 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:bg-white dark:focus:bg-card focus:ring-4 focus:ring-slate-100 dark:focus:ring-white/5 transition-all resize-none"
                />
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 dark:border-white/5 sticky bottom-0 bg-white dark:bg-card shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
              {submitError && <div className="p-4 mb-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest">{submitError}</div>}
              {submitSuccess && <div className="p-4 mb-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">Transfer Successful</div>}
              <button onClick={handleTransfer} disabled={submitting || submitSuccess}
                className="w-full py-4 bg-slate-900 dark:bg-white hover:bg-black dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 shadow-lg disabled:bg-slate-300 dark:disabled:bg-white/20">
                {submitting ? <RefreshCw size={16} className="animate-spin" /> : <><RefreshCw size={16} /> Complete Transfer</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
