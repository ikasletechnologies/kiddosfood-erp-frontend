"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Scale,
  RefreshCw,
  Search,
  Printer,
  ChevronDown,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  BookOpen,
} from "lucide-react";
import { clsx } from "clsx";
import { reportsApi } from "@/lib/api/accounting.api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TrialBalanceRow {
  name: string;
  debit: number;
  credit: number;
}

// ── Currency Formatter ─────────────────────────────────────────────────────────

const fmtCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return "—";
  const num = Number(val);
  const isNegative = num < 0;
  const absFormatted = Math.abs(num).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-₹${absFormatted}` : `₹${absFormatted}`;
};

// ── Date Range Presets ─────────────────────────────────────────────────────────

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
    case "This Week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      from = new Date(now.setDate(diff));
      from.setHours(0, 0, 0, 0);
      to = new Date();
      to.setHours(23, 59, 59, 999);
      break;
    }
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

export default function TrialBalancePage() {
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState("This Month");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showZeroBalances, setShowZeroBalances] = useState(false);

  // ── Fetch Trial Balance Data ──────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
      const res = await reportsApi.getTrialBalance({ startDate: from, endDate: to });
      const rawData = Array.isArray(res.data) ? res.data : [];
      setRows(rawData);
    } catch (err: any) {
      console.error("Failed to load trial balance:", err);
      toast.error(err?.response?.data?.error || "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtered Rows ────────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // 1. Zero balance filter
      if (!showZeroBalances && (r.debit || 0) === 0 && (r.credit || 0) === 0) {
        return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = (r.name || "").toLowerCase().includes(query);
        if (!matchName) return false;
      }

      return true;
    });
  }, [rows, showZeroBalances, searchQuery]);

  // Summary totals based on active filtered rows
  const totalDebit = useMemo(() => {
    return filteredRows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  }, [filteredRows]);

  const totalCredit = useMemo(() => {
    return filteredRows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  }, [filteredRows]);

  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01;

  // ── Print Handler ────────────────────────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#020617] text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">
      
      {/* ── Top Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Scale className="h-5 w-5" />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
            Trial Balance
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            title="Print Trial Balance"
          >
            <Printer className="h-4 w-4 text-gray-500 dark:text-slate-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">

        {/* ── Summary / KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
          {/* 1. Total Debit */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Debit
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(totalDebit)}
              </div>
            </div>
          </div>

          {/* 2. Total Credit */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-50 dark:ring-blue-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Credit
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-blue-600 dark:text-blue-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(totalCredit)}
              </div>
            </div>
          </div>

          {/* 3. Balance Difference */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div
              className={clsx(
                "w-2.5 h-2.5 rounded-full shrink-0",
                isBalanced
                  ? "bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-500/20"
                  : "bg-amber-500 ring-4 ring-amber-50 dark:ring-amber-500/20"
              )}
            />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                {isBalanced ? "Balance Status" : "Difference"}
              </div>
              <div
                className={clsx(
                  "text-xl sm:text-2xl font-black font-mono tracking-tight mt-1 truncate",
                  isBalanced
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                )}
              >
                {loading ? "..." : isBalanced ? "Balanced" : fmtCurrency(difference)}
              </div>
            </div>
          </div>

          {/* 4. Active Accounts */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f58220] ring-4 ring-orange-50 dark:ring-orange-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Active Ledgers
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-gray-900 dark:text-white mt-1 truncate">
                {loading ? "..." : filteredRows.length}
              </div>
            </div>
          </div>
        </div>

        {/* ── Filters & Search Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0 bg-white dark:bg-card p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search Ledger / Account Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-[#f58220] transition-colors"
            />
          </div>

          {/* Date Filter Dropdown */}
          <div className="relative shrink-0">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220] transition-colors"
            >
              <option value="This Month">This Month</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Week">This Week</option>
              <option value="This Year">This Year</option>
              <option value="Custom">Custom Date Range</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          </div>

          {/* Custom Date Inputs */}
          {dateFilter === "Custom" && (
            <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-[#13151f] text-xs shrink-0">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
              />
              <span className="text-gray-400 dark:text-slate-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
              />
            </div>
          )}

          {/* Zero Balances Toggle */}
          <button
            onClick={() => setShowZeroBalances(!showZeroBalances)}
            className={clsx(
              "px-3 py-2 rounded-lg text-xs font-semibold border transition-colors shrink-0",
              showZeroBalances
                ? "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-[#f58220]"
                : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:bg-gray-100"
            )}
          >
            {showZeroBalances ? "Showing All Accounts" : "Non-Zero Only"}
          </button>

          <div className="flex-1" />

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors shrink-0"
            title="Refresh Trial Balance"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-orange-500")} />
          </button>
        </div>

        {/* ── Balance Status Banner (if difference exists) ── */}
        {!isBalanced && !loading && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3.5 sm:p-4 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Debit and credit totals differ by {fmtCurrency(difference)}.</span>
              <p className="text-amber-700/90 dark:text-amber-400/90 text-[11px]">
                Accounts without recorded journal vouchers or equity allocations may account for the variance across the selected date range.
              </p>
            </div>
          </div>
        )}

        {/* ── Main Table Container ── */}
        <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
          
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider truncate">
              General Ledger Account Balances
            </span>
            <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 shrink-0 ml-2">
              {filteredRows.length} accounts listed
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
            {loading ? (
              <div className="py-20 flex flex-col justify-center items-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-[#f58220]" />
                <span className="text-xs font-medium text-gray-400 dark:text-slate-500">Calculating trial balance...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-[11px] font-bold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
                    <th className="px-4 sm:px-6 py-3.5 font-bold whitespace-nowrap">
                      Account / Ledger
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 font-bold text-right whitespace-nowrap">
                      Debit
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 font-bold text-right whitespace-nowrap">
                      Credit
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs font-medium">
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row, idx) => {
                      const hasDebit = (row.debit || 0) > 0;
                      const hasCredit = (row.credit || 0) > 0;

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-orange-50/20 dark:hover:bg-orange-500/5 transition-colors group"
                        >
                          {/* 1. ACCOUNT / LEDGER */}
                          <td className="px-4 sm:px-6 py-3.5 text-gray-900 dark:text-white font-semibold whitespace-nowrap">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-6 w-6 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-slate-300 uppercase shrink-0">
                                {row.name.charAt(0)}
                              </div>
                              <span className="truncate max-w-sm" title={row.name}>
                                {row.name}
                              </span>
                            </div>
                          </td>

                          {/* 2. DEBIT */}
                          <td className="px-4 sm:px-6 py-3.5 text-right font-mono whitespace-nowrap">
                            {hasDebit ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                                {fmtCurrency(row.debit)}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* 3. CREDIT */}
                          <td className="px-4 sm:px-6 py-3.5 text-right font-mono whitespace-nowrap">
                            {hasCredit ? (
                              <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded">
                                {fmtCurrency(row.credit)}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-16 text-center text-xs text-gray-400 dark:text-slate-500"
                      >
                        {searchQuery
                          ? `No ledger accounts match "${searchQuery}".`
                          : "No ledger accounts found for the selected period."}
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* ── Table Footer Totals ── */}
                <tfoot>
                  <tr className="bg-gray-50/90 dark:bg-white/[0.03] border-t-2 border-gray-200 dark:border-white/10 text-xs font-black">
                    <td className="px-4 sm:px-6 py-4 text-gray-900 dark:text-white uppercase tracking-wider">
                      Total
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm font-black">
                      {fmtCurrency(totalDebit)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-mono text-blue-600 dark:text-blue-400 text-sm font-black">
                      {fmtCurrency(totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
