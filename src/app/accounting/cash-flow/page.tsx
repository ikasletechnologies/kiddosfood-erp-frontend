"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, ArrowDownRight, RefreshCw, Wallet, Building2, Smartphone, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { clsx } from "clsx";
import { accountingApi } from "@/lib/api/accounting.api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

interface CashFlowSummary {
  accounts: any[];
  totalLiquidity: number;
  breakdown: {
    cash: number;
    bank: number;
    upi: number;
  };
}

interface Payment {
  id: string;
  paymentNumber?: string;
  date: string;
  entity: string;
  flow: "IN" | "OUT";
  method: string;
  amount: number;
  status: string;
  accountName?: string;
}

export default function CashFlowPage() {
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCashFlow = useCallback(async () => {
    setLoading(true);
    try {
      const [cashRes, paymentsRes] = await Promise.all([
        accountingApi.getCashFlow(),
        accountingApi.getPayments()
      ]);
      setSummary(cashRes.data);
      // Filter for PAID payments only for the cash flow statement
      const allPayments = paymentsRes.data?.payments || [];
      const settled = allPayments.filter((p: any) => p.status === 'PAID' && !p.isCancelled);
      setPayments(settled);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load cash flow data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCashFlow();
  }, [fetchCashFlow]);

  // Calculate Inflows and Outflows for the current period (assuming all fetched for now, can be paginated/filtered)
  const totalInflows = payments.filter(p => p.flow === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
  const totalOutflows = payments.filter(p => p.flow === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);
  const netCashFlow = totalInflows - totalOutflows;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 animate-in fade-in duration-500 w-full min-w-0">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 w-full min-w-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet size={22} className="text-orange-500" />
              Cash Flow Overview
            </h1>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Track your business&apos;s liquidity and cash position in real-time.
          </p>
        </div>
        <button
          onClick={fetchCashFlow}
          title="Refresh Overview"
          className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95"
        >
          <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
        </button>
      </div>

      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-500 animate-pulse">Loading Overview...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Liquidity Section ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-5 text-white flex flex-col justify-between border border-slate-800 dark:border-slate-700 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-8 -mt-8" />
              <div className="space-y-1 relative z-10">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Liquidity</p>
                <p className="text-3xl font-black tabular-nums tracking-tight">₹{summary?.totalLiquidity.toLocaleString("en-IN") || '0'}</p>
              </div>
              <div className="flex items-center gap-2 mt-4 text-slate-400">
                <Wallet size={16} /> <span className="text-xs font-semibold">Total Cash Equivalents</span>
              </div>
            </div>
            
            {[
              {
                label: "Cash In Hand",
                val: summary?.breakdown?.cash || 0,
                desc: "Physical Cash",
                icon: DollarSign,
                color: "text-emerald-700 dark:text-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-950/20",
                border: "border-emerald-200 dark:border-emerald-900/30",
              },
              {
                label: "Bank Balance",
                val: summary?.breakdown?.bank || 0,
                desc: "Bank Accounts",
                icon: Building2,
                color: "text-blue-700 dark:text-blue-400",
                bg: "bg-blue-50 dark:bg-blue-950/20",
                border: "border-blue-200 dark:border-blue-900/30",
              },
              {
                label: "UPI / Wallets",
                val: summary?.breakdown?.upi || 0,
                desc: "Digital Wallets",
                icon: Smartphone,
                color: "text-indigo-700 dark:text-indigo-400",
                bg: "bg-indigo-50 dark:bg-indigo-950/20",
                border: "border-indigo-200 dark:border-indigo-900/30",
              },
            ].map((s, i) => (
              <div key={i} className={clsx("rounded-2xl p-5 flex flex-col justify-between border shadow-sm", s.bg, s.border)}>
                <div className="space-y-1">
                  <p className={clsx("text-xs font-bold uppercase tracking-wider", s.color)}>{s.label}</p>
                  <p className={clsx("text-2xl font-black tabular-nums tracking-tight", s.color)}>₹{s.val.toLocaleString("en-IN")}</p>
                </div>
                <div className={clsx("flex items-center gap-2 mt-4", s.color, "opacity-90")}>
                  <s.icon size={16} /> <span className="text-xs font-semibold">{s.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Operating Cash Flow Summary ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 shrink-0">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Inflows</p>
                <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white leading-none">+₹{totalInflows.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 shrink-0">
                <TrendingDown size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Outflows</p>
                <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white leading-none">-₹{totalOutflows.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className={clsx(
              "border rounded-2xl p-6 shadow-sm flex flex-col justify-center",
              netCashFlow >= 0 
                ? "bg-emerald-600 text-white border-emerald-700 dark:border-emerald-800" 
                : "bg-red-600 text-white border-red-700 dark:border-red-800"
            )}>
              <p className="text-xs font-bold text-white/80 uppercase tracking-wider mb-1">Net Cash Flow (Period)</p>
              <p className="text-3xl font-black tabular-nums leading-none tracking-tight">
                {netCashFlow >= 0 ? '+' : ''}₹{netCashFlow.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* ── Recent Flow Activity ── */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Cash Movements</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md">Settled Transactions</span>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <th className="px-6 py-3 text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Date & Ref</th>
                    <th className="px-6 py-3 text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Description</th>
                    <th className="px-6 py-3 text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Flow</th>
                    <th className="px-6 py-3 text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Account</th>
                    <th className="px-6 py-3 text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {payments.slice(0, 15).map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">{payment.paymentNumber || "—"}</p>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                          {formatDate(payment.date)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{payment.entity || "—"}</p>
                      </td>
                      <td className="px-6 py-4">
                        {payment.flow === "IN" ? (
                          <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-800/30 text-[10px] font-bold uppercase tracking-wider">
                            <ArrowDownRight size={12} strokeWidth={2.5} /> Inflow
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-md border border-red-100 dark:border-red-800/30 text-[10px] font-bold uppercase tracking-wider">
                            <ArrowUpRight size={12} strokeWidth={2.5} /> Outflow
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                          {payment.accountName || payment.method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className={clsx("text-sm font-bold tabular-nums", payment.flow === "IN" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white")}>
                          {payment.flow === "IN" ? "+" : "-"}₹{payment.amount.toLocaleString("en-IN")}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <p className="text-sm font-semibold text-slate-500">No recent cash movements found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {payments.length > 15 && (
              <div className="p-3 text-center border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                <p className="text-xs font-semibold text-slate-500">Showing last 15 settled transactions</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
