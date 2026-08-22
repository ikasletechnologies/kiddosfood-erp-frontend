"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers, Plus, Search, AlertTriangle, CheckCircle2,
  RefreshCw, Trash2, X,
  Edit2, Lock,
  Calculator, Package, BarChart3, Database,
  Download, Flame, Wrench, Recycle
} from "lucide-react";
import { clsx } from "clsx";
import { rawMaterialsApi, inventoryApi, franchiseProductRequestsApi } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Send, Eye, ShieldCheck, Clock, Truck } from "lucide-react";

const WEIGHT_VOLUME_UNITS = new Set(['KG', 'G', 'GM', 'KGS', 'L', 'LTR', 'LITER', 'LITRE', 'ML']);

const getMeasurementType = (unit: string): "weight" | "volume" | "piece" => {
  const u = unit.toUpperCase();
  if (['KG', 'G', 'GM', 'KGS'].includes(u)) return "weight";
  if (['L', 'LTR', 'LITER', 'LITRE', 'ML'].includes(u)) return "volume";
  return "piece";
};

const WASTE_REASONS = [
  { value: "EXPIRED", label: "Expired", icon: Flame, color: "text-red-600", bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-200" },
  { value: "DAMAGED", label: "Damaged", icon: Wrench, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200" },
  { value: "SCRAPPED", label: "Scrapped", icon: Recycle, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200" },
];

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
  // Finished goods: min stock is unit count
  return `${minStockVal} Units`;
};

export default function RawMaterialStockClient() {
  const [items, setItems] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedDemandItem, setSelectedDemandItem] = useState<{ item: any; demand: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  // Trash / Waste Modal
  const [trashItem, setTrashItem] = useState<any>(null);
  const [trashReason, setTrashReason] = useState("EXPIRED");
  const [trashQty, setTrashQty] = useState("");
  const [trashNote, setTrashNote] = useState("");
  const [trashSaving, setTrashSaving] = useState(false);
  const [trashError, setTrashError] = useState("");

  const { user } = useAuth();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [res, reqRes] = await Promise.all([
        rawMaterialsApi.getAll(showInactive, user?.franchiseId),
        franchiseProductRequestsApi.getAll().catch(() => ({ data: [] })),
      ]);
      setItems(res.data ?? []);
      setRequests(Array.isArray(reqRes?.data) ? reqRes.data : []);
    } catch (e) {
      console.error("Failed to fetch inventory:", e);
    } finally {
      setLoading(false);
    }
  }, [showInactive, user?.franchiseId]);

  // Helper to compute franchise demand and allocation per product
  const getDemandStats = (item: any) => {
    const itemReqs = requests.filter((r: any) => {
      const prods = r.products ?? (r.details as any)?.products ?? [];
      return prods.some((p: any) => p.productId === item.id || p.productName?.toLowerCase() === item.name?.toLowerCase());
    });

    let reserved = 0;
    let inTransit = 0;
    let pendingQty = 0;
    let pendingCount = 0;

    itemReqs.forEach((r: any) => {
      const prods = r.products ?? (r.details as any)?.products ?? [];
      const match = prods.find((p: any) => p.productId === item.id || p.productName?.toLowerCase() === item.name?.toLowerCase());
      if (!match) return;

      const qty = Number(match.approvedQuantity ?? match.requestedQuantity ?? 0);
      const dispQty = Number(match.dispatchedQuantity ?? qty);
      const reqQty = Number(match.requestedQuantity ?? 0);

      if (r.status === "PROCESSING" || r.status === "APPROVED") {
        reserved += qty;
      } else if (r.status === "DISPATCHED") {
        inTransit += dispQty;
      } else if (r.status === "PENDING") {
        pendingQty += reqQty;
        pendingCount += 1;
      }
    });

    return {
      reserved,
      inTransit,
      pendingQty,
      pendingCount,
      requests: itemReqs,
    };
  };

  const handleUpdateThreshold = async (itemId: string) => {
    setUpdating(true);
    try {
      const val = parseFloat(editValue);
      if (isNaN(val)) return;
      await rawMaterialsApi.update(itemId, { minimumStock: val });
      setEditingId(null);
      fetchItems();
    } catch (e) {
      console.error("Failed to update threshold", e);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const typeParam = params.get("type");
      if (typeParam) {
        setCategory(typeParam.toUpperCase());
      }
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems, showInactive]);

  const handleDelete = async (item: any) => {
    if (!confirm(`Archive "${item.name}"?`)) return;
    try {
      await rawMaterialsApi.delete(item.id);
      fetchItems();
    } catch (e: any) {
      setDeleteError(e?.response?.data?.error || "Delete failed.");
    }
  };

  const handleMoveToTrash = async () => {
    if (!trashItem) return;
    const qty = parseFloat(trashQty);
    if (!qty || qty <= 0) { setTrashError("Enter a valid quantity."); return; }
    if (qty > (trashItem.currentStock || 0)) { setTrashError("Quantity exceeds current stock."); return; }
    setTrashSaving(true);
    setTrashError("");
    try {
      await inventoryApi.stockOut({
        itemId: trashItem.id,
        quantity: qty,
        type: `WASTE_${trashReason}`,
        note: trashNote || `${trashReason.toLowerCase()} stock removed`
      });
      setTrashItem(null);
      setTrashQty("");
      setTrashNote("");
      setTrashReason("EXPIRED");
      fetchItems();
    } catch (e: any) {
      setTrashError(e?.response?.data?.error || "Failed to remove stock.");
    } finally {
      setTrashSaving(false);
    }
  };

  const downloadCSV = () => {
    const headers = ["SKU", "Item Name", "Category", "Current Stock", "Unit", "Min Stock", "Cost Price", "Sale Price", "Stock Value", "Status"];
    const rows = filtered.map(item => {
      const physicalStock = getStockInPhysicalUnit(item.currentStock || 0, item.sku, item.category);
      const status = getStockStatus(physicalStock, item.minimumStock);
      return [
        item.sku || "",
        item.name || "",
        (item.category || "").replace(/_/g, " "),
        (item.currentStock || 0).toFixed(2),
        item.unit || "",
        item.minimumStock || 0,
        (item.costPrice || 0).toFixed(2),
        (item.basePrice || 0).toFixed(2),
        ((item.currentStock || 0) * (item.costPrice || 0)).toFixed(2),
        status.label
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = items.filter((it) => {
    const matchSearch = !search ||
      it.name?.toLowerCase().includes(search.toLowerCase()) ||
      it.sku?.toLowerCase().includes(search.toLowerCase());

    const cat = category.toUpperCase();
    const itemCat = it.category?.toUpperCase() || "";

    const matchCat = cat === "ALL" ||
      (cat === "RAW" && (itemCat === "RAW_MATERIAL" || itemCat.startsWith("RAW_"))) ||
      (cat === "FINISHED" && (itemCat === "FINISHED_GOOD" || itemCat === "FINISHED_PRODUCT")) ||
      (cat === "PACKAGING" && itemCat.startsWith("PACKAGING")) ||
      (cat === "ASSETS" && itemCat === "ASSETS") ||
      (cat === "OTHER" && (itemCat === "OTHER" || itemCat === "OTHER_MATERIAL"));

    return matchSearch && matchCat;
  });

  const getStockStatus = (stock: number, threshold: number) => {
    const s = stock || 0;
    const t = threshold || 0;
    if (s <= 0) return { label: "CRITICAL", color: "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:border-red-500/20" };
    if (s < t) return { label: "LOW STOCK", color: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20" };
    if (s === t) return { label: "REORDER", color: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20" };
    return { label: "SAFE", color: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20" };
  };

  const totalValue = items.reduce((acc, i) => acc + ((i.currentStock || 0) * (i.costPrice || 0)), 0);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
      {deleteError && (
        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-red-600 text-xs font-bold">
          <div className="flex items-center gap-3"><AlertTriangle size={14} />{deleteError}</div>
          <button onClick={() => setDeleteError(null)}><X size={14} /></button>
        </div>
      )}

      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/10 shrink-0">
              <Database size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Item Master <span className="text-slate-400 font-medium ml-1 italic">& Inventory</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={12} className="text-orange-500" /> Operational stock ledger & valuation engine
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl hover:border-emerald-300 hover:text-emerald-600 transition-all shadow-sm text-slate-500"
            title="Download CSV"
          >
            <Download size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Export</span>
          </button>
          <button onClick={fetchItems} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl hover:border-slate-300 transition-all shadow-sm">
            <RefreshCw size={16} className={clsx("text-slate-400", loading && "animate-spin")} />
          </button>
          <Link
            href="/inventory/stock/add"
            className="flex items-center gap-3 bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20"
          >
            <Plus size={18} strokeWidth={3} /> Create New Item
          </Link>
        </div>
      </header>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Inventory Valuation", value: `₹${(totalValue / 1000).toFixed(1)}K`, sub: "Live Asset Value", icon: Calculator, color: "text-orange-500", bg: "bg-orange-500/10" },
          { label: "Finished Products", value: items.filter(i => i.category?.includes('FINISHED')).length, sub: "Market Ready SKUs", icon: Package, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Low Stock Alerts", value: items.filter(i => getStockInPhysicalUnit(i.currentStock || 0, i.sku, i.category) <= (i.minimumStock || 0)).length, sub: "Reorder Required", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
          { label: "Raw Materials", value: items.filter(i => i.category?.includes('RAW')).length, sub: "Production Inputs", icon: Layers, color: "text-blue-500", bg: "bg-blue-500/10" },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-white/10 transition-all duration-200 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</h3>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">{stat.sub}</p>
            </div>
            <div className={clsx("p-3.5 rounded-xl shrink-0 flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon size={20} className="stroke-[2px]" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-white/5 p-2 rounded-[2rem] border border-slate-100 dark:border-white/5">
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {[
            { id: "ALL", label: "All Items" },
            { id: "RAW", label: "Raw Materials" },
            { id: "FINISHED", label: "Finished" },
            { id: "PACKAGING", label: "Packaging" },
            { id: "ASSETS", label: "Assets" },
            { id: "OTHER", label: "Other Material" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={clsx(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                category === cat.id ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-white/10" : "text-slate-400"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="relative group w-full md:w-80 px-2">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search SKU / Item Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border-none rounded-xl outline-none text-xs font-bold shadow-sm"
          />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
        </div>
      </div>

      {/* Dense Table Layout */}
      <div className="bg-white dark:bg-card/40 border border-slate-200 dark:border-white/5 rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
              <tr className="text-slate-400">
                <th className="w-[24%] px-8 py-4 text-[9px] font-black uppercase tracking-widest">Item Specification</th>
                <th className="w-[10%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Movement</th>
                <th className="w-[16%] px-6 py-4 text-[9px] font-black uppercase tracking-widest">Stock Balance</th>
                <th className="w-[9%] px-6 py-4 text-[9px] font-black uppercase tracking-widest">Avg. Cost</th>
                <th className="w-[9%] px-6 py-4 text-[9px] font-black uppercase tracking-widest">Sale Price</th>
                <th className="w-[10%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-right">Valuation</th>
                <th className="w-[10%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Status</th>
                <th className="w-[12%] px-8 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {filtered.map((item) => {
                const physicalStock = getStockInPhysicalUnit(item.currentStock || 0, item.sku, item.category);
                const status = getStockStatus(physicalStock, item.minimumStock);
                const isRaw = !item.category?.includes('FINISHED');
                const stockVal = (item.currentStock || 0) * (item.costPrice || 0);
                const measureType = getMeasurementType(item.unit || 'KG');
                const balance = formatStock(item.currentStock || 0, item.unit || "KG", item.sku, item.category);
                const minStock = formatMinStock(item.minimumStock || 0, item.unit || "KG", item.sku, item.category);

                return (
                  <tr key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                    <td className="px-8 py-3">
                      <div className="flex items-center gap-3">
                        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center font-black text-[9px] border shrink-0",
                          status.label === "CRITICAL" ? "bg-red-50 text-red-500 border-red-100" : "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {item.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-[12px] truncate leading-none mb-1">{item.name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{item.sku}</span>
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">• {item.category?.replace(/_/g, " ")}</span>
                            {isRaw && (
                              <span className={clsx(
                                "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide",
                                measureType === "weight" ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" :
                                measureType === "volume" ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400" :
                                "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              )}>
                                {(item.unit || "KG").toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[10px] font-black text-emerald-500">↑{(item.inbound || 0).toFixed(0)}</span>
                        <span className="text-[10px] font-black text-orange-500">↓{(item.outbound || 0).toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={clsx("text-sm font-extrabold tracking-tight", 
                            status.label === "CRITICAL" ? "text-red-600 dark:text-red-400 animate-pulse" :
                            status.label === "LOW STOCK" ? "text-orange-600 dark:text-orange-400" :
                            "text-slate-900 dark:text-slate-200"
                          )}>
                            {balance.qty}
                          </span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                            {balance.unit}
                          </span>

                          {balance.total && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-500/10 text-[10px] font-bold text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20">
                              ≈ {balance.total}
                            </span>
                          )}
                        </div>

                        {/* Franchise Demand allocation for Finished Goods */}
                        {(() => {
                          const demand = getDemandStats(item);
                          if (!demand.requests.length && !item.category?.includes("FINISHED")) {
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                                  <span>MIN STOCK</span>
                                  <span className="font-extrabold text-slate-700 dark:text-slate-300">
                                    {minStock}
                                  </span>
                                </div>
                                
                                <div className="w-full bg-slate-100 dark:bg-slate-800/60 rounded-full h-1 overflow-hidden">
                                  <div 
                                    className={clsx(
                                      "h-full rounded-full transition-all duration-500",
                                      status.label === "SAFE" ? "bg-emerald-500" :
                                      status.label === "REORDER" ? "bg-amber-500" :
                                      "bg-red-500"
                                    )}
                                    style={{ width: `${Math.min(100, Math.max(0, ((physicalStock || 0) / (item.minimumStock || 1)) * 100))}%` }}
                                  />
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="pt-1 border-t border-slate-100 dark:border-white/5 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap text-[10px]">
                                {demand.reserved > 0 && (
                                  <span className="font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded">
                                    🔒 Res: {demand.reserved}
                                  </span>
                                )}
                                {demand.inTransit > 0 && (
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded">
                                    🚚 In-Trans: {demand.inTransit}
                                  </span>
                                )}
                              </div>
                              {demand.pendingCount > 0 && (
                                <button
                                  onClick={() => setSelectedDemandItem({ item, demand })}
                                  className="w-full flex items-center justify-between text-[10px] font-black bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 px-2 py-0.5 rounded-lg transition-all"
                                  title="View Branch Requests for this product"
                                >
                                  <span>Demand: {demand.pendingQty} {item.unit || "units"}</span>
                                  <span className="bg-amber-500 text-white px-1.5 py-0.2 rounded-full text-[9px]">
                                    {demand.pendingCount} req
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-[12px] font-bold text-slate-500">₹{(item.costPrice || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-[12px] font-black text-blue-600 dark:text-blue-400">₹{(item.basePrice || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-[12px] font-black text-slate-900 dark:text-white">₹{stockVal.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={clsx("inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border", status.color)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-8 py-3 text-right">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {getDemandStats(item).requests.length > 0 && (
                          <button
                            onClick={() => setSelectedDemandItem({ item, demand: getDemandStats(item) })}
                            className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg hover:bg-amber-100 transition-all"
                            title="View Franchise Demand Requests"
                          >
                            <Send size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => { setTrashItem(item); setTrashQty(""); setTrashNote(""); setTrashReason("EXPIRED"); setTrashError(""); }}
                          className="p-2 bg-red-50 dark:bg-red-500/10 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-600 transition-all"
                          title="Move to Trash"
                        >
                          <Trash2 size={12} />
                        </button>
                        <Link href={`/inventory/stock/edit?id=${item.id}`} className="p-2 bg-white dark:bg-slate-800 text-slate-400 rounded-lg hover:text-slate-900 border border-slate-100 dark:border-white/5">
                          <Edit2 size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="inline-flex p-6 bg-slate-50 dark:bg-white/5 rounded-full mb-2"><Database size={40} className="text-slate-200" /></div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No matching items found in ledger</p>
            </div>
          )}
        </div>
        <div className="px-8 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Stock Integrity Active</div>
            <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><Lock size={10} className="text-orange-500" /> Production Locked Ledger</div>
          </div>
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Total Valuation: ₹{totalValue.toLocaleString()}</p>
        </div>
      </div>

      {/* ── Franchise Demand & Allocation Drawer Modal ── */}
      {selectedDemandItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#12141c] rounded-3xl shadow-2xl w-full max-w-xl p-6 space-y-5 border border-slate-100 dark:border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Send size={18} className="text-orange-500" /> Branch Demand & Orders
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live Franchise Product Requests for <strong>{selectedDemandItem.item.name}</strong> ({selectedDemandItem.item.sku || "N/A"})
                </p>
              </div>
              <button onClick={() => setSelectedDemandItem(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            {/* Inventory Status Bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available HQ</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {selectedDemandItem.item.currentStock || 0} {selectedDemandItem.item.unit}
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-2xl text-center">
                <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Reserved</p>
                <p className="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
                  {selectedDemandItem.demand.reserved} {selectedDemandItem.item.unit}
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-2xl text-center">
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Pending Demand</p>
                <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                  {selectedDemandItem.demand.pendingQty} {selectedDemandItem.item.unit}
                </p>
              </div>
            </div>

            {/* Requests List */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Associated Branch Requests ({selectedDemandItem.demand.requests.length})</p>
              {selectedDemandItem.demand.requests.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No active franchise requests for this item.</p>
              ) : (
                selectedDemandItem.demand.requests.map((r: any) => {
                  const prods = r.products ?? (r.details as any)?.products ?? [];
                  const matchProd = prods.find((p: any) => p.productId === selectedDemandItem.item.id || p.productName?.toLowerCase() === selectedDemandItem.item.name?.toLowerCase());

                  return (
                    <div key={r.id} className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white">{r.franchise?.name ?? "Branch"}</span>
                          <span className="text-[10px] font-mono text-slate-400 bg-white dark:bg-card px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
                            {r.requestNumber || `FPR-${String(r.id).slice(0, 4)}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Demanded: <strong>{matchProd?.requestedQuantity ?? "-"} {matchProd?.unit || selectedDemandItem.item.unit}</strong>
                          {matchProd?.approvedQuantity !== undefined && <span> (Approved: {matchProd.approvedQuantity})</span>}
                          <span> · Status: <span className="font-bold text-orange-500">{r.status}</span></span>
                        </p>
                      </div>

                      <Link
                        href={`/franchise/requests?id=${r.id}`}
                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-[11px] shrink-0 transition-all"
                      >
                        Review Request →
                      </Link>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedDemandItem(null)}
                className="px-5 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Trash Modal */}
      {trashItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md p-8 space-y-6 border border-slate-100 dark:border-white/10">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Move to Trash</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{trashItem.name}</p>
              </div>
              <button onClick={() => setTrashItem(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-400">
                <X size={18} />
              </button>
            </div>

            {(() => {
              const trashStock = formatStock(trashItem.currentStock || 0, trashItem.unit || "KG", trashItem.sku);
              return (
                <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-100 dark:border-red-500/20 text-xs font-bold text-red-600 dark:text-red-400">
                  Current Stock: <span className="font-black">
                    {trashStock.qty} {trashStock.unit} {trashStock.total ? `(${trashStock.total})` : ""}
                  </span>
                  <span className="block mt-1 text-[10px] text-slate-400 font-medium">• This action reduces inventory permanently</span>
                </div>
              );
            })()}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason for Disposal</label>
              <div className="grid grid-cols-3 gap-2">
                {WASTE_REASONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setTrashReason(r.value)}
                    className={clsx(
                      "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all",
                      trashReason === r.value
                        ? `${r.bg} ${r.color} ${r.border} scale-105`
                        : "border-slate-100 dark:border-white/5 text-slate-400 hover:border-slate-200"
                    )}
                  >
                    <r.icon size={18} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity to Dispose *</label>
              <div className="relative">
                <input
                  type="number"
                  value={trashQty}
                  onChange={e => setTrashQty(e.target.value)}
                  placeholder="0.00"
                  max={trashItem.currentStock}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-black outline-none focus:ring-2 ring-red-500/20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">{trashItem.unit}</span>
              </div>
              {trashQty && (
                <p className="text-[10px] text-red-500 font-bold">
                  Loss Value: ₹{((parseFloat(trashQty) || 0) * (trashItem.costPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes (Optional)</label>
              <input
                type="text"
                value={trashNote}
                onChange={e => setTrashNote(e.target.value)}
                placeholder="e.g. batch spoiled due to storage issue"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium outline-none"
              />
            </div>

            {trashError && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
                <AlertTriangle size={14} /> {trashError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setTrashItem(null)} className="flex-1 py-3 rounded-xl text-xs font-black uppercase text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                Cancel
              </button>
              <button
                onClick={handleMoveToTrash}
                disabled={trashSaving}
                className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={14} />
                {trashSaving ? "Processing..." : "Confirm Disposal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
