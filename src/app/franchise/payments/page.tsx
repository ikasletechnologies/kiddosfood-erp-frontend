"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CreditCard, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, ArrowRight, ShoppingCart, TrendingDown, TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";
import { franchiseOrdersApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  PAID:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/30",
  UNPAID:  "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700/30",
  PARTIAL: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/30",
};

const ORDER_STATUS_STYLE: Record<string, string> = {
  PENDING:       "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  APPROVED:      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700/30",
  IN_PRODUCTION: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-700/30",
  DISPATCHED:    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-700/30",
  DELIVERED:     "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700/30",
};

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default function FranchisePaymentsPage() {
  const [orders, setOrders]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"ALL" | "UNPAID" | "PAID" | "PARTIAL">("ALL");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await franchiseOrdersApi.getAll();
      setOrders(res.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Aggregates ───────────────────────────────────────────────────────────────
  const deliveredOrders   = orders.filter((o: any) => o.status === "DELIVERED");
  const totalValue        = deliveredOrders.reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0);
  const totalPaid         = deliveredOrders.filter((o: any) => o.paymentStatus === "PAID")
                                           .reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0);
  const totalUnpaid       = deliveredOrders.filter((o: any) => o.paymentStatus === "UNPAID")
                                           .reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0);
  const totalPartial      = deliveredOrders.filter((o: any) => o.paymentStatus === "PARTIAL")
                                           .reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0);

  const displayOrders = orders.filter((o: any) => {
    if (filter === "ALL") return true;
    return o.paymentStatus === filter;
  });

  const lastPaymentOrder = [...deliveredOrders]
    .filter((o: any) => o.paymentStatus === "PAID")
    .sort((a: any, b: any) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())[0];

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 print:bg-white print:p-0 animate-in fade-in duration-500">
      
      {/* ── Header Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end items-start sm:items-center print:hidden border-b border-slate-200 dark:border-slate-800 pb-4">
        <button 
          onClick={fetchOrders} 
          title="Refresh Ledger"
          className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95"
        >
          <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
        </button>
      </div>

      {/* ── Balance Summary Strip ── */}
      <div className="flex flex-col lg:flex-row gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {[
            { 
              label: "Outstanding Balance", 
              val: fmt(totalUnpaid + totalPartial), 
              sub: `${deliveredOrders.filter((o: any) => o.paymentStatus !== "PAID").length} pending orders`, 
              icon: AlertTriangle,
              color: "text-red-600",
              bg: "bg-red-50 dark:bg-red-950/20",
              border: "border-red-200 dark:border-red-900/30"
            },
            { 
              label: "Total Paid", 
              val: fmt(totalPaid), 
              sub: "Delivered & Settled", 
              icon: CheckCircle2,
              color: "text-emerald-600",
              bg: "bg-emerald-50 dark:bg-emerald-950/20",
              border: "border-emerald-200 dark:border-emerald-900/30"
            },
            { 
              label: "Total Order Value", 
              val: fmt(totalValue), 
              sub: `${deliveredOrders.length} delivered orders`, 
              icon: TrendingUp,
              color: "text-blue-600",
              bg: "bg-blue-50 dark:bg-blue-950/20",
              border: "border-blue-200 dark:border-blue-900/30"
            },
          ].map((s, i) => (
            <div key={i} className={clsx("flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm bg-white dark:bg-slate-800 flex-1 min-w-[200px]", s.border)}>
              <div className={clsx("p-2 rounded-lg", s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{s.label}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-none tracking-tight">{s.val}</p>
                  <p className="text-[10px] font-semibold text-slate-400 truncate max-w-[120px]">{s.sub}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pay Now Alert ── */}
      {(totalUnpaid + totalPartial) > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-red-900 dark:text-red-400">Outstanding Dues Detected</p>
              <p className="text-xs font-medium text-red-700/80 dark:text-red-500/80 mt-0.5">
                Please settle the pending amount to ensure uninterrupted supply.
              </p>
            </div>
          </div>
          <Link href="/franchise-orders" className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm text-center">
            Settle Ledger
          </Link>
        </div>
      )}

      {/* ── Ledger ── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Order History & Payments</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["ALL", "UNPAID", "PAID", "PARTIAL"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                  filter === f
                    ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-500 animate-pulse">Retrieving records...</p>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <CreditCard size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-500">No payment records found for the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-4 py-3">Order Reference</th>
                  <th className="px-4 py-3 hidden md:table-cell">Details</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {displayOrders.map((order: any) => {
                  const payStatus = order.paymentStatus ?? "UNPAID";
                  const statusClass = PAYMENT_STATUS_STYLE[payStatus] || PAYMENT_STATUS_STYLE.UNPAID;
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900 dark:text-white uppercase">#{order.orderNumber || order.id.slice(-6)}</p>
                        <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">{order.paymentType || 'Standard'}</p>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {order.items?.length || 0} Products Delivered
                        </p>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell text-xs font-medium text-slate-500 dark:text-slate-400">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">{fmt(order.totalAmount ?? 0)}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", statusClass)}>
                          {payStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
