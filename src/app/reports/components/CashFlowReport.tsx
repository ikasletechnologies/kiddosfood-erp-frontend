"use client";

import { useState } from "react";
import { X, Search as SearchIcon } from "lucide-react";

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
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          Reconciling ledger entries and auditing cash flow...
        </p>
      </div>
    );
  }

  const formatPrice = (amount: number) => {
    return `₹ ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const rows = reportData?.rows || [];
  const filteredRows = rows.filter(r => {
    const matchesQuery = String(r.partyName || "").toLowerCase().includes(filterQuery.toLowerCase()) || 
                         String(r.refNo || "").toLowerCase().includes(filterQuery.toLowerCase());
    const matchesZero = showZero ? true : (r.cashIn > 0 || r.cashOut > 0);
    return matchesQuery && matchesZero;
  });

  const totalIn = filteredRows.reduce((acc, r) => acc + (r.cashIn || 0), 0);
  const totalOut = filteredRows.reduce((acc, r) => acc + (r.cashOut || 0), 0);
  const closingCash = totalIn - totalOut;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-5">
        
        {/* Custom Header Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-5 text-xs">
            <span className="font-black text-slate-700 dark:text-slate-350">
              Opening Cash-in Hand: <span className="text-slate-900 dark:text-white font-bold">{formatPrice(0)}</span>
            </span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={showZero} 
                onChange={(e) => setShowZero(e.target.checked)}
                className="w-4 h-4 rounded text-orange-500 border-slate-300 dark:border-slate-700 focus:ring-orange-500 focus:ring-2 dark:bg-slate-800" 
              />
              <span className="text-slate-600 dark:text-slate-400 font-semibold">Show zero amount transaction</span>
            </label>
          </div>

          <div className="relative w-64 max-w-full">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 animate-pulse" />
            <input 
              type="text" 
              placeholder="Search Cash Flow Transactions..." 
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-orange-500"
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
                <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  DATE
                </th>
                <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  REF NO.
                </th>
                <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  NAME
                </th>
                <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  CATEGORY
                </th>
                <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  TYPE
                </th>
                <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">
                  CASH IN
                </th>
                <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">
                  CASH OUT
                </th>
                <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">
                  RUNNING CASH...
                </th>
                <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">
                  PRINT / SHARE
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
              {filteredRows.length > 0 ? (
                filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-350">{row.date}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200">{row.refNo}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-100">{row.partyName}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">{row.category}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">{row.type}</td>
                    <td className="px-4 py-3 text-xs font-bold text-right text-emerald-600 dark:text-emerald-400">
                      {row.cashIn > 0 ? formatPrice(row.cashIn) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-right text-rose-500 dark:text-rose-400">
                      {row.cashOut > 0 ? formatPrice(row.cashOut) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-right text-slate-700 dark:text-slate-200">{formatPrice(row.runningCash)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-right">
                      <button onClick={() => window.print()} className="text-orange-500 hover:underline cursor-pointer select-none">
                        Print
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">
                    No transactions to show
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Summary Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 p-3.5 rounded-xl flex justify-between items-center text-xs">
            <span className="font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Cash-in</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">{formatPrice(totalIn)}</span>
          </div>
          <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/20 p-3.5 rounded-xl flex justify-between items-center text-xs">
            <span className="font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Cash-out</span>
            <span className="text-rose-500 dark:text-rose-400 font-black text-sm">{formatPrice(totalOut)}</span>
          </div>
          <div className="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/20 p-3.5 rounded-xl flex justify-between items-center text-xs">
            <span className="font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Closing Cash-in Hand</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">{formatPrice(closingCash)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
