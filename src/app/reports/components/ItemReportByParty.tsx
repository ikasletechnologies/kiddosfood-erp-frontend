"use client";

import React, { useState, useEffect } from "react";
import { X, 
  DownloadIcon, PrinterIcon, SearchIcon, ChevronDownIcon, 
  PackageIcon, AlertCircleIcon, FileTextIcon, CalculatorIcon, UsersIcon,
  ArrowUpRightIcon, ArrowDownLeftIcon
} from "lucide-react";
import { reportsApi } from "@/lib/api/accounting.api";

interface PartyItemRow {
  itemName: string;
  saleQuantity: number;
  saleAmount: number;
  purchaseQuantity: number;
  purchaseAmount: number;
}

export default function ItemReportByParty() {
  const [reportData, setReportData] = useState<PartyItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Uses the newly registered endpoint /api/reports/item-by-party
        const res = await reportsApi.getItemByParty({ startDate, endDate });
        const data = await res.data;
        
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        
        const formatted = rows.map((r: any) => ({
          itemName: r.itemName || r.name || "—",
          saleQuantity: Number(r.saleQuantity !== undefined ? r.saleQuantity : (r.saleQty || 0)),
          saleAmount: Number(r.saleAmount !== undefined ? r.saleAmount : (r.saleValue || 0)),
          purchaseQuantity: Number(r.purchaseQuantity !== undefined ? r.purchaseQuantity : (r.purchaseQty || 0)),
          purchaseAmount: Number(r.purchaseAmount !== undefined ? r.purchaseAmount : (r.purchaseValue || 0))
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
  }, [startDate, endDate]);

  const filtered = reportData.filter(row =>
    row.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSaleQty = filtered.reduce((sum, r) => sum + r.saleQuantity, 0);
  const totalSaleAmt = filtered.reduce((sum, r) => sum + r.saleAmount, 0);
  const totalPurchaseQty = filtered.reduce((sum, r) => sum + r.purchaseQuantity, 0);
  const totalPurchaseAmt = filtered.reduce((sum, r) => sum + r.purchaseAmount, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["Item Name", "Sale Quantity", "Sale Amount", "Purchase Quantity", "Purchase Amount"];
    const rows = filtered.map(r => [
      r.itemName,
      r.saleQuantity,
      r.saleAmount.toFixed(2),
      r.purchaseQuantity,
      r.purchaseAmount.toFixed(2)
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Item_Report_By_Party_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-y-auto">
      {/* Filters Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Start Date */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#12141c] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-orange-50 dark:bg-orange-950/20 text-orange-600 rounded-xl">
            <ArrowUpRightIcon size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Sales Amount</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">₹ {totalSaleAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#12141c] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-xl">
            <ArrowDownLeftIcon size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Purchases Amount</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">₹ {totalPurchaseAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Item Ledger Grouped By Party</h3>
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
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Sale Quantity</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Sale Amount</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Purchase Quantity</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Purchase Amount</th>
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
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">{row.saleQuantity}</td>
                      <td className="px-6 py-4 text-xs font-bold text-orange-600 text-right">₹ {row.saleAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">{row.purchaseQuantity}</td>
                      <td className="px-6 py-4 text-xs font-bold text-emerald-600 text-right">₹ {row.purchaseAmount.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircleIcon size={24} className="opacity-40" />
                        <span className="text-xs font-bold">No data found matching date filters.</span>
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
              <span>Sale Qty: <strong className="text-slate-900 dark:text-white text-sm font-black">{totalSaleQty}</strong></span>
              <span>Sale Amt: <strong className="text-orange-600 text-sm font-black">₹ {totalSaleAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
              <span>Purchase Qty: <strong className="text-slate-900 dark:text-white text-sm font-black">{totalPurchaseQty}</strong></span>
              <span>Purchase Amt: <strong className="text-emerald-600 text-sm font-black">₹ {totalPurchaseAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
