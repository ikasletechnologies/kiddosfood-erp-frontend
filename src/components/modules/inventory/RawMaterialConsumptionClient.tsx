"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers, Search, RefreshCw, Database,
  Download, Flame, Wrench, ChefHat, BarChart3, TrendingDown
} from "lucide-react";
import { clsx } from "clsx";
import { inventoryApi } from "@/lib/api";

export default function RawMaterialConsumptionClient() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Consumption is scoped by warehouse (where material actually left from),
  // not franchise. "" means every warehouse combined.
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  useEffect(() => {
    inventoryApi.getWarehouses()
      .then((res) => setWarehouses(res.data ?? []))
      .catch((e) => console.error("Failed to fetch warehouses:", e));
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getRawMaterialConsumption(selectedWarehouseId || undefined);
      setItems(res.data ?? []);
    } catch (e) {
      console.error("Failed to fetch raw material consumption:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const downloadCSV = () => {
    const headers = ["Date", "Item Name", "SKU", "Type", "Quantity", "Unit", "Valuation (₹)", "Notes"];
    const rows = filtered.map(item => [
      new Date(item.date).toLocaleDateString(),
      item.itemName || "",
      item.sku || "",
      item.consumptionType || "",
      item.quantity.toFixed(2),
      item.unit || "",
      item.value.toFixed(2),
      item.notes || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raw-material-consumption-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = items.filter((it) => {
    const matchSearch = !search ||
      it.itemName?.toLowerCase().includes(search.toLowerCase()) ||
      it.sku?.toLowerCase().includes(search.toLowerCase()) ||
      it.notes?.toLowerCase().includes(search.toLowerCase());

    const matchType = typeFilter === "ALL" ||
      (typeFilter === "PRODUCTION" && it.consumptionType === "Production Consumption") ||
      (typeFilter === "DAMAGE" && it.consumptionType === "Damage") ||
      (typeFilter === "EXPIRY" && it.consumptionType === "Expiry") ||
      (typeFilter === "MANUAL_ADJUSTMENT" && it.consumptionType === "Manual Adjustment");

    return matchSearch && matchType;
  });

  const totalValue = filtered.reduce((acc, i) => acc + (i.value || 0), 0);
  const productionValue = filtered.filter(i => i.consumptionType === "Production Consumption").reduce((acc, i) => acc + (i.value || 0), 0);
  const damageValue = filtered.filter(i => i.consumptionType === "Damage").reduce((acc, i) => acc + (i.value || 0), 0);
  const expiryValue = filtered.filter(i => i.consumptionType === "Expiry").reduce((acc, i) => acc + (i.value || 0), 0);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/10 shrink-0">
              <TrendingDown size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Raw Material Consumption <span className="text-slate-400 font-medium ml-1 italic">& Trends</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={12} className="text-orange-500" /> Outward consumption analytics
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
          { label: "Total Consumption", value: `₹${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "All Outwards Sum", icon: Layers, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Production Usage", value: `₹${productionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "Direct manufacturing", icon: ChefHat, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Damage Disposal", value: `₹${damageValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "Wastage / Spoils", icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Expiry Loss", value: `₹${expiryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "Expired stock write-off", icon: Flame, color: "text-red-500", bg: "bg-red-500/10" },
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
            { id: "ALL", label: "All Records" },
            { id: "PRODUCTION", label: "Production" },
            { id: "DAMAGE", label: "Damage" },
            { id: "EXPIRY", label: "Expiry" },
            { id: "MANUAL_ADJUSTMENT", label: "Manual Adjustment" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setTypeFilter(cat.id)}
              className={clsx(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                typeFilter === cat.id ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-white/10" : "text-slate-400"
              )}
            >
              {cat.label}
            </button>
          ))}
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
              placeholder="Search Batch / Material / Reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-white dark:bg-slate-900 border-none rounded-xl outline-none text-xs font-bold shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Consumption Table Layout */}
      <div className="bg-white dark:bg-card/40 border border-slate-200 dark:border-white/5 rounded-[2.5rem] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5">
              <tr className="text-slate-400">
                <th className="w-[12%] px-8 py-4 text-[9px] font-black uppercase tracking-widest">Date</th>
                <th className="w-[12%] px-6 py-4 text-[9px] font-black uppercase tracking-widest">Batch / Ref</th>
                <th className="w-[20%] px-6 py-4 text-[9px] font-black uppercase tracking-widest">Material</th>
                <th className="w-[12%] px-6 py-4 text-[9px] font-black uppercase tracking-widest text-right">Actual Qty</th>
                <th className="w-[15%] px-6 py-4 text-[9px] font-black uppercase tracking-widest">Source</th>
                <th className="w-[29%] px-8 py-4 text-[9px] font-black uppercase tracking-widest">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {filtered.map((item) => {
                const source = item.consumptionType || "Production";
                let badgeColor = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
                
                if (source === "Production Consumption" || source === "Production") badgeColor = "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400";
                else if (source === "Damage" || source === "Wastage") badgeColor = "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400";
                else if (source === "Expiry") badgeColor = "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400";
                else if (source === "Manual Adjustment") badgeColor = "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400";

                return (
                  <tr key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all">
                    <td className="px-8 py-4 text-[11px] font-bold text-slate-500">
                      {new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono uppercase tracking-wider">
                      {source === "Production Consumption" ? "PRD" : source === "Damage" ? "WST" : source === "Expiry" ? "EXP" : "ADJ"}-{item.id.substring(0, 4)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-[12px] truncate leading-none mb-1">{item.itemName}</p>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{item.sku}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={clsx("text-sm font-extrabold", item.quantity < 0 ? "text-rose-500" : "text-slate-900 dark:text-slate-200")}>
                        {item.quantity.toFixed(2)}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx("px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded border", badgeColor)}>
                        {source}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                        {item.notes || (source === "Production Consumption" ? "Recipe" : source === "Damage" ? "Spillage" : "Stock Count")}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="inline-flex p-6 bg-slate-50 dark:bg-white/5 rounded-full mb-2"><Database size={40} className="text-slate-200" /></div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No consumption records found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
