"use client";

import React, { useState, useEffect } from "react";
import { X, 
  SearchIcon, FileTextIcon, PrinterIcon, ChevronDownIcon, 
  AlertCircleIcon, PackageMinusIcon, TrendingDownIcon
} from "lucide-react";
import { inventoryApi } from "@/lib/api/inventory.api";

interface LowStockRow {
  itemName: string;
  minimumStock: number;
  stockQty: number;
  stockValue: number;
}

export default function LowStockSummaryReport() {
  const [reportData, setReportData] = useState<LowStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const franchiseId = localStorage.getItem("selectedFranchiseId") || "";
        const res = await inventoryApi.getAlerts(franchiseId ? { franchiseId } : undefined);
        const data = res.data;
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        
        const formatted = rows.map((r: any) => ({
          itemName: r.itemName || r.name || "—",
          minimumStock: Number(r.minimumStock ?? 0),
          stockQty: Number(r.stockQty ?? 0),
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
  }, []);

  const filtered = reportData.filter(row =>
    row.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = filtered.reduce((sum, r) => sum + r.stockValue, 0);

  const downloadCsv = () => {
    const headers = ["Item Name", "Minimum Stock Qty", "Stock Qty", "Stock Value"];
    const csv = [
      headers.join(","),
      ...filtered.map((r) => [r.itemName, r.minimumStock, r.stockQty, r.stockValue.toFixed(2)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `Low_Stock_Summary_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["Item Name", "Minimum Stock Qty", "Stock Qty", "Stock Value"];
    const rows = filtered.map(r => [
      r.itemName,
      r.minimumStock,
      r.stockQty,
      r.stockValue.toFixed(2)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Low_Stock_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-y-auto">
      {/* Filters Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200/60 dark:border-slate-700">
              All Categories <ChevronDownIcon size={12} />
            </button>
          </div>
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
            {searchTerm && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchTerm("")} 
              />
            )}
          </div>

          <button 
            onClick={downloadCsv}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#12141c] p-5 rounded-2xl border border-rose-100 dark:border-rose-900/50 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-xl">
            <PackageMinusIcon size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Items Below Minimum</span>
            <span className="text-2xl font-black text-rose-600 tracking-tight">{filtered.length}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12141c] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
            <TrendingDownIcon size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Low Stock Value</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">₹ {totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
          <h3 className="text-xs font-black text-rose-600 dark:text-rose-500 uppercase tracking-wider flex items-center gap-2">
            <AlertCircleIcon size={14} className="stroke-[2.5]" /> Low Stock Alerts
          </h3>
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
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Minimum Stock Qty</th>
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
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">{row.minimumStock}</td>
                      <td className="px-6 py-4 text-xs font-black text-rose-500 text-right">{row.stockQty}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-white text-right">₹ {row.stockValue.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <PackageMinusIcon size={24} className="opacity-40" />
                        <span className="text-xs font-bold">No items are currently below minimum stock levels.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
