"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowUpRight, ArrowDownRight, RefreshCw, Wallet, Building2,
  Smartphone, TrendingUp, TrendingDown, DollarSign, Search,
  Calendar, FileSpreadsheet, Printer, X, ChevronDown, CheckCircle2
} from "lucide-react";
import { clsx } from "clsx";
import { accountingApi } from "@/lib/api/accounting.api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

interface CashFlowSummary {
  accounts: any[];
  totalLiquidity: number;
  breakdown: {
    cash: number;
    bank: number;
    upi: number;
  };
}

interface Payment {
  id: string;
  paymentNumber?: string;
  date: string;
  entity: string;
  flow: "IN" | "OUT";
  method: string;
  amount: number;
  status: string;
  accountName?: string;
  isCancelled?: boolean;
}

// ── Date Preset Helpers ────────────────────────────────────────────────────────

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
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
};

export default function CashFlowPage() {
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Date filters
  const [dateFilter, setDateFilter] = useState("This Month");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [flowFilter, setFlowFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [methodFilter, setMethodFilter] = useState<"ALL" | "CASH" | "BANK" | "UPI">("ALL");

  const fetchCashFlow = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
      const [cashRes, paymentsRes] = await Promise.all([
        accountingApi.getCashFlow(),
        accountingApi.getPayments({ startDate: from, endDate: to })
      ]);

      setSummary(cashRes.data);

      // Filter for settled PAID payments only (strict financial validity)
      const allPayments = paymentsRes.data?.payments || paymentsRes.data?.data || paymentsRes.data || [];
      const settled = Array.isArray(allPayments)
        ? allPayments.filter((p: any) => p.status === 'PAID' && !p.isCancelled)
        : [];
      setPayments(settled);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load cash flow data");
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    fetchCashFlow();
  }, [fetchCashFlow]);

  // Financial calculations
  const totalInflows = useMemo(() => {
    return payments.filter(p => p.flow === 'IN').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [payments]);

  const totalOutflows = useMemo(() => {
    return payments.filter(p => p.flow === 'OUT').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [payments]);

  const netCashFlow = totalInflows - totalOutflows;

  // Filtered movements table
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRef = (p.paymentNumber || "").toLowerCase().includes(q);
        const matchEntity = (p.entity || "").toLowerCase().includes(q);
        const matchAcc = (p.accountName || "").toLowerCase().includes(q);
        const matchMethod = (p.method || "").toLowerCase().includes(q);
        if (!matchRef && !matchEntity && !matchAcc && !matchMethod) return false;
      }

      // 2. Flow Filter
      if (flowFilter !== "ALL" && p.flow !== flowFilter) return false;

      // 3. Method Filter
      if (methodFilter !== "ALL") {
        const m = (p.method || "").toUpperCase();
        if (methodFilter === "CASH" && m !== "CASH") return false;
        if (methodFilter === "BANK" && m !== "BANK" && m !== "CARD" && m !== "CHEQUE") return false;
        if (methodFilter === "UPI" && m !== "UPI" && m !== "QR") return false;
      }

      return true;
    });
  }, [payments, searchQuery, flowFilter, methodFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredPayments.length) {
      toast.error("No transactions to export for the selected period");
      return;
    }
    const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
    const headers = ["Date", "Ref No", "Entity / Description", "Flow", "Account / Method", "Amount", "Status"];
    const rows = filteredPayments.map(p => [
      `"${formatDate(p.date)}"`,
      `"${(p.paymentNumber || "").replace(/"/g, '""')}"`,
      `"${(p.entity || "").replace(/"/g, '""')}"`,
      `"${p.flow === 'IN' ? 'INFLOW' : 'OUTFLOW'}"`,
      `"${(p.accountName || p.method || "").replace(/"/g, '""')}"`,
      `"${p.amount.toFixed(2)}"`,
      `"${p.status}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Cash_Flow_${from}_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Cash flow statement exported to CSV");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 bg-gray-50 dark:bg-background min-h-screen text-gray-800 dark:text-slate-100 animate-in fade-in duration-300 w-full min-w-0">

      {/* ── Top Header Toolbar ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Wallet size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Cash Flow Overview
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Audited cash position, live liquidity balances, and settled transaction flows
            </p>
          </div>
        </div>

        {/* Date Filter & Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between lg:justify-end min-w-0">
          <div className="relative shrink-0">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220]"
            >
              <option className="dark:bg-card">This Month</option>
              <option className="dark:bg-card">Today</option>
              <option className="dark:bg-card">Yesterday</option>
              <option className="dark:bg-card">Last 7 Days</option>
              <option className="dark:bg-card">This Year</option>
              <option className="dark:bg-card">Custom</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          </div>

          {dateFilter === "Custom" && (
            <div className="flex items-center gap-1.5 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 bg-gray-50 dark:bg-[#13151f] text-xs shrink-0">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
              />
              <span className="text-gray-400 dark:text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
              />
            </div>
          )}

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
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
              title="Print Statement"
            >
              <Printer className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={fetchCashFlow}
              title="Refresh Data"
              className="p-2 sm:p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={15} className={clsx(loading && "animate-spin text-[#f58220]")} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 animate-pulse">Auditing cash flow movements...</p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">

          {/* ── Liquidity Section: Accounts Breakdown ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
            {/* Total Liquidity Master Card */}
            <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-4 sm:p-5 text-white flex flex-col justify-between border border-slate-800 shadow-2xs relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-[#f58220]/15 rounded-full blur-2xl -mr-10 -mt-10" />
              <div className="space-y-1 relative z-10">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Liquidity</p>
                <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                  ₹{(summary?.totalLiquidity || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 text-slate-400 text-xs font-semibold">
                <Wallet size={15} className="text-[#f58220]" />
                <span>All Active Financial Accounts</span>
              </div>
            </div>
            
            {[
              {
                label: "Cash in Hand",
                val: summary?.breakdown?.cash || 0,
                desc: "Physical Cash Registers",
                icon: DollarSign,
                color: "text-emerald-700 dark:text-emerald-400",
                bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
                border: "border-emerald-200 dark:border-emerald-900/30",
              },
              {
                label: "Bank Balance",
                val: summary?.breakdown?.bank || 0,
                desc: "Commercial Bank Accounts",
                icon: Building2,
                color: "text-blue-700 dark:text-blue-400",
                bg: "bg-blue-50/60 dark:bg-blue-950/20",
                border: "border-blue-200 dark:border-blue-900/30",
              },
              {
                label: "UPI / Digital Wallets",
                val: summary?.breakdown?.upi || 0,
                desc: "Online Gateway & QR Wallets",
                icon: Smartphone,
                color: "text-violet-700 dark:text-violet-400",
                bg: "bg-violet-50/60 dark:bg-violet-950/20",
                border: "border-violet-200 dark:border-violet-900/30",
              },
            ].map((s, i) => (
              <div key={i} className={clsx("rounded-2xl p-4 sm:p-5 flex flex-col justify-between border shadow-2xs", s.bg, s.border)}>
                <div className="space-y-1">
                  <p className={clsx("text-[11px] font-bold uppercase tracking-wider", s.color)}>{s.label}</p>
                  <p className={clsx("text-xl sm:text-2xl font-bold font-mono tracking-tight", s.color)}>
                    ₹{s.val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={clsx("flex items-center gap-1.5 mt-3 text-xs font-semibold opacity-90", s.color)}>
                  <s.icon size={15} /> <span>{s.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Operating Cash Flow Summary (Selected Period) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4 w-full min-w-0">
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 shrink-0">
                <TrendingUp size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total Inflow (Period)</p>
                <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                  +₹{totalInflows.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-2xs flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 shrink-0">
                <TrendingDown size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total Outflow (Period)</p>
                <p className="text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 truncate mt-0.5">
                  -₹{totalOutflows.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className={clsx(
              "border rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-center sm:col-span-2 md:col-span-1",
              netCashFlow >= 0 
                ? "bg-emerald-600 text-white border-emerald-700" 
                : "bg-rose-600 text-white border-rose-700"
            )}>
              <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider">Net Cash Flow (Period)</p>
              <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight mt-0.5 truncate">
                {netCashFlow >= 0 ? '+' : ''}₹{netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* ── Transactions Ledger & Filter Strip ── */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-2xs w-full min-w-0 space-y-4">
            
            {/* Filter Strip */}
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50/50 dark:bg-white/[0.01]">
              <div className="relative flex-1 max-w-sm min-w-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search Ref, Entity, Account..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#f58220]"
                />
                {searchQuery && (
                  <X 
                    size={14} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                    onClick={() => setSearchQuery("")} 
                  />
                )}
              </div>

              {/* Flow filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar p-0.5">
                {(["ALL", "IN", "OUT"] as const).map((flow) => (
                  <button
                    key={flow}
                    onClick={() => setFlowFilter(flow)}
                    className={clsx(
                      "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                      flowFilter === flow
                        ? flow === "IN" ? "bg-emerald-600 text-white shadow-2xs" : flow === "OUT" ? "bg-rose-600 text-white shadow-2xs" : "bg-[#f58220] text-white shadow-2xs"
                        : "bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                    )}
                  >
                    {flow === "ALL" ? "All Movements" : flow === "IN" ? "Inflow Only" : "Outflow Only"}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/5 bg-gray-50/75 dark:bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    <th className="px-4 sm:px-6 py-3">Date &amp; Ref</th>
                    <th className="px-4 sm:px-6 py-3">Entity / Description</th>
                    <th className="px-4 sm:px-6 py-3">Flow</th>
                    <th className="px-4 sm:px-6 py-3">Account / Method</th>
                    <th className="px-4 sm:px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                  {filteredPayments.length > 0 ? (
                    filteredPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 sm:px-6 py-3.5">
                          <p className="font-bold text-gray-900 dark:text-white font-mono text-xs uppercase">{payment.paymentNumber || "—"}</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono mt-0.5">
                            {formatDate(payment.date)}
                          </p>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5">
                          <p className="font-semibold text-gray-800 dark:text-slate-200 text-xs sm:text-sm">{payment.entity || "General Transaction"}</p>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5">
                          {payment.flow === "IN" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/30 text-[10px] font-bold uppercase tracking-wider">
                              <ArrowDownRight size={11} strokeWidth={2.5} /> Inflow
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800/30 text-[10px] font-bold uppercase tracking-wider">
                              <ArrowUpRight size={11} strokeWidth={2.5} /> Outflow
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10">
                            {payment.accountName || payment.method}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-right font-mono font-bold text-xs sm:text-sm">
                          <span className={payment.flow === "IN" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white"}>
                            {payment.flow === "IN" ? "+" : "-"}₹{Number(payment.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-gray-400 dark:text-slate-500">
                        <Wallet size={32} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                        <p className="font-semibold text-xs sm:text-sm">No cash movements recorded for the selected period</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredPayments.length > 0 && (
              <div className="p-3 text-center border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 font-mono">
                  Showing {filteredPayments.length} settled transaction {filteredPayments.length === 1 ? "record" : "records"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
