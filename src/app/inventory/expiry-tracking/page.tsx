"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Building2,
  Filter,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import { productBatchesApi, productsFullApi, franchiseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatERPNumber } from "@/lib/utils";

type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";

const EXPIRY_CONFIG: Record<
  ExpiryStatus,
  { bg: string; color: string; border: string; dot: string; label: string }
> = {
  EXPIRED: {
    bg: "bg-rose-50 dark:bg-rose-500/10",
    color: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-500/20",
    dot: "bg-rose-500",
    label: "Expired",
  },
  EXPIRING_SOON: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    color: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-500/20",
    dot: "bg-amber-500",
    label: "Expiring Soon",
  },
  VALID: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    color: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
    label: "Valid",
  },
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
  const [productFilter, setProductFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<string>("ALL");

  useEffect(() => {
    if (isSuper) {
      franchiseApi
        .getAll()
        .then((res) => setFranchises(res.data ?? []))
        .catch((err) => console.error("Failed to load franchises", err));
    }
  }, [isSuper]);

  const fetchBatches = useCallback(
    async (productId?: string, franchiseId?: string) => {
      setLoading(true);
      try {
        const [bRes, pRes] = await Promise.all([
          productBatchesApi.getAll({
            productId: productId || undefined,
            franchiseId: franchiseId || undefined,
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
    },
    []
  );

  useEffect(() => {
    fetchBatches(productFilter || undefined, selectedFranchiseId || undefined);
  }, [fetchBatches, productFilter, selectedFranchiseId]);

  const filtered = batches.filter(
    (b) => expiryFilter === "ALL" || (b.expiryStatus ?? "VALID") === expiryFilter
  );

  const stats = [
    {
      label: "Total Batches",
      value: batches.length,
      icon: Package,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/20",
      borderColor: "border-indigo-200 dark:border-indigo-900/30",
    },
    {
      label: "Valid",
      value: batches.filter((b) => b.expiryStatus === "VALID").length,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      borderColor: "border-emerald-200 dark:border-emerald-900/30",
    },
    {
      label: "Expiring Soon",
      value: batches.filter((b) => b.expiryStatus === "EXPIRING_SOON").length,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      borderColor: "border-amber-200 dark:border-amber-900/30",
    },
    {
      label: "Expired",
      value: batches.filter((b) => b.expiryStatus === "EXPIRED").length,
      icon: AlertTriangle,
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-950/20",
      borderColor: "border-rose-200 dark:border-rose-900/30",
    },
  ];

  const handleExportCSV = () => {
    const headers = isSuper
      ? ["Batch Code", "Product", "Branch", "Bulk Remaining", "Produced", "Expiry Date", "Status"]
      : ["Batch Code", "Product", "Bulk Remaining", "Produced", "Expiry Date", "Status"];

    const rows = [
      ["EXPIRY TRACKING REPORT"],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      headers,
      ...filtered.map((b: any) => {
        const status: ExpiryStatus = b.expiryStatus ?? "VALID";
        const expiry = getEffectiveExpiry(b);
        const base = [
          b.batchCode ? formatERPNumber("PRD", b.batchCode, b.createdAt) : "—",
          b.product?.name ?? "—",
          ...(isSuper ? [b.franchise?.name ?? "—"] : []),
          `${b.bulkQuantity ?? b.quantity} ${b.production?.recipe?.yieldUnit || "KG"}`,
          b.createdAt
            ? new Date(b.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "—",
          expiry
            ? new Date(expiry).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "—",
          EXPIRY_CONFIG[status].label,
        ];
        return base;
      }),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows
        .map((e) =>
          e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `Expiry_Tracking_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 print:bg-white print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center print:hidden border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <PackageCheck size={22} className="text-orange-500" />
              Expiry Tracking
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
              <Sparkles size={12} className="animate-pulse" /> Shelf-Life
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSuper
              ? "Global batch registry and shelf-life monitoring across all branches"
              : "Branch batch registry & shelf-life tracking"}
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Product Filter */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm">
            <div className="flex items-center px-2 text-slate-400">
              <Filter size={14} />
            </div>
            <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider pl-1 select-none">
                Product
              </span>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-bold outline-none cursor-pointer"
              >
                <option value="">All Products</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Branch Filter (Super Admin) */}
          {isSuper && (
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm">
              <div className="flex items-center px-2 text-slate-400">
                <Building2 size={14} />
              </div>
              <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold">
                <span className="text-slate-400 text-[11px] uppercase tracking-wider pl-1 select-none">
                  Branch
                </span>
                <select
                  value={selectedFranchiseId}
                  onChange={(e) => setSelectedFranchiseId(e.target.value)}
                  className="bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-bold outline-none cursor-pointer"
                >
                  <option value="">All Branches</option>
                  {franchises.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <button
              onClick={handleExportCSV}
              title="Export Excel / CSV"
              className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 shadow-sm transition-all duration-150 active:scale-95"
            >
              <FileSpreadsheet size={16} />
            </button>
            <button
              onClick={handlePrint}
              title="Print Report"
              className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 shadow-sm transition-all duration-150 active:scale-95"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={() =>
                fetchBatches(
                  productFilter || undefined,
                  selectedFranchiseId || undefined
                )
              }
              title="Refresh Data"
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95"
            >
              <RotateCcw
                size={16}
                className={clsx(loading && "animate-spin")}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Stats + Filter Tabs Row */}
      <div className="flex flex-col lg:flex-row gap-4 print:hidden">
        {/* Stats Cards */}
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {stats.map((s) => (
            <div
              key={s.label}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm bg-white dark:bg-slate-800",
                s.borderColor
              )}
            >
              <div className={clsx("p-2 rounded-lg", s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {s.label}
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Expiry Filter Tabs */}
        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-3 rounded-xl shadow-sm">
          <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
            Filter :
          </span>
          <div className="flex items-center gap-1">
            {FILTER_TABS.map((f) => (
              <button
                key={f}
                onClick={() => setExpiryFilter(f)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150",
                  expiryFilter === f
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                )}
              >
                {f === "ALL" ? "All" : f === "EXPIRING_SOON" ? "Expiring" : f === "EXPIRED" ? "Expired" : "Valid"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none print:p-0">
        {/* Print Header */}
        <div className="hidden print:block text-center mb-8 border-b-2 border-slate-900 pb-5 p-6">
          <h1 className="text-2xl font-black uppercase text-slate-900">
            EXPIRY TRACKING REPORT
          </h1>
          <p className="text-sm font-bold text-slate-600 mt-1">
            Batch Shelf-Life Registry
          </p>
          <div className="text-[10px] text-slate-400 mt-2">
            Generated on {new Date().toLocaleString()} | Enterprise Audit System
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
              Loading batch registry...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <PackageCheck size={40} className="text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-400">
              No batches match the current filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto select-text">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-700/60">
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Batch Code
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Product
                  </th>
                  {isSuper && (
                    <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Branch
                    </th>
                  )}
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                    Bulk Remaining
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Produced
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Expiry Date
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {filtered.map((batch: any) => {
                  const status: ExpiryStatus = batch.expiryStatus ?? "VALID";
                  const conf = EXPIRY_CONFIG[status];
                  const expiry = getEffectiveExpiry(batch);

                  return (
                    <tr
                      key={batch.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-[13px] font-bold text-orange-600 dark:text-orange-400 font-mono">
                          {batch.batchCode
                            ? formatERPNumber(
                                "PRD",
                                batch.batchCode,
                                batch.createdAt
                              )
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {batch.product?.name ?? "—"}
                        </span>
                      </td>
                      {isSuper && (
                        <td className="px-4 sm:px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2
                              size={12}
                              className="text-slate-400 shrink-0"
                            />
                            <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                              {batch.franchise?.name ?? "—"}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 sm:px-5 py-3 text-right">
                        <span className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          {batch.bulkQuantity ?? batch.quantity}
                        </span>{" "}
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">
                          {batch.production?.recipe?.yieldUnit || "KG"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">
                          {batch.createdAt
                            ? new Date(batch.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span
                          className={clsx(
                            "text-[13px] font-bold",
                            status === "EXPIRED"
                              ? "text-rose-500"
                              : status === "EXPIRING_SOON"
                              ? "text-amber-500"
                              : "text-slate-600 dark:text-slate-400"
                          )}
                        >
                          {expiry
                            ? new Date(expiry).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-center">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider",
                            conf.bg,
                            conf.color,
                            conf.border
                          )}
                        >
                          <span
                            className={clsx(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              conf.dot,
                              status === "EXPIRING_SOON" && "animate-pulse"
                            )}
                          />
                          {conf.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 sm:px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/60">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Showing {filtered.length} of {batches.length} batches
            </p>
          </div>
        )}
      </div>

      {/* Print Signature Block */}
      <div className="hidden print:flex justify-between items-end mt-16 pt-8 border-t border-slate-300">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Verified By
          </p>
          <div className="w-48 border-b border-slate-400 mt-8" />
          <p className="text-[10px] text-slate-500 mt-1">
            Quality Assurance Officer
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Stamp & Seal
          </p>
          <div className="w-32 h-20 border border-slate-300 border-dashed rounded mt-2 flex items-center justify-center text-[10px] text-slate-300">
            AFFIX SEAL HERE
          </div>
        </div>
      </div>
    </div>
  );
}
