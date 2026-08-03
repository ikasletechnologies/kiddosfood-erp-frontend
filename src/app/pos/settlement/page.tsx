"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft as ArrowLeftIcon, 
  Banknote as BanknoteIcon, 
  CreditCard as CreditCardIcon, 
  QrCode as QrCodeIcon, 
  CheckCircle2 as CheckCircle2Icon, 
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  LayoutDashboard as LayoutDashboardIcon,
  Printer as PrinterIcon,
  History as HistoryIcon,
  ShieldCheck as ShieldCheckIcon,
  Zap as ZapIcon
} from "lucide-react";
import { clsx } from "clsx";
import { posApi, posSettlementApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import Link from "next/link";

interface SettlementStats {
  cash: number;
  upi: number;
  card: number;
  total: number;
  orderCount: number;
}

interface SettlementRecord {
  id: string;
  businessDate: string;
  cashTotal: number;
  upiTotal: number;
  cardTotal: number;
  grandTotal: number;
  orderCount: number;
  closedBy?: string;
  createdAt: string;
}

export default function SettlementPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SettlementStats>({
    cash: 0,
    upi: 0,
    card: 0,
    total: 0,
    orderCount: 0,
  });
  const [settling, setSettling] = useState(false);
  const [todaySettlement, setTodaySettlement] = useState<SettlementRecord | null>(null);
  const [latestSettlement, setLatestSettlement] = useState<SettlementRecord | null>(null);
  const settled = !!todaySettlement;

  useEffect(() => {
    fetchTodayStats();
    fetchSettlementStatus();
  }, []);

  const fetchTodayStats = async () => {
    setLoading(true);
    try {
      const res = await posApi.getOrders({
        date: new Date().toISOString().split('T')[0],
        status: 'COMPLETED'
      });
      const orders = res.data?.data || res.data || [];

      const newStats = orders.reduce((acc: SettlementStats, order: any) => {
        const amt = order.totalAmount || 0;
        if (order.paymentMode === 'CASH') acc.cash += amt;
        else if (order.paymentMode === 'UPI') acc.upi += amt;
        else if (order.paymentMode === 'CARD') acc.card += amt;
        acc.total += amt;
        acc.orderCount += 1;
        return acc;
      }, { cash: 0, upi: 0, card: 0, total: 0, orderCount: 0 });

      setStats(newStats);
    } catch (e) {
      console.error("Failed to fetch settlement stats", e);
      toast.error("Could not load today's sales data");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettlementStatus = async () => {
    try {
      const [todayRes, latestRes] = await Promise.all([
        posSettlementApi.getToday(),
        posSettlementApi.getLatest(),
      ]);
      setTodaySettlement(todayRes.data);
      setLatestSettlement(latestRes.data);
    } catch (e) {
      console.error("Failed to fetch settlement status", e);
    }
  };

  const handleSettle = async () => {
    setSettling(true);
    try {
      const settlement = await posSettlementApi.closeDay({
        cashTotal: stats.cash,
        upiTotal: stats.upi,
        cardTotal: stats.card,
        grandTotal: stats.total,
        orderCount: stats.orderCount,
      });
      setTodaySettlement(settlement.data);
      setLatestSettlement(settlement.data);
      toast.success("Day settled successfully!");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to settle the day");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 border-b border-slate-200/60 dark:border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/pos" className="p-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-slate-50 transition-all">
              <ArrowLeftIcon size={18} className="text-slate-500" />
            </Link>
            <div className="p-3 bg-indigo-500 rounded-2xl shadow-xl shadow-indigo-500/20">
              <ShieldCheckIcon size={24} className="text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              End of Day <span className="text-slate-400 font-medium ml-1 tracking-tighter italic">Settlement</span>
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium ml-28 uppercase tracking-widest text-[10px]">
            Finalize your terminal collection and reconcile with business accounts
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white dark:bg-white/5 px-6 py-3 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center gap-3">
            <CalendarIcon size={16} className="text-indigo-500" />
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Business Date</p>
              <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Collection Breakdown */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Cash Collection", value: stats.cash, icon: BanknoteIcon, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
              { label: "UPI Collection", value: stats.upi, icon: QrCodeIcon, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { label: "Card Payments", value: stats.card, icon: CreditCardIcon, color: "text-violet-500", bg: "bg-violet-500/10", border: "border-violet-500/20" },
            ].map((item, i) => (
              <div key={i} className={clsx("bg-white dark:bg-card/40 p-6 rounded-[32px] border shadow-xl shadow-black/[0.02] flex flex-col items-center text-center group hover:scale-[1.02] transition-all", item.border)}>
                <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all group-hover:rotate-6", item.bg, item.color)}>
                  <item.icon size={28} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                <div className={clsx("text-3xl font-black tabular-nums tracking-tight", item.color)}>₹{item.value.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Today's Sales Summary */}
          <div className="bg-white dark:bg-card/40 rounded-[40px] border border-slate-100 dark:border-white/5 overflow-hidden shadow-2xl shadow-black/[0.03]">
            <div className="p-8 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <HistoryIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Today's Sales Breakdown</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Live transaction summary for current session</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Orders</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.orderCount}</p>
              </div>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Cash</span>
                    <span className="text-slate-900 dark:text-white font-black">₹{stats.cash.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> UPI</span>
                    <span className="text-slate-900 dark:text-white font-black">₹{stats.upi.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-violet-500" /> Card</span>
                    <span className="text-slate-900 dark:text-white font-black">₹{stats.card.toLocaleString()}</span>
                  </div>
                  <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex justify-between items-center">
                    <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Gross Total</span>
                    <span className="text-2xl font-black text-indigo-500">₹{stats.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-8 bg-indigo-500 rounded-3xl text-white shadow-xl shadow-indigo-500/20 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                  <ZapIcon size={32} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Estimated Collection</p>
                  <h4 className="text-4xl font-black tracking-tighter">₹{stats.total.toLocaleString()}</h4>
                </div>
                <p className="text-[10px] font-medium opacity-60 max-w-[200px]">
                  Ensure physical cash in drawer matches the cash collection figure before settling.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-card/40 p-8 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl shadow-black/[0.03] sticky top-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">Settlement Action</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">1</div>
                <p>Verify physical cash in drawer</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">2</div>
                <p>Check all UPI/Card slips</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">3</div>
                <p>Confirm final EOD settlement</p>
              </div>
            </div>

            {settled ? (
              <div className="p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-3xl text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2Icon size={24} />
                </div>
                <div>
                  <h4 className="text-emerald-700 dark:text-emerald-400 font-black text-sm uppercase tracking-tight">Settled Successfully</h4>
                  <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mt-1">Terminal Closed</p>
                </div>
                <button className="w-full py-4 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
                  <PrinterIcon size={16} /> Print EOD Report
                </button>
              </div>
            ) : (
              <button
                onClick={handleSettle}
                disabled={settling || stats.total === 0}
                className="w-full py-6 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-100 dark:disabled:bg-white/5 disabled:text-slate-400 text-white rounded-[32px] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 transition-all hover:translate-y-[-2px] active:translate-y-0 flex items-center justify-center gap-3"
              >
                {settling ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    Settling...
                  </>
                ) : (
                  <>Perform Day Settle <ArrowLeftIcon className="rotate-180" size={18} /></>
                )}
              </button>
            )}

            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5 space-y-4">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Last Settlement</span>
                <span className="text-slate-600 dark:text-slate-300">
                  {latestSettlement
                    ? `${new Date(latestSettlement.businessDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date(latestSettlement.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                    : "Never"}
                </span>
              </div>
              {latestSettlement?.closedBy && (
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Closed By</span>
                  <span className="text-slate-600 dark:text-slate-300">{latestSettlement.closedBy}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
