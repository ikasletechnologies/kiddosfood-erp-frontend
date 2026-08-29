"use client";

import { useState } from "react";
import { 
  ChevronRight, 
  ChevronDown,
  Download,
  Search,
  Columns
} from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

export default function BatchExpiryReport() {
  const [activeTab, setActiveTab] = useState("Reports & More");

  const expiryColumns = [
    "Expiring in 0-15 days", "Expiring in 16-30 days", "Expiring in 31-60 days", 
    "Expiring in 61-90 days", "Expiring in 90+ days", "Expired 0-15 days ago",
    "Expired 16-30 days ago", "Expired 31-60 days ago", "Expired 61-90 days ago",
    "Expired 90+ days ago"
  ];

  return (
    <div className="min-h-screen bg-[#FDFCFD] dark:bg-[#020617] -m-3 sm:-m-4 md:-m-6 p-3 sm:p-4 md:p-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0 font-sans">
      <div className="space-y-4 sm:space-y-6 w-full min-w-0">
        {/* Breadcrumbs & Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#999] uppercase tracking-widest overflow-x-auto custom-scrollbar max-w-full whitespace-nowrap">
            <Link href="/" className="hover:text-[#7C3AED]">Azeez</Link>
            <ChevronRight size={10} />
            <Link href="/inventory" className="hover:text-[#7C3AED]">Inventory</Link>
            <ChevronRight size={10} />
            <span className="text-[#666]">Batch Expiry Report</span>
          </div>
          
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-black text-[#1A1A1A] dark:text-white flex items-center gap-2">
              Inventory 
            </h1>
          </div>
        </div>

        {/* Primary Tabs */}
        <div className="flex items-center gap-4 sm:gap-8 border-b border-[#F0EAF0] dark:border-slate-800 overflow-x-auto custom-scrollbar max-w-full">
          {["All Items", "Warehouses", "Reports & More"].map((tab) => (
            <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={clsx(
                 "pb-3 text-xs sm:text-[13px] font-bold transition-all relative flex items-center gap-2 whitespace-nowrap shrink-0",
                 activeTab === tab 
                  ? "text-[#7C3AED]" 
                  : "text-[#666] dark:text-slate-500 hover:text-[#1A1A1A] dark:hover:text-white"
               )}
            >
              {tab}
              {tab === "Reports & More" && <ChevronRight size={12} />}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7C3AED]" />
              )}
            </button>
          ))}
        </div>

        {/* Section Title */}
        <h2 className="text-base sm:text-lg font-black text-[#1A1A1A] dark:text-white">Batch Expiry Report</h2>

        {/* Search & Export Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-2 w-full min-w-0">
           <span className="text-xs font-bold text-[#666]">No item Found</span>
           <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto min-w-0">
              <button className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-[#F0EAF0] dark:border-slate-800 rounded-xl text-xs font-bold text-[#666] hover:bg-slate-50 transition-colors bg-white dark:bg-slate-900 shadow-sm">
                 <Download size={14} />
                 <span>Download CSV</span>
              </button>
              <div className="relative flex-1 min-w-[160px] xs:min-w-[200px] max-w-xs">
                 <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
                 <input 
                   type="text" 
                   placeholder="Search Items..."
                   className="w-full pl-9 pr-3 py-2 border border-[#F0EAF0] dark:border-slate-800 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-[#7C3AED] transition-colors bg-white dark:bg-slate-900 shadow-sm"
                 />
              </div>
              <button className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-[#7C3AED] dark:border-slate-800 rounded-xl text-xs font-bold text-[#7C3AED] hover:bg-purple-50 transition-colors bg-white dark:bg-slate-900 shadow-sm">
                 <Columns size={14} />
                 <span>Columns</span>
              </button>
           </div>
        </div>

        {/* Expiry Report Table */}
        <div className="bg-white dark:bg-slate-900 border border-[#F0EAF0] dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm w-full min-w-0">
          <div className="overflow-x-auto custom-scrollbar w-full max-w-full min-h-[400px]">
            <table className="w-full text-left border-collapse min-w-[2500px]">
              <thead>
                {/* Level 1 Header */}
                <tr className="bg-[#FAF9FA] dark:bg-slate-800/50 border-b border-[#F0EAF0] dark:border-slate-800">
                  <th rowSpan={2} className="p-4 w-10 sticky left-0 bg-[#FAF9FA] dark:bg-slate-800 z-10">
                     <div className="w-4 h-4 rounded border border-[#DDD] dark:border-slate-600" />
                  </th>
                  <th rowSpan={2} className="p-4 text-[11px] font-bold text-[#666] dark:text-slate-500 uppercase tracking-wider border-r border-[#F0EAF0] dark:border-slate-800">
                    Item Name
                  </th>
                  <th rowSpan={2} className="p-4 text-[11px] font-bold text-[#666] dark:text-slate-500 uppercase tracking-wider border-r border-[#F0EAF0] dark:border-slate-800">
                    Stock In Hand <ChevronDown size={10} className="inline opacity-40 ml-1" />
                  </th>
                  <th rowSpan={2} className="p-4 text-[11px] font-bold text-[#666] dark:text-slate-500 uppercase tracking-wider border-r border-[#F0EAF0] dark:border-slate-800">
                    Expired <ChevronDown size={10} className="inline opacity-40 ml-1" />
                  </th>
                  {expiryColumns.map((col) => (
                    <th key={col} colSpan={2} className="p-4 text-[11px] font-bold text-[#666] dark:text-slate-500 text-center uppercase tracking-wider border-r border-[#F0EAF0] dark:border-slate-800 border-b border-[#F0EAF0] dark:border-slate-800">
                      {col}
                    </th>
                  ))}
                </tr>
                {/* Level 2 Header */}
                <tr className="bg-white dark:bg-slate-900 border-b border-[#F0EAF0] dark:border-slate-800">
                  {expiryColumns.map((col, idx) => (
                    <div key={`sub-${idx}`} className="contents">
                       <th className="p-3 text-[10px] font-bold text-[#999] dark:text-slate-600 uppercase tracking-wider border-r border-[#F0EAF0] dark:border-slate-800">Qty (% of total)</th>
                       <th className="p-3 text-[10px] font-bold text-[#999] dark:text-slate-600 uppercase tracking-wider border-r border-[#F0EAF0] dark:border-slate-800">Value</th>
                    </div>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                   <td colSpan={24} className="py-40">
                      <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
                        <div className="w-24 h-24 rounded-full bg-purple-50 dark:bg-slate-800 flex items-center justify-center">
                           <div className="w-12 h-8 bg-purple-200 dark:bg-slate-700 rounded-lg relative">
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-400 rounded-full" />
                           </div>
                        </div>
                        <div className="text-center space-y-1">
                           <p className="text-sm font-black text-[#1A1A1A] dark:text-white uppercase tracking-widest">No Data</p>
                        </div>
                      </div>
                   </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="p-4 bg-[#FAF9FA] dark:bg-slate-800/50 flex items-center justify-between border-t border-[#F0EAF0] dark:border-slate-800 text-[12px] font-bold text-[#666]">
             <span>No item Found</span>
             <button className="flex items-center gap-2 px-3 py-1.5 border border-[#F0EAF0] dark:border-slate-800 rounded-md text-[11px] font-bold text-[#666] hover:bg-slate-50 transition-colors">
                <Columns size={14} />
                Show/Hide Columns
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
