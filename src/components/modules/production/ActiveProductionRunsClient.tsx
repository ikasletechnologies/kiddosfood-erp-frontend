"use client";

import { useState, useEffect, useCallback } from "react";
import { PlayCircle, StopCircle, CheckCircle2, ChevronRight, PackageCheck, AlertTriangle, FileText, CalendarClock } from "lucide-react";
import { productionApi, inventoryApi } from "@/lib/api";
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
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  // Stock the shortage check compares against, scoped to whichever warehouse
  // each run actually launched against — keyed by warehouseId. Runs from
  // before warehouse-scoped production existed have no warehouseId, so they
  // fall back to the item's plain currentStock (see getAvailableFor below).
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

  // Resolves available stock for one recipe ingredient, scoped to the run's
  // warehouse when known.
  const getAvailableFor = (run: any, item: any): number => {
    const stockList = run.warehouseId ? warehouseStockByWarehouse[run.warehouseId] : undefined;
    if (stockList) {
      const match = stockList.find((s: any) =>
        s.id === item.inventoryItemId ||
        (s.sku && item.inventoryItem?.sku && s.sku.trim().toLowerCase() === item.inventoryItem.sku.trim().toLowerCase())
      );
      if (match) return match.availableStock || 0;
    }
    return item.inventoryItem?.currentStock || 0;
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
    // Pre-fill from the estimate computed when the run started (shelf life /
    // ingredient batch expiry) — the operator confirms or corrects it here,
    // same as GRN's expiry capture for raw material lots.
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
              // Since this batch is already active (IN_PROGRESS/STOPPED), its raw materials 
              // have already been deducted from the warehouse stock. We add the required quantity 
              // back to get the pre-deduction available stock for a true shortage check.
              const available = getAvailableFor(run, item) + required;
              return available < required;
            });

            return (
              <div
                key={run.id}
                className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-6"
              >
                {/* Top Section: Title, Batch, Status */}
                <div className="border-b border-gray-200 pb-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-xl font-bold text-gray-800 uppercase tracking-tight">
                      {run.recipe?.name || "IDLY DOSA BATTER"}
                    </h3>
                    <span
                      className={clsx(
                        "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider w-fit border",
                        run.status === "IN_PROGRESS"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}
                    >
                      Status : {run.status === "IN_PROGRESS" ? "IN PROGRESS" : run.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-250">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 block uppercase">Batch</span>
                      <span className="text-sm font-semibold text-gray-800 font-mono mt-0.5 block">
                        {run.productionBatchCode || "Batch code pending"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 block uppercase">Status</span>
                      <span className="text-sm font-semibold text-indigo-600 mt-0.5 block">
                        {run.status === "IN_PROGRESS" ? "IN PROGRESS" : run.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Production Operational Details */}
                <div className="border-b border-gray-200 pb-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Recipe</p>
                      <p className="text-xs font-semibold text-gray-800 mt-1 uppercase">
                        {run.recipe?.name || "Idly Dosa Batter"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Expected Yield</p>
                      <p className="text-xs font-semibold text-gray-800 mt-1 tabular-nums">
                        {((run.quantity || 0) * (run.recipe?.yieldQty || 1)).toFixed(2)}{" "}
                        <span className="text-xs text-gray-400 font-normal">{run.recipe?.yieldUnit || "KG"}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Ingredients</p>
                      <p className="text-xs font-semibold text-gray-800 mt-1 tabular-nums">
                        {run.recipe?.recipeItems?.length || 4}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2B: Conditional Stock Shortage & Production Paused Alerts */}
                {shortItems.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                      <p className="text-xs font-semibold text-rose-900 uppercase tracking-wider">
                        Stock Shortage — Cannot Continue
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-xs font-semibold uppercase text-rose-600 border-b border-rose-200">
                            <th className="pb-1.5">Ingredient</th>
                            <th className="pb-1.5">Required</th>
                            <th className="pb-1.5">Available</th>
                            <th className="pb-1.5">Short</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-200/50">
                          {shortItems.map((item: any, idx: number) => {
                            const required = (item.quantityRequired || 0) * (run.quantity || 1);
                            const available = getAvailableFor(run, item) + required;
                            const short = required - available;
                            return (
                              <tr key={idx} className="text-rose-900 font-bold">
                                <td className="py-2">{item.inventoryItem?.name || "Ingredient"}</td>
                                <td className="py-2">{required.toFixed(2)} {item.inventoryItem?.unit || "KG"}</td>
                                <td className="py-2">{available.toFixed(2)} {item.inventoryItem?.unit || "KG"}</td>
                                <td className="py-2 text-rose-600">{short.toFixed(2)} {item.inventoryItem?.unit || "KG"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {run.status === "STOPPED" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                          Production Paused
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
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
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <PlayCircle size={14} /> Resume
                    </button>
                  </div>
                )}

                {/* Section 4: Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                  {run.status === "IN_PROGRESS" ? (
                    <button
                      onClick={() => handleStop(run.id)}
                      className="w-full sm:flex-1 py-2 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <StopCircle size={16} /> Pause Production
                    </button>
                  ) : (
                    <button
                      onClick={() => handleResume(run.id)}
                      className="w-full sm:flex-1 py-2 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <PlayCircle size={16} /> Resume Production
                    </button>
                  )}

                  <button
                    onClick={() => handleApproveClick(run)}
                    disabled={shortItems.length > 0}
                    className={clsx(
                      "w-full sm:flex-[1.3] py-2 px-4 rounded-lg font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm",
                      shortItems.length > 0
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    )}
                  >
                    <CheckCircle2 size={16} /> Complete Production
                  </button>

                  <button
                    onClick={() => handleCancel(run.id)}
                    className="w-full sm:flex-1 py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 shadow-sm"
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
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-250 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500">Recipe</p>
                <p className="text-sm font-bold text-gray-800 uppercase mt-0.5">
                  {batchToApprove.recipe?.name || "IDLY DOSA BATTER"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Batch</p>
                <p className="text-xs font-semibold text-[#f58220] font-mono mt-0.5">
                  {batchToApprove.productionBatchCode || "Batch code pending"}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-xs text-gray-500">Expected Yield</p>
              <p className="text-base font-bold text-gray-850 mt-1 tabular-nums">
                {expectedYieldVal.toFixed(2)}{" "}
                <span className="text-xs text-gray-400 font-normal">{yieldUnit}</span>
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-xs text-gray-500">Actual Yield</p>
              <p className="text-base font-bold text-indigo-600 mt-1 tabular-nums">
                {(Number(actualYield) || 0).toFixed(2)}{" "}
                <span className="text-xs text-gray-400 font-normal">{yieldUnit}</span>
              </p>
            </div>

            <div
              className={clsx(
                "p-4 rounded-lg border text-center",
                wasteVal > 0
                  ? "bg-amber-50 border-amber-200"
                  : "bg-emerald-50 border-emerald-200"
              )}
            >
              <p
                className={clsx(
                  "text-xs font-semibold uppercase tracking-wider",
                  wasteVal > 0
                    ? "text-amber-700"
                    : "text-emerald-700"
                )}
              >
                Waste
              </p>
              <p
                className={clsx(
                  "text-base font-bold mt-1 tabular-nums",
                  wasteVal > 0
                    ? "text-amber-800"
                    : "text-emerald-800"
                )}
              >
                {wasteVal.toFixed(2)}{" "}
                <span className="text-xs font-normal">{yieldUnit}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 block">
              Actual Yield ({yieldUnit})
            </label>
            <input
              type="number"
              step="0.01"
              value={actualYield === 0 ? "" : actualYield}
              onChange={(e) => setActualYield(Number(e.target.value))}
              placeholder={`Enter actual yield in ${yieldUnit}`}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 font-semibold"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
              <CalendarClock size={12} /> Expiry Date
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 font-semibold text-gray-800"
            />
            <p className="text-[11px] text-gray-400">
              Pre-filled from the product&apos;s configured shelf life — confirm or correct before completing.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
              <FileText size={12} /> Remarks / Production Notes
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter production remarks, QC notes, or reason for waste..."
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 text-gray-700 resize-none font-medium"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowApprovalModal(false)}
              disabled={submitting}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleFinalApprove}
              disabled={submitting}
              className="flex-[2] py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting ? "Completing..." : "Complete Production"} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
