"use client";

import { useState } from "react";
import {
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  TrendingUp as TrendingUpIcon,
} from "lucide-react";
import { clsx } from "clsx";

interface ReportData {
  kpiValue: string;
  kpiSubText: string;
  kpiTrend?: string;
  rows: Record<string, any>[];
  revenue?: number;
  cogs?: number;
  purchase?: number;
  taxPayable?: number;
  taxReceivable?: number;
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

export default function CentralProfitLossReport({
  reportData,
  loading,
  viewType,
  setViewType,
  expanded,
  setExpanded
}: {
  reportData: ReportData | null;
  loading: boolean;
  viewType: 'vyapar' | 'accounting';
  setViewType: (v: 'vyapar' | 'accounting') => void;
  expanded: any;
  setExpanded: any;
}) {
  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          Calculating financial intelligence & consolidating COGS...
        </p>
      </div>
    );
  }

  const formatPrice = (amount: number) => {
    const absVal = Math.abs(amount || 0);
    return `₹ ${absVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const revenue = reportData?.revenue || 0;
  const cogs = reportData?.cogs || 0;
  const purchase = reportData?.purchase || 0;
  const taxPayable = reportData?.taxPayable || 0;
  const taxReceivable = reportData?.taxReceivable || 0;
  const grossProfit = reportData?.grossProfit || (revenue - cogs);
  const expenses = reportData?.expenses || 0;
  const netProfit = reportData?.netProfit || (grossProfit - expenses);

  const toggleGroup = (key: string) => {
    setExpanded((prev: any) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-6">
      {/* View Switcher Card */}
      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-sm">
        <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none">
          View :
        </span>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <input 
              type="radio" 
              name="plViewType" 
              checked={viewType === 'vyapar'} 
              onChange={() => setViewType('vyapar')}
              className="w-4 h-4 text-orange-500 border-slate-300 focus:ring-orange-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800" 
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-orange-500 transition-colors">
              KiddosFood View
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <input 
              type="radio" 
              name="plViewType" 
              checked={viewType === 'accounting'} 
              onChange={() => setViewType('accounting')}
              className="w-4 h-4 text-orange-500 border-slate-300 focus:ring-orange-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800" 
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-orange-500 transition-colors">
              Accounting View
            </span>
          </label>
        </div>
      </div>

      {/* Main Table / Sheet Card */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 overflow-hidden">
        {viewType === 'vyapar' ? (
          <div className="overflow-x-auto select-text">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-850">
                  <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Particulars
                  </th>
                  <th className="px-4 py-2.5 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right w-44">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                {/* 1. Sale (+) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                    Sale (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-bold text-right text-emerald-600 dark:text-emerald-400">
                    {formatPrice(revenue)}
                  </td>
                </tr>

                {/* 2. Credit Note (-) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                    Credit Note (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-right text-rose-500 dark:text-rose-450">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 3. Sale FA (+) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                    Sale FA (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-right text-emerald-600 dark:text-emerald-400/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 4. Purchase (-) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                    Purchase (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-bold text-right text-rose-500 dark:text-rose-400">
                    {formatPrice(purchase)}
                  </td>
                </tr>

                {/* 5. Debit Note (+) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                    Debit Note (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-right text-emerald-600 dark:text-emerald-400/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 6. Purchase FA (-) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                    Purchase FA (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-right text-rose-500 dark:text-rose-450">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 7. Direct Expenses (-) */}
                <tr 
                  onClick={() => toggleGroup('directExpenses')}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer select-none transition-colors"
                >
                  <td className="px-4 py-2.5 text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 pl-2">
                    {expanded.directExpenses ? <ChevronDownIcon size={13} className="text-slate-400" /> : <ChevronRightIcon size={13} className="text-slate-400" />}
                    Direct Expenses (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-bold text-right text-rose-500 dark:text-rose-455">
                    {formatPrice(0)}
                  </td>
                </tr>

                {expanded.directExpenses && (
                  <>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Direct Expense Item
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Carriage Inward
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Freight charges
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                  </>
                )}

                {/* 8. Tax Payable (Cr) (+) */}
                <tr 
                  onClick={() => toggleGroup('taxPayable')}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer select-none transition-colors"
                >
                  <td className="px-4 py-2.5 text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 pl-2">
                    {expanded.taxPayable ? <ChevronDownIcon size={13} className="text-slate-400" /> : <ChevronRightIcon size={13} className="text-slate-400" />}
                    Tax Payable (Cr) (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-bold text-right text-emerald-600 dark:text-emerald-400">
                    {formatPrice(taxPayable)}
                  </td>
                </tr>

                {expanded.taxPayable && (
                  <>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Output CGST
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-emerald-500 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Output SGST
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-emerald-500 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Output IGST
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-emerald-500 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                  </>
                )}

                {/* 9. Tax Receivable (Dr) (-) */}
                <tr 
                  onClick={() => toggleGroup('taxReceivable')}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer select-none transition-colors"
                >
                  <td className="px-4 py-2.5 text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 pl-2">
                    {expanded.taxReceivable ? <ChevronDownIcon size={13} className="text-slate-400" /> : <ChevronRightIcon size={13} className="text-slate-400" />}
                    Tax Receivable (Dr) (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-bold text-right text-rose-500 dark:text-rose-455">
                    {formatPrice(taxReceivable)}
                  </td>
                </tr>

                {expanded.taxReceivable && (
                  <>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Input CGST
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Input SGST
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Input IGST
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                  </>
                )}

                {/* 10. Gross Profit Total Row */}
                <tr className="bg-slate-100 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 font-bold">
                  <td className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">
                    Gross Profit
                  </td>
                  <td className="px-4 py-3 text-[13px] font-black text-right text-emerald-600 dark:text-emerald-400">
                    {formatPrice(grossProfit)}
                  </td>
                </tr>

                {/* 11. Other Income (+) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-350">
                    Other Income (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-bold text-right text-emerald-600 dark:text-emerald-400">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 12. Indirect Expenses (-) */}
                <tr 
                  onClick={() => toggleGroup('indirectExpenses')}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer select-none transition-colors"
                >
                  <td className="px-4 py-2.5 text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 pl-2">
                    {expanded.indirectExpenses ? <ChevronDownIcon size={13} className="text-slate-400" /> : <ChevronRightIcon size={13} className="text-slate-400" />}
                    Indirect Expenses (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-bold text-right text-rose-500 dark:text-rose-455">
                    {formatPrice(expenses)}
                  </td>
                </tr>

                {expanded.indirectExpenses && (
                  <>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Office Rent Expense
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(expenses)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Bank Interest Expense
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Loan Processing Fee Expense
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-2 text-[13px] font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Loan Charges Expense
                      </td>
                      <td className="px-4 py-2 text-[13px] font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                  </>
                )}

                {/* 14. Net Profit Total Row */}
                <tr className="bg-slate-900 text-white dark:bg-slate-950 dark:text-white border-y-2 border-slate-900 dark:border-slate-955">
                  <td className="px-4 py-3 text-xs font-black uppercase tracking-widest">
                    Net Profit
                  </td>
                  <td className="px-4 py-3 text-[13px] font-black text-right text-emerald-400">
                    {formatPrice(netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* ACCOUNTING STATEMENT VIEW (Traditional P&L Format) */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
            {/* TRADING ACCOUNT SECTION */}
            <div className="space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <TrendingUpIcon size={12} className="text-emerald-500" />
                  Trading Account (Direct Transactions)
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-400">Sales Invoiced (Revenue)</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatPrice(revenue)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-850 pb-2">
                  <span className="font-bold text-slate-600 dark:text-slate-400">(-) Cost of Goods Sold (Recipe/Materials)</span>
                  <span className="font-extrabold text-rose-500 dark:text-rose-450">{formatPrice(cogs)}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-black bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800">
                  <span className="uppercase tracking-widest">Gross Trading Profit (Margin)</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatPrice(grossProfit)}</span>
                </div>
              </div>
            </div>

            {/* PROFIT & LOSS ACCOUNT SECTION */}
            <div className="space-y-6 pt-6 lg:pt-0 lg:pl-8">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <TrendingUpIcon size={12} className="text-emerald-500" />
                  Profit & Loss Account (Overheads)
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-400">Gross Trading Profit b/d</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatPrice(grossProfit)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-400">(+) Other Operating Incomes</span>
                  <span className="font-extrabold text-emerald-500 dark:text-emerald-400">{formatPrice(0)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-850 pb-2">
                  <span className="font-bold text-slate-600 dark:text-slate-400">(-) Indirect/Operational Expenses</span>
                  <span className="font-extrabold text-rose-500 dark:text-rose-450">{formatPrice(expenses)}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs font-black bg-slate-900 text-white dark:bg-slate-950 p-3 rounded-lg border border-slate-900">
                  <span className="uppercase tracking-widest">Net Operating Earnings</span>
                  <span className="text-emerald-400">{formatPrice(netProfit)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
