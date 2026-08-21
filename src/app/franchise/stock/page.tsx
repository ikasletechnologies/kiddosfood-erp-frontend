"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X,
  Package, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, ShoppingCart, Filter, ArrowRight,
} from "lucide-react";
import { clsx } from "clsx";
import { productBatchesApi, productsFullApi } from "@/lib/api";

type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";

const EXPIRY_CARD: Record<ExpiryStatus, { badge: string; bar: string; label: string }> = {
  EXPIRED:       { badge: "bg-red-500/15 text-red-400 border-red-500/30",    bar: "bg-red-500",    label: "EXPIRED"      },
  EXPIRING_SOON: { badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", bar: "bg-amber-500", label: "Expiring Soon" },
  VALID:         { badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", bar: "bg-emerald-500", label: "Safe" },
};

const EXPIRY_ICONS: Record<ExpiryStatus, JSX.Element> = {
  EXPIRED:       <AlertTriangle className="w-3 h-3" />,
  EXPIRING_SOON: <Clock className="w-3 h-3" />,
  VALID:         <CheckCircle2 className="w-3 h-3" />,
};

const FILTER_TABS: Array<{ key: string; label: string }> = [
  { key: "ALL",           label: "All"          },
  { key: "VALID",         label: "Safe"         },
  { key: "EXPIRING_SOON", label: "Expiring Soon"},
  { key: "EXPIRED",       label: "Expired"      },
];

export default function FranchiseStockPage() {
  const [batches, setBatches]       = useState<any[]>([]);
  const [products, setProducts]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [productFilter, setProductFilter] = useState("");
  const [expiryFilter, setExpiryFilter]   = useState("ALL");
  const [searchTerm, setSearchTerm]       = useState("");

  const fetchData = useCallback(async (pid?: string) => {
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        productBatchesApi.getAll({ productId: pid || undefined }),
        productsFullApi.getAll(),
      ]);
      setBatches(bRes.data ?? []);
      setProducts(pRes.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleProductFilter = (pid: string) => {
    setProductFilter(pid);
    fetchData(pid || undefined);
  };

  const filtered = batches.filter((b) => {
    const status = b.expiryStatus ?? "VALID";
    const matchExpiry  = expiryFilter === "ALL" || status === expiryFilter;
    const matchSearch  = !searchTerm || (b.product?.name ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchExpiry && matchSearch;
  });

  // Stats
  const stats = {
    total:    batches.length,
    expired:  batches.filter((b) => b.expiryStatus === "EXPIRED").length,
    expiring: batches.filter((b) => b.expiryStatus === "EXPIRING_SOON").length,
    safe:     batches.filter((b) => b.expiryStatus === "VALID").length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 py-8 px-4">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Package size={24} className="text-primary" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Branch Stock Registry
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
            Monitor available product batches and manage inventory health.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => fetchData(productFilter || undefined)} 
            className="p-3 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
          >
            <RefreshCw size={18} className={clsx("text-slate-400", loading && "animate-spin")} />
          </button>
          <Link 
            href="/franchise-orders" 
            className="flex items-center gap-2 bg-primary hover:bg-primary/95 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
          >
            <ShoppingCart size={18} /> New Stock Order
          </Link>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Batches", val: stats.total, color: "bg-blue-500" },
          { label: "Expired", val: stats.expired, color: "bg-red-500" },
          { label: "Expiring Soon", val: stats.expiring, color: "bg-amber-500" },
          { label: "Safe Stock", val: stats.safe, color: "bg-emerald-500" },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5 p-6 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{s.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">{s.val}</p>
              <div className={`w-1.5 h-8 rounded-full ${s.color} opacity-20`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white dark:bg-card border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-transparent min-w-[240px]">
          <Filter size={16} className="text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search batch or product..."
            className="bg-transparent text-sm font-bold text-slate-700 dark:text-zinc-300 outline-none w-full"
          />
            {searchTerm && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchTerm("")} 
              />
            )}
        </div>

        <select
          value={productFilter}
          onChange={(e) => handleProductFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-transparent text-sm font-bold text-slate-600 dark:text-zinc-400 outline-none"
        >
          <option value="">All Products</option>
          {products.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="flex gap-1 bg-slate-50 dark:bg-white/5 p-1 rounded-xl border border-slate-100 dark:border-transparent">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setExpiryFilter(t.key)}
              className={clsx(
                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                expiryFilter === t.key
                  ? "bg-white dark:bg-card text-primary shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="py-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs animate-pulse">Syncing Batch Records...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-card rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-white/5">
          <Package size={48} strokeWidth={1} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-bold">No product batches match your current filters.</p>
          <button onClick={() => { setExpiryFilter("ALL"); setSearchTerm(""); setProductFilter(""); fetchData(); }} className="mt-4 text-primary font-black text-xs uppercase underline tracking-widest">Reset All Filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((batch: any) => {
            const status = (batch.expiryStatus ?? "VALID") as ExpiryStatus;
            const isLow = batch.quantity < 10;
            const effectiveExpiry = batch.expiryDate || batch.production?.expiryDate;
            const daysLeft = effectiveExpiry
              ? Math.ceil((new Date(effectiveExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div key={batch.id} className="group bg-white dark:bg-card border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/10 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors shadow-sm">
                    <Package size={28} />
                  </div>
                  <div className={clsx(
                    "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                    status === "EXPIRED" ? "bg-red-50 text-red-500 border-red-100" : 
                    status === "EXPIRING_SOON" ? "bg-amber-50 text-amber-500 border-amber-100" :
                    "bg-emerald-50 text-emerald-500 border-emerald-100"
                  )}>
                    {status}
                  </div>
                </div>

                <div className="mb-8">
                  <p className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-1">{batch.product?.name}</p>
                  <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">{batch.batchCode}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 dark:bg-white/[0.02] rounded-2xl p-4 border border-slate-100 dark:border-transparent">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Available</p>
                    <p className={clsx("text-2xl font-black tracking-tight", isLow ? "text-amber-500" : "text-slate-900 dark:text-white")}>
                      {batch.quantity}
                      <span className="text-[10px] font-bold text-slate-400 ml-1.5 uppercase">{batch.product?.unit}</span>
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/[0.02] rounded-2xl p-4 border border-slate-100 dark:border-transparent">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Expires In</p>
                    {effectiveExpiry ? (
                      <div>
                        <p className={clsx("text-xl font-black tracking-tight", daysLeft !== null && daysLeft <= 7 ? "text-red-500" : "text-slate-900 dark:text-white")}>
                          {daysLeft === null ? "—" : daysLeft <= 0 ? "EXPIRED" : `${daysLeft}d`}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(effectiveExpiry).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}</p>
                      </div>
                    ) : (
                      <p className="text-xl font-black text-slate-300">—</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-6 border-t border-slate-100 dark:border-white/5">
                  <Link
                    href="/franchise-orders"
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-white/5 hover:bg-primary hover:text-white text-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm group-hover:shadow-md"
                  >
                    <ShoppingCart size={14} /> Restock Item
                  </Link>
                  <Link
                    href={`/production/batches?id=${batch.id}`}
                    className="flex items-center justify-center px-4 py-3 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 rounded-xl transition-all"
                  >
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
