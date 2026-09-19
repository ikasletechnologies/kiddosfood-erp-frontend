"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search, RefreshCw, Download, Database } from "lucide-react";
import { clsx } from "clsx";
import { inventoryApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { convertUnit } from "@/lib/unitConversion";

const WEIGHT_UNITS = ["KG", "MG"];

const SOURCE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Production Consumption": { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  "Damage":                 { color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",   border: "border-amber-200 dark:border-amber-500/20" },
  "Expiry":                 { color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-500/10",    border: "border-rose-200 dark:border-rose-500/20" },
  "Manual Adjustment":      { color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10",    border: "border-blue-200 dark:border-blue-500/20" },
};
const DEFAULT_SOURCE_STYLE = { color: "text-gray-600 dark:text-slate-400", bg: "bg-gray-50 dark:bg-white/5", border: "border-gray-200 dark:border-white/10" };

const DATE_FILTERS = [
  { id: "ALL", label: "All Dates" },
  { id: "TODAY", label: "Today" },
  { id: "YESTERDAY", label: "Yesterday" },
  { id: "LAST_7_DAYS", label: "Last 1 Week" },
  { id: "LAST_30_DAYS", label: "Last 1 Month" },
  { id: "CUSTOM", label: "Custom Date" },
];

export default function RawMaterialConsumptionClient() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Date Filter State
  const [dateFilter, setDateFilter] = useState("ALL");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // HQ Warehouses
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  useEffect(() => {
    inventoryApi.getWarehouses({ scope: "HQ" })
      .then((res) => {
        const list = res.data ?? [];
        const hqOnly = list.filter((w: any) => !w.isFranchise);
        setWarehouses(hqOnly.length > 0 ? hqOnly : list);
      })
      .catch((e) => console.error("Failed to fetch HQ warehouses:", e));
  }, []);

  const calculateDateRange = useCallback((filter: string, from?: string, to?: string) => {
    const now = new Date();
    const toYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (filter === "TODAY") {
      const t = toYMD(now);
      return { startDate: t, endDate: t };
    }
    if (filter === "YESTERDAY") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      return { startDate: yStr, endDate: yStr };
    }
    if (filter === "LAST_7_DAYS") {
      const p = new Date(now);
      p.setDate(p.getDate() - 7);
      return { startDate: toYMD(p), endDate: toYMD(now) };
    }
    if (filter === "LAST_30_DAYS") {
      const p = new Date(now);
      p.setDate(p.getDate() - 30);
      return { startDate: toYMD(p), endDate: toYMD(now) };
    }
    if (filter === "CUSTOM") {
      return { startDate: from || undefined, endDate: to || undefined };
    }
    return { startDate: undefined, endDate: undefined };
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = calculateDateRange(dateFilter, customStartDate, customEndDate);
      const params: any = {};
      if (selectedWarehouseId) params.warehouseId = selectedWarehouseId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await inventoryApi.getRawMaterialConsumption(params);
      setItems(res.data ?? []);
    } catch (e) {
      console.error("Failed to fetch raw material consumption:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId, dateFilter, customStartDate, customEndDate, calculateDateRange]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = items.filter((it) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      it.itemName?.toLowerCase().includes(q) ||
      it.sku?.toLowerCase().includes(q) ||
      it.notes?.toLowerCase().includes(q)
    );
  });

  const downloadCSV = () => {
    const headers = ["Date", "Batch / Ref", "Material", "Qty", "Unit", "Source", "Reason / Notes", "Valuation (₹)"];
    const rows = filtered.map(item => {
      const source = item.consumptionType || "Production";
      const prefix = source === "Production Consumption" ? "PRD" : source === "Damage" ? "WST" : source === "Expiry" ? "EXP" : "ADJ";
      const batchRef = item.batchCode || `${prefix}-${item.id.substring(0, 4).toUpperCase()}`;
      const material = `${item.itemName || ""}${item.sku ? ` (${item.sku})` : ""}`;
      const reason = item.notes || (source === "Production Consumption" ? "Recipe" : source === "Damage" ? "Spillage" : "Stock Count");

      return [
        formatDate(item.date),
        batchRef,
        material,
        item.quantity.toFixed(2),
        item.unit || "",
        source,
        reason,
        (item.value || 0).toFixed(2)
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raw-material-consumption-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalValue = filtered.reduce((acc, i) => acc + (i.value || 0), 0);
  const productionValue = filtered.filter(i => i.consumptionType === "Production Consumption").reduce((acc, i) => acc + (i.value || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-5 text-gray-800 dark:text-slate-100 w-full min-w-0">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-lg min-w-0">
        {[
          { label: "Total Consumption", value: `₹${totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, dot: "bg-gray-400" },
          { label: "Production Usage",  value: `₹${productionValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, dot: "bg-emerald-500" },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 min-w-0">
            <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 truncate">{s.label}</p>
              <p className="text-base sm:text-lg font-bold text-gray-700 dark:text-slate-100 truncate">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search batch / material / reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
          {search && (
            <X 
              size={14} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
              onClick={() => setSearch("")} 
            />
          )}
        </div>

        {/* Date Filter Dropdown */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-card text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220]"
        >
          {DATE_FILTERS.map((df) => (
            <option key={df.id} value={df.id}>{df.label}</option>
          ))}
        </select>

        {/* Custom Date Range Pickers */}
        {dateFilter === "CUSTOM" && (
          <div className="flex items-center gap-1.5 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 bg-white dark:bg-card">
            <span className="text-xs text-gray-500 dark:text-slate-400">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="text-xs bg-transparent outline-none text-gray-700 dark:text-slate-200"
            />
            <span className="text-xs text-gray-500 dark:text-slate-400">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="text-xs bg-transparent outline-none text-gray-700 dark:text-slate-200"
            />
          </div>
        )}

        {/* HQ Warehouses Only Dropdown */}
        <select
          value={selectedWarehouseId}
          onChange={(e) => setSelectedWarehouseId(e.target.value)}
          className="border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-card text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220]"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 bg-white dark:bg-card transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={fetchItems} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl py-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center">
            <Database className="h-8 w-8 text-[#f58220]" />
          </div>
          <div>
            <p className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base">No Consumption Records Found</p>
            <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Outward material movements will show up here.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0">
          <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Batch / Ref</th>
                  <th className="text-left px-4 py-3">Material</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filtered.map((item) => {
                  const source = item.consumptionType || "Production";
                  const style = SOURCE_STYLES[source] || DEFAULT_SOURCE_STYLE;
                  const prefix = source === "Production Consumption" ? "PRD" : source === "Damage" ? "WST" : source === "Expiry" ? "EXP" : "ADJ";

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 dark:text-slate-200 text-xs">
                        {item.batchCode || `${prefix}-${item.id.substring(0, 4).toUpperCase()}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-800 dark:text-white">{item.itemName}</span>
                        {item.sku && <span className="ml-1.5 text-xs text-gray-400 dark:text-slate-500">({item.sku})</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx("font-medium", item.quantity < 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-800 dark:text-slate-200")}>
                          {item.quantity.toFixed(2)}
                        </span>
                        <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">
                        {item.notes || (source === "Production Consumption" ? "Recipe" : source === "Damage" ? "Spillage" : "Stock Count")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
