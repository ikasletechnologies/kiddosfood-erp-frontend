"use client";

import { useState, useEffect } from "react";
import { X, ArrowDownLeft, ArrowUpRight, History, Info } from "lucide-react";
import { vendorsApi } from "@/lib/api";
import { clsx } from "clsx";
import { formatDate } from "@/lib/utils";

interface LedgerEntry {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  referenceType: string;
  referenceId: string;
  invoiceId?: string;
  invoice?: { invoiceNumber: string };
  note: string;
  createdAt: string;
  runningBalance: number;
}

export default function VendorLedgerModal({ vendor, onClose }: { vendor: any; onClose: () => void }) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PAYMENTS' | 'PURCHASES' | 'RETURNS'>('ALL');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchLedger();
  }, [vendor.id]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await vendorsApi.getLedger(vendor.id);
      setLedger(res.data);
    } catch (error) {
      console.error("Failed to fetch ledger", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLedger = ledger.filter(entry => {
    // 1. Type filter
    if (activeTab === 'PAYMENTS' && !(entry.referenceType === 'PAYMENT' || entry.referenceType === 'ADVANCE')) return false;
    if (activeTab === 'PURCHASES' && !(entry.referenceType === 'PO' || entry.referenceType === 'PURCHASE')) return false;
    if (activeTab === 'RETURNS' && !(entry.referenceType === 'RETURN' || entry.referenceType === 'PURCHASE_RETURN')) return false;

    // 2. Date filter
    const entryDate = new Date(entry.createdAt).setHours(0,0,0,0);
    if (startDate && entryDate < new Date(startDate).setHours(0,0,0,0)) return false;
    if (endDate && entryDate > new Date(endDate).setHours(0,0,0,0)) return false;

    return true;
  });

  const exportExcel = () => {
    const headers = ["Date", "Type", "Reference", "Note", "Amount", "Balance"];
    const rows = filteredLedger.map(e => [
      formatDate(e.createdAt),
      e.type,
      e.referenceType,
      e.note,
      e.amount,
      e.runningBalance
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(r => r.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${vendor.name}_Statement.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printStatement = () => {
    window.print();
  };

  const currentBalance = ledger.length > 0 ? ledger[0].runningBalance : (vendor.balance || 0);
  const isAdvance = currentBalance >= 0;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white border border-[#F0EAF0] w-full max-w-4xl rounded-3xl shadow-2xl shadow-slate-200/60 flex flex-col max-h-[90vh]">

        {/* Print Header (Only visible when printing) */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Vendor Statement</h1>
              <p className="text-sm font-bold text-slate-500 mt-1">Generated on {formatDate(new Date())} at {new Date().toLocaleTimeString()}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black text-slate-900">{vendor.name}</h2>
              <p className="text-sm font-bold text-slate-500">{vendor.contact}</p>
              {vendor.email && <p className="text-sm font-bold text-slate-500">{vendor.email}</p>}
            </div>
          </div>
          {(startDate || endDate) && (
            <div className="mt-4 inline-block bg-slate-100 px-4 py-2 rounded-lg">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                Statement Period: {startDate || "Opening"} — {endDate || "Present"}
              </p>
            </div>
          )}
        </div>

        {/* Header (Screen only) */}
        <div className="px-8 py-6 border-b border-[#F0EAF0] flex items-center justify-between rounded-t-3xl bg-gradient-to-r from-violet-50 to-white print:hidden">
          <div>
            <h2 className="text-xl font-black text-[#1A1A1A] flex items-center gap-3">
              <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-xl flex items-center justify-center">
                <History className="w-5 h-5 text-[#7C3AED]" />
              </div>
              Financial Ledger: {vendor.name}
            </h2>
            <p className="text-sm text-[#999] mt-1 font-medium">Append-only audit-proof transaction history</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-[#999] hover:text-[#1A1A1A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Summary */}
        <div className="px-8 py-5 bg-slate-50/70 border-b border-[#F0EAF0] flex flex-col gap-4 print:bg-white print:px-0 print:border-none">
          <div className="flex items-center justify-between print:hidden">
            <div className="flex bg-white p-1 rounded-xl border border-[#F0EAF0] shadow-sm">
              {(['ALL', 'PURCHASES', 'PAYMENTS', 'RETURNS'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    "px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                    activeTab === tab
                      ? "bg-[#7C3AED] text-white shadow-lg shadow-purple-200"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {tab === 'ALL' ? 'All' : tab === 'RETURNS' ? 'Returns' : tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors"
              >
                Excel
              </button>
              <button 
                onClick={printStatement}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
              >
                PDF / Print
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 print:hidden">
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 ml-1">From Date</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 ml-1">To Date</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(""); setEndDate(""); }}
                  className="mt-5 p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Clear Dates"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="text-right">
              <p className="text-[10px] text-[#999] uppercase tracking-[0.15em] font-bold mb-0.5">Net Balance</p>
              <p className={clsx(
                "text-2xl font-black tracking-tight leading-none",
                isAdvance ? "text-emerald-600" : "text-rose-600"
              )}>
                ₹{Math.abs(currentBalance).toLocaleString()}
                <span className="text-[10px] ml-1.5 font-bold opacity-70 uppercase">
                  {isAdvance ? "Advance" : "Due"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-[#7C3AED]/20 border-t-[#7C3AED] rounded-full animate-spin" />
              <p className="text-[#999] text-sm font-medium animate-pulse">Calculating balances...</p>
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-[#CCC] border-2 border-dashed border-[#F0EAF0] rounded-2xl">
              <History className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-bold text-[#999]">No transactions matching your filter</p>
            </div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[10px] font-black text-[#999] uppercase tracking-[0.15em]">
                  <th className="pb-3 pl-4">Date</th>
                  <th className="pb-3">Reference / Note</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 pr-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map((entry) => (
                  <tr
                    key={entry.id}
                    className="bg-white hover:bg-slate-50/80 border border-[#F7F0F7] rounded-xl overflow-hidden transition-colors"
                  >
                    <td className="py-4 pl-4 rounded-l-xl border-y border-l border-[#F0EAF0]">
                      <div className="flex flex-col">
                        <span className="text-sm text-[#1A1A1A] font-bold whitespace-nowrap">
                          {formatDate(entry.createdAt)}
                        </span>
                        <span className="text-[10px] text-[#999] font-medium">
                          {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 border-y border-[#F0EAF0]">
                      <div className="flex flex-col max-w-[250px]">
                        <span className="text-[10px] font-black text-[#7C3AED] uppercase tracking-widest flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          {entry.referenceType === 'RETURN' ? 'Purchase Return' : entry.referenceType === 'PURCHASE' ? 'Purchase' : entry.referenceType === 'PAYMENT' ? 'Payment Out' : entry.referenceType === 'OPENING_BALANCE' ? 'Opening Balance' : entry.referenceType}
                          {entry.invoiceId && (
                             <span className="bg-purple-100 text-[#7C3AED] px-1.5 py-0.5 rounded ml-1">
                                INV: {entry.invoice?.invoiceNumber || entry.invoiceId.substring(0, 6).toUpperCase()}
                             </span>
                          )}
                          {!entry.invoiceId && entry.referenceId && (
                            <span className="text-slate-500 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded ml-1">
                              {entry.referenceId.startsWith('PR-') || entry.referenceId.startsWith('VPAY-') || entry.referenceId.startsWith('BILL-')
                                ? entry.referenceId
                                : `#${entry.referenceId.substring(0, 6).toUpperCase()}`}
                            </span>
                          )}
                        </span>
                        <span className="text-sm text-[#444] font-medium truncate">{entry.note}</span>
                      </div>
                    </td>
                    <td className="py-4 border-y border-[#F0EAF0]">
                      <span className={clsx(
                        "px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase border",
                        entry.type === 'CREDIT'
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-rose-50 text-rose-700 border-rose-100"
                      )}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="py-4 text-right border-y border-[#F0EAF0]">
                      <div className={clsx(
                        "text-sm font-black flex items-center justify-end gap-1",
                        entry.type === 'CREDIT' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {entry.type === 'CREDIT'
                          ? <ArrowDownLeft className="w-3 h-3" />
                          : <ArrowUpRight className="w-3 h-3" />
                        }
                        ₹{entry.amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right rounded-r-xl border-y border-r border-[#F0EAF0]">
                      <div className={clsx(
                        "text-sm font-black font-mono px-3 py-1.5 rounded-xl inline-block",
                        entry.runningBalance >= 0
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-rose-50 text-rose-700 border border-rose-100"
                      )}>
                        ₹{entry.runningBalance.toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer (Screen only) */}
        <div className="px-8 py-5 border-t border-[#F0EAF0] flex justify-between items-center rounded-b-3xl bg-slate-50/50 print:hidden">
          <div className="flex gap-5 text-xs text-[#999] font-semibold">
            <span className="flex items-center gap-1.5">
              <ArrowUpRight className="w-3 h-3 text-rose-500" /> DEBIT = Purchase/Cost
            </span>
            <span className="flex items-center gap-1.5">
              <ArrowDownLeft className="w-3 h-3 text-emerald-500" /> CREDIT = Payment/Advance
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#333] text-white font-bold text-sm rounded-xl transition-all"
          >
            Close Viewer
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: white !important;
            padding: 20px !important;
            border: none !important;
            box-shadow: none !important;
          }
          @page {
            size: auto;
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  );
}
