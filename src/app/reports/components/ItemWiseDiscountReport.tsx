"use client";

import React, { useState, useEffect } from "react";
import { 
  FileTextIcon, PrinterIcon, ChevronDownIcon, SearchIcon
} from "lucide-react";
import { reportsApi } from "@/lib/api/accounting.api";

interface DiscountRow {
  itemName: string;
  totalQtySold: number;
  totalSaleAmount: number;
  totalDiscAmount: number;
  avgDiscPct: number;
}

export default function ItemWiseDiscountReport() {
  const [reportData, setReportData] = useState<DiscountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("This Month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [itemName, setItemName] = useState("");
  const [partyFilter, setPartyFilter] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const franchiseId = localStorage.getItem("selectedFranchiseId") || "";
        
        const params = new URLSearchParams();
        if (franchiseId) params.append("franchiseId", franchiseId);
        if (itemName) params.append("itemName", itemName);
        if (partyFilter) params.append("partyName", partyFilter);
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        const res = await reportsApi.getItemDiscount(Object.fromEntries(params.entries()));
        const data = res.data;
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        
        const formatted = rows.map((r: any) => ({
          itemName: r.itemName || "—",
          totalQtySold: Number(r.totalQtySold || 0),
          totalSaleAmount: Number(r.totalSaleAmount || 0),
          totalDiscAmount: Number(r.totalDiscAmount || 0),
          avgDiscPct: Number(r.avgDiscPct || 0)
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

  const totalSaleAmount = reportData.reduce((sum, r) => sum + r.totalSaleAmount, 0);
  const totalDiscountAmount = reportData.reduce((sum, r) => sum + r.totalDiscAmount, 0);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    const headers = ["Item Name", "Total Qty Sold", "Total Sale Amount", "Total Discount Amount", "Average Discount %"];
    const rows = reportData.map((r) => [r.itemName, r.totalQtySold, r.totalSaleAmount.toFixed(2), r.totalDiscAmount.toFixed(2), r.avgDiscPct.toFixed(2)]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `Item_Wise_Discount_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-y-auto">
      {/* Top Main Filters Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group cursor-pointer">
            <div className="flex items-center gap-2 text-lg font-black text-slate-800 dark:text-white">
              {dateRange} <ChevronDownIcon size={18} className="text-slate-400" />
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">Between</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-bold focus:outline-none w-24"
            />
            <span className="text-[10px] font-black text-slate-400 uppercase">To</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-bold focus:outline-none w-24"
            />
          </div>

          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200/60 dark:border-slate-700 uppercase tracking-wider">
              ALL FIRMS <ChevronDownIcon size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handleExportCSV} className="flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-emerald-600 transition-colors">
            <FileTextIcon size={20} />
            <span className="text-[9px] font-black uppercase tracking-wider">Excel Report</span>
          </button>
          <button onClick={handlePrint} className="flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-orange-600 transition-colors">
            <PrinterIcon size={20} />
            <span className="text-[9px] font-black uppercase tracking-wider">Print</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1">
        
        {/* Secondary Filter Area */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Item Wise Discount</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ITEM NAME</span>
              <input 
                type="text" 
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs px-2 py-1"
              />
            </div>
            <div className="relative">
              <button className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 rounded border border-slate-200 dark:border-slate-700">
                All Categories <ChevronDownIcon size={12} />
              </button>
            </div>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Party Filter"
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="w-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs px-2 py-1"
              />
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-12">#</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">ITEM NAME</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">TOTAL QTY SOLD</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">TOTAL SALE AMOUNT</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">TOTAL DISC. AMOUNT</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">AVG. DISC. (%)</th>
                <th className="px-4 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody>
              {reportData.length > 0 ? (
                reportData.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/80">
                    <td className="px-4 py-4 text-xs font-semibold text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-800 dark:text-slate-200">{row.itemName}</td>
                    <td className="px-4 py-4 text-xs font-semibold text-slate-600">{row.totalQtySold}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-800">₹ {row.totalSaleAmount.toFixed(2)}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-800">₹ {row.totalDiscAmount.toFixed(2)}</td>
                    <td className="px-4 py-4 text-xs font-semibold text-slate-600">{row.avgDiscPct.toFixed(2)}%</td>
                    <td className="px-4 py-4 text-xs font-bold text-blue-500 cursor-pointer hover:underline">View</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-32 text-center">
                    <span className="text-sm font-semibold text-slate-500">No Items</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Summary Area */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-2">
          <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Summary</h4>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Total Sale Amount:</span>
            <span className="font-bold text-slate-800 dark:text-white">{reportData.length ? `₹ ${totalSaleAmount.toFixed(2)}` : "---"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Total Discount amount:</span>
            <span className="font-bold text-slate-800 dark:text-white">{reportData.length ? `₹ ${totalDiscountAmount.toFixed(2)}` : "---"}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
