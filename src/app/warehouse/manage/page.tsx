"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Warehouse as WarehouseIcon, 
  Plus, 
  Search, 
  RefreshCw, 
  Edit3, 
  Eye, 
  MapPin, 
  Tag, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Building2, 
  Layers, 
  ArrowUpDown,
  Lock,
  Trash2,
  Package,
  Boxes,
  ChevronRight
} from "lucide-react";
import { inventoryApi } from "@/lib/api";
import { WarehouseApi, WarehouseBin, WarehouseBinDetail } from "@/lib/api/warehouse.api";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import clsx from "clsx";

interface WarehouseRecord {
  id: string;
  name: string;
  code: string | null;
  status: string;
  location: string | null;
  type: string | null;
  createdAt: string;
  updatedAt: string;
  binsCount?: number;
  batchCount?: number;
  movementsCount?: number;
  franchiseId?: string | null;
  franchiseName?: string | null;
}

export default function ManageWarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [warehouseToEdit, setWarehouseToEdit] = useState<WarehouseRecord | null>(null);
  const [viewingWarehouse, setViewingWarehouse] = useState<WarehouseRecord | null>(null);
  const [warehouseForBins, setWarehouseForBins] = useState<WarehouseRecord | null>(null);

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getWarehouses({ includeInactive: true });
      setWarehouses(res.data || []);
    } catch (err: any) {
      console.error("Failed to load warehouses:", err);
      toast.error(err?.response?.data?.error || "Failed to load warehouses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  // Statistics
  const totalCount = warehouses.length;
  const activeCount = useMemo(() => warehouses.filter(w => (w.status || "ACTIVE") === "ACTIVE").length, [warehouses]);
  const inactiveCount = useMemo(() => warehouses.filter(w => (w.status || "ACTIVE") === "INACTIVE").length, [warehouses]);
  const totalBinsCount = useMemo(() => warehouses.reduce((sum, w) => sum + (w.binsCount || 0), 0), [warehouses]);

  // Filtered warehouses
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter(wh => {
      const matchesStatus = 
        statusFilter === "ALL" ? true :
        statusFilter === "ACTIVE" ? (wh.status || "ACTIVE") === "ACTIVE" :
        (wh.status || "ACTIVE") === "INACTIVE";

      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = (wh.name || "").toLowerCase().includes(q);
      const matchCode = (wh.code || "").toLowerCase().includes(q);
      const matchLocation = (wh.location || "").toLowerCase().includes(q);
      const matchFranchise = (wh.franchiseName || "").toLowerCase().includes(q);

      return matchName || matchCode || matchLocation || matchFranchise;
    });
  }, [warehouses, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-800 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-[#f58220] flex items-center justify-center shrink-0">
            <WarehouseIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Manage Warehouses
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage all warehouses, storage capacity, and configured bins.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 self-end sm:self-auto">
          <button
            type="button"
            onClick={fetchWarehouses}
            disabled={loading}
            title="Refresh list"
            className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-[#f58220] hover:bg-[#e07110] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 active:scale-98 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Warehouse</span>
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Warehouses */}
        <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Total Warehouses</p>
            <p className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white truncate">
              {loading ? "..." : totalCount}
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        {/* Total Storage Bins */}
        <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Total Bins</p>
            <p className="text-xl sm:text-3xl font-black text-[#f58220] truncate">
              {loading ? "..." : totalBinsCount}
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#f58220] flex items-center justify-center shrink-0">
            <Layers className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        {/* Active Warehouses */}
        <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Active Warehouses</p>
            <p className="text-xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 truncate">
              {loading ? "..." : activeCount}
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>

        {/* Inactive Warehouses */}
        <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex items-center justify-between min-w-0">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">Inactive Warehouses</p>
            <p className="text-xl sm:text-3xl font-black text-slate-600 dark:text-slate-400 truncate">
              {loading ? "..." : inactiveCount}
            </p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white dark:bg-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by warehouse name, code, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#f58220] transition-colors text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl shrink-0 self-start md:self-auto">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((status) => {
            const isActive = statusFilter === status;
            const count = status === "ALL" ? totalCount : status === "ACTIVE" ? activeCount : inactiveCount;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={clsx(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                  isActive
                    ? "bg-white dark:bg-card text-[#f58220] shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <span>{status === "ALL" ? "All" : status === "ACTIVE" ? "Active" : "Inactive"}</span>
                <span className={clsx(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  isActive ? "bg-orange-50 dark:bg-orange-950/50 text-[#f58220]" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Warehouses Table ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[#f58220]" />
            <p className="text-xs sm:text-sm font-medium">Loading warehouses...</p>
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/30 text-[#f58220] flex items-center justify-center mb-3">
              <WarehouseIcon className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Warehouses Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              {searchQuery || statusFilter !== "ALL"
                ? "No warehouses match your current search or filter criteria. Try adjusting your query."
                : "No warehouses currently exist in the database. Click '+ Add Warehouse' to create the first one."}
            </p>
            {(!searchQuery && statusFilter === "ALL") && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-[#f58220] hover:bg-[#e07110] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                + Add Warehouse
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/5 bg-slate-50/75 dark:bg-white/[0.02] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Warehouse Name</th>
                  <th className="py-3.5 px-4">Warehouse Code</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4 text-center">Storage Bins</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs sm:text-sm">
                {filteredWarehouses.map((wh) => {
                  const isActive = (wh.status || "ACTIVE") === "ACTIVE";
                  const binsCount = wh.binsCount || 0;

                  return (
                    <tr 
                      key={wh.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Name */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-[#f58220] flex items-center justify-center shrink-0 font-black text-xs">
                            {wh.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {wh.name}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5">
                              {wh.franchiseName && (
                                <span className="text-slate-500 truncate">
                                  Primary: {wh.franchiseName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-4 px-4">
                        {wh.code ? (
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60 inline-block">
                            {wh.code}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">No code</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                        {wh.location ? (
                          <div className="flex items-center gap-1.5 max-w-xs truncate" title={wh.location}>
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{wh.location}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Storage Bins */}
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setWarehouseForBins(wh)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 dark:bg-orange-950/40 text-[#f58220] hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-900/40 rounded-xl text-xs font-bold transition-all cursor-pointer group/bin shadow-2xs"
                          title="Manage Bins for this Warehouse"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>{binsCount} {binsCount === 1 ? "Bin" : "Bins"}</span>
                          <ChevronRight className="h-3 w-3 opacity-60 group-hover/bin:translate-x-0.5 transition-transform" />
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border",
                            isActive
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                          )}
                        >
                          <span className={clsx("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-slate-400")} />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatDate(wh.createdAt || new Date())}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setWarehouseForBins(wh)}
                            title="Manage Bins"
                            className="p-1.5 text-slate-500 hover:text-[#f58220] hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Layers className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewingWarehouse(wh)}
                            title="View Warehouse Details"
                            className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setWarehouseToEdit(wh)}
                            title="Edit Warehouse"
                            className="p-1.5 text-slate-500 hover:text-[#f58220] hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Warehouse Modal ── */}
      {showAddModal && (
        <AddWarehouseDialog
          onClose={() => setShowAddModal(false)}
          onSuccess={(newWh) => {
            setShowAddModal(false);
            fetchWarehouses();
            toast.success(`Warehouse "${newWh.name}" created successfully`);
          }}
        />
      )}

      {/* ── Edit Warehouse Modal ── */}
      {warehouseToEdit && (
        <EditWarehouseDialog
          warehouse={warehouseToEdit}
          onClose={() => setWarehouseToEdit(null)}
          onSuccess={(updated) => {
            setWarehouseToEdit(null);
            fetchWarehouses();
            toast.success(`Warehouse "${updated.name}" updated successfully`);
          }}
        />
      )}

      {/* ── View Warehouse Details Modal ── */}
      {viewingWarehouse && (
        <ViewWarehouseDetailsModal
          warehouse={viewingWarehouse}
          onClose={() => setViewingWarehouse(null)}
          onEdit={() => {
            const wh = viewingWarehouse;
            setViewingWarehouse(null);
            setWarehouseToEdit(wh);
          }}
          onManageBins={() => {
            const wh = viewingWarehouse;
            setViewingWarehouse(null);
            setWarehouseForBins(wh);
          }}
        />
      )}

      {/* ── Manage Bins Drawer / Modal ── */}
      {warehouseForBins && (
        <IntegratedManageBinsModal
          warehouse={warehouseForBins}
          onClose={() => setWarehouseForBins(null)}
          onUpdate={fetchWarehouses}
        />
      )}
    </div>
  );
}

// ─── Add Warehouse Dialog ──────────────────────────────────────────
function AddWarehouseDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (wh: any) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(true);
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [type, setType] = useState("STANDARD");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setCodeLoading(true);
    inventoryApi.getNextWarehouseCode()
      .then(res => {
        if (active && res.data?.code) setCode(res.data.code);
      })
      .catch(() => {
        if (active) setCode("WH-001");
      })
      .finally(() => {
        if (active) setCodeLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Warehouse name is required");

    setSubmitting(true);
    try {
      const res = await inventoryApi.createWarehouse({
        name: name.trim(),
        code: code || undefined,
        location: location.trim() || undefined,
        type: type || undefined,
        status
      });
      onSuccess(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to create warehouse");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0D14] w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-950/40 text-[#f58220] rounded-xl">
              <WarehouseIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Add Warehouse</h2>
              <p className="text-xs text-slate-400">Register a new storage location</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Warehouse Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Warehouse Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Central Warehouse, Cold Storage Hub"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] transition-colors text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          {/* Warehouse Code */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Warehouse Code
              </label>
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-900/50 flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Auto-generated
              </span>
            </div>
            <input
              type="text"
              readOnly
              disabled
              value={codeLoading ? "Generating code..." : (code || "WH-001")}
              className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl cursor-not-allowed select-none"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Location / Address
            </label>
            <textarea
              placeholder="Street address, City, State..."
              rows={2}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] transition-colors text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus("ACTIVE")}
                className={clsx(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer",
                  status === "ACTIVE"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-500/20"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                )}
              >
                <span className={clsx("w-2 h-2 rounded-full", status === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600")} />
                Active
              </button>

              <button
                type="button"
                onClick={() => setStatus("INACTIVE")}
                className={clsx(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer",
                  status === "INACTIVE"
                    ? "border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs ring-2 ring-slate-400/20"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                )}
              >
                <span className={clsx("w-2 h-2 rounded-full", status === "INACTIVE" ? "bg-slate-500" : "bg-slate-300 dark:bg-slate-600")} />
                Inactive
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2 bg-[#f58220] hover:bg-[#e07110] text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{submitting ? "Creating..." : "Create Warehouse"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Warehouse Dialog ─────────────────────────────────────────
function EditWarehouseDialog({ warehouse, onClose, onSuccess }: { warehouse: WarehouseRecord; onClose: () => void; onSuccess: (wh: any) => void }) {
  const [name, setName] = useState(warehouse.name || "");
  const [location, setLocation] = useState(warehouse.location || "");
  const [status, setStatus] = useState<string>(warehouse.status ? String(warehouse.status).toUpperCase() : "ACTIVE");
  const [type, setType] = useState(warehouse.type || "STANDARD");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (warehouse) {
      setName(warehouse.name || "");
      setLocation(warehouse.location || "");
      setStatus(warehouse.status ? String(warehouse.status).toUpperCase() : "ACTIVE");
      setType(warehouse.type || "STANDARD");
    }
  }, [warehouse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Warehouse name is required");

    setSubmitting(true);
    try {
      const res = await inventoryApi.updateWarehouse(warehouse.id, {
        name: name.trim(),
        location: location.trim() || undefined,
        status: status.toUpperCase(),
        type: type || undefined
      });
      onSuccess(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update warehouse");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0D14] w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-950/40 text-[#f58220] rounded-xl">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit Warehouse</h2>
              <p className="text-xs text-slate-400">Update warehouse information</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Warehouse Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Warehouse Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] transition-colors text-slate-900 dark:text-white"
            />
          </div>

          {/* Warehouse Code (Read-Only) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Warehouse Code
              </label>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Read-only
              </span>
            </div>
            <input
              type="text"
              readOnly
              disabled
              value={warehouse.code || "—"}
              className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl cursor-not-allowed select-none"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Location / Address
            </label>
            <textarea
              placeholder="Street address, City, State..."
              rows={2}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] transition-colors text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus("ACTIVE")}
                className={clsx(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer",
                  status === "ACTIVE"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-500/20"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                )}
              >
                <span className={clsx("w-2 h-2 rounded-full", status === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600")} />
                Active
              </button>

              <button
                type="button"
                onClick={() => setStatus("INACTIVE")}
                className={clsx(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer",
                  status === "INACTIVE"
                    ? "border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs ring-2 ring-slate-400/20"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                )}
              >
                <span className={clsx("w-2 h-2 rounded-full", status === "INACTIVE" ? "bg-slate-500" : "bg-slate-300 dark:bg-slate-600")} />
                Inactive
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2 bg-[#f58220] hover:bg-[#e07110] text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              <span>{submitting ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── View Warehouse Details Modal ──────────────────────────────────
function ViewWarehouseDetailsModal({ 
  warehouse, 
  onClose, 
  onEdit,
  onManageBins
}: { 
  warehouse: WarehouseRecord; 
  onClose: () => void; 
  onEdit: () => void;
  onManageBins: () => void;
}) {
  const isActive = (warehouse.status || "ACTIVE") === "ACTIVE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0D14] w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-950/40 text-[#f58220] rounded-xl">
              <WarehouseIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{warehouse.name}</h2>
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200"
                  )}
                >
                  <span className={clsx("w-1.5 h-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-slate-400")} />
                  {isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                {warehouse.code ? `Code: ${warehouse.code}` : "No code assigned"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 text-xs sm:text-sm">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Warehouse Code</p>
              <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                {warehouse.code || "—"}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Storage Bins</p>
                <button
                  type="button"
                  onClick={onManageBins}
                  className="text-[10px] font-bold text-[#f58220] hover:underline cursor-pointer flex items-center gap-0.5"
                >
                  Manage Bins &rarr;
                </button>
              </div>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                {warehouse.binsCount ?? 0} Bins
              </p>
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Physical Location</p>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start gap-2">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {warehouse.location || "No physical address or location specified."}
              </p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-slate-500 dark:text-slate-400 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Created At</span>
              <span>{formatDate(warehouse.createdAt || new Date())}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Updated</span>
              <span>{formatDate(warehouse.updatedAt || new Date())}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onManageBins}
              className="px-4 py-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 text-[#f58220] border border-orange-200 dark:border-orange-900/40 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Manage Bins</span>
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="px-4 py-2 bg-[#f58220] hover:bg-[#e07110] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Warehouse</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Integrated Manage Bins Drawer/Modal ───────────────────────────
function IntegratedManageBinsModal({
  warehouse,
  onClose,
  onUpdate
}: {
  warehouse: WarehouseRecord;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit Bin state
  const [editingBin, setEditingBin] = useState<any | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editCode, setEditCode] = useState("");
  const [updating, setUpdating] = useState(false);

  // Auto-generate next bin code
  const suggestNextCode = (existingBinsList: any[]) => {
    let max = 0;
    for (const b of existingBinsList) {
      const match = (b.code || "").match(/^BIN-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    let next = max + 1;
    while (true) {
      const cand = `BIN-${String(next).padStart(3, "0")}`;
      if (!existingBinsList.some(b => b.code?.toUpperCase() === cand.toUpperCase())) {
        return cand;
      }
      next++;
    }
  };

  const loadBins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await WarehouseApi.getAllBins({ warehouseId: warehouse.id });
      setBins(res || []);
      setNewCode(suggestNextCode(res || []));
    } catch (err: any) {
      console.error("Failed to load bins for warehouse:", err);
      toast.error(err?.response?.data?.error || "Failed to load bins");
    } finally {
      setLoading(false);
    }
  }, [warehouse.id]);

  useEffect(() => {
    loadBins();
  }, [loadBins]);

  const handleCreateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return toast.error("Bin code is required");

    setSaving(true);
    try {
      await WarehouseApi.createBinDirect({
        warehouseId: warehouse.id,
        code: newCode.trim().toUpperCase(),
        description: newDesc.trim() || undefined
      });
      toast.success(`Bin ${newCode.trim().toUpperCase()} created`);
      setNewDesc("");
      setShowAddForm(false);
      await loadBins();
      onUpdate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to create bin");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBin) return;
    if (!editCode.trim()) return toast.error("Bin code is required");

    setUpdating(true);
    try {
      await WarehouseApi.updateBin(editingBin.id, {
        code: editCode.trim().toUpperCase(),
        description: editDesc.trim() || undefined
      });
      toast.success(`Bin updated successfully`);
      setEditingBin(null);
      await loadBins();
      onUpdate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update bin");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteBin = async (binId: string, binCode: string) => {
    if (!confirm(`Are you sure you want to delete bin "${binCode}"?`)) return;

    try {
      await WarehouseApi.deleteBin(binId);
      toast.success(`Bin "${binCode}" deleted`);
      await loadBins();
      onUpdate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Cannot delete bin with stock movements.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0D14] w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-950/40 text-[#f58220] rounded-xl">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Manage Bins</h2>
                <span className="font-mono text-xs font-bold text-[#f58220] bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-900/40">
                  {warehouse.code || "WH"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Storage bins for <strong className="text-slate-800 dark:text-slate-200">{warehouse.name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* Action bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Configured Bins
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-full">
                {bins.length}
              </span>
            </div>

            {!showAddForm && !editingBin && (
              <button
                type="button"
                onClick={() => {
                  setNewCode(suggestNextCode(bins));
                  setShowAddForm(true);
                }}
                className="px-3 py-1.5 bg-[#f58220] hover:bg-[#e07110] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Bin</span>
              </button>
            )}
          </div>

          {/* Add Bin Form */}
          {showAddForm && (
            <form onSubmit={handleCreateBin} className="p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl border border-orange-200/70 dark:border-orange-900/30 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#f58220] flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Storage Bin
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Bin Code *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. BIN-001"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#f58220] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Bin Name / Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rack A - Top Shelf"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#f58220] text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newCode.trim()}
                  className="px-4 py-1.5 bg-[#f58220] hover:bg-[#e07110] text-white text-xs font-bold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  <span>Save Bin</span>
                </button>
              </div>
            </form>
          )}

          {/* Edit Bin Form */}
          {editingBin && (
            <form onSubmit={handleUpdateBin} className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5 text-[#f58220]" /> Edit Bin {editingBin.code}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingBin(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Bin Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#f58220] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Bin Name / Description
                  </label>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#f58220] text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingBin(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating || !editCode.trim()}
                  className="px-4 py-1.5 bg-[#f58220] hover:bg-[#e07110] text-white text-xs font-bold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {updating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          )}

          {/* Bins List Table */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-[#f58220]" />
              <p className="text-xs">Loading bins...</p>
            </div>
          ) : bins.length === 0 ? (
            <div className="py-12 text-center p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <Layers className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Bins Configured Yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Click "+ Add Bin" above to configure the first storage bin for this warehouse.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {bins.map((bin) => {
                const hasStock = bin.hasStock || (bin.itemCount && bin.itemCount > 0);

                return (
                  <div
                    key={bin.id}
                    className="p-3.5 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-[#f58220] bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-lg border border-orange-200/80 dark:border-orange-900/40 shrink-0">
                        {bin.code}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {bin.description || "Standard Storage Bin"}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {hasStock ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              ● Occupied ({bin.itemCount || 1} items)
                            </span>
                          ) : (
                            <span className="text-slate-400">● Available (Empty)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBin(bin);
                          setEditCode(bin.code);
                          setEditDesc(bin.description || "");
                          setShowAddForm(false);
                        }}
                        className="p-1.5 text-slate-400 hover:text-[#f58220] hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Edit Bin"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBin(bin.id, bin.code)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Delete Bin"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
