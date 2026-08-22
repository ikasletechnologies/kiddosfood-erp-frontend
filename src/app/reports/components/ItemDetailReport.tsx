"use client";

import React, { useState, useEffect } from "react";
import { X, 
  FileTextIcon, PrinterIcon, AlertCircleIcon, SearchIcon
} from "lucide-react";

interface ItemDetailRow {
  date: string;
  saleQuantity: number;
  purchaseQuantity: number;
  adjustmentQuantity: number;
  closingQuantity: number;
}

export default function ItemDetailReport() {
  const [reportData, setReportData] = useState<ItemDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hideInactive, setHideInactive] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const token = localStorage.getItem("token") || "";
        const franchiseId = localStorage.getItem("selectedFranchiseId") || "";
        
        let queryParams = "";
        const params = new URLSearchParams();
        if (franchiseId) params.append("franchiseId", franchiseId);
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (searchTerm) params.append("itemName", searchTerm);
        if (params.toString()) queryParams = `?${params.toString()}`;

        const res = await fetch(`/api/reports/item-detail${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch item detail");
        
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        
        const formatted = rows.map((r: any) => ({
          date: r.date || "—",
          saleQuantity: Number(r.saleQuantity || 0),
          purchaseQuantity: Number(r.purchaseQuantity || 0),
          adjustmentQuantity: Number(r.adjustmentQuantity || 0),
          closingQuantity: Number(r.closingQuantity || 0)
        }));

        setReportData(formatted);
      } catch (err) {
        console.error(err);
        setReportData([]);
      } finally {
        setLoading(false);
      }
    }
    
    // Slight debounce for search term if needed, but simple fetch works
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [startDate, endDate, searchTerm]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      "Date", "Sale Quantity", "Purchase Quantity", "Adjustment Quantity", "Closing Quantity"
    ];
    const rows = reportData.map(r => [
      r.date, r.saleQuantity, r.purchaseQuantity, r.adjustmentQuantity, r.closingQuantity
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Item_Detail_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-y-auto">
      {/* Filters Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">From</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Item Name</span>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-3 pr-4 py-1.5 w-full md:w-48 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
            {searchTerm && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchTerm("")} 
              />
            )}
              </div>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={hideInactive}
                onChange={(e) => setHideInactive(e.target.checked)}
                className="w-4 h-4 rounded text-orange-500 border-slate-300 focus:ring-orange-500"
              />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Hide inactive dates</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto mt-4 md:mt-0">
          <button 
            onClick={handleExportCSV}
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

      {/* Table Container */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">DETAILS</h3>
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
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Sale Quantity</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Purchase Quantity</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Adjustment Quantity</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Closing Quantity</th>
                </tr>
              </thead>
              <tbody>
                {reportData.length > 0 ? (
                  reportData.map((row, idx) => (
                    <tr 
                      key={idx}
                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors"
                    >
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-slate-200">{row.date}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-orange-600 text-right">{row.saleQuantity}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-emerald-600 text-right">{row.purchaseQuantity}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 text-right">{row.adjustmentQuantity}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-800 dark:text-white text-right">{row.closingQuantity}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircleIcon size={24} className="opacity-40" />
                        <span className="text-xs font-bold">No details to show for selected item.</span>
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
