"use client";

import { useState, useEffect } from "react";
import { X,
  Trash2, Plus, RefreshCw, Calendar,
  Search, ShieldAlert, FileText, Pencil
} from "lucide-react";
import { clsx } from "clsx";
import { wasteApi, inventoryApi, franchiseApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

interface WasteEntry {
  id: string;
  quantity: number;
  reason: string;
  note?: string;
  costAtTime?: number;
  createdAt: string;
  inventoryItem: {
    name: string;
    sku: string;
    unit: string;
  };
  warehouse?: {
    name: string;
  };
}

const REASON_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  QC_FAIL: { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  EXPIRED: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  SPOILAGE: { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  DAMAGED: { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
};
const DEFAULT_REASON_STYLE = { color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };

export default function WastagePage() {
  const [wasteLogs, setWasteLogs] = useState<WasteEntry[]>([]);
  // Every selectable warehouse (SUPER_ADMIN sees all, FRANCHISE_ADMIN sees
  // just their own) — Wastage's filter mirrors the Warehouse page's own
  // warehouse-based selector, since "where did this waste happen" is a
  // location question, not a franchise one. Each entry carries franchiseId
  // so franchise-scoped calls (item picker, wasteApi.create) can still
  // derive it without a separate franchise selector.
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Log Form State
  const [showLogModal, setShowLogModal] = useState(false);
  const [formData, setFormData] = useState({
    warehouseId: "",
    itemId: "",
    quantity: 1,
    reason: "SPOILAGE",
    note: ""
  });

  // Edit Form State — reason/note only. Quantity already moved real stock
  // (WASTE_OUT) at creation time, so it isn't editable from here.
  const [editingLog, setEditingLog] = useState<WasteEntry | null>(null);
  const [editReason, setEditReason] = useState("SPOILAGE");
  const [editNote, setEditNote] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEdit = (log: WasteEntry) => {
    setEditingLog(log);
    setEditReason(log.reason);
    setEditNote(log.note || "");
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;
    setEditSubmitting(true);
    try {
      await wasteApi.update(editingLog.id, { reason: editReason, note: editNote });
      toast.success("Wastage log updated");
      setEditingLog(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update wastage log");
    } finally {
      setEditSubmitting(false);
    }
  };

  useEffect(() => {
    async function initData() {
      try {
        const [fRes, wRes] = await Promise.all([
          franchiseApi.getAll(),
          inventoryApi.getWarehouses()
        ]);
        const warehouseList = wRes.data || [];
        setWarehouses(warehouseList);
        if (warehouseList.length > 0) {
          // Deterministic default: HQ's warehouse if resolvable via
          // Franchise.isHQ, otherwise alphabetically-first — same rule the
          // Warehouse page uses, so both screens default consistently.
          const franchiseList = fRes.data || [];
          const hqFranchise = franchiseList.find((f: any) => f.isHQ);
          const hqWarehouse = hqFranchise ? warehouseList.find((w: any) => w.franchiseId === hqFranchise.id) : undefined;
          const fallback = [...warehouseList].sort((a: any, b: any) => a.name.localeCompare(b.name))[0];
          setSelectedWarehouseId((hqWarehouse || fallback).id);
        }
      } catch (err) {
        toast.error("Failed to load initial data");
      }
    }
    initData();
  }, []);

  const loadInventoryForWarehouse = async (warehouseId: string, franchiseId?: string) => {
    if (!warehouseId) return;
    try {
      const res = await inventoryApi.getRawMaterialStockSummary(warehouseId, franchiseId, 'ALL');
      setInventoryItems(res.data || []);
      if (res.data?.length > 0) {
        setFormData(prev => ({ ...prev, itemId: res.data[0].id }));
      } else {
        setFormData(prev => ({ ...prev, itemId: "" }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    if (!selectedWarehouseId) return;
    setLoading(true);
    try {
      const wRes = await wasteApi.getAll({ warehouseId: selectedWarehouseId });
      setWasteLogs(wRes.data || []);
    } catch (err) {
      toast.error("Failed to fetch wastage logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  // Keep the Log Spoilage warehouse/item picker in step with the selected
  // warehouse — previously it stayed frozen on whichever warehouse loaded
  // first at mount, so switching the top filter never updated what Log
  // Spoilage let you log against.
  useEffect(() => {
    if (!selectedWarehouseId || warehouses.length === 0) return;
    const wh = warehouses.find((w: any) => w.id === selectedWarehouseId);
    setFormData(prev => ({ ...prev, warehouseId: selectedWarehouseId, itemId: "" }));
    loadInventoryForWarehouse(selectedWarehouseId, wh?.franchiseId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId, warehouses]);

  const handleSubmitWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouseId) {
      toast.error("Please select a warehouse");
      return;
    }
    if (!formData.itemId) {
      toast.error("Please select an item");
      return;
    }
    if (formData.quantity <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const selectedItem = inventoryItems.find(it => it.id === formData.itemId);
    const available = selectedItem ? selectedItem.availableStock : 0;
    if (formData.quantity > available) {
      toast.error(`Insufficient stock. Available: ${available} ${selectedItem?.unit || 'KG'}. Requested wastage: ${formData.quantity} ${selectedItem?.unit || 'KG'}.`);
      return;
    }

    setSubmitting(true);
    try {
      const wh = warehouses.find((w: any) => w.id === formData.warehouseId);
      await wasteApi.create({
        itemId: formData.itemId,
        quantity: Number(formData.quantity),
        reason: formData.reason,
        note: formData.note,
        franchiseId: wh?.franchiseId || undefined,
        warehouseId: formData.warehouseId
      });
      toast.success("Wastage logged successfully");
      setShowLogModal(false);
      setFormData(prev => ({
        ...prev,
        quantity: 1,
        reason: "SPOILAGE",
        note: ""
      }));
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to log wastage");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLogs = wasteLogs.filter(log =>
    log.inventoryItem?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.inventoryItem?.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.note && log.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (log.warehouse?.name && log.warehouse.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6">
      {/* Page Header Toolbar */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Wastage Management</h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="w-full sm:w-auto max-w-full truncate border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-[#13151f] text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220] cursor-pointer"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id} className="dark:bg-card">
                {w.name}{w.franchiseName ? ` — ${w.franchiseName}` : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowLogModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 sm:py-2 rounded-lg shadow-sm transition-colors cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" /> Log Spoilage / Wastage
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-5 w-full min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 w-full min-w-0">

          {/* Left Side: Stats and Log Form */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-5 w-full min-w-0">
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-sm w-full min-w-0">
              <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-3 sm:mb-4 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-[#f58220]" />
                Wastage Statistics
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2.5">
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Total Logged Entries</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{wasteLogs.length}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2.5">
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Spoiled / Damaged</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {wasteLogs.filter(w => w.reason === 'SPOILAGE' || w.reason === 'DAMAGED').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">QC Failures</span>
                  <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    {wasteLogs.filter(w => w.reason === 'QC_FAIL').length}
                  </span>
                </div>
              </div>
            </div>

            {showLogModal && (
              <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-sm w-full min-w-0">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-white">Log Wastage / Spoilage</h3>
                  <button
                    onClick={() => setShowLogModal(false)}
                    className="text-xs font-semibold text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSubmitWaste} className="space-y-3.5 w-full min-w-0">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Warehouse</label>
                    <select
                      value={formData.warehouseId}
                      onChange={(e) => {
                        const wId = e.target.value;
                        const wh = warehouses.find((w: any) => w.id === wId);
                        setFormData(prev => ({ ...prev, warehouseId: wId, itemId: "" }));
                        loadInventoryForWarehouse(wId, wh?.franchiseId || undefined);
                      }}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] truncate"
                    >
                      <option value="" disabled className="dark:bg-card">Choose Warehouse...</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id} className="dark:bg-card">
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Inventory Item</label>
                    <select
                      value={formData.itemId}
                      onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] truncate"
                      disabled={!formData.warehouseId}
                    >
                      <option value="" disabled className="dark:bg-card">
                        {formData.warehouseId ? "Choose Item..." : "Select a warehouse first..."}
                      </option>
                      {inventoryItems.map(item => (
                        <option key={item.id} value={item.id} className="dark:bg-card">
                          {item.name} ({item.sku}) - Available: {(item.availableStock || 0).toFixed(2)} {item.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Quantity</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formData.quantity || ""}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Wastage Reason</label>
                    <select
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                    >
                      <option value="SPOILAGE" className="dark:bg-card">Spoilage & Rotting</option>
                      <option value="DAMAGED" className="dark:bg-card">Damaged in House</option>
                      <option value="QC_FAIL" className="dark:bg-card">Failed QC Inspection</option>
                      <option value="EXPIRED" className="dark:bg-card">Expired Shelf Life</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Remarks / Notes</label>
                    <input
                      type="text"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      placeholder="Enter reason details..."
                      className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] placeholder:text-gray-400 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-xs sm:text-sm shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {submitting ? "Submitting..." : "Submit Wastage Log"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right Side: Wastage History List */}
          <div className="lg:col-span-2 w-full min-w-0">
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden w-full min-w-0">
              <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full min-w-0">
                <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5 shrink-0">
                  <FileText className="h-4 w-4 text-[#f58220]" />
                  Wastage Audit History
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                  {searchQuery && (
                    <X 
                      size={14} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                      onClick={() => setSearchQuery("")} 
                    />
                  )}
                </div>
              </div>

              {loading ? (
                <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-orange-400 opacity-50" /></div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-20 px-4 text-center text-sm text-gray-400 dark:text-slate-500">
                  No wastage records found for selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
                  <table className="w-full text-sm text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                        <th className="text-left px-4 py-3 min-w-[160px]">Item</th>
                        <th className="text-left px-4 py-3 min-w-[130px]">Warehouse</th>
                        <th className="text-center px-4 py-3 min-w-[110px] whitespace-nowrap">Reason</th>
                        <th className="text-right px-4 py-3 min-w-[110px] whitespace-nowrap">Qty Loss</th>
                        <th className="text-left px-4 py-3 min-w-[160px]">Notes / Date</th>
                        <th className="text-center px-4 py-3 min-w-[90px] whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {filteredLogs.map((log) => {
                        const style = REASON_STYLES[log.reason] || DEFAULT_REASON_STYLE;

                        return (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 min-w-[160px]">
                              <div className="font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">{log.inventoryItem?.name}</div>
                              <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 font-mono">SKU: {log.inventoryItem?.sku}</div>
                            </td>
                            <td className="px-4 py-3 text-xs sm:text-sm text-gray-600 dark:text-slate-300 min-w-[130px]">
                              {log.warehouse?.name || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span className={clsx("inline-block px-2.5 py-1 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                                {log.reason}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="font-semibold text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                                -{log.quantity} <span className="text-xs text-gray-400 dark:text-slate-500">{log.inventoryItem?.unit}</span>
                              </div>
                              {typeof log.costAtTime === "number" && (
                                <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Cost: ₹{log.costAtTime.toFixed(2)}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 min-w-[160px]">
                              <div className="text-xs sm:text-sm text-gray-700 dark:text-slate-300">{log.note || '—'}</div>
                              <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                                <Calendar className="h-3 w-3 shrink-0" />
                                {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <button
                                onClick={() => openEdit(log)}
                                title="Edit reason / notes"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-[#f58220] dark:hover:text-[#f58220] border border-gray-200 dark:border-white/10 hover:border-orange-200 dark:hover:border-orange-500/30 rounded-lg transition-colors cursor-pointer"
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Edit Wastage Log Modal */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/10 p-4 sm:p-5 w-full max-w-sm space-y-4 shadow-xl my-auto">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-white">Edit Wastage Log</h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 font-semibold">{editingLog.inventoryItem?.name}</p>
              </div>
              <button
                onClick={() => setEditingLog(null)}
                className="text-xs font-semibold text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Wastage Reason</label>
                <select
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f]"
                >
                  <option value="SPOILAGE" className="dark:bg-card">Spoilage & Rotting</option>
                  <option value="DAMAGED" className="dark:bg-card">Damaged in House</option>
                  <option value="QC_FAIL" className="dark:bg-card">Failed QC Inspection</option>
                  <option value="EXPIRED" className="dark:bg-card">Expired Shelf Life</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Remarks / Notes</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Enter reason details..."
                  className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
              </div>

              <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                Quantity can't be changed here — it already deducted real stock when this entry was logged.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setEditingLog(null)}
                className="flex-1 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSubmitting}
                className="flex-1 py-2 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg font-semibold text-xs shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                {editSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
