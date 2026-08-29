"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Package,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Target,
  Activity,
  ChevronRight,
  Factory,
  ShieldAlert,
  Zap,
  Building2,
  Bell,
  BarChart3,
  Wallet,
  CheckCircle2,
  Landmark,
  Check,
  ShieldCheck,
  Store,
  Truck,
  Sparkles,
  PackageCheck,
  Receipt,
  FileText,
  Clock,
} from "lucide-react";
import { clsx } from "clsx";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { CountUpNumber } from "./CountUpNumber";

// ─── 1. CLEAN MINIMAL STATIC EXECUTIVE KPI CARD ──────────────────────────────
interface KPICardProps {
  title: string;
  value: number | string;
  icon?: any;
  colorClass?: "orange" | "emerald" | "blue" | "amber" | "rose" | "indigo" | "purple";
  supportingText?: string;
  insight?: string;
  onClick?: () => void;
}

export function KPICard({
  title,
  value,
  icon: Icon = Zap,
  colorClass = "orange",
  supportingText,
  insight,
  onClick,
}: KPICardProps) {
  const iconStyles = {
    orange: "bg-orange-50 text-[#F58220] border-orange-200/60 dark:bg-orange-950/30 dark:border-orange-500/20",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-500/20",
    blue: "bg-blue-50 text-blue-600 border-blue-200/60 dark:bg-blue-950/30 dark:border-blue-500/20",
    amber: "bg-amber-50 text-amber-600 border-amber-200/60 dark:bg-amber-950/30 dark:border-amber-500/20",
    rose: "bg-rose-50 text-rose-600 border-rose-200/60 dark:bg-rose-950/30 dark:border-rose-500/20",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200/60 dark:bg-indigo-950/30 dark:border-indigo-500/20",
    purple: "bg-purple-50 text-purple-600 border-purple-200/60 dark:bg-purple-950/30 dark:border-purple-500/20",
  };

  const footerText = supportingText || insight;

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#12141c] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 shadow-sm hover:border-slate-300 dark:hover:border-white/20 transition-colors cursor-pointer flex flex-col justify-between min-h-[125px] sm:min-h-[135px] w-full min-w-0"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center border shrink-0", iconStyles[colorClass])}>
          <Icon size={16} strokeWidth={2.2} />
        </div>
        <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex-1 min-w-0">
          {title}
        </p>
      </div>

      <div className="my-2 sm:my-2.5 min-w-0">
        <h3 className="text-xl xs:text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
          {value}
        </h3>
      </div>

      <div className="min-h-[18px] min-w-0">
        {footerText && (
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            {footerText}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── 2. INVOICE-STYLE REPORT TABLE COMPONENT ──────────────────────────────────
interface InvoiceReportTableProps {
  title: string;
  icon: any;
  headers: string[];
  data: any[];
  colorClass?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  actionText?: string;
  actionHref?: string;
}

export function InvoiceReportTable({
  title,
  icon: Icon,
  headers,
  data = [],
  colorClass = "orange",
  emptyTitle = "No records found",
  emptyMessage = "Transactions matching this section will populate here automatically.",
  actionText,
  actionHref,
}: InvoiceReportTableProps) {
  const badgeMap: Record<string, string> = {
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400",
    SENT: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400",
    DRAFT: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300",
    OVERDUE: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400",
    REORDER: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400",
    RESTOCK: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400",
  };

  return (
    <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col justify-between w-full min-w-0">
      {/* Table Header */}
      <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-[#F58220] flex items-center justify-center border border-orange-200/50 dark:border-orange-500/20 shrink-0">
            <Icon size={15} />
          </div>
          <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider truncate">
            {title}
          </h3>
        </div>

        {actionHref && (
          <Link
            href={actionHref}
            className="text-[11px] font-bold text-[#F58220] hover:underline flex items-center gap-1 shrink-0"
          >
            <span>View All</span>
            <ChevronRight size={12} />
          </Link>
        )}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
        {data.length === 0 ? (
          <div className="py-6 px-4 text-center space-y-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
              <Icon size={15} />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{emptyTitle}</p>
            {actionHref && actionText && (
              <Link
                href={actionHref}
                className="inline-block mt-0.5 px-3 py-1 bg-orange-50 dark:bg-orange-950/30 text-[#F58220] hover:bg-orange-100 rounded-lg text-[11px] font-bold transition-colors"
              >
                {actionText}
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-full">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 sm:px-4 py-2 sm:py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {data.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                >
                  {Object.values(row).map((val: any, j) => {
                    const valStr = String(val);
                    const isBadge = badgeMap[valStr.toUpperCase()];
                    const isPercentage = valStr.includes("%");

                    return (
                      <td
                        key={j}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap"
                      >
                        {isBadge ? (
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border inline-block",
                              badgeMap[valStr.toUpperCase()]
                            )}
                          >
                            {valStr}
                          </span>
                        ) : isPercentage ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {valStr}
                          </span>
                        ) : (
                          val
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── 3. PRODUCTION RADIAL YIELD GAUGE ─────────────────────────────────────────
export function ProductionYieldGauge({ percentage = 100 }: { percentage: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 70 70">
        <circle
          cx="35"
          cy="35"
          r={radius}
          stroke="currentColor"
          strokeWidth="5"
          fill="transparent"
          className="text-slate-100 dark:text-white/5"
        />
        <circle
          cx="35"
          cy="35"
          r={radius}
          stroke="#10B981"
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs font-bold text-slate-900 dark:text-white leading-none">
          <CountUpNumber value={percentage} suffix="%" />
        </span>
      </div>
    </div>
  );
}

// ─── 4. BUSINESS PERFORMANCE CHART ───────────────────────────────────────────
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const sales = payload.find((p: any) => p.dataKey === "sales")?.value || 0;
    const purchase = payload.find((p: any) => p.dataKey === "purchase")?.value || 0;
    const profit = sales - purchase;
    const margin = sales > 0 ? ((profit / sales) * 100).toFixed(1) : "0";

    return (
      <div className="bg-slate-900/95 border border-slate-700/50 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[160px] text-white">
        <div className="flex items-center justify-between border-b border-white/10 pb-1">
          <p className="font-bold text-slate-300 text-[10px]">{label || "Timeline Point"}</p>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
            {margin}% Margin
          </span>
        </div>

        <div className="space-y-1">
          {payload.map((pld: any) => (
            <div key={pld.dataKey} className="flex justify-between items-center gap-3">
              <span className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color }} />
                {pld.name}
              </span>
              <span className="font-bold tabular-nums text-white">
                {formatCurrency(pld.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function BusinessPerformanceChart({
  data = [],
  title = "Business Performance",
  period,
  setPeriod,
}: any) {
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>(["sales", "purchase", "profit"]);

  const toggleMetric = (id: string) => {
    setVisibleMetrics((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((m) => m !== id)
          : prev
        : [...prev, id]
    );
  };

  const hasData =
    data &&
    data.length > 0 &&
    data.some((d: any) => d.sales > 0 || d.purchase > 0 || d.profit !== 0);

  return (
    <div className="bg-white dark:bg-[#12141c] p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between w-full max-w-full min-w-0">
      {/* Header with Title & Legend Toggles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 w-full min-w-0">
        <div className="w-full sm:w-auto min-w-0">
          <h3 className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </h3>
          <p className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 dark:text-white mt-0.5 leading-snug break-words">
            Sales, Procurement & Profit Trajectory
          </p>
        </div>

        {/* Legend Metric Toggles - Responsive Grid on Mobile, Flex on Desktop */}
        <div className="w-full sm:w-auto grid grid-cols-2 xs:grid-cols-3 sm:flex items-center gap-1 sm:gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200/60 dark:border-white/5">
          {[
            { id: "sales", label: "Sales", color: "#F58220" },
            { id: "purchase", label: "Procurement", color: "#EF4444" },
            { id: "profit", label: "Net Margin", color: "#10B981" },
          ].map((m, idx) => {
            const isActive = visibleMetrics.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMetric(m.id)}
                className={clsx(
                  "px-2.5 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 border select-none min-h-[30px] sm:min-h-0",
                  idx === 2 && "col-span-2 xs:col-span-1 sm:col-auto",
                  isActive
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-white/10 shadow-sm font-black"
                    : "bg-transparent text-slate-400 border-transparent hover:text-slate-600"
                )}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: isActive ? m.color : "#94A3B8" }}
                />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-[230px] xs:h-[260px] sm:h-[300px] w-full min-w-0 relative">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F58220" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F58220" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-white/5" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94A3B8" }} dy={6} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: "#94A3B8" }}
                tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                domain={["auto", "auto"]}
                width={36}
              />
              <Tooltip cursor={{ stroke: "#94A3B8", strokeWidth: 1, strokeDasharray: "4 4" }} content={<CustomChartTooltip />} />

              {visibleMetrics.includes("sales") && (
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  fill="url(#salesGrad)"
                  stroke="#F58220"
                  strokeWidth={2.5}
                  animationDuration={800}
                />
              )}
              {visibleMetrics.includes("purchase") && (
                <Area
                  type="monotone"
                  dataKey="purchase"
                  name="Procurement"
                  fill="url(#purchaseGrad)"
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  animationDuration={800}
                />
              )}
              {visibleMetrics.includes("profit") && (
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Net Margin"
                  fill="url(#profitGrad)"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  animationDuration={800}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <BarChart3 size={24} className="text-slate-400" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Sales Telemetry Recorded</p>
            <p className="text-[11px] text-slate-400">Transactions in this period will automatically plot here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 5. COMPACT LIVE ACTIVITY STREAM ──────────────────────────────────────────
export function CompactLiveActivity() {
  const activities = [
    {
      title: "Batch #B2026-92 Completed",
      time: "10m ago",
      type: "production",
      desc: "100 KG Recipe verified by Factory QC.",
      icon: Factory,
      color: "bg-indigo-50 text-indigo-600 border-indigo-200/50",
    },
    {
      title: "Vendor Payment Recorded",
      time: "42m ago",
      type: "finance",
      desc: "₹45,000 disbursed to FreshOils Ltd.",
      icon: IndianRupee,
      color: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
    },
    {
      title: "Stock Dispatched to Franchise Alpha",
      time: "2h ago",
      type: "inventory",
      desc: "Delivery Challan #DC-9082 cleared.",
      icon: Truck,
      color: "bg-blue-50 text-blue-600 border-blue-200/50",
    },
    {
      title: "POS Day Closing Settlement",
      time: "Yesterday",
      type: "pos",
      desc: "Shift closed with ₹38,200 collection.",
      icon: Store,
      color: "bg-amber-50 text-amber-600 border-amber-200/50",
    },
  ];

  return (
    <div className="bg-white dark:bg-[#12141c] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm space-y-3 w-full min-w-0">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-[#F58220]" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            Live Activity Stream
          </h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Recent Events
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {activities.map((act, i) => {
          const Icon = act.icon;
          return (
            <div
              key={i}
              className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1 min-w-0"
            >
              <div className="flex items-center justify-between">
                <div className={clsx("w-6 h-6 rounded-lg flex items-center justify-center border", act.color)}>
                  <Icon size={12} />
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{act.time}</span>
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                {act.title}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {act.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 6. PREMIUM FILTER (Segmented Date Control) ──────────────────────────────
interface PremiumFilterProps {
  options: { label: string; value: string }[];
  active: string;
  onChange: (val: string) => void;
}

export function PremiumFilter({ options, active, onChange }: PremiumFilterProps) {
  return (
    <div className="w-full sm:w-auto grid grid-cols-4 sm:flex items-center p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/60 dark:border-white/5 gap-0.5 sm:gap-1">
      {options.map((opt) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={clsx(
              "px-1.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all select-none text-center flex items-center justify-center truncate",
              isActive
                ? "bg-white dark:bg-slate-800 text-[#F58220] shadow-sm border border-slate-200 dark:border-white/10"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Legacy exports for compatibility
export function HeroKPICard(props: any) {
  return <KPICard {...props} />;
}
export function RevenueIntelligence(props: any) {
  return <BusinessPerformanceChart {...props} />;
}
export function ReportTableWidget(props: any) {
  return <InvoiceReportTable {...props} />;
}
