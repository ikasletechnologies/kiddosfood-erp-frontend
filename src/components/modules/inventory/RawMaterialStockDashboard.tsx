"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers, Search, AlertTriangle, RefreshCw, Trash2, X, Edit2, Lock,
  Database, Download, Flame, Wrench, Recycle
} from "lucide-react";
import { clsx } from "clsx";
import { rawMaterialsApi, inventoryApi } from "@/lib/api";

const WASTE_REASONS = [
  { value: "EXPIRED", label: "Expired", icon: Flame, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-200 dark:border-rose-500/20" },
  { value: "DAMAGED", label: "Damaged", icon: Wrench, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/20" },
  { value: "SCRAPPED", label: "Scrapped", icon: Recycle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20" },
];

export default function RawMaterialStockDashboard() {
  const [activeCategory, setActiveCategory] = useState<"RAW_MATERIAL" | "FINISHED_GOOD">("RAW_MATERIAL");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Storage is scoped by warehouse, not franchise — "" means every warehouse
  // combined (same total Item Master shows).
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

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

  useEffect(() => {
    inventoryApi.getWarehouses()
      .then((res) => setWarehouses(res.data ?? []))
      .catch((e) => console.error("Failed to fetch warehouses:", e));
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getRawMaterialStockSummary(selectedWarehouseId || undefined, undefined, activeCategory);
      setItems(res.data ?? []);
    } catch (e) {
      console.error("Failed to fetch raw material stock:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId, activeCategory]);

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
    fetchItems();
  }, [fetchItems]);

  const handleMoveToTrash = async () => {
    if (!trashItem) return;
    const qty = parseFloat(trashQty);
    if (!qty || qty <= 0) { setTrashError("Enter a valid quantity."); return; }
    if (qty > (trashItem.availableStock || 0)) { setTrashError("Quantity exceeds available stock."); return; }
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
    const headers = ["SKU", "Material Name", "Available Stock", "Reserved Stock", "Near Expiry Stock", "Damaged Stock", "Unit", "Min Stock", "Cost Price", "Status"];
    const rows = filtered.map(item => {
      const status = getStockStatus(item.availableStock || 0, item.minimumStock);
      return [
        item.sku || "",
        item.name || "",
        (item.availableStock || 0).toFixed(2),
        (item.reservedStock || 0).toFixed(2),
        (item.nearExpiryStock || 0).toFixed(2),
        (item.damagedStock || 0).toFixed(2),
        item.unit || "",
        item.minimumStock || 0,
        (item.costPrice || 0).toFixed(2),
        status.label
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raw-materials-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = items.filter((it) => {
    const matchSearch = !search ||
      it.name?.toLowerCase().includes(search.toLowerCase()) ||
      it.sku?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const getStockStatus = (stock: number, threshold: number) => {
    const s = stock || 0;
    const t = threshold || 0;
    if (s <= 0) return { label: "CRITICAL", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-200 dark:border-rose-500/20" };
    if (s < t) return { label: "LOW STOCK", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200 dark:border-orange-500/20" };
    if (s === t) return { label: "REORDER", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/20" };
    return { label: "SAFE", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" };
  };

  const totalValue = items.reduce((acc, i) => acc + ((i.availableStock || 0) * (i.costPrice || 0)), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 -m-4 md:-m-6">
      {/* Page Header Toolbar */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-lg border border-gray-200 dark:border-white/10">
            <button
              onClick={() => setActiveCategory("RAW_MATERIAL")}
              className={clsx(
                "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                activeCategory === "RAW_MATERIAL"
                  ? "bg-white dark:bg-card text-[#f58220] shadow-sm"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white"
              )}
            >
              Raw Material Stock
            </button>
            <button
              onClick={() => setActiveCategory("FINISHED_GOOD")}
              className={clsx(
                "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                activeCategory === "FINISHED_GOOD"
                  ? "bg-white dark:bg-card text-[#f58220] shadow-sm"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white"
              )}
            >
              Finished Goods Stock
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 bg-white dark:bg-card transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={fetchItems} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
        {deleteError && (
          <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-sm">
            <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{deleteError}</div>
            <button onClick={() => setDeleteError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Available Stock Value", value: `₹${(totalValue / 1000).toFixed(1)}K`, dot: "bg-blue-500" },
            { label: "Reserved Stock Items", value: items.filter(i => (i.reservedStock || 0) > 0).length, dot: "bg-amber-500" },
            { label: "Low Stock Alerts", value: items.filter(i => (i.availableStock || 0) <= (i.minimumStock || 0)).length, dot: "bg-rose-500" },
            { label: "Near Expiry Items", value: items.filter(i => (i.nearExpiryStock || 0) > 0).length, dot: "bg-orange-500" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
                <p className="text-lg font-bold text-gray-700 dark:text-slate-100">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-card">
            <button className="px-3 py-2 text-xs font-medium bg-[#f58220] text-white whitespace-nowrap">
              {activeCategory === "FINISHED_GOOD" ? "Finished Goods Only" : "Raw Materials Only"}
            </button>
          </div>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-card text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220]"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search SKU / Product Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-center px-4 py-3">Available Stock</th>
                  <th className="text-center px-4 py-3">Reserved Stock</th>
                  <th className="text-center px-4 py-3">Near Expiry</th>
                  <th className="text-center px-4 py-3">Damaged Stock</th>
                  <th className="text-center px-4 py-3">Reorder Level</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map((item) => {
                  const status = getStockStatus(item.availableStock || 0, item.minimumStock);
                  return (
                    <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-[10px] border shrink-0",
                            status.label === "CRITICAL" ? "bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-200 dark:border-rose-500/20" : "bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-white/10"
                          )}>
                            {item.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 dark:text-white truncate">{item.name}</p>
                            <span className="text-xs text-gray-400 dark:text-slate-500">{item.sku}</span>
                            {!selectedWarehouseId && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.warehouseBreakdown && item.warehouseBreakdown.length > 0 ? (
                                  item.warehouseBreakdown.map((b: any) => (
                                    <span
                                      key={b.warehouseId}
                                      className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-400"
                                      title={`${b.qty.toFixed(2)} ${item.unit} in ${b.warehouseName}`}
                                    >
                                      {b.warehouseName}: {b.qty.toFixed(1)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    Not tagged to any warehouse
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-gray-800 dark:text-white">
                          {(item.availableStock || 0).toFixed(2)}
                        </span>
                        <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("font-semibold", (item.reservedStock || 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-slate-500")}>
                          {(item.reservedStock || 0).toFixed(2)}
                        </span>
                        <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("font-semibold", (item.nearExpiryStock || 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-400 dark:text-slate-500")}>
                          {(item.nearExpiryStock || 0).toFixed(2)}
                        </span>
                        <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("font-semibold", (item.damagedStock || 0) > 0 ? "text-orange-600 dark:text-orange-400" : "text-gray-400 dark:text-slate-500")}>
                          {(item.damagedStock || 0).toFixed(2)}
                        </span>
                        <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingId === item.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-16 px-1.5 py-1 text-center text-xs border border-gray-200 dark:border-white/10 rounded outline-none focus:border-[#f58220] bg-white dark:bg-slate-900 text-gray-800 dark:text-white"
                            />
                            <button
                              disabled={updating}
                              onClick={() => handleUpdateThreshold(item.id)}
                              className="px-1.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] font-semibold"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-1.5 py-1 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-700 dark:text-slate-300 rounded text-[10px] font-semibold"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-gray-700 dark:text-slate-300">
                              {item.minimumStock} {item.unit}
                            </span>
                            <button
                              onClick={() => { setEditingId(item.id); setEditValue(item.minimumStock.toString()); }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-gray-400 hover:text-gray-700 dark:hover:text-white"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", status.color, status.bg, status.border)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setTrashItem(item); setTrashQty(""); setTrashNote(""); setTrashReason("EXPIRED"); setTrashError(""); }}
                            className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Move to Trash"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <div className="inline-flex p-6 bg-gray-50 dark:bg-white/5 rounded-full mb-2"><Database className="h-8 w-8 text-gray-300 dark:text-slate-600" /></div>
                <p className="text-sm text-gray-400 dark:text-slate-500">No matching items found</p>
              </div>
            )}
          </div>
          <div className="px-4 py-3 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Stock Integrity Active</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400"><Lock className="h-3 w-3 text-[#f58220]" /> Production Locked Ledger</div>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500">Total Asset Value: ₹{totalValue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Move to Trash Modal */}
      {trashItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#13151f] rounded-lg border border-gray-200 dark:border-white/10 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Move to Trash</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{trashItem.name}</p>
              </div>
              <button onClick={() => setTrashItem(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-sm text-rose-600 dark:text-rose-400">
              Available Stock: <span className="font-semibold">
                {trashItem.availableStock.toFixed(2)} {trashItem.unit}
              </span>
              <span className="block mt-1 text-xs text-gray-400 dark:text-slate-500">This action reduces inventory permanently</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Reason for Disposal</label>
              <div className="grid grid-cols-3 gap-2">
                {WASTE_REASONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setTrashReason(r.value)}
                    className={clsx(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-[11px] font-semibold transition-colors",
                      trashReason === r.value
                        ? `${r.bg} ${r.color} ${r.border}`
                        : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/20"
                    )}
                  >
                    <r.icon className="h-4 w-4" />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Quantity to Dispose *</label>
              <div className="relative">
                <input
                  type="number"
                  value={trashQty}
                  onChange={e => setTrashQty(e.target.value)}
                  placeholder="0.00"
                  max={trashItem.availableStock}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-semibold text-gray-800 dark:text-white bg-white dark:bg-white/5 outline-none focus:border-rose-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-slate-500">{trashItem.unit}</span>
              </div>
              {trashQty && (
                <p className="text-xs text-rose-500 dark:text-rose-400 mt-1.5">
                  Loss Value: ₹{((parseFloat(trashQty) || 0) * (trashItem.costPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Notes (Optional)</label>
              <input
                type="text"
                value={trashNote}
                onChange={e => setTrashNote(e.target.value)}
                placeholder="e.g. batch spoiled due to storage issue"
                className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            </div>

            {trashError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" /> {trashError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setTrashItem(null)} className="flex-1 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleMoveToTrash}
                disabled={trashSaving}
                className="flex-[2] py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {trashSaving ? "Processing..." : "Confirm Disposal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
