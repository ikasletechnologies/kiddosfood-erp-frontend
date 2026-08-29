"use client";

import React, { useState, useEffect } from "react";
import { 
  FileTextIcon, PrinterIcon
} from "lucide-react";
import { reportsApi } from "@/lib/api/accounting.api";

interface GSTR2Row {
  gstin: string;
  partyName: string;
  billNo: string;
  date: string;
  value: number;
  rate: number;
  cessRate: number;
  taxableValue: number;
  reverseCharge: string;
}

export default function GSTR2Report() {
  const [reportData, setReportData] = useState<GSTR2Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [considerNonTax, setConsiderNonTax] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await reportsApi.getGSTR2({ startDate, endDate });
        const data = await res.data;
        setReportData(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setReportData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    const headers = ["GSTIN/UIN", "Party Name", "Bill No", "Date", "Value", "Rate", "Cess Rate", "Taxable Value", "Reverse Charge"];
    const rows = reportData.map((r) => [r.gstin, r.partyName, r.billNo, r.date, r.value, r.rate, r.cessRate, r.taxableValue, r.reverseCharge]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `GSTR2_${startDate || "all"}_${endDate || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] p-6 space-y-6 overflow-y-auto">
      {/* Top Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">From Month/Year</span>
              <input 
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To Month/Year</span>
              <input 
                type="month"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer mt-4 md:mt-0">
            <input 
              type="checkbox" 
              checked={considerNonTax}
              onChange={(e) => setConsiderNonTax(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
            />
            <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Consider non-tax as exempted</span>
          </label>
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

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden">
        
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">GSTR2 REPORT</h3>
        </div>

        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="p-8 space-y-4 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-lg" />
              <div className="h-10 bg-slate-100 rounded-lg" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">GSTIN/UIN</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Party Name</th>
                  <th colSpan={3} className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-b border-slate-100 text-center">Bill Details</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Rate</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Cess Rate</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Taxable Value</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest align-middle text-center">Reverse Charge</th>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 text-center">No.</th>
                  <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 text-center">Date</th>
                  <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 text-center">Value</th>
                </tr>
              </thead>
              <tbody>
                {reportData.length > 0 ? (
                  reportData.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-100">{row.gstin}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800 text-center border-r border-slate-100">{row.partyName}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-blue-600 text-center border-r border-slate-100">{row.billNo}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-100">{row.date}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800 text-right border-r border-slate-100">{row.value.toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-100">{row.rate}%</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-100">{row.cessRate}%</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800 text-right border-r border-slate-100">{row.taxableValue.toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-center">{row.reverseCharge}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-32 text-center">
                      <span className="text-sm font-semibold text-slate-400">No data available</span>
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
