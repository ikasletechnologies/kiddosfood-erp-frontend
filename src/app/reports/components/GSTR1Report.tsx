"use client";

"use client";

import React, { useState, useEffect } from "react";
import { 
  FileTextIcon, PrinterIcon
} from "lucide-react";
import { reportsApi } from "@/lib/api/accounting.api";

interface GSTR1Row {
  gstin: string;
  customerGstin?: string;
  b2bType?: string;
  partyName: string;
  invoiceNo: string;
  date: string;
  placeOfSupply?: string;
  value: number;
  taxRate: number;
  cessRate: number;
  taxableValue: number;
  integratedTax: number;
  centralTax: number;
  stateTax: number;
  cessAmount: number;
}

export default function GSTR1Report() {
  const [activeTab, setActiveTab] = useState<"Sale" | "Sale Return">("Sale");
  const [reportData, setReportData] = useState<{ sale: GSTR1Row[], saleReturn: GSTR1Row[] }>({ sale: [], saleReturn: [] });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [considerNonTax, setConsiderNonTax] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await reportsApi.getGSTR1({ startDate, endDate });
        setReportData(res.data || res || { sale: [], saleReturn: [] });
      } catch (err) {
        console.error(err);
        setReportData({ sale: [], saleReturn: [] });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate]);

  const handlePrint = () => window.print();
  const handleExportCSV = () => {
    const headers = [
      "Invoice No",
      "Invoice Date",
      "Customer Name",
      "Customer GSTIN",
      "B2B / B2C",
      "Place of Supply",
      "Invoice Total",
      "Tax Rate (%)",
      "Taxable Value",
      "Integrated Tax (IGST)",
      "Central Tax (CGST)",
      "State Tax (SGST)",
      "Cess Amount"
    ];
    const rows = currentData.map((r) => [
      r.invoiceNo,
      r.date,
      r.partyName,
      r.customerGstin || r.gstin || "—",
      r.b2bType || (r.gstin && r.gstin !== "—" ? "B2B" : "B2C"),
      r.placeOfSupply || "—",
      r.value ?? r.taxableValue,
      r.taxRate || 0,
      r.taxableValue || 0,
      r.integratedTax || 0,
      r.centralTax || 0,
      r.stateTax || 0,
      r.cessAmount || 0
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `GSTR1_${activeTab.replace(/\s+/g, "_")}_${startDate || "all"}_${endDate || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentData = activeTab === "Sale" ? reportData.sale : reportData.saleReturn;

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
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To Month/Year</span>
              <input 
                type="month"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer mt-4 md:mt-0">
            <input 
              type="checkbox" 
              checked={considerNonTax}
              onChange={(e) => setConsiderNonTax(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Consider non-tax as exempted</span>
          </label>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={handleExportCSV} className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-full border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 transition-colors">
            <FileTextIcon size={16} />
          </button>
          <button onClick={handlePrint} className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-full border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 transition-colors">
            <PrinterIcon size={16} />
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden">
        
        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          <button 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-colors ${activeTab === "Sale" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            onClick={() => setActiveTab("Sale")}
          >
            Sale
          </button>
          <button 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-colors ${activeTab === "Sale Return" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-800"}`}
            onClick={() => setActiveTab("Sale Return")}
          >
            Sale Return
          </button>
        </div>

        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="p-8 space-y-4 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-lg" />
              <div className="h-10 bg-slate-100 rounded-lg" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">GSTIN/UIN</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Party Name</th>
                  <th colSpan={3} className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-b border-slate-100 text-center">Invoice Details</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Tax Rate</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Cess Rate</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Taxable Value</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Integrated Tax</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">Central Tax</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 align-middle text-center">State Tax</th>
                  <th rowSpan={2} className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest align-middle text-center">Cess Amount</th>
                </tr>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 text-center">No.</th>
                  <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 text-center">Date</th>
                  <th className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-100 text-center">Value</th>
                </tr>
              </thead>
              <tbody>
                {currentData.length > 0 ? (
                  currentData.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-100">{row.gstin}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800 text-center border-r border-slate-100">{row.partyName}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-blue-600 text-center border-r border-slate-100">{row.invoiceNo}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-100">{row.date}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800 text-right border-r border-slate-100">{row.value.toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-100">{row.taxRate}%</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-center border-r border-slate-100">{row.cessRate}%</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800 text-right border-r border-slate-100">{row.taxableValue.toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-right border-r border-slate-100">{row.integratedTax.toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-right border-r border-slate-100">{row.centralTax.toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-right border-r border-slate-100">{row.stateTax.toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600 text-right">{row.cessAmount.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="px-4 py-32 text-center">
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
