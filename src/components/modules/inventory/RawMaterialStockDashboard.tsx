"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers, Search, AlertTriangle, CheckCircle2,
  RefreshCw, Trash2, X, Edit2, Lock,
  Calculator, Package, BarChart3, Database,
  Download, Flame, Wrench, Recycle
} from "lucide-react";
import { clsx } from "clsx";
import { rawMaterialsApi, inventoryApi } from "@/lib/api";
import Link from "next/link";

const WASTE_REASONS = [
  { value: "EXPIRED", label: "Expired", icon: Flame, color: "text-red-600", bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-200" },
  { value: "DAMAGED", label: "Damaged", icon: Wrench, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200" },
  { value: "SCRAPPED", label: "Scrapped", icon: Recycle, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/10", border: "border-orange-200" },
];

export default function RawMaterialStockDashboard() {
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
      const res = await inventoryApi.getRawMaterialStockSummary(selectedWarehouseId || undefined);
      setItems(res.data ?? []);
    } catch (e) {
      console.error("Failed to fetch raw material stock:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId]);

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
    if (s <= 0) return { label: "CRITICAL", color: "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:border-red-500/20" };
    if (s < t) return { label: "LOW STOCK", color: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20" };
    if (s === t) return { label: "REORDER", color: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20" };
    return { label: "SAFE", color: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20" };
  };

  const totalValue = items.reduce((acc, i) => acc + ((i.availableStock || 0) * (i.costPrice || 0)), 0);

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
                Raw Material Stock <span className="text-slate-400 font-medium ml-1 italic">& Levels</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={12} className="text-orange-500" /> Granular production raw material ledger
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
        </div>
      </header>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Available Stock Value", value: `₹${(totalValue / 1000).toFixed(1)}K`, sub: "Live Asset Value", icon: Calculator, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Reserved Stock Items", value: items.filter(i => (i.reservedStock || 0) > 0).length, sub: "In production queue", icon: Package, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Low Stock Alerts", value: items.filter(i => (i.availableStock || 0) <= (i.minimumStock || 0)).length, sub: "Reorder Required", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
          { label: "Near Expiry Items", value: items.filter(i => (i.nearExpiryStock || 0) > 0).length, sub: "Expiring in 30 days", icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" },
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
          <button className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-white/10">
            Raw Materials Only
          </button>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto px-2 md:px-0">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="px-4 py-3 bg-white dark:bg-slate-900 border-none rounded-xl outline-none text-xs font-bold shadow-sm text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <div className="relative group w-full md:w-80">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search SKU / Material Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border-none rounded-xl outline-none text-xs font-bold shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Dense Table Layout */}
      <div className="bg-white dark:bg-card/40 border border-slate-200 dark:border-white/5 rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
              <tr className="text-slate-400">
                <th className="w-[20%] px-8 py-4 text-[9px] font-black uppercase tracking-widest">Material</th>
                <th className="w-[12%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Available Stock</th>
                <th className="w-[12%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Reserved Stock</th>
                <th className="w-[12%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Near Expiry</th>
                <th className="w-[12%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Damaged Stock</th>
                <th className="w-[15%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Reorder Level</th>
                <th className="w-[10%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">Status</th>
                <th className="w-[7%] px-8 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {filtered.map((item) => {
                const status = getStockStatus(item.availableStock || 0, item.minimumStock);
                return (
                  <tr key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center font-black text-[9px] border shrink-0",
                          status.label === "CRITICAL" ? "bg-red-50 text-red-500 border-red-100" : "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {item.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-[12px] truncate leading-none mb-1">{item.name}</p>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{item.sku}</span>
                          {!selectedWarehouseId && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {item.warehouseBreakdown && item.warehouseBreakdown.length > 0 ? (
                                item.warehouseBreakdown.map((b: any) => (
                                  <span
                                    key={b.warehouseId}
                                    className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400"
                                    title={`${b.qty.toFixed(2)} ${item.unit} in ${b.warehouseName}`}
                                  >
                                    {b.warehouseName}: {b.qty.toFixed(1)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600">
                                  Not tagged to any warehouse
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-200">
                        {(item.availableStock || 0).toFixed(2)}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={clsx("text-sm font-extrabold", (item.reservedStock || 0) > 0 ? "text-amber-600" : "text-slate-400")}>
                        {(item.reservedStock || 0).toFixed(2)}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={clsx("text-sm font-extrabold", (item.nearExpiryStock || 0) > 0 ? "text-red-500" : "text-slate-400")}>
                        {(item.nearExpiryStock || 0).toFixed(2)}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={clsx("text-sm font-extrabold", (item.damagedStock || 0) > 0 ? "text-orange-500" : "text-slate-400")}>
                        {(item.damagedStock || 0).toFixed(2)}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-16 px-1.5 py-0.5 text-center text-xs font-bold border rounded"
                          />
                          <button
                            disabled={updating}
                            onClick={() => handleUpdateThreshold(item.id)}
                            className="px-1.5 py-0.5 bg-emerald-500 text-white rounded text-[10px] font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-1.5 py-0.5 bg-slate-300 text-slate-800 rounded text-[10px] font-bold"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-600">
                            {item.minimumStock} {item.unit}
                          </span>
                          <button
                            onClick={() => { setEditingId(item.id); setEditValue(item.minimumStock.toString()); }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-900"
                          >
                            <Edit2 size={10} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={clsx("inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border", status.color)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setTrashItem(item); setTrashQty(""); setTrashNote(""); setTrashReason("EXPIRED"); setTrashError(""); }}
                          className="p-2 bg-red-50 dark:bg-red-500/10 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-600 transition-all"
                          title="Move to Trash"
                        >
                          <Trash2 size={12} />
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
              <div className="inline-flex p-6 bg-slate-50 dark:bg-white/5 rounded-full mb-2"><Database size={40} className="text-slate-200" /></div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No matching raw material items found</p>
            </div>
          )}
        </div>
        <div className="px-8 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Stock Integrity Active</div>
            <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest"><Lock size={10} className="text-orange-500" /> Production Locked Ledger</div>
          </div>
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Total Asset Value: ₹{totalValue.toLocaleString()}</p>
        </div>
      </div>

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

            <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-100 dark:border-red-500/20 text-xs font-bold text-red-600 dark:text-red-400">
              Available Stock: <span className="font-black">
                {trashItem.availableStock.toFixed(2)} {trashItem.unit}
              </span>
              <span className="block mt-1 text-[10px] text-slate-400 font-medium">• This action reduces inventory permanently</span>
            </div>

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
                  max={trashItem.availableStock}
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
