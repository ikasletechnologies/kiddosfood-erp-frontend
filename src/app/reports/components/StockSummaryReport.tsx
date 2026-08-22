"use client";

import React, { useState, useEffect } from "react";
import {
  SearchIcon, FileTextIcon, PrinterIcon, ChevronDownIcon,
  AlertCircleIcon, PackageIcon, TrendingUpIcon, CalculatorIcon
} from "lucide-react";
import * as XLSX from "xlsx";
import { reportsApi } from "@/lib/api/accounting.api";

interface StockRow {
  itemName: string;
  salePrice: number;
  purchasePrice: number;
  stockQty: number;
  stockValue: number;
}

const CATEGORY_OPTIONS = [
  { value: "ALL", label: "All Categories" },
  { value: "RAW_MATERIAL", label: "Raw Material" },
  { value: "SEMI_FINISHED", label: "Semi Finished" },
  { value: "FINISHED_GOOD", label: "Finished Good" },
  { value: "PACKAGING", label: "Packaging" },
];

export default function StockSummaryReport() {
  const [reportData, setReportData] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [category, setCategory] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Uses the newly registered endpoint /api/reports/stock-summary
        const res = await reportsApi.getStockSummary({
          category: category !== "ALL" ? category : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        // Fallback to stock-summary service or fallback response
        const data = await res.data;

        // If the return is not an array (e.g. wrapper), try to extract array
        const rows = Array.isArray(data) ? data : (data?.rows || []);

        // Match the columns expected: Item Name, Sale Price, Purchase Price, Stock Qty, Stock Value
        const formatted = rows.map((r: any) => ({
          itemName: r.itemName || r.name || "—",
          salePrice: Number(r.salePrice ?? r.customerPrice ?? r.basePrice ?? 0),
          purchasePrice: Number(r.purchasePrice ?? r.costPrice ?? 0),
          stockQty: Number(r.stockQty ?? r.currentStock ?? 0),
          stockValue: Number(r.stockValue ?? 0)
        }));

        setReportData(formatted);
      } catch (err) {
        console.error(err);
        setReportData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [category, startDate, endDate]);

  const filtered = reportData.filter(row => {
    const matchesSearch = row.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesInStock = showInStockOnly ? row.stockQty > 0 : true;
    return matchesSearch && matchesInStock;
  });

  const totalStockQty = filtered.reduce((sum, r) => sum + r.stockQty, 0);
  const totalStockValue = filtered.reduce((sum, r) => sum + r.stockValue, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const headers = ["Item Name", "Sale Price", "Purchase Price", "Stock Qty", "Stock Value"];
    const rows = filtered.map(r => [
      r.itemName,
      r.salePrice,
      r.purchasePrice,
      r.stockQty,
      r.stockValue
    ]);
    const totalsRow = ["Total", "", "", totalStockQty, totalStockValue];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totalsRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Summary");
    XLSX.writeFile(wb, `Stock_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-y-auto">
      {/* Filters Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none flex items-center gap-2 pl-4 pr-8 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200/60 dark:border-slate-700 outline-none cursor-pointer focus:border-orange-500"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDownIcon size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200/60 dark:border-slate-700 outline-none focus:border-orange-500"
            />
            <span className="text-xs font-bold text-slate-400">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200/60 dark:border-slate-700 outline-none focus:border-orange-500"
            />
          </div>

          {/* Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={showInStockOnly}
              onChange={(e) => setShowInStockOnly(e.target.checked)}
              className="w-4 h-4 rounded text-orange-500 border-slate-300 focus:ring-orange-500"
            />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Show items in stock</span>
          </label>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:flex-initial">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full md:w-64 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <button
            onClick={handleExportExcel}
            className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 rounded-xl transition-all border border-emerald-100 dark:border-emerald-900/50"
            title="Excel Export"
          >
            <FileTextIcon size={16} />
          </button>
          <button 
            onClick={handlePrint}
            className="p-2 bg-orange-50 dark:bg-orange-950/20 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-950/40 rounded-xl transition-all border border-orange-100 dark:border-orange-900/50"
            title="Print"
          >
            <PrinterIcon size={16} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#12141c] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-orange-50 dark:bg-orange-950/20 text-orange-600 rounded-xl">
            <PackageIcon size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Items Listed</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{filtered.length}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12141c] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-sky-50 dark:bg-sky-950/20 text-sky-600 rounded-xl">
            <TrendingUpIcon size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Stock Qty</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{totalStockQty}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12141c] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-xl">
            <CalculatorIcon size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Stock Value</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">₹ {totalStockValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Stock Valuation Ledger</h3>
        </div>

        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="p-8 space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              ))}
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item Name</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Sale Price</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Purchase Price</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Stock Qty</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((row, idx) => (
                    <tr 
                      key={idx}
                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors"
                    >
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-slate-200">{row.itemName}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">₹ {row.salePrice.toFixed(2)}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">₹ {row.purchasePrice.toFixed(2)}</td>
                      <td className={`px-6 py-4 text-xs font-black text-right ${row.stockQty < 0 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {row.stockQty}
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-slate-800 dark:text-white text-right">₹ {row.stockValue.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircleIcon size={24} className="opacity-40" />
                        <span className="text-xs font-bold">No items found matching criteria.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals Summary Footer */}
        {!loading && filtered.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between shrink-0 font-black text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <span>Total</span>
            <div className="flex items-center gap-8">
              <span>Qty: <strong className="text-slate-900 dark:text-white text-sm font-black">{totalStockQty}</strong></span>
              <span>Value: <strong className="text-emerald-600 dark:text-emerald-400 text-sm font-black">₹ {totalStockValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
