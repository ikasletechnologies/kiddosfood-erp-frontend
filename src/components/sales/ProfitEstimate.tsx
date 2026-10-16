"use client";

import { AlertTriangle, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import { EstimatedLine, ProfitSummary, money, signedMoney, toneOf } from "@/lib/profit-estimate";

/** One line's cost and profit, compact: "Cost ₹80 · Net ₹100 · +₹20/unit (+₹200)". */
export function LineProfit({ line, loading, className }: { line?: EstimatedLine | null; loading?: boolean; className?: string }) {
  if (!line) return loading ? <span className={clsx("text-[10px] text-gray-400", className)}>Calculating…</span> : null;
  if (line.status === "COST_UNAVAILABLE") {
    return (
      <span className={clsx("text-[10px] font-semibold text-gray-400", className)} title={line.costReason || "No production cost recorded"}>
        Cost unavailable · Net {money(line.netUnitPrice)}/unit
      </span>
    );
  }
  return (
    <span className={clsx("text-[10px] font-semibold whitespace-nowrap", loading && "opacity-60", className)}>
      <span className="text-gray-500 dark:text-slate-400">Cost {money(line.unitCost!)} · Net {money(line.netUnitPrice)} · </span>
      <span className={toneOf(line.status)}>
        {line.status === "BREAK_EVEN" ? "Break-even" : `${signedMoney(line.unitProfit!)}/unit (${signedMoney(line.profit!)})`}
      </span>
    </span>
  );
}

/** The red loss warning under a line, when its price is below cost. */
export function LossWarning({ line }: { line?: EstimatedLine | null }) {
  if (!line?.warning) return null;
  return (
    <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-1.5" role="alert">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
      <span>{line.warning}</span>
    </p>
  );
}

/** Order / bill totals: revenue excl. GST, cost of goods, estimated gross profit and margin. */
export function ProfitSummaryPanel({ summary, loading, error, title = "Estimated Profit / Loss", compact }: {
  summary?: ProfitSummary | null;
  loading?: boolean;
  error?: string | null;
  title?: string;
  compact?: boolean;
}) {
  if (error) return <p className="text-[11px] font-semibold text-gray-400">{error}</p>;
  if (!summary) return loading ? <p className="text-[11px] text-gray-400">Calculating profit…</p> : null;
  const tiles = [
    { label: "Net revenue (excl. GST)", value: money(summary.netRevenue) },
    { label: "Cost of goods", value: summary.costOfGoods == null ? "Cost unavailable" : money(summary.costOfGoods) },
    {
      label: summary.status === "LOSS" ? "Estimated loss" : "Estimated gross profit",
      value: summary.profit == null ? "—" : summary.status === "BREAK_EVEN" ? "Break-even" : signedMoney(summary.profit),
      tone: toneOf(summary.status),
    },
    { label: "Gross margin", value: summary.marginPct == null ? "—" : `${summary.marginPct}%`, tone: toneOf(summary.status) },
  ];
  return (
    <div className={clsx("rounded-lg border p-2.5 space-y-1.5 transition-opacity", loading && "opacity-60",
      summary.status === "LOSS" ? "border-rose-200 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-500/5" : "border-gray-200 bg-gray-50/60 dark:border-white/10 dark:bg-white/[0.02]")}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3" /> {title} <span className="font-semibold normal-case tracking-normal text-gray-400">· estimate, excl. GST</span>
      </p>
      <div className={clsx("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {tiles.map((t) => (
          <div key={t.label}>
            <p className="text-[9px] font-bold uppercase text-gray-400">{t.label}</p>
            <p className={clsx("text-xs font-bold tabular-nums", t.tone || "text-gray-900 dark:text-white")}>{t.value}</p>
          </div>
        ))}
      </div>
      {summary.costUnavailableLines > 0 && (
        <p className="text-[10px] font-semibold text-amber-600">
          Cost unavailable for {summary.costUnavailableLines} item{summary.costUnavailableLines === 1 ? "" : "s"} — profit covers the other items only ({money(summary.costedRevenue)} of revenue).
        </p>
      )}
    </div>
  );
}
