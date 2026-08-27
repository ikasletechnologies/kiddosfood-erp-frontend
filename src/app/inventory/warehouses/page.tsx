"use client";

import { useState, useEffect } from "react";
import { 
  Warehouse, Plus, Search, Filter, 
  MapPin, Tag, ChevronRight, 
  MoreVertical, Edit2, Trash2, 
  Loader2, RefreshCcw, LayoutGrid, List,
  PackageSearch, X
} from "lucide-react";
import { inventoryApi } from "@/lib/api";
import WarehouseFormSidebar from "@/components/modals/WarehouseFormSidebar";
import toast from "react-hot-toast";
import { clsx } from "clsx";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [warehouseToEdit, setWarehouseToEdit] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [stockWarehouse, setStockWarehouse] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);
  const [stockLoading, setStockLoading] = useState(false);

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const response = await inventoryApi.getWarehouses();
      setWarehouses(response.data);
    } catch (error) {
      toast.error("Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleEdit = (warehouse: any) => {
    setWarehouseToEdit(warehouse);
    setShowSidebar(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this warehouse? This action cannot be undone.")) return;
    
    try {
      await inventoryApi.deleteWarehouse(id);
      toast.success("Warehouse deleted successfully");
      setWarehouses(prev => prev.filter(w => w.id !== id));
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete warehouse");
    }
  };

  const handleViewStock = async (warehouse: any) => {
    setStockWarehouse(warehouse);
    setStockLoading(true);
    try {
      const res = await inventoryApi.getWarehouseStock(warehouse.id);
      setStockReport(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to load warehouse stock");
    } finally {
      setStockLoading(false);
    }
  };

  const filteredWarehouses = warehouses.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-100px)] bg-slate-50 dark:bg-[#0b0c14] -m-4 overflow-hidden selection:bg-orange-500/30 selection:text-orange-500 transition-colors">
      <WarehouseFormSidebar 
        isOpen={showSidebar}
        onClose={() => {
          setShowSidebar(false);
          setWarehouseToEdit(null);
        }}
        warehouseToEdit={warehouseToEdit}
        onSuccess={(newW) => {
          if (warehouseToEdit) {
            setWarehouses(prev => prev.map(w => w.id === newW.id ? newW : w));
          } else {
            setWarehouses(prev => [...prev, newW]);
          }
        }}
      />

      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
        {/* Header Toolbar */}
        <div className="flex items-center justify-end gap-4 pb-4 border-b border-slate-200 dark:border-white/5">

          <button 
            onClick={() => setShowSidebar(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-orange-500/20 active:scale-95"
          >
            <Plus size={16} /> Add Location
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Search by name or location..."
              className="w-full bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-xl py-3 pl-10 pr-4 text-xs font-bold outline-none focus:ring-2 ring-orange-500/20 transition-all text-slate-900 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
          </div>
          
          <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-white/5">
            <button 
              onClick={() => setViewMode("grid")}
              className={clsx(
                "p-2 rounded-lg transition-all",
                viewMode === "grid" ? "bg-slate-100 dark:bg-white/10 text-orange-600 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={clsx(
                "p-2 rounded-lg transition-all",
                viewMode === "list" ? "bg-slate-100 dark:bg-white/10 text-orange-600 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <List size={16} />
            </button>
          </div>

          <button 
            onClick={fetchWarehouses}
            className="p-3 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 text-slate-400 hover:text-orange-500 rounded-xl transition-all"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <Loader2 size={30} className="animate-spin text-orange-500" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Loading Locations...</p>
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-2xl p-16 flex flex-col items-center text-center space-y-4">
            <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-full">
              <Warehouse size={40} className="text-slate-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Locations Found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Start by adding your first warehouse or distribution center.
              </p>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWarehouses.map((w) => (
              <div 
                key={w.id}
                className="bg-white dark:bg-slate-900/40 rounded-2xl p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all group relative"
              >
                <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEdit(w)}
                    className="p-1.5 text-slate-400 hover:text-orange-500 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDelete(w.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-400 group-hover:text-orange-500 transition-colors">
                    <Warehouse size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{w.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={clsx(
                        "w-1.5 h-1.5 rounded-full",
                        w.type === "MAIN" ? "bg-emerald-500" : "bg-blue-500"
                      )} />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">{w.type || "MAIN"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-start gap-2 text-xs font-medium text-slate-500">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span>{w.location || "No address provided"}</span>
                  </div>
                  <button
                    onClick={() => handleViewStock(w)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 dark:bg-white/5 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-slate-500 hover:text-orange-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    <PackageSearch size={13} /> View Stock
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5">
                  <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">Warehouse</th>
                  <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">Type</th>
                  <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">Location</th>
                  <th className="p-4 text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredWarehouses.map((w) => (
                  <tr key={w.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-white/10 rounded-lg text-slate-400">
                          <Warehouse size={16} />
                        </div>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{w.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-md text-[10px] font-bold uppercase tracking-[0.1em]">
                        {w.type || "MAIN"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <MapPin size={14} className="text-slate-400" />
                        {w.location || "N/A"}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleViewStock(w)}
                          className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-orange-500 transition-colors shadow-sm"
                        >
                          <PackageSearch size={14} />
                        </button>
                        <button
                          onClick={() => handleEdit(w)}
                          className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-orange-500 transition-colors shadow-sm"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(w.id)}
                          className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-colors shadow-sm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warehouse Stock Modal */}
      {stockWarehouse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Warehouse size={18} className="text-orange-500" /> {stockWarehouse.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Current stock balance in this location</p>
              </div>
              <button onClick={() => { setStockWarehouse(null); setStockReport(null); }} className="p-2 text-slate-400 hover:text-slate-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {stockLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 size={26} className="animate-spin text-orange-500" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Loading Stock...</p>
                </div>
              ) : !stockReport || stockReport.balances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <PackageSearch size={32} className="text-slate-300" />
                  <p className="text-sm font-semibold text-slate-500">No stock recorded in this warehouse yet.</p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Items tagged directly to this warehouse (via GRN or transfers), or belonging to a franchise
                    whose primary warehouse this is, will show up here once they have movement.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                      <th className="pb-2">Item</th>
                      <th className="pb-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                    {stockReport.balances.map((b: any) => (
                      <tr key={b.itemId}>
                        <td className="py-2.5">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{b.name}</p>
                          <p className="text-[10px] text-slate-400">SKU: {b.sku}</p>
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {b.balance.toLocaleString()} <span className="text-[10px] text-slate-400 font-sans">{b.unit}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
