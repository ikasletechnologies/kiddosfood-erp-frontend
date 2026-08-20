"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PackageCheck, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, Filter, Package, Building2
} from "lucide-react";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { productBatchesApi, productsFullApi, franchiseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatERPNumber } from "@/lib/utils";

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
  const router = useRouter();

  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<string>("ALL");

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
      setBatches(bRes.data ?? []);
      setProducts(pRes.data ?? []);
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

  const filtered = batches.filter((b) =>
    expiryFilter === "ALL" || (b.expiryStatus ?? "VALID") === expiryFilter
  );

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
      <div className="space-y-4 md:space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 md:py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 md:p-2.5 bg-emerald-600 rounded-lg md:rounded-xl shadow-lg shadow-emerald-600/20 shrink-0">
              <PackageCheck size={18} className="text-white md:hidden" />
              <PackageCheck size={20} className="text-white hidden md:block" />
            </div>
            <h1 className="text-xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              Expiry <span className="text-slate-400 font-medium ml-1 tracking-tighter italic">Tracking</span>
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 font-medium ml-10 md:ml-12 uppercase tracking-widest text-[7px] md:text-[9px]">
            {isSuper ? "Global batch registry and shelf-life monitoring across all branches" : "Branch batch registry & shelf-life tracking"}
          </p>
        </div>
        <button
          onClick={() => fetchBatches(productFilter || undefined, selectedFranchiseId || undefined)}
          className="p-2.5 md:p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg md:rounded-xl hover:border-slate-300 transition-all shadow-sm group shrink-0"
        >
          <RefreshCw size={14} className={clsx("text-slate-400 group-hover:rotate-180 transition-transform duration-500 md:w-4 md:h-4", loading && "animate-spin")} />
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
        {stats.map((s, i) => (
          <div key={i} className="bg-white dark:bg-card/40 backdrop-blur-sm p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 dark:border-white/5 shadow-lg shadow-black/[0.01]">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className={clsx("p-2.5 md:p-3 rounded-lg md:rounded-xl", s.bg, s.color)}>
                <s.icon size={18} className="md:w-5 md:h-5" />
              </div>
              <span className="text-[7px] md:text-[9px] font-black text-slate-300 tracking-[0.3em] uppercase">Metric</span>
            </div>
            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{s.label}</p>
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">{s.value}</h3>
          </div>
        ))}
      </div>

      {/* Filters Strip */}
      <div className="flex flex-col sm:flex-row gap-3">
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

        {/* Expiry filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map((f) => (
            <button
              key={f}
              onClick={() => setExpiryFilter(f)}
              className={clsx(
                "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                expiryFilter === f
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/20"
                  : "bg-white dark:bg-card/40 border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:border-slate-300"
              )}
            >
              {f === "ALL" ? "All" : f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Registry List */}
      <div className="space-y-3 md:space-y-4">
        <h2 className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-3 ml-2">
          <PackageCheck size={12} /> Batch Registry
        </h2>

        {loading ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
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
            
            {/* Table header */}
            <div className={clsx("border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]", gridClasses)}>
              {isSuper 
                ? ["Batch Code", "Product", "Branch Outlet", "Qty", "Produced", "Expiry Date", "Status"].map((h) => (
                    <p key={h} className="text-[8px] font-black text-slate-400 uppercase tracking-[0.25em]">{h}</p>
                  ))
                : ["Batch Code", "Product", "Qty", "Produced", "Expiry Date", "Status"].map((h) => (
                    <p key={h} className="text-[8px] font-black text-slate-400 uppercase tracking-[0.25em]">{h}</p>
                  ))
              }
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
              {filtered.map((batch: any) => {
                const status: ExpiryStatus = batch.expiryStatus ?? "VALID";
                const conf = EXPIRY_CONFIG[status];
                return (
                  <div
                    key={batch.id}
                    onClick={() => router.push(`/production/batches?tab=REGISTRY&batchId=${batch.id}`)}
                    className={clsx("hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors items-center cursor-pointer", gridClasses)}
                  >
                    {/* Batch Code — same PRD-YYYY-#### the batch carries in
                        Batch Manufacturing / QC / Finished Goods, so it can be
                        traced across the lifecycle instead of minting a
                        second identifier just for this screen. */}
                    <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider font-mono">
                      {batch.batchCode ? formatERPNumber("PRD", batch.batchCode, batch.createdAt) : "—"}
                    </p>

                    {/* Product */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Package size={12} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">
                        {batch.product?.name ?? "—"}
                      </p>
                    </div>

                    {/* Branch (Super Admin Only) */}
                    {isSuper && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 size={12} className="text-slate-400 shrink-0" />
                        <p className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 truncate">
                          {batch.franchise?.name ?? "Independent Branch"}
                        </p>
                      </div>
                    )}

                    {/* Quantity */}
                    <p className="text-[13px] font-black text-slate-900 dark:text-white tabular-nums">
                      {batch.quantity}
                      {batch.product?.unit && (
                        <span className="text-[9px] text-slate-400 ml-1 font-bold uppercase">{batch.product.unit}</span>
                      )}
                    </p>

                    {/* Produced date */}
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {batch.createdAt
                        ? new Date(batch.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </p>

                    {/* Expiry date */}
                    <p className={clsx("text-[10px] font-bold", status === "EXPIRED" ? "text-rose-500" : status === "EXPIRING_SOON" ? "text-amber-500" : "text-slate-500 dark:text-slate-400")}>
                      {getEffectiveExpiry(batch)
                        ? new Date(getEffectiveExpiry(batch)!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : <span className="text-slate-300 dark:text-white/20">—</span>}
                    </p>

                    {/* Status badge */}
                    <span className={clsx(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest w-fit",
                      conf.bg, conf.text, conf.border
                    )}>
                      <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", conf.dot, status === "EXPIRING_SOON" && "animate-pulse")} />
                      {conf.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
