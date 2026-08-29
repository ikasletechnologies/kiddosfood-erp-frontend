"use client";

import React, { useState, useEffect } from "react";
import { 
  FileTextIcon, PrinterIcon, AlertCircleIcon
} from "lucide-react";
import { reportsApi } from "@/lib/api/accounting.api";

interface StockCategoryRow {
  itemCategory: string;
  stockQuantity: number;
  stockValue: number;
}

export default function StockSummaryByCategoryReport() {
  const [reportData, setReportData] = useState<StockCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const franchiseId = localStorage.getItem("selectedFranchiseId") || "";
        const res = await reportsApi.getStockByCategory(franchiseId ? { franchiseId } : undefined);
        const data = res.data;
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        
        const formatted = rows.map((r: any) => ({
          itemCategory: r.itemCategory || "—",
          stockQuantity: Number(r.stockQuantity || 0),
          stockValue: Number(r.stockValue || 0)
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

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const headers = [
      "Item Category", "Stock Quantity", "Stock Value"
    ];
    const rows = reportData.map(r => [
      r.itemCategory, r.stockQuantity, r.stockValue.toFixed(2)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Summary_By_Item_Category_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-y-auto">
      {/* Header (Top Right Tools) */}
      <div className="flex justify-end gap-2.5 w-full">
        <button 
          onClick={handleExportCSV}
          className="p-2 bg-white dark:bg-slate-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"
          title="Excel Export"
        >
          <FileTextIcon size={16} />
        </button>
        <button 
          onClick={handlePrint}
          className="p-2 bg-white dark:bg-slate-800 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"
          title="Print"
        >
          <PrinterIcon size={16} />
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">STOCK SUMMARY BY ITEM CATEGORY</h3>
        </div>

        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="p-8 space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              ))}
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item Category</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Stock Quantity</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {reportData.length > 0 ? (
                  reportData.map((row, idx) => (
                    <tr 
                      key={idx}
                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors"
                    >
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-slate-200">{row.itemCategory}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">{row.stockQuantity}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-white text-right">₹ {row.stockValue.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircleIcon size={24} className="opacity-40" />
                        <span className="text-xs font-bold">No categorical stock data available.</span>
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
