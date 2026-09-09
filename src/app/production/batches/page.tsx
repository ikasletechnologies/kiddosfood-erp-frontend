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
    requestedTab === "ACTIVE_RUNS" || requestedTab === "CONSUMPTION" ? requestedTab : "REGISTRY"
  );

  // Batch Details SlideOver State
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  // Sync activeTab when URL requestedTab changes
  useEffect(() => {
    if (requestedTab === "ACTIVE_RUNS" || requestedTab === "CONSUMPTION") {
      setActiveTab(requestedTab);
    } else {
      setActiveTab("REGISTRY");
    }
  }, [requestedTab]);

  const handleTabChange = (newTab: "REGISTRY" | "CONSUMPTION" | "ACTIVE_RUNS") => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === "REGISTRY") {
      params.delete("tab");
    } else {
      params.set("tab", newTab);
    }
    const qs = params.toString();
    router.push(qs ? `/production/batches?${qs}` : "/production/batches", { scroll: false });
  };

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
  }, [fetchBatches, activeTab, productFilter, selectedFranchiseId, searchParams]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 p-3 sm:p-4 md:p-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">

      {/* ── Main Content ── */}

      <div className="max-w-screen-2xl mx-auto space-y-4 sm:space-y-5 w-full min-w-0">

        {/* ── Tab Bar ── */}
        <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-x-auto max-w-full bg-white dark:bg-card w-full sm:w-fit custom-scrollbar">
          {([
            { key: "REGISTRY", label: "Batch Registry" },
            { key: "ACTIVE_RUNS", label: "Active Runs" },
            { key: "CONSUMPTION", label: "Material Consumption" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={clsx(
                "px-3.5 sm:px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer shrink-0",
                activeTab === tab.key ? "bg-[#f58220] text-white" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
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
        <div className="space-y-4 sm:space-y-5 w-full min-w-0">

          {/* ── Summary Strip ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0">
            {stats.map(s => (
              <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 px-3.5 sm:px-4 py-3 flex items-center gap-2.5 sm:gap-3 shadow-sm min-w-0">
                <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.bg.replace('/10', ''))} />
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 truncate">{s.label}</p>
                  <p className="text-base sm:text-lg font-bold text-gray-700 dark:text-slate-200 truncate">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Filters Row ── */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0">
            <div className="relative flex-1 min-w-[160px] xs:min-w-[200px] max-w-xs">
              <input
                type="text"
                placeholder="Search batch, product, date..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-3 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
            </div>

            {/* Product Filter */}
            <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-card">
              <Filter size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
              <select
                value={productFilter}
                onChange={(e) => handleProductFilter(e.target.value)}
                className="bg-transparent text-sm text-gray-700 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="" className="dark:bg-card">All Products</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id} className="dark:bg-card">{p.name}</option>
                ))}
              </select>
            </div>

            {/* Expiry filter tabs */}
            <div className="flex border border-gray-200 dark:border-white/10 rounded-lg overflow-x-auto max-w-full custom-scrollbar bg-white dark:bg-card">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setExpiryFilter(tab)}
                  className={clsx(
                    "px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                    expiryFilter === tab
                      ? "bg-[#f58220] text-white"
                      : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                  )}
                >
                  {tab.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* Franchise select for Super Admin */}
            {isSuper && (
              <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-card">
                <Building2 size={14} className="text-gray-400 dark:text-slate-500 shrink-0" />
                <select
                  value={selectedFranchiseId}
                  onChange={(e) => setSelectedFranchiseId(e.target.value)}
                  className="bg-transparent text-sm text-gray-700 dark:text-slate-300 outline-none cursor-pointer"
                >
                  <option value="" className="dark:bg-card">All Branches</option>
                  {franchises.map((f) => (
                    <option key={f.id} value={f.id} className="dark:bg-card">{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex-1" />
            <button
              onClick={() => fetchBatches(productFilter || undefined, selectedFranchiseId || undefined)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>

          {/* ── Table / Empty / Loading ── */}
          {loading ? (
            <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center">
                <PackageCheck className="h-8 w-8 text-[#f58220]" />
              </div>
              <div>
                <p className="text-gray-800 dark:text-white font-semibold">No Batches Found</p>
                <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">No batches match the current filter criteria.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0 shadow-sm">
              <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
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
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filtered.map((batch: any) => {
                    const status: ExpiryStatus = batch.expiryStatus ?? "VALID";
                    return (
                      <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setSelectedBatch(batch); setShowBatchDetails(true); }}
                            className="font-mono font-semibold text-[#f58220] hover:text-[#e8740e] text-xs transition-colors"
                          >
                            {batch.batchCode || "—"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium text-gray-800 dark:text-white">
                            {batch.product?.name ?? batch.production?.recipe?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">
                          {batch.quantity} <span className="text-xs text-gray-400 dark:text-slate-500">{batch.production?.recipe?.yieldUnit || "KG"}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                          {batch.qcStatus === "PENDING" ? "—" : (
                            <>{batch.approvedQty || 0} <span className="text-xs text-gray-400 dark:text-slate-500">{batch.production?.recipe?.yieldUnit || "KG"}</span></>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
                          {batch.qcStatus === "PENDING" ? "—" : (
                            <>{batch.rejectionQty || 0} <span className="text-xs text-gray-400 dark:text-slate-500">{batch.production?.recipe?.yieldUnit || "KG"}</span></>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white">
                          {batch.unitCost ? `₹${batch.unitCost.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">
                          {batch.packedQuantity || 0} <span className="text-xs text-gray-400 dark:text-slate-500">{batch.production?.recipe?.yieldUnit || "KG"}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">
                          {batch.bulkQuantity || 0} <span className="text-xs text-gray-400 dark:text-slate-500">{batch.production?.recipe?.yieldUnit || "KG"}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white">
                          {batch.availableQuantity || 0} <span className="text-xs text-gray-400 dark:text-slate-500">pcs</span>
                        </td>
                        <td className={clsx("px-4 py-3 text-xs whitespace-nowrap",
                          status === "EXPIRED" ? "text-rose-600 dark:text-rose-400 font-semibold" : status === "EXPIRING_SOON" ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-gray-600 dark:text-slate-400"
                        )}>
                          {formatDate(getEffectiveExpiry(batch))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border",
                            batch.qcStatus === "APPROVED" && batch.packagingStatus === "PACKAGED"
                              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
                              : batch.qcStatus === "APPROVED"
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                              : batch.qcStatus === "PARTIALLY_APPROVED"
                              ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20"
                              : batch.qcStatus === "REJECTED"
                              ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20"
                              : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
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
                            ].map(({ label, disabled }) => {
                              const actionStyles: Record<string, string> = {
                                View: "border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 hover:text-gray-900 dark:hover:text-white",
                                QC: "border-blue-200 dark:border-blue-500/20 bg-blue-50/80 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:border-blue-300 hover:text-blue-800 dark:hover:text-blue-300",
                                Pack: "border-orange-200 dark:border-orange-500/20 bg-orange-50/80 dark:bg-orange-500/10 text-[#f58220] hover:bg-orange-100 dark:hover:bg-orange-500/20 hover:border-orange-300 hover:text-[#e8740e]",
                              };

                              return (
                                <button
                                  key={label}
                                  disabled={!!disabled}
                                  onClick={() => {
                                    if (label === "Pack") { router.push("/packaging/queue"); }
                                    else if (label === "View") { setSelectedBatch(batch); setShowBatchDetails(true); }
                                    else if (label === "QC") { router.push(`/purchases/qc?batchId=${batch.id}&returnTo=/production/batches?tab=REGISTRY`); }
                                  }}
                                  className={clsx(
                                    "px-2 py-0.5 text-[11px] font-semibold rounded border shadow-2xs transition-all active:scale-95",
                                    disabled
                                      ? "border-gray-200/60 dark:border-white/5 bg-gray-50 dark:bg-white/5 text-gray-300 dark:text-slate-600 cursor-not-allowed shadow-none"
                                      : actionStyles[label] || "border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/10"
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
            </div>
          )}
        </div>
      )}
      </div>

      {/* Batch Details SlideOver */}
      {showBatchDetails && selectedBatch && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setShowBatchDetails(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-card shadow-2xl h-full flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/[0.02]">
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-white">Batch Details</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-mono font-semibold text-[#f58220]">
                    {selectedBatch.batchCode || "—"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">Active</span>
                </div>
              </div>
              <button onClick={() => setShowBatchDetails(false)} className="p-2 hover:bg-gray-150 dark:hover:bg-white/5 rounded-lg transition-colors font-semibold text-gray-500 dark:text-slate-400">
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {/* Timeline Header */}
              <div className="bg-gray-50 dark:bg-white/[0.02] p-5 rounded-lg border border-gray-200 dark:border-white/5">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Product</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-white mt-0.5">{selectedBatch.product?.name ?? selectedBatch.production?.recipe?.name ?? "—"}</p>
                  </div>
                </div>
                
                {/* Production Timeline */}
                <div className="mt-6">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-4">Production Timeline</h4>
                  {(() => {
                    const production = selectedBatch.production;
                    const stageLogs = production?.stageLogs ?? [];
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
                      return <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">No stage history recorded for this run</p>;
                    }

                    const start = points[0]?.time;
                    const end = points.length > 1 ? points[points.length - 1].time : null;
                    const durationMinutes = start && end
                      ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
                      : null;

                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-600 dark:text-slate-300 relative before:absolute before:top-1.5 before:left-0 before:right-0 before:h-0.5 before:bg-gray-200 dark:before:bg-white/10 overflow-x-auto pb-1">
                          {points.map((p, idx) => (
                            <div key={p.key ?? idx} className="relative flex flex-col items-center gap-2 group z-10 shrink-0">
                              <div className="w-3 h-3 rounded-full bg-[#f58220] border-2 border-white dark:border-gray-900 shadow-sm" />
                              <span className="w-16 text-center leading-tight bg-gray-50 dark:bg-card">
                                {new Date(p.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                <br />
                                {p.label}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-[11px] font-semibold text-gray-500 dark:text-slate-400">
                          <span>Start: <span className="text-gray-800 dark:text-white">{new Date(start).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</span></span>
                          <span>End: <span className="text-gray-800 dark:text-white">{end ? new Date(end).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "In Progress"}</span></span>
                          {durationMinutes !== null && <span>Duration: <span className="text-gray-800 dark:text-white">{formatDurationMinutes(durationMinutes)}</span></span>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Yield & Cost */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-3">Production Yield &amp; Cost</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Produced</p>
                    <p className="text-base font-bold text-gray-800 dark:text-white mt-1 tabular-nums">{selectedBatch.quantity ?? 0} <span className="text-xs text-gray-400 dark:text-slate-500">{selectedBatch.production?.recipe?.yieldUnit || "KG"}</span></p>
                  </div>
                  <div className="p-4 bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Approved / Rejected</p>
                    <p className="text-base font-bold text-gray-800 dark:text-white mt-1 tabular-nums">{selectedBatch.approvedQty ?? 0} <span className="text-xs text-rose-500">/ {selectedBatch.rejectionQty ?? 0}</span></p>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-[#f58220] font-semibold">Material Cost</p>
                    <p className="text-base font-bold text-[#e8740e] mt-1 tabular-nums">₹{(selectedBatch.production?.materialCost ?? selectedBatch.totalCost ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Effective Bulk Cost</p>
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">₹{(selectedBatch.unitCost ?? 0).toFixed(2)} / {selectedBatch.production?.recipe?.yieldUnit || "KG"}</p>
                    <p className="text-[10px] text-emerald-600/70 mt-0.5">Initial: ₹{((selectedBatch.totalCost ?? selectedBatch.production?.materialCost ?? 0) / (selectedBatch.quantity || 1)).toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg shadow-sm text-center">
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">QC Rejected Waste</p>
                    <p className="text-base font-bold text-rose-700 dark:text-rose-400 mt-1 tabular-nums">{selectedBatch.rejectionQty ?? 0} {selectedBatch.production?.recipe?.yieldUnit || "KG"}</p>
                    <p className="text-[10px] text-rose-500 mt-0.5">Absorbed in effective cost</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                  Effective bulk unit cost absorbs QC rejections into approved output (Total Cost ÷ Approved Qty) so downstream inventory, packaging, and POS COGS carry the full manufacturing cost.
                </p>
              </div>

              {/* Ingredients Used */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-3">Ingredients Consumption</h3>
                <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                      <tr>
                        <th className="px-4 py-2">Ingredient</th>
                        <th className="px-4 py-2">Purchase Bill</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-right">Rate</th>
                        <th className="px-4 py-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 dark:divide-white/5 text-sm text-gray-700 dark:text-slate-300">
                      {(selectedBatch.production?.items ?? []).map((pi: any) => {
                        const breakdown: any[] = Array.isArray(pi.batchBreakdown) ? pi.batchBreakdown : [];
                        return (
                          <Fragment key={pi.id}>
                            {/* Ingredient total — the blended figure actually charged to this production run */}
                            <tr className="bg-gray-50/70 dark:bg-white/[0.01] font-semibold text-gray-800 dark:text-white">
                              <td className="px-4 py-2.5">{pi.inventoryItem?.name ?? "—"}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-400 dark:text-slate-500 normal-case">
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
                                  <tr key={idx} className="text-xs text-gray-500 dark:text-slate-400">
                                    <td className="px-4 py-2"></td>
                                    <td className="px-4 py-2 normal-case">
                                      <span className={isFallback ? "font-semibold text-amber-600 dark:text-amber-400" : "font-mono font-semibold text-gray-600 dark:text-slate-300"}>
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
                              <tr className="text-xs text-gray-400 dark:text-slate-500">
                                <td className="px-4 py-2"></td>
                                <td className="px-4 py-2 normal-case" colSpan={4}>No purchase bill on record for this consumption</td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {(!selectedBatch.production?.items || selectedBatch.production.items.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-gray-400 dark:text-slate-500">No ingredient data recorded for this run</td>
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
