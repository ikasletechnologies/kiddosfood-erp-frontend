"use client";

import { useState, useEffect, useCallback, Fragment, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PackageCheck, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, Filter, Package, Building2, X
} from "lucide-react";
import { clsx } from "clsx";
import { productBatchesApi, productsFullApi, franchiseApi, productionApi } from "@/lib/api";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import RawMaterialConsumptionClient from "@/components/modules/inventory/RawMaterialConsumptionClient";
import ActiveProductionRunsClient from "@/components/modules/production/ActiveProductionRunsClient";
import { formatDate } from "@/lib/utils";

type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";

const EXPIRY_CONFIG: Record<ExpiryStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
  EXPIRED:       { bg: "bg-rose-50 dark:bg-rose-500/10",       text: "text-rose-700 dark:text-rose-400",      border: "border-rose-200 dark:border-rose-500/20",    dot: "bg-rose-500",    label: "Expired" },
  EXPIRING_SOON: { bg: "bg-amber-50 dark:bg-amber-500/10",     text: "text-amber-700 dark:text-amber-400",    border: "border-amber-200 dark:border-amber-500/20",  dot: "bg-amber-500",   label: "Expiring Soon" },
  VALID:         { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/20", dot: "bg-emerald-500", label: "Valid" },
};

function getEffectiveExpiry(batch: any): string | null {
  return batch.expiryDate ?? batch.production?.expiryDate ?? null;
}

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const FILTER_TABS = ["ALL", "VALID", "EXPIRING_SOON", "EXPIRED"] as const;

const STAGE_LABELS: Record<string, string> = {
  QUEUED: "Started",
  MIXING: "Mixing",
  COOKING: "Cooking",
  COOLING: "Cooling",
  READY_FOR_QC: "QC",
};

function ProductBatchesRegistry() {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const requestedBatchId = searchParams.get("batchId");

  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"REGISTRY" | "CONSUMPTION" | "ACTIVE_RUNS">(
    requestedTab === "REGISTRY" || requestedTab === "CONSUMPTION" ? requestedTab : "ACTIVE_RUNS"
  );

  // Batch Details SlideOver State
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  // Sync activeTab when URL requestedTab changes
  useEffect(() => {
    if (requestedTab === "REGISTRY" || requestedTab === "CONSUMPTION" || requestedTab === "ACTIVE_RUNS") {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  // Deep-link support: a batch opened from Expiry Tracking (or elsewhere)
  // via ?batchId= auto-opens straight to that same batch's detail drawer.
  useEffect(() => {
    if (!requestedBatchId || batches.length === 0) return;
    const match = batches.find((b: any) => b.id === requestedBatchId);
    if (match) {
      setSelectedBatch(match);
      setShowBatchDetails(true);
    }
  }, [requestedBatchId, batches]);

  // Fetch every branch/outlet for Super Admin — batches can belong to HQ
  // itself (it's a real location batches ship from), so unlike the
  // franchise-management screens this filter must not drop it from the list.
  useEffect(() => {
    if (isSuper) {
      franchiseApi.getAll()
        .then((res) => {
          setFranchises(res.data ?? []);
        })
        .catch((err) => console.error("Failed to load franchises", err));
    }
  }, [isSuper]);

  const fetchBatches = useCallback(async (productId?: string, franchiseId?: string) => {
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        productBatchesApi.getAll({
          productId: productId || undefined,
          franchiseId: franchiseId || undefined
        }),
        productsFullApi.getAll(),
      ]);
      // /api/production/batches also merges in GRN raw-material inventory
      // lots that carry an expiry date (batchType: 'GRN_RAW_MATERIAL') —
      // useful for Expiry Tracking, which shares this same endpoint, but
      // Batch Manufacturing's registry is specifically about manufactured
      // output, not raw materials. Also drop batches from a recipe whose
      // user-assigned category is itself "Raw Material" (e.g. a recipe
      // created by mistake to log a raw material's batches here).
      const isRawMaterial = (b: any) =>
        b.batchType === "GRN_RAW_MATERIAL" ||
        (b.production?.recipe?.category || "").toLowerCase().includes("raw material");
      setBatches((bRes.data ?? []).filter((b: any) => !isRawMaterial(b)));
      setProducts(pRes.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Automatically re-fetch batches whenever the active tab is REGISTRY or filters change
  useEffect(() => { 
    if (activeTab === "REGISTRY") {
      fetchBatches(productFilter || undefined, selectedFranchiseId || undefined); 
    }
  }, [fetchBatches, activeTab, productFilter, selectedFranchiseId]);

  const handleProductFilter = (pid: string) => {
    setProductFilter(pid);
  };

  const filtered = batches.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      b.batchCode?.toLowerCase().includes(q) ||
      b.product?.name?.toLowerCase().includes(q) ||
      b.production?.recipe?.name?.toLowerCase().includes(q) ||
      (b.createdAt && formatDate(b.createdAt).includes(q));
    const matchExpiry = expiryFilter === "ALL" || (b.expiryStatus ?? "VALID") === expiryFilter;
    return matchSearch && matchExpiry;
  });

  const stats = [
    { label: "Total Batches",     value: batches.length,                                                                               icon: Package,       color: "text-indigo-500",  bg: "bg-indigo-500/10" },
    { label: "Valid",             value: batches.filter(b => b.expiryStatus === "VALID").length,                                       icon: CheckCircle2,  color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Expiring Soon",     value: batches.filter(b => b.expiryStatus === "EXPIRING_SOON").length,                               icon: Clock,         color: "text-amber-500",   bg: "bg-amber-500/10" },
    { label: "Expired",           value: batches.filter(b => b.expiryStatus === "EXPIRED").length,                                     icon: AlertTriangle, color: "text-rose-500",    bg: "bg-rose-500/10" },
  ];

  // Dynamic grid configuration based on role view
  const gridClasses = isSuper 
    ? "grid grid-cols-[1fr_1.2fr_1.2fr_0.6fr_1fr_1fr_1fr] px-5 py-3.5 gap-2" 
    : "grid grid-cols-[1fr_1.5fr_0.7fr_1fr_1fr_1fr] px-5 py-3.5 gap-2";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">

      {/* ── Main Content ── */}

      <div className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5">

        {/* ── Tab Bar ── */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white w-fit">
          {([
            { key: "REGISTRY", label: "Batch Registry" },
            { key: "ACTIVE_RUNS", label: "Active Runs" },
            { key: "CONSUMPTION", label: "Material Consumption" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === "REGISTRY") {
                  fetchBatches(productFilter || undefined, selectedFranchiseId || undefined);
                }
              }}
              className={clsx(
                "px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer",
                activeTab === tab.key ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

      {activeTab === "ACTIVE_RUNS" ? (
        <ActiveProductionRunsClient />
      ) : activeTab === "CONSUMPTION" ? (
        <RawMaterialConsumptionClient />
      ) : (
        <div className="space-y-5">

          {/* ── Summary Strip ── */}
          <div className="grid grid-cols-4 gap-4">
            {stats.map(s => (
              <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
                <div className={clsx("w-2.5 h-2.5 rounded-full", s.bg.replace('/10', ''))} />
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-lg font-bold text-gray-700">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Filters Row ── */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <input
                type="text"
                placeholder="Search batch, product, date..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-3 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
              />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
            </div>

            {/* Product Filter */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <Filter size={14} className="text-gray-400 shrink-0" />
              <select
                value={productFilter}
                onChange={(e) => handleProductFilter(e.target.value)}
                className="bg-transparent text-sm text-gray-700 outline-none cursor-pointer"
              >
                <option value="">All Products</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Franchise select for Super Admin */}
            {isSuper && (
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
                <Building2 size={14} className="text-gray-400 shrink-0" />
                <select
                  value={selectedFranchiseId}
                  onChange={(e) => setSelectedFranchiseId(e.target.value)}
                  className="bg-transparent text-sm text-gray-700 outline-none cursor-pointer"
                >
                  <option value="">All Branches</option>
                  {franchises.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex-1" />
            <button
              onClick={() => fetchBatches(productFilter || undefined, selectedFranchiseId || undefined)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>

          {/* ── Table / Empty / Loading ── */}
          {loading ? (
            <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
                <PackageCheck className="h-8 w-8 text-[#f58220]" />
              </div>
              <div>
                <p className="text-gray-800 font-semibold">No Batches Found</p>
                <p className="text-gray-500 text-sm mt-1">No batches match the current filter criteria.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                    <th className="text-left px-4 py-3">Batch ID</th>
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-left px-4 py-3">Qty Produced</th>
                    <th className="text-left px-4 py-3">QC Approved</th>
                    <th className="text-left px-4 py-3">QC Rejected</th>
                    <th className="text-left px-4 py-3">Unit Cost</th>
                    <th className="text-left px-4 py-3">Packed</th>
                    <th className="text-left px-4 py-3">Approved Bulk</th>
                    <th className="text-left px-4 py-3">Available FG</th>
                    <th className="text-left px-4 py-3">Expiry</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((batch: any) => {
                    const status: ExpiryStatus = batch.expiryStatus ?? "VALID";
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setSelectedBatch(batch); setShowBatchDetails(true); }}
                            className="font-mono font-semibold text-[#f58220] hover:text-[#e8740e] text-xs transition-colors"
                          >
                            {batch.batchCode || "—"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium text-gray-800">
                            {batch.product?.name ?? batch.production?.recipe?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {batch.quantity} <span className="text-xs text-gray-400">{batch.production?.recipe?.yieldUnit || "KG"}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-emerald-700">
                          {batch.qcStatus === "PENDING" ? "—" : (
                            <>{batch.approvedQty || 0} <span className="text-xs text-gray-400">{batch.production?.recipe?.yieldUnit || "KG"}</span></>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-rose-700">
                          {batch.qcStatus === "PENDING" ? "—" : (
                            <>{batch.rejectionQty || 0} <span className="text-xs text-gray-400">{batch.production?.recipe?.yieldUnit || "KG"}</span></>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {batch.unitCost ? `₹${batch.unitCost.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {batch.packedQuantity || 0} <span className="text-xs text-gray-400">{batch.production?.recipe?.yieldUnit || "KG"}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {batch.bulkQuantity || 0} <span className="text-xs text-gray-400">{batch.production?.recipe?.yieldUnit || "KG"}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {batch.availableQuantity || 0} <span className="text-xs text-gray-400">pcs</span>
                        </td>
                        <td className={clsx("px-4 py-3 text-xs whitespace-nowrap",
                          status === "EXPIRED" ? "text-rose-600 font-semibold" : status === "EXPIRING_SOON" ? "text-amber-600 font-semibold" : "text-gray-600"
                        )}>
                          {formatDate(getEffectiveExpiry(batch))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border",
                            batch.qcStatus === "APPROVED" && batch.packagingStatus === "PACKAGED"
                              ? "text-blue-600 bg-blue-50 border-blue-200"
                              : batch.qcStatus === "APPROVED"
                              ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                              : batch.qcStatus === "PARTIALLY_APPROVED"
                              ? "text-orange-600 bg-orange-50 border-orange-200"
                              : batch.qcStatus === "REJECTED"
                              ? "text-rose-600 bg-rose-50 border-rose-200"
                              : "text-amber-600 bg-amber-50 border-amber-200"
                          )}>
                            {batch.qcStatus === "APPROVED" ? (batch.packagingStatus === "PACKAGED" ? "Packaged" : "QC Passed")
                              : batch.qcStatus === "PARTIALLY_APPROVED" ? "Partially Approved"
                              : batch.qcStatus === "REJECTED" ? "Rejected" : "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {[
                              { label: "View", always: true },
                              { label: "QC", disabled: !!batch.qcStatus && batch.qcStatus !== "PENDING" },
                              { label: "Pack", disabled: !["APPROVED", "PARTIALLY_APPROVED"].includes(batch.qcStatus) || batch.packagingStatus === "PACKAGED" },
                              { label: "Dispatch", always: true },
                              { label: "Recall", always: true },
                            ].map(({ label, disabled }) => {
                              const actionStyles: Record<string, string> = {
                                View: "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900",
                                QC: "border-blue-200 bg-blue-50/80 text-blue-700 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-800",
                                Pack: "border-orange-200 bg-orange-50/80 text-[#f58220] hover:bg-orange-100 hover:border-orange-300 hover:text-[#e8740e]",
                                Dispatch: "border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 hover:text-emerald-800",
                                Recall: "border-rose-200 bg-rose-50/80 text-rose-700 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-800",
                              };

                              return (
                                <button
                                  key={label}
                                  disabled={!!disabled}
                                  onClick={() => {
                                    if (label === "Pack") { router.push("/packaging/queue"); }
                                    else if (label === "View") { setSelectedBatch(batch); setShowBatchDetails(true); }
                                    else if (label === "QC") { router.push(`/purchases/qc?batchId=${batch.id}`); }
                                    else if (label === "Dispatch") { router.push("/delivery"); }
                                    else if (label === "Recall") { router.push("/production/batch-recall"); }
                                  }}
                                  className={clsx(
                                    "px-2 py-0.5 text-[11px] font-semibold rounded border shadow-2xs transition-all active:scale-95",
                                    disabled
                                      ? "border-gray-200/60 bg-gray-50 text-gray-300 cursor-not-allowed shadow-none"
                                      : actionStyles[label] || "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                  )}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Batch Details SlideOver */}
      {showBatchDetails && selectedBatch && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setShowBatchDetails(false)} />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-base font-bold text-gray-800">Batch Details</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-mono font-semibold text-[#f58220]">
                    {selectedBatch.batchCode || "—"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">Active</span>
                </div>
              </div>
              <button onClick={() => setShowBatchDetails(false)} className="p-2 hover:bg-gray-150 rounded-lg transition-colors font-semibold text-gray-500">
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Timeline Header */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Product</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{selectedBatch.product?.name ?? selectedBatch.production?.recipe?.name ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Recipe Version</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">v1.2 (Standard)</p>
                  </div>
                </div>
                
                {/* Production Timeline */}
                <div className="mt-6">
                  <h4 className="text-xs font-semibold text-gray-500 mb-4">Production Timeline</h4>
                  {(() => {
                    const production = selectedBatch.production;
                    const stageLogs = production?.stageLogs ?? [];
                    // stageLogs[0] is always the QUEUED entry written the instant
                    // the run started, so it already IS the start time — only the
                    // end needs adding on, since approveProduction records a real
                    // endTime but never a matching stage log entry.
                    const points: { key: string; label: string; time: string }[] = stageLogs.map((log: any) => ({
                      key: log.id,
                      label: STAGE_LABELS[log.stage] ?? log.stage,
                      time: log.enteredAt,
                    }));
                    if (production?.status === 'COMPLETED' && production?.endTime) {
                      points.push({ key: 'completed', label: 'Completed', time: production.endTime });
                    } else if (production?.status === 'STOPPED' && production?.endTime) {
                      points.push({ key: 'stopped', label: 'Paused', time: production.endTime });
                    }

                    if (points.length === 0) {
                      return <p className="text-xs text-gray-400 font-medium">No stage history recorded for this run</p>;
                    }

                    const start = points[0]?.time;
                    const end = points.length > 1 ? points[points.length - 1].time : null;
                    const durationMinutes = start && end
                      ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
                      : null;

                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-600 relative before:absolute before:top-1.5 before:left-0 before:right-0 before:h-0.5 before:bg-gray-200 overflow-x-auto pb-1">
                          {points.map((p, idx) => (
                            <div key={p.key ?? idx} className="relative flex flex-col items-center gap-2 group z-10 shrink-0">
                              <div className="w-3 h-3 rounded-full bg-[#f58220] border-2 border-white shadow-sm" />
                              <span className="w-16 text-center leading-tight bg-gray-50">
                                {new Date(p.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                <br />
                                {p.label}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-[11px] font-semibold text-gray-500">
                          <span>Start: <span className="text-gray-800">{new Date(start).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span></span>
                          <span>End: <span className="text-gray-800">{end ? new Date(end).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "In Progress"}</span></span>
                          {durationMinutes !== null && <span>Duration: <span className="text-gray-800">{formatDurationMinutes(durationMinutes)}</span></span>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Yield & Cost */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Production Yield &amp; Cost</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-gray-500">Produced</p>
                    <p className="text-base font-bold text-gray-850 mt-1 tabular-nums">{selectedBatch.quantity ?? 0} <span className="text-xs text-gray-400">{selectedBatch.production?.recipe?.yieldUnit || "KG"}</span></p>
                  </div>
                  <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-gray-500">Approved / Rejected</p>
                    <p className="text-base font-bold text-gray-850 mt-1 tabular-nums">{selectedBatch.approvedQty ?? 0} <span className="text-xs text-rose-500">/ {selectedBatch.rejectionQty ?? 0}</span></p>
                  </div>
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-[#f58220] font-semibold">Material Cost</p>
                    <p className="text-base font-bold text-[#e8740e] mt-1 tabular-nums">₹{(selectedBatch.production?.materialCost ?? selectedBatch.totalCost ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-emerald-600 font-semibold">Unit Cost</p>
                    <p className="text-base font-bold text-emerald-700 mt-1 tabular-nums">₹{(selectedBatch.unitCost ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-rose-600 font-semibold">QC Wastage Cost</p>
                    <p className="text-base font-bold text-rose-700 mt-1 tabular-nums">₹{((selectedBatch.rejectionQty ?? 0) * (selectedBatch.unitCost ?? 0)).toFixed(2)}</p>
                    <p className="text-[11px] text-rose-400 mt-0.5">{selectedBatch.rejectionQty ?? 0} {selectedBatch.production?.recipe?.yieldUnit || "KG"} rejected</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Unit cost reflects the real price on whichever purchase bill(s) this run actually consumed (FIFO) — it can differ run-to-run of the same recipe as older, cheaper bills run out and newer purchase prices take over.
                </p>
              </div>

              {/* Ingredients Used */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Ingredients Consumption</h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2">Ingredient</th>
                        <th className="px-4 py-2">Purchase Bill</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-right">Rate</th>
                        <th className="px-4 py-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-sm text-gray-700">
                      {(selectedBatch.production?.items ?? []).map((pi: any) => {
                        const breakdown: any[] = Array.isArray(pi.batchBreakdown) ? pi.batchBreakdown : [];
                        return (
                          <Fragment key={pi.id}>
                            {/* Ingredient total — the blended figure actually charged to this production run */}
                            <tr className="bg-gray-50/70 font-semibold">
                              <td className="px-4 py-2.5">{pi.inventoryItem?.name ?? "—"}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-400 normal-case">
                                {breakdown.length > 1 ? `Blended across ${breakdown.length} bills` : ""}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{pi.usedQuantity} {pi.inventoryItem?.unit}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">₹{(pi.unitCost ?? 0).toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">₹{(pi.totalCost ?? 0).toFixed(2)}</td>
                            </tr>
                            {/* One row per purchase bill this ingredient's cost was actually built from */}
                            {breakdown.length > 0 ? (
                              breakdown.map((b: any, idx: number) => {
                                const isFallback = !b.batchId;
                                return (
                                  <tr key={idx} className="text-xs text-gray-500">
                                    <td className="px-4 py-2"></td>
                                    <td className="px-4 py-2 normal-case">
                                      <span className={isFallback ? "font-semibold text-amber-600" : "font-mono font-semibold text-gray-600"}>
                                        {b.billNumber || "—"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums">{b.qty} {pi.inventoryItem?.unit}</td>
                                    <td className="px-4 py-2 text-right tabular-nums">₹{(b.unitCost ?? 0).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right tabular-nums">₹{(b.totalCost ?? 0).toFixed(2)}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr className="text-xs text-gray-400">
                                <td className="px-4 py-2"></td>
                                <td className="px-4 py-2 normal-case" colSpan={4}>No purchase bill on record for this consumption</td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {(!selectedBatch.production?.items || selectedBatch.production.items.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-gray-400">No ingredient data recorded for this run</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductBatchesPage() {
  return (
    <Suspense fallback={
      <div className="py-16 text-center flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin" />
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Loading Batches...</p>
      </div>
    }>
      <ProductBatchesRegistry />
    </Suspense>
  );
}
