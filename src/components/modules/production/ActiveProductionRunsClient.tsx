"use client";

import { useState, useEffect, useCallback } from "react";
import { PlayCircle, StopCircle, CheckCircle2, PackageCheck, FileText, CalendarClock, RefreshCw, AlertTriangle, XCircle } from "lucide-react";
import { productionApi, inventoryApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { convertUnit } from "@/lib/unitConversion";
import { PRODUCTION_FEATURES, QC_NOT_REQUIRED } from "@/config/production-features";
import { plannedYieldOf, yieldVariance, fmtYield, fmtSigned, varianceTone } from "@/lib/production-yield";
import { MaterialLots, UNTRACKED, allocatedTotal, allocationCost, fifoDraft, toPayload } from "@/lib/lot-allocation";

// A material actually used beyond the plan, reported at completion.
type ExtraMaterial = { key: number; itemId: string; qty: string; lotId: string; note: string };
const AUTO_LOTS = "";
const inr = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const STAGE_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  MIXING: "Mixing",
  COOKING: "Cooking",
  COOLING: "Cooling",
  READY_FOR_QC: PRODUCTION_FEATURES.qc ? "QC Inspection" : "Ready to Complete",
};

export default function ActiveProductionRunsClient() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [wastageQty, setWastageQty] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [batchToApprove, setBatchToApprove] = useState<any | null>(null);
  // Typed text, so an empty / invalid entry is distinguishable from 0.
  const [actualYield, setActualYield] = useState<string>("");
  const [varianceThresholdPct, setVarianceThresholdPct] = useState<number>(20);
  const [remarks, setRemarks] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [warehouseStockByWarehouse, setWarehouseStockByWarehouse] = useState<Record<string, any[]>>({});

  // Cancel Run Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [runToCancel, setRunToCancel] = useState<any | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [extras, setExtras] = useState<ExtraMaterial[]>([]);
  const [extraLots, setExtraLots] = useState<Record<string, MaterialLots>>({});

  const fetchHistory = useCallback(async () => {
    try {
      const res = await productionApi.getHistory();
      const runs = res.data || [];
      setHistory(runs);

      const warehouseIds = Array.from(new Set(
        runs
          .filter((r: any) => r.status === 'IN_PROGRESS' || r.status === 'STOPPED')
          .map((r: any) => r.warehouseId)
          .filter(Boolean)
      )) as string[];

      const stockEntries = await Promise.all(
        warehouseIds.map(async (whId) => {
          try {
            const stockRes = await inventoryApi.getRawMaterialStockSummary(whId);
            return [whId, stockRes.data || []] as const;
          } catch {
            return [whId, []] as const;
          }
        })
      );
      setWarehouseStockByWarehouse(Object.fromEntries(stockEntries));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load production history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    productionApi.getCompletionSettings()
      .then((res) => {
        const n = Number(res.data?.varianceRemarksThresholdPct);
        if (Number.isFinite(n) && n >= 0) setVarianceThresholdPct(n);
      })
      .catch(() => { /* keep default; the server enforces the real value */ });
  }, []);

  const getAvailableFor = (run: any, item: any): number => {
    const stockList = run.warehouseId ? warehouseStockByWarehouse[run.warehouseId] : undefined;
    let raw = item.inventoryItem?.currentStock || 0;
    let rawUnit = item.inventoryItem?.unit;
    if (stockList) {
      const match = stockList.find((s: any) =>
        s.id === item.inventoryItemId ||
        (s.sku && item.inventoryItem?.sku && s.sku.trim().toLowerCase() === item.inventoryItem.sku.trim().toLowerCase())
      );
      if (match) {
        raw = match.availableStock || 0;
        rawUnit = match.unit || rawUnit;
      }
    }
    return convertUnit(raw, rawUnit, item.unit);
  };

  const handleStop = async (id: string) => {
    try {
      await productionApi.stopBatch(id);
      toast.success("Production paused");
      fetchHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to pause production");
    }
  };

  const handleResume = async (id: string) => {
    try {
      await productionApi.updateStatus(id, "IN_PROGRESS");
      toast.success("Production resumed");
      fetchHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to resume production");
    }
  };

  const handleCancelClick = (run: any) => {
    setRunToCancel(run);
    setShowCancelModal(true);
  };

  const handleCloseCancelModal = () => {
    if (cancelling) return;
    setShowCancelModal(false);
    setRunToCancel(null);
  };

  const handleConfirmCancel = async () => {
    if (!runToCancel || cancelling) return;
    setCancelling(true);
    try {
      await productionApi.updateStatus(runToCancel.id, "CANCELLED");
      toast.success("Production run cancelled");
      setShowCancelModal(false);
      setRunToCancel(null);
      fetchHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to cancel production");
    } finally {
      setCancelling(false);
    }
  };

  const handleApproveClick = (production: any) => {
    setBatchToApprove(production);
    // Left empty on purpose: the operator must enter what was really made.
    setActualYield("");
    setWastageQty(0);
    setExtras([]);
    setExtraLots({});
    setRemarks(production.remarks || "");
    setExpiryDate(production.expiryDate ? new Date(production.expiryDate).toISOString().split("T")[0] : "");
    setShowApprovalModal(true);
  };

  const handleFinalApprove = async () => {
    if (!batchToApprove || submitting) return;
    if (actualError) {
      toast.error(actualError);
      return;
    }
    if (remarksRequired && !remarks.trim()) {
      toast.error(`Add remarks — actual yield is more than ${varianceThresholdPct}% away from plan.`);
      return;
    }
    if (Number(wastageQty) < 0) {
      toast.error("Wastage cannot be negative");
      return;
    }
    if (extraError) {
      toast.error(extraError);
      return;
    }
    setSubmitting(true);
    try {
      const res = await productionApi.approveBatch(batchToApprove.id, {
        actualYield: Number(actualYield),
        remarks: remarks.trim() || undefined,
        expiryDate: expiryDate || undefined,
        wastageQty: Number(wastageQty) > 0 ? Number(wastageQty) : undefined,
        additionalMaterials: extraRows.length
          ? extraRows.map((r) => ({ inventoryItemId: r.itemId, quantity: r.qtyNum, lots: r.lots, note: r.note.trim() || undefined }))
          : undefined,
      });
      const batch = res.data?.batch;
      const otherActiveRuns = history.filter(
        (h) => h.id !== batchToApprove.id && (h.status === "IN_PROGRESS" || h.status === "STOPPED")
      ).length;
      setShowApprovalModal(false);
      setBatchToApprove(null);
      fetchHistory();
      if (batch?.qcStatus === QC_NOT_REQUIRED) {
        toast.success(`${batch.batchCode} completed — ready for packaging`);
        // Last open run: take the operator straight to the next step.
        if (otherActiveRuns === 0) router.push(`/packaging?batchId=${batch.id}`);
      } else {
        toast.success("Production completed & added to Batch Registry");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to complete production");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 animate-pulse">Loading Active Runs...</p>
      </div>
    );
  }

  const activeRuns = history.filter(h => h.status === 'IN_PROGRESS' || h.status === 'STOPPED');
  const planned = plannedYieldOf(batchToApprove);
  const yieldUnit = planned.unit;
  const actualNum = actualYield.trim() === "" ? NaN : Number(actualYield);
  const actualError = actualYield.trim() === ""
    ? "Enter the actual produced quantity."
    : !Number.isFinite(actualNum) || actualNum <= 0
    ? "Actual produced quantity must be a number greater than 0."
    : !/^\d+(\.\d{1,3})?$/.test(actualYield.trim())
    ? "Use up to 3 decimal places."
    : null;
  const variance = yieldVariance(planned.qty, actualError ? null : actualNum);
  const remarksRequired = variance.pct !== null && Math.abs(variance.pct) > varianceThresholdPct;

  // Additional materials: lots are the chosen one, or oldest first — the exact
  // allocation is sent, so what's costed here is what gets deducted.
  const materialOptions: any[] = (batchToApprove?.warehouseId && warehouseStockByWarehouse[batchToApprove.warehouseId]) || [];
  const extraRows = extras.filter((e) => e.itemId || e.qty.trim()).map((e) => {
    const lotsFor = extraLots[e.itemId];
    const qtyNum = Number(e.qty);
    const validQty = e.qty.trim() !== "" && Number.isFinite(qtyNum) && qtyNum > 0;
    let draft: Record<string, string> = {};
    if (lotsFor && validQty) {
      draft = e.lotId === AUTO_LOTS ? fifoDraft(lotsFor, qtyNum) : { [e.lotId]: String(qtyNum) };
    }
    const cap = !lotsFor ? 0 : e.lotId === AUTO_LOTS
      ? lotsFor.lots.reduce((s, l) => s + l.availableQty, 0) + lotsFor.untrackedQty
      : e.lotId === UNTRACKED ? lotsFor.untrackedQty : (lotsFor.lots.find((l) => l.id === e.lotId)?.availableQty ?? 0);
    const error = !e.itemId ? "Choose the material."
      : !validQty ? "Enter a quantity greater than 0."
      : !lotsFor ? "Loading lots…"
      : qtyNum > cap + 0.0005 ? `Only ${fmtYield(cap)} ${lotsFor.unit} available${e.lotId === AUTO_LOTS ? "" : " in that lot"}.`
      : Math.abs(allocatedTotal(draft) - qtyNum) > 0.0005 ? "Not enough stock." : null;
    return { ...e, qtyNum, unit: lotsFor?.unit || "", cost: lotsFor && !error ? allocationCost(lotsFor, draft) : 0, lots: toPayload(draft), error };
  });
  const extraError = extraRows.find((r) => r.error)?.error ?? null;
  const plannedMaterialCost = Number(batchToApprove?.materialCost) || 0;
  const additionalCost = extraRows.reduce((s, r) => s + r.cost, 0);
  const totalMaterialCost = plannedMaterialCost + additionalCost;

  const loadExtraLots = (itemId: string) => {
    if (!itemId || extraLots[itemId] || !batchToApprove?.warehouseId) return;
    productionApi.getLotOptions(batchToApprove.warehouseId, [itemId])
      .then((res) => {
        const m = Array.isArray(res.data) ? res.data[0] : null;
        if (m) setExtraLots((prev) => ({ ...prev, [itemId]: m }));
      })
      .catch(() => toast.error("Couldn't load lots for that material"));
  };
  const updateExtra = (key: number, patch: Partial<ExtraMaterial>) => {
    setExtras((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));
    if (patch.itemId) loadExtraLots(patch.itemId);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300 w-full min-w-0">
      {activeRuns.length === 0 ? (
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl py-20 flex flex-col items-center justify-center text-center space-y-3 p-6 shadow-2xs">
          <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center text-[#f58220]">
            <PackageCheck size={28} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">No Active Production Runs</h3>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Start a batch run from the planning scheduler to track progress here.</p>
          </div>
        </div>
      ) : (
        activeRuns.map((run) => {
          const shortItems = (run.recipe?.recipeItems || []).filter((item: any) => {
            const required = (item.quantityRequired || 0) * (run.quantity || 1);
            const available = getAvailableFor(run, item) + required;
            return available < required;
          });

          return (
            <div
              key={run.id}
              className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 p-4 sm:p-5 md:p-6 rounded-2xl shadow-2xs space-y-4 sm:space-y-5 transition-all"
            >
              {/* Header: Title, Batch, Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-gray-100 dark:border-white/5">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                    {run.recipe?.name || "Formulation Batch"}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-bold text-[#f58220]">
                      {run.productionBatchCode || "Batch In-Flight"}
                    </span>
                  </div>
                </div>

                <span
                  className={clsx(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit border shrink-0",
                    run.status === "IN_PROGRESS"
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20"
                      : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                  )}
                >
                  {run.status === "IN_PROGRESS" ? "In Progress" : run.status.replace("_", " ")}
                </span>
              </div>

              {/* Operational Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 bg-gray-50 dark:bg-white/[0.02] p-3 sm:p-4 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400">Planned Output</span>
                  <p className="font-mono font-bold text-gray-900 dark:text-white mt-0.5">
                    {fmtYield(plannedYieldOf(run).qty)} {plannedYieldOf(run).unit}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400">Current Stage</span>
                  <p className="font-bold text-[#f58220] mt-0.5">
                    {STAGE_LABELS[run.currentStage] || run.currentStage || "Queued"}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase text-gray-400">Ingredients</span>
                  <p className="font-bold text-gray-800 dark:text-white mt-0.5">
                    {run.recipe?.recipeItems?.length || 0} formulation items
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
                {run.status === "IN_PROGRESS" ? (
                  <button
                    onClick={() => handleStop(run.id)}
                    className="w-full sm:flex-1 py-2 px-3.5 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 text-amber-700 dark:text-amber-400 border border-amber-200 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <StopCircle size={15} /> Pause Batch
                  </button>
                ) : (
                  <button
                    onClick={() => handleResume(run.id)}
                    className="w-full sm:flex-1 py-2 px-3.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-400 border border-indigo-200 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlayCircle size={15} /> Resume Batch
                  </button>
                )}

                <button
                  onClick={() => handleApproveClick(run)}
                  disabled={shortItems.length > 0}
                  className={clsx(
                    "w-full sm:flex-[1.4] py-2 px-3.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer",
                    shortItems.length > 0
                      ? "bg-gray-200 dark:bg-white/10 text-gray-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  )}
                >
                  <CheckCircle2 size={15} /> Complete Production
                </button>

                <button
                  onClick={() => handleCancelClick(run)}
                  className="w-full sm:flex-1 py-2 px-3.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-700 dark:text-rose-400 border border-rose-200 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Cancel Run
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Cancel Production Run Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={handleCloseCancelModal}
        title="Cancel Production Run?"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3.5 p-3.5 bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/30 rounded-xl">
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-tight">
                Destructive Action
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5 leading-relaxed">
                Are you sure you want to cancel this production run? This action cannot be undone.
              </p>
            </div>
          </div>

          {runToCancel && (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product / Recipe</span>
                <span className="font-bold text-slate-900 dark:text-white uppercase truncate text-right">
                  {runToCancel.recipe?.name || "Formulation Batch"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Batch Code</span>
                <span className="font-mono font-bold text-[#f58220]">
                  {runToCancel.productionBatchCode || "Batch In-Flight"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stage &amp; Status</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {STAGE_LABELS[runToCancel.currentStage] || runToCancel.currentStage || "Queued"}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className={clsx(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                    runToCancel.status === "IN_PROGRESS"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                  )}>
                    {runToCancel.status === "IN_PROGRESS" ? "In Progress" : runToCancel.status?.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseCancelModal}
              disabled={cancelling}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Keep Run
            </button>
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="w-full sm:flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {cancelling ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <XCircle size={14} />
                  <span>Cancel Production Run</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Production Summary — Complete Production Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => { if (!submitting) setShowApprovalModal(false); }}
        title="Complete Production Batch"
      >
        <div className="space-y-4 text-xs">
          {batchToApprove && (
            <div className="bg-gray-50 dark:bg-white/[0.02] p-3.5 rounded-xl border border-gray-100 dark:border-white/5 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-gray-400">Recipe</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase mt-0.5">
                  {batchToApprove.recipe?.name || "Formulation Batch"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-gray-400">Production Batch ID</span>
                <p className="text-xs font-bold text-[#f58220] font-mono mt-0.5">
                  {batchToApprove.productionBatchCode || "Pending"}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase text-gray-400">Planned Quantity</span>
              <p className="text-sm font-bold font-mono text-gray-900 dark:text-white mt-0.5">{fmtYield(planned.qty)}</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase text-gray-400">Planned Unit</span>
              <p className="text-sm font-bold font-mono text-gray-900 dark:text-white mt-0.5">{yieldUnit}</p>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="actual-yield" className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
              Actual Produced Quantity ({yieldUnit}) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="actual-yield"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.001"
                autoFocus
                value={actualYield}
                onChange={(e) => setActualYield(e.target.value)}
                placeholder={`What was actually produced, in ${yieldUnit}`}
                className={clsx(
                  "w-full bg-gray-50 dark:bg-[#13151f] border rounded-xl px-3 py-2 pr-12 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none",
                  actualYield.trim() !== "" && actualError ? "border-rose-300 focus:border-rose-500" : "border-gray-200 dark:border-white/10 focus:border-emerald-500"
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">{yieldUnit}</span>
            </div>
            {actualYield.trim() !== "" && actualError && <p className="text-[11px] font-semibold text-rose-500">{actualError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-white/[0.01]">
              <span className="text-[10px] font-bold uppercase text-gray-400">Yield Difference</span>
              <p className={clsx("text-sm font-bold font-mono mt-0.5", varianceTone(variance.difference))}>
                {variance.difference == null ? "—" : `${fmtSigned(variance.difference)} ${yieldUnit}`}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-white/[0.01]">
              <span className="text-[10px] font-bold uppercase text-gray-400">Yield Variance</span>
              <p className={clsx("text-sm font-bold font-mono mt-0.5", varianceTone(variance.difference))}>
                {fmtSigned(variance.pct, "%")}
              </p>
            </div>
          </div>

          {/* Additional materials actually used beyond the plan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                Additional Materials Used <span className="font-medium text-gray-400">— only if extra material was really added</span>
              </span>
              <button
                type="button"
                onClick={() => setExtras((l) => [...l, { key: Date.now(), itemId: "", qty: "", lotId: AUTO_LOTS, note: "" }])}
                disabled={!batchToApprove?.warehouseId || extras.length >= 30}
                className="text-[11px] font-bold text-[#f58220] hover:underline cursor-pointer disabled:opacity-40 disabled:no-underline"
              >
                + Add material
              </button>
            </div>
            {extras.map((e) => {
              const row = extraRows.find((r) => r.key === e.key);
              const lotsFor = extraLots[e.itemId];
              return (
                <div key={e.key} className="rounded-xl border border-gray-100 dark:border-white/5 p-2.5 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_1fr_auto] gap-2 items-center">
                    <select
                      value={e.itemId}
                      aria-label="Material"
                      onChange={(ev) => updateExtra(e.key, { itemId: ev.target.value, lotId: AUTO_LOTS })}
                      className="bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-semibold dark:text-white"
                    >
                      <option value="">Material…</option>
                      {materialOptions.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name} ({fmtYield(m.availableStock)} {m.unit})</option>
                      ))}
                    </select>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={e.qty}
                        aria-label="Quantity used"
                        onChange={(ev) => updateExtra(e.key, { qty: ev.target.value })}
                        placeholder="Qty"
                        className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 pr-9 text-xs font-mono font-bold dark:text-white"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{row?.unit}</span>
                    </div>
                    <select
                      value={e.lotId}
                      aria-label="Purchase lot"
                      disabled={!lotsFor}
                      onChange={(ev) => updateExtra(e.key, { lotId: ev.target.value })}
                      className="bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-semibold dark:text-white disabled:opacity-50"
                    >
                      <option value={AUTO_LOTS}>Oldest lot first</option>
                      {lotsFor?.lots.map((l) => (
                        <option key={l.id} value={l.id}>{l.lotNumber} · {fmtYield(l.availableQty)} {lotsFor.unit} @ {inr(l.unitCost)}</option>
                      ))}
                      {lotsFor && lotsFor.untrackedQty > 0 && (
                        <option value={UNTRACKED}>Stock without lot · {fmtYield(lotsFor.untrackedQty)} {lotsFor.unit} @ {inr(lotsFor.averageCost)}</option>
                      )}
                    </select>
                    <button
                      type="button"
                      aria-label="Remove material"
                      onClick={() => setExtras((l) => l.filter((x) => x.key !== e.key))}
                      className="text-gray-400 hover:text-rose-500 cursor-pointer justify-self-end"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      value={e.note}
                      onChange={(ev) => updateExtra(e.key, { note: ev.target.value })}
                      placeholder="Why was it added? (optional)"
                      maxLength={500}
                      className="flex-1 min-w-[160px] bg-transparent border-b border-gray-200 dark:border-white/10 px-1 py-1 text-[11px] dark:text-white outline-none"
                    />
                    <span className={clsx("text-[11px] font-bold", row?.error ? "text-rose-500" : "text-gray-700 dark:text-slate-300")}>
                      {row?.error || inr(row?.cost)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actual material cost */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
              <span className="text-[9px] font-bold uppercase text-gray-400">Material Cost</span>
              <p className="text-xs font-bold font-mono text-gray-900 dark:text-white mt-0.5">{inr(totalMaterialCost)}</p>
              {additionalCost > 0 && <p className="text-[10px] text-gray-400">incl. {inr(additionalCost)} extra</p>}
            </div>
            <div className="p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
              <span className="text-[9px] font-bold uppercase text-gray-400">Planned Cost/{yieldUnit}</span>
              <p className="text-xs font-bold font-mono text-gray-900 dark:text-white mt-0.5">{planned.qty ? inr(plannedMaterialCost / planned.qty) : "—"}</p>
            </div>
            <div className="p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/5 col-span-2">
              <span className="text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Actual Material Cost/{yieldUnit}</span>
              <p className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                {actualError ? "—" : inr(totalMaterialCost / actualNum)}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
              Production Wastage ({yieldUnit}) <span className="font-medium text-gray-400">— optional</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={wastageQty === 0 ? "" : wastageQty}
              onChange={(e) => setWastageQty(Math.max(0, Number(e.target.value) || 0))}
              placeholder={
                variance.difference != null && variance.difference < 0
                  ? `Yield loss vs plan: ${fmtYield(-variance.difference)}`
                  : "0"
              }
              className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-amber-500"
            />
            <p className="text-[10px] text-gray-400 dark:text-slate-500">Recorded in Wastage Records as yield loss. Does not change stock.</p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
              <CalendarClock size={13} /> Batch Expiry Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText size={13} /> {PRODUCTION_FEATURES.qc ? <>Remarks &amp; QC Notes</> : "Production Remarks"}
              {remarksRequired
                ? <span className="text-rose-500">* required — variance is over {varianceThresholdPct}%</span>
                : <span className="font-medium text-gray-400">— optional</span>}
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter production remarks or observations..."
              className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-gray-800 dark:text-white outline-none resize-none focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
            <button
              onClick={() => setShowApprovalModal(false)}
              disabled={submitting}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleFinalApprove}
              disabled={submitting || !!actualError || (remarksRequired && !remarks.trim()) || !!extraError}
              className="flex-[2] py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Confirm Completion</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
