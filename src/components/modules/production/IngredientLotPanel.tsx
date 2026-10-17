"use client";

import { useState } from "react";
import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import {
  AllocationDraft, MaterialLots, UNTRACKED,
  allocatedTotal, allocationCost, allocationError,
} from "@/lib/lot-allocation";
import { autoQty, convertQty, defaultDisplayUnit, entryUnitsFor, formatQty, inputValueIn } from "@/lib/qty-display";

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

interface Props {
  material: MaterialLots;
  /** Required quantity in the material's stock unit. */
  required: number;
  draft: AllocationDraft;
  /** True once the operator has changed the suggested allocation. */
  edited: boolean;
  onChange: (draft: AllocationDraft) => void;
  onReset: () => void;
}

/** Select Purchase Lots: split one ingredient's requirement across specific lots. */
export default function IngredientLotPanel({ material, required, draft, edited, onChange, onReset }: Props) {
  const total = allocatedTotal(draft);
  const error = allocationError(material, draft, required);
  const cost = allocationCost(material, draft);
  const unit = material.unit;
  const rows = [
    ...material.lots.map((l) => ({ key: l.id, ...l })),
    ...(material.untrackedQty > 0
      ? [{ key: UNTRACKED, id: UNTRACKED, lotNumber: "Stock without lot", billNumber: null, supplier: null, receivedAt: null, expDate: null, availableQty: material.untrackedQty, unitCost: material.averageCost }]
      : []),
  ];

  // Each lot can be entered in g or KG (ml or L); the draft always holds the stock unit.
  const units = entryUnitsFor(unit);
  const [entryUnits, setEntryUnits] = useState<Record<string, string>>({});
  // What the operator typed, in their chosen unit — kept so "0." or "37." isn't reformatted mid-typing.
  const [texts, setTexts] = useState<Record<string, string>>({});
  const entryUnitOf = (key: string) => entryUnits[key] ?? defaultDisplayUnit(unit);

  const toStock = (text: string, from: string): string => {
    if (text.trim() === "") return "";
    const v = convertQty(Number(text), from, unit);
    return v == null || !Number.isFinite(v) ? text : String(v);
  };
  const textFor = (key: string): string => {
    const stock = draft[key] ?? "";
    const typed = texts[key];
    const from = entryUnitOf(key);
    // Show the typed text while it still matches the draft; otherwise (reset, oldest first) derive it.
    if (typed != null && (typed === "") === (stock === "") && (Number(toStock(typed, from)) || 0) === (Number(stock) || 0)) return typed;
    if (stock === "") return "";
    return inputValueIn(Number(stock) || 0, unit, from) ?? stock;
  };

  const set = (key: string, text: string) => {
    setTexts((t) => ({ ...t, [key]: text }));
    onChange({ ...draft, [key]: toStock(text, entryUnitOf(key)) });
  };
  const changeUnit = (key: string, next: string) => {
    setEntryUnits((u) => ({ ...u, [key]: next }));
    setTexts((t) => {
      const rest = { ...t };
      delete rest[key];
      return rest;
    });
  };

  return (
    <div className="bg-orange-50/30 dark:bg-white/[0.02] border-t border-orange-100 dark:border-white/5 px-3 sm:px-5 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
          Select purchase lots · {material.name}
        </p>
        {edited && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#f58220] hover:underline cursor-pointer">
            <RotateCcw size={11} /> Oldest first
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs font-semibold text-rose-600">
          No usable lots in this warehouse{material.unavailableLots?.length ? " — see the lots below for the reason." : " (expired, blocked and rejected stock is excluded)."}
        </p>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[700px] text-left text-[11px] font-semibold text-gray-700 dark:text-slate-300">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                <th className="py-1.5 pr-2">Lot</th>
                <th className="py-1.5 px-2">Supplier</th>
                <th className="py-1.5 px-2">Received</th>
                <th className="py-1.5 px-2">Expiry</th>
                <th className="py-1.5 px-2 text-right">Available</th>
                <th className="py-1.5 px-2 text-right">Unit cost</th>
                <th className="py-1.5 px-2 text-right w-[170px]">Allocate</th>
                <th className="py-1.5 pl-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100/70 dark:divide-white/5">
              {rows.map((r) => {
                const q = Number(draft[r.key]) || 0;
                const over = q > r.availableQty + 0.0005;
                return (
                  <tr key={r.key}>
                    <td className="py-1.5 pr-2 font-mono text-gray-900 dark:text-white whitespace-nowrap">{r.lotNumber}</td>
                    <td className="py-1.5 px-2">{r.supplier || "—"}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{day(r.receivedAt)}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{day(r.expDate)}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{formatQty(r.availableQty, unit, "down")}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{inr(r.unitCost)}/{unit}</td>
                    <td className="py-1.5 px-2 text-right">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={textFor(r.key)}
                          aria-label={`Allocate from ${r.lotNumber}`}
                          onChange={(e) => set(r.key, e.target.value)}
                          className={clsx(
                            "min-w-0 flex-1 rounded-lg border px-2 py-1 text-right text-xs font-bold bg-white dark:bg-white/5 dark:text-white outline-none focus:ring-2 focus:ring-orange-200",
                            over ? "border-rose-400" : "border-gray-200 dark:border-white/10"
                          )}
                        />
                        <select
                          aria-label={`Unit for ${r.lotNumber}`}
                          value={entryUnitOf(r.key)}
                          onChange={(e) => changeUnit(r.key, e.target.value)}
                          disabled={units.length < 2}
                          title={units.length < 2 ? `Stocked in ${unit}` : `Stocked in ${unit}; converted exactly`}
                          className="w-14 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] px-1 py-1 text-xs font-bold text-gray-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {(units.includes(entryUnitOf(r.key)) ? units : [entryUnitOf(r.key), ...units]).map((u) => (
                            <option key={u} value={u} className="dark:bg-card">{u}</option>
                          ))}
                        </select>
                      </div>
                      {/* Stored in the stock unit; echo it in the other unit when that reads differently. */}
                      {q > 0 && autoQty(q, unit).unit.toUpperCase() !== entryUnitOf(r.key).toUpperCase() && (
                        <span className="block text-[10px] font-semibold text-gray-400 mt-0.5">= {formatQty(q, unit)}</span>
                      )}
                    </td>
                    <td className="py-1.5 pl-2 text-right whitespace-nowrap text-gray-900 dark:text-white">{q > 0 ? inr(q * r.unitCost) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lots with stock that can't be used here — shown with the reason, never allocatable. */}
      {!!material.unavailableLots?.length && (
        <div className="rounded-lg border border-rose-100 dark:border-rose-500/20 bg-rose-50/40 dark:bg-rose-500/5 px-2.5 py-2 space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-rose-500">Not available for this production</p>
          {material.unavailableLots.map((l) => (
            <div key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[11px]">
              <span className="font-mono font-bold text-gray-700 dark:text-slate-200">
                {l.lotNumber}
                <span className="font-sans font-semibold text-gray-400"> · {formatQty(l.availableQty, unit, "down")} · exp {day(l.expDate)}{l.warehouse ? ` · ${l.warehouse}` : ""}</span>
              </span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">{l.reason}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
        <span className={clsx(error ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
          {error || `Allocated ${formatQty(total, unit)} of ${formatQty(required, unit)}`}
        </span>
        <span className="text-gray-700 dark:text-slate-300">
          Ingredient cost <span className="text-gray-900 dark:text-white">{inr(cost)}</span>
          {total > 0 && <span className="text-gray-400 font-semibold"> · {inr(cost / total)}/{unit}</span>}
        </span>
      </div>
    </div>
  );
}
