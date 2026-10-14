"use client";

import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import {
  AllocationDraft, MaterialLots, UNTRACKED,
  allocatedTotal, allocationCost, allocationError, round3,
} from "@/lib/lot-allocation";

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmt = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
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

  const set = (key: string, value: string) => onChange({ ...draft, [key]: value });

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
        <p className="text-xs font-semibold text-rose-600">No usable lots in this warehouse (expired, blocked and rejected stock is excluded).</p>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[640px] text-left text-[11px] font-semibold text-gray-700 dark:text-slate-300">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                <th className="py-1.5 pr-2">Lot</th>
                <th className="py-1.5 px-2">Supplier</th>
                <th className="py-1.5 px-2">Received</th>
                <th className="py-1.5 px-2">Expiry</th>
                <th className="py-1.5 px-2 text-right">Available</th>
                <th className="py-1.5 px-2 text-right">Unit cost</th>
                <th className="py-1.5 px-2 text-right w-[110px]">Allocate ({unit})</th>
                <th className="py-1.5 pl-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100/70 dark:divide-white/5">
              {rows.map((r) => {
                const v = draft[r.key] ?? "";
                const q = Number(v) || 0;
                const over = q > r.availableQty + 0.0005;
                return (
                  <tr key={r.key}>
                    <td className="py-1.5 pr-2 font-mono text-gray-900 dark:text-white whitespace-nowrap">{r.lotNumber}</td>
                    <td className="py-1.5 px-2">{r.supplier || "—"}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{day(r.receivedAt)}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{day(r.expDate)}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{fmt(r.availableQty)} {unit}</td>
                    <td className="py-1.5 px-2 text-right whitespace-nowrap">{inr(r.unitCost)}/{unit}</td>
                    <td className="py-1.5 px-2 text-right">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={v}
                        aria-label={`Allocate from ${r.lotNumber}`}
                        onChange={(e) => set(r.key, e.target.value)}
                        className={clsx(
                          "w-full rounded-lg border px-2 py-1 text-right text-xs font-bold bg-white dark:bg-white/5 dark:text-white outline-none focus:ring-2 focus:ring-orange-200",
                          over ? "border-rose-400" : "border-gray-200 dark:border-white/10"
                        )}
                      />
                    </td>
                    <td className="py-1.5 pl-2 text-right whitespace-nowrap text-gray-900 dark:text-white">{q > 0 ? inr(q * r.unitCost) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
        <span className={clsx(error ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
          {error || `Allocated ${fmt(total)} of ${fmt(round3(required))} ${unit}`}
        </span>
        <span className="text-gray-700 dark:text-slate-300">
          Ingredient cost <span className="text-gray-900 dark:text-white">{inr(cost)}</span>
          {total > 0 && <span className="text-gray-400 font-semibold"> · {inr(cost / total)}/{unit}</span>}
        </span>
      </div>
    </div>
  );
}
