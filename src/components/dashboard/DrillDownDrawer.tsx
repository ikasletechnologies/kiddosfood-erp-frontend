"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X, ArrowUpRight, TrendingUp, TrendingDown, ExternalLink, ShieldCheck, ChevronRight } from "lucide-react";
import { CountUpNumber } from "./CountUpNumber";

export interface DrillDownItem {
  title: string;
  value: string;
  trend?: string;
  trendType?: "up" | "down";
  subtext?: string;
  insight?: string;
  href: string;
  icon?: any;
  colorClass?: string;
  breakdown?: { label: string; value: string; desc?: string }[];
}

interface DrillDownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: DrillDownItem | null;
  period?: string;
  outletName?: string;
}

export function DrillDownDrawer({
  isOpen,
  onClose,
  item,
  period = "today",
  outletName = "All Outlets",
}: DrillDownDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const Icon = item.icon;

  return (
    <div className="fixed inset-0 z-[160] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#10121a] h-full shadow-2xl border-l border-slate-200/80 dark:border-white/10 flex flex-col z-10 animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-200/40 dark:border-orange-500/20">
                <Icon size={20} strokeWidth={2.2} />
              </div>
            )}
            <div>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Executive Drill-Down
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {item.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Main KPI Card */}
          <div className="p-5 rounded-3xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Telemetry Period: <strong className="text-slate-700 dark:text-slate-200 uppercase">{period}</strong>
              </span>
              {item.trend && (
                <span
                  className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 border ${
                    item.trendType === "down"
                      ? "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                      : "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                  }`}
                >
                  {item.trendType === "down" ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                  {item.trend}%
                </span>
              )}
            </div>

            <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              <CountUpNumber value={item.value} />
            </div>

            {item.subtext && (
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {item.subtext}
              </p>
            )}

            {item.insight && (
              <div className="pt-3 border-t border-slate-200/50 dark:border-white/5 flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                {item.insight}
              </div>
            )}
          </div>

          {/* Context Details */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Operational Scope
            </h4>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#12151f] border border-slate-200/70 dark:border-white/5 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Selected Outlet</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{outletName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">System Telemetry Link</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck size={14} /> Synchronized
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Audit Trail</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Live Recording</span>
              </div>
            </div>
          </div>

          {/* Breakdown Items (if provided) */}
          {item.breakdown && item.breakdown.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Component Breakdown
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-white/5 rounded-2xl bg-white dark:bg-[#12151f] border border-slate-200/70 dark:border-white/5 overflow-hidden">
                {item.breakdown.map((b, i) => (
                  <div key={i} className="p-3.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{b.label}</p>
                      {b.desc && <p className="text-[10px] text-slate-400">{b.desc}</p>}
                    </div>
                    <span className="font-black text-slate-900 dark:text-white tabular-nums">{b.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct module guidance */}
          <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-500/20 text-xs space-y-2">
            <p className="font-bold text-blue-900 dark:text-blue-200">
              Need full transaction records or ledger view?
            </p>
            <p className="text-blue-700/80 dark:text-blue-300/80 text-[11px] leading-relaxed">
              Navigate to the dedicated module to view line items, export detailed audits, or create new entries.
            </p>
          </div>
        </div>

        {/* Drawer Footer CTA */}
        <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
          <Link
            href={item.href}
            onClick={onClose}
            className="w-full py-3.5 px-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 dark:shadow-none"
          >
            <span>Open Full Module</span>
            <ExternalLink size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
