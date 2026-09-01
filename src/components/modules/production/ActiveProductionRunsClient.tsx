"use client";

import { useState, useEffect, useCallback } from "react";
import { PlayCircle, StopCircle, CheckCircle2, ChevronRight, PackageCheck, AlertTriangle, FileText, CalendarClock, RefreshCw } from "lucide-react";
import { productionApi, inventoryApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import clsx from "clsx";
import { convertUnit } from "@/lib/unitConversion";

const STAGES = ["QUEUED", "MIXING", "COOKING", "COOLING", "READY_FOR_QC"] as const;

const STAGE_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  MIXING: "Mixing",
  COOKING: "Cooking",
  COOLING: "Cooling",
  READY_FOR_QC: "QC Inspection",
};

export default function ActiveProductionRunsClient() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [batchToApprove, setBatchToApprove] = useState<any | null>(null);
  const [actualYield, setActualYield] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [warehouseStockByWarehouse, setWarehouseStockByWarehouse] = useState<Record<string, any[]>>({});

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

  const handleAdvanceStage = async (id: string, stage: string) => {
    try {
      await productionApi.advanceStage(id, stage);
      toast.success(`Stage updated to ${STAGE_LABELS[stage] || stage}`);
      fetchHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update stage");
    }
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

  const handleCancel = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this production run?")) return;
    try {
      await productionApi.updateStatus(id, "CANCELLED");
      toast.success("Production run cancelled");
      fetchHistory();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to cancel production");
    }
  };

  const handleApproveClick = (production: any) => {
    setBatchToApprove(production);
    const expected = (production.quantity || 0) * (production.recipe?.yieldQty || 1);
    setActualYield(expected);
    setRemarks(production.remarks || "");
    setExpiryDate(production.expiryDate ? new Date(production.expiryDate).toISOString().split("T")[0] : "");
    setShowApprovalModal(true);
  };

  const handleFinalApprove = async () => {
    if (!batchToApprove) return;
    setSubmitting(true);
    try {
      await productionApi.approveBatch(batchToApprove.id, {
        actualYield: Number(actualYield),
        remarks: remarks.trim() || undefined,
        expiryDate: expiryDate || undefined
      });
      toast.success("Production completed & added to Batch Registry");
      setShowApprovalModal(false);
      setBatchToApprove(null);
      fetchHistory();
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
  const expectedYieldVal = (batchToApprove?.quantity || 0) * (batchToApprove?.recipe?.yieldQty || 1);
  const wasteVal = Math.max(0, expectedYieldVal - (Number(actualYield) || 0));
  const yieldUnit = batchToApprove?.recipe?.yieldUnit || "KG";

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
                  <span className="text-[10px] font-bold uppercase text-gray-400">Target Output</span>
                  <p className="font-mono font-bold text-gray-900 dark:text-white mt-0.5">
                    {((run.quantity || 0) * (run.recipe?.yieldQty || 1)).toFixed(2)} {run.recipe?.yieldUnit || "KG"}
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

              {/* Stage Progression Stepper */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Production Stage Progression</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {STAGES.map((stg) => {
                    const isCurrent = run.currentStage === stg;
                    const stageIdx = STAGES.indexOf(run.currentStage as any);
                    const thisIdx = STAGES.indexOf(stg);
                    const isPassed = stageIdx > thisIdx;

                    return (
                      <button
                        key={stg}
                        type="button"
                        onClick={() => handleAdvanceStage(run.id, stg)}
                        className={clsx(
                          "py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate flex items-center justify-center gap-1",
                          isCurrent
                            ? "bg-[#f58220] text-white border-[#f58220] shadow-2xs"
                            : isPassed
                            ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                            : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:text-gray-900"
                        )}
                      >
                        {isPassed && <CheckCircle2 size={12} />}
                        <span>{STAGE_LABELS[stg] || stg}</span>
                      </button>
                    );
                  })}
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
                  <CheckCircle2 size={15} /> Complete &amp; Yield Production
                </button>

                <button
                  onClick={() => handleCancel(run.id)}
                  className="w-full sm:flex-1 py-2 px-3.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-700 dark:text-rose-400 border border-rose-200 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Cancel Run
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Production Summary — Complete Production Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
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
                <span className="text-[10px] font-bold uppercase text-gray-400">Batch Code</span>
                <p className="text-xs font-bold text-[#f58220] font-mono mt-0.5">
                  {batchToApprove.productionBatchCode || "Pending"}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5 text-center">
              <span className="text-[10px] font-bold uppercase text-gray-400">Expected</span>
              <p className="text-sm font-bold font-mono text-gray-900 dark:text-white mt-0.5">
                {expectedYieldVal.toFixed(2)} {yieldUnit}
              </p>
            </div>

            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 text-center">
              <span className="text-[10px] font-bold uppercase text-indigo-700">Actual</span>
              <p className="text-sm font-bold font-mono text-indigo-600 mt-0.5">
                {(Number(actualYield) || 0).toFixed(2)} {yieldUnit}
              </p>
            </div>

            <div className={clsx("p-3 rounded-xl border text-center", wasteVal > 0 ? "bg-amber-50/60 border-amber-200" : "bg-emerald-50/60 border-emerald-200")}>
              <span className={clsx("text-[10px] font-bold uppercase", wasteVal > 0 ? "text-amber-700" : "text-emerald-700")}>
                Waste
              </span>
              <p className={clsx("text-sm font-bold font-mono mt-0.5", wasteVal > 0 ? "text-amber-800" : "text-emerald-800")}>
                {wasteVal.toFixed(2)} {yieldUnit}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
              Actual Finished Yield ({yieldUnit}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={actualYield === 0 ? "" : actualYield}
              onChange={(e) => setActualYield(Number(e.target.value))}
              placeholder={`Enter yield in ${yieldUnit}`}
              className="w-full bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500"
            />
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
              <FileText size={13} /> Remarks &amp; QC Notes
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter production remarks or QA observations..."
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
              disabled={submitting}
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
