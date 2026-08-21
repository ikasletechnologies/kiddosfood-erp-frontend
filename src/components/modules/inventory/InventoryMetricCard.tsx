"use client";

import React from "react";
import { clsx } from "clsx";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  colorTheme: "blue" | "purple" | "indigo" | "amber" | "emerald" | "rose" | "slate";
  badge?: string;
  onClick?: () => void;
}

const THEMES: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  blue: {
    bg: "bg-blue-50/50 dark:bg-blue-950/20",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-100 dark:border-blue-900/30",
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  purple: {
    bg: "bg-purple-50/50 dark:bg-purple-950/20",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-100 dark:border-purple-900/30",
    iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  indigo: {
    bg: "bg-indigo-50/50 dark:bg-indigo-950/20",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-100 dark:border-indigo-900/30",
    iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  amber: {
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-100 dark:border-amber-900/30",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  emerald: {
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-100 dark:border-emerald-900/30",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    bg: "bg-rose-50/50 dark:bg-rose-950/20",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-100 dark:border-rose-900/30",
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  slate: {
    bg: "bg-slate-50/50 dark:bg-slate-900/40",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-white/10",
    iconBg: "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300",
  },
};

export default function InventoryMetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  colorTheme,
  badge,
  onClick,
}: MetricCardProps) {
  const theme = THEMES[colorTheme] || THEMES.slate;

  return (
    <div
      onClick={onClick}
      className={clsx(
        "rounded-3xl border p-5 shadow-sm transition-all relative overflow-hidden",
        theme.bg,
        theme.border,
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {label}
          </p>
          <p className={clsx("text-2xl font-black tracking-tight", theme.text)}>
            {value}
          </p>
          {subtext && (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {subtext}
            </p>
          )}
        </div>

        <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", theme.iconBg)}>
          <Icon size={22} />
        </div>
      </div>

      {badge && (
        <span className="inline-block mt-3 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-white dark:bg-card border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
          {badge}
        </span>
      )}
    </div>
  );
}
