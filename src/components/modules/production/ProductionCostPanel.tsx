"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Calculator, Plus, Info, Check, X } from "lucide-react";
import { productionApi } from "@/lib/api";
import type { ExpenseLine } from "@/lib/api/inventory.api";
import { profitOf } from "@/lib/packaging-profit";

export type ExpenseBasis = ExpenseLine["basis"];
/** One expense as edited on screen; rowKey "" = all pack sizes. */
export interface ExpenseDraft { id: string; category: string; basis: ExpenseBasis; amount: string; rowKey: string }
// `price` is the selling price shown on screen (for live profit/loss only; never sent).
export interface CostRowRequest { key: string; packetSize: string; packedQty: number; damagedQty: number; productId?: string; sellingPrice?: number; price?: number | null }
/** One pack-size row's cost from the server preview (see production-costing.ts). */
export type RowCost = {
  packets: number; good: number; damaged: number; rawMaterialPerPacket: number; expenseTotal: number; totalCost: number;
  costPerPacket: number; costPerGoodPacket: number | null; damageAbsorbed: number; expenses: Array<{ category: string; perPacket: number }>;
};
const toRequestRows = (rows: CostRowRequest[]) => rows.map(({ key, price, ...r }) => r);

const inr = (n: number | null | undefined, dp = 2) =>
  n == null || !Number.isFinite(n) ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: dp })}`;
const qty = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: 3 }));

/** Expense lines ready to send, or the first problem. Row keys become row indexes. */
export function expensesPayload(drafts: ExpenseDraft[], rows: Array<{ key: string }>): { lines: ExpenseLine[]; error: string | null } {
  const lines: ExpenseLine[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    const rate = Number(d.amount);
    // A ticked category with no amount yet simply isn't charged.
    if (!d.category || d.amount.trim() === "") continue;
    if (!Number.isFinite(rate) || rate < 0) return { lines, error: `Expense ${i + 1}: enter an amount of ₹0 or more.` };
    let row: number | null = null;
    if (d.basis !== "PER_BATCH" && d.rowKey) {
      row = rows.findIndex((r) => r.key === d.rowKey);
      if (row < 0) return { lines, error: `Expense ${i + 1}: its pack size row was removed.` };
    }
    lines.push({ category: d.category, basis: d.basis, rate, row });
  }
  const perBatch = lines.filter((l) => l.basis === "PER_BATCH").map((l) => l.category);
  if (new Set(perBatch).size !== perBatch.length) return { lines, error: "Enter one per-batch amount for each category." };
  return { lines, error: null };
}

interface Props {
  batchId: string;
  unit: string;
  rows: CostRowRequest[];
  expenses: ExpenseDraft[];
  onExpensesChange: (next: ExpenseDraft[]) => void;
  /** Bump to reload the batch summary (e.g. after a confirmation). */
  refreshKey: number;
  /** Latest per-row costs keyed by row key, and whether a refresh is in flight. */
  onCostsChange?: (byKey: Record<string, RowCost>, loading: boolean) => void;
}

/** Production Cost Breakdown: batch cost header, expense entry and per-pack-size cost. */
export default function ProductionCostPanel({ batchId, unit, rows, expenses, onExpensesChange, refreshKey, onCostsChange }: Props) {
  const [summary, setSummary] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    productionApi.getBatchCostSummary(batchId)
      .then((res) => {
        if (cancelled) return;
        setSummary(res.data);
        // Batch-wide expenses already set on this batch stay in force; show them.
        const shared = (res.data?.sharedExpenses || []).filter((s: any) => s.total > 0);
        if (shared.length) {
          onExpensesChange([
            ...shared.map((s: any) => ({ id: `shared-${s.category}`, category: s.category, basis: "PER_BATCH" as const, amount: String(s.total), rowKey: "" })),
            ...expenses.filter((e) => e.basis !== "PER_BATCH"),
          ]);
        }
      })
      .catch(() => { if (!cancelled) setSummary({ error: true }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, refreshKey]);

  const categories: Array<{ code: string; label: string }> = summary?.categories || [];
  const { lines, error: expenseError } = useMemo(() => expensesPayload(expenses, rows), [expenses, rows]);
  // Prices only change the profit/loss shown, which is worked out here live,
  // so they're left out of the server request key.
  const requestKey = JSON.stringify({ rows: rows.map(({ key, price, ...r }) => ({ key, ...r, sellingPrice: undefined })), lines });

  // Server-side preview (same calculation as Confirm), debounced. Results are
  // keyed by row so a row added/removed meanwhile never shows another's cost.
  useEffect(() => {
    if (expenseError || !rows.some((r) => r.packedQty + r.damagedQty > 0)) {
      setPreview(null);
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    const keys = rows.map((r) => r.key);
    const t = setTimeout(() => {
      productionApi.previewPackagingCost(batchId, { rows: toRequestRows(rows), expenses: lines })
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
  }, [batchId, requestKey, expenseError, refreshKey]);

  useEffect(() => {
    onCostsChange?.(preview?.byKey || {}, loadingPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, loadingPreview]);

  const update = (id: string, patch: Partial<ExpenseDraft>) => onExpensesChange(expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const newLine = (category: string, rowKey = ""): ExpenseDraft => ({ id: `e-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, category, basis: "PER_PACKET", amount: "", rowKey });
  const isOn = (code: string) => expenses.some((e) => e.category === code);
  const toggle = (code: string) =>
    onExpensesChange(isOn(code) ? expenses.filter((e) => e.category !== code) : [...expenses, newLine(code)]);
  const selectAll = () => onExpensesChange([...expenses, ...categories.filter((c) => !isOn(c.code)).map((c) => newLine(c.code))]);
  const perKgLabel = unit === "L" || unit === "ML" ? "Per L" : "Per KG";
  const BASIS_SHORT: Record<ExpenseBasis, string> = { PER_BATCH: "Per batch", PER_KG: perKgLabel, PER_PACKET: "Per packet" };
  const SUFFIX: Record<ExpenseBasis, string> = { PER_BATCH: "/batch", PER_KG: perKgLabel.replace("Per ", "/").toLowerCase(), PER_PACKET: "/pkt" };
  const sharedState = (code: string) => summary?.sharedExpenses?.find((s: any) => s.category === code);
  const perCategory = (row: any, code: string) => row.expenses.filter((e: any) => e.category === code).reduce((s: number, e: any) => s + e.perPacket, 0);
  const shownCategories = categories.filter((c) => preview?.rows?.some((r: any) => r.expenses.some((e: any) => e.category === c.code)));

  const sel = "border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-semibold bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none focus:border-[#f58220]";

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
          {[
            { label: "Planned / Actual Yield", value: `${qty(summary.plannedYield)} / ${qty(summary.actualYield)} ${summary.unit}` },
            { label: "Raw Material Cost", value: inr(summary.materialCost), sub: summary.additionalMaterialCost > 0 ? `incl. ${inr(summary.additionalMaterialCost)} extra` : undefined },
            { label: `Planned Cost/${summary.unit}`, value: inr(summary.plannedMaterialCostPerUnit) },
            { label: `Actual Cost/${summary.unit}`, value: inr(summary.actualMaterialCostPerUnit), strong: true },
          ].map((t) => (
            <div key={t.label} className="py-2 px-2">
              <p className="text-[9px] font-bold uppercase text-gray-400">{t.label}</p>
              <p className={clsx("text-xs font-bold tabular-nums mt-0.5", t.strong ? "text-emerald-700 dark:text-emerald-400" : "text-gray-800 dark:text-white")}>{t.value}</p>
              {t.sub && <p className="text-[10px] text-gray-400">{t.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Additional expenses: tick the categories that apply, then enter each amount */}
      <div className="p-3.5 space-y-2.5 border-b border-gray-100 dark:border-white/5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Additional expenses</span>
          {categories.length > 0 && (
            <button
              type="button"
              onClick={categories.every((c) => isOn(c.code)) ? () => onExpensesChange([]) : selectAll}
              className="text-[11px] font-bold text-[#f58220] hover:underline cursor-pointer"
            >
              {categories.every((c) => isOn(c.code)) ? "Clear all" : "Select all"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Expense categories">
          {categories.map((c) => {
            const on = isOn(c.code);
            return (
              <button
                key={c.code}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.code)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer",
                  on
                    ? "border-[#f58220] bg-orange-50 text-[#c2410c] dark:bg-orange-500/10 dark:text-orange-300"
                    : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-[#f58220]"
                )}
              >
                <span className={clsx("flex h-3.5 w-3.5 items-center justify-center rounded border", on ? "border-[#f58220] bg-[#f58220] text-white" : "border-gray-300 dark:border-white/20")}>
                  {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
                {c.label}
              </button>
            );
          })}
        </div>

        {expenses.length === 0 ? (
          <p className="text-[11px] text-gray-400">Tick the expenses to add. You can pick several at once.</p>
        ) : (
          <div className="rounded-lg border border-gray-100 dark:border-white/5 divide-y divide-gray-100 dark:divide-white/5">
            {categories.filter((c) => isOn(c.code)).flatMap((c) =>
              expenses.filter((e) => e.category === c.code).map((e, idx) => {
                const shared = e.basis === "PER_BATCH" ? sharedState(e.category) : null;
                const extraLine = idx > 0;
                return (
                  <div key={e.id} className="grid grid-cols-2 sm:grid-cols-[130px_auto_120px_minmax(0,1fr)_auto] gap-2 items-center px-2.5 py-2">
                    <span className={clsx("text-xs font-bold truncate", extraLine ? "text-gray-400 pl-3" : "text-gray-800 dark:text-white")}>
                      {extraLine ? "↳ " : ""}{c.label}
                    </span>
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 p-0.5 text-[11px] font-bold justify-self-end sm:justify-self-start" role="radiogroup" aria-label={`${c.label} basis`}>
                      {(Object.keys(BASIS_SHORT) as ExpenseBasis[]).map((b) => (
                        <button
                          key={b}
                          type="button"
                          role="radio"
                          aria-checked={e.basis === b}
                          disabled={b === "PER_BATCH" && extraLine}
                          onClick={() => update(e.id, { basis: b, rowKey: b === "PER_BATCH" ? "" : e.rowKey })}
                          className={clsx(
                            "px-2 py-1 rounded-md whitespace-nowrap cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                            e.basis === b ? "bg-[#f58220] text-white" : "text-gray-500 hover:text-gray-800 dark:hover:text-white"
                          )}
                        >
                          {BASIS_SHORT[b]}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">₹</span>
                      <input
                        type="number" min="0" step="0.01" inputMode="decimal"
                        value={e.amount}
                        onChange={(ev) => update(e.id, { amount: ev.target.value })}
                        placeholder="0"
                        aria-label={`${c.label} amount`}
                        className={clsx(sel, "w-full pl-5 pr-10 tabular-nums")}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400">{SUFFIX[e.basis]}</span>
                    </div>
                    {e.basis === "PER_BATCH" ? (
                      <span className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight">
                        Shared by weight packed
                        {shared && shared.allocatedBefore > 0 && <> · {inr(shared.allocatedBefore)} already charged</>}
                      </span>
                    ) : rows.length > 1 || e.rowKey ? (
                      <select value={e.rowKey} onChange={(ev) => update(e.id, { rowKey: ev.target.value })} className={sel} aria-label={`${c.label} applies to`}>
                        <option value="">All pack sizes</option>
                        {rows.map((r, i) => <option key={r.key} value={r.key}>{r.packetSize || `Row ${i + 1}`} only</option>)}
                      </select>
                    ) : (
                      <span className="text-[10px] text-gray-500 dark:text-slate-400">All pack sizes</span>
                    )}
                    <div className="flex items-center justify-end gap-1 col-span-2 sm:col-span-1">
                      {!extraLine && e.basis !== "PER_BATCH" && rows.length > 1 && (
                        <button
                          type="button"
                          title="Different rate for another pack size"
                          onClick={() => onExpensesChange([...expenses, { ...newLine(c.code, rows.find((r) => !expenses.some((x) => x.category === c.code && x.rowKey === r.key))?.key || ""), basis: e.basis }])}
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#f58220] hover:underline cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="h-3 w-3" /> per size
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onExpensesChange(expenses.filter((x) => x.id !== e.id))}
                        aria-label={`Remove ${c.label}`}
                        className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        {expenseError && <p className="text-[11px] font-semibold text-rose-600">{expenseError}</p>}
      </div>

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
          const withProfit = lines.map((x) => ({ ...x, p: profitOf(x.r.costPerGoodPacket, x.row.price, x.r.good) }));
          const totalCost = withProfit.reduce((s, x) => s + x.r.totalCost, 0);
          const goodTotal = withProfit.reduce((s, x) => s + x.r.good, 0);
          const priced = withProfit.filter((x) => x.p);
          const sales = priced.reduce((s, x) => s + Math.round((x.row.price || 0) * 100) * x.r.good, 0) / 100;
          const pl = priced.reduce((s, x) => s + Math.round(x.p!.total * 100), 0) / 100;
          const tone = (v: number) => (v < 0 ? "text-rose-600 dark:text-rose-400" : v > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-slate-300");
          return (
            <div className={clsx("space-y-2 transition-opacity", loadingPreview && "opacity-60")}>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[720px] text-left text-[11px] font-semibold text-gray-700 dark:text-slate-300">
                  <thead>
                    <tr className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-1.5 pr-2">Pack</th>
                      <th className="py-1.5 px-2 text-right">Good / Dmg</th>
                      <th className="py-1.5 px-2 text-right">Raw material</th>
                      {shownCategories.map((c) => <th key={c.code} className="py-1.5 px-2 text-right">{c.label}</th>)}
                      <th className="py-1.5 px-2 text-right">Production cost / pkt</th>
                      <th className="py-1.5 px-2 text-right">Selling price</th>
                      <th className="py-1.5 px-2 text-right">Profit / loss per pkt</th>
                      <th className="py-1.5 pl-2 text-right">Total profit / loss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {withProfit.map(({ row, r, p }) => (
                      <tr key={row.key}>
                        <td className="py-1.5 pr-2 font-bold text-gray-900 dark:text-white whitespace-nowrap">{row.packetSize || "—"}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{r.good} / {r.damaged}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{inr(r.rawMaterialPerPacket)}</td>
                        {shownCategories.map((c) => <td key={c.code} className="py-1.5 px-2 text-right tabular-nums">{inr(perCategory(r, c.code))}</td>)}
                        <td className="py-1.5 px-2 text-right tabular-nums font-bold text-gray-900 dark:text-white">
                          {inr(r.costPerGoodPacket)}
                          {r.damageAbsorbed > 0 && <div className="text-[9px] font-semibold text-amber-600">incl. {inr(r.damageAbsorbed)} damage</div>}
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{inr(row.price ?? null)}</td>
                        <td className={clsx("py-1.5 px-2 text-right tabular-nums font-bold", p ? tone(p.perPacket) : "")}>
                          {!p ? "—" : p.status === "BREAK_EVEN" ? "Break-even" : `${p.perPacket < 0 ? "−" : "+"}${inr(Math.abs(p.perPacket))}`}
                        </td>
                        <td className={clsx("py-1.5 pl-2 text-right tabular-nums font-bold", p ? tone(p.total) : "")}>
                          {!p ? "—" : `${p.total < 0 ? "−" : p.total > 0 ? "+" : ""}${inr(Math.abs(p.total))}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Combined summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 p-2.5 text-center">
                <div>
                  <p className="text-[9px] font-bold uppercase text-gray-400">Total production cost</p>
                  <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{inr(totalCost)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-gray-400">Good packets</p>
                  <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{goodTotal}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-gray-400">Estimated sales value</p>
                  <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{priced.length ? inr(sales) : "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase text-gray-400">Estimated {priced.length && pl < 0 ? "loss" : "profit"}</p>
                  <p className={clsx("text-sm font-bold tabular-nums", priced.length ? tone(pl) : "text-gray-400")}>
                    {!priced.length ? "—" : pl === 0 ? "Break-even" : `${pl < 0 ? "−" : "+"}${inr(Math.abs(pl))}`}
                  </p>
                </div>
                {priced.length < withProfit.length && (
                  <p className="col-span-2 sm:col-span-4 text-[10px] text-amber-600 font-semibold">
                    {withProfit.length - priced.length} pack size{withProfit.length - priced.length === 1 ? " has" : "s have"} no selling price yet — not included in profit/loss.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
