"use client";

import { useState, useEffect } from "react";
import {
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  ChevronDown as ChevronDownIcon,
  Filter as FilterIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";
import * as XLSX from "xlsx";

export default function CentralPartyStatementReport({
  reportData,
  loading: externalLoading,
}: {
  reportData: any;
  loading: boolean;
}) {
  const [viewType, setViewType] = useState<"vyapar" | "accounting">("vyapar");
  const [startDate, setStartDate] = useState("2026-05-01");
  const [endDate, setEndDate] = useState("2026-05-31");
  const [partyName, setPartyName] = useState("");
  
  // Real data state
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pn = params.get("partyName");
      if (pn) setPartyName(pn);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    reportsApi.getPartyStatement({
      startDate,
      endDate
    }).then((res: any) => {
      setData(res.data);
    }).catch(() => {
      // toast.error("Failed to load party statement");
    }).finally(() => {
      setLoading(false);
    });
  }, [startDate, endDate]);

  const transactions = (data?.transactions || []).filter((t: any) => {
    if (!partyName || !partyName.trim()) return true;
    const q = partyName.trim().toLowerCase();
    return (
      (t.partyName && t.partyName.toLowerCase().includes(q)) ||
      (t.particular && t.particular.toLowerCase().includes(q)) ||
      (t.refNo && t.refNo.toLowerCase().includes(q))
    );
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExcel = () => {
    try {
      if (!transactions || transactions.length === 0) {
        toast.error("No transactions to export");
        return;
      }

      const aoa: any[][] = [];
      aoa.push(["PARTY STATEMENT REPORT"]);
      if (partyName) aoa.push(["Selected Party:", partyName]);
      aoa.push(["Period:", `${startDate} to ${endDate}`]);
      aoa.push([]);

      // Headers
      aoa.push([
        "Date",
        "Txn Type",
        "Ref No.",
        "Payment Type",
        "Total (Rs)",
        "Received/Paid (Rs)",
        "Txn Balance (Rs)",
        "Receivable Balance (Rs)",
        "Payable Balance (Rs)"
      ]);

      // Rows
      transactions.forEach((t: any) => {
        aoa.push([
          t.date || "",
          t.txnType || "",
          t.refNo || "",
          t.paymentType || "",
          Number(t.total || 0),
          Number(t.receivedPaid || 0),
          Number(t.txnBalance || 0),
          Number(t.receivableBalance || 0),
          Number(t.payableBalance || 0)
        ]);
      });

      aoa.push([]);
      if (data?.summary) {
        aoa.push(["Summary"]);
        aoa.push(["Total Sale:", Number(data.summary.totalSale || 0)]);
        aoa.push(["Total Purchase:", Number(data.summary.totalPurchase || 0)]);
        aoa.push(["Total Money-In:", Number(data.summary.totalMoneyIn || 0)]);
        aoa.push(["Total Money-Out:", Number(data.summary.totalMoneyOut || 0)]);
        aoa.push(["Total Expense:", Number(data.summary.totalExpense || 0)]);
        aoa.push(["Total Receivable:", Number(data.summary.totalReceivable || 0)]);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Party Statement");

      const filename = partyName
        ? `Party_Statement_${partyName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${startDate}_${endDate}.xlsx`
        : `Party_Statement_All_${startDate}_${endDate}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success(partyName ? `Party Statement for "${partyName}" exported to Excel!` : "Party Statement exported to Excel!");
    } catch (err) {
      console.error("Excel export failed:", err);
      toast.error("Failed to export Excel file");
    }
  };

  const fmt = (val: number | undefined) => `₹ ${Number(val || 0).toFixed(2)}`;

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

          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="Select Party"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
            />
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
        {/* View Toggle */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center gap-6 text-sm">
          <span className="text-slate-500">View :</span>
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${viewType === "vyapar" ? "border-slate-800" : "border-slate-300"}`}>
              {viewType === "vyapar" && <div className="w-2 h-2 rounded-full bg-slate-800" />}
            </div>
            <input
              type="radio"
              name="viewType"
              className="hidden"
              checked={viewType === "vyapar"}
              onChange={() => setViewType("vyapar")}
            />
            Vyapar
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${viewType === "accounting" ? "border-slate-800" : "border-slate-300"}`}>
              {viewType === "accounting" && <div className="w-2 h-2 rounded-full bg-slate-800" />}
            </div>
            <input
              type="radio"
              name="viewType"
              className="hidden"
              checked={viewType === "accounting"}
              onChange={() => setViewType("accounting")}
            />
            Accounting
          </label>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/40 z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
              <tr>
                {["DATE", "TXN TYPE", "REF NO.", "PAYMENT TYPE", "TOTAL", "RECEIVED/PAID", "TXN BALANCE", "RECEIVABLE BALANCE", "PAYABLE BALANCE", "PRINT / SHARE"].map((col) => (
                  <th key={col} className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 last:border-r-0">
                    <div className="flex items-center justify-between group cursor-pointer">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[100px]">{col}</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors ml-1 flex-shrink-0" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {loading || externalLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-32 text-center h-full">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                    </div>
                  </td>
                </tr>
              ) : (!transactions || transactions.length === 0) ? (
                <tr>
                  <td colSpan={10} className="px-4 py-40 text-center h-full align-middle">
                    <div className="text-slate-600 dark:text-slate-400 font-medium">
                      No transactions to show
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((t: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{t.date}</td>
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{t.txnType}</td>
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{t.refNo}</td>
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{t.paymentType}</td>
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{fmt(t.total)}</td>
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{fmt(t.receivedPaid)}</td>
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{fmt(t.txnBalance)}</td>
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{fmt(t.receivableBalance)}</td>
                    <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{fmt(t.payableBalance)}</td>
                    <td className="px-4 py-4 cursor-pointer text-blue-500 hover:underline">Print / Share</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Party Statement Summary Footer */}
        <div className="bg-white dark:bg-[#12141c] border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-slate-600 dark:text-slate-400 font-medium text-sm">Party Statement Summary</h4>
            <button className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
              <ChevronDownIcon size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-4 text-[13px]">
            <div className="space-y-6">
              <div>
                <div className="text-slate-700 dark:text-slate-300">Total Sale: {fmt(data?.summary?.totalSale)}</div>
                <div className="text-slate-400 dark:text-slate-500 text-[11px]">(Sale - Sale Return)</div>
              </div>
              <div className="text-slate-700 dark:text-slate-300">Total Money-In: {fmt(data?.summary?.totalMoneyIn)}</div>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="text-slate-700 dark:text-slate-300">Total Purchase: {fmt(data?.summary?.totalPurchase)}</div>
                <div className="text-slate-400 dark:text-slate-500 text-[11px]">(Purchase - Purchase Return)</div>
              </div>
              <div className="text-slate-700 dark:text-slate-300">Total Money-out: {fmt(data?.summary?.totalMoneyOut)}</div>
            </div>
            
            <div className="space-y-6 flex flex-col justify-between">
              <div className="text-slate-700 dark:text-slate-300">Total Expense: {fmt(data?.summary?.totalExpense)}</div>
              
              {/* Bottom Right Total */}
              <div className="absolute bottom-4 right-4 text-sm font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Total Receivable <span className="text-emerald-500 ml-1">{fmt(data?.summary?.totalReceivable)}</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
