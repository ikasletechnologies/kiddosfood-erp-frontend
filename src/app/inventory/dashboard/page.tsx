"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, AlertTriangle, TrendingUp, TrendingDown,
  RefreshCw, Search, Loader2, BarChart3, ArrowUpRight, ArrowDownRight, X } from "lucide-react";
import { inventoryApi, rawMaterialsApi } from "@/lib/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell 
} from 'recharts';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  vendor?: { name: string };
  updatedAt: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  RAW_MATERIAL:   { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-100" },
  SEMI_FINISHED:  { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100" },
  FINISHED_GOOD:  { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-100" },
  PACKAGING:      { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-100" },
};

export default function InventoryDashboardPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, movRes] = await Promise.all([
        inventoryApi.getInventory(),
        inventoryApi.getMovements({ take: 20 }),
      ]);
      setItems(invRes.data?.items || invRes.data || []);
      setMovements(movRes.data?.movements || movRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateThreshold = async (itemId: string) => {
    setUpdating(true);
    try {
      const val = parseFloat(editValue);
      if (isNaN(val)) return;
      await rawMaterialsApi.update(itemId, { minimumStock: val });
      setEditingId(null);
      fetchData();
    } catch (e) {
      console.error("Failed to update threshold", e);
    } finally {
      setUpdating(false);
    }
  };

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "ALL" || item.category === filterCat;
    const isLow = item.currentStock <= item.minimumStock;
    const matchStatus =
      filterStatus === "ALL" ? true :
      filterStatus === "LOW" ? isLow :
      filterStatus === "OK" ? !isLow : true;
    return matchSearch && matchCat && matchStatus;
  });

  const lowStockCount = items.filter(i => i.currentStock <= i.minimumStock).length;
  const totalValue = items.reduce((s, i) => s + i.currentStock, 0);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);

  const stockPercent = (item: InventoryItem) =>
    Math.min(100, Math.round((item.currentStock / Math.max(item.minimumStock * 2, 1)) * 100));

  return (
    <div className="min-h-screen bg-[#FAFAF9] p-4 sm:p-6 md:p-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[#999] hover:text-[#1A1A1A] text-sm font-medium mb-4 sm:mb-8">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center justify-end gap-4 mb-6">
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              onClick={fetchData}
              className="p-3 bg-white border border-[#F0EAF0] rounded-xl text-[#666] hover:bg-slate-50 transition-all shrink-0"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => router.push("/purchases/grn")}
              className="flex-1 sm:flex-initial justify-center px-5 py-3 bg-[#7C3AED] text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-purple-200 hover:bg-[#6D28D9] transition-all whitespace-nowrap"
            >
              <Package size={16} /> Receive Goods (GRN)
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total SKUs",     value: items.length,                                     icon: Package,       color: "text-[#7C3AED]", bg: "bg-purple-50"  },
            { label: "Low Stock",      value: lowStockCount,                                    icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50"     },
            { label: "Categories",     value: Array.from(new Set(items.map(i => i.category))).length,  icon: BarChart3,     color: "text-blue-600",   bg: "bg-blue-50"    },
            { label: "Total Units",    value: totalValue.toFixed(0),                            icon: TrendingUp,    color: "text-green-600",  bg: "bg-green-50"   },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-white rounded-2xl p-4 sm:p-5 border border-[#F0EAF0] shadow-sm">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 ${kpi.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={kpi.color} size={16} />
                </div>
                <p className="text-[9px] sm:text-[10px] font-bold text-[#999] uppercase tracking-widest mb-1">{kpi.label}</p>
                <p className={`text-2xl sm:text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
              </div>
            );
          })}
        </div>

        {/* Low Stock Alert Banner */}
        {lowStockCount > 0 && (
          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-2xl">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-600" size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-red-900">{lowStockCount} item{lowStockCount > 1 ? "s" : ""} below minimum stock</p>
                <p className="text-xs text-red-700 font-medium">Raise a PO or GRN to replenish these items immediately.</p>
              </div>
              <button
                onClick={() => setFilterStatus("LOW")}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all text-nowrap text-center"
              >
                Focus Low Stock
              </button>
            </div>
            
            <div className="flex-1 bg-white border border-[#F0EAF0] p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">At-Risk Stock Monitor</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-[9px] font-bold text-slate-500">Critical Status</span>
                  </div>
                </div>
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={items.filter(i => (i.currentStock / i.minimumStock) <= 1.5).sort((a,b) => (a.currentStock/a.minimumStock) - (b.currentStock/b.minimumStock)).slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" hide />
                      <YAxis hide />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                             const data = payload[0].payload;
                             return (
                               <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl">
                                 <p className="text-[10px] font-black uppercase text-slate-900 mb-1">{data.name}</p>
                                 <p className="text-[9px] font-bold text-red-500">{data.currentStock} / {data.minimumStock} {data.unit}</p>
                               </div>
                             );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="currentStock" radius={[4, 4, 0, 0]}>
                        {items.filter(i => (i.currentStock / i.minimumStock) <= 1.5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.currentStock <= entry.minimumStock ? "#ef4444" : "#f59e0b"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items Table */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" size={14} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search items..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#F0EAF0] rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
                />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
              </div>
              <div className="flex gap-2">
                <select
                  value={filterCat}
                  onChange={e => setFilterCat(e.target.value)}
                  className="flex-1 sm:flex-initial px-3 py-2.5 bg-white border border-[#F0EAF0] rounded-xl text-xs font-bold text-[#666] focus:outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="RAW_MATERIAL">Raw Material</option>
                  <option value="SEMI_FINISHED">Semi-Finished</option>
                  <option value="FINISHED_GOOD">Finished Good</option>
                  <option value="PACKAGING">Packaging</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="flex-1 sm:flex-initial px-3 py-2.5 bg-white border border-[#F0EAF0] rounded-xl text-xs font-bold text-[#666] focus:outline-none"
                >
                  <option value="ALL">All Stock</option>
                  <option value="LOW">Low Stock</option>
                  <option value="OK">In Stock</option>
                </select>
              </div>
            </div>

            {/* Items */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-[#7C3AED]" size={32} />
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(item => {
                  const isLow = item.currentStock <= item.minimumStock;
                  const pct = stockPercent(item);
                  const catStyle = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.RAW_MATERIAL;
                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl p-5 border transition-all hover:shadow-md ${
                        isLow ? "border-red-100 shadow-red-50/50" : "border-[#F0EAF0]"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-black text-[#1A1A1A] text-sm">{item.name}</p>
                            {isLow && (
                              <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                LOW
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-[#999] font-bold">{item.sku}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${catStyle.bg} ${catStyle.text}`}>
                              {item.category.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-black ${isLow ? "text-red-600" : "text-[#1A1A1A]"}`}>
                            {item.currentStock}
                          </p>
                          <p className="text-[11px] text-[#999] font-medium">{item.unit}</p>
                        </div>
                      </div>
                      {/* Stock bar */}
                      <div className="space-y-1">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct < 30 ? "bg-red-500" : pct < 60 ? "bg-amber-400" : "bg-green-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-[#999] font-medium">
                           <div className="flex items-center gap-1 group/edit">
                              <span>Min:</span>
                              {editingId === item.id ? (
                                <div className="flex items-center gap-1">
                                  <input 
                                    autoFocus
                                    className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleUpdateThreshold(item.id)}
                                    disabled={updating}
                                  />
                                  <button onClick={() => handleUpdateThreshold(item.id)} className="text-emerald-500 hover:text-emerald-600">
                                    <TrendingUp size={10} />
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="text-slate-400">
                                    <ArrowLeft size={10} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => { setEditingId(item.id); setEditValue(item.minimumStock.toString()); }}
                                  className="flex items-center gap-1 hover:text-purple-600 transition-colors"
                                >
                                  <span className="underline decoration-dotted">{item.minimumStock} {item.unit}</span>
                                  <ArrowUpRight size={10} className="opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                                </button>
                              )}
                           </div>
                           <span>{pct}% stocked</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <div className="text-center py-16 text-[#999]">
                    <Package size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-bold">No items match your filters</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Movements */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-[#1A1A1A] uppercase tracking-tight">Recent Movements</h3>
            <div className="space-y-3">
              {movements.slice(0, 15).map((m: any) => {
                const isIn = ["PURCHASE_IN", "PRODUCTION_IN", "TRANSFER_IN", "ADJUSTMENT"].includes(m.movementType);
                return (
                  <div key={m.id} className="bg-white rounded-xl p-4 border border-[#F0EAF0] flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isIn ? "bg-green-50" : "bg-red-50"
                    }`}>
                      {isIn
                        ? <ArrowUpRight className="text-green-600" size={14} />
                        : <ArrowDownRight className="text-red-600" size={14} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#1A1A1A] truncate">{m.item?.name || "—"}</p>
                      <p className="text-[10px] text-[#999] font-medium">
                        {m.movementType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className={`text-sm font-black ${isIn ? "text-green-600" : "text-red-600"}`}>
                      {isIn ? "+" : "-"}{m.quantity}
                    </span>
                  </div>
                );
              })}
              {movements.length === 0 && !loading && (
                <p className="text-center text-[#999] text-xs font-medium py-8">No recent movements</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
