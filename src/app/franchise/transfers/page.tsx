"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowRightLeft, Plus, Search, RefreshCw, X, ChevronDown, Trash2, CheckCircle2, ArrowLeft, Send, Check
} from "lucide-react";
import { clsx } from "clsx";
import { franchiseApi, logisticsApi, inventoryApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  SHIPPED: "In Transit",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: "Pending",    color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-500/10",   border: "border-amber-200 dark:border-amber-500/20" },
  APPROVED:  { label: "Approved",   color: "text-indigo-600 dark:text-indigo-400",  bg: "bg-indigo-50 dark:bg-indigo-500/10",  border: "border-indigo-200 dark:border-indigo-500/20" },
  SHIPPED:   { label: "In Transit", color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-500/10",    border: "border-blue-200 dark:border-blue-500/20" },
  COMPLETED: { label: "Completed",  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
  CANCELLED: { label: "Cancelled",  color: "text-slate-400 dark:text-slate-500",   bg: "bg-slate-100 dark:bg-white/5",  border: "border-slate-200 dark:border-white/10" },
};

type TransferItemRow = { id: string; inventoryItemId: string; itemSearch: string; quantity: number; availableStock: number; unit: string; baseUnit: string; };

function makeItem(): TransferItemRow {
  return { id: Math.random().toString(36).slice(2), inventoryItemId: "", itemSearch: "", quantity: 0, availableStock: 0, unit: "UNT", baseUnit: "Units" };
}

export default function FranchiseTransfersPage() {
  const { showToast } = useToast();
  const [view, setView] = useState<"list" | "create">("list");
  
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inTransit, setInTransit] = useState<{ totalTransfersInTransit: number; itemTotals: any[] } | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [branches, setBranches] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [sourceInventory, setSourceInventory] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  
  const [items, setItems] = useState<TransferItemRow[]>([makeItem()]);
  const [creating, setCreating] = useState(false);

  // Dropdowns for create view
  const [openItemDrop, setOpenItemDrop] = useState<string | null>(null);
  const [itemDropRect, setItemDropRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const loadTransfers = useCallback(() => {
    setLoading(true);
    return Promise.all([
      franchiseApi.getTransfers().then((res) => setTransfers(res.data ?? [])).catch(() => setTransfers([])),
      logisticsApi.getInTransit().then((res) => setInTransit(res.data)).catch(() => setInTransit(null)),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTransfers(); }, [loadTransfers]);

  useEffect(() => {
    franchiseApi.getAll()
      .then((res) => setBranches(res.data ?? []))
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (!sourceId) { setSourceInventory([]); return; }
    setLoadingInventory(true);
    inventoryApi.getInventory(sourceId, 'FINISHED_GOOD')
      .then((res) => setSourceInventory(res.data ?? []))
      .catch(() => setSourceInventory([]))
      .finally(() => setLoadingInventory(false));
  }, [sourceId]);

  const resetForm = () => {
    setSourceId("");
    setDestId("");
    setSourceInventory([]);
    setItems([makeItem()]);
  };

  const openCreate = () => { resetForm(); setView("create"); };
  const handleBack = () => { setView("list"); resetForm(); };

  const updateItemRow = (idx: number, patch: Partial<TransferItemRow>) => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const addItemRow = () => setItems((prev) => [...prev, makeItem()]);
  const removeItemRow = (idx: number) => setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const handleCreate = async () => {
    if (!sourceId) { showToast("Select a source branch.", "error"); return; }
    if (!destId) { showToast("Select a destination branch.", "error"); return; }
    if (sourceId === destId) { showToast("Source and destination branch must be different.", "error"); return; }

    const cleanItems = items
      .filter((r) => r.inventoryItemId)
      .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: Number(r.quantity) }));

    if (cleanItems.length === 0) { showToast("Add at least one item to transfer.", "error"); return; }
    for (const row of cleanItems) {
      if (!(row.quantity > 0)) { showToast("Quantity must be greater than 0 for every item.", "error"); return; }
      const available = sourceInventory.find((i) => i.id === row.inventoryItemId)?.currentStock ?? 0;
      if (row.quantity > available) {
        const name = sourceInventory.find((i) => i.id === row.inventoryItemId)?.name ?? "item";
        showToast(`Quantity for "${name}" exceeds available stock (${available}).`, "error");
        return;
      }
    }
    const seen = new Set<string>();
    for (const row of cleanItems) {
      if (seen.has(row.inventoryItemId)) { showToast("Each item can only be added once per transfer.", "error"); return; }
      seen.add(row.inventoryItemId);
    }

    setCreating(true);
    try {
      await franchiseApi.initiateTransfer({ fromBranchId: sourceId, toBranchId: destId, items: cleanItems });
      showToast("Transfer created successfully", "success");
      handleBack();
      await loadTransfers();
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to create transfer.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDispatch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActioningId(id);
    try {
      await franchiseApi.dispatchTransfer(id);
      showToast("Transfer dispatched", "success");
      await loadTransfers();
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to dispatch transfer.", "error");
    } finally {
      setActioningId(null);
    }
  };

  const handleComplete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActioningId(id);
    try {
      await franchiseApi.completeTransfer(id);
      showToast("Transfer received", "success");
      await loadTransfers();
    } catch (err: any) {
      showToast(err?.response?.data?.error || "Failed to receive transfer.", "error");
    } finally {
      setActioningId(null);
    }
  };

  // FILTER LOGIC
  const filtered = transfers.filter((t) => {
    const matchSearch = !search ||
      t.fromBranch?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.toBranch?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const shippedCount = transfers.filter((t) => t.status === "SHIPPED").length;

  if (view === "create") {
    const totalQty = items
      .filter((i) => i.inventoryItemId && Number(i.quantity) > 0)
      .reduce((s, i) => s + Number(i.quantity), 0);

    return (
      <div className="flex flex-col bg-gray-50 dark:bg-background -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0" style={{ minHeight: 'calc(100vh - 80px)' }}>
        {/* Top bar */}
        <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0 w-full min-w-0 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={handleBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 dark:text-slate-400 transition-colors shrink-0">
              <ArrowLeft size={17} />
            </button>
            <h2 className="text-base font-bold text-gray-800 dark:text-white truncate">New Stock Transfer</h2>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 md:p-6 space-y-4 custom-scrollbar w-full min-w-0">
          {/* Branch Details */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-2xs w-full min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Source Branch *</label>
                  <select
                    value={sourceId}
                    onChange={(e) => { setSourceId(e.target.value); setItems([makeItem()]); }}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] transition-colors"
                  >
                    <option value="">Select source...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.id === destId}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">Destination Branch *</label>
                  <select
                    value={destId}
                    onChange={(e) => setDestId(e.target.value)}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] transition-colors"
                  >
                    <option value="">Select destination...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.id === sourceId}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Transfer Items</span>
              {loadingInventory && <span className="text-[10px] text-gray-400 dark:text-slate-500">Loading stock...</span>}
            </div>

            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm border-collapse min-w-[480px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                    <th className="w-12 px-3 py-2.5 text-center">#</th>
                    <th className="px-3 py-2.5 text-left">Item</th>
                    <th className="w-32 px-3 py-2.5 text-center">Quantity</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {!sourceId ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                        Please select a source branch to load available inventory items.
                      </td>
                    </tr>
                  ) : items.map((item, idx) => {
                    const filtProd = sourceInventory.filter(p =>
                      !item.itemSearch || p.name?.toLowerCase().includes(item.itemSearch.toLowerCase())
                    ).slice(0, 10);

                    return (
                      <tr key={item.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-orange-50/30 dark:hover:bg-orange-500/5 group">
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400 dark:text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2" style={{ position: "relative", overflow: "visible" }}>
                          <input
                            className="w-full text-sm text-gray-700 dark:text-white outline-none bg-transparent placeholder-gray-400 dark:placeholder-slate-500"
                            placeholder="Search item to transfer..."
                            value={item.itemSearch}
                            onChange={e => {
                              updateItemRow(idx, { itemSearch: e.target.value, inventoryItemId: "" });
                              setOpenItemDrop(item.id);
                            }}
                            onFocus={e => {
                              setOpenItemDrop(item.id);
                              const rect = (e.target as HTMLElement).getBoundingClientRect();
                              setItemDropRect({ top: rect.bottom, left: rect.left, width: 350 });
                            }}
                          />
                          {item.itemSearch && (
                            <X 
                              size={14} 
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                              onClick={() => updateItemRow(idx, { itemSearch: "" })} 
                            />
                          )}
                          
                          {item.inventoryItemId && (
                            <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-1 leading-tight">
                              Available: {item.availableStock || 0} {item.unit}
                              {item.quantity > (item.availableStock || 0) && <span className="text-red-500 font-semibold block mt-0.5">❌ Insufficient Stock</span>}
                            </div>
                          )}

                          {openItemDrop === item.id && itemDropRect && (
                            <div
                              className="bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                              style={{ position: "fixed", top: itemDropRect.top + 4, left: itemDropRect.left, width: itemDropRect.width, zIndex: 9999 }}
                            >
                              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {filtProd.length === 0 ? (
                                  <div className="px-3 py-4 text-xs text-gray-400 dark:text-slate-500 text-center">No matching items in branch</div>
                                ) : (
                                  filtProd.map(p => (
                                    <button
                                      key={p.id}
                                      disabled={p.currentStock <= 0}
                                      className={clsx(
                                        "w-full flex items-center justify-between px-3 py-2.5 text-left border-b border-gray-50 dark:border-white/5 last:border-0",
                                        p.currentStock > 0 ? "hover:bg-orange-50 dark:hover:bg-white/5 cursor-pointer" : "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-white/[0.02]"
                                      )}
                                      onMouseDown={() => {
                                        if (p.currentStock > 0) {
                                          updateItemRow(idx, { 
                                            inventoryItemId: p.id, 
                                            itemSearch: p.name,
                                            availableStock: p.currentStock,
                                            unit: p.unit
                                          });
                                          setOpenItemDrop(null);
                                        }
                                      }}
                                    >
                                      <div>
                                        <div className="text-sm font-medium text-gray-800 dark:text-white">{p.name}</div>
                                        <div className="text-[10px] text-gray-500 dark:text-slate-400">{p.category}</div>
                                      </div>
                                      <div className="text-xs font-semibold text-gray-600 dark:text-slate-300 text-right">
                                        {p.currentStock} {p.unit} <span className="text-[9px] font-normal block text-gray-400 dark:text-slate-500">avail</span>
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                           <div className="flex items-center gap-2">
                              <input
                                type="number" min={1}
                                value={item.quantity || ""}
                                onChange={e => updateItemRow(idx, { quantity: Number(e.target.value) })}
                                className="w-full text-sm text-gray-700 dark:text-white text-center outline-none bg-transparent border-b border-dashed border-gray-300 dark:border-white/20 focus:border-[#f58220] px-1 py-1"
                              />
                              <span className="text-xs text-gray-500 dark:text-slate-400 w-8">{item.unit}</span>
                           </div>
                        </td>
                        <td className="pr-3 text-right">
                          <button
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length === 1}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-slate-400 hover:text-red-500 disabled:opacity-30 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/40 dark:bg-white/[0.02]">
              <button
                onClick={addItemRow}
                disabled={!sourceId}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#f58220] hover:text-[#e8740e] border border-orange-200 dark:border-orange-500/20 hover:border-orange-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:border-transparent disabled:bg-gray-100 dark:disabled:bg-white/5"
              >
                <Plus size={13} /> Add Row
              </button>
              <span className="text-xs text-gray-500 dark:text-slate-400">Total Qty: <span className="font-semibold text-gray-700 dark:text-white">{totalQty}</span></span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white dark:bg-card border-t border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={handleBack}
            className="px-4 py-2 text-xs sm:text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !sourceId || !destId || items.filter(i => i.inventoryItemId && Number(i.quantity) > 0).length === 0}
            className="px-5 sm:px-6 py-2 text-xs sm:text-sm font-semibold text-white bg-[#f58220] hover:bg-[#e8740e] rounded-lg disabled:opacity-60 transition-colors shadow-sm"
          >
            {creating ? "Creating..." : "Create Transfer"}
          </button>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">
      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Stock Transfers
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">
              Inter-branch inventory transfer and movement tracking
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 sm:py-2 rounded-xl shadow-sm transition-all whitespace-nowrap active:scale-95 shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New Transfer</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 w-full min-w-0">
        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0">
          {[
            { label: "Total Transfers", value: transfers.length, color: "text-gray-700 dark:text-slate-200",    dot: "bg-gray-400" },
            { label: "Pending",         value: transfers.filter((t) => t.status === "PENDING").length, color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
            { label: "In Transit",      value: shippedCount, color: "text-blue-600 dark:text-blue-400",    dot: "bg-blue-500" },
            { label: "Completed",       value: transfers.filter((t) => t.status === "COMPLETED").length, color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 px-3.5 sm:px-4 py-3 flex items-center gap-2.5 sm:gap-3 min-w-0 shadow-2xs">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 truncate">{s.label}</p>
                <p className={clsx("text-base sm:text-lg font-bold truncate", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative flex-1 min-w-[160px] xs:min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search branch or transfer ID..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-white/5 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl overflow-x-auto max-w-full custom-scrollbar bg-white dark:bg-card p-0.5">
            {["ALL", "PENDING", "SHIPPED", "COMPLETED"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-1.5 sm:py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 rounded-lg",
                  statusFilter === s ? "bg-[#f58220] text-white shadow-2xs" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {s === "ALL" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="flex-1 hidden sm:block" />

          <button
            onClick={loadTransfers}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl transition-colors shrink-0 bg-white dark:bg-card"
            title="Refresh"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-orange-500")} />
          </button>
        </div>

        {/* ── Empty State ── */}
        {loading ? (
          <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-[#f58220] opacity-50" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl py-16 sm:py-20 flex flex-col items-center justify-center text-center space-y-4 px-4 shadow-2xs">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center">
              <ArrowRightLeft className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 dark:text-white font-semibold text-sm sm:text-base">No Transfers Found</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Create a stock transfer to move inventory.</p>
            </div>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-sm"
            >
              Create Transfer
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden w-full min-w-0 shadow-2xs">
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-xs font-medium border-b border-gray-200 dark:border-white/5 uppercase">
                    <th className="text-left px-4 py-3 whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3 whitespace-nowrap">Transfer ID</th>
                    <th className="text-left px-4 py-3 whitespace-nowrap">Source</th>
                    <th className="text-left px-4 py-3 whitespace-nowrap">Destination</th>
                    <th className="text-center px-4 py-3 whitespace-nowrap">Items</th>
                    <th className="text-center px-4 py-3 whitespace-nowrap">Total Quantity</th>
                    <th className="text-center px-4 py-3 whitespace-nowrap">Status</th>
                    <th className="text-right px-4 py-3 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filtered.map((t) => {
                    const style = STATUS_STYLES[t.status] || STATUS_STYLES.PENDING;
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(t.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-gray-800 dark:text-slate-200 text-xs whitespace-nowrap">
                          #{t.id?.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="font-medium text-gray-800 dark:text-white">{t.fromBranch?.name ?? "HQ"}</span>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="font-medium text-gray-800 dark:text-white">{t.toBranch?.name ?? "Branch"}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600 dark:text-slate-400 font-medium whitespace-nowrap">
                          {t.items?.length || 0}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600 dark:text-slate-400 font-medium whitespace-nowrap">
                          {(() => {
                            const byUnit = new Map<string, number>();
                            (t.items || []).forEach((it: any) => {
                              const unit = it.inventoryItem?.unit || "UNT";
                              byUnit.set(unit, (byUnit.get(unit) || 0) + Number(it.quantity || 0));
                            });
                            if (byUnit.size === 0) return "—";
                            return Array.from(byUnit.entries())
                              .map(([unit, qty]) => `${qty} ${unit}`)
                              .join(", ");
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {t.status === "PENDING" && (
                              <button
                                onClick={(e) => handleDispatch(t.id, e)}
                                disabled={actioningId === t.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                <Send size={12} /> {actioningId === t.id ? "..." : "Dispatch"}
                              </button>
                            )}
                            {t.status === "SHIPPED" && (
                              <button
                                onClick={(e) => handleComplete(t.id, e)}
                                disabled={actioningId === t.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                <CheckCircle2 size={12} /> {actioningId === t.id ? "..." : "Receive"}
                              </button>
                            )}
                            {t.status !== "PENDING" && t.status !== "SHIPPED" && (
                              <span className="text-gray-300 dark:text-slate-600 text-xs">—</span>
                            )}
                          </div>
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
    </div>
  );
}
