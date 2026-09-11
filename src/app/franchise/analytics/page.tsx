"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  Building2, TrendingUp, RefreshCw, BarChart3, ArrowLeft, 
  ShoppingBag, IndianRupee, Layers, PieChart
} from "lucide-react";
import { dashboardApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { 
  RevenueIntelligence, KPICard 
} from "@/components/dashboard/DashboardComponents";
import { Cell, Pie, PieChart as ReChartsPieChart, ResponsiveContainer, Tooltip } from "recharts";

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

const COLORS = ["#f58220", "#1E4D2B", "#8B5CF6", "#3B82F6", "#EC4899"];

export default function FranchiseAnalyticsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const monitorId = searchParams?.get("id");

  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const fId = monitorId || undefined;
      const res = await dashboardApi.getSummary({ franchiseId: fId, period });
      setSummary(res.data);
    } catch (e) {
      console.error("Analytics fetch failed", e);
    } finally {
      setLoading(false);
    }
  }, [monitorId, period]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8 py-4 sm:py-6 px-3 sm:px-4 pb-16 min-w-0 animate-in fade-in duration-300">
      
      {/* ── Top Action Toolbar ── */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={monitorId ? `/franchise/dashboard?id=${monitorId}` : "/franchise/dashboard"}
            className="p-1.5 sm:p-2 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </Link>
          {loading && <RefreshCw size={13} className="text-[#F58220] animate-spin" />}
        </div>

        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 bg-white dark:bg-card border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 transition-all"
        >
          <RefreshCw size={13} />
          <span>Sync Analytics</span>
        </button>
      </div>

      {/* ── Premium High-Level Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
        <KPICard 
          title="Period Sales" 
          value={fmt(summary?.stats?.totalSales ?? 0)} 
          icon={TrendingUp} 
          colorClass="emerald"
          supportingText="Total revenue generated"
          insight="Gross Receipts"
        />
        <KPICard 
          title="Stock Valuation" 
          value={fmt(summary?.stats?.inventoryValue ?? 0)} 
          icon={Layers} 
          colorClass="amber"
          supportingText="Value of finished stock"
          insight={`${summary?.stats?.inventoryItemCount ?? 0} active lines`}
        />
        <KPICard 
          title="Total Receivables" 
          value={fmt(summary?.stats?.outstandingAmount ?? 0)} 
          icon={IndianRupee} 
          colorClass="rose"
          supportingText="Dealer outstanding credits"
          insight={`${summary?.stats?.overdueDealersCount ?? 0} overdue dealers`}
        />
        <KPICard 
          title="Period Expenses" 
          value={fmt(summary?.stats?.expensesToday ?? 0)} 
          icon={Building2} 
          colorClass="indigo"
          supportingText="Recorded branch costs"
          insight="Operational spend"
        />
      </div>

      {/* ── Revenue Intelligence Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0">
        <div className="lg:col-span-2 w-full min-w-0">
          <RevenueIntelligence
            data={(summary?.historicalSales ?? []).map((s: any) => ({
              ...s,
              sales: s.sales || 0,
              purchase: s.purchase || 0,
              profit: (s.sales || 0) - (s.purchase || 0),
            }))}
            title="Revenue Intelligence"
            trend={summary?.stats?.revenueChangePct ?? "0.0"}
            period={period}
            setPeriod={setPeriod}
          />
        </div>

        {/* Right: Revenue Breakdown & Top Sellers */}
        <div className="space-y-4 sm:space-y-6 flex flex-col w-full min-w-0">
          {/* Pie Chart of Revenue Streams */}
          <div className="bg-white dark:bg-card border border-slate-200/60 dark:border-white/5 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-sm flex-1 flex flex-col justify-between w-full min-w-0">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-4">
              Revenue Breakdown
            </h3>
            
            <div className="h-[180px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <ReChartsPieChart>
                  <Pie
                    data={summary?.revenueBreakdown ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(summary?.revenueBreakdown ?? []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmt(value)} />
                </ReChartsPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Sales</p>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-none mt-1">
                  {fmt(summary?.stats?.totalSales ?? 0)}
                </p>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {(summary?.revenueBreakdown ?? []).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-600 dark:text-zinc-400">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-black text-slate-950 dark:text-white">{fmt(item.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Sellers */}
          <div className="bg-white dark:bg-card border border-slate-200/60 dark:border-white/5 rounded-[2rem] p-6 shadow-sm flex-1">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-4">
              Top Selling Lines
            </h3>

            <div className="space-y-3">
              {(summary?.topSellers ?? []).map((prod: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{prod.name}</p>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">{prod.value} units sold</p>
                    </div>
                  </div>
                  <TrendingUp size={14} className="text-emerald-500" />
                </div>
              ))}
              {(summary?.topSellers ?? []).length === 0 && (
                <p className="text-center py-8 text-slate-400 font-bold uppercase tracking-wider text-[10px]">No sales recorded in this period.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
