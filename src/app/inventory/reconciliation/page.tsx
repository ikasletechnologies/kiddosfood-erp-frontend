"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
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
    franchiseApi.getAll().then((res) => {
      setFranchises(res.data || []);
      if (res.data?.length > 0) setSelectedFranchiseId(res.data[0].id);
    }).catch(() => toast.error("Failed to load franchises"));
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

  useEffect(() => { loadSheet(); }, [loadSheet]);

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

  const enteredCount = Object.values(counts).filter((v) => v.trim() !== "").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="text-orange-500" size={24} />
            Stock Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Compare system stock against a physical count and apply corrections in one pass.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedFranchiseId}
            onChange={(e) => setSelectedFranchiseId(e.target.value)}
            className="bg-white border border-slate-200 text-slate-900 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider focus:outline-none"
          >
            {franchises.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button onClick={loadSheet} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-orange-500 transition-all">
            <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Loading count sheet...</div>
      ) : sheet.length === 0 ? (
        <div className="py-20 text-center text-slate-400 text-sm">No active items for this location.</div>
      ) : (
        <>
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Item</th>
                  <th className="text-right px-5 py-3">System Stock</th>
                  <th className="text-right px-5 py-3">Physical Count</th>
                  <th className="text-right px-5 py-3">Variance</th>
                </tr>
              </thead>
              <tbody>
                {sheet.map((row) => {
                  const entered = counts[row.itemId];
                  const variance = entered && entered.trim() !== "" ? Number(entered) - row.systemStock : null;
                  return (
                    <tr key={row.itemId} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-800">{row.name}</p>
                        <p className="text-[10px] text-slate-400">{row.sku} · {row.category}</p>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-slate-600">{row.systemStock} {row.unit}</td>
                      <td className="px-5 py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={String(row.systemStock)}
                          value={entered || ""}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [row.itemId]: e.target.value }))}
                          className="w-28 text-right border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold outline-none focus:border-orange-500"
                        />
                      </td>
                      <td className={clsx(
                        "px-5 py-3 text-right font-mono font-bold",
                        variance === null ? "text-slate-300" : variance === 0 ? "text-slate-500" : variance > 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {variance === null ? "—" : (variance > 0 ? `+${variance}` : variance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">{enteredCount} of {sheet.length} counted</p>
            <button
              onClick={handleSubmit}
              disabled={submitting || enteredCount === 0}
              className="flex items-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
            >
              <CheckCircle2 size={16} /> {submitting ? "Applying..." : "Apply Reconciliation"}
            </button>
          </div>

          {lastResults && lastResults.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 space-y-2">
              <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle size={14} /> Last Reconciliation Applied
              </h3>
              {lastResults.map((r, i) => (
                <div key={i} className="flex justify-between text-xs text-amber-800">
                  <span>Item {r.itemId.slice(0, 8)}…</span>
                  <span className="font-mono font-bold">
                    {r.systemStockBefore} → {r.physicalCount} ({r.variance > 0 ? "+" : ""}{r.variance})
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
