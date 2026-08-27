"use client";

import { useEffect, useState, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Building2, Search, Filter, Plus, Edit2, CheckCircle2, AlertTriangle, Layers, MapPin, Package, X, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { WarehouseApi, Warehouse, WarehouseStockItem, WarehouseBin, WarehouseListItem } from '@/lib/api/warehouse.api';
import { inventoryApi, franchiseApi } from '@/lib/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function WarehousePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // The selector lists real Warehouse rows, not franchises — GET
  // /api/warehouses already returns everything SUPER_ADMIN can see (or just
  // the caller's own franchise's primary warehouse for FRANCHISE_ADMIN),
  // enriched with franchiseId/franchiseName. See inventoryApi.getWarehouses.
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

  // Which item rows are expanded to show their batch/bin breakdown. The
  // table's primary row is the net physical qty per item (summed across all
  // its batch+bin rows) — drilling in shows the underlying lots, same idea
  // as the ingredient-cost breakdown on the Batch Manufacturing detail view.
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
        // Deterministic default: the HQ franchise's warehouse if one is
        // resolvable via Franchise.isHQ (never guessed from a name/code),
        // otherwise alphabetically-first — Super Admin is never locked to
        // it and can pick any warehouse from the dropdown.
        let hqItem: WarehouseListItem | undefined;
        try {
          const fRes = await franchiseApi.getAll();
          const hqFranchise = (fRes.data || []).find((f: any) => f.isHQ);
          if (hqFranchise) hqItem = list.find((w) => w.franchiseId === hqFranchise.id);
        } catch {
          // Non-fatal — falls through to the alphabetical fallback below.
        }
        const fallback = [...list].sort((a, b) => a.name.localeCompare(b.name))[0];
        setSelectedWarehouseId((hqItem || fallback).id);
      } else {
        // FRANCHISE_ADMIN: the list already only ever contains their own
        // franchise's primary warehouse (enforced server-side).
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
    await loadWarehouseList();
    setSelectedWarehouseId(newWh.id);
    toast.success(`Warehouse "${newWh.name}" created.`);
  };

  const filteredStock = useMemo(() => {
    return stock.filter(s => {
      if (search && !s.itemName.toLowerCase().includes(search.toLowerCase()) && !s.itemSku.toLowerCase().includes(search.toLowerCase())) return false;
      if (binFilter !== 'ALL' && s.binId !== binFilter) {
        // Special case: 'UNASSIGNED' means binId is null
        if (binFilter === 'UNASSIGNED' && s.binId === null) return true;
        if (binFilter === 'UNASSIGNED' && s.binId !== null) return false;
        if (binFilter !== 'UNASSIGNED') return false;
      }
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      return true;
    });
  }, [stock, search, binFilter, statusFilter]);

  const statuses = useMemo(() => Array.from(new Set(stock.map(s => s.status))), [stock]);
  const occupiedBins = useMemo(() => new Set(stock.filter(s => s.binId).map(s => s.binId)).size, [stock]);
  const availableBins = (warehouse?.bins.length || 0) - occupiedBins;
  const totalDistinctItems = useMemo(() => new Set(stock.map(s => s.itemId)).size, [stock]);

  // Net physical balance per item, rolled up across every batch/bin row —
  // this is what "what's physically here" means: summing across all of an
  // item's rows cancels out correctly even when an individual movement's
  // batchId doesn't line up with the lot it originally came from (FIFO
  // consumption spanning multiple lots leaves batchId null on that
  // movement). The per-batch/bin rows are kept underneath as the drill-down.
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
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
            <div className="flex items-center gap-3">
              {isSuperAdmin ? (
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  disabled={warehouseList.length === 0}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  {warehouseList.length === 0 ? (
                    <option value="">No warehouses</option>
                  ) : (
                    warehouseList.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}{w.franchiseName ? ` — ${w.franchiseName}` : ''}</option>
                    ))
                  )}
                </select>
              ) : (
                // FRANCHISE_ADMIN: their own warehouse only, no other
                // franchise's warehouse is ever selectable here.
                <select
                  value={selectedWarehouseId}
                  disabled
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 cursor-not-allowed"
                >
                  {warehouseList.length === 0 ? (
                    <option value="">No warehouse assigned</option>
                  ) : (
                    warehouseList.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))
                  )}
                </select>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => setShowAddWarehouse(true)}
                  className="px-4 py-2 bg-[#f58220] text-white hover:bg-[#e8740e] rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Warehouse
                </button>
              )}
              {warehouse && (
                <button
                  onClick={() => setShowManageBins(true)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-[#f58220] hover:border-orange-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  <MapPin className="h-4 w-4 text-[#f58220]" />
                  Manage Bins
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {warehouse ? (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalDistinctItems}</p>
            </div>
            <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
              <Package className="h-6 w-6" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Occupied Bins</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{occupiedBins}</p>
            </div>
            <div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
              <Layers className="h-6 w-6" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Available Bins</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{availableBins}</p>
            </div>
            <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search stock..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={binFilter}
            onChange={(e) => setBinFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
          >
            <option value="ALL">All Bins</option>
            <option value="UNASSIGNED">Not Assigned</option>
            {warehouse?.bins.map(b => (
              <option key={b.id} value={b.id}>{b.code}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[150px]"
          >
            <option value="ALL">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bin</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">Loading...</td></tr>
                ) : groupedStock.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">No stock found matching filters.</td></tr>
                ) : (
                  groupedStock.map((g) => {
                    const isExpanded = expandedItems.has(g.itemId);
                    const binCount = new Set(g.rows.filter(r => r.binId).map(r => r.binId)).size;
                    return (
                      <Fragment key={g.itemId}>
                        <tr
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => toggleExpanded(g.itemId)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{g.itemName}</div>
                                <div className="text-xs text-gray-500">{g.itemSku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {g.rows.length} {g.rows.length === 1 ? 'lot' : 'lots'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {binCount > 0 ? `${binCount} bin${binCount === 1 ? '' : 's'}` : (
                              <span className="text-gray-400">Not Assigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                            {g.totalBalance.toLocaleString()} {g.unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                            {g.rows.length > 1 ? 'Mixed' : g.rows[0].status.replace('_', ' ')}
                          </td>
                          <td className="px-6 py-4" />
                        </tr>
                        {isExpanded && g.rows.map((s, idx) => (
                          <tr key={`${s.itemId}-${s.batchId}-${s.binId}-${idx}`} className="bg-gray-50/60 hover:bg-gray-100 transition-colors">
                            <td className="pl-14 pr-6 py-3 whitespace-nowrap text-xs text-gray-400">
                              {/* Item identity already shown on the parent row */}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                              {s.batchCode}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              {s.binId ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {s.binCode}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-dashed border-gray-300">
                                  Not Assigned
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                              {s.balance.toLocaleString()} {s.unit}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <span className={clsx(
                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                s.status === 'READY' || s.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' :
                                s.status === 'QC_HOLD' ? 'bg-amber-100 text-amber-800' :
                                'bg-rose-100 text-rose-800'
                              )}>
                                {s.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                              {!s.binId && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setAssignBinItem(s); }}
                                  className="text-orange-700 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3 py-1 rounded-md text-xs font-bold transition-colors shadow-sm"
                                >
                                  Assign Bin
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center flex flex-col items-center">
            <Building2 className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isSuperAdmin ? 'No Warehouse Configured' : 'No Warehouse Assigned'}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              {isSuperAdmin
                ? (noWarehousesAtAll
                    ? 'No warehouses exist yet. You can create one to begin managing physical stock locations.'
                    : 'Select a warehouse above, or create a new one.')
                : 'Your franchise does not currently have a primary warehouse assigned. Contact your administrator to have one configured.'}
            </p>
            {isSuperAdmin && (
              <button
                onClick={() => setShowAddWarehouse(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Warehouse
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Warehouse Modal */}
      {showAddWarehouse && (
        <AddWarehouseModal
          onClose={() => setShowAddWarehouse(false)}
          onSuccess={handleWarehouseCreated}
        />
      )}

      {/* Manage Bins Modal */}
      {showManageBins && warehouse && (
        <ManageBinsModal
          warehouse={warehouse}
          onClose={() => setShowManageBins(false)}
          onUpdate={loadData}
        />
      )}

      {/* Assign Bin Modal */}
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

function ManageBinsModal({ warehouse, onClose, onUpdate }: { warehouse: Warehouse, onClose: () => void, onUpdate: () => void }) {
  const [bins, setBins] = useState<WarehouseBin[]>(warehouse.bins);
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleAdd = async () => {
    if (!newCode.trim()) return;
    setAdding(true);
    try {
      const b = await WarehouseApi.createBin(warehouse.id, { code: newCode.trim(), description: newDesc.trim() || undefined });
      setBins(prev => [...prev, b]);
      setNewCode('');
      setNewDesc('');
      onUpdate();
      toast.success('Bin created');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await WarehouseApi.deleteBin(id);
      setBins(prev => prev.filter(b => b.id !== id));
      onUpdate();
      toast.success('Bin removed');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Slide-Over Drawer */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#0f1117] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 z-10">
        {/* Drawer Header */}
        <div className="bg-white dark:bg-[#0f1117] border-b border-gray-200 dark:border-white/10 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-500/20 flex items-center justify-center text-[#f58220] shadow-sm">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">Bins & Locations</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[220px]">
                {warehouse.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Add New Bin Form Card */}
          <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Plus className="h-3.5 w-3.5 text-[#f58220]" /> Add New Bin
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Bin Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. FG-01, RM-BIN-A"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-[#f58220] outline-none transition-all dark:text-white placeholder:text-gray-400 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Finished Goods Rack 1, Ground Floor"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-[#f58220] outline-none transition-all dark:text-white placeholder:text-gray-400"
                />
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || !newCode.trim()}
                className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 mt-1"
              >
                {adding ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {adding ? 'Adding Bin...' : 'Add Bin'}
              </button>
            </div>
          </div>

          {/* Configured Bins List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Configured Bins
              </h3>
              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 rounded-full text-xs font-bold">
                {bins.length}
              </span>
            </div>

            {bins.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/10 rounded-2xl space-y-2">
                <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-950/40 text-[#f58220] flex items-center justify-center mx-auto">
                  <Layers className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">No bins configured yet</p>
                <p className="text-[11px] text-gray-400">Add bin codes above to organize stock storage locations in this warehouse.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-420px)] overflow-y-auto pr-1 custom-scrollbar">
                {bins.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-white/10 hover:border-orange-200 dark:hover:border-orange-500/20 transition-all flex items-center justify-between group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="px-2.5 py-1 bg-orange-50 dark:bg-orange-950/40 text-[#f58220] border border-orange-200/80 dark:border-orange-500/20 rounded-lg text-xs font-mono font-bold shrink-0">
                        {b.code}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">
                          {b.description || "No description"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Delete Bin"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-gray-200 dark:border-white/10 px-6 py-4 bg-gray-50 dark:bg-[#0f1117] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AssignBinModal({ item, warehouse, onClose, onSuccess }: { item: WarehouseStockItem, warehouse: Warehouse, onClose: () => void, onSuccess: () => void }) {
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
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Slide-Over Drawer */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#0f1117] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 z-10">
        {/* Header */}
        <div className="bg-white dark:bg-[#0f1117] border-b border-gray-200 dark:border-white/10 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-500/20 flex items-center justify-center text-[#f58220] shadow-sm">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">Assign Bin Location</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[220px]">
                {warehouse.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Stock Item Details Card */}
          <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Item Details
            </h3>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Item Name</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">{item.itemName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Item SKU</span>
                <span className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-300">{item.itemSku || "—"}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Batch / Lot</span>
                <span className="text-xs font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300">
                  {item.batchCode || "No Batch"}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200/80 dark:border-white/5">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Quantity to Store</span>
                <span className="text-sm font-black text-[#f58220]">
                  {item.balance.toLocaleString()} {item.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Bin Selection Section */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Select Target Bin <span className="text-red-500">*</span>
            </label>

            {warehouse.bins.length === 0 ? (
              <div className="p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-bold">No Bins Configured</span>
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  No bins are currently created in this warehouse. Use the Manage Bins button on the main toolbar to configure storage bins first.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedBin}
                  onChange={e => setSelectedBin(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-orange-500/20 focus:border-[#f58220] outline-none transition-all dark:text-white"
                >
                  <option value="">Choose a bin location...</option>
                  {warehouse.bins.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.code} {b.description ? `— ${b.description}` : ''}
                    </option>
                  ))}
                </select>

                {/* Visual bin selector cards */}
                <div className="space-y-2 pt-2 max-h-[220px] overflow-y-auto custom-scrollbar">
                  {warehouse.bins.map(b => {
                    const isSelected = selectedBin === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBin(b.id)}
                        className={clsx(
                          "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                          isSelected
                            ? "bg-orange-50 dark:bg-orange-950/30 border-[#f58220] ring-1 ring-[#f58220]"
                            : "bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 hover:border-orange-200 dark:hover:border-orange-500/20"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className={clsx(
                            "px-2.5 py-1 rounded-lg text-xs font-mono font-bold shrink-0",
                            isSelected ? "bg-[#f58220] text-white" : "bg-orange-50 dark:bg-orange-950/40 text-[#f58220] border border-orange-200/80 dark:border-orange-500/20"
                          )}>
                            {b.code}
                          </span>
                          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">
                            {b.description || "Active storage bin"}
                          </span>
                        </div>
                        <div className={clsx(
                          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                          isSelected ? "border-[#f58220] bg-[#f58220]" : "border-gray-300 dark:border-gray-600"
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
        <div className="border-t border-gray-200 dark:border-white/10 px-6 py-4 bg-gray-50 dark:bg-[#0f1117] flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedBin || submitting}
            className="flex-[2] py-3 px-4 bg-[#f58220] hover:bg-[#e8740e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {submitting ? 'Assigning...' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Creates an unassigned/global warehouse — this page's selector is now
// warehouse-based, not franchise-based, so there's no single "current
// franchise" left to auto-link it to. It still shows up immediately in the
// SUPER_ADMIN list either way (the list is every active warehouse, linked
// or not) — assigning it as a specific franchise's primary remains a
// separate, explicit action (unchanged: still done the same way it already
// was, via createWarehouse's franchiseId param, just not from this modal).
function AddWarehouseModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: (wh: { id: string; name: string }) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Warehouse name is required');

    setSubmitting(true);
    try {
      const response = await inventoryApi.createWarehouse({
        name,
        code: code || undefined,
        location: location || undefined,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Add Warehouse</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Main Headquarters Warehouse"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
            <input
              type="text"
              placeholder="e.g. HQ-WH-001"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              placeholder="e.g. Main Headquarters"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={status === 'ACTIVE'}
                  onChange={() => setStatus('ACTIVE')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={status === 'INACTIVE'}
                  onChange={() => setStatus('INACTIVE')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Inactive</span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Warehouse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
