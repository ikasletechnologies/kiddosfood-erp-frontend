"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PackageCheck, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, Filter, Package, Building2
} from "lucide-react";
import { clsx } from "clsx";
import { productBatchesApi, productsFullApi, franchiseApi, productionApi } from "@/lib/api";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { formatERPNumber } from "@/lib/utils";
import RawMaterialConsumptionClient from "@/components/modules/inventory/RawMaterialConsumptionClient";
import ActiveProductionRunsClient from "@/components/modules/production/ActiveProductionRunsClient";

type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";

const EXPIRY_CONFIG: Record<ExpiryStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
  EXPIRED:       { bg: "bg-rose-50 dark:bg-rose-500/10",       text: "text-rose-700 dark:text-rose-400",      border: "border-rose-200 dark:border-rose-500/20",    dot: "bg-rose-500",    label: "Expired" },
  EXPIRING_SOON: { bg: "bg-amber-50 dark:bg-amber-500/10",     text: "text-amber-700 dark:text-amber-400",    border: "border-amber-200 dark:border-amber-500/20",  dot: "bg-amber-500",   label: "Expiring Soon" },
  VALID:         { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/20", dot: "bg-emerald-500", label: "Valid" },
};

function getEffectiveExpiry(batch: any): string | null {
  return batch.expiryDate ?? batch.production?.expiryDate ?? null;
}

const FILTER_TABS = ["ALL", "VALID", "EXPIRING_SOON", "EXPIRED"] as const;

export default function ProductBatchesPage() {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";

  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"REGISTRY" | "CONSUMPTION" | "ACTIVE_RUNS" | "PACKING_QUEUE">("ACTIVE_RUNS");
  
  // Packing Modal State
  const [showPackModal, setShowPackModal] = useState(false);
  const [packBatch, setPackBatch] = useState<any>(null);
  const [packSize, setPackSize] = useState("");
  const [packQty, setPackQty] = useState("");
  const [packagings, setPackagings] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQCModal, setShowQCModal] = useState(false);
  const [qcBatch, setQcBatch] = useState<any>(null);
  const [qcStatus, setQcStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");

  // Batch Details SlideOver State
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  // Fetch active franchises for Super Admin
  useEffect(() => {
    if (isSuper) {
      franchiseApi.getAll()
        .then((res) => {
          const branches = (res.data ?? []).filter((f: any) => 
            !f.name.includes("Headquarters (HQ)") && 
            f.id !== "hq-001"
          );
          setFranchises(branches);
        })
        .catch((err) => console.error("Failed to load franchises", err));
    }
  }, [isSuper]);

  const fetchBatches = useCallback(async (productId?: string, franchiseId?: string) => {
    setLoading(true);
    try {
      const [bRes, pRes, packRes] = await Promise.all([
        productBatchesApi.getAll({ 
          productId: productId || undefined,
          franchiseId: franchiseId || undefined
        }),
        productsFullApi.getAll(),
        productionApi.getPackagings(franchiseId || undefined),
      ]);
      setBatches(bRes.data ?? []);
      setProducts(pRes.data ?? []);
      setPackagings(packRes.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchBatches(productFilter || undefined, selectedFranchiseId || undefined); 
  }, [fetchBatches, productFilter, selectedFranchiseId]);

  const handleProductFilter = (pid: string) => {
    setProductFilter(pid);
  };

  const filtered = batches.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      b.batchCode?.toLowerCase().includes(q) ||
      b.product?.name?.toLowerCase().includes(q) ||
      (b.createdAt && new Date(b.createdAt).toLocaleDateString().includes(q));
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
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-8 animate-in fade-in duration-700 px-4 sm:px-0">
      
      {/* Top Level Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit mx-auto md:mx-0">
        <button
          onClick={() => setActiveTab("REGISTRY")}
          className={clsx(
            "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
            activeTab === "REGISTRY" ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Batch Registry
        </button>
        <button
          onClick={() => setActiveTab("ACTIVE_RUNS")}
          className={clsx(
            "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
            activeTab === "ACTIVE_RUNS" ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Active Runs
        </button>
        <button
          onClick={() => setActiveTab("CONSUMPTION")}
          className={clsx(
            "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
            activeTab === "CONSUMPTION" ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Material Consumption
        </button>
        <button
          onClick={() => setActiveTab("PACKING_QUEUE")}
          className={clsx(
            "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
            activeTab === "PACKING_QUEUE" ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Packing Queue
        </button>
      </div>

      {activeTab === "ACTIVE_RUNS" ? (
        <ActiveProductionRunsClient />
      ) : activeTab === "CONSUMPTION" ? (
        <RawMaterialConsumptionClient />
      ) : activeTab === "PACKING_QUEUE" ? (
        
        <div className="space-y-4 md:space-y-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 md:py-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h1 className="text-xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Packing <span className="text-slate-400 font-medium ml-1 tracking-tighter italic">Queue</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1.5 font-medium uppercase tracking-widest text-[7px] md:text-[9px]">
                Pending Packing • Packing • Packed • Bulk Storage • Dispatched
              </p>
            </div>
          </header>

          <div className="bg-white dark:bg-card/40 backdrop-blur-md rounded-[24px] md:rounded-[32px] border border-slate-100 dark:border-white/5 overflow-hidden shadow-lg mb-8">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Batches Ready for Packing</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                    {["Batch", "Product", "Available Bulk", "Packed", "Status", "Action"].map((h) => (
                      <th key={h} className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                  {batches.filter(b => b.qcStatus === 'APPROVED' && b.packagingStatus !== 'PACKAGED').map((batch: any, i: number) => {
                    const availableBulk = Math.max(0, batch.quantity - (batch.packagedQty || 0));
                    return (
                      <tr key={batch.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider font-mono">
                          {batch.batchCode ? formatERPNumber("PRD", batch.batchCode, batch.createdAt) : "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight">
                          {batch.product?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                          {availableBulk} <span className="text-[9px] text-slate-400">{batch.product?.unit || 'KG'}</span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                          {batch.packagedQty || 0} <span className="text-[9px] text-slate-400">{batch.product?.unit || 'KG'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx("px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider", 
                            batch.packagingStatus === 'PARTIALLY_PACKED' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                          )}>
                            {batch.packagingStatus === 'PARTIALLY_PACKED' ? "Partially Packed" : "Ready for Packing"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setPackBatch(batch); setShowPackModal(true); }}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[9px] font-black uppercase tracking-widest transition-colors shadow-sm"
                          >
                            Pack
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {batches.filter(b => b.qcStatus === 'APPROVED' && b.packagingStatus !== 'PACKAGED').length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        No pending batches for packing
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-card/40 backdrop-blur-md rounded-[24px] md:rounded-[32px] border border-slate-100 dark:border-white/5 overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">Generated Packing Lots</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                    {["Lot Number / Batch", "Product", "Packet Size", "Packets", "Total Weight", "Created"].map((h) => (
                      <th key={h} className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                  {packagings.map((pkg: any) => (
                    <tr key={pkg.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider font-mono">
                        {pkg.barcode}
                        <br/><span className="text-[8px] text-slate-400">Batch: {formatERPNumber("PRD", pkg.batch?.batchCode, pkg.batch?.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        {pkg.batch?.product?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                        {pkg.packetSize}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                        {pkg.quantityPackets}
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                        {pkg.totalWeight} <span className="text-[9px] text-slate-400">KG</span>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-500 tabular-nums">
                        {new Date(pkg.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {packagings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        No Packing Lots Generated Yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-8">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 md:py-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 md:p-2.5 bg-indigo-600 rounded-lg md:rounded-xl shadow-lg shadow-indigo-600/20 shrink-0">
                  <PackageCheck size={20} className="text-white" />
                </div>
                <h1 className="text-xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Batch <span className="text-slate-400 font-medium ml-1 tracking-tighter italic">Registry</span>
                </h1>
              </div>
              <p className="text-slate-500 dark:text-slate-400 mt-1.5 font-medium ml-10 md:ml-12 uppercase tracking-widest text-[7px] md:text-[9px]">
                {isSuper ? "Global batch registry and manufacturing overview" : "Branch batch registry"}
              </p>
            </div>
            <div className="flex gap-3">
              {/* Product selector filter */}
              <div className="flex items-center gap-2 bg-white dark:bg-card/40 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 shadow-sm">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <select
                  value={productFilter}
                  onChange={(e) => handleProductFilter(e.target.value)}
                  className="bg-transparent text-[11px] font-black text-slate-600 dark:text-slate-300 outline-none uppercase tracking-widest cursor-pointer"
                >
                  <option value="">All Products</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Franchise select dropdown for Super Admin */}
              {isSuper && (
                <div className="flex items-center gap-2 bg-white dark:bg-card/40 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 shadow-sm">
                  <Building2 size={14} className="text-slate-400 shrink-0" />
                  <select
                    value={selectedFranchiseId}
                    onChange={(e) => setSelectedFranchiseId(e.target.value)}
                    className="bg-transparent text-[11px] font-black text-slate-600 dark:text-slate-300 outline-none uppercase tracking-widest cursor-pointer"
                  >
                    <option value="">All Branches</option>
                    {franchises.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search Bar */}
              <div className="flex items-center gap-2 bg-white dark:bg-card/40 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 shadow-sm">
                <input
                  type="text"
                  placeholder="Search Batch / Product / Date..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-[11px] font-black text-slate-600 dark:text-slate-300 outline-none placeholder-slate-400 uppercase tracking-widest w-48"
                />
              </div>

              <button
                onClick={() => fetchBatches(productFilter || undefined, selectedFranchiseId || undefined)}
                className="p-2.5 md:p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg md:rounded-xl hover:border-slate-300 transition-all shadow-sm group shrink-0"
              >
                <RefreshCw size={14} className={clsx("text-slate-400 group-hover:rotate-180 transition-transform duration-500 md:w-4 md:h-4", loading && "animate-spin")} />
              </button>
            </div>
          </header>

          {/* Batch Registry List */}
          <div className="space-y-3 md:space-y-4">
            {loading ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loading Batches...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 bg-slate-50 dark:bg-white/[0.02] rounded-[24px] md:rounded-[32px] border-2 border-dashed border-slate-200 dark:border-white/5 text-center px-6 md:px-8">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-card rounded-xl md:rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4 text-slate-200 dark:text-white/10">
                  <PackageCheck size={28} className="md:w-8 md:h-8" />
                </div>
                <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">No Batches Found</p>
                <p className="text-[10px] text-slate-500 mt-1">No batches match the current filter.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-card/40 backdrop-blur-md rounded-[24px] md:rounded-[32px] border border-slate-100 dark:border-white/5 overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                        {["Batch ID", "Product", "Qty Produced", "Unit Cost", "Packed", "Bulk", "Available", "Expiry", "Status", "Actions"].map((h) => (
                          <th key={h} className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                      {filtered.map((batch: any) => {
                        const status: ExpiryStatus = batch.expiryStatus ?? "VALID";
                        return (
                          <tr key={batch.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => { setSelectedBatch(batch); setShowBatchDetails(true); }}
                                className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-mono transition-colors"
                              >
                                {batch.batchCode ? formatERPNumber("PRD", batch.batchCode, batch.createdAt) : "—"}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                                  <Package size={12} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight">
                                  {batch.product?.name ?? "—"}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                              {batch.quantity} <span className="text-[9px] text-slate-400">{batch.product?.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                              {batch.unitCost ? `₹${batch.unitCost.toFixed(2)}` : "—"}
                            </td>
                            <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                              {batch.packedQuantity || 0} <span className="text-[9px] text-slate-400">{batch.product?.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                              {batch.bulkQuantity || 0} <span className="text-[9px] text-slate-400">{batch.product?.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-[11px] font-bold text-slate-900 tabular-nums">
                              {Math.max(0, batch.quantity - (batch.packagedQty || 0))} <span className="text-[9px] text-slate-400">{batch.product?.unit}</span>
                            </td>
                            <td className={clsx("px-4 py-3 text-[10px] font-bold", status === "EXPIRED" ? "text-rose-500" : status === "EXPIRING_SOON" ? "text-amber-500" : "text-slate-500")}>
                              {getEffectiveExpiry(batch) ? new Date(getEffectiveExpiry(batch)!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={clsx("px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider",
                                batch.qcStatus === "APPROVED" && batch.packagingStatus === "PACKAGED" ? "bg-blue-50 text-blue-600" :
                                batch.qcStatus === "APPROVED" ? "bg-emerald-50 text-emerald-600" :
                                batch.qcStatus === "REJECTED" ? "bg-rose-50 text-rose-600" :
                                "bg-amber-50 text-amber-600"
                              )}>
                                {batch.qcStatus === "APPROVED" ? (batch.packagingStatus === "PACKAGED" ? "PACKAGED" : "READY TO PACK") : batch.qcStatus || "PENDING QC"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              
                                <div className="flex gap-2">
                                  {["View", "QC", "Pack", "Dispatch", "Recall"].map((action) => {
                                    let isDisabled = false;
                                    if (action === "QC" && batch.qcStatus === "APPROVED") isDisabled = true;
                                    if (action === "Pack" && (batch.qcStatus !== "APPROVED" || batch.packagingStatus === "PACKAGED")) isDisabled = true;

                                    return (
                                      <button
                                        key={action}
                                        disabled={isDisabled}
                                        onClick={() => {
                                          if (action === "Pack") {
                                            setPackBatch(batch);
                                            setShowPackModal(true);
                                          } else if (action === "View") {
                                            setSelectedBatch(batch);
                                            setShowBatchDetails(true);
                                          } else if (action === "QC") {
                                            setQcBatch(batch);
                                            setShowQCModal(true);
                                          } else if (action === "Dispatch") {
                                            alert(`Preparing to dispatch batch ${batch.batchCode}`);
                                          } else if (action === "Recall") {
                                            alert(`Initiating recall for batch ${batch.batchCode}`);
                                          }
                                        }}
                                        className={clsx(
                                          "text-[9px] font-black uppercase transition-colors tracking-wider",
                                          isDisabled ? "text-slate-300 dark:text-slate-700 cursor-not-allowed" : "text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                                        )}
                                      >
                                        {action}
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
        </div>
      )}

      
      {/* Packing Modal */}
      {showPackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Pack Batch</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{packBatch?.product?.name} ({packBatch?.batchCode ? formatERPNumber("PRD", packBatch.batchCode) : "—"})</p>
              </div>
              <button onClick={() => setShowPackModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Packet Size / Type</label>
                <div className="flex gap-2 mb-3">
                  {["500 g", "1 Kg", "5 Kg"].map(size => (
                    <button
                      key={size}
                      onClick={() => setPackSize(size)}
                      className={clsx("flex-1 py-1.5 border rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        packSize === size ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={packSize}
                  onChange={e => setPackSize(e.target.value)}
                  placeholder="Or enter custom size (e.g. 2.5 Kg, 250 g)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Enter Quantity (Packets)</label>
                <input
                  type="number"
                  value={packQty}
                  onChange={e => setPackQty(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
                />
              </div>

              {(() => {
                const parseWeight = (size: string) => {
                  const match = size.match(/^(\d+(\.\d+)?)\s*(g|kg|l|ml|pcs|unit)$/i);
                  if (!match) return 1.0;
                  const val = parseFloat(match[1]);
                  const unit = match[3].toLowerCase();
                  if (unit === 'g' || unit === 'ml') return val / 1000;
                  return val;
                };

                const qtyNum = parseInt(packQty) || 0;
                const weightPerPacket = parseWeight(packSize);
                const calcBulk = qtyNum * weightPerPacket;
                const availableBulk = Math.max(0, packBatch?.quantity - (packBatch?.packagedQty || 0));
                const remaining = availableBulk - calcBulk;
                const isValid = calcBulk > 0 && calcBulk <= availableBulk;

                return (
                  <div className="bg-slate-50 rounded-xl p-4 mt-4 border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bulk Required</span>
                      <span className={clsx("text-sm font-black tabular-nums", calcBulk > availableBulk ? "text-rose-500" : "text-slate-900")}>
                        {calcBulk.toFixed(2)} KG
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Bulk</span>
                      <span className="text-sm font-black text-slate-900 tabular-nums">
                        {availableBulk.toFixed(2)} KG
                      </span>
                    </div>
                    <div className="h-px bg-slate-200 w-full my-2"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining</span>
                      <span className={clsx("text-sm font-black tabular-nums", remaining < 0 ? "text-rose-500" : "text-emerald-600")}>
                        {remaining.toFixed(2)} KG
                      </span>
                    </div>

                    <button
                      disabled={!isValid || isSubmitting}
                      onClick={async () => {
                        setIsSubmitting(true);
                        try {
                          await productionApi.packageBatch(packBatch.id, {
                            packetSize: packSize,
                            quantityPackets: qtyNum
                          });
                          toast.success("Packing Lot created successfully!");
                          setShowPackModal(false);
                          setPackQty("");
                          fetchBatches(productFilter || undefined, selectedFranchiseId || undefined);
                        } catch (e: any) {
                          toast.error(e.response?.data?.error || "Failed to pack");
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      className={clsx(
                        "w-full mt-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-colors",
                        isValid && !isSubmitting ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      {isSubmitting ? "Processing..." : "Confirm & Pack"}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* QC Modal */}
      {showQCModal && qcBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">QC Approval</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{qcBatch?.product?.name} ({qcBatch?.batchCode ? formatERPNumber("PRD", qcBatch.batchCode) : "—"})</p>
              </div>
              <button onClick={() => setShowQCModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">QC Decision</label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setQcStatus("APPROVED")}
                    className={clsx("flex-1 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      qcStatus === "APPROVED" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setQcStatus("REJECTED")}
                    className={clsx("flex-1 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      qcStatus === "REJECTED" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    Reject (Scrap)
                  </button>
                </div>
              </div>

              <button
                disabled={isSubmitting}
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    await productionApi.inspectBatch(qcBatch.id, {
                      qcStatus: qcStatus
                    });
                    toast.success("QC status updated successfully!");
                    setShowQCModal(false);
                    fetchBatches(productFilter || undefined, selectedFranchiseId || undefined);
                  } catch (e: any) {
                    toast.error(e.response?.data?.error || "Failed to update QC");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className={clsx(
                  "w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-colors text-white",
                  qcStatus === "APPROVED" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"
                )}
              >
                {isSubmitting ? "Processing..." : "Confirm QC"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Details SlideOver */}
      {showBatchDetails && selectedBatch && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setShowBatchDetails(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Batch Details</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-wider">
                    {formatERPNumber("PRD", selectedBatch.batchCode, selectedBatch.createdAt)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest">Active</span>
                </div>
              </div>
              <button onClick={() => setShowBatchDetails(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Timeline Header */}
              <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white uppercase mt-0.5">{selectedBatch.product?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recipe Version</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">v1.2 (Standard)</p>
                  </div>
                </div>
                
                {/* Production Timeline */}
                <div className="mt-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Production Timeline</h4>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider relative before:absolute before:top-1/2 before:-translate-y-1/2 before:left-0 before:right-0 before:h-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {["09:00 Started", "09:25 Mixing", "09:45 Grinding", "10:30 Fermentation", "11:15 QC", "11:40 Packing", "12:10 Completed"].map((step, idx) => (
                      <div key={idx} className="relative flex flex-col items-center gap-2 group z-10">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow-sm" />
                        <span className="w-16 text-center leading-tight bg-slate-50 dark:bg-slate-950">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Yield & Cost */}
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-3">Production Yield &amp; Cost</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Produced</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{selectedBatch.quantity ?? 0} <span className="text-[10px] text-slate-400">{selectedBatch.product?.unit || "KG"}</span></p>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Approved / Rejected</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{selectedBatch.approvedQty ?? 0} <span className="text-[10px] text-rose-400">/ {selectedBatch.rejectionQty ?? 0}</span></p>
                  </div>
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl shadow-sm text-center">
                    <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Material Cost</p>
                    <p className="text-xl font-black text-indigo-700 dark:text-indigo-400 mt-1 tabular-nums">₹{(selectedBatch.production?.materialCost ?? selectedBatch.totalCost ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl shadow-sm text-center">
                    <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Unit Cost</p>
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">₹{(selectedBatch.unitCost ?? 0).toFixed(2)}</p>
                  </div>
                </div>
                <p className="text-[9px] font-bold text-slate-400 mt-2">
                  Unit cost reflects the real price on whichever purchase bill(s) this run actually consumed (FIFO) — it can differ run-to-run of the same recipe as older, cheaper bills run out and newer purchase prices take over.
                </p>
              </div>

              {/* Ingredients Used */}
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-3">Ingredients Consumption</h3>
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-2">Ingredient</th>
                        <th className="px-4 py-2 text-right">Qty Used</th>
                        <th className="px-4 py-2 text-right">Unit Cost</th>
                        <th className="px-4 py-2 text-right">Total Cost</th>
                        <th className="px-4 py-2">Purchase Bill(s) Used (FIFO)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {(selectedBatch.production?.items ?? []).map((pi: any) => (
                        <tr key={pi.id}>
                          <td className="px-4 py-3">{pi.inventoryItem?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{pi.usedQuantity} {pi.inventoryItem?.unit}</td>
                          <td className="px-4 py-3 text-right tabular-nums">₹{(pi.unitCost ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">₹{(pi.totalCost ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-[10px] text-slate-500 normal-case">
                            {Array.isArray(pi.batchBreakdown) && pi.batchBreakdown.length > 0
                              ? pi.batchBreakdown.map((b: any, idx: number) => {
                                  const isFallback = !b.batchId;
                                  return (
                                    <div key={idx} className="whitespace-nowrap">
                                      <span className={isFallback
                                        ? "font-bold text-amber-600 dark:text-amber-400"
                                        : "font-mono font-bold text-slate-600 dark:text-slate-300"}>
                                        {b.billNumber || "—"}
                                      </span>
                                      {": "}
                                      {b.qty} {pi.inventoryItem?.unit} @ ₹{(b.unitCost ?? 0).toFixed(2)}
                                    </div>
                                  );
                                })
                              : "—"}
                          </td>
                        </tr>
                      ))}
                      {(!selectedBatch.production?.items || selectedBatch.production.items.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">No ingredient data recorded for this run</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Packing History */}
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-3">Packing & Output</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Packed Lots (500g)</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-1">40 Packets</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Generated Lot: L-PRD-2026-001-A</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bulk Storage</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white mt-1">35 Kg</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Available for dispatch</p>
                  </div>
                </div>
              </div>

              {/* QC Result */}
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-3">QC Result</h3>
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">QC Passed</p>
                  </div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500/70">Viscosity, pH, and Fermentation levels are within standard tolerances. Approved for packing.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
