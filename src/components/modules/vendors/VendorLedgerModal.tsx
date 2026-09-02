"use client";

import { useState, useEffect } from "react";
import { X, ArrowDownLeft, ArrowUpRight, History, Info, Download, Printer } from "lucide-react";
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
      setLedger(res.data || []);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-[#13151f] border border-slate-200 dark:border-white/10 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#13151f] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 rounded-xl flex items-center justify-center text-[#f58220] shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-800 dark:text-white truncate">
                Ledger: {vendor.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Append-only verified transaction history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Summary Toolbar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            {(['ALL', 'PURCHASES', 'PAYMENTS', 'RETURNS'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                  activeTab === tab
                    ? "bg-[#f58220] text-white shadow-2xs"
                    : "bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                )}
              >
                {tab === 'ALL' ? 'All' : tab === 'RETURNS' ? 'Returns' : tab}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Balance</p>
              <p className={clsx(
                "text-base sm:text-lg font-bold font-mono",
                isAdvance ? "text-emerald-600" : "text-rose-600"
              )}>
                ₹ {Math.abs(currentBalance).toLocaleString()}{" "}
                <span className="text-[10px] uppercase font-sans font-bold">
                  {isAdvance ? "Advance" : "Due"}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={exportExcel}
                className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
                title="Export CSV"
              >
                <Download size={13} />
                <span>CSV</span>
              </button>
              <button 
                onClick={printStatement}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#f58220] text-white rounded-lg text-xs font-semibold hover:bg-[#e0751a] transition-colors shadow-2xs"
                title="Print Statement"
              >
                <Printer size={13} />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Table Container */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          <div className="w-full overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference / Note</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Debit (₹)</th>
                  <th className="px-4 py-3 text-right">Credit (₹)</th>
                  <th className="px-4 py-3 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                      No transactions matching your filter
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(entry.createdAt)}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                          {entry.invoiceId ? `INV: ${entry.invoice?.invoiceNumber || entry.invoiceId.slice(0, 6)}` : entry.referenceId || "—"}
                        </div>
                        <div className="text-slate-500 truncate mt-0.5">{entry.note || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          entry.type === 'CREDIT'
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                        )}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {entry.type === 'DEBIT' ? `₹ ${Math.round(entry.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {entry.type === 'CREDIT' ? `₹ ${Math.round(entry.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-white">
                        ₹ {Math.abs(Math.round(entry.runningBalance)).toLocaleString()} {entry.runningBalance >= 0 ? 'Cr' : 'Dr'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#0e1017] shrink-0">
          <div className="flex gap-4 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> DEBIT = Purchase/Bill</span>
            <span className="flex items-center gap-1"><ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" /> CREDIT = Payment/Advance</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white font-semibold text-xs rounded-lg hover:bg-black transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}
