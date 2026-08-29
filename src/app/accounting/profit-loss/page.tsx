'use client';

import React, { useEffect, useState, useRef } from 'react';
import { reportsApi } from '@/lib/api';
import { 
  TrendingUp, 
  TrendingDown, 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  ChevronRight, 
  ChevronDown, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { cn } from "@/lib/utils";

// Expandable Section Interface
interface ExpandableState {
  directExpenses: boolean;
  taxPayable: boolean;
  taxReceivable: boolean;
  indirectExpenses: boolean;
}

export default function ProfitLossPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<'vyapar' | 'accounting'>('vyapar');
  
  // Date Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Expandable groups
  const [expanded, setExpanded] = useState<ExpandableState>({
    directExpenses: true,
    taxPayable: true,
    taxReceivable: true,
    indirectExpenses: true,
  });

  // Ref for printing
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch detailed Profit and Loss from backend
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await reportsApi.getDetailedProfit({ startDate, endDate });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch detailed P&L data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const toggleGroup = (key: keyof ExpandableState) => {
    setExpanded(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Safe formatting helper to match Vyapar design exactly
  const formatPrice = (amount: number) => {
    const absVal = Math.abs(amount || 0);
    return `₹ ${absVal.toFixed(2)}`;
  };

  // Safe parsing of numbers
  const revenue = data?.revenue || 0;
  const cogs = data?.cogs || 0;
  const grossProfit = data?.grossProfit || (revenue - cogs);
  const expenses = data?.expenses || 0;
  const netProfit = data?.netProfit || (grossProfit - expenses);

  // Handler for Exporting to CSV (Excel compatible)
  const handleExportCSV = () => {
    const rows = [
      ["PROFIT AND LOSS REPORT"],
      [`Period: From ${startDate} To ${endDate}`],
      [],
      ["Particulars", "Amount"],
      ["Sale (+)", revenue.toFixed(2)],
      ["Credit Note (-)", "0.00"],
      ["Sale FA (+)", "0.00"],
      ["Purchase (-)", cogs.toFixed(2)],
      ["Debit Note (+)", "0.00"],
      ["Purchase FA (-)", "0.00"],
      ["Direct Expenses (-)", "0.00"],
      ["  Other Direct Expenses (-)", "0.00"],
      ["  Payment-in Discount (-)", "0.00"],
      ["Tax Payable (-)", "0.00"],
      ["  GST Payable (-)", "0.00"],
      ["  TCS Payable (-)", "0.00"],
      ["  TDS Payable (-)", "0.00"],
      ["Tax Receivable (+)", "0.00"],
      ["  GST Receivable (+)", "0.00"],
      ["  TCS Receivable (+)", "0.00"],
      ["  TDS Receivable (+)", "0.00"],
      ["Opening Stock (-)", "0.00"],
      ["Closing Stock (+)", "0.00"],
      ["Opening Stock FA (-)", "0.00"],
      ["Closing Stock FA (+)", "0.00"],
      ["Gross Profit", grossProfit.toFixed(2)],
      ["Other Income (+)", "0.00"],
      ["Indirect Expenses (-)", expenses.toFixed(2)],
      ["  Other Expense", expenses.toFixed(2)],
      ["  Loan Interest Expense", "0.00"],
      ["  Loan Processing Fee Expense", "0.00"],
      ["  Loan Charges Expense", "0.00"],
      ["Net Profit", netProfit.toFixed(2)]
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Profit_Loss_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 print:bg-white print:p-0 w-full min-w-0">
      
      {/* Header controls (hidden on Print) */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center print:hidden border-b border-slate-200 dark:border-slate-800 pb-5 w-full min-w-0">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">
              Profit and Loss Report
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 shrink-0">
              <Sparkles size={12} className="animate-pulse" /> Live Audit
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time corporate performance auditing and margin tracking
          </p>
        </div>

        {/* Date Filter & Export Row */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Custom Styled Date Pickers to match Vyapar */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm">
            <div className="flex items-center px-2 text-slate-400">
              <Calendar size={14} />
            </div>
            <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider pl-1 select-none">From</span>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-bold outline-none cursor-pointer w-28 sm:w-32"
              />
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-400 text-[11px] uppercase tracking-wider select-none">To</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-bold outline-none cursor-pointer w-28 sm:w-32"
              />
            </div>
          </div>

          {/* Export / Print Action Buttons */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <button 
              onClick={handleExportCSV}
              title="Export Excel / CSV"
              className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 shadow-sm transition-all duration-150 active:scale-95"
            >
              <FileSpreadsheet size={16} />
            </button>
            <button 
              onClick={handlePrint}
              title="Print Statement"
              className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 shadow-sm transition-all duration-150 active:scale-95"
            >
              <Printer size={16} />
            </button>
            <button 
              onClick={fetchData}
              title="Refresh Data"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* View Switcher (hidden on Print) */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-3 rounded-xl shadow-sm print:hidden w-full min-w-0">
        <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
          View :
        </span>
        <div className="flex items-center gap-4 sm:gap-6">
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <input 
              type="radio" 
              name="viewType" 
              checked={viewType === 'vyapar'} 
              onChange={() => setViewType('vyapar')}
              className="w-4 h-4 text-orange-500 border-slate-300 focus:ring-orange-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-700" 
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-orange-500 transition-colors">
              KiddosFood View
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <input 
              type="radio" 
              name="viewType" 
              checked={viewType === 'accounting'} 
              onChange={() => setViewType('accounting')}
              className="w-4 h-4 text-orange-500 border-slate-300 focus:ring-orange-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-700" 
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-orange-500 transition-colors">
              Accounting View
            </span>
          </label>
        </div>
      </div>

      {/* Main Report Container */}
      <div 
        ref={printRef}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden p-4 sm:p-6 print:border-none print:shadow-none print:p-0 w-full min-w-0"
      >
        
        {/* Print Header Block */}
        <div className="hidden print:block text-center mb-8 border-b-2 border-slate-900 pb-5">
          <h1 className="text-2xl font-black uppercase text-slate-900">PROFIT & LOSS STATEMENT</h1>
          <p className="text-sm font-bold text-slate-600 mt-1">Financial Period: {startDate} To {endDate}</p>
          <div className="text-[10px] text-slate-400 mt-2">Generated on {new Date().toLocaleString()} | Enterprise Audit System</div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
              Computing Ledger Balances & Consolidating COGS...
            </p>
          </div>
        ) : viewType === 'vyapar' ? (
          
          /* =========================================================================
             VYAPAR SHEET VIEW
             ========================================================================= */
          <div className="overflow-x-auto custom-scrollbar w-full max-w-full select-text">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-700/60">
                  <th className="px-4 py-3 text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Particulars
                  </th>
                  <th className="px-4 py-3 text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right w-44">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                
                {/* 1. Sale (+) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200 pl-4">
                    Sale (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-right text-emerald-600 dark:text-emerald-400">
                    {formatPrice(revenue)}
                  </td>
                </tr>

                {/* 2. Credit Note (-) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Credit Note (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-right text-rose-500 dark:text-rose-400/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 3. Sale FA (+) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Sale FA (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-right text-emerald-600 dark:text-emerald-500/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 4. Purchase (-) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Purchase (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-right text-rose-500 dark:text-rose-400">
                    {formatPrice(cogs)}
                  </td>
                </tr>

                {/* 5. Debit Note (+) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Debit Note (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-right text-emerald-600 dark:text-emerald-500/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 6. Purchase FA (-) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Purchase FA (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-right text-rose-500 dark:text-rose-400/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 7. Direct Expenses (-) */}
                <tr 
                  onClick={() => toggleGroup('directExpenses')}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer select-none transition-colors"
                >
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    {expanded.directExpenses ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    Direct Expenses (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-right text-rose-500 dark:text-rose-400">
                    {formatPrice(0)}
                  </td>
                </tr>

                {expanded.directExpenses && (
                  <>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Other Direct Expenses (-)
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Payment-in Discount (-)
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                  </>
                )}

                {/* 8. Tax Payable (-) */}
                <tr 
                  onClick={() => toggleGroup('taxPayable')}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer select-none transition-colors"
                >
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    {expanded.taxPayable ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    Tax Payable (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-right text-rose-500 dark:text-rose-400">
                    {formatPrice(0)}
                  </td>
                </tr>

                {expanded.taxPayable && (
                  <>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        GST Payable (-)
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        TCS Payable (-)
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        TDS Payable (-)
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                  </>
                )}

                {/* 9. Tax Receivable (+) */}
                <tr 
                  onClick={() => toggleGroup('taxReceivable')}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer select-none transition-colors"
                >
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    {expanded.taxReceivable ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    Tax Receivable (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-right text-emerald-600 dark:text-emerald-400">
                    {formatPrice(0)}
                  </td>
                </tr>

                {expanded.taxReceivable && (
                  <>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        GST Receivable (+)
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-emerald-500 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        TCS Receivable (+)
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-emerald-500 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        TDS Receivable (+)
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-emerald-500 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                  </>
                )}

                {/* 10. Stock & FA */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Opening Stock (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-right text-rose-500 dark:text-rose-400/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Closing Stock (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-right text-emerald-600 dark:text-emerald-500/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Opening Stock FA (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-right text-rose-500 dark:text-rose-400/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Closing Stock FA (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-right text-emerald-600 dark:text-emerald-500/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 11. GROSS PROFIT TOTAL ROW */}
                <tr className="bg-slate-100/50 dark:bg-slate-900 border-y-2 border-slate-300 dark:border-slate-700">
                  <td className="px-4 py-3 text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Gross Profit
                  </td>
                  <td className="px-4 py-3 text-sm font-black text-right text-emerald-600 dark:text-emerald-400">
                    {formatPrice(grossProfit)}
                  </td>
                </tr>

                {/* 12. Other Income (+) */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Other Income (+)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-semibold text-right text-emerald-600 dark:text-emerald-500/80">
                    {formatPrice(0)}
                  </td>
                </tr>

                {/* 13. Indirect Expenses (-) */}
                <tr 
                  onClick={() => toggleGroup('indirectExpenses')}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer select-none transition-colors"
                >
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    {expanded.indirectExpenses ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    Indirect Expenses (-)
                  </td>
                  <td className="px-4 py-2.5 text-[13px] sm:text-sm font-bold text-right text-rose-500 dark:text-rose-400">
                    {formatPrice(expenses)}
                  </td>
                </tr>

                {expanded.indirectExpenses && (
                  <>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Other Expense
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(expenses)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Loan Interest Expense
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Loan Processing Fee Expense
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 pl-8">
                        Loan Charges Expense
                      </td>
                      <td className="px-4 py-2 text-[13px] sm:text-sm font-semibold text-right text-rose-400 pl-8">
                        {formatPrice(0)}
                      </td>
                    </tr>
                  </>
                )}

                {/* 14. NET PROFIT TOTAL ROW */}
                <tr className="bg-slate-900 text-white dark:bg-slate-950 dark:text-white border-y-2 border-slate-900 dark:border-slate-950">
                  <td className="px-4 py-3.5 text-sm font-black uppercase tracking-wider">
                    Net Profit
                  </td>
                  <td className="px-4 py-3.5 text-sm font-black text-right text-emerald-400">
                    {formatPrice(netProfit)}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        ) : (
          
          /* =========================================================================
             ACCOUNTING STATEMENT VIEW (Traditional P&L Format)
             ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-700">
            
            {/* TRADING ACCOUNT SECTION */}
            <div className="space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <TrendingDown size={14} className="text-rose-500" />
                  Part I: Trading Account (Direct Debits / Sales)
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Sales Invoiced (Revenue)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(revenue)}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">(-) Cost of Goods Sold (Recipe / Materials consumed)</span>
                  <span className="font-bold text-rose-500 dark:text-rose-400">{formatPrice(cogs)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-black bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="uppercase text-xs tracking-wider">Gross Trading Profit (Margin)</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatPrice(grossProfit)}</span>
                </div>
              </div>
            </div>

            {/* PROFIT & LOSS ACCOUNT SECTION */}
            <div className="space-y-6 pt-6 lg:pt-0 lg:pl-8">
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-500" />
                  Part II: Profit & Loss A/c (Operational Overhead)
                </h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Gross Trading Profit b/d</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(grossProfit)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">(+) Other Operating Incomes</span>
                  <span className="font-bold text-emerald-500 dark:text-emerald-400">{formatPrice(0)}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">(-) Indirect/Operational Expenses</span>
                  <span className="font-bold text-rose-500 dark:text-rose-400">{formatPrice(expenses)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm font-black bg-slate-900 text-white dark:bg-slate-950 p-3 rounded-lg border border-slate-900">
                  <span className="uppercase text-xs tracking-wider">Net Operating Earnings</span>
                  <span className="text-emerald-400">{formatPrice(netProfit)}</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Signature & Audit Stamp (Visible on Print ONLY) */}
        <div className="hidden print:flex justify-between items-end mt-16 pt-8 border-t border-slate-300">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Verified By</p>
            <div className="w-48 border-b border-slate-400 mt-8" />
            <p className="text-[10px] text-slate-500 mt-1">Authorized Chartered Accountant</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Stamp & Seal</p>
            <div className="w-32 h-20 border border-slate-300 border-dashed rounded mt-2 flex items-center justify-center text-[10px] text-slate-300">
              AFFIX SEAL HERE
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
