"use client";

import { useState } from "react";
import { X, Search as SearchIcon, Printer } from "lucide-react";
import { clsx } from "clsx";

interface ReportData {
  kpiValue: string;
  kpiSubText: string;
  kpiTrend?: string;
  rows: Record<string, any>[];
  revenue?: number;
  cogs?: number;
  grossProfit?: number;
  expenses?: number;
  netProfit?: number;
  totalSales?: number;
  totalProfit?: number;
  cashIn?: number;
  cashOut?: number;
  totalDebit?: number;
  totalCredit?: number;
}

export default function CentralCashFlowReport({
  reportData,
  loading
}: {
  reportData: ReportData | null;
  loading: boolean;
}) {
  const [filterQuery, setFilterQuery] = useState("");
  const [showZero, setShowZero] = useState(false);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 animate-pulse">
          Reconciling ledger entries and auditing cash flow...
        </p>
      </div>
    );
  }

  const formatPrice = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const rows = reportData?.rows || [];
  const filteredRows = rows.filter(r => {
    const matchesQuery = String(r.partyName || "").toLowerCase().includes(filterQuery.toLowerCase()) || 
                         String(r.refNo || "").toLowerCase().includes(filterQuery.toLowerCase());
    const matchesZero = showZero ? true : ((r.cashIn || 0) > 0 || (r.cashOut || 0) > 0);
    return matchesQuery && matchesZero;
  });

  const totalIn = filteredRows.reduce((acc, r) => acc + (Number(r.cashIn) || 0), 0);
  const totalOut = filteredRows.reduce((acc, r) => acc + (Number(r.cashOut) || 0), 0);
  const closingCash = totalIn - totalOut;

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl shadow-2xs p-4 sm:p-5 space-y-4 sm:space-y-5 w-full min-w-0">
        
        {/* Custom Header Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100 dark:border-white/5 w-full min-w-0">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs">
            <span className="font-bold text-gray-700 dark:text-slate-300">
              Opening Cash: <span className="text-gray-900 dark:text-white font-bold font-mono">{formatPrice(0)}</span>
            </span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={showZero} 
                onChange={(e) => setShowZero(e.target.checked)}
                className="w-4 h-4 rounded text-[#f58220] border-gray-300 dark:border-white/20 focus:ring-orange-500 cursor-pointer" 
              />
              <span className="text-gray-600 dark:text-slate-400 font-semibold text-xs">Show zero amount entries</span>
            </label>
          </div>

          <div className="relative w-full sm:w-64 max-w-full min-w-0">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input 
              type="text" 
              placeholder="Search party or ref..." 
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#f58220]"
            />
            {filterQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setFilterQuery("")} 
              />
            )}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                <th className="px-4 py-3">DATE</th>
                <th className="px-4 py-3">REF NO.</th>
                <th className="px-4 py-3">NAME</th>
                <th className="px-4 py-3">CATEGORY</th>
                <th className="px-4 py-3">TYPE</th>
                <th className="px-4 py-3 text-right">CASH IN</th>
                <th className="px-4 py-3 text-right">CASH OUT</th>
                <th className="px-4 py-3 text-right">RUNNING CASH</th>
                <th className="px-4 py-3 text-right">PRINT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
              {filteredRows.length > 0 ? (
                filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-400">{row.date}</td>
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 dark:text-white">{row.refNo}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-slate-100 truncate max-w-[180px]">{row.partyName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{row.category}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{row.type}</td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-emerald-600 dark:text-emerald-400">
                      {row.cashIn > 0 ? formatPrice(row.cashIn) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-rose-500 dark:text-rose-400">
                      {row.cashOut > 0 ? formatPrice(row.cashOut) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-right text-gray-800 dark:text-white">{formatPrice(row.runningCash || 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => window.print()} className="p-1 text-[#f58220] hover:text-[#e8740e] cursor-pointer inline-flex items-center" title="Print Row">
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400 dark:text-slate-500 font-semibold">
                    No cash flow transactions to show
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Summary Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-gray-100 dark:border-white/5 w-full min-w-0">
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3.5 rounded-xl flex justify-between items-center text-xs">
            <span className="font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Total Cash-in</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-sm">{formatPrice(totalIn)}</span>
          </div>
          <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3.5 rounded-xl flex justify-between items-center text-xs">
            <span className="font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Total Cash-out</span>
            <span className="text-rose-500 dark:text-rose-400 font-bold font-mono text-sm">{formatPrice(totalOut)}</span>
          </div>
          <div className={clsx(
            "p-3.5 rounded-xl flex justify-between items-center text-xs border",
            closingCash >= 0
              ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
              : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30"
          )}>
            <span className="font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Net Cash Position</span>
            <span className={clsx("font-bold font-mono text-sm", closingCash >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {formatPrice(closingCash)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
