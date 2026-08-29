"use client";

import React, { useState, useEffect } from "react";
import { X, 
  FileTextIcon, PrinterIcon, ChevronDownIcon, SearchIcon, FilterIcon
} from "lucide-react";
import { reportsApi } from "@/lib/api/accounting.api";

interface HSNRow {
  hsn: string;
  totalValue: number;
  taxableValue: number;
  igstAmount: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  addCess: number | null;
}

export default function SaleSummaryByHSNReport() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-05-31");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportData, setReportData] = useState<HSNRow[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await reportsApi.getHsnSummary({ startDate, endDate });
        setReportData(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    const headers = ["HSN", "Total Value", "Taxable Value", "IGST Amount", "CGST Amount", "SGST Amount", "Add. Cess"];
    const rows = filteredData.map((r) => [r.hsn, r.totalValue, r.taxableValue, r.igstAmount ?? "", r.cgstAmount ?? "", r.sgstAmount ?? "", r.addCess ?? ""]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `HSN_Summary_${startDate || "all"}_${endDate || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = reportData.filter(row => 
    row.hsn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalValue = filteredData.reduce((acc, row) => acc + row.totalValue, 0);
  const totalItems = filteredData.length;

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-hidden">
      {/* Top Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-black text-slate-700 dark:text-slate-200">
              This Month <ChevronDownIcon size={16} />
            </button>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-200/60 dark:border-slate-700">
            <span className="px-3 py-1 bg-slate-400 dark:bg-slate-600 text-white text-[10px] font-black uppercase tracking-wider rounded-md">Between</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
            />
            <span className="text-xs font-semibold text-slate-400">To</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200/60 dark:border-slate-700 bg-transparent text-xs font-black text-slate-700 dark:text-slate-200 rounded-lg">
              ALL FIRM <ChevronDownIcon size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={handleExportCSV} className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-full border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-100 transition-colors">
            <FileTextIcon size={16} />
          </button>
          <button onClick={handlePrint} className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-full border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 transition-colors">
            <PrinterIcon size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12141c] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col flex-1 overflow-hidden relative">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="relative max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder=""
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#090a0f] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="p-8 space-y-4 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-lg" />
              <div className="h-10 bg-slate-100 rounded-lg" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/40 z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 w-12">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">#</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">HSN</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </th>
                  <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TOTAL VALUE</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </th>
                  <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TAXABLE VALUE</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </th>
                  <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">IGST AMOUNT</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </th>
                  <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CGST AMOUNT</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </th>
                  <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SGST AMOUNT</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </th>
                  <th className="px-4 py-3">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ADD. CESS</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {filteredData.length > 0 ? (
                  filteredData.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-center">
                        <span className="flex items-center justify-center gap-2">
                          <ChevronDownIcon size={14} className="text-slate-400" />
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{row.hsn}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">₹ {row.totalValue.toFixed(2)}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">₹ {row.taxableValue.toFixed(2)}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{row.igstAmount !== null ? `₹ ${row.igstAmount.toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{row.cgstAmount !== null ? `₹ ${row.cgstAmount.toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{row.sgstAmount !== null ? `₹ ${row.sgstAmount.toFixed(2)}` : "—"}</td>
                      <td className="px-4 py-4">{row.addCess !== null ? `₹ ${row.addCess.toFixed(2)}` : "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-32 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <FileTextIcon size={48} className="text-slate-200 dark:text-slate-700" />
                        <div className="text-slate-400 dark:text-slate-500 font-medium">No data is available for HSN Wise Summary Report.</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white dark:bg-[#12141c] border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 flex justify-between items-center text-xs font-black tracking-wide">
          <div className="text-slate-600 dark:text-slate-400">
            Total Value: <span className="text-emerald-500 ml-1">₹ {totalValue.toFixed(2)}</span>
          </div>
          <div className="text-slate-600 dark:text-slate-400">
            Total Items: <span className="ml-1 text-slate-800 dark:text-white">{totalItems}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
