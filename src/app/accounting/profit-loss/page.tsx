'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { reportsApi } from '@/lib/api';
import { 
  TrendingUp, 
  TrendingDown, 
  Printer, 
  FileSpreadsheet,
  Search,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  X,
  PieChart
} from 'lucide-react';
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { exportReportToExcel } from "@/lib/excelExport";

// Currency Formatter
const fmtCurrency = (val: number | string | undefined | null) => {
  const num = Number(val || 0);
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Date Presets Helper
const getDateRange = (preset: string, customStart?: string, customEnd?: string) => {
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
    case "Last Month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case "This Quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), qMonth, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999);
      break;
    }
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

interface AccountRow {
  name: string;
  category: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  isBold?: boolean;
}

export default function ProfitLossPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Date Filter State
  const [dateFilter, setDateFilter] = useState("This Month");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Fetch detailed Profit and Loss from backend
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
      const res = await reportsApi.getDetailedProfit({ startDate: from, endDate: to });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch detailed P&L data', err);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Financial values from source of truth
  const revenue = Number(data?.totalRevenue || data?.revenue || 0);
  const otherIncome = Number(data?.otherIncome || 0);
  const taxReceivable = Number(data?.taxReceivable || 0);
  const totalIncome = revenue + otherIncome + taxReceivable;

  const cogs = Number(data?.cogs || data?.purchase || 0);
  const directExpenses = Number(data?.directExpenses || 0);
  const indirectExpenses = Number(data?.indirectExpenses || data?.expenses || data?.totalExpenses || 0);
  const taxPayable = Number(data?.taxPayable ?? data?.tax ?? 0);
  const totalExpenses = cogs + directExpenses + indirectExpenses + taxPayable;

  const grossProfit = Number(data?.grossProfit ?? (revenue - cogs));
  const netProfit = Number(data?.netProfit ?? (totalIncome - totalExpenses));

  const marginPercentage = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : "0.0";
  const grossMarginPercentage = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0.0";

  // Build Structured Income Rows
  const incomeRows: AccountRow[] = useMemo(() => {
    const list: AccountRow[] = [
      { name: "Sales Revenue (Tax Exclusive)", category: "Operating Revenue", amount: revenue, type: "INCOME" },
      { name: "Other Operating Income", category: "Other Income", amount: otherIncome, type: "INCOME" },
    ];
    if (taxReceivable > 0) {
      list.push({ name: "GST Input Tax Credit / Receivable", category: "Tax Credit", amount: taxReceivable, type: "INCOME" });
    }
    return list;
  }, [revenue, otherIncome, taxReceivable]);

  // Build Structured Expense Rows
  const expenseRows: AccountRow[] = useMemo(() => {
    const list: AccountRow[] = [
      { name: "Cost of Goods Sold (COGS) / Purchases", category: "Direct Cost", amount: cogs, type: "EXPENSE" },
    ];
    if (directExpenses > 0) {
      list.push({ name: "Direct Operating Expenses", category: "Direct Expense", amount: directExpenses, type: "EXPENSE" });
    }
    list.push({ name: "Indirect & Operational Expenses", category: "Overheads", amount: indirectExpenses, type: "EXPENSE" });
    if (taxPayable > 0) {
      list.push({ name: "GST Output Tax Payable", category: "Tax Liability", amount: taxPayable, type: "EXPENSE" });
    }
    return list;
  }, [cogs, directExpenses, indirectExpenses, taxPayable]);

  // Filtered Rows for Search
  const filteredIncomeRows = useMemo(() => {
    if (!searchQuery.trim()) return incomeRows;
    const q = searchQuery.toLowerCase().trim();
    return incomeRows.filter(r => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [incomeRows, searchQuery]);

  const filteredExpenseRows = useMemo(() => {
    if (!searchQuery.trim()) return expenseRows;
    const q = searchQuery.toLowerCase().trim();
    return expenseRows.filter(r => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [expenseRows, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const columns = [
      { header: "Type", key: "type" },
      { header: "Category", key: "category" },
      { header: "Account / Particulars", key: "name" },
      { header: "Amount (₹)", key: "amount", format: "currency" as const },
    ];

    const data: Record<string, any>[] = [
      ...filteredIncomeRows.map((r) => ({
        type: "INCOME",
        category: r.category,
        name: r.name,
        amount: r.amount,
      })),
      ...filteredExpenseRows.map((r) => ({
        type: "EXPENSE",
        category: r.category,
        name: r.name,
        amount: r.amount,
      })),
    ];

    if (data.length === 0) {
      toast.error("No entries to export");
      return;
    }

    exportReportToExcel({
      filename: `Profit-and-Loss_${dateFilter.replace(/\s+/g, "-")}.xlsx`,
      sheetName: "Profit & Loss",
      title: "Profit & Loss Statement",
      subtitle: `${activeFrom} to ${activeTo}`,
      columns,
      data,
      totals: {
        name: `Net Profit: ₹${netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        amount: netProfit,
      },
    });

    toast.success("Exported Profit & Loss to Excel");
  };

  const { from: activeFrom, to: activeTo } = getDateRange(dateFilter, customStartDate, customEndDate);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#020617] text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">
      
      {/* ── Clean ERP Top Header ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs w-full min-w-0 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
            Profit &amp; Loss
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            title="Excel Report"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Excel Report</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            title="Print Profit & Loss Statement"
          >
            <Printer className="h-4 w-4 text-gray-500 dark:text-slate-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">

        {/* ── Top Summary / KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 w-full min-w-0">
          {/* Card 1: TOTAL INCOME */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Income
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(totalIncome)}
              </div>
              <div className="text-[11px] font-medium text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                Sales: {fmtCurrency(revenue)}
              </div>
            </div>
          </div>

          {/* Card 2: TOTAL EXPENSES */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-50 dark:ring-rose-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Expenses
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(totalExpenses)}
              </div>
              <div className="text-[11px] font-medium text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                COGS: {fmtCurrency(cogs)}
              </div>
            </div>
          </div>

          {/* Card 3: NET PROFIT / LOSS */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className={clsx(
              "w-2.5 h-2.5 rounded-full shrink-0",
              netProfit >= 0
                ? "bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-500/20"
                : "bg-rose-500 ring-4 ring-rose-50 dark:ring-rose-500/20"
            )} />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                {netProfit >= 0 ? "Net Profit" : "Net Loss"}
              </div>
              <div className={clsx(
                "text-xl sm:text-2xl font-black font-mono tracking-tight mt-1 truncate",
                netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}>
                {loading ? "..." : fmtCurrency(Math.abs(netProfit))}
              </div>
              <div className="text-[11px] font-medium text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                Margin: {marginPercentage}%
              </div>
            </div>
          </div>
        </div>

        {/* ── Toolbar: Search & Date Filter ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-card border border-gray-200 dark:border-white/5 p-3 sm:p-3.5 rounded-xl shadow-2xs print:hidden w-full min-w-0">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search account / category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-[#f58220]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Date Preset Filter */}
            <div className="relative shrink-0">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220]"
              >
                <option value="Today" className="dark:bg-card">Today</option>
                <option value="Yesterday" className="dark:bg-card">Yesterday</option>
                <option value="This Week" className="dark:bg-card">This Week</option>
                <option value="This Month" className="dark:bg-card">This Month</option>
                <option value="Last Month" className="dark:bg-card">Last Month</option>
                <option value="This Quarter" className="dark:bg-card">This Quarter</option>
                <option value="This Year" className="dark:bg-card">This Year</option>
                <option value="Custom" className="dark:bg-card">Custom Date Range</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>

            {/* Custom Date Pickers */}
            {dateFilter === "Custom" && (
              <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-[#13151f] text-xs shrink-0">
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
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchData}
              title="Refresh Data"
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <RotateCcw className={clsx("h-4 w-4", loading && "animate-spin text-orange-500")} />
            </button>
          </div>
        </div>

        {/* ── Print Statement Header (Hidden on screen, visible on Print) ── */}
        <div className="hidden print:block text-center border-b border-gray-300 pb-4 mb-4">
          <h2 className="text-2xl font-bold uppercase tracking-tight text-gray-900">Profit &amp; Loss Statement</h2>
          <p className="text-xs font-semibold text-gray-600 mt-1">Period: {activeFrom} to {activeTo}</p>
        </div>

        {/* ── Main Structured Profit & Loss Content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full min-w-0">
          
          {/* ═══════════════════════════════════════════
              1. INCOME & REVENUE SECTION
              ═══════════════════════════════════════════ */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs flex flex-col justify-between min-w-0">
            <div>
              <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-emerald-50/40 dark:bg-emerald-500/5">
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider truncate">
                    Income / Revenue
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                  {fmtCurrency(totalIncome)}
                </span>
              </div>

              <div className="overflow-x-auto custom-scrollbar w-full">
                <table className="w-full text-left text-xs font-medium min-w-[320px]">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-[11px] font-bold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
                      <th className="px-4 sm:px-5 py-3">Account / Particulars</th>
                      <th className="px-4 sm:px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                          Loading revenue accounts...
                        </td>
                      </tr>
                    ) : filteredIncomeRows.length > 0 ? (
                      filteredIncomeRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 sm:px-5 py-3 text-gray-800 dark:text-slate-200">
                            <div className="font-semibold text-gray-900 dark:text-white truncate">{row.name}</div>
                            <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{row.category}</div>
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {fmtCurrency(row.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-center text-gray-400 dark:text-slate-500 text-xs">
                          No matching income accounts found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Income Subtotal Footer */}
            <div className="px-4 sm:px-5 py-3.5 border-t border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.02] flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Total Income
              </span>
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                {fmtCurrency(totalIncome)}
              </span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              2. EXPENSES SECTION
              ═══════════════════════════════════════════ */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs flex flex-col justify-between min-w-0">
            <div>
              <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-rose-50/40 dark:bg-rose-500/5">
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowDownRight className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider truncate">
                    Expenses &amp; Direct Costs
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-400 shrink-0">
                  {fmtCurrency(totalExpenses)}
                </span>
              </div>

              <div className="overflow-x-auto custom-scrollbar w-full">
                <table className="w-full text-left text-xs font-medium min-w-[320px]">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-[11px] font-bold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
                      <th className="px-4 sm:px-5 py-3">Account / Particulars</th>
                      <th className="px-4 sm:px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">
                          Loading expense accounts...
                        </td>
                      </tr>
                    ) : filteredExpenseRows.length > 0 ? (
                      filteredExpenseRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 sm:px-5 py-3 text-gray-800 dark:text-slate-200">
                            <div className="font-semibold text-gray-900 dark:text-white truncate">{row.name}</div>
                            <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{row.category}</div>
                          </td>
                          <td className="px-4 sm:px-5 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {fmtCurrency(row.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-center text-gray-400 dark:text-slate-500 text-xs">
                          No matching expense accounts found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses Subtotal Footer */}
            <div className="px-4 sm:px-5 py-3.5 border-t border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.02] flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                Total Expenses
              </span>
              <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
                {fmtCurrency(totalExpenses)}
              </span>
            </div>
          </div>

        </div>

        {/* ── Net Operating Summary Card ── */}
        <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-2xs w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Margin Metrics */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-lg shrink-0">
                  <PieChart className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    Gross Profit (Margin)
                  </div>
                  <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-mono mt-0.5">
                    {fmtCurrency(grossProfit)} <span className="text-xs text-gray-400 font-normal">({grossMarginPercentage}%)</span>
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200 dark:bg-white/10 hidden sm:block" />

              <div className="flex items-center gap-2.5 min-w-0">
                <div className={clsx(
                  "p-2 rounded-lg shrink-0",
                  netProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600"
                )}>
                  <DollarSign className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    Net Profit Margin
                  </div>
                  <div className={clsx(
                    "text-sm sm:text-base font-bold font-mono mt-0.5",
                    netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}>
                    {marginPercentage}%
                  </div>
                </div>
              </div>
            </div>

            {/* Net Total Highlighting */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-white/5">
              <div className="text-right">
                <div className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Final Net Result
                </div>
                <div className={clsx(
                  "text-lg sm:text-xl font-black font-mono tracking-tight",
                  netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}>
                  {netProfit >= 0 ? "+ " : "- "}{fmtCurrency(Math.abs(netProfit))}
                </div>
              </div>
              <span className={clsx(
                "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider shrink-0",
                netProfit >= 0
                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
              )}>
                {netProfit >= 0 ? "Profitable" : "Net Loss"}
              </span>
            </div>

          </div>
        </div>

        {/* ── Signature & Stamp (Visible on Print ONLY) ── */}
        <div className="hidden print:flex justify-between items-end mt-16 pt-8 border-t border-gray-400">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Prepared &amp; Verified By</p>
            <div className="w-48 border-b border-gray-600 mt-8" />
            <p className="text-[10px] text-gray-500 mt-1">Authorized Accountant</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Stamp &amp; Seal</p>
            <div className="w-32 h-16 border border-gray-400 border-dashed rounded mt-2 flex items-center justify-center text-[10px] text-gray-400">
              AFFIX SEAL HERE
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
