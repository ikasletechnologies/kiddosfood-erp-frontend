"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { FileText, History, Pencil, RefreshCw } from "lucide-react";
import { recipesApi } from "@/lib/api";

// Read-only view of a recipe's saved reference formulation in Recipe Master:
// reference output, output stage, ingredient measurements exactly as saved,
// "As Required" lines (never given a quantity) and where it came from. The
// active version comes with the recipe list; older versions are loaded on
// request and are clearly marked as history. Nothing here edits a quantity —
// "Edit Formulation" goes to the existing Production Planning workflow.

export interface ViewFormulationItem {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  sourceName?: string | null;
  inventoryItem?: { name?: string } | null;
}

export interface ViewFormulation {
  id: string;
  version: number;
  yieldQty: number;
  yieldUnit: string;
  source?: string;
  isActive?: boolean;
  createdAt?: string;
  outputStage?: string | null;
  sourceReference?: { document?: string; title?: string; section?: string } | null;
  unresolvedItems?: Array<{ sourceName: string; sourceText?: string; reason?: string }> | null;
  items: ViewFormulationItem[];
}

/** The saved measurement as entered: up to 6 decimals, no trailing zeros, no rounding. */
export const measurement = (n: number) => (Number.isFinite(n) ? String(Number(Number(n).toFixed(6))) : "—");

// Unit as written in kitchens: g / ml lower case, KG / L upper case.
const unitLabel = (u: string) => {
  const k = String(u || "").trim().toUpperCase();
  if (k === "G" || k === "GM" || k === "GMS") return "g";
  if (k === "ML") return "ml";
  if (k === "MG") return "mg";
  return k;
};

/** Where a version came from, in words. */
export function sourceLabel(f: Pick<ViewFormulation, "source" | "sourceReference">): string {
  if (f.source === "IMPORT") return f.sourceReference?.document || "Word import";
  if (f.source === "PLANNING") return "Saved in Production Planning";
  if (f.source === "RECIPE_FORM") return "Recipe form";
  if (f.source === "LEGACY") return "Existing recipe bill of materials";
  return f.source || "—";
}

const reasonLabel = (reason?: string) =>
  reason === "AS_REQUIRED" ? "As Required" : String(reason || "No quantity").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

interface Props {
  recipeName: string;
  active: ViewFormulation;
  recipeId: string;
  onEdit: () => void;
}

export default function RecipeFormulationView({ recipeName, active, recipeId, onEdit }: Props) {
  const [versions, setVersions] = useState<ViewFormulation[] | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [selectedId, setSelectedId] = useState<string>(active.id);

  // A newer active version (after a refresh) replaces whatever was shown.
  useEffect(() => { setSelectedId(active.id); setVersions(null); }, [active.id]);

  const loadVersions = async () => {
    setLoadingVersions(true);
    setVersionError("");
    try {
      const res = await recipesApi.getFormulations(recipeId);
      setVersions(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setVersionError(e?.response?.data?.error || "Could not load version history.");
    } finally {
      setLoadingVersions(false);
    }
  };

  const shown = (selectedId !== active.id && versions?.find((v) => v.id === selectedId)) || active;
  const historical = shown.id !== active.id;
  const unresolved = Array.isArray(shown.unresolvedItems) ? shown.unresolvedItems : [];

  return (
    <div
      className={clsx(
        "rounded-lg border",
        historical ? "border-amber-300 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/5" : "border-gray-200 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]"
      )}
      data-testid="formulation-view"
    >
      <div className="px-3 py-2.5 border-b border-gray-200/70 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-800 dark:text-white flex flex-wrap items-center gap-1.5">
            Reference Formulation — {recipeName}
            <span
              className={clsx(
                "px-1.5 py-0.5 rounded text-[10px] font-bold border",
                historical
                  ? "text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                  : "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20"
              )}
            >
              v{shown.version} · {historical ? "Historical" : "Active"}
            </span>
          </p>
          {historical && (
            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 mt-0.5">
              Older version, kept for reference. Production uses v{active.version}.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={versions ? () => setVersions(null) : loadVersions}
            disabled={loadingVersions}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50"
          >
            {loadingVersions ? <RefreshCw size={11} className="animate-spin" /> : <History size={11} />}
            {versions ? "Hide history" : "Version history"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-[#f58220] border border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20"
            title="Opens Production Planning, where formulations are edited and saved as a new version"
          >
            <Pencil size={11} /> Edit Formulation
          </button>
        </div>
      </div>

      {versionError && <p className="px-3 pt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{versionError}</p>}
      {versions && (
        <div className="px-3 pt-2 flex flex-wrap gap-1.5" role="group" aria-label="Formulation versions">
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id)}
              aria-pressed={v.id === shown.id}
              className={clsx(
                "px-2 py-0.5 rounded text-[11px] font-semibold border",
                v.id === shown.id
                  ? "bg-[#f58220] text-white border-[#f58220]"
                  : "bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:border-[#f58220]"
              )}
            >
              v{v.version}{v.id === active.id ? " (active)" : ""}
              {v.createdAt ? <span className="font-normal opacity-80"> · {new Date(v.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span> : null}
            </button>
          ))}
        </div>
      )}

      <dl className="px-3 pt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-gray-500 dark:text-slate-400 font-medium">Reference Output</dt>
          <dd className="font-bold text-gray-900 dark:text-white">{measurement(shown.yieldQty)} {unitLabel(shown.yieldUnit)}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-slate-400 font-medium">Output Stage</dt>
          <dd className="font-bold text-gray-900 dark:text-white">{shown.outputStage || "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-slate-400 font-medium">Version</dt>
          <dd className="font-bold text-gray-900 dark:text-white">v{shown.version}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-500 dark:text-slate-400 font-medium">Source</dt>
          <dd className="font-bold text-gray-900 dark:text-white flex items-center gap-1 min-w-0" title={sourceLabel(shown)}>
            {shown.source === "IMPORT" && <FileText size={11} className="text-[#f58220] shrink-0" />}
            <span className="truncate">{sourceLabel(shown)}</span>
          </dd>
        </div>
      </dl>

      <table className="w-full mt-2.5 text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-slate-500 border-b border-gray-200/70 dark:border-white/5">
            <th className="text-left font-semibold px-3 py-1.5">Ingredient</th>
            <th className="text-right font-semibold px-3 py-1.5">Reference Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {shown.items.map((i) => {
            const name = i.inventoryItem?.name || "Ingredient";
            const asWritten = i.sourceName && i.sourceName.trim().toLowerCase() !== name.trim().toLowerCase() ? i.sourceName : null;
            return (
              <tr key={i.inventoryItemId}>
                <td className="px-3 py-1.5 text-gray-800 dark:text-slate-200 font-medium">
                  {name}
                  {asWritten && <span className="block text-[10px] text-gray-400 dark:text-slate-500 font-normal">as written: {asWritten}</span>}
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                  {measurement(i.quantity)} {unitLabel(i.unit)}
                </td>
              </tr>
            );
          })}
          {unresolved.map((u, idx) => (
            <tr key={`u-${idx}`} className="bg-amber-50/60 dark:bg-amber-500/5">
              <td className="px-3 py-1.5 text-amber-900 dark:text-amber-200 font-medium">
                {u.sourceName}
                <span className="block text-[10px] text-amber-700/80 dark:text-amber-400/80 font-normal">Not calculated or deducted</span>
              </td>
              <td className="px-3 py-1.5 text-right font-bold text-amber-800 dark:text-amber-300 whitespace-nowrap">{reasonLabel(u.reason)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
