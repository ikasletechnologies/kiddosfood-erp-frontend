"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Scale } from "lucide-react";
import { clsx } from "clsx";
import { reportsApi } from "@/lib/api";
import { toast } from "react-hot-toast";

interface TrialBalanceRow {
  name: string;
  debit: number;
  credit: number;
}

export default function TrialBalancePage() {
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getTrialBalance({ startDate, endDate });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatAmount = (amount: number) => `₹${(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalDebit = rows.reduce((s, r) => s + (r.debit || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (r.credit || 0), 0);
  const nonZeroRows = rows.filter((r) => (r.debit || 0) !== 0 || (r.credit || 0) !== 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 py-4 animate-in fade-in duration-700 text-slate-800 dark:text-slate-100 w-full min-w-0">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 sm:gap-6 border-b border-gray-100 dark:border-white/5 pb-6 sm:pb-8 w-full min-w-0">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full shrink-0" />
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Trial Balance</h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Every ledger account&apos;s closing balance for the selected period — debits must equal credits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 font-medium text-slate-600 dark:text-white bg-white dark:bg-[#13151f]"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 font-medium text-slate-600 dark:text-white bg-white dark:bg-[#13151f]"
          />
          <button
            onClick={fetchData}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all active:scale-90"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/20 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Loading Trial Balance</p>
        </div>
      ) : nonZeroRows.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center gap-3 text-center">
          <Scale size={36} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No ledger activity for the selected period.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm w-full min-w-0">
          <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
            <table className="w-full text-sm min-w-[550px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  <th className="text-left px-6 py-3.5 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider">Particulars</th>
                  <th className="text-right px-6 py-3.5 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider">Debit</th>
                  <th className="text-right px-6 py-3.5 font-bold text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {nonZeroRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">{row.name}</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{row.debit ? formatAmount(row.debit) : "—"}</td>
                    <td className="px-6 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{row.credit ? formatAmount(row.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-t-2 border-slate-200 dark:border-white/10">
                  <td className="px-6 py-4 font-black text-slate-900 dark:text-white">Total</td>
                  <td className="px-6 py-4 text-right font-black font-mono text-slate-900 dark:text-white">{formatAmount(totalDebit)}</td>
                  <td className="px-6 py-4 text-right font-black font-mono text-slate-900 dark:text-white">{formatAmount(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {Math.abs(totalDebit - totalCredit) > 0.01 && (
            <div className="px-6 py-3 bg-amber-50 dark:bg-amber-500/10 border-t border-amber-100 dark:border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Debit and credit totals differ by {formatAmount(Math.abs(totalDebit - totalCredit))} — several ledger
              categories (Fixed Assets, Capital Account, etc.) aren&apos;t tracked yet, so this won&apos;t always
              balance to zero.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
