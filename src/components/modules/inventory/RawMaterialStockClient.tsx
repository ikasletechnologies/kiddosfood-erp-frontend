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
import { rawMaterialsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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
  // Finished goods: min stock is unit count
  return `${minStockVal} Units`;
};

export default function RawMaterialStockClient() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const { user } = useAuth();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rawMaterialsApi.getAll(showInactive, user?.franchiseId);
      setItems(res.data ?? []);
    } catch (e) {
      console.error("Failed to fetch inventory:", e);
    } finally {
      setLoading(false);
    }
  }, [showInactive, user?.franchiseId]);



  useEffect(() => { fetchItems(); }, [fetchItems, showInactive]);

  const getStockStatus = (stock: number, threshold: number) => {
    const s = stock || 0;
    const t = threshold || 0;
    if (s <= 0) return { label: "CRITICAL", color: "text-red-600 bg-red-50 dark:bg-red-500/10" };
    if (s < t) return { label: "LOW STOCK", color: "text-orange-600 bg-orange-50 dark:bg-orange-500/10" };
    if (s === t) return { label: "REORDER", color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" };
    return { label: "SAFE", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" };
  };

  const totalValue = items.reduce((acc, i) => acc + ((i.currentStock || 0) * (i.costPrice || 0)), 0);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">

      {/* No big header here since Stock Hub has its own page header */}
      <div className="flex justify-end gap-3">
        <button onClick={fetchItems} className="p-2 border border-gray-250 hover:bg-gray-50 rounded-lg text-slate-500 transition-colors">
          <RefreshCw size={16} className={clsx("text-slate-400", loading && "animate-spin")} />
        </button>
      </div>

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

      {/* Critical Stock Alerts List */}
      <div className="bg-white dark:bg-card border border-slate-200 dark:border-slate-850 rounded-xl shadow-sm overflow-hidden p-6 mt-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="text-red-500" size={18} />
          Critical & Low Stock Alerts
        </h3>
        {items.filter(i => getStockInPhysicalUnit(i.currentStock || 0, i.sku, i.category) <= (i.minimumStock || 0)).length === 0 ? (
          <p className="text-sm text-slate-500">All raw materials are currently adequately stocked.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items
              .filter(i => getStockInPhysicalUnit(i.currentStock || 0, i.sku, i.category) <= (i.minimumStock || 0))
              .slice(0, 12)
              .map(item => {
                const physicalStock = getStockInPhysicalUnit(item.currentStock || 0, item.sku, item.category);
                const status = getStockStatus(physicalStock, item.minimumStock);
                return (
                  <div key={item.id} className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{item.name}</span>
                      <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", status.color)}>
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
    </div>
  );
}
