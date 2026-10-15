"use client";

import clsx from "clsx";
import { Check, Plus, X } from "lucide-react";
import { ExpenseBasis, RecipeExpenseDraft, isPackaging, newSizeRate } from "@/lib/recipe-expenses";

const BASES: Array<{ value: ExpenseBasis; label: string; suffix: string }> = [
  { value: "PER_BATCH", label: "Per Batch", suffix: "/batch" },
  { value: "PER_KG", label: "Per KG", suffix: "/kg" },
  { value: "PER_PACKET", label: "Per Packet", suffix: "/pkt" },
];

const input = "h-8 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded text-xs font-medium text-gray-800 dark:text-white outline-none focus:border-[#f58220] placeholder:text-gray-400 dark:placeholder:text-slate-500";

const HINT: Record<ExpenseBasis, { manufacturing: string; packaging: string }> = {
  PER_BATCH: { manufacturing: "Charged once per production batch.", packaging: "Charged once per batch, shared across packed sizes by weight." },
  PER_KG: { manufacturing: "Rate × actual output in KG, at Complete Production.", packaging: "Rate × packed weight in KG, at packaging." },
  PER_PACKET: { manufacturing: "Rate × packets, charged at packaging when packet counts are known.", packaging: "Rate × packets of each size, at packaging." },
};

/**
 * Additional Expenses for a recipe (Manpower, Electricity, Other Expenses,
 * Packaging Materials). Each is optional; production and packaging apply
 * them automatically from a copy saved when a batch starts.
 */
export default function RecipeExpensesEditor({ value, onChange }: { value: RecipeExpenseDraft[]; onChange: (next: RecipeExpenseDraft[]) => void }) {
  const update = (code: string, patch: Partial<RecipeExpenseDraft>) =>
    onChange(value.map((d) => (d.category === code ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
        Additional Expenses
        <span className="block text-[10px] font-normal text-gray-400 dark:text-slate-500">
          Optional. Applied automatically to every batch of this recipe. A batch keeps the amounts in force when it started.
        </span>
      </label>
      <div className="rounded-lg border border-gray-200 dark:border-white/5 divide-y divide-gray-100 dark:divide-white/5">
        {value.map((d) => {
          const packaging = isPackaging(d.category);
          const suffix = BASES.find((b) => b.value === d.basis)?.suffix;
          const sized = packaging && d.basis !== "PER_BATCH";
          return (
            <div key={d.category} className={clsx("p-2.5 sm:p-3 space-y-2", !d.enabled && "bg-gray-50/60 dark:bg-white/[0.01]")}>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={d.enabled}
                  onClick={() => update(d.category, { enabled: !d.enabled })}
                  className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-white cursor-pointer min-w-[150px]"
                >
                  <span className={clsx("flex h-4 w-4 items-center justify-center rounded border", d.enabled ? "border-[#f58220] bg-[#f58220] text-white" : "border-gray-300 dark:border-white/20")}>
                    {d.enabled && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  {d.label}
                </button>

                <div className={clsx("inline-flex rounded-lg border border-gray-200 dark:border-white/10 p-0.5 text-[11px] font-bold", !d.enabled && "opacity-50")} role="radiogroup" aria-label={`${d.label} calculation basis`}>
                  {BASES.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      role="radio"
                      aria-checked={d.basis === b.value}
                      disabled={!d.enabled}
                      onClick={() => update(d.category, { basis: b.value })}
                      className={clsx(
                        "px-2 py-1 rounded-md whitespace-nowrap cursor-pointer disabled:cursor-not-allowed",
                        d.basis === b.value ? "bg-[#f58220] text-white" : "text-gray-500 hover:text-gray-800 dark:hover:text-white"
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-36 ml-auto">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">₹</span>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={d.rate}
                    disabled={!d.enabled}
                    onChange={(e) => update(d.category, { rate: e.target.value })}
                    placeholder={sized ? "All sizes" : "0"}
                    aria-label={`${d.label} amount`}
                    className={clsx(input, "w-full pl-5 pr-12 tabular-nums disabled:opacity-50")}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400">{suffix}</span>
                </div>
              </div>

              {d.enabled && (
                <p className="text-[10px] text-gray-400 dark:text-slate-500">
                  {HINT[d.basis][packaging ? "packaging" : "manufacturing"]}
                  {sized && " Leave the amount blank to charge only the pack sizes listed below."}
                </p>
              )}

              {d.enabled && sized && (
                <div className="space-y-1.5 pl-6">
                  {d.sizeRates.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <input
                        value={s.packetSize}
                        onChange={(e) => update(d.category, { sizeRates: d.sizeRates.map((x) => (x.key === s.key ? { ...x, packetSize: e.target.value } : x)) })}
                        placeholder="e.g. 250g"
                        aria-label="Pack size"
                        className={clsx(input, "w-24 px-2")}
                      />
                      <div className="relative w-32">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">₹</span>
                        <input
                          type="number" min="0" step="0.01" inputMode="decimal"
                          value={s.rate}
                          onChange={(e) => update(d.category, { sizeRates: d.sizeRates.map((x) => (x.key === s.key ? { ...x, rate: e.target.value } : x)) })}
                          placeholder="0"
                          aria-label={`Rate for ${s.packetSize || "pack size"}`}
                          className={clsx(input, "w-full pl-5 pr-10 tabular-nums")}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-400">{suffix}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => update(d.category, { sizeRates: d.sizeRates.filter((x) => x.key !== s.key) })}
                        aria-label="Remove pack-size rate"
                        className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => update(d.category, { sizeRates: [...d.sizeRates, newSizeRate()] })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#f58220] hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Rate for a pack size
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
