"use client";

import React, { useState } from "react";
import { X, 
  SearchIcon, FileTextIcon, PrinterIcon, ChevronDownIcon, 
  FolderIcon, InfoIcon
} from "lucide-react";

export default function ItemCategoryWiseProfitLossReport() {
  const [searchTerm, setSearchTerm] = useState("");

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    // Empty export since there are no categories yet
    const headers = ["Category Name", "Net Profit/Loss"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Category_Wise_Profit_Loss_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-y-auto">
      {/* Filters Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Filter */}
          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200/60 dark:border-slate-700">
              Date Filter <ChevronDownIcon size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:flex-initial">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search categories..."
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

      {/* Main Container - Empty State */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1 items-center justify-center p-10 min-h-[400px]">
        
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-full mb-6">
          <FolderIcon size={48} className="text-slate-300 dark:text-slate-600" />
        </div>
        
        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">
          No Categories to Show
        </h2>
        
        <p className="text-sm font-semibold text-slate-500 text-center max-w-sm flex items-center justify-center gap-2">
          <InfoIcon size={14} className="text-orange-500" />
          You haven&apos;t added any categories yet. Add categories to your items to view this report.
        </p>

      </div>
    </div>
  );
}
