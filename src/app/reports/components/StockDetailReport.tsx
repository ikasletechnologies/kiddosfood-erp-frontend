"use client";

import React, { useState, useEffect } from "react";
import { X, 
  SearchIcon, FileTextIcon, PrinterIcon, ChevronDownIcon, 
  AlertCircleIcon
} from "lucide-react";

interface StockDetailRow {
  itemName: string;
  beginningQuantity: number;
  quantityIn: number;
  purchaseAmount: number;
  quantityOut: number;
  saleAmount: number;
  closingQuantity: number;
}

export default function StockDetailReport() {
  const [reportData, setReportData] = useState<StockDetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
        if (params.toString()) queryParams = `?${params.toString()}`;

        const res = await fetch(`/api/reports/stock-detail${queryParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch stock detail");
        
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data?.rows || []);
        
        const formatted = rows.map((r: any) => ({
          itemName: r.itemName || r.name || "—",
          beginningQuantity: Number(r.beginningQuantity || 0),
          quantityIn: Number(r.quantityIn || 0),
          purchaseAmount: Number(r.purchaseAmount || 0),
          quantityOut: Number(r.quantityOut || 0),
          saleAmount: Number(r.saleAmount || 0),
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
    fetchData();
  }, [startDate, endDate]);

  const filtered = reportData.filter(row =>
    row.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBegQty = filtered.reduce((sum, r) => sum + r.beginningQuantity, 0);
  const totalQtyIn = filtered.reduce((sum, r) => sum + r.quantityIn, 0);
  const totalPurAmt = filtered.reduce((sum, r) => sum + r.purchaseAmount, 0);
  const totalQtyOut = filtered.reduce((sum, r) => sum + r.quantityOut, 0);
  const totalSaleAmt = filtered.reduce((sum, r) => sum + r.saleAmount, 0);
  const totalClosingQty = filtered.reduce((sum, r) => sum + r.closingQuantity, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      "Item Name", "Begining Quantity", "Quantity In", "Purchase Amount", 
      "Quantity Out", "Sale Amount", "Closing Quantity"
    ];
    const rows = filtered.map(r => [
      r.itemName, r.beginningQuantity, r.quantityIn, r.purchaseAmount.toFixed(2),
      r.quantityOut, r.saleAmount.toFixed(2), r.closingQuantity
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Detail_Report_${new Date().toISOString().split('T')[0]}.csv`);
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
          
          <div className="relative mt-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition-all border border-slate-200/60 dark:border-slate-700">
              All Categories <ChevronDownIcon size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto mt-4 md:mt-0">
          {/* Search */}
          <div className="relative flex-1 md:flex-initial">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search item..."
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
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item Name</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Begining Quantity</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Quantity In</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Purchase Amount</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Quantity Out</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Sale Amount</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Closing Quantity</th>
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
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">{row.beginningQuantity}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">{row.quantityIn}</td>
                      <td className="px-6 py-4 text-xs font-bold text-emerald-600 text-right">₹ {row.purchaseAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600 dark:text-slate-400 text-right">{row.quantityOut}</td>
                      <td className="px-6 py-4 text-xs font-bold text-orange-600 text-right">₹ {row.saleAmount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-xs font-black text-slate-800 dark:text-white text-right">{row.closingQuantity}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircleIcon size={24} className="opacity-40" />
                        <span className="text-xs font-bold">No items found matching criteria.</span>
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
            <span className="w-48">Total</span>
            <div className="flex-1 grid grid-cols-6 text-right font-black text-sm text-slate-900 dark:text-white">
              <span>{totalBegQty}</span>
              <span>{totalQtyIn}</span>
              <span className="text-emerald-600">₹ {totalPurAmt.toFixed(2)}</span>
              <span>{totalQtyOut}</span>
              <span className="text-orange-600">₹ {totalSaleAmt.toFixed(2)}</span>
              <span>{totalClosingQty}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
