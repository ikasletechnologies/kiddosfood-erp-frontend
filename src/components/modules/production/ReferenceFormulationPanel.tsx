"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Check, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { recipesApi } from "@/lib/api";
import { convertUnit } from "@/lib/unitConversion";
import { autoQty, convertQty, defaultDisplayUnit, displayUnitsFor, entryUnitsFor, inputValueIn } from "@/lib/qty-display";

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
  // Imported formulations (Word recipe import).
  outputStage?: string | null;
  sourceReference?: { document?: string; section?: string; title?: string } | null;
  unresolvedItems?: Array<{ sourceName: string; sourceText?: string; reason?: string }> | null;
}

/** A saved formulation that can actually be scaled from. */
export function isUsableFormulation(f: any): f is Formulation {
  return !!f && Number.isFinite(Number(f.yieldQty)) && Number(f.yieldQty) > 0 && typeof f.yieldUnit === "string" && f.yieldUnit !== "" && Array.isArray(f.items);
}

const stockUnitOf = (item?: { unit?: string }) => (item?.unit || "").trim().toUpperCase();

/** A row as edited: text shown, the unit it's shown in, and (if untouched) its exact stock-unit value. */
type RowEdit = { text: string; unit: string; exact?: number };
// Up to 6 decimals, no trailing zeros ("0.25", "4").
const toInput = (n: number) => (Number.isFinite(n) ? String(Number(n.toFixed(6))) : "");

/**
 * Reference formulation for the selected recipe, entered as "how much of
 * each ingredient (in its stock unit) for the current production target".
 *
 * - With a saved version, the boxes show it scaled to the current target and
 *   re-scale as the target changes; the stored reference yield is untouched.
 * - Before a target is entered, the boxes show the saved version at its own
 *   reference output, and saving records them against that output.
 * - Saving records the boxes against the current target as a new version
 *   (reference yield = target), so quantities are never paired with a yield
 *   they weren't entered for.
 * - Each row's unit can be switched between compatible units (g <-> KG,
 *   ml <-> L); the value converts, the physical quantity stays the same, and
 *   nothing is saved until Save Formulation. Count units (PCS ...) offer only
 *   themselves: there is no verified factor to convert KG to PCS.
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
  // The yield the boxes are for: the production target, or (until one is
  // entered) the saved reference output itself, shown unscaled.
  const basis = targetValid
    ? { qty: targetQty, unit: targetUnit }
    : active && !outdated ? { qty: active.yieldQty, unit: active.yieldUnit } : null;

  // null = showing the saved version scaled to the target; an object = the
  // user's typed values, frozen until saved. Each edit is the text as shown,
  // the unit it is shown in (g / KG …), and — for a row the user hasn't typed
  // in — its exact value in the stock unit, so rounding for display never
  // changes what is saved.
  const [edits, setEdits] = useState<Record<string, RowEdit> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Display unit picked per row (untouched rows); display only, never saved.
  const [unitChoice, setUnitChoice] = useState<Record<string, string>>({});

  /** The saved version scaled to the basis yield, exact, in the stock unit. */
  const scaledSaved = (inventoryItemId: string, stockUnit: string): number | null => {
    if (!active || outdated || !basis) return null;
    const saved = active.items.find((i) => i.inventoryItemId === inventoryItemId);
    if (!saved) return null;
    const factor = convertUnit(basis.qty, basis.unit, active.yieldUnit) / active.yieldQty;
    return convertUnit(saved.quantity * factor, saved.unit, stockUnit);
  };

  const rows = ingredients.map((ing) => {
    const unit = stockUnitOf(ing.inventoryItem);
    const edit = edits?.[ing.inventoryItemId];
    let text: string;
    let shownUnit: string;
    let stockValue: number | null;
    if (edit) {
      text = edit.text;
      shownUnit = edit.unit;
      const typed = edit.text.trim() === "" ? NaN : Number(edit.text);
      stockValue = edit.exact ?? (Number.isFinite(typed) ? convertQty(typed, edit.unit, unit) : null);
    } else {
      stockValue = scaledSaved(ing.inventoryItemId, unit);
      const chosen = unitChoice[ing.inventoryItemId];
      if (chosen) {
        shownUnit = chosen;
        text = stockValue == null ? "" : inputValueIn(stockValue, unit, chosen) ?? "";
      } else {
        const shown = stockValue != null ? autoQty(stockValue, unit) : null;
        // An empty row is typed in the stock unit's own scale (kg → KG), never silently in grams.
        shownUnit = shown && displayUnitsFor(unit).length ? shown.unit : defaultDisplayUnit(unit);
        text = stockValue == null ? "" : displayUnitsFor(unit).length ? String(shown!.shown) : toInput(stockValue);
      }
    }
    return {
      inventoryItemId: ing.inventoryItemId,
      name: ing.inventoryItem?.name || "Ingredient",
      unit,
      shownUnit,
      text,
      stockValue,
      inventoryItem: ing.inventoryItem,
    };
  });

  const needsSave = !active || outdated || edits !== null;

  // Report what the requirement table should preview: nothing while the
  // saved version is shown as-is (the parent scales from it), otherwise the
  // entered quantities (in the stock unit) as a formulation for the current target.
  const rowsKey = rows.map((r) => `${r.inventoryItemId}=${r.stockValue}`).join("|");
  useEffect(() => {
    if (!needsSave) { onDraftChange(null); return; }
    onDraftChange({
      yieldQty: basis ? basis.qty : NaN,
      yieldUnit: basis ? basis.unit : targetUnit,
      items: rows
        .filter((r) => r.stockValue != null && r.stockValue > 0)
        .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.stockValue!, unit: r.unit, inventoryItem: r.inventoryItem })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSave, rowsKey, basis?.qty, basis?.unit]);

  // Freeze every currently shown value (exactly) so a later target change
  // can't silently rescale numbers the user is editing.
  const frozen = () => edits ?? Object.fromEntries(rows.map((r) => [r.inventoryItemId, { text: r.text, unit: r.shownUnit, exact: r.stockValue ?? undefined }]));

  const setValue = (id: string, value: string) => {
    setError("");
    const base = frozen();
    setEdits({ ...base, [id]: { text: value, unit: base[id]?.unit ?? rows.find((r) => r.inventoryItemId === id)!.shownUnit } });
  };

  /**
   * Shows a row in another compatible unit. The value converts exactly (the
   * physical quantity is unchanged); a row not yet edited stays unedited, so
   * this alone never marks the formulation as changed.
   */
  const changeUnit = (id: string, next: string) => {
    const row = rows.find((r) => r.inventoryItemId === id);
    if (!row) return;
    if (!entryUnitsFor(row.unit).includes(next)) {
      setError(`${row.name} is stocked in ${row.unit}; it can't be entered in ${next} without a conversion factor.`);
      return;
    }
    setError("");
    if (edits?.[id]) {
      const v = row.stockValue != null ? convertQty(row.stockValue, row.unit, next) : null;
      setEdits({ ...edits, [id]: { text: v != null ? toInput(v) : edits[id].text, unit: next, exact: row.stockValue ?? undefined } });
    } else {
      setUnitChoice({ ...unitChoice, [id]: next });
    }
  };

  const save = async () => {
    if (!basis) { setError("Enter the production target quantity first."); return; }
    if (rows.length === 0) { setError("Add ingredients to this recipe in Recipe Master first."); return; }
    const bad = rows.find((r) => !(r.stockValue != null && Number.isFinite(r.stockValue) && r.stockValue > 0));
    if (bad) { setError(`Enter a quantity greater than 0 for ${bad.name}.`); return; }
    setSaving(true);
    setError("");
    // The target becomes the reference yield. Expressed in the recipe's
    // existing yield unit when there is one (same amount — 3000 G is 3 KG),
    // since that unit is fixed once the recipe has been produced.
    const yieldUnit = active ? active.yieldUnit : basis.unit;
    const yieldQty = active ? convertUnit(basis.qty, basis.unit, active.yieldUnit) : basis.qty;
    try {
      const res = await recipesApi.saveFormulation(recipe.id, {
        yieldQty,
        yieldUnit,
        // Saved in each material's stock unit, at full precision.
        items: rows.map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: r.stockValue!, unit: r.unit })),
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
          {basis && (
            <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 normal-case tracking-normal">
              · for {toInput(basis.qty)} {basis.unit}{targetValid ? "" : " (reference output)"}
            </span>
          )}
        </h3>
        {active && (
          <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
            Reference output {toInput(active.yieldQty)} {active.yieldUnit}
            {active.outputStage ? ` (${active.outputStage})` : ""} · v{active.version}
            {active.source === "IMPORT" && active.sourceReference?.document ? ` · imported from ${active.sourceReference.document}` : ""}
          </p>
        )}
      </div>

      {/* Lines with no quantity in the source ("As Required"): shown, never calculated or deducted. */}
      {active && Array.isArray(active.unresolvedItems) && active.unresolvedItems.length > 0 && (
        <div className="px-4 py-2 border-b border-amber-100 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5">
          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Not calculated — no approved quantity</p>
          <ul className="mt-0.5 space-y-0.5">
            {active.unresolvedItems.map((u, i) => (
              <li key={i} className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                {u.sourceText || u.sourceName}
                <span className="text-amber-700/70 dark:text-amber-400/70"> · {u.reason === "AS_REQUIRED" ? "as required" : String(u.reason || "").toLowerCase().replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                value={r.text}
                onChange={(e) => setValue(r.inventoryItemId, e.target.value)}
                className="w-24 sm:w-28 h-8 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-2 rounded-lg text-xs font-semibold text-right text-gray-800 dark:text-white outline-none focus:border-[#f58220]"
              />
              <select
                aria-label={`${r.name} unit`}
                value={r.shownUnit}
                onChange={(e) => changeUnit(r.inventoryItemId, e.target.value)}
                disabled={entryUnitsFor(r.unit).length < 2}
                title={entryUnitsFor(r.unit).length < 2 ? `Stocked in ${r.unit || "—"}; no compatible unit to convert to` : `Stocked in ${r.unit}; converted exactly when saved`}
                className="w-16 h-8 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-1.5 rounded-lg text-xs font-bold text-gray-600 dark:text-slate-300 outline-none focus:border-[#f58220] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {(entryUnitsFor(r.unit).includes(r.shownUnit) ? entryUnitsFor(r.unit) : [r.shownUnit, ...entryUnitsFor(r.unit)]).filter(Boolean).map((u) => (
                  <option key={u} value={u} className="dark:bg-card">{u}</option>
                ))}
              </select>
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
