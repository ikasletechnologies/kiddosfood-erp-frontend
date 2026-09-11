"use client";

import { useEffect, useState, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  Edit2, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  MapPin, 
  Package, 
  X, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  RefreshCw,
  Warehouse as WarehouseIcon,
  Boxes,
  Lock,
  ArrowUpDown
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { WarehouseApi, Warehouse, WarehouseStockItem, WarehouseBin, WarehouseListItem } from '@/lib/api/warehouse.api';
import { inventoryApi, franchiseApi } from '@/lib/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function WarehousePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [warehouseList, setWarehouseList] = useState<WarehouseListItem[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoaded, setListLoaded] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [binFilter, setBinFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showManageBins, setShowManageBins] = useState(false);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [assignBinItem, setAssignBinItem] = useState<WarehouseStockItem | null>(null);

  // Expanded items for lot/batch breakdown
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  useEffect(() => {
    if (showManageBins || showAddWarehouse || assignBinItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showManageBins, showAddWarehouse, assignBinItem]);

  const loadWarehouseList = async () => {
    try {
      const res = await inventoryApi.getWarehouses();
      const list: WarehouseListItem[] = res.data || [];
      setWarehouseList(list);
      return list;
    } catch (err) {
      toast.error("Failed to load warehouses");
      return [];
    } finally {
      setListLoaded(true);
    }
  };

  useEffect(() => {
    async function initData() {
      if (!user) return;
      const list = await loadWarehouseList();
      if (list.length === 0) {
        setLoading(false);
        return;
      }
      if (isSuperAdmin) {
        let hqItem: WarehouseListItem | undefined;
        try {
          const fRes = await franchiseApi.getAll();
          const hqFranchise = (fRes.data || []).find((f: any) => f.isHQ);
          if (hqFranchise) hqItem = list.find((w) => w.franchiseId === hqFranchise.id);
        } catch {
          // fallback
        }
        const fallback = [...list].sort((a, b) => a.name.localeCompare(b.name))[0];
        setSelectedWarehouseId((hqItem || fallback).id);
      } else {
        setSelectedWarehouseId(list[0].id);
      }
    }
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    if (!selectedWarehouseId) return;
    setLoading(true);
    try {
      const wh = await WarehouseApi.getWarehouseById(selectedWarehouseId);
      setWarehouse(wh);
      const stockData = await WarehouseApi.getWarehouseStock(wh.id);
      setStock(stockData);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to load warehouse data');
      setWarehouse(null);
      setStock([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWarehouseId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  const handleWarehouseCreated = async (newWh: { id: string; name: string }) => {
    setShowAddWarehouse(false);
    const list = await loadWarehouseList();
    setSelectedWarehouseId(newWh.id);
    toast.success(`Warehouse "${newWh.name}" created.`);
  };

  const filteredStock = useMemo(() => {
    return stock.filter(s => {
      if (search) {
        const q = search.toLowerCase();
        const matchName = s.itemName?.toLowerCase().includes(q);
        const matchSku = s.itemSku?.toLowerCase().includes(q);
        const matchBatch = s.batchCode?.toLowerCase().includes(q);
        const matchBin = s.binCode?.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchBatch && !matchBin) return false;
      }
      if (binFilter !== 'ALL') {
        if (binFilter === 'UNASSIGNED' && s.binId !== null) return false;
        if (binFilter !== 'UNASSIGNED' && s.binId !== binFilter) return false;
      }
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      return true;
    });
  }, [stock, search, binFilter, statusFilter]);

  const statuses = useMemo(() => Array.from(new Set(stock.map(s => s.status))), [stock]);
  const occupiedBins = useMemo(() => new Set(stock.filter(s => s.binId).map(s => s.binId)).size, [stock]);
  const availableBins = Math.max(0, (warehouse?.bins?.length || 0) - occupiedBins);
  const totalDistinctItems = useMemo(() => new Set(stock.map(s => s.itemId)).size, [stock]);

  type ItemGroup = {
    itemId: string;
    itemName: string;
    itemSku: string;
    unit: string;
    totalBalance: number;
    rows: WarehouseStockItem[];
  };

  const groupedStock = useMemo<ItemGroup[]>(() => {
    const map = new Map<string, ItemGroup>();
    for (const s of filteredStock) {
      let g = map.get(s.itemId);
      if (!g) {
        g = { itemId: s.itemId, itemName: s.itemName, itemSku: s.itemSku, unit: s.unit, totalBalance: 0, rows: [] };
        map.set(s.itemId, g);
      }
      g.totalBalance += s.balance;
      g.rows.push(s);
    }
    return Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [filteredStock]);

  const noWarehousesAtAll = listLoaded && warehouseList.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-800 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── Page Header & Warehouse Selector ── */}
      <div className="bg-white dark:bg-card p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Info */}
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-[#f58220] flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 truncate">
              {warehouse?.name || (listLoaded && warehouseList.length === 0 ? "Warehouse" : "Loading Warehouse...")}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {(warehouse as any)?.location || "Storage, Bins & Stock Location Management"}
            </p>
          </div>
        </div>

        {/* Primary Controls (Selector & Action Buttons) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
          {/* Warehouse Selector */}
          <div className="relative min-w-0 sm:min-w-[220px]">
            {isSuperAdmin ? (
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                disabled={warehouseList.length === 0}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-[#f58220] transition-colors cursor-pointer shadow-2xs"
              >
                {warehouseList.length === 0 ? (
                  <option value="">No warehouses found</option>
                ) : (
                  warehouseList.map((w) => (
                    <option key={w.id} value={w.id} className="dark:bg-card">
                      {w.name} {w.code ? `(${w.code})` : ""} {w.franchiseName ? `— ${w.franchiseName}` : ""}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <select
                value={selectedWarehouseId}
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-2xs"
              >
                {warehouseList.length === 0 ? (
                  <option value="">No warehouse assigned</option>
                ) : (
                  warehouseList.map((w) => (
                    <option key={w.id} value={w.id} className="dark:bg-card">
                      {w.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Refresh */}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              title="Refresh stock"
              className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl transition-all disabled:opacity-50 cursor-pointer shrink-0"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>

            {/* Manage Bins (Secondary Action) */}
            {warehouse && (
              <button
                type="button"
                onClick={() => setShowManageBins(true)}
                className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-[#f58220] hover:border-orange-200 dark:hover:border-orange-500/30 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer"
              >
                <Layers className="h-4 w-4 text-[#f58220]" />
                <span>Manage Bins</span>
              </button>
            )}

            {/* Add Warehouse (Primary Action for Super Admin) */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setShowAddWarehouse(true)}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#f58220] hover:bg-[#e07110] text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-98 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Warehouse</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {warehouse ? (
        <div className="space-y-6">
          {/* ── KPI Summary Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Items */}
            <div className="bg-white dark:bg-card p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex items-center justify-between min-w-0">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  Total Items
                </p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate">
                  {loading ? "..." : totalDistinctItems}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Package className="h-6 w-6" />
              </div>
            </div>

            {/* Occupied Bins */}
            <div className="bg-white dark:bg-card p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex items-center justify-between min-w-0">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  Occupied Bins
                </p>
                <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 truncate">
                  {loading ? "..." : occupiedBins}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Layers className="h-6 w-6" />
              </div>
            </div>

            {/* Available Bins */}
            <div className="bg-white dark:bg-card p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex items-center justify-between min-w-0">
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  Available Bins
                </p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 truncate">
                  {loading ? "..." : availableBins}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* ── Search & Filters Bar ── */}
          <div className="bg-white dark:bg-card p-4 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Stock Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search stock by item name, SKU, batch, or bin..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#f58220] transition-colors text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              {/* Bin Filter */}
              <select
                value={binFilter}
                onChange={(e) => setBinFilter(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#f58220] font-medium text-slate-800 dark:text-slate-200 cursor-pointer max-w-[180px] truncate"
              >
                <option value="ALL">All Bins</option>
                <option value="UNASSIGNED">Not Assigned</option>
                {warehouse?.bins?.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.code} {b.description ? `(${b.description})` : ''}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-[#f58220] font-medium text-slate-800 dark:text-slate-200 cursor-pointer min-w-[140px] truncate"
              >
                <option value="ALL">All Statuses</option>
                {statuses.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Stock Data Table ── */}
          <div className="bg-white dark:bg-card rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/5 bg-slate-50/75 dark:bg-white/[0.02] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Item</th>
                    <th className="py-3.5 px-4">Batch</th>
                    <th className="py-3.5 px-4">Bin</th>
                    <th className="py-3.5 px-4 text-right">Qty</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs sm:text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2.5">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#f58220]" />
                          <span className="text-xs font-medium">Loading stock data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : groupedStock.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">No stock found</span>
                          <span className="text-xs text-slate-400">No inventory matches your search and filter criteria.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groupedStock.map((g) => {
                      const isExpanded = expandedItems.has(g.itemId);
                      const assignedBinsList = Array.from(new Set(g.rows.filter(r => r.binId).map(r => r.binCode)));
                      const hasUnassigned = g.rows.some(r => !r.binId);

                      return (
                        <Fragment key={g.itemId}>
                          {/* Parent Group Row */}
                          <tr
                            onClick={() => toggleExpanded(g.itemId)}
                            className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                          >
                            {/* Item Name & SKU */}
                            <td className="py-4 px-4 sm:px-6">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1 text-slate-400 group-hover:text-[#f58220] transition-colors shrink-0">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white truncate">
                                    {g.itemName}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                                    {g.itemSku}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Batch Info */}
                            <td className="py-4 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <span className="font-medium text-xs">
                                {g.rows.length} {g.rows.length === 1 ? 'lot' : 'lots'}
                              </span>
                            </td>

                            {/* Bin Info */}
                            <td className="py-4 px-4 whitespace-nowrap">
                              {assignedBinsList.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {assignedBinsList.map((bCode) => (
                                    <span key={bCode} className="font-mono text-[11px] font-bold text-[#f58220] bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded border border-orange-200/80 dark:border-orange-900/40">
                                      {bCode}
                                    </span>
                                  ))}
                                  {hasUnassigned && (
                                    <span className="text-[10px] text-slate-400 italic">
                                      + unassigned
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700">
                                  Not Assigned
                                </span>
                              )}
                            </td>

                            {/* Qty */}
                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <span className="font-black text-slate-900 dark:text-white">
                                {g.totalBalance.toLocaleString()} <span className="text-xs text-slate-500 font-normal">{g.unit}</span>
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              {g.rows.length > 1 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  Mixed Status
                                </span>
                              ) : (
                                <StatusBadge status={g.rows[0].status} />
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(g.itemId);
                                }}
                                className="text-xs font-bold text-slate-500 hover:text-[#f58220] px-2.5 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                              >
                                {isExpanded ? "Hide Lots" : "View Lots"}
                              </button>
                            </td>
                          </tr>

                          {/* Child Drilldown Rows */}
                          {isExpanded && g.rows.map((s, idx) => (
                            <tr 
                              key={`${s.itemId}-${s.batchId}-${s.binId}-${idx}`}
                              className="bg-slate-50/75 dark:bg-white/[0.015] hover:bg-slate-100/75 dark:hover:bg-white/[0.03] transition-colors border-l-2 border-l-[#f58220]"
                            >
                              <td className="pl-12 sm:pl-16 pr-4 py-3 whitespace-nowrap text-xs text-slate-400">
                                <span className="text-[11px] font-medium text-slate-400">
                                  Lot #{idx + 1}
                                </span>
                              </td>

                              <td className="py-3 px-4 font-mono font-bold text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {s.batchCode || "No Batch Code"}
                              </td>

                              <td className="py-3 px-4 whitespace-nowrap">
                                {s.binId ? (
                                  <span className="font-mono text-xs font-bold text-[#f58220] bg-orange-50 dark:bg-orange-950/40 px-2.5 py-0.5 rounded-md border border-orange-200/80 dark:border-orange-900/40 inline-block">
                                    {s.binCode}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700">
                                    Not Assigned
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap text-xs">
                                {s.balance.toLocaleString()} <span className="text-[11px] text-slate-400 font-normal">{s.unit}</span>
                              </td>

                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <StatusBadge status={s.status} />
                              </td>

                              <td className="py-3 px-4 sm:px-6 text-right whitespace-nowrap">
                                {!s.binId && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssignBinItem(s);
                                    }}
                                    className="px-3 py-1 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 dark:hover:bg-orange-900/40 text-[#f58220] border border-orange-200 dark:border-orange-900/40 rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <MapPin className="h-3 w-3" />
                                    <span>Assign Bin</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : !loading && (
        <div className="bg-white dark:bg-card rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-12 text-center flex flex-col items-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/30 text-[#f58220] flex items-center justify-center mb-3">
            <Building2 className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            {isSuperAdmin ? 'No Warehouse Configured' : 'No Warehouse Assigned'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
            {isSuperAdmin
              ? (noWarehousesAtAll
                  ? 'No warehouses exist in the database yet. Click below to add the first warehouse.'
                  : 'Please select a warehouse from the header above, or create a new one.')
              : 'Your franchise does not have a primary warehouse assigned. Contact your administrator.'}
          </p>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowAddWarehouse(true)}
              className="px-4 py-2.5 bg-[#f58220] hover:bg-[#e07110] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Warehouse</span>
            </button>
          )}
        </div>
      )}

      {/* ── Add Warehouse Modal ── */}
      {showAddWarehouse && (
        <AddWarehouseModal
          onClose={() => setShowAddWarehouse(false)}
          onSuccess={handleWarehouseCreated}
        />
      )}

      {/* ── Manage Bins Drawer ── */}
      {showManageBins && warehouse && (
        <ManageBinsDrawer
          warehouse={warehouse}
          onClose={() => setShowManageBins(false)}
          onUpdate={loadData}
        />
      )}

      {/* ── Assign Bin Drawer ── */}
      {assignBinItem && warehouse && (
        <AssignBinModal
          item={assignBinItem}
          warehouse={warehouse}
          onClose={() => setAssignBinItem(null)}
          onSuccess={() => {
            setAssignBinItem(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// ─── Status Badge Component ────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const isPositive = status === 'READY' || status === 'AVAILABLE';
  const isWarning = status === 'QC_HOLD' || status === 'Mixed';
  const isDanger = status === 'BLOCKED' || status === 'REJECTED';

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
        isPositive && "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
        isWarning && "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
        isDanger && "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40",
        !isPositive && !isWarning && !isDanger && "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
      )}
    >
      <span className={clsx(
        "w-1.5 h-1.5 rounded-full",
        isPositive && "bg-emerald-500",
        isWarning && "bg-amber-500",
        isDanger && "bg-rose-500",
        !isPositive && !isWarning && !isDanger && "bg-slate-400"
      )} />
      {status ? status.replace('_', ' ') : 'Ready'}
    </span>
  );
}

// ─── Manage Bins Drawer ───────────────────────────────────────────
function ManageBinsDrawer({ 
  warehouse, 
  onClose, 
  onUpdate 
}: { 
  warehouse: Warehouse; 
  onClose: () => void; 
  onUpdate: () => void; 
}) {
  const [bins, setBins] = useState<WarehouseBin[]>(warehouse.bins || []);
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit state
  const [editingBin, setEditingBin] = useState<WarehouseBin | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [updating, setUpdating] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const suggestNextCode = (list: WarehouseBin[]) => {
    let max = 0;
    for (const b of list) {
      const match = (b.code || '').match(/^BIN-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    let next = max + 1;
    while (true) {
      const cand = `BIN-${String(next).padStart(3, '0')}`;
      if (!list.some(b => b.code?.toUpperCase() === cand.toUpperCase())) {
        return cand;
      }
      next++;
    }
  };

  useEffect(() => {
    setNewCode(suggestNextCode(bins));
  }, [bins]);

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCode.trim()) return toast.error("Bin code is required");
    setAdding(true);
    try {
      const b = await WarehouseApi.createBin(warehouse.id, { 
        code: newCode.trim().toUpperCase(), 
        description: newDesc.trim() || undefined 
      });
      setBins(prev => [...prev, b]);
      setNewDesc('');
      setShowAddForm(false);
      onUpdate();
      toast.success(`Bin "${newCode.trim().toUpperCase()}" created`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBin) return;
    if (!editCode.trim()) return toast.error("Bin code is required");

    setUpdating(true);
    try {
      const updated = await WarehouseApi.updateBin(editingBin.id, {
        code: editCode.trim().toUpperCase(),
        description: editDesc.trim() || undefined
      });
      setBins(prev => prev.map(b => b.id === editingBin.id ? { ...b, code: updated.code, description: updated.description } : b));
      setEditingBin(null);
      onUpdate();
      toast.success(`Bin updated successfully`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete bin "${code}"?`)) return;
    try {
      await WarehouseApi.deleteBin(id);
      setBins(prev => prev.filter(b => b.id !== id));
      onUpdate();
      toast.success(`Bin "${code}" removed`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Cannot delete bin that has recorded movements.");
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-Over Drawer */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#0B0D14] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 z-10 border-l border-slate-200 dark:border-slate-800">
        {/* Drawer Header */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#f58220] flex items-center justify-center shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Manage Bins</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[220px]">
                {warehouse.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Configured Bins
              </h3>
              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950/40 text-[#f58220] rounded-full text-xs font-bold">
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

          {/* Add New Bin Form Card */}
          {showAddForm && (
            <form onSubmit={handleAdd} className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/30 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#f58220] flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Storage Bin
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Bin Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BIN-001"
                    value={newCode}
                    onChange={e => setNewCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Description / Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Finished Goods Rack 1"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding || !newCode.trim()}
                    className="px-4 py-1.5 bg-[#f58220] hover:bg-[#e07110] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {adding ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    <span>Save Bin</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Edit Bin Form Card */}
          {editingBin && (
            <form onSubmit={handleUpdate} className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Edit2 className="h-3.5 w-3.5 text-[#f58220]" /> Edit Bin {editingBin.code}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingBin(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Bin Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={e => setEditCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Description / Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={editDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingBin(null)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating || !editCode.trim()}
                    className="px-4 py-1.5 bg-[#f58220] hover:bg-[#e07110] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {updating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Configured Bins List */}
          {bins.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-950/40 text-[#f58220] flex items-center justify-center mx-auto">
                <Layers className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No bins configured yet</p>
              <p className="text-[11px] text-slate-400">Click "+ Add Bin" above to configure storage bins for this warehouse.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {bins.map((b) => (
                <div
                  key={b.id}
                  className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 bg-orange-50 dark:bg-orange-950/40 text-[#f58220] border border-orange-200/80 dark:border-orange-900/40 rounded-lg text-xs font-mono font-bold shrink-0">
                      {b.code}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {b.description || "Storage Bin"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBin(b);
                        setEditCode(b.code);
                        setEditDesc(b.description || '');
                        setShowAddForm(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-[#f58220] hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-lg transition-colors cursor-pointer"
                      title="Edit Bin"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id, b.code)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                      title="Delete Bin"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Assign Bin Modal / Drawer ─────────────────────────────────────
function AssignBinModal({ 
  item, 
  warehouse, 
  onClose, 
  onSuccess 
}: { 
  item: WarehouseStockItem; 
  warehouse: Warehouse; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [selectedBin, setSelectedBin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleConfirm = async () => {
    if (!selectedBin) return;
    setSubmitting(true);
    try {
      await WarehouseApi.assignBin(warehouse.id, {
        itemId: item.itemId,
        batchId: item.batchId === 'NO_BATCH' ? undefined : item.batchId,
        quantity: item.balance,
        newBinId: selectedBin
      });
      toast.success('Bin assigned successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-Over Drawer */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#0B0D14] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 z-10 border-l border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#f58220] flex items-center justify-center shadow-xs">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Assign Bin Location</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[220px]">
                {warehouse.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Stock Item Details Card */}
          <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Item Details
            </h3>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Item Name</span>
                <span className="font-bold text-slate-900 dark:text-white">{item.itemName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Item SKU</span>
                <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{item.itemSku || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Batch / Lot</span>
                <span className="font-mono font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  {item.batchCode || "No Batch"}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-medium">Quantity to Store</span>
                <span className="text-sm font-black text-[#f58220]">
                  {item.balance.toLocaleString()} {item.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Bin Selection Section */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Select Target Bin *
            </label>

            {(!warehouse.bins || warehouse.bins.length === 0) ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl space-y-1 text-xs">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>No Bins Configured</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  No storage bins exist for this warehouse yet. Use "Manage Bins" on the main toolbar to create one first.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedBin}
                  onChange={e => setSelectedBin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-medium focus:border-[#f58220] outline-none text-slate-900 dark:text-white"
                >
                  <option value="">Choose a bin location...</option>
                  {warehouse.bins.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.code} {b.description ? `— ${b.description}` : ''}
                    </option>
                  ))}
                </select>

                {/* Visual bin selector list */}
                <div className="space-y-1.5 pt-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {warehouse.bins.map(b => {
                    const isSelected = selectedBin === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBin(b.id)}
                        className={clsx(
                          "p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs",
                          isSelected
                            ? "bg-orange-50 dark:bg-orange-950/30 border-[#f58220] ring-1 ring-[#f58220]"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-200"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={clsx(
                            "px-2 py-0.5 rounded-md font-mono font-bold text-xs shrink-0",
                            isSelected ? "bg-[#f58220] text-white" : "bg-orange-50 dark:bg-orange-950/40 text-[#f58220] border border-orange-200/80"
                          )}>
                            {b.code}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                            {b.description || "Storage bin"}
                          </span>
                        </div>
                        <div className={clsx(
                          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                          isSelected ? "border-[#f58220] bg-[#f58220]" : "border-slate-300 dark:border-slate-600"
                        )}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 flex gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedBin || submitting}
            className="flex-[2] py-2 bg-[#f58220] hover:bg-[#e07110] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            <span>{submitting ? 'Assigning...' : 'Confirm Assignment'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Add Warehouse Modal ──────────────────────────────────────────
function AddWarehouseModal({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: (wh: { id: string; name: string }) => void; 
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(true);
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setCodeLoading(true);
    inventoryApi.getNextWarehouseCode()
      .then(res => {
        if (active && res.data?.code) {
          setCode(res.data.code);
        }
      })
      .catch(() => {
        if (active) setCode('WH-001');
      })
      .finally(() => {
        if (active) setCodeLoading(false);
      });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Warehouse name is required');

    setSubmitting(true);
    try {
      const response = await inventoryApi.createWarehouse({
        name: name.trim(),
        code: code || undefined,
        location: location.trim() || undefined,
        status
      });
      onSuccess(response.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0D14] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-950/40 text-[#f58220] rounded-xl">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Add Warehouse</h2>
              <p className="text-xs text-slate-400">Register a new storage location</p>
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
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] transition-colors text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

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
              value={codeLoading ? 'Generating code...' : code}
              className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl cursor-not-allowed select-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Location / Address
            </label>
            <textarea
              placeholder="Street address, City, State..."
              rows={2}
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#f58220] transition-colors text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStatus('ACTIVE')}
                className={clsx(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer",
                  status === 'ACTIVE'
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-500/20"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                )}
              >
                <span className={clsx("w-2 h-2 rounded-full", status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600")} />
                Active
              </button>

              <button
                type="button"
                onClick={() => setStatus('INACTIVE')}
                className={clsx(
                  "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all select-none cursor-pointer",
                  status === 'INACTIVE'
                    ? "border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs ring-2 ring-slate-400/20"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                )}
              >
                <span className={clsx("w-2 h-2 rounded-full", status === 'INACTIVE' ? "bg-slate-500" : "bg-slate-300 dark:bg-slate-600")} />
                Inactive
              </button>
            </div>
          </div>

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
              <span>{submitting ? 'Creating...' : 'Create Warehouse'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
