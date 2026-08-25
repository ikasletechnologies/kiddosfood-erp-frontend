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
  PENDING:   { label: "Pending",    color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200" },
  APPROVED:  { label: "Approved",   color: "text-indigo-600",  bg: "bg-indigo-50",  border: "border-indigo-200" },
  SHIPPED:   { label: "In Transit", color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" },
  COMPLETED: { label: "Completed",  color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  CANCELLED: { label: "Cancelled",  color: "text-slate-400",   bg: "bg-slate-100",  border: "border-slate-200" },
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
      <div className="flex flex-col bg-gray-50" style={{ height: 'calc(100vh - 104px)' }}>
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
              <ArrowLeft size={17} />
            </button>
            <h2 className="text-base font-semibold text-gray-800">New Stock Transfer</h2>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4">
          {/* Branch Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Source Branch *</label>
                  <select
                    value={sourceId}
                    onChange={(e) => { setSourceId(e.target.value); setItems([makeItem()]); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white transition-colors"
                  >
                    <option value="">Select source...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.id === destId}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Destination Branch *</label>
                  <select
                    value={destId}
                    onChange={(e) => setDestId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#f58220] bg-white transition-colors"
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transfer Items</span>
              {loadingInventory && <span className="text-[10px] text-gray-400">Loading stock...</span>}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
                    <th className="w-12 px-3 py-2.5 text-center">#</th>
                    <th className="px-3 py-2.5 text-left">Item</th>
                    <th className="w-32 px-3 py-2.5 text-center">Quantity</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {!sourceId ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                        Please select a source branch to load available inventory items.
                      </td>
                    </tr>
                  ) : items.map((item, idx) => {
                    const filtProd = sourceInventory.filter(p =>
                      !item.itemSearch || p.name?.toLowerCase().includes(item.itemSearch.toLowerCase())
                    ).slice(0, 10);

                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-orange-50/30 group">
                        <td className="px-3 py-2.5 text-center text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2" style={{ position: "relative", overflow: "visible" }}>
                          <input
                            className="w-full text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
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
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                              onClick={() => updateItemRow(idx, { itemSearch: "" })} 
                            />
                          )}
                          
                          {item.inventoryItemId && (
                            <div className="text-[10px] text-gray-500 mt-1 leading-tight">
                              Available: {item.availableStock || 0} {item.unit}
                              {item.quantity > (item.availableStock || 0) && <span className="text-red-500 font-semibold block mt-0.5">❌ Insufficient Stock</span>}
                            </div>
                          )}

                          {openItemDrop === item.id && itemDropRect && (
                            <div
                              className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col"
                              style={{ position: "fixed", top: itemDropRect.top + 4, left: itemDropRect.left, width: itemDropRect.width, zIndex: 9999 }}
                            >
                              <div className="max-h-48 overflow-y-auto">
                                {filtProd.length === 0 ? (
                                  <div className="px-3 py-4 text-xs text-gray-400 text-center">No matching items in branch</div>
                                ) : (
                                  filtProd.map(p => (
                                    <button
                                      key={p.id}
                                      disabled={p.currentStock <= 0}
                                      className={clsx(
                                        "w-full flex items-center justify-between px-3 py-2.5 text-left border-b border-gray-50 last:border-0",
                                        p.currentStock > 0 ? "hover:bg-orange-50 cursor-pointer" : "opacity-50 cursor-not-allowed bg-gray-50"
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
                                        <div className="text-sm font-medium text-gray-800">{p.name}</div>
                                        <div className="text-[10px] text-gray-500">{p.category}</div>
                                      </div>
                                      <div className="text-xs font-semibold text-gray-600 text-right">
                                        {p.currentStock} {p.unit} <span className="text-[9px] font-normal block text-gray-400">avail</span>
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
                                className="w-full text-sm text-gray-700 text-center outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-[#f58220] px-1 py-1"
                              />
                              <span className="text-xs text-gray-500 w-8">{item.unit}</span>
                           </div>
                        </td>
                        <td className="pr-3 text-right">
                          <button
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length === 1}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 disabled:opacity-30 p-1"
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

            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
              <button
                onClick={addItemRow}
                disabled={!sourceId}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#f58220] hover:text-[#e8740e] border border-orange-200 hover:border-orange-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:border-transparent disabled:bg-gray-100"
              >
                <Plus size={13} /> Add Row
              </button>
              <span className="text-xs text-gray-500">Total Qty: <span className="font-semibold text-gray-700">{totalQty}</span></span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={handleBack}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !sourceId || !destId || items.filter(i => i.inventoryItemId && Number(i.quantity) > 0).length === 0}
            className="px-6 py-2 text-sm font-semibold text-white bg-[#f58220] hover:bg-[#e8740e] rounded-lg disabled:opacity-60 transition-colors shadow-sm"
          >
            {creating ? "Creating..." : "Create Transfer"}
          </button>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* ── Page Header Toolbar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> New Transfer
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-5">
        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Transfers", value: transfers.length, color: "text-gray-700",    dot: "bg-gray-400" },
            { label: "Pending",         value: transfers.filter((t) => t.status === "PENDING").length, color: "text-amber-600", dot: "bg-amber-500" },
            { label: "In Transit",      value: shippedCount, color: "text-blue-600",    dot: "bg-blue-500" },
            { label: "Completed",       value: transfers.filter((t) => t.status === "COMPLETED").length, color: "text-emerald-600", dot: "bg-emerald-500" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className={clsx("w-2.5 h-2.5 rounded-full", s.dot)} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={clsx("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search branch or transfer ID..."
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
            {["ALL", "PENDING", "SHIPPED", "COMPLETED"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-2 text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-[#f58220] text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {s === "ALL" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="flex-1" />
          <button onClick={loadTransfers} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* ── Empty State ── */}
        {loading ? (
          <div className="py-20 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-[#f58220] opacity-50" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
              <ArrowRightLeft className="h-8 w-8 text-[#f58220]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">No Transfers Found</p>
              <p className="text-gray-500 text-sm mt-1">Create a stock transfer to move inventory.</p>
            </div>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-[#f58220] hover:bg-[#e8740e] text-white font-semibold text-sm rounded-lg transition-colors"
            >
              Create Transfer
            </button>
          </div>
        ) : (
          /* ── Table ── */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-medium border-b border-gray-200 uppercase">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Transfer ID</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Destination</th>
                  <th className="text-center px-4 py-3">Items</th>
                  <th className="text-center px-4 py-3">Total Quantity</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => {
                  const style = STATUS_STYLES[t.status] || STATUS_STYLES.PENDING;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 text-xs">
                        #{t.id?.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium text-gray-800">{t.fromBranch?.name ?? "HQ"}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium text-gray-800">{t.toBranch?.name ?? "Branch"}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600 font-medium">
                        {t.items?.length || 0}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600 font-medium">
                        {(() => {
                          // Different transferred items can carry different
                          // units — sum per unit rather than producing a
                          // single meaningless cross-unit total.
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
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {t.status === "PENDING" && (
                            <button
                              onClick={(e) => handleDispatch(t.id, e)}
                              disabled={actioningId === t.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              <Send size={12} /> {actioningId === t.id ? "..." : "Dispatch"}
                            </button>
                          )}
                          {t.status === "SHIPPED" && (
                            <button
                              onClick={(e) => handleComplete(t.id, e)}
                              disabled={actioningId === t.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 size={12} /> {actioningId === t.id ? "..." : "Receive"}
                            </button>
                          )}
                          {t.status !== "PENDING" && t.status !== "SHIPPED" && (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
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
    </div>
  );
}
