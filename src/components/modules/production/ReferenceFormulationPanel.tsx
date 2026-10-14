"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Check, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { recipesApi } from "@/lib/api";
import { convertUnit } from "@/lib/unitConversion";

export interface FormulationItem {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  inventoryItem: { id?: string; name: string; sku: string; unit: string; currentStock?: number };
}

export interface Formulation {
  id?: string;
  version?: number;
  yieldQty: number;
  yieldUnit: string;
  notes?: string | null;
  source?: string;
  createdAt?: string;
  items: FormulationItem[];
}

/** A saved formulation that can actually be scaled from. */
export function isUsableFormulation(f: any): f is Formulation {
  return !!f && Number.isFinite(Number(f.yieldQty)) && Number(f.yieldQty) > 0 && typeof f.yieldUnit === "string" && f.yieldUnit !== "" && Array.isArray(f.items);
}

const stockUnitOf = (item?: { unit?: string }) => (item?.unit || "").trim().toUpperCase();
// Up to 6 decimals, no trailing zeros ("0.25", "4").
const toInput = (n: number) => (Number.isFinite(n) ? String(Number(n.toFixed(6))) : "");

/**
 * Reference formulation for the selected recipe, entered as "how much of
 * each ingredient (in its stock unit) for the current production target".
 *
 * - With a saved version, the boxes show it scaled to the current target and
 *   re-scale as the target changes; the stored reference yield is untouched.
 * - Saving records the boxes against the current target as a new version
 *   (reference yield = target), so quantities are never paired with a yield
 *   they weren't entered for.
 */
export default function ReferenceFormulationPanel({
  recipe,
  outdated,
  targetQty,
  targetUnit,
  onDraftChange,
  onSaved,
}: {
  recipe: any;
  outdated: boolean;
  targetQty: number;
  targetUnit: string;
  onDraftChange: (draft: Formulation | null) => void;
  onSaved: (formulation: Formulation) => void;
}) {
  const active: Formulation | null = isUsableFormulation(recipe?.activeFormulation) ? recipe.activeFormulation : null;
  const ingredients: Array<{ inventoryItemId: string; inventoryItem: FormulationItem["inventoryItem"] }> =
    Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const targetValid = Number.isFinite(targetQty) && targetQty > 0 && !!targetUnit;

  // null = showing the saved version scaled to the target; an object = the
  // user's typed values, frozen until saved.
  const [edits, setEdits] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const scaledSaved = (inventoryItemId: string, stockUnit: string): string => {
    if (!active || outdated || !targetValid) return "";
    const saved = active.items.find((i) => i.inventoryItemId === inventoryItemId);
    if (!saved) return "";
    const factor = convertUnit(targetQty, targetUnit, active.yieldUnit) / active.yieldQty;
    return toInput(convertUnit(saved.quantity * factor, saved.unit, stockUnit));
  };

  const rows = ingredients.map((ing) => {
    const unit = stockUnitOf(ing.inventoryItem);
    return {
      inventoryItemId: ing.inventoryItemId,
      name: ing.inventoryItem?.name || "Ingredient",
      unit,
      inventoryItem: ing.inventoryItem,
      value: edits?.[ing.inventoryItemId] ?? scaledSaved(ing.inventoryItemId, unit),
    };
  });

  const needsSave = !active || outdated || edits !== null;

  // Report what the requirement table should preview: nothing while the
  // saved version is shown as-is (the parent scales from it), otherwise the
  // entered quantities as a formulation for the current target.
  const rowsKey = rows.map((r) => `${r.inventoryItemId}=${r.value}`).join("|");
  useEffect(() => {
    if (!needsSave) { onDraftChange(null); return; }
    onDraftChange({
      yieldQty: targetValid ? targetQty : NaN,
      yieldUnit: targetUnit,
      items: rows
        .filter((r) => r.value.trim() !== "" && Number(r.value) > 0)
        .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: Number(r.value), unit: r.unit, inventoryItem: r.inventoryItem })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSave, rowsKey, targetQty, targetUnit]);

  const setValue = (id: string, value: string) => {
    setError("");
    // Freeze every currently shown value so a later target change can't
    // silently rescale numbers the user is editing.
    const base = edits ?? Object.fromEntries(rows.map((r) => [r.inventoryItemId, r.value]));
    setEdits({ ...base, [id]: value });
  };

  const save = async () => {
    if (!targetValid) { setError("Enter the production target quantity first."); return; }
    if (rows.length === 0) { setError("Add ingredients to this recipe in Recipe Master first."); return; }
    const bad = rows.find((r) => !(r.value.trim() !== "" && Number.isFinite(Number(r.value)) && Number(r.value) > 0));
    if (bad) { setError(`Enter a quantity greater than 0 for ${bad.name}.`); return; }
    setSaving(true);
    setError("");
    // The target becomes the reference yield. Expressed in the recipe's
    // existing yield unit when there is one (same amount — 3000 G is 3 KG),
    // since that unit is fixed once the recipe has been produced.
    const yieldUnit = active ? active.yieldUnit : targetUnit;
    const yieldQty = active ? convertUnit(targetQty, targetUnit, active.yieldUnit) : targetQty;
    try {
      const res = await recipesApi.saveFormulation(recipe.id, {
        yieldQty,
        yieldUnit,
        items: rows.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: Number(r.value), unit: r.unit })),
      });
      toast.success("Formulation saved");
      setEdits(null);
      onSaved(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to save formulation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl shadow-2xs overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
        <h3 className="text-xs font-bold text-gray-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <FlaskConical size={15} className="text-[#f58220]" />
          Reference Formulation
          {targetValid && (
            <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 normal-case tracking-normal">
              · for {toInput(targetQty)} {targetUnit}
            </span>
          )}
        </h3>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-3 text-xs font-semibold text-gray-400">No ingredients selected for this recipe in Recipe Master.</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {rows.map((r) => (
            <div key={r.inventoryItemId} className="flex items-center gap-3 px-4 py-2">
              <span className="flex-1 min-w-0 text-xs font-semibold text-gray-800 dark:text-white truncate" title={r.name}>{r.name}</span>
              <input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                aria-label={`${r.name} quantity`}
                placeholder="Qty"
                value={r.value}
                onChange={(e) => setValue(r.inventoryItemId, e.target.value)}
                className="w-24 sm:w-28 h-8 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-2 rounded-lg text-xs font-semibold text-right text-gray-800 dark:text-white outline-none focus:border-[#f58220]"
              />
              <span className="w-10 text-xs font-bold text-gray-500 dark:text-slate-400">{r.unit || "—"}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-end gap-3">
        {error && <p className="flex-1 min-w-[180px] text-[11px] font-semibold text-red-600 dark:text-rose-400">{error}</p>}
        <button
          type="button"
          onClick={save}
          disabled={saving || !needsSave || rows.length === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
          Save Formulation
        </button>
      </div>
    </div>
  );
}
