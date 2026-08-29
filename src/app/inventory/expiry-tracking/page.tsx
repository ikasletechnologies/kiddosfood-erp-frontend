"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  PackageCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  Building2,
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  RotateCcw,
  Search,
  X,
  ChevronDown,
  Download,
} from "lucide-react";
import { clsx } from "clsx";
import { productBatchesApi, productsFullApi, franchiseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";
import { toast } from "react-hot-toast";

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
  const [search, setSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

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

  const filtered = batches.filter((b) => {
    const statusMatch = expiryFilter === "ALL" || (b.expiryStatus ?? "VALID") === expiryFilter;
    const q = search.toLowerCase().trim();
    const searchMatch = !q ||
      b.batchCode?.toLowerCase().includes(q) ||
      b.product?.name?.toLowerCase().includes(q) ||
      b.franchise?.name?.toLowerCase().includes(q);
    return statusMatch && searchMatch;
  });

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

  const handleExportExcel = () => {
    setExportOpen(false);
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
        return [
          b.batchCode || "—",
          b.product?.name ?? "—",
          ...(isSuper ? [b.franchise?.name ?? "—"] : []),
          `${b.bulkQuantity ?? b.quantity} ${b.production?.recipe?.yieldUnit || "KG"}`,
          formatDate(b.createdAt),
          formatDate(expiry),
          EXPIRY_CONFIG[status].label,
        ];
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
    toast.success("Excel (.csv) report downloaded!");
  };

  const handleExportPDF = () => {
    setExportOpen(false);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to export as PDF");
      return;
    }

    const tableRows = filtered.map((b: any) => {
      const status: ExpiryStatus = b.expiryStatus ?? "VALID";
      const expiry = getEffectiveExpiry(b);
      return `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${b.batchCode || "—"}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${b.product?.name ?? "—"}</td>
          ${isSuper ? `<td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${b.franchise?.name ?? "—"}</td>` : ""}
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${b.bulkQuantity ?? b.quantity} ${b.production?.recipe?.yieldUnit || "KG"}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(b.createdAt)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${formatDate(expiry)}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${EXPIRY_CONFIG[status].label}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Expiry Tracking Report — ${new Date().toLocaleDateString()}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-size: 11px; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 24px; }
            h1 { font-size: 20px; font-weight: 900; margin: 0; text-transform: uppercase; }
            p { font-size: 11px; color: #64748b; margin: 4px 0 16px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; margin-top: 12px; }
            th { background-color: #f8fafc; padding: 8px; border-bottom: 2px solid #cbd5e1; font-weight: bold; text-transform: uppercase; font-size: 10px; color: #475569; }
          </style>
        </head>
        <body>
          <h1>EXPIRY TRACKING REPORT</h1>
          <p>Batch Shelf-Life Registry | Generated on ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Batch Code</th>
                <th>Product</th>
                ${isSuper ? "<th>Branch</th>" : ""}
                <th style="text-align: right;">Bulk Remaining</th>
                <th>Produced</th>
                <th>Expiry Date</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrint = () => window.print();

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0 print:bg-white print:p-0 print:m-0 print:w-full">
      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 print:hidden border-b border-slate-200 dark:border-slate-800 pb-4 sm:pb-5 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl shrink-0">
            <Clock size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              Expiry Tracking
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-0.5 truncate">
              Batch shelf-life registry, remaining bulk stock & expiration monitoring
            </p>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto min-w-0">
          {/* Product Filter */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm flex-1 sm:flex-initial min-w-[140px] max-w-full">
            <div className="flex items-center px-2 text-slate-400 shrink-0">
              <Filter size={14} />
            </div>
            <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold min-w-0 flex-1">
              <span className="text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-wider pl-0.5 select-none shrink-0">
                Product:
              </span>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-bold outline-none cursor-pointer text-xs sm:text-sm truncate w-full min-w-0"
              >
                <option value="" className="dark:bg-slate-800">All Products</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id} className="dark:bg-slate-800">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Branch Filter (Super Admin) */}
          {isSuper && (
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm flex-1 sm:flex-initial min-w-[140px] max-w-full">
              <div className="flex items-center px-2 text-slate-400 shrink-0">
                <Building2 size={14} />
              </div>
              <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold min-w-0 flex-1">
                <span className="text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-wider pl-0.5 select-none shrink-0">
                  Branch:
                </span>
                <select
                  value={selectedFranchiseId}
                  onChange={(e) => setSelectedFranchiseId(e.target.value)}
                  className="bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-bold outline-none cursor-pointer text-xs sm:text-sm truncate w-full min-w-0"
                >
                  <option value="" className="dark:bg-slate-800">All Branches</option>
                  {franchises.map((f) => (
                    <option key={f.id} value={f.id} className="dark:bg-slate-800">
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
            {/* Export Dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 text-xs font-bold shadow-sm transition-all duration-150 active:scale-95"
                title="Export Options"
              >
                <Download size={14} className="shrink-0" />
                <span className="hidden xs:inline">Export</span>
                <ChevronDown size={12} className="shrink-0 opacity-70" />
              </button>

              {exportOpen && (
                <div className="absolute right-0 z-50 mt-1.5 w-44 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden p-1 animate-in zoom-in-95 duration-150">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600 shrink-0" />
                    <span>Excel (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <FileText size={15} className="text-rose-600 shrink-0" />
                    <span>PDF Document</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handlePrint}
              title="Print Report"
              className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 shadow-sm transition-all duration-150 active:scale-95 shrink-0"
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
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95 shrink-0"
            >
              <RotateCcw
                size={16}
                className={clsx(loading && "animate-spin text-orange-500")}
              />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0 print:hidden">
        {stats.map((s) => (
          <div
            key={s.label}
            className={clsx(
              "flex items-center gap-2.5 sm:gap-3.5 p-3.5 sm:p-4 rounded-2xl border shadow-sm bg-white dark:bg-slate-800 min-w-0",
              s.borderColor
            )}
          >
            <div className={clsx("p-2 sm:p-2.5 rounded-xl shrink-0", s.bg)}>
              <s.icon size={18} className={s.color} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
                {s.label}
              </p>
              <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums leading-tight truncate mt-0.5">
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Tabs Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden w-full min-w-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] xs:min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batch code or product..."
            className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-orange-500 transition-all shadow-sm"
          />
          {search && (
            <X
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              onClick={() => setSearch("")}
            />
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-1.5 rounded-xl shadow-sm overflow-x-auto custom-scrollbar max-w-full">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-2 select-none shrink-0">
            Filter:
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {FILTER_TABS.map((f) => (
              <button
                key={f}
                onClick={() => setExpiryFilter(f)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 whitespace-nowrap shrink-0",
                  expiryFilter === f
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                )}
              >
                {f === "ALL" ? "All" : f === "EXPIRING_SOON" ? "Expiring Soon" : f === "EXPIRED" ? "Expired" : "Valid"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none print:p-0 w-full min-w-0">
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
          <div className="overflow-x-auto custom-scrollbar w-full max-w-full select-text">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-700/60">
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Batch Code
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Product
                  </th>
                  {isSuper && (
                    <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      Branch
                    </th>
                  )}
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">
                    Bulk Remaining
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Produced
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Expiry Date
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">
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
                      <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                        <span className="text-[13px] font-bold text-orange-600 dark:text-orange-400 font-mono">
                          {batch.batchCode || "—"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                        <span className="text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {batch.product?.name ?? "—"}
                        </span>
                      </td>
                      {isSuper && (
                        <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
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
                      <td className="px-4 sm:px-5 py-3 text-right whitespace-nowrap">
                        <span className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          {batch.bulkQuantity ?? batch.quantity}
                        </span>{" "}
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">
                          {batch.production?.recipe?.yieldUnit || "KG"}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                        <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">
                          {formatDate(batch.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
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
                          {formatDate(expiry)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-center whitespace-nowrap">
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
