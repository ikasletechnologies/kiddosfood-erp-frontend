"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus, Calendar, ChevronDown, X, Share2, ArrowLeft, TrendingUp,
  FileText, RefreshCw, Search, Printer, FileSpreadsheet, Trash2,
  Eye, CheckCircle2, AlertCircle, Building2, DollarSign, Wallet,
  CreditCard, Smartphone, Check
} from "lucide-react";
import { clsx } from "clsx";
import { accountingApi, accountsApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

// ── Types & Constants ─────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  item: string;
  qty: number;
  rate: number;
}

const CATEGORIES = ["RENT", "SALARY", "TRANSPORT", "UTILITIES", "MARKETING", "MAINTENANCE", "OTHER"];
const PAYMENT_TYPES = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"];

function compatibleAccountType(paymentType: string): "CASH" | "BANK" | "UPI" {
  if (paymentType === "Cash") return "CASH";
  if (paymentType === "UPI") return "UPI";
  return "BANK";
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PAID: { label: "Paid", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  PENDING: { label: "Pending", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/20" },
};

const fmtINR = (amount: number) => {
  return `₹${(Number(amount) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getDateRange = (preset: string, customStart: string, customEnd: string) => {
  const now = new Date();
  let from = new Date();
  let to = new Date();

  switch (preset) {
    case "Today":
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      break;
    case "Yesterday":
      from.setDate(now.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(now.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      break;
    case "Last 7 Days":
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      break;
    case "This Month":
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "This Year":
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case "Custom":
      if (customStart) {
        from = new Date(customStart);
        from.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        to = new Date(customEnd);
        to.setHours(23, 59, 59, 999);
      }
      break;
    default:
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
};

function makeItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), item: "", qty: 1, rate: 0 };
}
function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function ExpensesPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");
  const [datePreset, setDatePreset] = useState("All Time");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Modal states
  const [viewingExpense, setViewingExpense] = useState<any | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [category, setCategory] = useState("OTHER");
  const [showCatDrop, setShowCatDrop] = useState(false);
  const [expenseDate, setExpenseDate] = useState(todayStr());
  const [items, setItems] = useState<LineItem[]>([makeItem(), makeItem()]);
  const [paymentType, setPaymentType] = useState("Cash");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [isGstEnabled, setIsGstEnabled] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");

  const catDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (catDropRef.current && !catDropRef.current.contains(t)) setShowCatDrop(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, accRes] = await Promise.all([
        accountingApi.getExpenses(),
        accountsApi.getAll()
      ]);
      setExpenses(expRes.data?.expenses ?? expRes.data ?? []);
      setAccounts(accRes.data ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const compatibleAccounts = accounts.filter(
    a => (a.status === "ACTIVE" || a.isActive !== false) && a.type === compatibleAccountType(paymentType)
  );

  useEffect(() => {
    if (!compatibleAccounts.some(a => a.id === selectedAccountId)) {
      setSelectedAccountId(compatibleAccounts[0]?.id || "");
    }
  }, [paymentType, accounts, selectedAccountId, compatibleAccounts]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const totalUnrounded = items.reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0);
  const roundOffAmt = roundOffEnabled ? Math.round(totalUnrounded) - totalUnrounded : 0;
  const grandTotal = totalUnrounded + roundOffAmt;
  const totalQty = items.reduce((s, it) => s + (it.qty || 0), 0);

  const updateItem = (id: string, field: keyof LineItem, value: any) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  const addRow = () => setItems(prev => [...prev, makeItem()]);
  const removeRow = (id: string) => {
    if (items.length > 1) setItems(prev => prev.filter(it => it.id !== id));
  };

  const resetForm = () => {
    setCategory("OTHER");
    setExpenseDate(todayStr());
    setItems([makeItem(), makeItem()]);
    setPaymentType("Cash");
    setSelectedAccountId("");
    setRoundOffEnabled(true);
    setIsGstEnabled(false);
    setNoteText("");
    setShowNote(false);
  };

  const openCreate = () => {
    resetForm();
    setView("create");
  };

  const handleSave = async () => {
    const valid = items.filter(it => it.item.trim() || it.rate > 0);
    if (!valid.length) {
      toast.error("Add at least one item");
      return;
    }
    if (!selectedAccountId) {
      toast.error("Select a payment account to pay from");
      return;
    }
    if (selectedAccount && selectedAccount.balance < grandTotal) {
      toast.error(`Insufficient balance in ${selectedAccount.name}. Available: ${fmtINR(selectedAccount.balance)}`);
      return;
    }
    setSaving(true);
    try {
      await accountingApi.recordExpense({
        category,
        payee: valid[0].item.trim() || category,
        amount: grandTotal,
        note: JSON.stringify({ items: valid, isGstEnabled, noteText }),
        date: expenseDate,
        isPaidImmediately: true,
        accountId: selectedAccountId,
        paymentMode: paymentType.toUpperCase(),
      });
      toast.success("Expense saved successfully");
      setView("list");
      resetForm();
      fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    setIsDeleting(true);
    try {
      await accountingApi.deleteExpense(deletingExpenseId);
      toast.success("Expense removed successfully");
      setDeletingExpenseId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to delete expense");
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Filtered Expenses ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchCat = (e.category || "").toLowerCase().includes(q);
        const matchPayee = (e.payee || "").toLowerCase().includes(q);
        const matchNote = (typeof e.note === "string" ? e.note : "").toLowerCase().includes(q);
        if (!matchCat && !matchPayee && !matchNote) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== "ALL" && (e.category || "").toUpperCase() !== selectedCategory) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== "ALL") {
        const s = (e.status || "PAID").toUpperCase();
        if (statusFilter === "PAID" && s !== "PAID") return false;
        if (statusFilter === "PENDING" && s !== "PENDING") return false;
      }

      // 4. Date Preset Filter
      if (datePreset !== "All Time") {
        const { from, to } = getDateRange(datePreset, customStartDate, customEndDate);
        const eDate = new Date(e.date || e.createdAt).toISOString().split("T")[0];
        if (eDate < from || eDate > to) return false;
      }

      return true;
    });
  }, [expenses, search, selectedCategory, statusFilter, datePreset, customStartDate, customEndDate]);

  // ── KPI Calculations ─────────────────────────────────────────────────────────

  const totalFilteredExpenses = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const thisMonthExpenses = useMemo(() => {
    const now = new Date();
    return expenses
      .filter(e => {
        const d = new Date(e.date || e.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const pendingExpensesCount = useMemo(() => {
    return expenses.filter(e => (e.status || "").toUpperCase() === "PENDING").length;
  }, [expenses]);

  const paidExpensesCount = useMemo(() => {
    return expenses.filter(e => (e.status || "PAID").toUpperCase() === "PAID").length;
  }, [expenses]);

  // ── Export to CSV ────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (!filtered.length) {
      toast.error("No expenses to export");
      return;
    }

    const headers = ["Expense Date", "Category", "Payee / Description", "Payment Mode", "Status", "Amount"];
    const rows = filtered.map(e => [
      `"${formatDate(e.date || e.createdAt)}"`,
      `"${(e.category || "").replace(/"/g, '""')}"`,
      `"${(e.payee || "—").replace(/"/g, '""')}"`,
      `"${(e.paymentMode || "Cash").replace(/"/g, '""')}"`,
      `"${e.status || "PAID"}"`,
      `"${Number(e.amount || 0).toFixed(2)}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expenses_Statement_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Expenses statement exported to CSV");
  };

  const clearAllFilters = () => {
    setSearch("");
    setSelectedCategory("ALL");
    setStatusFilter("ALL");
    setDatePreset("All Time");
  };

  const hasActiveFilters = search || selectedCategory !== "ALL" || statusFilter !== "ALL" || datePreset !== "All Time";

  // ── CREATE VIEW ──────────────────────────────────────────────────────────────

  if (view === "create") {
    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background p-3 sm:p-4 md:p-6 min-h-screen space-y-4 sm:space-y-6 animate-in fade-in duration-300 text-gray-800 dark:text-slate-100 w-full min-w-0">
        {/* Top Header Bar */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 flex items-center justify-between shadow-2xs w-full min-w-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setView("list"); resetForm(); }}
              className="p-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[10px] text-[#f58220] font-bold uppercase tracking-wider">Operational Outflow</p>
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
                Record New Expense
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="font-bold text-gray-600 dark:text-slate-400">GST Invoice</span>
              <button
                type="button"
                onClick={() => setIsGstEnabled(v => !v)}
                className={clsx(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  isGstEnabled ? "bg-[#f58220]" : "bg-gray-200 dark:bg-white/20"
                )}
              >
                <span className={clsx("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", isGstEnabled ? "translate-x-4" : "translate-x-1")} />
              </button>
            </label>
          </div>
        </div>

        {/* Create Form Fields */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
          {/* Left / Main Section */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
            {/* Header info */}
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative" ref={catDropRef}>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Expense Category <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCatDrop(v => !v)}
                    className="w-full flex items-center justify-between border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-800 dark:text-white bg-gray-50 dark:bg-[#13151f] hover:border-[#f58220] transition-colors"
                  >
                    <span>{category}</span>
                    <ChevronDown size={14} className="text-gray-400 dark:text-slate-500" />
                  </button>
                  {showCatDrop && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-50 py-1 max-h-48 overflow-y-auto custom-scrollbar">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => { setCategory(cat); setShowCatDrop(false); }}
                          className={clsx(
                            "w-full text-left px-4 py-2 text-xs font-semibold hover:bg-orange-50 dark:hover:bg-white/5 transition-colors",
                            cat === category ? "text-[#f58220] font-bold" : "text-gray-700 dark:text-slate-300"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Expense Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 dark:text-white outline-none focus:border-[#f58220]"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Card */}
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
              <div className="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-slate-300">
                  Expense Items / Breakdown
                </span>
                <button
                  type="button"
                  onClick={addRow}
                  className="text-xs font-bold text-[#f58220] hover:text-[#e8740e] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Add Row
                </button>
              </div>

              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-xs min-w-[550px]">
                  <thead>
                    <tr className="bg-gray-50/75 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                      <th className="px-3 py-2.5 w-8">#</th>
                      <th className="px-3 py-2.5">Item / Description</th>
                      <th className="px-3 py-2.5 w-20 text-center">Qty</th>
                      <th className="px-3 py-2.5 w-28 text-center">Rate (₹)</th>
                      <th className="px-3 py-2.5 w-28 text-right">Amount</th>
                      <th className="px-3 py-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-2 text-center text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            value={item.item}
                            onChange={e => updateItem(item.id, "item", e.target.value)}
                            placeholder="e.g. Office Stationery, Fuel, Refreshments"
                            className="w-full px-2 py-1.5 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-800 dark:text-white outline-none focus:border-[#f58220]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="1"
                            value={item.qty || ""}
                            onChange={e => updateItem(item.id, "qty", parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-mono font-bold text-center text-gray-800 dark:text-white outline-none focus:border-[#f58220]"
                            placeholder="1"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate || ""}
                            onChange={e => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-mono font-bold text-center text-gray-800 dark:text-white outline-none focus:border-[#f58220]"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {fmtINR((item.qty || 0) * (item.rate || 0))}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(item.id)}
                              className="p-1 text-gray-400 hover:text-rose-500 rounded cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note & Description */}
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 shadow-2xs space-y-2">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                Additional Notes &amp; Comments
              </label>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add optional notes, invoice reference, or payment purpose..."
                rows={3}
                className="w-full p-3 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-800 dark:text-white outline-none resize-none focus:border-[#f58220]"
              />
            </div>
          </div>

          {/* Right Summary & Account Selection */}
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-2xs space-y-4">
              <p className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Payment &amp; Settlement
              </p>

              {/* Payment Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400">Payment Mode</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PAYMENT_TYPES.map(t => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setPaymentType(t)}
                      className={clsx(
                        "py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate",
                        paymentType === t
                          ? "bg-[#f58220] text-white border-[#f58220] shadow-2xs"
                          : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:text-gray-900"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compatible Accounts */}
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/5">
                <label className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                  Disburse From Account
                </label>
                {compatibleAccounts.length === 0 ? (
                  <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 rounded-xl p-3">
                    No active {compatibleAccountType(paymentType)} account found. Please configure a financial account under Banking.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {compatibleAccounts.map(acc => {
                      const insufficient = grandTotal > 0 && acc.balance < grandTotal;
                      const isSelected = acc.id === selectedAccountId;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setSelectedAccountId(acc.id)}
                          className={clsx(
                            "w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer",
                            isSelected
                              ? "border-[#f58220] bg-orange-50/50 dark:bg-orange-500/10"
                              : "border-gray-200 dark:border-white/10 hover:border-gray-300"
                          )}
                        >
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">{acc.name}</p>
                            <p className="text-[10px] text-gray-400">{acc.type}</p>
                          </div>
                          <div className="text-right">
                            <p className={clsx("text-xs font-mono font-bold", insufficient ? "text-rose-500" : "text-gray-800 dark:text-white")}>
                              {fmtINR(acc.balance || 0)}
                            </p>
                            {insufficient && <p className="text-[9px] font-bold text-rose-500">Insufficient</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Summary Totals */}
              <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-white/5 text-xs">
                <div className="flex justify-between text-gray-500 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-white">{fmtINR(totalUnrounded)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={roundOffEnabled}
                      onChange={e => setRoundOffEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#f58220] rounded"
                    />
                    <span>Round off</span>
                  </label>
                  <span className={clsx("font-mono font-bold", roundOffAmt >= 0 ? "text-emerald-600" : "text-rose-500")}>
                    {roundOffAmt >= 0 ? "+" : ""}{fmtINR(roundOffAmt)}
                  </span>
                </div>
                <div className="border-t border-gray-100 dark:border-white/5 pt-2 flex justify-between items-center text-sm font-bold">
                  <span className="text-gray-900 dark:text-white">Grand Total</span>
                  <span className="text-base font-mono text-[#f58220]">{fmtINR(grandTotal)}</span>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !selectedAccountId || (!!selectedAccount && grandTotal > 0 && selectedAccount.balance < grandTotal)}
                className="w-full py-3 bg-[#f58220] hover:bg-[#e0751a] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Saving Expense...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm &amp; Record Expense</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 bg-gray-50 dark:bg-background min-h-screen text-gray-800 dark:text-slate-100 animate-in fade-in duration-300 w-full min-w-0">

      {/* ── Top Header Toolbar ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <TrendingUp size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Business Expenses
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Record, categorize, and audit company operational disbursements
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between lg:justify-end min-w-0">
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#f58220] hover:bg-[#e0751a] text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <Plus size={15} />
            <span>Add Expense</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
              title="Export CSV"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
              title="Print Statement"
            >
              <Printer className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={fetchData}
              title="Refresh Data"
              className="p-2 sm:p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={15} className={clsx(loading && "animate-spin text-[#f58220]")} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Interactive KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
        {/* Total Expenses */}
        <div
          onClick={() => setStatusFilter("ALL")}
          className={clsx(
            "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs relative overflow-hidden",
            statusFilter === "ALL" && datePreset === "All Time"
              ? "bg-slate-900 text-white border-slate-800"
              : "bg-white dark:bg-card border-gray-200 dark:border-white/5 text-gray-900 dark:text-white hover:border-[#f58220]/50"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={clsx("text-[11px] font-bold uppercase tracking-wider", statusFilter === "ALL" && datePreset === "All Time" ? "text-slate-400" : "text-gray-500 dark:text-slate-400")}>
              Total Expenses
            </span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-[#f58220]">
              <Wallet size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight mt-2">
            {fmtINR(totalFilteredExpenses)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] font-medium text-slate-400">
            <span>{filtered.length} total records</span>
          </div>
        </div>

        {/* This Month */}
        <div
          onClick={() => setDatePreset("This Month")}
          className={clsx(
            "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs",
            datePreset === "This Month"
              ? "bg-blue-600 text-white border-blue-700 shadow-blue-500/10"
              : "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30 hover:border-blue-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={clsx("text-[11px] font-bold uppercase tracking-wider", datePreset === "This Month" ? "text-white/80" : "text-blue-700 dark:text-blue-400")}>
              Current Month
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Calendar size={16} />
            </div>
          </div>
          <p className={clsx("text-xl sm:text-2xl font-black font-mono tracking-tight mt-2", datePreset === "This Month" ? "text-white" : "text-blue-600 dark:text-blue-400")}>
            {fmtINR(thisMonthExpenses)}
          </p>
          <div className={clsx("flex items-center gap-1 mt-2 text-[11px] font-semibold", datePreset === "This Month" ? "text-white/80" : "text-blue-600 dark:text-blue-400")}>
            <span>This calendar month</span>
          </div>
        </div>

        {/* Pending Expenses */}
        <div
          onClick={() => setStatusFilter("PENDING")}
          className={clsx(
            "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs",
            statusFilter === "PENDING"
              ? "bg-amber-600 text-white border-amber-700 shadow-amber-500/10"
              : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 hover:border-amber-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={clsx("text-[11px] font-bold uppercase tracking-wider", statusFilter === "PENDING" ? "text-white/80" : "text-amber-700 dark:text-amber-400")}>
              Pending Outflows
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle size={16} />
            </div>
          </div>
          <p className={clsx("text-xl sm:text-2xl font-black font-mono tracking-tight mt-2", statusFilter === "PENDING" ? "text-white" : "text-amber-600 dark:text-amber-400")}>
            {pendingExpensesCount}
          </p>
          <div className={clsx("flex items-center gap-1 mt-2 text-[11px] font-semibold", statusFilter === "PENDING" ? "text-white/80" : "text-amber-600 dark:text-amber-400")}>
            <span>Awaiting settlement</span>
          </div>
        </div>

        {/* Settled Expenses */}
        <div
          onClick={() => setStatusFilter("PAID")}
          className={clsx(
            "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs",
            statusFilter === "PAID"
              ? "bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/10"
              : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 hover:border-emerald-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={clsx("text-[11px] font-bold uppercase tracking-wider", statusFilter === "PAID" ? "text-white/80" : "text-emerald-700 dark:text-emerald-400")}>
              Settled Outflows
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className={clsx("text-xl sm:text-2xl font-black font-mono tracking-tight mt-2", statusFilter === "PAID" ? "text-white" : "text-emerald-600 dark:text-emerald-400")}>
            {paidExpensesCount}
          </p>
          <div className={clsx("flex items-center gap-1 mt-2 text-[11px] font-semibold", statusFilter === "PAID" ? "text-white/80" : "text-emerald-600 dark:text-emerald-400")}>
            <span>Disbursed &amp; reconciled</span>
          </div>
        </div>
      </div>

      {/* ── Multi-Dimensional Filters Bar ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 shadow-2xs space-y-3 w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search category, payee, note..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#f58220]"
            />
            {search && (
              <X
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                onClick={() => setSearch("")}
              />
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Dropdown */}
            <div className="relative shrink-0">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220]"
              >
                <option value="ALL">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>

            {/* Date Preset Dropdown */}
            <div className="relative shrink-0">
              <select
                value={datePreset}
                onChange={e => setDatePreset(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220]"
              >
                <option value="All Time">All Time</option>
                <option value="This Month">This Month</option>
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="This Year">This Year</option>
                <option value="Custom">Custom Range</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>

            {datePreset === "Custom" && (
              <div className="flex items-center gap-1.5 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 bg-gray-50 dark:bg-[#13151f] text-xs shrink-0">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
                />
                <span className="text-gray-400 dark:text-slate-500 text-xs">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar p-0.5">
            {[
              { id: "ALL", label: "All Records" },
              { id: "PAID", label: "Settled / Paid" },
              { id: "PENDING", label: "Pending" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                  statusFilter === tab.id
                    ? "bg-[#f58220] text-white shadow-2xs"
                    : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer select-none inline-flex items-center gap-1"
            >
              <X size={13} />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Expenses Ledger Table ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
        <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
          <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
            Expenses Ledger ({filtered.length})
          </span>
          <span className="text-xs font-mono font-bold text-[#f58220]">
            Total: {fmtINR(totalFilteredExpenses)}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 animate-pulse">Loading expense records...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-orange-50 dark:bg-orange-500/10 text-[#f58220]">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-gray-800 dark:text-white font-bold text-sm">No expenses found</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">No expense transactions match your active filter criteria.</p>
            </div>
            <button
              onClick={openCreate}
              className="mt-2 px-4 py-2 bg-[#f58220] hover:bg-[#e0751a] text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Record Expense</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50/75 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    <th className="px-4 sm:px-6 py-3">Date</th>
                    <th className="px-4 sm:px-6 py-3">Category</th>
                    <th className="px-4 sm:px-6 py-3">Payee / Description</th>
                    <th className="px-4 sm:px-6 py-3">Payment Mode</th>
                    <th className="px-4 sm:px-6 py-3 text-center">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Amount</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                  {filtered.map(exp => {
                    const statusKey = (exp.status || "PAID").toUpperCase();
                    const s = STATUS_STYLES[statusKey] || STATUS_STYLES.PAID;
                    return (
                      <tr key={exp.id} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 sm:px-6 py-3.5 font-mono text-gray-600 dark:text-slate-400">
                          {formatDate(exp.date || exp.createdAt)}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-50 dark:bg-orange-500/10 text-[#f58220] border border-orange-200 dark:border-orange-500/20">
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 font-semibold text-gray-900 dark:text-white max-w-[200px] truncate">
                          {exp.payee || "—"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-gray-600 dark:text-slate-300">
                          {exp.paymentMode || "Cash"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-center">
                          <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-bold border", s.bg, s.color, s.border)}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {fmtINR(exp.amount || 0)}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingExpense(exp)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => setDeletingExpenseId(exp.id)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete Expense"
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
            <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
              {filtered.map(exp => {
                const statusKey = (exp.status || "PAID").toUpperCase();
                const s = STATUS_STYLES[statusKey] || STATUS_STYLES.PAID;
                return (
                  <div key={exp.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-50 dark:bg-orange-500/10 text-[#f58220] border border-orange-200">
                          {exp.category}
                        </span>
                        <p className="font-bold text-gray-900 dark:text-white text-sm mt-1">{exp.payee || "General Expense"}</p>
                      </div>
                      <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0", s.bg, s.color, s.border)}>
                        {s.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-gray-400 font-mono">{formatDate(exp.date || exp.createdAt)}</span>
                      <span className="font-mono font-bold text-sm text-[#f58220]">{fmtINR(exp.amount || 0)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-white/5">
                      <span className="text-[11px] text-gray-500">Mode: {exp.paymentMode || "Cash"}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewingExpense(exp)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-200 bg-white dark:bg-card"
                        >
                          View
                        </button>
                        <button
                          onClick={() => setDeletingExpenseId(exp.id)}
                          className="p-1 text-gray-400 hover:text-rose-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── View Expense Details Modal ── */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-lg">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Expense Details</h3>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">{viewingExpense.category} • {formatDate(viewingExpense.date || viewingExpense.createdAt)}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingExpense(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs">
              <div className="bg-orange-50/60 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400">Total Disbursed</span>
                  <p className="text-lg font-bold font-mono text-[#f58220] mt-0.5">{fmtINR(viewingExpense.amount || 0)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-gray-400">Payment Mode</span>
                  <p className="font-semibold text-gray-800 dark:text-white mt-0.5">{viewingExpense.paymentMode || "Cash"}</p>
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Category:</span>
                  <span className="font-bold text-gray-800 dark:text-white">{viewingExpense.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Payee / Vendor:</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{viewingExpense.payee || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="font-bold text-emerald-600">{viewingExpense.status || "PAID"}</span>
                </div>
              </div>

              {viewingExpense.note && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-gray-400">Notes / Details</span>
                  <p className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl text-gray-700 dark:text-slate-300">
                    {typeof viewingExpense.note === "string" && viewingExpense.note.startsWith("{")
                      ? JSON.parse(viewingExpense.note).noteText || viewingExpense.note
                      : viewingExpense.note}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-white/[0.01]">
              <button
                onClick={() => setViewingExpense(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingExpenseId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden my-auto p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Delete Expense Record?</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Are you sure you want to delete this expense record? This action will remove the record from your operational logs.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingExpenseId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteExpense}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
