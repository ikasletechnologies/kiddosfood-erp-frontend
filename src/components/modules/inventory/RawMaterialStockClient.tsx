"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Layers, Plus, Search, AlertTriangle, CheckCircle2,
  RefreshCw, Trash2, X,
  Edit2, Lock,
  Calculator, Package, BarChart3, Database,
  Download, Flame, Wrench, Recycle, Upload, Loader2, UploadCloud, Maximize2
} from "lucide-react";
import { clsx } from "clsx";
import { rawMaterialsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Modal } from "@/components/ui/Modal";
import MinimizedImportWidget from "./MinimizedImportWidget";
import { toast } from "react-hot-toast";

const WEIGHT_VOLUME_UNITS = new Set(['KG', 'G', 'GM', 'KGS', 'L', 'LTR', 'LITER', 'LITRE', 'ML']);

const getMeasurementType = (unit: string): "weight" | "volume" | "piece" => {
  const u = unit.toUpperCase();
  if (['KG', 'G', 'GM', 'KGS'].includes(u)) return "weight";
  if (['L', 'LTR', 'LITER', 'LITRE', 'ML'].includes(u)) return "volume";
  return "piece";
};



const formatStock = (stock: number, unit: string, sku: string, category?: string) => {
  // Raw materials: tracked directly in weight/volume units (KG, G, L, ML)
  if (!sku || category !== 'FINISHED_GOOD') {
    const upperUnit = unit.toUpperCase();
    const displayUnit = WEIGHT_VOLUME_UNITS.has(upperUnit)
      ? upperUnit
      : (upperUnit.endsWith('S') ? upperUnit : `${upperUnit}s`);

    if ((upperUnit === 'G' || upperUnit === 'GM') && stock >= 1000) {
      return { qty: stock.toFixed(0), unit: displayUnit, total: `${(stock / 1000).toFixed(2)} KG` };
    }
    if (upperUnit === 'ML' && stock >= 1000) {
      return { qty: stock.toFixed(0), unit: displayUnit, total: `${(stock / 1000).toFixed(2)} L` };
    }
    return { qty: stock.toFixed(2), unit: displayUnit };
  }

  // Finished goods: tracked as unit count (1, 2, 3...), show weight as secondary info
  const countStr = Number.isInteger(stock) ? `${stock}` : stock.toFixed(1);
  const parts = sku.split('-');
  const sizePart = parts.length >= 2 ? parts[parts.length - 1] : "";
  const match = sizePart.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+)$/i);
  if (!match) return { qty: countStr, unit: "Units" };

  const weightVal = parseFloat(match[1]);
  const weightUnit = match[2].toUpperCase();
  const totalVal = stock * weightVal;

  let totalStr = "";
  if (weightUnit === "G" || weightUnit === "GM") {
    totalStr = totalVal >= 1000 ? `${(totalVal / 1000).toFixed(2)} KG` : `${totalVal.toFixed(0)} G`;
  } else if (weightUnit === "ML") {
    totalStr = totalVal >= 1000 ? `${(totalVal / 1000).toFixed(2)} L` : `${totalVal.toFixed(0)} ML`;
  } else {
    totalStr = `${totalVal % 1 === 0 ? totalVal.toFixed(0) : totalVal.toFixed(2)} ${weightUnit}`;
  }

  return { qty: countStr, unit: "Units", total: totalStr };
};

const getStockInPhysicalUnit = (stock: number, sku: string, category?: string): number => {
  // Finished goods minimumStock is stored in units — compare directly
  if (!sku || category !== 'FINISHED_GOOD') return stock;
  return stock;
};

const formatMinStock = (minStockVal: number, unit: string, sku: string, category?: string): string => {
  // Raw materials: show in weight/volume unit
  if (category !== 'FINISHED_GOOD' || !sku) {
    const upperUnit = unit.toUpperCase();
    const displayUnit = WEIGHT_VOLUME_UNITS.has(upperUnit)
      ? upperUnit
      : (upperUnit.endsWith('S') ? upperUnit : `${upperUnit}s`);
    return `${minStockVal} ${displayUnit}`;
  }
  return `${minStockVal} Units`;
};

const isFinishedGood = (item: any) => {
  const cat = (item?.category || "").toUpperCase();
  const sku = (item?.sku || "").toUpperCase();
  return (
    cat === "FINISHED_GOOD" ||
    cat === "FINISHED_PRODUCT" ||
    cat === "FINISHED" ||
    cat.includes("FINISHED") ||
    sku.startsWith("FG-")
  );
};

export default function RawMaterialStockClient() {
  const router = useRouter();
  const { user } = useAuth();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stockStatusFilter, setStockStatusFilter] = useState("ALL");
  const [showInactive, setShowInactive] = useState(false);

  // Edit / Action states
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openEditPage = (item: any) => {
    router.push(`/inventory/stock/edit?id=${item.id}`);
  };

  // Excel Bulk Import
  const importFileRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImportMinimized, setIsImportMinimized] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ name: string; unit: string; error?: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; percent: number }>({ current: 0, total: 0, percent: 0 });
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rawMaterialsApi.getAll(showInactive, user?.franchiseId, "FINISHED_GOOD");
      const rawList = (res.data ?? []).filter((item: any) => !isFinishedGood(item));
      setItems(rawList);
    } catch (e) {
      console.error("Failed to fetch inventory:", e);
    } finally {
      setLoading(false);
    }
  }, [showInactive, user?.franchiseId]);

  useEffect(() => { fetchItems(); }, [fetchItems, showInactive]);

  // -- Excel Import --

  const IMPORT_TEMPLATE_HEADERS = ["Name", "Unit"];

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      IMPORT_TEMPLATE_HEADERS,
      ["Basmati Rice", "kg"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Raw Materials");
    XLSX.writeFile(wb, "raw_material_import_template.xlsx");
  };

  const pickField = (row: Record<string, any>, ...keys: string[]) => {
    for (const key of Object.keys(row)) {
      if (keys.some(k => k.toLowerCase() === key.trim().toLowerCase())) {
        const val = row[key];
        return val === undefined || val === null ? "" : String(val).trim();
      }
    }
    return "";
  };

  const normalizeUnit = (raw: string) => raw ? raw.trim().toLowerCase() : "kg";

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      if (rows.length === 0) {
        toast.error("No rows found in the file");
        return;
      }

      const parsed = rows.map(row => {
        const name = pickField(row, "name", "item name", "material name");
        const rowData = {
          name,
          unit: normalizeUnit(pickField(row, "unit")),
        };
        let error: string | undefined;
        if (!rowData.name) error = "Missing name";
        return { ...rowData, error };
      });

      setImportRows(parsed);
      setImportResult(null);
      setShowImportModal(true);
    } catch (err) {
      console.error(err);
      toast.error("Could not read that file — expected .xlsx or .csv");
    }
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter(r => !r.error);
    if (validRows.length === 0) return;

    setImporting(true);
    const total = validRows.length;
    setImportProgress({ current: 0, total, percent: 0 });

    let success = 0, failed = 0;
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await rawMaterialsApi.create({
          name: row.name,
          category: "RAW_MATERIAL",
          unit: row.unit,
        });
        success++;
      } catch {
        failed++;
      }
      const current = i + 1;
      const percent = Math.round((current / total) * 100);
      setImportProgress({ current, total, percent });
    }
    setImporting(false);
    setImportResult({ success, failed });
    fetchItems();
  };

  const getStockStatus = (stock: number, threshold: number) => {
    const s = stock || 0;
    const t = threshold || 0;
    if (s <= 0) return { label: "CRITICAL", color: "text-red-600 bg-red-50 dark:bg-red-500/10" };
    if (s < t) return { label: "LOW STOCK", color: "text-orange-600 bg-orange-50 dark:bg-orange-500/10" };
    if (s === t) return { label: "REORDER", color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" };
    return { label: "SAFE", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" };
  };  const totalValue = items.reduce((acc, i) => acc + ((i.currentStock || 0) * (i.costPrice || 0)), 0);
  const rawMaterialsCount = items.filter(i => {
    const cat = (i.category || "").toUpperCase();
    return cat.includes("RAW") || (!cat.includes("PACKAG") && !cat.includes("SEMI") && !cat.includes("ASSET"));
  }).length;
  const packagingAssetsCount = items.length - rawMaterialsCount;
  const lowStockCount = items.filter(i => (i.currentStock || 0) <= (i.minimumStock || 0)).length;

  const filteredItems = items.filter(i => {
    if (categoryFilter !== "ALL") {
      const cat = (i.category || "").toUpperCase();
      if (categoryFilter === "RAW_MATERIAL" && !cat.includes("RAW")) return false;
      if (categoryFilter === "PACKAGING" && !cat.includes("PACKAG")) return false;
      if (categoryFilter === "SEMI_FINISHED" && !cat.includes("SEMI")) return false;
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      const matchName = i.name?.toLowerCase().includes(q);
      const matchSku = i.sku?.toLowerCase().includes(q);
      const matchCat = i.category?.toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchCat) return false;
    }
    return true;
  });

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500 p-3 sm:p-4 md:p-8 w-full min-w-0">

      {/* No big header here since Stock Hub has its own page header */}
      <div className="flex flex-wrap justify-end gap-2 sm:gap-3">
        <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFileSelect} />
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-3.5 sm:px-4 py-2 border border-gray-250 hover:bg-gray-50 rounded-xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
        >
          <Upload size={14} /> Bulk Import (Excel)
        </button>
        <button onClick={fetchItems} className="p-2 border border-gray-250 hover:bg-gray-50 rounded-xl text-slate-500 transition-colors">
          <RefreshCw size={16} className={clsx("text-slate-400", loading && "animate-spin")} />
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 w-full min-w-0">
        {[
          { label: "Inventory Valuation", value: `₹${(totalValue / 1000).toFixed(1)}K`, sub: "Live Asset Value", icon: Calculator, color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "Raw Materials", value: rawMaterialsCount, sub: "Production Inputs", icon: Layers, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Packaging & Assets", value: packagingAssetsCount, sub: "Packaging & Supplies", icon: Package, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Low Stock Alerts", value: lowStockCount, sub: "Reorder Required", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-white/10 transition-all duration-200 flex items-center justify-between min-w-0">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">{stat.value}</h3>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">{stat.sub}</p>
            </div>
            <div className={clsx("p-3 sm:p-3.5 rounded-xl shrink-0 flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon size={18} className="stroke-[2px] sm:w-5 sm:h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Critical Stock Alerts List */}
      <div className="bg-white dark:bg-card border border-slate-200 dark:border-slate-850 rounded-2xl shadow-sm overflow-hidden p-4 sm:p-6 w-full min-w-0">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="text-red-500" size={18} />
          Critical & Low Stock Alerts
        </h3>
        {items.filter(i => (i.currentStock || 0) <= (i.minimumStock || 0)).length === 0 ? (
          <p className="text-xs sm:text-sm text-slate-500">All raw materials are currently adequately stocked.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
            {items
              .filter(i => (i.currentStock || 0) <= (i.minimumStock || 0))
              .slice(0, 12)
              .map(item => {
                const status = getStockStatus(item.currentStock || 0, item.minimumStock);
                return (
                  <div key={item.id} className="p-3.5 sm:p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex flex-col gap-2 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">{item.name}</span>
                      <span className={clsx("text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", status.color)}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Available: <strong className="text-slate-700 dark:text-slate-300">{(item.currentStock || 0).toFixed(2)} {item.unit}</strong></span>
                      <span>Min: {item.minimumStock} {item.unit}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* All Raw Materials */}
      <div className="bg-white dark:bg-card border border-slate-200 dark:border-slate-850 rounded-2xl shadow-sm overflow-hidden w-full min-w-0">
        <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 dark:border-white/5">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="text-blue-500" size={18} />
            All Raw Materials & Assets
            <span className="text-xs font-semibold text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-full">{filteredItems.length}</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-850 rounded-xl w-full sm:w-64">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by name or SKU..."
                className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 outline-none w-full placeholder:text-slate-400"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-[#f58220]"
            >
              <option value="ALL">All Categories</option>
              <option value="RAW_MATERIAL">Raw Materials</option>
              <option value="PACKAGING">Packaging</option>
              <option value="SEMI_FINISHED">Semi-Finished / Other</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 whitespace-nowrap cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
              Show Inactive
            </label>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
          <table className="w-full text-left min-w-[650px]">
            <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 text-[11px] sm:text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
              <tr>
                <th className="px-4 sm:px-6 py-3.5">Item</th>
                <th className="px-4 sm:px-6 py-3.5">Category</th>
                <th className="px-4 sm:px-6 py-3.5 text-center">Stock</th>
                <th className="px-4 sm:px-6 py-3.5 text-center">Min Stock</th>
                <th className="px-4 sm:px-6 py-3.5 text-center">Status</th>
                <th className="px-4 sm:px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-semibold">Loading raw materials…</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-semibold">No raw materials found.</td></tr>
              ) : (
                filteredItems.map(item => {
                  const status = getStockStatus(item.currentStock || 0, item.minimumStock);
                  return (
                    <tr key={item.id} className={clsx("hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all", item.isActive === false && "opacity-50")}>
                      <td className="px-6 py-3">
                        <p className="font-semibold text-slate-800 dark:text-white">{item.name}</p>
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">SKU: {item.sku || "N/A"}</p>
                      </td>
                      <td className="px-6 py-3 text-slate-500">{(item.category || "").replace(/_/g, " ")}</td>
                      <td className="px-6 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {(item.currentStock || 0).toFixed(2)} {item.unit}
                      </td>
                      <td className="px-6 py-3 text-center text-slate-500">{item.minimumStock} {item.unit}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", status.color)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => openEditPage(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-600 dark:text-slate-300 font-semibold transition-colors"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Import from Excel */}
      <Modal
        isOpen={showImportModal && !isImportMinimized}
        onClose={() => { setShowImportModal(false); setIsImportMinimized(false); setImportRows([]); setImportResult(null); }}
        onMinimize={() => setIsImportMinimized(true)}
        title="IMPORT RAW MATERIALS FROM EXCEL"
        size="lg"
        footer={
          importing ? (
            <div className="flex items-center justify-between w-full text-xs font-bold text-slate-500 px-2">
              <span className="flex items-center gap-2 text-[#f58220]">
                <Loader2 size={15} className="animate-spin" />
                Importing {importProgress.current} of {importProgress.total} items... ({importProgress.percent}%)
              </span>
              <button
                type="button"
                disabled
                className="px-7 py-3 bg-[#e2e8f0] dark:bg-slate-800 text-[#94a3b8] dark:text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed"
              >
                Importing...
              </button>
            </div>
          ) : importResult ? (
            <button
              type="button"
              onClick={() => { setShowImportModal(false); setIsImportMinimized(false); setImportRows([]); setImportResult(null); }}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors"
            >
              Done
            </button>
          ) : (
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setIsImportMinimized(false); setImportRows([]); }}
                className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || importRows.filter(r => !r.error).length === 0}
                className={clsx(
                  "px-8 py-3 text-sm font-bold rounded-xl transition-all shadow-2xs cursor-pointer",
                  importRows.filter(r => !r.error).length > 0 && !importing
                    ? "bg-[#f58220] hover:bg-[#e8740e] text-white hover:shadow-md"
                    : "bg-[#e2e8f0] dark:bg-slate-800 text-[#94a3b8] dark:text-slate-500 cursor-not-allowed"
                )}
              >
                {`Import ${importRows.filter(r => !r.error).length} Items`}
              </button>
            </div>
          )
        }
      >
        {importing ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Animated Ring Spinner & Icon */}
            <div className="relative flex items-center justify-center w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-orange-100 dark:border-orange-950/40" />
              <div className="absolute inset-0 rounded-full border-4 border-[#f58220] border-t-transparent animate-spin" />
              <div className="w-16 h-16 rounded-full bg-orange-500/10 text-[#f58220] flex items-center justify-center shadow-inner">
                <UploadCloud size={30} className="animate-bounce" />
              </div>
            </div>

            <div className="space-y-1.5 max-w-md">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Importing Raw Materials...
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Please wait while we process your materials into the database.
              </p>
            </div>

            {/* Real-time Progress Bar & Counters */}
            <div className="w-full max-w-lg space-y-3 bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-[#f58220]" />
                  <span>{importProgress.current} of {importProgress.total} items imported</span>
                </span>
                <span className="text-[#f58220] font-black text-sm font-mono">
                  {importProgress.percent}%
                </span>
              </div>

              {/* Progress Track & Fill Bar */}
              <div className="w-full h-3.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 relative">
                <div 
                  className="h-full bg-gradient-to-r from-[#f58220] to-[#ff9838] rounded-full transition-all duration-300 ease-out shadow-sm relative overflow-hidden"
                  style={{ width: `${importProgress.percent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium pt-0.5">
                <span>Processing material records...</span>
                <span>Total: {importProgress.total} items</span>
              </div>
            </div>
          </div>
        ) : importResult ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={32} />
            </div>
            <p className="text-lg font-bold text-slate-800">{importResult.success} item{importResult.success === 1 ? '' : 's'} imported</p>
            {importResult.failed > 0 && (
              <p className="text-sm text-rose-500 font-medium">{importResult.failed} row{importResult.failed === 1 ? '' : 's'} failed — check for duplicate names or invalid data and try again.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {importRows.length > 0 ? (
                  <>{importRows.length} row{importRows.length === 1 ? '' : 's'} found · {importRows.filter(r => r.error).length} with errors will be skipped.</>
                ) : (
                  <>Select an Excel file (.xlsx, .csv) to preview raw materials before importing.</>
                )}
              </p>
              <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:underline">
                <Download size={14} /> Download Template
              </button>
            </div>

            {importRows.length === 0 ? (
              <div
                onClick={() => importFileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[#f58220] rounded-2xl p-10 text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-orange-50/20 transition-all cursor-pointer group"
              >
                <UploadCloud size={44} className="mx-auto text-slate-400 group-hover:text-[#f58220] transition-colors mb-3" />
                <p className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">Click to select or drag & drop an Excel file</p>
                <p className="text-xs text-slate-400 mb-4">Supported formats: .xlsx, .xls, .csv</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); importFileRef.current?.click(); }}
                  className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs font-bold rounded-xl shadow-2xs transition-all"
                >
                  Browse File
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Name</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Unit</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, i) => (
                      <tr key={i} className={clsx("border-t border-slate-100", row.error && "bg-rose-50/50")}>
                        <td className="px-3 py-2 font-semibold text-slate-800">{row.name || "—"}</td>
                        <td className="px-3 py-2 text-slate-600">{row.unit}</td>
                        <td className="px-3 py-2">
                          {row.error
                            ? <span className="text-rose-600 font-bold">{row.error}</span>
                            : <span className="text-emerald-600 font-bold">Ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Minimized Floating Import Widget */}
      {showImportModal && isImportMinimized && (
        <MinimizedImportWidget
          title="Import Raw Materials"
          importing={importing}
          importProgress={importProgress}
          importResult={importResult}
          importRowsCount={importRows.length}
          onRestore={() => setIsImportMinimized(false)}
          onClose={() => {
            setShowImportModal(false);
            setIsImportMinimized(false);
            setImportRows([]);
            setImportResult(null);
          }}
        />
      )}
    </div>
  );
}
