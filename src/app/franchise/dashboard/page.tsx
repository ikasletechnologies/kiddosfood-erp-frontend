"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Package, AlertTriangle, TrendingUp, RefreshCw, ArrowRight, Truck,
  Landmark, CreditCard, ChevronRight, BarChart3, Undo2, Users,
  Receipt, Plus, ClipboardList, CheckCircle2, AlertCircle, ShoppingCart
} from "lucide-react";
import { clsx } from "clsx";
import { dashboardApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function FranchiseDashboardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const monitorId = searchParams.get("id");

  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const fId = monitorId || undefined;
      const res = await dashboardApi.getSummary({ franchiseId: fId });
      setSummary(res.data);
    } catch (e) {
      console.error("Dashboard synchronization error", e);
    } finally {
      setLoading(false);
    }
  }, [monitorId]);

  // Dynamic Polling every 30 seconds for real-time operational KPI sync
  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => {
      fetchAll();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const kpis = [
    { label: "Today's Billing", val: fmt(summary?.stats?.revenueToday ?? 0), sub: "Gross billing today", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { label: "Pending Collections", val: fmt(summary?.stats?.pendingCollections ?? 0), sub: "Dealer unpaid amount", icon: Landmark, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950/20" },
    { label: "Low Stock Alerts", val: summary?.stats?.lowStockCount ?? 0, sub: "Below threshold", icon: Package, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20" },
    { label: "Pending Deliveries", val: summary?.stats?.pendingDeliveries ?? 0, sub: "Orders not delivered", icon: Truck, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { label: "Active Dealers", val: summary?.stats?.dealerCount ?? 0, sub: "Active network size", icon: Users, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/20" },
    { label: "Sales Returns", val: fmt(summary?.stats?.salesReturnsToday ?? 0), sub: "Returned today value", icon: Undo2, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-900" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4 py-4 px-4 pb-16 animate-in fade-in duration-300">
      
      {/* ── Top Action Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAll}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Refresh dashboard"
          >
            <RefreshCw
              size={13}
              className={clsx("transition-transform", loading && "animate-spin text-[#F58220]")}
            />
            <span>Sync</span>
          </button>
        </div>

        {/* ── High-Velocity Quick Actions ── */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Link href={monitorId ? `/franchise/analytics?id=${monitorId}` : "/franchise/analytics"} className="flex-1 sm:flex-initial justify-center flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-white/10 whitespace-nowrap">
            <BarChart3 size={13} /> View Analytics
          </Link>
          <Link href="/pos" className="flex-1 sm:flex-initial justify-center flex items-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap">
            <Plus size={13} /> New Invoice
          </Link>
          <Link href="/purchases/inward" className="flex-1 sm:flex-initial justify-center flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap">
            <Plus size={13} /> Receive Stock
          </Link>
          <Link href="/accounting/ledgers" className="flex-1 sm:flex-initial justify-center flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap">
            <Plus size={13} /> Record Payment
          </Link>
          <Link href="/franchise/dealers" className="flex-1 sm:flex-initial justify-center flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap">
            <Plus size={13} /> Create Dealer
          </Link>
        </div>
      </div>

      {/* ── Expiry Alert Banner ── */}
      {summary?.stats?.lowStockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-300">Inventory Alert Queue</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                {summary?.stats?.lowStockCount} items require immediate replenishment or are near expiration.
              </p>
            </div>
          </div>
          <Link href="/franchise/stock" className="w-full sm:w-auto text-center px-3 py-1.5 bg-white dark:bg-white/10 border border-amber-200 dark:border-white/10 text-amber-600 dark:text-amber-300 text-[10px] font-black rounded-lg hover:bg-amber-50 transition-all uppercase tracking-wider whitespace-nowrap">
            Reorder Stock
          </Link>
        </div>
      )}

      {/* ── Operational KPI Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-white/10 transition-all duration-200 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{stat.label}</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.val}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{stat.sub}</p>
            </div>
            <div className={clsx("p-2.5 rounded-xl shrink-0 flex items-center justify-center", stat.bg)}>
              <stat.icon size={16} className={clsx(stat.color, "stroke-[2px]")} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Recent Invoices & Clickable Today's Operations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left: Recent Invoices */}
        <div className="lg:col-span-2 bg-white dark:bg-card border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Recent Sales Invoices</h3>
              <p className="text-[10px] text-slate-500 font-medium">Today's billing pipeline overview.</p>
            </div>
            <Link href="/pos/invoices" className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline flex items-center gap-1">
              View All <ChevronRight size={10} />
            </Link>
          </div>

          <div className="overflow-x-auto min-h-[220px]">
            <table className="w-full min-w-[500px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Invoice #</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Dealer/Customer</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {(summary?.recentOrders || []).slice(0, 5).map((order: any) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{order.id}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-semibold">{order.customerName}</td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-900 dark:text-white">{fmt(order.amount)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                        order.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        order.status === "pending" ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-red-50 text-red-600 border-red-100"
                      )}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(summary?.recentOrders || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400 font-bold uppercase tracking-wider text-[10px]">No invoices recorded today.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Today's Operations (Actionable Workflow Center) */}
        <div className="bg-white dark:bg-card border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <div className="mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Today's Operations</h3>
            <p className="text-[10px] text-slate-500 font-medium">Critical action queue with immediate navigation.</p>
          </div>

          <div className="space-y-2">
            {[
              { label: "Pending Deliveries", val: summary?.stats?.pendingDeliveries ?? 0, sub: "items needing shipment", href: "/franchise-orders", color: "text-blue-600 border-blue-100 bg-blue-50/50" },
              { label: "Pending Collections", val: fmt(summary?.stats?.pendingCollections ?? 0), sub: "overdue from dealers", href: "/accounting/ledgers", color: "text-rose-600 border-rose-100 bg-rose-50/50" },
              { label: "Low Stock Alerts", val: summary?.stats?.lowStockCount ?? 0, sub: "under safety limit", href: "/franchise/stock", color: "text-amber-600 border-amber-100 bg-amber-50/50" },
              { label: "Invoices Pending", val: summary?.stats?.orderCountToday ?? 0, sub: "sales draft status", href: "/pos/invoices", color: "text-slate-600 border-slate-100 bg-slate-50" },
              { label: "Overdue Dealers", val: summary?.stats?.overdueDealersCount ?? 0, sub: "requires ledger review", href: "/franchise/dealers", color: "text-purple-600 border-purple-100 bg-purple-50/50" }
            ].map((op, idx) => (
              <Link 
                key={idx}
                href={op.href}
                className="group flex items-center justify-between p-3 bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-xl hover:bg-white dark:hover:bg-card hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-sm transition-all"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 dark:text-zinc-300 group-hover:text-indigo-500 transition-colors">{op.label}</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase">{op.sub}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={clsx("px-2.5 py-1 rounded-lg text-xs font-black border", op.color)}>
                    {op.val}
                  </span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Inventory Alerts & Dealer Outstanding ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left: Inventory Alerts */}
        <div className="bg-white dark:bg-card border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Inventory Status</h3>
              <p className="text-[10px] text-slate-500 font-medium">Finished product batch alerts & refill actions.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/franchise-orders" className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors">
                Refill Stock
              </Link>
              <Link href="/purchases/new" className="bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors">
                Create Purchase Order
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[200px]">
            <table className="w-full min-w-[500px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Stock</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Days Left</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {(summary?.inventoryAlerts || []).slice(0, 5).map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{item.productName}</td>
                    <td className="px-4 py-2.5 text-center font-black text-slate-700 dark:text-zinc-300">{item.currentStock} {item.unit}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-500">{item.daysLeft}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                        item.status === "GREEN" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        item.status === "YELLOW" ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-red-50 text-red-600 border-red-100"
                      )}>
                        {item.refillSuggestion}
                      </span>
                    </td>
                  </tr>
                ))}
                {(summary?.inventoryAlerts || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400 font-bold uppercase tracking-wider text-[10px]">No active inventory data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Dealer Outstanding with Aging */}
        <div className="bg-white dark:bg-card border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Dealer Outstanding</h3>
              <p className="text-[10px] text-slate-500 font-medium">Dealer credits, last payments and aging prioritization.</p>
            </div>
            <Link href="/franchise/dealers" className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline">
              Manage Partners
            </Link>
          </div>

          <div className="overflow-x-auto min-h-[200px]">
            <table className="w-full min-w-[500px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Dealer</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Outstanding</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Last Payment</th>
                  <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Collection Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {(summary?.dealerOutstanding || []).slice(0, 5).map((dealer: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{dealer.dealer}</td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-900 dark:text-white">{fmt(dealer.due)}</td>
                    <td className="px-4 py-2.5 text-center text-slate-500 font-semibold">{dealer.lastPayment}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                        dealer.priority === "LOW" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        dealer.priority === "MEDIUM" ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-red-50 text-red-600 border-red-100"
                      )}>
                        {dealer.priority} ({dealer.agingDays}d)
                      </span>
                    </td>
                  </tr>
                ))}
                {(summary?.dealerOutstanding || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400 font-bold uppercase tracking-wider text-[10px]">No active dealer debts detected.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Row 4: Pending Dispatch Queue ── */}
      <div className="bg-white dark:bg-card border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/5 pb-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Pending Dispatch Pipeline</h3>
            <p className="text-[10px] text-slate-500 font-medium">Track dealer invoices that require physical shipping.</p>
          </div>
          <Link href="/franchise-orders" className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline flex items-center gap-1">
            Dispatch Queue <ChevronRight size={10} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Dealer</th>
                <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Pending Invoices Count</th>
                <th className="px-4 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Dispatch Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {(summary?.pendingDispatchQueue || []).slice(0, 5).map((dispatch: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{dispatch.dealer}</td>
                  <td className="px-4 py-2.5 text-center font-black text-slate-700 dark:text-zinc-300">{dispatch.invoiceCount}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                      dispatch.dispatchStatus === "Ready to Dispatch" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      dispatch.dispatchStatus === "Preparing" ? "bg-blue-50 text-blue-600 border-blue-100" :
                      "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {dispatch.dispatchStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {(summary?.pendingDispatchQueue || []).length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-slate-400 font-bold uppercase tracking-wider text-[10px]">All shipments dispatched and settled.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
