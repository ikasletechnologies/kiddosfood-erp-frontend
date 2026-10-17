"use client";

// Inventory > Expiry Tracking — lot-wise expiry in two tabs:
//   Finished Goods: packaged finished-goods lots (+ unpackaged bulk, flagged)
//   Raw Materials:  raw-material purchase lots (the Stock Hub's GRN lots)
// Quantities are each lot's live stock; status follows the same expiry rule
// Production and Sales enforce. Read-only — nothing here changes stock.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  Eye,
  Boxes,
  Wheat,
  Warehouse,
} from "lucide-react";
import { clsx } from "clsx";
import { expiryTrackingApi, franchiseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { toast } from "react-hot-toast";

type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";
type View = "FINISHED" | "RAW";

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

const FILTER_TABS = ["ALL", "VALID", "EXPIRING_SOON", "EXPIRED"] as const;
const VIEWS: Array<{ id: View; param: string; label: string; icon: any; noun: string }> = [
  { id: "FINISHED", param: "finished", label: "Finished Goods", icon: Boxes, noun: "finished goods lots" },
  { id: "RAW", param: "raw", label: "Raw Materials", icon: Wheat, noun: "raw material lots" },
];

type Filters = { productId: string; warehouseId: string; search: string; status: string; includeZero: boolean };
const EMPTY: Filters = { productId: "", warehouseId: "", search: "", status: "ALL", includeZero: false };
type Data = {
  rows: any[];
  summary: { total: number; valid: number; expiringSoon: number; expired: number };
  products: Array<{ id: string; name: string; sku?: string }>;
  warehouses: Array<{ id: string; name: string }>;
  expiringSoonDays: number;
};

const qty = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const daysLabel = (d: number | null | undefined) =>
  d == null ? "" : d < 0 ? `${-d} day${d === -1 ? "" : "s"} ago` : d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`;
const location = (r: any) => [r.warehouse?.name, r.branch].filter(Boolean).join(" · ") || "—";
const esc = (v: any) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Export/print columns for the active tab only. */
function exportColumns(view: View): Array<[string, (r: any) => string]> {
  const status = (r: any) => EXPIRY_CONFIG[r.expiryStatus as ExpiryStatus]?.label ?? r.expiryStatus;
  if (view === "RAW") {
    return [
      ["Raw Material", (r) => r.name],
      ["SKU", (r) => r.sku || "—"],
      ["Purchase Lot", (r) => r.lotNumber || "—"],
      ["Bill No.", (r) => r.billNumber || "—"],
      ["Supplier", (r) => r.supplier || "—"],
      ["Received", (r) => formatDate(r.receivedDate)],
      ["Expiry Date", (r) => formatDate(r.expiryDate)],
      ["Available", (r) => qty(r.availableQty)],
      ["Unit", (r) => String(r.unit || "").toUpperCase()],
      ["Warehouse / Branch", location],
      ["Status", status],
    ];
  }
  return [
    ["Product", (r) => r.name],
    ["SKU", (r) => r.sku || "—"],
    ["Type", (r) => (r.recordType === "BULK" ? "Unpackaged bulk" : "Finished lot")],
    ["Lot", (r) => r.lotNumber || "—"],
    ["Production Batch", (r) => r.productionBatch || "—"],
    ["Production Date", (r) => formatDate(r.productionDate)],
    ["Packaging Date", (r) => (r.packagingDate ? formatDate(r.packagingDate) : "—")],
    ["Expiry Date", (r) => formatDate(r.expiryDate)],
    ["Available", (r) => qty(r.availableQty)],
    ["Unit", (r) => (r.recordType === "BULK" ? String(r.unit || "").toUpperCase() : "Packets")],
    ["Pack Size", (r) => r.packSize || "—"],
    ["Warehouse / Branch", location],
    ["Status", status],
  ];
}

function ExpiryTrackingPage() {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view: View = params.get("tab") === "raw" ? "RAW" : "FINISHED";
  const meta = VIEWS.find((v) => v.id === view)!;

  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  // Each tab keeps its own filters; switching tabs never carries a product or warehouse across.
  const [filtersByView, setFiltersByView] = useState<Record<View, Filters>>({ FINISHED: EMPTY, RAW: EMPTY });
  const filters = filtersByView[view];
  const [search, setSearch] = useState(filters.search);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<any | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFiltersByView((all) => ({ ...all, [view]: { ...all[view], [k]: v } }));

  const switchView = (next: View) => {
    if (next === view) return;
    const p = new URLSearchParams(params.toString());
    p.set("tab", VIEWS.find((v) => v.id === next)!.param);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    setData(null);
  };

  useEffect(() => { setSearch(filtersByView[view].search); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => { if (search !== filters.search) setFilter("search", search); }, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
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

  const fetchLots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expiryTrackingApi.list({
        view,
        franchiseId: selectedFranchiseId || undefined,
        productId: filters.productId || undefined,
        warehouseId: filters.warehouseId || undefined,
        search: filters.search || undefined,
        status: filters.status !== "ALL" ? filters.status : undefined,
        includeZero: filters.includeZero || undefined,
      });
      setData(res.data);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.error || "Failed to load expiry data");
    } finally {
      setLoading(false);
    }
  }, [view, selectedFranchiseId, filters]);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  // A different branch has different products and warehouses.
  const changeBranch = (id: string) => {
    setSelectedFranchiseId(id);
    setFiltersByView((all) => ({
      FINISHED: { ...all.FINISHED, productId: "", warehouseId: "" },
      RAW: { ...all.RAW, productId: "", warehouseId: "" },
    }));
  };

  const rows = data?.rows ?? [];
  const summary = data?.summary ?? { total: 0, valid: 0, expiringSoon: 0, expired: 0 };
  const stats = [
    { label: "Total Lots", value: summary.total, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/20", borderColor: "border-indigo-200 dark:border-indigo-900/30", status: "ALL" },
    { label: "Valid", value: summary.valid, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20", borderColor: "border-emerald-200 dark:border-emerald-900/30", status: "VALID" },
    { label: "Expiring Soon", value: summary.expiringSoon, icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", borderColor: "border-amber-200 dark:border-amber-900/30", status: "EXPIRING_SOON" },
    { label: "Expired", value: summary.expired, icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/20", borderColor: "border-rose-200 dark:border-rose-900/30", status: "EXPIRED" },
  ];
  const branchName = selectedFranchiseId ? franchises.find((f) => f.id === selectedFranchiseId)?.name : null;
  const reportTitle = `EXPIRY TRACKING — ${meta.label.toUpperCase()}`;
  const reportScope = [
    filters.includeZero ? "Including zero-stock history" : "Available stock only",
    filters.status !== "ALL" ? EXPIRY_CONFIG[filters.status as ExpiryStatus].label : null,
    branchName,
  ].filter(Boolean).join(" · ");

  const handleExportExcel = () => {
    setExportOpen(false);
    const cols = exportColumns(view);
    const lines = [
      [reportTitle],
      [reportScope],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      cols.map(([h]) => h),
      ...rows.map((r) => cols.map(([, f]) => f(r))),
    ];
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Expiry_Tracking_${view === "RAW" ? "Raw_Materials" : "Finished_Goods"}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Excel (.csv) report downloaded!");
  };

  const handleExportPDF = () => {
    setExportOpen(false);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to export as PDF");
      return;
    }
    const cols = exportColumns(view);
    const cell = "padding: 6px 8px; border-bottom: 1px solid #e2e8f0;";
    const body = rows
      .map((r) => `<tr>${cols.map(([, f]) => `<td style="${cell}">${esc(f(r))}</td>`).join("")}</tr>`)
      .join("");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${esc(reportTitle)} — ${new Date().toLocaleDateString()}</title>
          <style>
            @media print { body { margin: 0; padding: 20px; font-size: 10px; } }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 24px; }
            h1 { font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase; }
            p { font-size: 11px; color: #64748b; margin: 4px 0 16px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; text-align: left; margin-top: 12px; }
            th { background-color: #f8fafc; padding: 8px; border-bottom: 2px solid #cbd5e1; font-weight: bold; text-transform: uppercase; font-size: 9px; color: #475569; }
          </style>
        </head>
        <body>
          <h1>${esc(reportTitle)}</h1>
          <p>${esc(reportScope)} | Total ${summary.total} · Valid ${summary.valid} · Expiring soon ${summary.expiringSoon} · Expired ${summary.expired} | Generated on ${new Date().toLocaleString()}</p>
          <table>
            <thead><tr>${cols.map(([h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
            <tbody>${body}</tbody>
          </table>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrint = () => window.print();

  const th = "px-3 sm:px-4 py-3 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap";
  const td = "px-3 sm:px-4 py-3 whitespace-nowrap";
  const selectBox = "flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm flex-1 sm:flex-initial min-w-[140px] max-w-full sm:max-w-[230px]";
  const selectInput = "bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-bold outline-none cursor-pointer text-xs sm:text-sm truncate w-full min-w-0";

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0 print:bg-white print:p-0 print:m-0 print:w-full">
      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4 print:hidden border-b border-slate-200 dark:border-slate-800 pb-4 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl shrink-0">
            <Clock size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              Expiry Tracking
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-0.5 truncate">
              Lot-wise shelf life of finished goods and raw material purchase lots
            </p>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto min-w-0">
          {/* Product / Material Filter */}
          <div className={selectBox}>
            <div className="flex items-center px-2 text-slate-400 shrink-0">
              <Filter size={14} />
            </div>
            <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold min-w-0 flex-1">
              <span className="text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-wider pl-0.5 select-none shrink-0">
                {view === "RAW" ? "Material:" : "Product:"}
              </span>
              <select value={filters.productId} onChange={(e) => setFilter("productId", e.target.value)} className={selectInput}>
                <option value="" className="dark:bg-slate-800">{view === "RAW" ? "All Materials" : "All Products"}</option>
                {(data?.products ?? []).map((p) => (
                  <option key={p.id} value={p.id} className="dark:bg-slate-800">{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Warehouse Filter */}
          <div className={selectBox}>
            <div className="flex items-center px-2 text-slate-400 shrink-0">
              <Warehouse size={14} />
            </div>
            <select value={filters.warehouseId} onChange={(e) => setFilter("warehouseId", e.target.value)} className={selectInput}>
              <option value="" className="dark:bg-slate-800">All Warehouses</option>
              {(data?.warehouses ?? []).map((w) => (
                <option key={w.id} value={w.id} className="dark:bg-slate-800">{w.name}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter (Super Admin) */}
          {isSuper && (
            <div className={selectBox}>
              <div className="flex items-center px-2 text-slate-400 shrink-0">
                <Building2 size={14} />
              </div>
              <select value={selectedFranchiseId} onChange={(e) => changeBranch(e.target.value)} className={selectInput}>
                <option value="" className="dark:bg-slate-800">All Branches</option>
                {franchises.map((f) => (
                  <option key={f.id} value={f.id} className="dark:bg-slate-800">{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportOpen(!exportOpen)}
                disabled={!rows.length}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 text-xs font-bold shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-50"
                title={`Export ${meta.label}`}
              >
                <Download size={14} className="shrink-0" />
                <span className="hidden xs:inline">Export</span>
                <ChevronDown size={12} className="shrink-0 opacity-70" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 z-50 mt-1.5 w-44 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden p-1 animate-in zoom-in-95 duration-150">
                  <button type="button" onClick={handleExportExcel} className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                    <FileSpreadsheet size={15} className="text-emerald-600 shrink-0" />
                    <span>Excel (.csv)</span>
                  </button>
                  <button type="button" onClick={handleExportPDF} className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                    <FileText size={15} className="text-rose-600 shrink-0" />
                    <span>PDF Document</span>
                  </button>
                </div>
              )}
            </div>
            <button onClick={handlePrint} title="Print Report" className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 shadow-sm transition-all duration-150 active:scale-95 shrink-0">
              <Printer size={16} />
            </button>
            <button onClick={fetchLots} title="Refresh Data" className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95 shrink-0">
              <RotateCcw size={16} className={clsx(loading && "animate-spin text-orange-500")} />
            </button>
          </div>
        </div>
      </div>

      {/* Finished Goods | Raw Materials */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 print:hidden overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => switchView(v.id)}
            className={clsx(
              "inline-flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 text-sm font-bold whitespace-nowrap transition-colors",
              view === v.id
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <v.icon size={16} />
            {v.label}
          </button>
        ))}
      </div>

      {/* KPI Cards Grid — counts for the active tab and filters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0 print:hidden">
        {stats.map((s) => (
          <button
            type="button"
            key={s.label}
            onClick={() => setFilter("status", s.status)}
            className={clsx(
              "flex items-center gap-2.5 sm:gap-3.5 p-3.5 sm:p-4 rounded-2xl border shadow-sm bg-white dark:bg-slate-800 min-w-0 text-left transition-shadow",
              s.borderColor,
              filters.status === s.status && "ring-2 ring-orange-400/60"
            )}
          >
            <div className={clsx("p-2 sm:p-2.5 rounded-xl shrink-0", s.bg)}>
              <s.icon size={18} className={s.color} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{s.label}</p>
              <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums leading-tight truncate mt-0.5">
                {loading && !data ? "—" : s.value}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Search, stock scope & status filter */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 print:hidden w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 flex-1">
          <div className="relative flex-1 min-w-[160px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view === "RAW" ? "Search material, SKU, lot or supplier..." : "Search product, SKU or lot..."}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-orange-500 transition-all shadow-sm"
            />
            {search && (
              <X size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" onClick={() => setSearch("")} />
            )}
          </div>
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-1 rounded-xl shadow-sm shrink-0 self-start sm:self-auto">
            {([
              [false, "Available stock only"],
              [true, "Include zero-stock history"],
            ] as Array<[boolean, string]>).map(([val, label]) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setFilter("includeZero", val)}
                className={clsx(
                  "px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all",
                  filters.includeZero === val ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-1.5 rounded-xl shadow-sm overflow-x-auto custom-scrollbar max-w-full">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-2 select-none shrink-0">Filter:</span>
          <div className="flex items-center gap-1 shrink-0">
            {FILTER_TABS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter("status", f)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 whitespace-nowrap shrink-0",
                  filters.status === f ? "bg-orange-500 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                )}
              >
                {f === "ALL" ? "All" : EXPIRY_CONFIG[f].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none print:p-0 w-full min-w-0">
        {/* Print Header */}
        <div className="hidden print:block text-center mb-6 border-b-2 border-slate-900 pb-4 p-6">
          <h1 className="text-2xl font-black uppercase text-slate-900">{reportTitle}</h1>
          <p className="text-sm font-bold text-slate-600 mt-1">{reportScope}</p>
          <p className="text-xs text-slate-500 mt-1">
            Total {summary.total} · Valid {summary.valid} · Expiring soon {summary.expiringSoon} · Expired {summary.expired}
          </p>
          <div className="text-[10px] text-slate-400 mt-2">Generated on {new Date().toLocaleString()}</div>
        </div>

        {loading && !data ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">Loading {meta.noun}...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <PackageCheck size={40} className="text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-400">No {meta.noun} match the current filter.</p>
            {!filters.includeZero && (
              <button type="button" onClick={() => setFilter("includeZero", true)} className="text-xs font-bold text-orange-600 hover:underline">
                Include zero-stock history
              </button>
            )}
          </div>
        ) : (
          <div className={clsx("overflow-x-auto custom-scrollbar w-full max-w-full select-text", loading && "opacity-60")}>
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-700/60">
                  {view === "RAW" ? (
                    <>
                      <th className={th}>Raw Material</th>
                      <th className={th}>Purchase Lot</th>
                      <th className={th}>Supplier</th>
                      <th className={th}>Received</th>
                    </>
                  ) : (
                    <>
                      <th className={th}>Product</th>
                      <th className={th}>Lot / Batch</th>
                      <th className={th}>Produced</th>
                      <th className={th}>Packed</th>
                    </>
                  )}
                  <th className={th}>Expiry Date</th>
                  <th className={clsx(th, "text-right")}>Available</th>
                  {view === "FINISHED" && <th className={th}>Pack Size</th>}
                  <th className={th}>Warehouse / Branch</th>
                  <th className={clsx(th, "text-center")}>Status</th>
                  <th className={clsx(th, "print:hidden")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {rows.map((r: any) => {
                  const status: ExpiryStatus = r.expiryStatus ?? "VALID";
                  const conf = EXPIRY_CONFIG[status];
                  const bulk = r.recordType === "BULK";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className={clsx(td, "max-w-[240px]")}>
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate" title={r.name}>{r.name}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">
                          {r.sku || "—"}
                          {bulk && <span className="ml-1.5 font-sans font-bold text-violet-600 dark:text-violet-400 uppercase">· Unpackaged bulk</span>}
                        </p>
                      </td>
                      {view === "RAW" ? (
                        <>
                          <td className={td}>
                            <p className="text-[13px] font-bold text-orange-600 dark:text-orange-400 font-mono">{r.lotNumber || "—"}</p>
                            {r.billNumber && <p className="text-[10px] text-slate-400 font-mono">{r.billNumber}</p>}
                          </td>
                          <td className={clsx(td, "text-[13px] font-semibold text-slate-600 dark:text-slate-300")}>{r.supplier || "—"}</td>
                          <td className={clsx(td, "text-[13px] font-semibold text-slate-600 dark:text-slate-400")}>{formatDate(r.receivedDate)}</td>
                        </>
                      ) : (
                        <>
                          <td className={td}>
                            <p className="text-[13px] font-bold text-orange-600 dark:text-orange-400 font-mono">{r.lotNumber || "—"}</p>
                            {r.productionBatch && r.productionBatch !== r.lotNumber && <p className="text-[10px] text-slate-400 font-mono">{r.productionBatch}</p>}
                          </td>
                          <td className={clsx(td, "text-[13px] font-semibold text-slate-600 dark:text-slate-400")}>{formatDate(r.productionDate)}</td>
                          <td className={clsx(td, "text-[13px] font-semibold text-slate-600 dark:text-slate-400")}>{r.packagingDate ? formatDate(r.packagingDate) : "—"}</td>
                        </>
                      )}
                      <td className={td}>
                        <p className={clsx("text-[13px] font-bold", status === "EXPIRED" ? "text-rose-500" : status === "EXPIRING_SOON" ? "text-amber-500" : "text-slate-600 dark:text-slate-400")}>
                          {formatDate(r.expiryDate)}
                        </p>
                        <p className="text-[10px] text-slate-400">{status === "EXPIRED" ? `expired ${daysLabel(r.daysLeft)}` : `expires ${daysLabel(r.daysLeft)}`}</p>
                      </td>
                      <td className={clsx(td, "text-right")}>
                        <span className={clsx("text-[13px] sm:text-sm font-bold tabular-nums", r.availableQty > 0 ? "text-slate-900 dark:text-white" : "text-slate-400")}>{qty(r.availableQty)}</span>{" "}
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">{view === "FINISHED" && !bulk ? "pkts" : r.unit}</span>
                      </td>
                      {view === "FINISHED" && <td className={clsx(td, "text-[13px] font-semibold text-slate-600 dark:text-slate-300")}>{r.packSize || "—"}</td>}
                      <td className={clsx(td, "text-[13px] font-semibold text-slate-600 dark:text-slate-300")}>
                        <p className="truncate max-w-[180px]">{r.warehouse?.name || "—"}</p>
                        <p className="text-[10px] text-slate-400">{r.branch}</p>
                      </td>
                      <td className={clsx(td, "text-center")}>
                        <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider", conf.bg, conf.color, conf.border)}>
                          <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", conf.dot, status === "EXPIRING_SOON" && "animate-pulse")} />
                          {conf.label}
                        </span>
                        {status === "EXPIRED" && r.availableQty > 0 && (
                          <p className="text-[10px] font-semibold text-rose-500 mt-1">Blocked for {view === "RAW" ? "production" : "sale"}</p>
                        )}
                      </td>
                      <td className={clsx(td, "text-right print:hidden")}>
                        <button type="button" onClick={() => setViewing(r)} title="View details" className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-white/5">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="px-4 sm:px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/60 print:hidden">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Showing {rows.length} of {summary.total} {meta.noun}
              {data?.expiringSoonDays ? ` · Expiring soon = within ${data.expiringSoonDays} days` : ""}
            </p>
          </div>
        )}
      </div>

      {/* Print Signature Block */}
      <div className="hidden print:flex justify-between items-end mt-16 pt-8 border-t border-slate-300">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">Verified By</p>
          <div className="w-48 border-b border-slate-400 mt-8" />
          <p className="text-[10px] text-slate-500 mt-1">Quality Assurance Officer</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">Stamp & Seal</p>
          <div className="w-32 h-20 border border-slate-300 border-dashed rounded mt-2 flex items-center justify-center text-[10px] text-slate-300">AFFIX SEAL HERE</div>
        </div>
      </div>

      {viewing && <LotDetails lot={viewing} view={view} onClose={() => setViewing(null)} />}
    </div>
  );
}

function LotDetails({ lot, view, onClose }: { lot: any; view: View; onClose: () => void }) {
  const status: ExpiryStatus = lot.expiryStatus ?? "VALID";
  const conf = EXPIRY_CONFIG[status];
  const bulk = lot.recordType === "BULK";
  const unit = view === "FINISHED" && !bulk ? "packets" : String(lot.unit || "").toUpperCase();
  const expiry = `${formatDate(lot.expiryDate)} (${status === "EXPIRED" ? "expired" : "expires"} ${daysLabel(lot.daysLeft)})`;
  const fields: Array<[string, string]> =
    view === "RAW"
      ? [
          ["Raw material", lot.name],
          ["SKU", lot.sku || "—"],
          ["Purchase lot", lot.lotNumber || "—"],
          ["Bill no.", lot.billNumber || "—"],
          ["Supplier", lot.supplier || "—"],
          ["Received", formatDate(lot.receivedDate)],
          ["Manufactured", lot.mfgDate ? formatDate(lot.mfgDate) : "—"],
          ["Expiry date", expiry],
          ["Received qty", `${qty(lot.initialQty)} ${unit}`],
          ["Available qty", `${qty(lot.availableQty)} ${unit}`],
          ["Warehouse", lot.warehouse?.name || "—"],
          ["Branch", lot.branch],
          ["Stock state", String(lot.stockState || "—").replace(/_/g, " ")],
        ]
      : [
          ["Product", lot.name],
          ["SKU", lot.sku || "—"],
          ["Record type", bulk ? "Unpackaged bulk (not yet packed)" : "Finished goods lot"],
          ["Lot", lot.lotNumber || "—"],
          ["Production batch", lot.productionBatch || "—"],
          ["Production date", formatDate(lot.productionDate)],
          ["Packaging date", lot.packagingDate ? formatDate(lot.packagingDate) : "—"],
          ["Pack size", lot.packSize || "—"],
          ["Expiry date", expiry],
          [bulk ? "Produced qty" : "Packed qty", `${qty(lot.initialQty)} ${unit}`],
          ["Available qty", `${qty(lot.availableQty)} ${unit}`],
          ["Warehouse", lot.warehouse?.name || "—"],
          ["Branch", lot.branch],
          ["Stock state", String(lot.stockState || "—").replace(/_/g, " ")],
        ];
  return (
    <Modal isOpen onClose={onClose} title={`Lot ${lot.lotNumber || ""}`} size="md">
      <div className="space-y-4">
        <div className={clsx("flex items-center justify-between gap-3 px-3 py-2 rounded-xl border", conf.bg, conf.border)}>
          <span className={clsx("text-xs font-bold uppercase tracking-wider", conf.color)}>{conf.label}</span>
          {status === "EXPIRED" && lot.availableQty > 0 && (
            <span className="text-[11px] font-semibold text-rose-600">Blocked for new {view === "RAW" ? "production" : "sales"}</span>
          )}
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {fields.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</dt>
              <dd className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  );
}

export default function ExpiryTrackingRoute() {
  return (
    <Suspense fallback={null}>
      <ExpiryTrackingPage />
    </Suspense>
  );
}
