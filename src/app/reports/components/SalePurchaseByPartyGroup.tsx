"use client";

import { useState, useEffect } from "react";
import { X,
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  ChevronDown as ChevronDownIcon,
  Filter as FilterIcon,
  Search as SearchIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";

interface SalePurchaseGroupRow {
  groupName: string;
  saleAmount: number;
  purchaseAmount: number;
}

export default function CentralSalePurchaseByPartyGroup({
  reportData,
  loading: externalLoading,
}: {
  reportData: any;
  loading: boolean;
}) {
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-05-31");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Real data state
  const [rows, setRows] = useState<SalePurchaseGroupRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    reportsApi.getSalePurchaseByPartyGroup({
      startDate,
      endDate
    }).then((res: any) => {
      if (!res.data || res.data.length === 0) {
        setRows([]);
      } else {
        setRows(res.data);
      }
    }).catch(() => {
      setRows([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExcel = () => {
    toast.success("Excel export initiated...");
  };

  const fmt = (val: number | null) => {
    if (val === null || val === 0) return "₹ 0.00";
    return `₹ ${val.toFixed(2)}`;
  };
  
  const filtered = rows.filter((r) =>
    r.groupName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSaleAmt = filtered.reduce((s, r) => s + r.saleAmount, 0);
  const totalPurchaseAmt = filtered.reduce((s, r) => s + r.purchaseAmount, 0);

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] space-y-4 p-6 overflow-hidden">
      {/* Top Header Row */}
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

          <div className="relative">
            <select className="px-3 pr-8 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-700 dark:text-slate-300 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none min-w-[140px]">
              <option>ALL FIRMS</option>
            </select>
            <ChevronDownIcon size={14} className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={handleExcel} className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-600 transition-colors">
            <ExcelIcon size={20} />
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
          <h3 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">SALE PURCHASE BY PARTY GROUP</h3>
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
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/40 z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">GROUP NAME</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 text-center">
                  <div className="flex items-center justify-center group cursor-pointer gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">SALE AMOUNT</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end group cursor-pointer gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PURCHASE AMOUNT</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {loading || externalLoading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-32 text-center h-full">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-40 text-center h-full align-middle">
                    <div className="text-slate-600 dark:text-slate-400 font-medium">
                      No records to show
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors bg-white dark:bg-[#12141c]">
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white font-medium">{row.groupName}</td>
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-center font-medium">{fmt(row.saleAmount)}</td>
                    <td className="px-4 py-4 text-right">{fmt(row.purchaseAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-[#12141c] border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 flex justify-between items-center text-[11px] font-semibold tracking-wide">
          <div className="text-slate-600 dark:text-slate-400">
            Total Sale Amount: <span className="text-emerald-500 ml-1">{fmt(totalSaleAmt)}</span>
          </div>
          <div className="text-slate-600 dark:text-slate-400">
            Total Purchase Amount: <span className="text-red-500 ml-1">{fmt(totalPurchaseAmt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
