"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Calculator, Info } from "lucide-react";
import { productionApi } from "@/lib/api";
import type { ExpenseLine } from "@/lib/api/inventory.api";

// Packaging never takes expense input. Batches started with a recipe
// expense snapshot are costed from it (Recipe Master → production →
// packaging); older batches without one show their expenses as unavailable
// and are costed from what is recorded on them — nothing is assumed.

export type ExpenseBasis = ExpenseLine["basis"];
// Packaging shows production cost only — no selling price or profit/loss.
export interface CostRowRequest { key: string; packetSize: string; packedQty: number; damagedQty: number; productId?: string }
/** One pack-size row's cost from the server preview (see production-costing.ts). */
export type RowCost = {
  packets: number; good: number; damaged: number; rawMaterialPerPacket: number; expenseTotal: number; totalCost: number;
  costPerPacket: number; costPerGoodPacket: number | null; damageAbsorbed: number; expenses: Array<{ category: string; perPacket: number }>;
};
const toRequestRows = (rows: CostRowRequest[]) => rows.map(({ key, ...r }) => r);

const inr = (n: number | null | undefined, dp = 2) =>
  n == null || !Number.isFinite(n) ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: dp })}`;
const qty = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: 3 }));

/** "RECIPE_SNAPSHOT" (expenses saved with the batch) or "LEGACY" (no expense data); null while loading. */
export type ExpenseSource = "RECIPE_SNAPSHOT" | "LEGACY" | null;

interface Props {
  batchId: string;
  unit: string;
  rows: CostRowRequest[];
  /** Bump to reload the batch summary (e.g. after a confirmation). */
  refreshKey: number;
  /** Latest per-row costs keyed by row key, whether a refresh is in flight, and where the batch's expenses come from. */
  onCostsChange?: (byKey: Record<string, RowCost>, loading: boolean, expenseSource: ExpenseSource) => void;
}

/** Production Cost Breakdown (read-only): batch cost header, expenses and per-pack-size cost. */
export default function ProductionCostPanel({ batchId, unit, rows, refreshKey, onCostsChange }: Props) {
  const [summary, setSummary] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    productionApi.getBatchCostSummary(batchId)
      .then((res) => { if (!cancelled) setSummary(res.data); })
      .catch(() => { if (!cancelled) setSummary({ error: true }); });
    return () => { cancelled = true; };
  }, [batchId, refreshKey]);

  const categories: Array<{ code: string; label: string }> = summary?.categories || [];
  const fromRecipe = summary?.expenseSource === "RECIPE_SNAPSHOT";
  const expenseSource: ExpenseSource = !summary || summary.error ? null : fromRecipe ? "RECIPE_SNAPSHOT" : "LEGACY";
  const requestKey = JSON.stringify(rows);

  // Server-side preview (same calculation as Confirm), debounced. No expense
  // lines are ever sent: the server applies the batch's saved expenses.
  // Results are keyed by row so a row added/removed meanwhile never shows another's cost.
  useEffect(() => {
    if (!rows.some((r) => r.packedQty + r.damagedQty > 0)) {
      setPreview(null);
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    const keys = rows.map((r) => r.key);
    const t = setTimeout(() => {
      productionApi.previewPackagingCost(batchId, { rows: toRequestRows(rows) })
        .then((res) => {
          if (cancelled) return;
          const byKey: Record<string, RowCost> = {};
          (res.data?.rows || []).forEach((r: RowCost, i: number) => { if (keys[i]) byKey[keys[i]] = r; });
          setPreview({ ...res.data, byKey });
          setPreviewError(null);
        })
        .catch((err) => { if (!cancelled) { setPreview(null); setPreviewError(err?.response?.data?.error || "Cost preview unavailable"); } })
        .finally(() => { if (!cancelled) setLoadingPreview(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, requestKey, refreshKey]);

  useEffect(() => {
    onCostsChange?.(preview?.byKey || {}, loadingPreview, expenseSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, loadingPreview, expenseSource]);

  const perKgLabel = unit === "L" || unit === "ML" ? "Per L" : "Per KG";
  const perCategory = (row: any, code: string) => row.expenses.filter((e: any) => e.category === code).reduce((s: number, e: any) => s + e.perPacket, 0);
  const shownCategories = categories.filter((c) => preview?.rows?.some((r: any) => r.expenses.some((e: any) => e.category === c.code)));

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="px-3.5 py-2.5 bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-[#f58220]" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-white">Production Cost Breakdown</h4>
      </div>

      {/* Batch cost header */}
      {summary?.error ? (
        <p className="p-3.5 text-xs font-semibold text-rose-600">Couldn&apos;t load this batch&apos;s production cost.</p>
      ) : !summary ? (
        <p className="p-3.5 text-xs text-gray-400">Loading production cost…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-white/5 border-b border-gray-100 dark:border-white/5 text-center">
          {([
            { label: "Planned / Actual Yield", value: `${qty(summary.plannedYield)} / ${qty(summary.actualYield)} ${summary.unit}` },
            { label: "Raw Material Cost", value: inr(summary.materialCost), sub: summary.additionalMaterialCost > 0 ? `incl. ${inr(summary.additionalMaterialCost)} extra` : undefined },
            { label: `Planned Cost/${summary.unit}`, value: inr(summary.plannedMaterialCostPerUnit) },
            { label: `Actual Cost/${summary.unit}`, value: inr(summary.actualMaterialCostPerUnit), strong: true },
          ] as Array<{ label: string; value: string; sub?: string; strong?: boolean }>).map((t) => (
            <div key={t.label} className="py-2 px-2">
              <p className="text-[9px] font-bold uppercase text-gray-400">{t.label}</p>
              <p className={clsx("text-xs font-bold tabular-nums mt-0.5", t.strong ? "text-emerald-700 dark:text-emerald-400" : "text-gray-800 dark:text-white")}>{t.value}</p>
              {t.sub && <p className="text-[10px] text-gray-400">{t.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Expenses: from the recipe snapshot saved with the batch, or unavailable (older batches). Read-only either way. */}
      {fromRecipe && (
        <RecipeExpenseBreakdown
          summary={summary}
          perKgLabel={perKgLabel}
          packagingCost={preview?.rows?.reduce((s: number, r: any) => s + r.expenses.filter((e: any) => e.category === "PACKAGING_MATERIAL").reduce((a: number, e: any) => a + e.amount, 0), 0) ?? null}
          costPerPacket={rows
            .map((row) => ({ row, r: preview?.byKey?.[row.key] as RowCost | undefined }))
            .filter((x): x is { row: CostRowRequest; r: RowCost } => !!x.r && x.r.packets > 0)
            .map(({ row, r }) => ({ size: row.packetSize, cost: r.costPerGoodPacket }))}
        />
      )}
      {expenseSource === "LEGACY" && <UnavailableExpenses summary={summary} />}

      {/* Cost per pack size + combined summary */}
      <div className="p-3.5 space-y-2">
        {previewError ? (
          <p className="text-[11px] font-semibold text-rose-600">{previewError}</p>
        ) : !preview ? (
          <p className="text-[11px] text-gray-400">{loadingPreview ? "Calculating…" : "Enter packets to see the cost per pack size."}</p>
        ) : (() => {
          const lines = rows
            .map((row) => ({ row, r: preview.byKey[row.key] as RowCost | undefined }))
            .filter((x): x is { row: CostRowRequest; r: RowCost } => !!x.r && x.r.packets > 0);
          const totalCost = lines.reduce((s, x) => s + x.r.totalCost, 0);
          const goodTotal = lines.reduce((s, x) => s + x.r.good, 0);
          return (
            <div className={clsx("space-y-2 transition-opacity", loadingPreview && "opacity-60")}>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[480px] text-left text-[11px] font-semibold text-gray-700 dark:text-slate-300">
                  <thead>
                    <tr className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-1.5 pr-2">Pack</th>
                      <th className="py-1.5 px-2 text-right">Good / Dmg</th>
                      <th className="py-1.5 px-2 text-right" title={fromRecipe ? "Raw material plus manufacturing expenses, by weight" : undefined}>{fromRecipe ? "Manufacturing" : "Raw material"}</th>
                      {shownCategories.map((c) => <th key={c.code} className="py-1.5 px-2 text-right">{c.label}</th>)}
                      <th className="py-1.5 pl-2 text-right">Production cost / pkt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {lines.map(({ row, r }) => (
                      <tr key={row.key}>
                        <td className="py-1.5 pr-2 font-bold text-gray-900 dark:text-white whitespace-nowrap">{row.packetSize || "—"}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{r.good} / {r.damaged}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{inr(r.rawMaterialPerPacket)}</td>
                        {shownCategories.map((c) => <td key={c.code} className="py-1.5 px-2 text-right tabular-nums">{inr(perCategory(r, c.code))}</td>)}
                        <td className="py-1.5 pl-2 text-right tabular-nums font-bold text-gray-900 dark:text-white">
                          {inr(r.costPerGoodPacket)}
                          {r.damageAbsorbed > 0 && <div className="text-[9px] font-semibold text-amber-600">incl. {inr(r.damageAbsorbed)} damage</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Combined summary */}
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 p-2.5 text-center">
                <div>
                  <p className="text-[9px] font-bold uppercase text-gray-400">Total production cost</p>
                  <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{inr(totalCost)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-gray-400">Good packets</p>
                  <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{goodTotal}</p>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}

const BASIS_LABEL: Record<string, string> = { PER_BATCH: "per batch", PER_KG: "per KG", PER_PACKET: "per packet" };

/** One recipe expense as frozen on the batch (see production-costing.ts RecipeExpenseItem). */
interface SnapshotExpense { category: string; label: string; basis: ExpenseBasis; rate: number | null; sizeRates?: Array<{ packetSize: string; rate: number }> }

/** Rates of an expense charged at packaging, e.g. "₹2/pkt (250g) · ₹3/pkt (500g)". */
export function packagingRateText(e: SnapshotExpense, perKgLabel = "Per KG"): string {
  if (e.basis === "PER_BATCH") return `${inr(e.rate)} per batch, shared by weight packed`;
  const unit = e.basis === "PER_PACKET" ? "/pkt" : perKgLabel.replace("Per ", "/").toLowerCase();
  const parts = (e.sizeRates || []).map((s) => `${inr(s.rate)}${unit} (${s.packetSize})`);
  if (e.rate != null) parts.push(`${inr(e.rate)}${unit}${parts.length ? " (other sizes)" : ""}`);
  return parts.length ? parts.join(" · ") : "No rate set";
}

/** Read-only Production Cost Breakdown for a batch costed from its recipe's expense snapshot. */
function RecipeExpenseBreakdown({ summary, perKgLabel, packagingCost, costPerPacket }: {
  summary: any;
  perKgLabel: string;
  /** Packaging Materials charged to the packets entered now (from the cost preview). */
  packagingCost: number | null;
  costPerPacket: Array<{ size: string; cost: number | null }>;
}) {
  const snapshot: SnapshotExpense[] = summary.expenseSnapshot?.expenses || [];
  const charged = (code: string) => (summary.manufacturingExpenses || []).find((e: any) => e.category === code);
  const manufacturing = (summary.categories || []).filter((c: any) => c.code !== "PACKAGING_MATERIAL");
  const packaging = snapshot.find((e) => e.category === "PACKAGING_MATERIAL");
  const row = "flex items-baseline justify-between gap-3 px-3 py-1.5";
  return (
    <div className="p-3.5 space-y-2 border-b border-gray-100 dark:border-white/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Additional expenses (from recipe)</span>
        <span className="text-[10px] text-gray-400">
          Recipe expenses v{summary.expenseSnapshot?.configVersion ?? 0}, saved when production started · change them in Recipe Master
        </span>
      </div>
      <dl className="rounded-lg border border-gray-100 dark:border-white/5 divide-y divide-gray-100 dark:divide-white/5 text-[11px] font-semibold text-gray-700 dark:text-slate-300">
        <div className={row}><dt>Actual Raw Material Cost</dt><dd className="tabular-nums">{inr(summary.materialCost)}</dd></div>
        {manufacturing.map((c: any) => {
          const line = charged(c.code);
          const configured = snapshot.find((e) => e.category === c.code);
          return (
            <div key={c.code} className={row}>
              <dt>
                {c.label}
                {line && <span className="ml-1.5 font-normal text-gray-400">{inr(line.rate)} {BASIS_LABEL[line.basis]}{line.basis === "PER_KG" ? ` × ${qty(line.baseQty)}` : ""}</span>}
              </dt>
              <dd className="tabular-nums">
                {line ? inr(line.amount)
                  : configured?.basis === "PER_PACKET" ? <span className="text-gray-500">{inr(configured.rate)}/pkt at packaging</span>
                  : <span className="text-gray-400">—</span>}
              </dd>
            </div>
          );
        })}
        <div className={clsx(row, "font-bold text-gray-900 dark:text-white")}><dt>Total Manufacturing Cost</dt><dd className="tabular-nums">{inr(summary.totalManufacturingCost)}</dd></div>
        <div className={clsx(row, "font-bold text-emerald-700 dark:text-emerald-400")}><dt>Manufacturing Cost per {summary.unit}</dt><dd className="tabular-nums">{inr(summary.manufacturingCostPerUnit)}</dd></div>
        <div className={row}>
          <dt>
            Packaging Material Cost
            <span className="block font-normal text-gray-400">{packaging ? packagingRateText(packaging, perKgLabel) : "Not set for this recipe"}</span>
          </dt>
          <dd className="tabular-nums">{packagingCost != null && packaging ? inr(packagingCost) : "—"}</dd>
        </div>
        <div className={clsx(row, "font-bold text-gray-900 dark:text-white")}>
          <dt>Total Cost per Finished Packet</dt>
          <dd className="tabular-nums text-right">
            {costPerPacket.length ? costPerPacket.map((c) => <div key={c.size}>{c.size}: {inr(c.cost)}</div>) : <span className="font-semibold text-gray-400">Enter packets</span>}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Older batches (no recipe expense snapshot): their additional expenses are
 * unknown, so none are assumed — shown as unavailable, never as ₹0. Per-batch
 * amounts already recorded on the batch are listed (read-only); the server
 * keeps charging their remaining share by weight packed, exactly once.
 */
function UnavailableExpenses({ summary }: { summary: any }) {
  const recorded: Array<{ category: string; label: string; total: number; allocatedBefore: number; remaining: number }> =
    (summary.sharedExpenses || []).filter((s: any) => s.total > 0);
  const row = "flex items-baseline justify-between gap-3 px-3 py-1.5";
  return (
    <div className="p-3.5 space-y-2 border-b border-gray-100 dark:border-white/5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Additional expenses</span>
      <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
        <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
        <span>
          Expense data unavailable — no recipe expenses were saved with this batch.
          Costs below include raw materials{recorded.length ? " and the expenses already recorded on this batch" : ""} only; no other expense amounts are assumed.
        </span>
      </p>
      {recorded.length > 0 && (
        <dl className="rounded-lg border border-gray-100 dark:border-white/5 divide-y divide-gray-100 dark:divide-white/5 text-[11px] font-semibold text-gray-700 dark:text-slate-300">
          {recorded.map((s) => (
            <div key={s.category} className={row}>
              <dt>
                {s.label}
                <span className="ml-1.5 font-normal text-gray-400">per batch, shared by weight packed{s.allocatedBefore > 0 ? ` · ${inr(s.allocatedBefore)} already charged` : ""}</span>
              </dt>
              <dd className="tabular-nums">{inr(s.total)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
