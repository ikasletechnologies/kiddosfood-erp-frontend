"use client";

import { useState, useEffect, useCallback } from "react";
import { PlayCircle, StopCircle, CheckCircle2, ChevronRight, PackageCheck, AlertTriangle, FileText } from "lucide-react";
import { productionApi } from "@/lib/api";
import { formatERPNumber } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import clsx from "clsx";

const STAGES = ["QUEUED", "MIXING", "COOKING", "COOLING", "READY_FOR_QC"] as const;

const STAGE_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  MIXING: "Mixing",
  COOKING: "Cooking",
  COOLING: "Cooling",
  READY_FOR_QC: "QC",
};

function getNextStepLabel(currentStage: string): string {
  switch (currentStage) {
    case "QUEUED":
      return "MIXING";
    case "MIXING":
      return "COOKING";
    case "COOKING":
      return "COOLING";
    case "COOLING":
      return "QC";
    case "READY_FOR_QC":
      return "COMPLETE PRODUCTION";
    default:
      return "MIXING";
  }
}

function getNextStepInstruction(currentStage: string): string {
  switch (currentStage) {
    case "QUEUED":
      return "Press Mixing after queue preparation";
    case "MIXING":
      return "Press Cooking after Mixing is completed";
    case "COOKING":
      return "Press Cooling after Cooking is completed";
    case "COOLING":
      return "Proceed to QC after Cooling is completed";
    case "READY_FOR_QC":
      return "Review summary & Complete Production";
    default:
      return "Press Mixing after queue preparation";
  }
}

export default function ActiveProductionRunsClient() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [batchToApprove, setBatchToApprove] = useState<any | null>(null);
  const [actualYield, setActualYield] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await productionApi.getHistory();
      setHistory(res.data || []);
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
    setShowApprovalModal(true);
  };

  const handleFinalApprove = async () => {
    if (!batchToApprove) return;
    setSubmitting(true);
    try {
      await productionApi.approveBatch(batchToApprove.id, { 
        actualYield: Number(actualYield),
        remarks: remarks.trim() || undefined
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
      <div className="py-20 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Active Runs...</p>
      </div>
    );
  }

  const activeRuns = history.filter(h => h.status === 'IN_PROGRESS' || h.status === 'STOPPED');

  const expectedYieldVal = (batchToApprove?.quantity || 0) * (batchToApprove?.recipe?.yieldQty || 1);
  const wasteVal = Math.max(0, expectedYieldVal - (Number(actualYield) || 0));
  const yieldUnit = batchToApprove?.recipe?.yieldUnit || "KG";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-6">
        {activeRuns.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
            <PackageCheck size={36} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">No Active Production Runs</h3>
            <p className="text-xs text-slate-400 mt-1">Start a production run from the planning page to track batches here.</p>
          </div>
        ) : (
          activeRuns.map((run) => {
            const shortItems = (run.recipe?.recipeItems || []).filter((item: any) => {
              const required = (item.quantityRequired || 0) * (run.quantity || 1);
              const available = item.inventoryItem?.currentStock || 0;
              return available < required;
            });

            return (
              <div
                key={run.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col gap-6"
              >
                {/* Top Section: Title, Batch, Status, Current Stage, Next Step */}
                <div className="border-b border-slate-100 dark:border-slate-800/80 pb-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {run.recipe?.name || "IDLY DOSA BATTER"}
                    </h3>
                    <span
                      className={clsx(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit border",
                        run.status === "IN_PROGRESS"
                          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20"
                          : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                      )}
                    >
                      Status : {run.status === "IN_PROGRESS" ? "IN PROGRESS" : run.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Batch</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                        {formatERPNumber("PRD", run.id, run.producedAt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Status</span>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                        {run.status === "IN_PROGRESS" ? "IN PROGRESS" : run.status.replace("_", " ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Current Stage</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block uppercase">
                        {STAGE_LABELS[run.currentStage] || run.currentStage || "QUEUED"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Next Step</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block uppercase">
                        {getNextStepLabel(run.currentStage)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 block">
                        {getNextStepInstruction(run.currentStage)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Production Operational Details */}
                <div className="border-b border-slate-100 dark:border-slate-800/80 pb-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recipe</p>
                      <p className="text-xs font-black text-slate-900 dark:text-white mt-1 uppercase">
                        {run.recipe?.name || "Idly Dosa Batter"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected Yield</p>
                      <p className="text-xs font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                        {((run.quantity || 0) * (run.recipe?.yieldQty || 1)).toFixed(2)}{" "}
                        <span className="text-[10px] text-slate-400 font-normal">{run.recipe?.yieldUnit || "KG"}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingredients</p>
                      <p className="text-xs font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                        {run.recipe?.recipeItems?.length || 4}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Machine</p>
                      <p className="text-xs font-black text-slate-900 dark:text-white mt-1 uppercase">
                        {run.machine || "Mixer-01"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator</p>
                      <p className="text-xs font-black text-slate-900 dark:text-white mt-1 uppercase">
                        {run.operator?.user?.name || run.operator?.employeeCode || run.producedBy || "Admin"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Shift</p>
                      <p className="text-xs font-black text-slate-900 dark:text-white mt-1 uppercase">
                        {run.shift || "Morning"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2B: Conditional Stock Shortage & Production Paused Alerts */}
                {shortItems.length > 0 && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                      <p className="text-xs font-black text-rose-900 dark:text-rose-100 uppercase tracking-wider">
                        Stock Shortage — Cannot Continue
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[9px] font-black uppercase text-rose-600 dark:text-rose-400 border-b border-rose-200 dark:border-rose-800/50">
                            <th className="pb-1.5">Ingredient</th>
                            <th className="pb-1.5">Required</th>
                            <th className="pb-1.5">Available</th>
                            <th className="pb-1.5">Short</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-200/50 dark:divide-rose-800/30">
                          {shortItems.map((item: any, idx: number) => {
                            const required = (item.quantityRequired || 0) * (run.quantity || 1);
                            const available = item.inventoryItem?.currentStock || 0;
                            const short = required - available;
                            return (
                              <tr key={idx} className="text-rose-900 dark:text-rose-200 font-bold">
                                <td className="py-2">{item.inventoryItem?.name || "Ingredient"}</td>
                                <td className="py-2">{required.toFixed(2)} {item.inventoryItem?.unit || "KG"}</td>
                                <td className="py-2">{available.toFixed(2)} {item.inventoryItem?.unit || "KG"}</td>
                                <td className="py-2 text-rose-600 dark:text-rose-400">{short.toFixed(2)} {item.inventoryItem?.unit || "KG"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {run.status === "STOPPED" && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-amber-900 dark:text-amber-100 uppercase tracking-wide">
                          Production Paused
                        </p>
                        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                          Paused at:{" "}
                          {run.endTime
                            ? new Date(run.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                          • Reason: Power Failure / Manual Hold
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleResume(run.id)}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <PlayCircle size={14} /> Resume
                    </button>
                  </div>
                )}

                {/* Section 3: Workflow Stages */}
                <div className="border-b border-slate-100 dark:border-slate-800/80 pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {STAGES.map((stage, idx) => {
                      const currentIdx = STAGES.indexOf(run.currentStage as any);
                      const isCompleted = idx < currentIdx;
                      const isCurrent = idx === currentIdx;
                      const isUpcoming = idx > currentIdx;
                      const displayLabel = stage === "READY_FOR_QC" ? "QC" : STAGE_LABELS[stage] || stage;

                      return (
                        <button
                          key={stage}
                          onClick={() => handleAdvanceStage(run.id, stage)}
                          disabled={isCurrent || shortItems.length > 0}
                          title={isCurrent ? "Current Stage" : "Click to advance/update to this stage"}
                          className={clsx(
                            "flex-1 min-w-[110px] py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border",
                            isCompleted &&
                              "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100/60",
                            isCurrent &&
                              "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 ring-2 ring-indigo-500/30 cursor-default",
                            isUpcoming &&
                              "bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:text-slate-600"
                          )}
                        >
                          <span className="font-mono font-bold text-sm">
                            {isCompleted ? "✓" : isCurrent ? "●" : "○"}
                          </span>
                          <span>{displayLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 4: Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                  {run.status === "IN_PROGRESS" ? (
                    <button
                      onClick={() => handleStop(run.id)}
                      className="w-full sm:flex-1 py-3.5 px-4 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <StopCircle size={16} /> Pause Production
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResume(run.id)}
                      className="w-full sm:flex-1 py-3.5 px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <PlayCircle size={16} /> Resume Production
                    </button>
                  )}

                  <button
                    onClick={() => handleApproveClick(run)}
                    disabled={shortItems.length > 0}
                    className={clsx(
                      "w-full sm:flex-[1.3] py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg",
                      shortItems.length > 0
                        ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    )}
                  >
                    <CheckCircle2 size={16} /> Complete Production
                  </button>

                  <button
                    onClick={() => handleCancel(run.id)}
                    className="w-full sm:flex-1 py-3.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    Cancel Production
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Production Summary — Complete Production Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title="Production Summary — Complete Production"
      >
        <div className="space-y-6">
          {batchToApprove && (
            <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recipe</p>
                <p className="text-sm font-black text-slate-900 dark:text-white uppercase mt-0.5">
                  {batchToApprove.recipe?.name || "IDLY DOSA BATTER"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Batch</p>
                <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                  {formatERPNumber("PRD", batchToApprove.id, batchToApprove.producedAt)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected Yield</p>
              <p className="text-lg font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                {expectedYieldVal.toFixed(2)}{" "}
                <span className="text-xs text-slate-400 font-normal">{yieldUnit}</span>
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actual Yield</p>
              <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
                {(Number(actualYield) || 0).toFixed(2)}{" "}
                <span className="text-xs text-slate-400 font-normal">{yieldUnit}</span>
              </p>
            </div>

            <div
              className={clsx(
                "p-4 rounded-2xl border text-center",
                wasteVal > 0
                  ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                  : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
              )}
            >
              <p
                className={clsx(
                  "text-[9px] font-black uppercase tracking-widest",
                  wasteVal > 0
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-emerald-700 dark:text-emerald-400"
                )}
              >
                Waste
              </p>
              <p
                className={clsx(
                  "text-lg font-black mt-1 tabular-nums",
                  wasteVal > 0
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-emerald-800 dark:text-emerald-300"
                )}
              >
                {wasteVal.toFixed(2)}{" "}
                <span className="text-xs font-normal">{yieldUnit}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Actual Yield ({yieldUnit})
            </label>
            <input
              type="number"
              step="0.01"
              value={actualYield === 0 ? "" : actualYield}
              onChange={(e) => setActualYield(Number(e.target.value))}
              placeholder={`Enter actual yield in ${yieldUnit}`}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-base font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={12} /> Remarks / Production Notes
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter production remarks, QC notes, or reason for waste..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowApprovalModal(false)}
              disabled={submitting}
              className="flex-1 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleFinalApprove}
              disabled={submitting}
              className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? "Completing..." : "Complete Production"} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
