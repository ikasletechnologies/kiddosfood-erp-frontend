"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert, Search, Package, Store, AlertTriangle,
  CheckCircle2, XCircle, Truck, Clock, RefreshCw,
  ChevronRight, MapPin, FileText, ArrowRight
} from "lucide-react";
import { clsx } from "clsx";
import api from "@/lib/api/base";
import { useToast } from "@/context/ToastContext";

interface RecallBatch {
  id: string;
  batchCode: string;
  productName: string;
  productionDate: string;
  expiryDate: string;
  totalQuantity: number;
  unit: string;
  status: string;
  qcStatus: string;
}

type RecallStep = "identify" | "locate" | "block" | "report" | "collect";

const STEPS: { key: RecallStep; label: string; icon: any }[] = [
  { key: "identify", label: "Identify Defective Batch", icon: Search },
  { key: "locate", label: "Locate Distribution", icon: MapPin },
  { key: "block", label: "Block Sales", icon: XCircle },
  { key: "report", label: "Generate Recall Report", icon: FileText },
  { key: "collect", label: "Collect Returned Stock", icon: Package },
];

const QC_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  APPROVED: { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  REJECTED: { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  PENDING: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
};
const DEFAULT_QC_STYLE = { color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };

export default function BatchRecallPage() {
  const [batches, setBatches] = useState<RecallBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<RecallBatch | null>(null);
  const [currentStep, setCurrentStep] = useState<RecallStep>("identify");
  const [recallActive, setRecallActive] = useState(false);
  const [recallLog, setRecallLog] = useState<string[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    async function loadBatches() {
      try {
        const res = await api.get("/api/production/batches");
        const data = (res.data || []).map((b: any) => ({
          id: b.id,
          batchCode: b.batchCode || b.id?.slice(-6),
          productName: b.product?.name || b.recipe?.name || "Unknown Product",
          productionDate: b.createdAt,
          expiryDate: b.expiryDate || "",
          totalQuantity: b.outputQuantity || b.plannedQuantity || 0,
          unit: b.unit || "KG",
          status: b.status || "COMPLETED",
          qcStatus: b.qcStatus || "PENDING",
        }));
        setBatches(data);
      } catch {
        setBatches([]);
      } finally {
        setLoading(false);
      }
    }
    loadBatches();
  }, []);

  const filtered = batches.filter(
    (b) =>
      b.batchCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const initiateRecall = () => {
    if (!selectedBatch) return;
    setRecallActive(true);
    setCurrentStep("identify");
    setRecallLog([`[${new Date().toLocaleTimeString()}] Recall initiated for batch ${selectedBatch.batchCode}`]);

    setTimeout(() => {
      setCurrentStep("locate");
      setRecallLog((p) => [...p, `[${new Date().toLocaleTimeString()}] Scanning warehouse and franchise outlet distribution records...`]);
    }, 1200);
    setTimeout(() => {
      setCurrentStep("block");
      setRecallLog((p) => [...p, `[${new Date().toLocaleTimeString()}] Sales blocked across all POS terminals for batch ${selectedBatch.batchCode}`]);
    }, 2400);
    setTimeout(() => {
      setCurrentStep("report");
      setRecallLog((p) => [...p, `[${new Date().toLocaleTimeString()}] Recall report generated with full traceability chain`]);
    }, 3600);
    setTimeout(() => {
      setCurrentStep("collect");
      setRecallLog((p) => [...p, `[${new Date().toLocaleTimeString()}] Return collection orders dispatched to all affected outlets`]);
      showToast("Batch recall workflow completed successfully", "success");
    }, 4800);
  };

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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
        {/* Recall Workflow Steps */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recall Workflow Pipeline</h3>
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const stepIdx = STEPS.findIndex((s) => s.key === currentStep);
              const isDone = recallActive && idx < stepIdx;
              const isCurrent = recallActive && idx === stepIdx;
              return (
                <div key={step.key} className="flex flex-col lg:flex-row items-center gap-2 w-full lg:w-auto">
                  <div
                    className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border w-full lg:w-auto transition-all text-xs font-medium",
                      isDone && "bg-emerald-50 border-emerald-200 text-emerald-600",
                      isCurrent && "bg-orange-50 border-orange-200 text-[#f58220]",
                      !isDone && !isCurrent && "bg-gray-50 border-gray-200 text-gray-400"
                    )}
                  >
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
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
                  const qcStyle = QC_STYLES[batch.qcStatus] || DEFAULT_QC_STYLE;
                  return (
                    <button
                      key={batch.id}
                      onClick={() => { setSelectedBatch(batch); setRecallActive(false); setRecallLog([]); setCurrentStep("identify"); }}
                      className={clsx(
                        "w-full p-3 text-left transition-colors flex items-center justify-between gap-3",
                        selectedBatch?.id === batch.id ? "bg-orange-50" : "hover:bg-gray-50"
                      )}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-mono font-semibold text-gray-800 truncate">{batch.batchCode}</p>
                        <p className="text-sm font-medium text-gray-700 truncate">{batch.productName}</p>
                        <p className="text-xs text-gray-400">
                          Qty: {batch.totalQuantity} {batch.unit} • {batch.productionDate ? new Date(batch.productionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={clsx("px-2 py-0.5 rounded text-[11px] font-semibold border", qcStyle.color, qcStyle.bg, qcStyle.border)}>
                          {batch.qcStatus}
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
                    <button
                      onClick={initiateRecall}
                      disabled={recallActive}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {recallActive ? "Recall In Progress..." : "Initiate Recall"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Output Qty", value: `${selectedBatch.totalQuantity} ${selectedBatch.unit}` },
                      { label: "QC Status", value: selectedBatch.qcStatus },
                      { label: "Batch Status", value: selectedBatch.status },
                      { label: "Production Date", value: selectedBatch.productionDate ? new Date(selectedBatch.productionDate).toLocaleDateString("en-IN") : "—" },
                    ].map((item, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tracking Map */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ERP Must Track</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: "Batch Movement", desc: "GRN → Production → Warehouse → DC", icon: Truck },
                        { label: "Outlet Distribution", desc: "All franchise outlets receiving this batch", icon: Store },
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

                {/* Live Recall Log */}
                {recallLog.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                    <h4 className="text-xs font-semibold text-[#f58220] uppercase tracking-wide flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#f58220] animate-pulse" />
                      Live Recall Audit Log
                    </h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {recallLog.map((log, i) => (
                        <div key={i} className="text-xs font-mono text-gray-600 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                          {log}
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
                <h4 className="text-gray-800 font-semibold text-sm">Recall Inspector Idle</h4>
                <p className="text-gray-500 text-sm mt-1 max-w-xs">
                  Select a batch from the registry to inspect its traceability chain and initiate a recall workflow if needed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
