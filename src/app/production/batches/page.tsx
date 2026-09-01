"use client";

import { useState, useEffect, useCallback, Fragment, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PackageCheck, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, Filter, Package, Building2, X, Eye, ShieldCheck, Box, Truck, RotateCcw
} from "lucide-react";
import { clsx } from "clsx";
import { productBatchesApi, productsFullApi, franchiseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import RawMaterialConsumptionClient from "@/components/modules/inventory/RawMaterialConsumptionClient";
import ActiveProductionRunsClient from "@/components/modules/production/ActiveProductionRunsClient";
import { formatDate } from "@/lib/utils";

type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";

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

  useEffect(() => {
    if (!requestedBatchId || batches.length === 0) return;
    const match = batches.find((b: any) => b.id === requestedBatchId);
    if (match) {
      setSelectedBatch(match);
      setShowBatchDetails(true);
    }
  }, [requestedBatchId, batches]);

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
    { label: "Total Batches", value: batches.length, icon: Package, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
    { label: "Valid", value: batches.filter(b => b.expiryStatus === "VALID").length, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Expiring Soon", value: batches.filter(b => b.expiryStatus === "EXPIRING_SOON").length, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10" },
    { label: "Expired", value: batches.filter(b => b.expiryStatus === "EXPIRED").length, icon: AlertTriangle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 w-full min-w-0 animate-in fade-in duration-300">

      {/* ── Tab Bar Navigation ── */}
      <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-2xl overflow-x-auto max-w-full bg-white dark:bg-card p-1 shadow-2xs w-full sm:w-fit custom-scrollbar">
        {([
          { key: "ACTIVE_RUNS", label: "Active Production Runs" },
          { key: "REGISTRY", label: "Manufactured Batch Registry" },
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
              "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0",
              activeTab === tab.key
                ? "bg-[#f58220] text-white shadow-2xs"
                : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
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
        <div className="space-y-4 sm:space-y-6 w-full min-w-0">

          {/* ── Summary KPI Strip ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
            {stats.map(s => (
              <div key={s.label} className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 flex items-center justify-between shadow-2xs min-w-0">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 truncate">{s.label}</p>
                  <p className="text-xl sm:text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">{s.value}</p>
                </div>
                <div className={clsx("p-2.5 rounded-xl shrink-0", s.bg, s.color)}>
                  <s.icon size={20} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Multi-Dimensional Filters Row ── */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 shadow-2xs space-y-3 w-full min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input
                  type="text"
                  placeholder="Search batch, product, date..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#f58220]"
                />
                {search && (
                  <X 
                    size={14} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                    onClick={() => setSearch("")} 
                  />
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Product Filter */}
                <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 bg-gray-50 dark:bg-[#13151f] text-xs font-semibold">
                  <Filter size={13} className="text-gray-400 dark:text-slate-500 shrink-0" />
                  <select
                    value={productFilter}
                    onChange={(e) => handleProductFilter(e.target.value)}
                    className="bg-transparent text-xs text-gray-700 dark:text-slate-300 outline-none cursor-pointer max-w-[150px] truncate"
                  >
                    <option value="" className="dark:bg-card">All Products</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id} className="dark:bg-card">{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Expiry filter tabs */}
                <div className="flex border border-gray-200 dark:border-white/10 rounded-xl overflow-x-auto max-w-full custom-scrollbar bg-gray-50 dark:bg-[#13151f] p-0.5">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setExpiryFilter(tab)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                        expiryFilter === tab
                          ? "bg-[#f58220] text-white shadow-2xs"
                          : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      {tab.replace("_", " ")}
                    </button>
                  ))}
                </div>

                {/* Franchise select for Super Admin */}
                {isSuper && (
                  <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 bg-gray-50 dark:bg-[#13151f] text-xs font-semibold">
                    <Building2 size={13} className="text-gray-400 dark:text-slate-500 shrink-0" />
                    <select
                      value={selectedFranchiseId}
                      onChange={(e) => setSelectedFranchiseId(e.target.value)}
                      className="bg-transparent text-xs text-gray-700 dark:text-slate-300 outline-none cursor-pointer max-w-[150px] truncate"
                    >
                      <option value="" className="dark:bg-card">All Branches</option>
                      {franchises.map((f) => (
                        <option key={f.id} value={f.id} className="dark:bg-card">{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => fetchBatches(productFilter || undefined, selectedFranchiseId || undefined)}
                  className="p-2 sm:p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 shadow-2xs transition-all active:scale-95 cursor-pointer"
                  title="Refresh Batches"
                >
                  <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-[#f58220]")} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Table / Empty / Loading ── */}
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 animate-pulse">Loading batches registry...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl py-20 flex flex-col items-center justify-center text-center space-y-3 p-6">
              <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center text-[#f58220]">
                <PackageCheck size={28} />
              </div>
              <div>
                <p className="text-gray-800 dark:text-white font-bold text-sm">No Batches Found</p>
                <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">No manufactured batches match the current filter criteria.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0 shadow-2xs">
              
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-left border-collapse min-w-[980px]">
                  <thead>
                    <tr className="bg-gray-50/75 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200 dark:border-white/5">
                      <th className="px-4 py-3">Batch ID</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Qty Produced</th>
                      <th className="px-4 py-3 text-right">QC Approved</th>
                      <th className="px-4 py-3 text-right">QC Rejected</th>
                      <th className="px-4 py-3 text-right">Unit Cost</th>
                      <th className="px-4 py-3 text-right">Packed</th>
                      <th className="px-4 py-3 text-right">Available FG</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                    {filtered.map((batch: any) => {
                      const status: ExpiryStatus = batch.expiryStatus ?? "VALID";
                      return (
                        <tr key={batch.id} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => { setSelectedBatch(batch); setShowBatchDetails(true); }}
                              className="font-mono font-bold text-[#f58220] hover:text-[#e8740e] text-xs transition-colors cursor-pointer"
                            >
                              {batch.batchCode || "—"}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-gray-900 dark:text-white max-w-[180px] truncate">
                            {batch.product?.name ?? batch.production?.recipe?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-semibold text-gray-800 dark:text-slate-200">
                            {batch.quantity} <span className="text-[10px] text-gray-400">{batch.production?.recipe?.yieldUnit || "KG"}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {batch.qcStatus === "PENDING" ? "—" : (
                              <>{batch.approvedQty || 0} <span className="text-[10px] text-gray-400">{batch.production?.recipe?.yieldUnit || "KG"}</span></>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                            {batch.qcStatus === "PENDING" ? "—" : (
                              <>{batch.rejectionQty || 0} <span className="text-[10px] text-gray-400">{batch.production?.recipe?.yieldUnit || "KG"}</span></>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-semibold text-gray-900 dark:text-white">
                            {batch.unitCost ? `₹${batch.unitCost.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-gray-700 dark:text-slate-300">
                            {batch.packedQuantity || 0} <span className="text-[10px] text-gray-400">{batch.production?.recipe?.yieldUnit || "KG"}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                            {batch.availableQuantity || 0} <span className="text-[10px] text-gray-400">pcs</span>
                          </td>
                          <td className={clsx("px-4 py-3.5 text-xs font-mono font-semibold whitespace-nowrap",
                            status === "EXPIRED" ? "text-rose-600 dark:text-rose-400" : status === "EXPIRING_SOON" ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-slate-400"
                          )}>
                            {formatDate(getEffectiveExpiry(batch))}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={clsx("inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                              batch.qcStatus === "APPROVED" && batch.packagingStatus === "PACKAGED"
                                ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
                                : batch.qcStatus === "APPROVED"
                                ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20"
                                : batch.qcStatus === "PARTIALLY_APPROVED"
                                ? "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20"
                                : batch.qcStatus === "REJECTED"
                                ? "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20"
                                : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
                            )}>
                              {batch.qcStatus === "APPROVED" ? (batch.packagingStatus === "PACKAGED" ? "Packaged" : "QC Passed")
                                : batch.qcStatus === "PARTIALLY_APPROVED" ? "Partial QC"
                                : batch.qcStatus === "REJECTED" ? "Rejected" : "QC Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => { setSelectedBatch(batch); setShowBatchDetails(true); }}
                                className="px-2 py-1 bg-white dark:bg-card border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 hover:bg-gray-50 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                              >
                                View
                              </button>
                              {(!batch.qcStatus || batch.qcStatus === "PENDING") && (
                                <button
                                  onClick={() => router.push(`/purchases/qc?batchId=${batch.id}`)}
                                  className="px-2 py-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                >
                                  QC
                                </button>
                              )}
                              {["APPROVED", "PARTIALLY_APPROVED"].includes(batch.qcStatus) && batch.packagingStatus !== "PACKAGED" && (
                                <button
                                  onClick={() => router.push("/packaging/queue")}
                                  className="px-2 py-1 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-[#f58220] rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                >
                                  Pack
                                </button>
                              )}
                              <button
                                onClick={() => router.push("/delivery")}
                                className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                              >
                                Dispatch
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Cards View (< 1024px) */}
              <div className="lg:hidden divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map((batch: any) => {
                  const status: ExpiryStatus = batch.expiryStatus ?? "VALID";
                  return (
                    <div key={batch.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            onClick={() => { setSelectedBatch(batch); setShowBatchDetails(true); }}
                            className="font-mono font-bold text-[#f58220] text-sm text-left"
                          >
                            {batch.batchCode || "—"}
                          </button>
                          <p className="font-bold text-gray-900 dark:text-white text-xs mt-0.5">
                            {batch.product?.name ?? batch.production?.recipe?.name ?? "—"}
                          </p>
                        </div>
                        <span className={clsx("inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0",
                          batch.qcStatus === "APPROVED" && batch.packagingStatus === "PACKAGED"
                            ? "text-blue-700 bg-blue-50 border-blue-200"
                            : batch.qcStatus === "APPROVED"
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : batch.qcStatus === "PARTIALLY_APPROVED"
                            ? "text-orange-700 bg-orange-50 border-orange-200"
                            : batch.qcStatus === "REJECTED"
                            ? "text-rose-700 bg-rose-50 border-rose-200"
                            : "text-amber-700 bg-amber-50 border-amber-200"
                        )}>
                          {batch.qcStatus === "APPROVED" ? (batch.packagingStatus === "PACKAGED" ? "Packaged" : "QC Passed") : batch.qcStatus || "QC Pending"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 dark:bg-white/[0.02] p-2.5 rounded-xl">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-400">Produced Qty</span>
                          <p className="font-mono font-bold text-gray-900 dark:text-white mt-0.5">
                            {batch.quantity} {batch.production?.recipe?.yieldUnit || "KG"}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                            Approved: {batch.approvedQty || 0} {batch.production?.recipe?.yieldUnit || "KG"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-400">Expiry Date</span>
                          <p className={clsx("font-mono font-bold mt-0.5",
                            status === "EXPIRED" ? "text-rose-600" : status === "EXPIRING_SOON" ? "text-amber-600" : "text-gray-800 dark:text-slate-200"
                          )}>
                            {formatDate(getEffectiveExpiry(batch))}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            FG: {batch.availableQuantity || 0} pcs
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          onClick={() => { setSelectedBatch(batch); setShowBatchDetails(true); }}
                          className="px-3 py-1.5 bg-white dark:bg-card border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          View Details
                        </button>
                        {(!batch.qcStatus || batch.qcStatus === "PENDING") && (
                          <button
                            onClick={() => router.push(`/purchases/qc?batchId=${batch.id}`)}
                            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 text-blue-700 dark:text-blue-400 rounded-xl text-xs font-bold cursor-pointer"
                          >
                            QC Inspection
                          </button>
                        )}
                        {["APPROVED", "PARTIALLY_APPROVED"].includes(batch.qcStatus) && batch.packagingStatus !== "PACKAGED" && (
                          <button
                            onClick={() => router.push("/packaging/queue")}
                            className="px-3 py-1.5 bg-[#f58220] hover:bg-[#e0751a] text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            Package
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Batch Details SlideOver Drawer ── */}
      {showBatchDetails && selectedBatch && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => setShowBatchDetails(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-card shadow-2xl h-full flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/[0.01]">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Batch Details &amp; Lifecycle</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono font-bold text-[#f58220]">
                    {selectedBatch.batchCode || "—"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                    Active Registry
                  </span>
                </div>
              </div>
              <button onClick={() => setShowBatchDetails(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar text-xs">
              {/* Product Info */}
              <div className="bg-gray-50 dark:bg-white/[0.02] p-4 rounded-xl border border-gray-100 dark:border-white/5 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Manufactured Product:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedBatch.product?.name ?? selectedBatch.production?.recipe?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Output Produced:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{selectedBatch.quantity} {selectedBatch.production?.recipe?.yieldUnit || "KG"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">QC Status:</span>
                  <span className="font-bold text-emerald-600">{selectedBatch.qcStatus || "QC Passed"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Expiry Date:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{formatDate(getEffectiveExpiry(selectedBatch))}</span>
                </div>
              </div>

              {/* Stage Logs */}
              {selectedBatch.production?.stageLogs && selectedBatch.production.stageLogs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Production Stage Progression</span>
                  <div className="border border-gray-100 dark:border-white/5 rounded-xl divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
                    {selectedBatch.production.stageLogs.map((log: any) => (
                      <div key={log.id} className="p-2.5 flex items-center justify-between">
                        <span className="font-semibold text-gray-800 dark:text-slate-200">{STAGE_LABELS[log.stage] || log.stage}</span>
                        <span className="font-mono text-gray-400 text-[10px]">{formatDate(log.enteredAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end bg-gray-50/50 dark:bg-white/[0.01]">
              <button
                onClick={() => setShowBatchDetails(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 cursor-pointer"
              >
                Close
              </button>
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
      <div className="p-12 text-center text-xs font-bold text-gray-400 animate-pulse">
        Loading Batches Registry...
      </div>
    }>
      <ProductBatchesRegistry />
    </Suspense>
  );
}
