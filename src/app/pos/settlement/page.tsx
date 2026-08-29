"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft as ArrowLeftIcon,
  Banknote as BanknoteIcon,
  CreditCard as CreditCardIcon,
  QrCode as QrCodeIcon,
  CheckCircle2 as CheckCircle2Icon,
  Calendar as CalendarIcon,
  Printer as PrinterIcon,
  History as HistoryIcon,
  ShieldCheck as ShieldCheckIcon,
  Zap as ZapIcon,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import { posSettlementApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

// Mirrors POSService.getDailySummary — server-computed from Order/Payment
// tables, never guessed from client-side aggregation.
interface DailySummary {
  businessDate: string;
  orderCount: number;
  grandTotal: number;
  cashTotal: number;
  upiTotal: number;
  cardTotal: number;
  otherTotal: number;
  collectionTotal: number;
  refundTotal: number;
  netTotal: number;
  reconciled: boolean;
}

const EMPTY_SUMMARY: DailySummary = {
  businessDate: new Date().toISOString(),
  orderCount: 0,
  grandTotal: 0,
  cashTotal: 0,
  upiTotal: 0,
  cardTotal: 0,
  otherTotal: 0,
  collectionTotal: 0,
  refundTotal: 0,
  netTotal: 0,
  reconciled: true,
};

interface SettlementRecord {
  id: string;
  businessDate: string;
  cashTotal: number;
  upiTotal: number;
  cardTotal: number;
  otherTotal?: number;
  grandTotal: number;
  refundTotal?: number;
  netTotal?: number;
  orderCount: number;
  closedBy?: string;
  createdAt: string;
}

export default function SettlementPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummary>(EMPTY_SUMMARY);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [todaySettlement, setTodaySettlement] = useState<SettlementRecord | null>(null);
  const [latestSettlement, setLatestSettlement] = useState<SettlementRecord | null>(null);
  const settled = !!todaySettlement;

  useEffect(() => {
    fetchSummary();
    fetchSettlementStatus();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await posSettlementApi.getSummary();
      setSummary(res.data);
    } catch (e) {
      console.error("Failed to fetch settlement summary", e);
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
    setSettleError(null);
    try {
      // No totals are sent — the backend recomputes and validates them
      // itself from Order/Payment records, then persists that snapshot.
      const settlement = await posSettlementApi.closeDay();
      setTodaySettlement(settlement.data);
      setLatestSettlement(settlement.data);
      toast.success("Day settled successfully!");
    } catch (e: any) {
      const msg = e.response?.data?.error || "Failed to settle the day";
      setSettleError(msg);
      toast.error(msg);
      // The attempted settle may have been blocked because our cached
      // summary was stale (e.g. another terminal already closed the day) —
      // re-sync so the UI reflects the real, current state.
      fetchSummary();
      fetchSettlementStatus();
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 print:bg-white print:p-0">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center print:hidden border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/pos"
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-all text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeftIcon size={14} />
            <span>Back to POS</span>
          </Link>
        </div>

        {/* Actions / Info */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm">
            <div className="flex items-center px-2 text-slate-400">
              <CalendarIcon size={14} />
            </div>
            <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold px-2">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider select-none">
                Business Date
              </span>
              <span className="text-slate-700 dark:text-slate-200 pl-1">
                {formatDate(new Date())}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary Row */}
      <div className="flex flex-col lg:flex-row gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {[
            {
              label: "Cash Collection",
              value: summary.cashTotal,
              icon: BanknoteIcon,
              color: "text-emerald-600",
              bg: "bg-emerald-50 dark:bg-emerald-950/20",
              borderColor: "border-emerald-200 dark:border-emerald-900/30",
            },
            {
              label: "UPI Collection",
              value: summary.upiTotal,
              icon: QrCodeIcon,
              color: "text-blue-600",
              bg: "bg-blue-50 dark:bg-blue-950/20",
              borderColor: "border-blue-200 dark:border-blue-900/30",
            },
            {
              label: "Card Payments",
              value: summary.cardTotal,
              icon: CreditCardIcon,
              color: "text-violet-600",
              bg: "bg-violet-50 dark:bg-violet-950/20",
              borderColor: "border-violet-200 dark:border-violet-900/30",
            },
            {
              label: "Total Orders",
              value: summary.orderCount,
              icon: HistoryIcon,
              color: "text-indigo-600",
              bg: "bg-indigo-50 dark:bg-indigo-950/20",
              borderColor: "border-indigo-200 dark:border-indigo-900/30",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm bg-white dark:bg-slate-800 flex-1 min-w-[200px]",
                s.borderColor
              )}
            >
              <div className={clsx("p-2 rounded-lg", s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {s.label}
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                  {s.label === "Total Orders"
                    ? s.value
                    : `₹${s.value.toLocaleString()}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Today's Sales Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Today's Sales Breakdown
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Live transaction summary
              </span>
            </div>
            <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" /> Cash
                  </span>
                  <span className="text-slate-900 dark:text-white font-bold tabular-nums">
                    ₹{summary.cashTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" /> UPI
                  </span>
                  <span className="text-slate-900 dark:text-white font-bold tabular-nums">
                    ₹{summary.upiTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-500" /> Card
                  </span>
                  <span className="text-slate-900 dark:text-white font-bold tabular-nums">
                    ₹{summary.cardTotal.toLocaleString()}
                  </span>
                </div>
                {summary.otherTotal > 0 && (
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400" /> Other
                    </span>
                    <span className="text-slate-900 dark:text-white font-bold tabular-nums">
                      ₹{summary.otherTotal.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Gross Total
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                    ₹{summary.grandTotal.toLocaleString()}
                  </span>
                </div>
                {summary.refundTotal > 0 && (
                  <>
                    <div className="flex justify-between items-center text-sm font-semibold text-rose-600 dark:text-rose-400">
                      <span>Refunds</span>
                      <span className="font-bold tabular-nums">− ₹{summary.refundTotal.toLocaleString()}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Net Collection
                      </span>
                      <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                        ₹{summary.netTotal.toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
                {!summary.reconciled && (
                  <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400">
                    <span>
                      Settlement mismatch detected. Payment mode total ₹{summary.collectionTotal.toLocaleString()} does not match expected collection ₹{summary.grandTotal.toLocaleString()}.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-center p-6 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-xl text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <ZapIcon size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600/70 dark:text-orange-400/70">
                    {summary.refundTotal > 0 ? "Net Collection" : "Estimated Collection"}
                  </p>
                  <h4 className="text-3xl font-black tracking-tight text-orange-600 dark:text-orange-400 mt-1 tabular-nums">
                    ₹{summary.netTotal.toLocaleString()}
                  </h4>
                </div>
                <p className="text-[11px] font-medium text-orange-600/60 dark:text-orange-400/60 max-w-[200px]">
                  Cash + UPI + Card{summary.refundTotal > 0 ? " − Refunds" : ""}. Ensure physical cash matches before settling.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Settlement Action */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden sticky top-8">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Settlement Action
              </h3>
            </div>
            <div className="p-5 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                    1
                  </div>
                  <p>Verify physical cash in drawer</p>
                </div>
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                    2
                  </div>
                  <p>Check all UPI/Card slips</p>
                </div>
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                    3
                  </div>
                  <p>Confirm final EOD settlement</p>
                </div>
              </div>

              {settled ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2Icon size={20} />
                  </div>
                  <div>
                    <h4 className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                      Settled Successfully
                    </h4>
                    <p className="text-[11px] font-semibold text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                      Terminal Closed
                    </p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="w-full py-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    <PrinterIcon size={14} /> Print Report
                  </button>
                </div>
              ) : (
                <>
                  {settleError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400">
                      {settleError}
                    </div>
                  )}
                  <button
                    onClick={handleSettle}
                    disabled={settling || loading || summary.grandTotal === 0 || !summary.reconciled}
                    title={!summary.reconciled ? "Payment-mode totals must reconcile with Gross Total before settling" : undefined}
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    {settling ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Settling...
                      </>
                    ) : (
                      <>
                        Perform Day Settle <ArrowLeftIcon className="rotate-180" size={16} />
                      </>
                    )}
                  </button>
                </>
              )}

              <div className="pt-5 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Last Settlement
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {latestSettlement
                      ? `${formatDate(latestSettlement.businessDate)} · ${new Date(latestSettlement.createdAt).toLocaleTimeString(
                          "en-IN",
                          { hour: "2-digit", minute: "2-digit" }
                        )}`
                      : "Never"}
                  </span>
                </div>
                {latestSettlement?.closedBy && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Closed By
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {latestSettlement.closedBy}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only EOD Report — screen UI above is hidden via print:hidden */}
      {todaySettlement && (
        <div className="hidden print:block p-8 text-black">
          <h1 className="text-xl font-black mb-1">End of Day Settlement Report</h1>
          <p className="text-sm mb-6">Business Date: {formatDate(todaySettlement.businessDate)}</p>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr><td className="py-1 font-semibold">Settlement ID</td><td className="py-1 text-right">{todaySettlement.id}</td></tr>
              <tr><td className="py-1 font-semibold">Closed At</td><td className="py-1 text-right">{new Date(todaySettlement.createdAt).toLocaleString("en-IN")}</td></tr>
              <tr><td className="py-1 font-semibold">Closed By</td><td className="py-1 text-right">{todaySettlement.closedBy || "—"}</td></tr>
              <tr><td className="py-1 font-semibold">Total Orders</td><td className="py-1 text-right">{todaySettlement.orderCount}</td></tr>
              <tr><td colSpan={2} className="pt-3 pb-1 font-bold border-t border-black">Payment Mode Breakdown</td></tr>
              <tr><td className="py-1">Cash Collection</td><td className="py-1 text-right">₹{todaySettlement.cashTotal.toLocaleString()}</td></tr>
              <tr><td className="py-1">UPI Collection</td><td className="py-1 text-right">₹{todaySettlement.upiTotal.toLocaleString()}</td></tr>
              <tr><td className="py-1">Card Collection</td><td className="py-1 text-right">₹{todaySettlement.cardTotal.toLocaleString()}</td></tr>
              {!!todaySettlement.otherTotal && (
                <tr><td className="py-1">Other</td><td className="py-1 text-right">₹{todaySettlement.otherTotal.toLocaleString()}</td></tr>
              )}
              <tr><td colSpan={2} className="pt-3 pb-1 font-bold border-t border-black">Totals</td></tr>
              <tr><td className="py-1">Gross Sales</td><td className="py-1 text-right">₹{todaySettlement.grandTotal.toLocaleString()}</td></tr>
              {!!todaySettlement.refundTotal && (
                <tr><td className="py-1">Returns / Refunds</td><td className="py-1 text-right">− ₹{todaySettlement.refundTotal.toLocaleString()}</td></tr>
              )}
              <tr><td className="py-1 font-bold">Net Collection</td><td className="py-1 text-right font-bold">₹{(todaySettlement.netTotal ?? todaySettlement.grandTotal).toLocaleString()}</td></tr>
              <tr><td colSpan={2} className="pt-3 pb-1 font-bold border-t border-black">Cash Drawer</td></tr>
              <tr><td className="py-1">System Cash</td><td className="py-1 text-right">₹{todaySettlement.cashTotal.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
