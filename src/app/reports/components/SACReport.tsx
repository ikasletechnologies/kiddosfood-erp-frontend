"use client";

import React, { useState, useEffect } from "react";
import { X, 
  FileTextIcon, PrinterIcon, ChevronDownIcon, SearchIcon, FilterIcon
} from "lucide-react";
import { reportsApi } from "@/lib/api/accounting.api";

interface SACRow {
  sac: string;
  invoiceType: string;
  totalValue: number;
  taxableValue: number;
  igstAmount: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  addCess: number | null;
}

export default function SACReport() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-05-31");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportData, setReportData] = useState<SACRow[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await reportsApi.getSacReport({ startDate, endDate });
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
  const handleExportCSV = () => {};

  const filteredData = reportData.filter(row => 
    row.sac.toLowerCase().includes(searchQuery.toLowerCase())
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
              ALL FIRMS <ChevronDownIcon size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={handleExportCSV} className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-600 transition-colors">
            <FileTextIcon size={20} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Excel Report</span>
          </button>
          <button onClick={handlePrint} className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-600 transition-colors">
            <PrinterIcon size={20} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Print</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12141c] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col flex-1 overflow-hidden relative">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0 flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">SAC REPORT</h3>
          <div className="relative w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder=""
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 bg-white dark:bg-[#090a0f] border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SAC</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </th>
                  <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">INVOICE TYPE</span>
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
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-center">{idx + 1}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{row.sac}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{row.invoiceType}</td>
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
                    <td colSpan={9} className="px-4 py-32 text-center h-full">
                      <div className="flex flex-col items-center justify-center space-y-4 h-full">
                        <div className="relative">
                          {/* Minimalistic overlapping documents illustration */}
                          <div className="w-16 h-20 bg-white border-2 border-slate-200 rounded-lg absolute -left-4 top-2 rotate-[-15deg] shadow-sm flex flex-col gap-2 p-3">
                            <div className="h-1 bg-slate-200 rounded w-full"></div>
                            <div className="h-1 bg-slate-200 rounded w-4/5"></div>
                            <div className="h-1 bg-slate-200 rounded w-full"></div>
                            <div className="h-1 bg-slate-200 rounded w-3/4"></div>
                          </div>
                          <div className="w-16 h-20 bg-white border-2 border-slate-300 rounded-lg relative z-10 shadow-md flex flex-col gap-2 p-3">
                            <div className="h-1 bg-slate-200 rounded w-full"></div>
                            <div className="h-1 bg-slate-200 rounded w-4/5"></div>
                            <div className="h-1 bg-slate-200 rounded w-full"></div>
                            <div className="h-1 bg-slate-200 rounded w-3/4"></div>
                            <div className="h-2 bg-blue-500 rounded w-1/3 mt-auto self-end"></div>
                          </div>
                        </div>
                        <div className="text-slate-400 dark:text-slate-500 font-medium text-sm mt-8">
                          No data is available for SAC Wise Summary Report.<br />
                          Please try again after making relevant changes.
                        </div>
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
