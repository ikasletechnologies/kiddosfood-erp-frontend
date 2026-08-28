"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Landmark, ChevronDown, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { reportsApi } from "@/lib/api";
import { toast } from "react-hot-toast";

interface LineItem {
  name: string;
  amount: number;
  notes?: string;
}

interface BalanceSheetData {
  assets: LineItem[];
  liabilities: LineItem[];
  details: {
    sundryDebtors: { name: string; amount: number }[];
    sundryCreditors: { name: string; amount: number }[];
    accounts: { name: string; type: string; balance: number }[];
    cashBalance: number;
    bankBalance: number;
    upiBalance: number;
  };
}

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showDebtors, setShowDebtors] = useState(false);
  const [showCreditors, setShowCreditors] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getBalanceSheet({ endDate: asOfDate });
      setData(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatAmount = (amount: number) => `₹${(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalAssets = (data?.assets || []).reduce((s, a) => s + (a.amount || 0), 0);
  const totalLiabilities = (data?.liabilities || []).reduce((s, l) => s + (l.amount || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4 animate-in fade-in duration-700 text-gray-800 dark:text-slate-100">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 border-b border-gray-100 dark:border-white/5 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full" />
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Balance Sheet</h1>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">What the business owns versus what it owes, as of a point in time.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">As of</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
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
          <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Loading Balance Sheet</p>
        </div>
      ) : !data ? (
        <div className="py-32 flex flex-col items-center justify-center gap-3 text-center">
          <Landmark size={36} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No data available.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 dark:bg-white/[0.02] px-6 py-3.5 border-b border-gray-100 dark:border-white/5">
              <h2 className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-wider">Assets</h2>
            </div>
            <div>
              {data.assets.map((row, idx) => (
                <div key={idx} className="px-6 py-3 flex justify-between items-center border-b border-gray-50 dark:border-white/5 last:border-0">
                  <div>
                    <p className="font-medium text-sm text-slate-700 dark:text-slate-200">{row.name}</p>
                    {row.notes && row.notes !== "—" && <p className="text-[11px] text-slate-400 dark:text-slate-500">{row.notes}</p>}
                  </div>
                  <p className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{formatAmount(row.amount)}</p>
                </div>
              ))}
              {data.details.sundryDebtors.length > 0 && (
                <div className="px-6 py-3 bg-slate-50/50 dark:bg-white/[0.02]">
                  <button
                    onClick={() => setShowDebtors((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400"
                  >
                    {showDebtors ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Sundry Debtors breakdown ({data.details.sundryDebtors.length})
                  </button>
                  {showDebtors && (
                    <div className="mt-2 space-y-1.5 pl-5">
                      {data.details.sundryDebtors.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{d.name}</span>
                          <span className="font-mono">{formatAmount(d.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="bg-slate-900 dark:bg-[#0c0d14] px-6 py-4 flex justify-between items-center">
              <p className="font-black text-white text-sm uppercase tracking-wide">Total Assets</p>
              <p className="font-mono font-black text-white">{formatAmount(totalAssets)}</p>
            </div>
          </div>

          {/* Liabilities */}
          <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 dark:bg-white/[0.02] px-6 py-3.5 border-b border-gray-100 dark:border-white/5">
              <h2 className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-wider">Liabilities &amp; Equity</h2>
            </div>
            <div>
              {data.liabilities.map((row, idx) => (
                <div key={idx} className="px-6 py-3 flex justify-between items-center border-b border-gray-50 dark:border-white/5 last:border-0">
                  <div>
                    <p className="font-medium text-sm text-slate-700 dark:text-slate-200">{row.name}</p>
                    {row.notes && row.notes !== "—" && <p className="text-[11px] text-slate-400 dark:text-slate-500">{row.notes}</p>}
                  </div>
                  <p className="font-mono text-sm font-semibold text-slate-800 dark:text-white">{formatAmount(row.amount)}</p>
                </div>
              ))}
              {data.details.sundryCreditors.length > 0 && (
                <div className="px-6 py-3 bg-slate-50/50 dark:bg-white/[0.02]">
                  <button
                    onClick={() => setShowCreditors((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400"
                  >
                    {showCreditors ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Sundry Creditors breakdown ({data.details.sundryCreditors.length})
                  </button>
                  {showCreditors && (
                    <div className="mt-2 space-y-1.5 pl-5">
                      {data.details.sundryCreditors.map((c, i) => (
                        <div key={i} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{c.name}</span>
                          <span className="font-mono">{formatAmount(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="bg-slate-900 dark:bg-[#0c0d14] px-6 py-4 flex justify-between items-center">
              <p className="font-black text-white text-sm uppercase tracking-wide">Total Liabilities &amp; Equity</p>
              <p className="font-mono font-black text-white">{formatAmount(totalLiabilities)}</p>
            </div>
          </div>
        </div>
      )}

      {data && Math.abs(totalAssets - totalLiabilities) > 0.01 && (
        <div className="px-6 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400">
          Assets and Liabilities differ by {formatAmount(Math.abs(totalAssets - totalLiabilities))} — some ledger
          categories (Fixed Assets, Capital Account, etc.) aren&apos;t tracked yet, so this is expected until
          those are added.
        </div>
      )}
    </div>
  );
}
