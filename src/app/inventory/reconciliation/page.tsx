"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Sparkles,
  RotateCcw,
  Building2,
} from "lucide-react";
import { clsx } from "clsx";
import { inventoryApi, franchiseApi } from "@/lib/api";
import { toast } from "react-hot-toast";

interface SheetRow {
  itemId: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  systemStock: number;
}

export default function StockReconciliationPage() {
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [sheet, setSheet] = useState<SheetRow[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastResults, setLastResults] = useState<any[] | null>(null);

  useEffect(() => {
    franchiseApi
      .getAll()
      .then((res) => {
        const list = res.data || [];
        setFranchises(list);
        if (list.length > 0) {
          // Deterministic default: open at HQ if one is configured, rather
          // than whichever franchise the DB happened to return first.
          const hq = list.find((f: any) => f.isHQ);
          const fallback = [...list].sort((a: any, b: any) => a.name.localeCompare(b.name))[0];
          setSelectedFranchiseId((hq || fallback).id);
        }
      })
      .catch(() => toast.error("Failed to load franchises"));
  }, []);

  const loadSheet = useCallback(async () => {
    if (!selectedFranchiseId) return;
    setLoading(true);
    setLastResults(null);
    try {
      const res = await inventoryApi.getReconciliationSheet(selectedFranchiseId);
      setSheet(res.data || []);
      setCounts({});
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to load reconciliation sheet");
    } finally {
      setLoading(false);
    }
  }, [selectedFranchiseId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const handleSubmit = async () => {
    const entries = Object.entries(counts)
      .filter(([, v]) => v.trim() !== "")
      .map(([itemId, v]) => ({ itemId, physicalCount: Number(v) }));

    if (entries.length === 0) {
      toast.error("Enter at least one physical count before submitting");
      return;
    }

    setSubmitting(true);
    try {
      const res = await inventoryApi.submitReconciliation(entries);
      setLastResults(res.data || []);
      toast.success(`Reconciliation applied to ${entries.length} item(s)`);
      loadSheet();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to submit reconciliation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const rows = [
      ["STOCK RECONCILIATION REPORT"],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ["Item", "SKU", "Category", "Unit", "System Stock", "Physical Count", "Variance"],
      ...sheet.map((row) => {
        const entered = counts[row.itemId];
        const physicalCount = entered && entered.trim() !== "" ? Number(entered) : "";
        const variance =
          entered && entered.trim() !== "" ? Number(entered) - row.systemStock : "";
        return [
          row.name,
          row.sku,
          row.category,
          row.unit,
          row.systemStock.toString(),
          physicalCount.toString(),
          variance.toString(),
        ];
      }),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows
        .map((e) =>
          e
            .map((val) => `"${String(val).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Reconciliation_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const enteredCount = Object.values(counts).filter((v) => v.trim() !== "").length;

  // Collision detection for disambiguation
  const normalizedName = (name: string) => (name || "").trim().toLowerCase();
  const nameCollisionCounts = new Map<string, number>();
  sheet.forEach((row) => {
    const key = normalizedName(row.name);
    nameCollisionCounts.set(key, (nameCollisionCounts.get(key) || 0) + 1);
  });
  const displayName = (row: SheetRow) =>
    (nameCollisionCounts.get(normalizedName(row.name)) || 0) > 1
      ? `${row.name} — ${(row.unit || "UNIT").toUpperCase()}`
      : row.name;

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 print:bg-white print:p-0">
      {/* Header controls (hidden on Print) */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end items-start sm:items-center print:hidden border-b border-slate-200 dark:border-slate-800 pb-4">

        {/* Location Filter & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Franchise Selector (styled like the date picker in P&L) */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm">
            <div className="flex items-center px-2 text-slate-400">
              <Building2 size={14} />
            </div>
            <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider pl-1 select-none">
                Location
              </span>
              <select
                value={selectedFranchiseId}
                onChange={(e) => setSelectedFranchiseId(e.target.value)}
                className="bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-bold outline-none cursor-pointer"
              >
                {franchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Export / Print / Refresh Action Buttons */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <button
              onClick={handleExportCSV}
              title="Export Excel / CSV"
              className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 shadow-sm transition-all duration-150 active:scale-95"
            >
              <FileSpreadsheet size={16} />
            </button>
            <button
              onClick={handlePrint}
              title="Print Sheet"
              className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 shadow-sm transition-all duration-150 active:scale-95"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={loadSheet}
              title="Refresh Data"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95"
            >
              <RotateCcw size={16} className={clsx(loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-3 rounded-xl shadow-sm print:hidden overflow-x-auto custom-scrollbar max-w-full">
        <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none shrink-0">
          Summary :
        </span>
        <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">Total Items</span>
            <span className="font-black text-slate-900 dark:text-white">{sheet.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">Counted</span>
            <span className="font-black text-orange-600 dark:text-orange-400">
              {enteredCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap">Remaining</span>
            <span className="font-black text-slate-900 dark:text-white">
              {sheet.length - enteredCount}
            </span>
          </div>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none print:p-0 w-full min-w-0">
        {/* Print Header Block */}
        <div className="hidden print:block text-center mb-8 border-b-2 border-slate-900 pb-5 p-6">
          <h1 className="text-2xl font-black uppercase text-slate-900">
            STOCK RECONCILIATION REPORT
          </h1>
          <p className="text-sm font-bold text-slate-600 mt-1">Physical Count Worksheet</p>
          <div className="text-[10px] text-slate-400 mt-2">
            Generated on {new Date().toLocaleString()} | Enterprise Audit System
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
              Loading reconciliation count sheet...
            </p>
          </div>
        ) : sheet.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <ClipboardCheck size={40} className="text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-400">
              No active items for this location.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar w-full max-w-full select-text">
            <table className="w-full text-left border-collapse min-w-[580px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-700/60">
                  <th className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right w-36">
                    System Stock
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right w-40">
                    Physical Count
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right w-32">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {sheet.map((row) => {
                  const entered = counts[row.itemId];
                  const variance =
                    entered && entered.trim() !== ""
                      ? Number(entered) - row.systemStock
                      : null;

                  return (
                    <tr
                      key={row.itemId}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 sm:px-5 py-3">
                        <p className="text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {displayName(row)}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {row.sku} · {row.category}
                        </p>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-[13px] sm:text-sm font-bold text-right text-slate-700 dark:text-slate-200">
                        {row.systemStock}{" "}
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">
                          {row.unit}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={String(row.systemStock)}
                          value={entered || ""}
                          onChange={(e) =>
                            setCounts((prev) => ({
                              ...prev,
                              [row.itemId]: e.target.value,
                            }))
                          }
                          className="w-28 text-right bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all"
                        />
                      </td>
                      <td
                        className={clsx(
                          "px-4 sm:px-5 py-3 text-right text-[13px] sm:text-sm font-bold",
                          variance === null
                            ? "text-slate-300 dark:text-slate-600"
                            : variance === 0
                            ? "text-slate-500"
                            : variance > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        )}
                      >
                        {variance === null
                          ? "—"
                          : variance > 0
                          ? `+${variance}`
                          : variance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Apply Button Footer (inside the card) */}
        {!loading && sheet.length > 0 && (
          <div className="flex items-center justify-between px-4 sm:px-5 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/60">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {enteredCount} of {sheet.length} counted
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting || enteredCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 shadow-sm"
            >
              <CheckCircle2 size={16} />{" "}
              {submitting ? "Applying..." : "Apply Reconciliation"}
            </button>
          </div>
        )}
      </div>

      {/* Last Reconciliation Results */}
      {lastResults && lastResults.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden p-4 sm:p-5 space-y-3">
          <h3 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle size={14} /> Last Reconciliation Applied
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {lastResults.map((r, i) => (
              <div
                key={i}
                className="flex justify-between py-2 text-[13px] sm:text-sm"
              >
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Item {r.itemId.slice(0, 8)}…
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {r.systemStockBefore} → {r.physicalCount}{" "}
                  <span
                    className={clsx(
                      r.variance > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : r.variance < 0
                        ? "text-rose-500 dark:text-rose-400"
                        : "text-slate-500"
                    )}
                  >
                    ({r.variance > 0 ? "+" : ""}
                    {r.variance})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signature & Audit Stamp (Visible on Print ONLY) */}
      <div className="hidden print:flex justify-between items-end mt-16 pt-8 border-t border-slate-300">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Verified By
          </p>
          <div className="w-48 border-b border-slate-400 mt-8" />
          <p className="text-[10px] text-slate-500 mt-1">
            Authorized Stock Controller
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Stamp & Seal
          </p>
          <div className="w-32 h-20 border border-slate-300 border-dashed rounded mt-2 flex items-center justify-center text-[10px] text-slate-300">
            AFFIX SEAL HERE
          </div>
        </div>
      </div>
    </div>
  );
}
