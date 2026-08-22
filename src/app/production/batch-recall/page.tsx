"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldAlert, Search, Package, Store, AlertTriangle,
  CheckCircle2, XCircle, Truck, Clock, RefreshCw,
  ChevronRight, MapPin, FileText, ArrowRight, X, Undo2, Ban
} from "lucide-react";
import { clsx } from "clsx";
import api from "@/lib/api/base";
import { recallApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

interface RecallBatch {
  id: string;
  batchCode: string;
  productName: string;
  productionDate: string;
  expiryDate: string;
  producedQty: number;
  approvedQty: number;
  rejectedQty: number;
  packagedQty: number;
  cartonedQty: number;
  unit: string;
  status: string;
  qcStatus: string;
  recallStatus: "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | null;
  recallStep: string | null;
}

interface EligibilityResponse {
  eligible: boolean;
  reasons: string[];
  batch: {
    id: string;
    batchCode: string;
    productName: string;
    qcStatus: string;
    unit: string;
    producedQty: number;
    approvedQty: number;
    rejectedQty: number;
    packagedQty: number;
    cartonedQty: number;
    availableQty: number;
    distributedQty: number;
  };
  recall: RecallRow | null;
}

interface RecallEvent {
  id: string;
  event: string;
  status: string;
  actor: string | null;
  affectedQty: number | null;
  details: any;
  createdAt: string;
}

interface RecallRow {
  id: string;
  productBatchId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  step: "INITIATED" | "DISTRIBUTION_LOCATED" | "SALES_BLOCKED" | "REPORT_GENERATED" | "RETURN_COLLECTED" | "COMPLETED";
  reason: string;
  reasonNotes: string | null;
  distributedQty: number;
  returnedQty: number;
  affectedLocations: { type: string; label: string; qty: number }[] | null;
  initiatedBy: string | null;
  initiatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  events?: RecallEvent[];
}

const STEP_ORDER = ["INITIATED", "DISTRIBUTION_LOCATED", "SALES_BLOCKED", "REPORT_GENERATED", "RETURN_COLLECTED"] as const;

const STEPS: { key: typeof STEP_ORDER[number]; label: string; icon: any }[] = [
  { key: "INITIATED", label: "Identify Defective Batch", icon: Search },
  { key: "DISTRIBUTION_LOCATED", label: "Locate Distribution", icon: MapPin },
  { key: "SALES_BLOCKED", label: "Block Sales", icon: XCircle },
  { key: "REPORT_GENERATED", label: "Generate Recall Report", icon: FileText },
  { key: "RETURN_COLLECTED", label: "Collect Returned Stock", icon: Package },
];

const RECALL_REASONS = [
  "Failed safety test",
  "Contamination",
  "Packaging defect",
  "Incorrect labeling",
  "Customer complaint",
  "Expiry issue",
  "Other",
];

const QC_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  APPROVED: { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  PARTIALLY_APPROVED: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  REJECTED: { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  PENDING: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
};
const DEFAULT_QC_STYLE = { color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };

const RECALL_STYLES: Record<string, { color: string; bg: string; border: string; label: string }> = {
  IN_PROGRESS: { color: "text-[#f58220]", bg: "bg-orange-50", border: "border-orange-200", label: "Recall In Progress" },
  COMPLETED: { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", label: "Recalled" },
  CANCELLED: { color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200", label: "Recall Cancelled" },
};

export default function BatchRecallPage() {
  const [batches, setBatches] = useState<RecallBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [recall, setRecall] = useState<RecallRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showReasonForm, setShowReasonForm] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonNotes, setReasonNotes] = useState("");
  const [returnQtyInput, setReturnQtyInput] = useState("");

  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<string | null>(null);

  const { showToast } = useToast();

  const loadBatches = useCallback(async () => {
    try {
      const res = await api.get("/api/production/batches");
      const data: RecallBatch[] = (res.data || []).map((b: any) => ({
        id: b.id,
        batchCode: b.batchCode || b.id?.slice(-6),
        productName: b.product?.name || b.recipe?.name || "Unknown Product",
        productionDate: b.production?.startTime || b.mfgDate || b.createdAt,
        expiryDate: b.expiryDate || "",
        producedQty: b.quantity || 0,
        approvedQty: b.approvedQty || 0,
        rejectedQty: b.rejectionQty || 0,
        packagedQty: b.packagedQty || 0,
        cartonedQty: b.cartonedQty || 0,
        unit: b.production?.recipe?.yieldUnit || "KG",
        status: b.production?.status || "COMPLETED",
        qcStatus: b.qcStatus || "PENDING",
        recallStatus: b.recall?.status || null,
        recallStep: b.recall?.step || null,
      }));
      setBatches(data);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const filtered = useMemo(() => batches.filter(
    (b) =>
      b.batchCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.productName.toLowerCase().includes(searchQuery.toLowerCase())
  ), [batches, searchQuery]);

  // If the selected batch falls out of the filtered result set (e.g. the
  // search narrows past it), the inspector must not keep showing it or
  // leave its actions live — reset to the idle state instead.
  useEffect(() => {
    if (selectedBatchId && !filtered.some((b) => b.id === selectedBatchId)) {
      setSelectedBatchId(null);
      setEligibility(null);
      setRecall(null);
      setShowReasonForm(false);
    }
  }, [filtered, selectedBatchId]);

  const loadDetail = useCallback(async (batchId: string) => {
    setDetailLoading(true);
    try {
      const [eligRes, stateRes] = await Promise.all([
        recallApi.getEligibility(batchId),
        recallApi.getState(batchId),
      ]);
      setEligibility(eligRes.data);
      setRecall(stateRes.data);
    } catch (e) {
      showToast("Failed to load recall details for this batch", "error");
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  const selectBatch = (batchId: string) => {
    setSelectedBatchId(batchId);
    setShowReasonForm(false);
    setReason("");
    setReasonNotes("");
    setReturnQtyInput("");
    setFailedStep(null);
    // Clear stale data from whatever batch was previously selected so the
    // inspector never shows one batch's numbers/actions under another
    // batch's header while the new detail fetch is in flight.
    setEligibility(null);
    setRecall(null);
    loadDetail(batchId);
  };

  const refreshAfterAction = async () => {
    if (selectedBatchId) await loadDetail(selectedBatchId);
    await loadBatches();
  };

  const runInitiate = async () => {
    if (!selectedBatchId) return;
    if (!reason) { showToast("Select a recall reason", "error"); return; }
    if (reason === "Other" && !reasonNotes.trim()) { showToast("Notes are required when reason is Other", "error"); return; }

    setRunningAction("INITIATED");
    setFailedStep(null);
    try {
      await recallApi.initiate(selectedBatchId, { reason, reasonNotes: reasonNotes.trim() || undefined });
      setShowReasonForm(false);
      await refreshAfterAction();
      // Locate → Block → Report are pure read/derive steps with no extra
      // user input, so they auto-chain — each one is still a real, awaited
      // backend call whose result drives the UI, not a timer.
      await runStep("DISTRIBUTION_LOCATED", () => recallApi.locateDistribution(selectedBatchId));
      await runStep("SALES_BLOCKED", () => recallApi.blockSales(selectedBatchId));
      await runStep("REPORT_GENERATED", () => recallApi.generateReport(selectedBatchId));
    } catch (e: any) {
      setFailedStep("INITIATED");
      showToast(e?.response?.data?.error || "Failed to initiate recall", "error");
    } finally {
      setRunningAction(null);
    }
  };

  const runStep = async (step: string, call: () => Promise<any>) => {
    setRunningAction(step);
    setFailedStep(null);
    try {
      await call();
      await refreshAfterAction();
    } catch (e: any) {
      setFailedStep(step);
      showToast(e?.response?.data?.error || `Failed at step: ${step.replace(/_/g, " ")}`, "error");
      throw e;
    } finally {
      setRunningAction(null);
    }
  };

  const submitReturn = async () => {
    if (!selectedBatchId) return;
    const qty = Number(returnQtyInput);
    if (!Number.isFinite(qty) || qty < 0) { showToast("Enter a valid return quantity", "error"); return; }
    setRunningAction("RETURN_COLLECTED");
    setFailedStep(null);
    try {
      await recallApi.collectReturn(selectedBatchId, qty);
      setReturnQtyInput("");
      await refreshAfterAction();
      showToast("Return recorded", "success");
    } catch (e: any) {
      setFailedStep("RETURN_COLLECTED");
      showToast(e?.response?.data?.error || "Failed to record return", "error");
    } finally {
      setRunningAction(null);
    }
  };

  const completeRecall = async () => {
    if (!selectedBatchId) return;
    setRunningAction("COMPLETE");
    try {
      await recallApi.complete(selectedBatchId);
      await refreshAfterAction();
      showToast("Recall completed", "success");
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to complete recall", "error");
    } finally {
      setRunningAction(null);
    }
  };

  const cancelRecall = async () => {
    if (!selectedBatchId) return;
    setRunningAction("CANCEL");
    try {
      await recallApi.cancel(selectedBatchId);
      await refreshAfterAction();
      showToast("Recall cancelled", "success");
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to cancel recall", "error");
    } finally {
      setRunningAction(null);
    }
  };

  const selectedBatch = selectedBatchId ? batches.find((b) => b.id === selectedBatchId) : null;
  const stepIdx = recall ? STEP_ORDER.indexOf(recall.step as any) : -1;
  const isActive = recall?.status === "IN_PROGRESS";
  const pendingReturnQty = recall ? Math.max(0, recall.distributedQty - recall.returnedQty) : 0;
  const canComplete = isActive && recall!.step !== "INITIATED" && recall!.step !== "DISTRIBUTION_LOCATED" && recall!.step !== "SALES_BLOCKED"
    ? pendingReturnQty <= 0.001
    : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" />
          <p className="text-xs text-gray-400">Loading batch registry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-[#f58220]" />
          Batch Recall
        </h1>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search batch code or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
          />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
        {/* Recall Workflow Steps */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recall Workflow Pipeline</h3>
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isFailed = recall && failedStep === step.key;
              const isDone = !!recall && idx < stepIdx;
              const isCurrent = !!recall && idx === stepIdx && isActive;
              const isRunning = runningAction === step.key;
              return (
                <div key={step.key} className="flex flex-col lg:flex-row items-center gap-2 w-full lg:w-auto">
                  <div
                    className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border w-full lg:w-auto transition-all text-xs font-medium",
                      isFailed && "bg-rose-50 border-rose-200 text-rose-600",
                      !isFailed && isDone && "bg-emerald-50 border-emerald-200 text-emerald-600",
                      !isFailed && isCurrent && "bg-orange-50 border-orange-200 text-[#f58220]",
                      !isFailed && !isDone && !isCurrent && "bg-gray-50 border-gray-200 text-gray-400"
                    )}
                  >
                    {isFailed ? <XCircle className="h-3.5 w-3.5" /> : isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : isRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                    <span>{step.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <ArrowRight className="text-gray-300 rotate-90 lg:rotate-0 shrink-0 h-3.5 w-3.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Batch Selection List */}
          <div className="xl:col-span-5 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-[#f58220]" /> Batch Registry
              </h3>
              <p className="text-xs text-gray-400 mt-1">{filtered.length} batches found</p>
            </div>
            <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertTriangle className="h-8 w-8 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-400">No batches found</p>
                </div>
              ) : (
                filtered.map((batch) => {
                  const recallStyle = batch.recallStatus ? RECALL_STYLES[batch.recallStatus] : null;
                  const qcStyle = QC_STYLES[batch.qcStatus] || DEFAULT_QC_STYLE;
                  const badge = recallStyle || qcStyle;
                  const badgeLabel = recallStyle ? recallStyle.label : batch.qcStatus;
                  return (
                    <button
                      key={batch.id}
                      onClick={() => selectBatch(batch.id)}
                      className={clsx(
                        "w-full p-3 text-left transition-colors flex items-center justify-between gap-3",
                        selectedBatchId === batch.id ? "bg-orange-50" : "hover:bg-gray-50"
                      )}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-mono font-semibold text-gray-800 truncate">{batch.batchCode}</p>
                        <p className="text-sm font-medium text-gray-700 truncate">{batch.productName}</p>
                        <p className="text-xs text-gray-400">
                          Approved: {batch.approvedQty} {batch.unit} • {batch.productionDate ? new Date(batch.productionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={clsx("px-2 py-0.5 rounded text-[11px] font-semibold border", badge.color, badge.bg, badge.border)}>
                          {badgeLabel}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Recall Details & Actions */}
          <div className="xl:col-span-7 space-y-5">
            {selectedBatch ? (
              <>
                {/* Batch Detail Card */}
                <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">{selectedBatch.batchCode}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{selectedBatch.productName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {recall?.status === "COMPLETED" ? (
                        <span className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-semibold">
                          <ShieldAlert className="h-3.5 w-3.5" /> Recalled
                        </span>
                      ) : isActive ? (
                        <>
                          <button
                            onClick={cancelRecall}
                            disabled={!!runningAction}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-rose-300 hover:text-rose-600 text-gray-500 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                          >
                            <Undo2 className="h-3.5 w-3.5" /> Cancel
                          </button>
                          {canComplete && (
                            <button
                              onClick={completeRecall}
                              disabled={!!runningAction}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Complete Recall
                            </button>
                          )}
                          <button
                            disabled
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#f58220] text-white rounded-lg text-xs font-semibold shadow-sm opacity-60 cursor-not-allowed"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" /> Recall In Progress...
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setShowReasonForm(true)}
                          disabled={!eligibility?.eligible || detailLoading}
                          title={!eligibility?.eligible ? eligibility?.reasons.join(" ") : undefined}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Initiate Recall
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ineligibility reasons — always visible, never just a disabled button */}
                  {!recall && eligibility && !eligibility.eligible && (
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3">
                      <Ban className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-rose-700 space-y-1">
                        {eligibility.reasons.map((r, i) => <p key={i}>{r}</p>)}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Produced Qty", value: `${eligibility?.batch.producedQty ?? selectedBatch.producedQty} ${eligibility?.batch.unit ?? selectedBatch.unit}` },
                      { label: "Approved Qty", value: `${eligibility?.batch.approvedQty ?? selectedBatch.approvedQty} ${eligibility?.batch.unit ?? selectedBatch.unit}` },
                      { label: "QC Status", value: selectedBatch.qcStatus },
                      { label: "Production Date", value: selectedBatch.productionDate ? new Date(selectedBatch.productionDate).toLocaleDateString("en-IN") : "—" },
                      { label: "Rejected Qty", value: `${eligibility?.batch.rejectedQty ?? selectedBatch.rejectedQty} ${eligibility?.batch.unit ?? selectedBatch.unit}` },
                      { label: "Packed Qty", value: `${eligibility?.batch.packagedQty ?? selectedBatch.packagedQty} ${eligibility?.batch.unit ?? selectedBatch.unit}` },
                      { label: "Available (Warehouse)", value: eligibility ? `${eligibility.batch.availableQty} ${eligibility.batch.unit}` : "—" },
                      { label: "Dispatched Qty", value: eligibility ? `${eligibility.batch.distributedQty} ${eligibility.batch.unit}` : "—" },
                    ].map((item, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Reason form (shown before initiate actually fires) */}
                  {showReasonForm && !recall && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-700">Recall Reason (required)</p>
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
                      >
                        <option value="">Select a reason...</option>
                        {RECALL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      {(reason === "Other" || reason === "") && (
                        <textarea
                          value={reasonNotes}
                          onChange={(e) => setReasonNotes(e.target.value)}
                          placeholder={reason === "Other" ? "Notes are required for 'Other'..." : "Additional notes (optional)"}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white min-h-[70px]"
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={runInitiate}
                          disabled={runningAction === "INITIATED"}
                          className="px-4 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold disabled:opacity-60"
                        >
                          {runningAction === "INITIATED" ? "Initiating..." : "Confirm Initiate Recall"}
                        </button>
                        <button
                          onClick={() => setShowReasonForm(false)}
                          className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Real distribution data (never fabricated) */}
                  {recall && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Traceability</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="p-1.5 bg-white rounded-lg text-[#f58220] border border-gray-200 shrink-0"><MapPin className="h-3.5 w-3.5" /></div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-700">Affected Locations</p>
                            {stepIdx < 1 ? (
                              <p className="text-xs text-gray-400 mt-0.5">Not yet located</p>
                            ) : recall.affectedLocations && recall.affectedLocations.length > 0 ? (
                              <div className="mt-1 space-y-0.5">
                                {recall.affectedLocations.map((loc, i) => (
                                  <p key={i} className="text-xs text-gray-600 truncate">{loc.label} — {loc.qty} {eligibility?.batch.unit}</p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5">No distribution records found for this batch.</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="p-1.5 bg-white rounded-lg text-[#f58220] border border-gray-200 shrink-0"><RefreshCw className="h-3.5 w-3.5" /></div>
                          <div>
                            <p className="text-xs font-semibold text-gray-700">Returned Quantity</p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              {recall.returnedQty} / {recall.distributedQty} {eligibility?.batch.unit} returned
                              {pendingReturnQty > 0 && <span className="text-amber-600"> ({pendingReturnQty} pending)</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Collect Returned Stock — needs real user input, not auto-run */}
                  {isActive && (recall!.step === "REPORT_GENERATED" || recall!.step === "RETURN_COLLECTED") && pendingReturnQty > 0.001 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-700">Record Returned Stock (max {pendingReturnQty} {eligibility?.batch.unit})</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={pendingReturnQty}
                          value={returnQtyInput}
                          onChange={(e) => setReturnQtyInput(e.target.value)}
                          placeholder="Returned quantity"
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
                        />
                        <button
                          onClick={submitReturn}
                          disabled={runningAction === "RETURN_COLLECTED"}
                          className="px-4 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold disabled:opacity-60"
                        >
                          {runningAction === "RETURN_COLLECTED" ? "Recording..." : "Record Return"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Retry a failed step */}
                  {failedStep && isActive && (
                    <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-lg p-3">
                      <p className="text-xs text-rose-600">Step "{failedStep.replace(/_/g, " ")}" failed. Fix the issue and retry.</p>
                      <button
                        onClick={() => {
                          if (failedStep === "DISTRIBUTION_LOCATED") runStep("DISTRIBUTION_LOCATED", () => recallApi.locateDistribution(selectedBatchId!)).catch(() => {});
                          else if (failedStep === "SALES_BLOCKED") runStep("SALES_BLOCKED", () => recallApi.blockSales(selectedBatchId!)).catch(() => {});
                          else if (failedStep === "REPORT_GENERATED") runStep("REPORT_GENERATED", () => recallApi.generateReport(selectedBatchId!)).catch(() => {});
                        }}
                        className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-semibold"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Tracking Map */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ERP Tracks</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: "Batch Movement", desc: "GRN → Production → Warehouse → DC", icon: Truck },
                        { label: "Outlet Distribution", desc: "Franchise outlets that actually received this batch", icon: Store },
                        { label: "Sales Linkage", desc: "POS invoices referencing this batch", icon: FileText },
                        { label: "Return Quantity", desc: "Collected stock from affected outlets", icon: RefreshCw },
                      ].map((t, i) => (
                        <div key={i} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="p-1.5 bg-white rounded-lg text-[#f58220] border border-gray-200 shrink-0">
                            <t.icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{t.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Recall Audit Log — persisted server events, not frontend strings */}
                {recall?.events && recall.events.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                    <h4 className="text-xs font-semibold text-[#f58220] uppercase tracking-wide flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#f58220] animate-pulse" />
                      Recall Audit Log
                    </h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {recall.events.map((ev) => (
                        <div key={ev.id} className="text-xs font-mono text-gray-600 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                          [{new Date(ev.createdAt).toLocaleTimeString()}] {ev.event.replace(/_/g, " ")}
                          {ev.details?.message ? ` — ${ev.details.message}` : ""}
                          {typeof ev.affectedQty === "number" && ev.affectedQty > 0 ? ` (${ev.affectedQty} ${eligibility?.batch.unit || ""})` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                  <ShieldAlert className="h-8 w-8 text-[#f58220]" />
                </div>
                <h4 className="text-gray-800 font-semibold text-sm">Select a batch from the registry</h4>
                <p className="text-gray-500 text-sm mt-1 max-w-xs">
                  Select a batch to inspect its traceability chain and initiate a recall workflow if needed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
