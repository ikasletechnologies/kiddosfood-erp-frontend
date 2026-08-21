"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search, RefreshCw, Download, Database } from "lucide-react";
import { clsx } from "clsx";
import { inventoryApi } from "@/lib/api";

const TYPE_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "PRODUCTION", label: "Production" },
  { id: "DAMAGE", label: "Damage" },
  { id: "EXPIRY", label: "Expiry" },
  { id: "MANUAL_ADJUSTMENT", label: "Manual Adjustment" },
];

const SOURCE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  "Production Consumption": { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  "Damage":                 { color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
  "Expiry":                 { color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-200" },
  "Manual Adjustment":      { color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
};
const DEFAULT_SOURCE_STYLE = { color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };

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
    <div className="space-y-5">
      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Consumption", value: `₹${totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,      dot: "bg-gray-400" },
          { label: "Production Usage",  value: `₹${productionValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, dot: "bg-emerald-500" },
          { label: "Damage Disposal",   value: `₹${damageValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,     dot: "bg-amber-500" },
          { label: "Expiry Loss",       value: `₹${expiryValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,     dot: "bg-rose-500" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
            <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-700">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search batch / material / reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white"
          />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
        </div>
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={clsx(
                "px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                typeFilter === f.id ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={selectedWarehouseId}
          onChange={(e) => setSelectedWarehouseId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm text-gray-700 outline-none focus:border-[#f58220]"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={downloadCSV}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 bg-white transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Export
        </button>
        <button onClick={fetchItems} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
            <Database className="h-8 w-8 text-[#f58220]" />
          </div>
          <div>
            <p className="text-gray-800 font-semibold">No Consumption Records Found</p>
            <p className="text-gray-500 text-sm mt-1">Outward material movements will show up here.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Batch / Ref</th>
                  <th className="text-left px-4 py-3">Material</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => {
                  const source = item.consumptionType || "Production";
                  const style = SOURCE_STYLES[source] || DEFAULT_SOURCE_STYLE;
                  const prefix = source === "Production Consumption" ? "PRD" : source === "Damage" ? "WST" : source === "Expiry" ? "EXP" : "ADJ";

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">
                        {prefix}-{item.id.substring(0, 4).toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-800">{item.itemName}</span>
                        {item.sku && <span className="ml-1.5 text-xs text-gray-400">({item.sku})</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx("font-medium", item.quantity < 0 ? "text-rose-600" : "text-gray-800")}>
                          {item.quantity.toFixed(2)}
                        </span>
                        <span className="ml-1 text-xs text-gray-400">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
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
