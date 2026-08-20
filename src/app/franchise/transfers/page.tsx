"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRightLeft, Clock, CheckCircle2, Package, TrendingUp, Truck,
  Plus, X, AlertCircle, Send, Trash2
} from "lucide-react";
import { clsx } from "clsx";
import { franchiseApi, logisticsApi, inventoryApi } from "@/lib/api";

// Persisted Prisma StockTransferStatus values are PENDING / APPROVED / SHIPPED /
// COMPLETED / CANCELLED — there is no "IN_TRANSIT" status in the database.
// SHIPPED is what the backend sets once a transfer is dispatched; it's just
// displayed to the user as "In Transit".
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  SHIPPED: "In Transit",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  APPROVED:  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  SHIPPED:   "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

type TransferItemRow = { inventoryItemId: string; quantity: string };

export default function FranchiseTransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inTransit, setInTransit] = useState<{ totalTransfersInTransit: number; itemTotals: any[] } | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Create Transfer modal state
  const [showCreate, setShowCreate] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [sourceInventory, setSourceInventory] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [items, setItems] = useState<TransferItemRow[]>([{ inventoryItemId: "", quantity: "" }]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    inventoryApi.getInventory(sourceId)
      .then((res) => setSourceInventory(res.data ?? []))
      .catch(() => setSourceInventory([]))
      .finally(() => setLoadingInventory(false));
  }, [sourceId]);

  const resetForm = () => {
    setSourceId("");
    setDestId("");
    setSourceInventory([]);
    setItems([{ inventoryItemId: "", quantity: "" }]);
    setFormError(null);
  };

  const openCreate = () => { resetForm(); setShowCreate(true); };
  const closeCreate = () => { setShowCreate(false); resetForm(); };

  const updateItemRow = (idx: number, patch: Partial<TransferItemRow>) => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };
  const addItemRow = () => setItems((prev) => [...prev, { inventoryItemId: "", quantity: "" }]);
  const removeItemRow = (idx: number) => setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const availableFor = (inventoryItemId: string) =>
    sourceInventory.find((i) => i.id === inventoryItemId)?.currentStock ?? null;

  const handleCreate = async () => {
    setFormError(null);

    if (!sourceId) { setFormError("Select a source branch."); return; }
    if (!destId) { setFormError("Select a destination branch."); return; }
    if (sourceId === destId) { setFormError("Source and destination branch must be different."); return; }

    const cleanItems = items
      .filter((r) => r.inventoryItemId)
      .map((r) => ({ inventoryItemId: r.inventoryItemId, quantity: Number(r.quantity) }));

    if (cleanItems.length === 0) { setFormError("Add at least one item to transfer."); return; }
    for (const row of cleanItems) {
      if (!(row.quantity > 0)) { setFormError("Quantity must be greater than 0 for every item."); return; }
      const available = availableFor(row.inventoryItemId);
      if (available !== null && row.quantity > available) {
        const name = sourceInventory.find((i) => i.id === row.inventoryItemId)?.name ?? "item";
        setFormError(`Quantity for "${name}" exceeds available stock (${available}).`);
        return;
      }
    }
    // Guard against selecting the same item twice in one transfer
    const seen = new Set<string>();
    for (const row of cleanItems) {
      if (seen.has(row.inventoryItemId)) { setFormError("Each item can only be added once per transfer."); return; }
      seen.add(row.inventoryItemId);
    }

    setCreating(true);
    try {
      await franchiseApi.initiateTransfer({ fromBranchId: sourceId, toBranchId: destId, items: cleanItems });
      closeCreate();
      await loadTransfers();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || "Failed to create transfer.");
    } finally {
      setCreating(false);
    }
  };

  const handleDispatch = async (id: string) => {
    setActioningId(id);
    try {
      await franchiseApi.dispatchTransfer(id);
      await loadTransfers();
    } catch (err: any) {
      console.error("Failed to dispatch transfer", err);
      alert(err?.response?.data?.error || "Failed to dispatch transfer.");
    } finally {
      setActioningId(null);
    }
  };

  const handleComplete = async (id: string) => {
    setActioningId(id);
    try {
      await franchiseApi.completeTransfer(id);
      await loadTransfers();
    } catch (err: any) {
      console.error("Failed to receive transfer", err);
      alert(err?.response?.data?.error || "Failed to receive transfer.");
    } finally {
      setActioningId(null);
    }
  };

  const shippedCount = transfers.filter((t) => t.status === "SHIPPED").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft size={22} className="text-orange-500" />
            Stock Transfers
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Monitor inter-branch stock movement for batter, masala & raw materials
          </p>
        </div>
        <div className="flex items-center gap-3">
          {shippedCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl">
              <TrendingUp size={14} className="text-blue-500" />
              <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400">
                {shippedCount} In Transit
              </span>
            </div>
          )}
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-[12px] font-bold transition-all shadow-sm shadow-orange-500/20"
          >
            <Plus size={15} /> Create Stock Transfer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["Total", "Pending", "In Transit", "Completed"].map((label, i) => {
          const counts = [
            transfers.length,
            transfers.filter((t) => t.status === "PENDING").length,
            shippedCount,
            transfers.filter((t) => t.status === "COMPLETED").length,
          ];
          return (
            <div key={label} className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-white/5 p-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{counts[i]}</p>
            </div>
          );
        })}
      </div>

      {inTransit && inTransit.itemTotals.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-5 space-y-3">
          <h3 className="text-[12px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
            <Truck size={14} /> Goods in Transit ({inTransit.totalTransfersInTransit} {inTransit.totalTransfersInTransit === 1 ? "transfer" : "transfers"})
          </h3>
          <p className="text-[11px] text-blue-600/70 dark:text-blue-400/70 -mt-2">
            Already deducted from the source branch but not yet received at the destination.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {inTransit.itemTotals.map((item: any, i: number) => (
              <div key={i} className="bg-white dark:bg-card rounded-xl px-3 py-2 text-[12px] flex items-center justify-between">
                <span className="text-gray-700 dark:text-slate-300 font-medium truncate">{item.name}</span>
                <span className="font-bold text-gray-900 dark:text-white shrink-0 ml-2">{item.quantity} {item.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Loading transfers...</div>
      ) : transfers.length === 0 ? (
        <div className="py-20 text-center text-gray-300 dark:text-slate-600 space-y-3">
          <CheckCircle2 size={48} strokeWidth={1} className="mx-auto" />
          <p className="text-sm font-semibold">No transfers recorded yet</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-[12px] font-bold transition-all"
          >
            <Plus size={14} /> Create your first transfer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => (
            <div key={t.id} className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-white/5 p-5 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                    <Package size={18} className="text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">
                      {t.fromBranch?.name ?? "HQ"} → {t.toBranch?.name ?? "Branch"}
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock size={10} />
                      Transfer #{t.id?.slice(0, 8)} · {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
                <span className={clsx("px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0", STATUS_STYLES[t.status] ?? STATUS_STYLES.PENDING)}>
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
              </div>

              {t.items?.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {t.items.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[12px] bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-gray-700 dark:text-slate-300 font-medium">
                        {item.inventoryItem?.name ?? item.itemId}
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {item.quantity} {item.inventoryItem?.unit ?? item.unit ?? "units"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {t.status === "PENDING" && (
                <div className="mt-4">
                  <button
                    onClick={() => handleDispatch(t.id)}
                    disabled={actioningId === t.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-xl text-[12px] font-bold transition-all"
                  >
                    <Send size={13} /> {actioningId === t.id ? "Dispatching..." : "Dispatch"}
                  </button>
                </div>
              )}

              {t.status === "SHIPPED" && (
                <div className="mt-4">
                  <button
                    onClick={() => handleComplete(t.id)}
                    disabled={actioningId === t.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white rounded-xl text-[12px] font-bold transition-all"
                  >
                    <CheckCircle2 size={13} /> {actioningId === t.id ? "Receiving..." : "Mark as Received"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Stock Transfer Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeCreate} />
          <div className="relative w-full max-w-xl bg-white dark:bg-card rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-orange-500" /> Create Stock Transfer
              </h2>
              <button onClick={closeCreate} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-[12px] font-semibold">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" /> {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Source Branch *</label>
                  <select
                    value={sourceId}
                    onChange={(e) => { setSourceId(e.target.value); setItems([{ inventoryItemId: "", quantity: "" }]); }}
                    className="w-full h-10 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 rounded-lg font-semibold text-xs text-gray-800 dark:text-white outline-none focus:border-orange-400 transition-all"
                  >
                    <option value="">Select source...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.id === destId}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Destination Branch *</label>
                  <select
                    value={destId}
                    onChange={(e) => setDestId(e.target.value)}
                    className="w-full h-10 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 rounded-lg font-semibold text-xs text-gray-800 dark:text-white outline-none focus:border-orange-400 transition-all"
                  >
                    <option value="">Select destination...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.id === sourceId}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Items *</label>
                  {sourceId && loadingInventory && <span className="text-[10px] text-gray-400">Loading stock...</span>}
                </div>

                {!sourceId ? (
                  <p className="text-[12px] text-gray-400 py-3">Select a source branch to choose items.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((row, idx) => {
                      const available = row.inventoryItemId ? availableFor(row.inventoryItemId) : null;
                      const exceedsStock = available !== null && Number(row.quantity) > available;
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <select
                              value={row.inventoryItemId}
                              onChange={(e) => updateItemRow(idx, { inventoryItemId: e.target.value })}
                              className="flex-1 h-10 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-orange-400 transition-all"
                            >
                              <option value="">Select item...</option>
                              {sourceInventory.map((inv) => (
                                <option key={inv.id} value={inv.id} disabled={inv.currentStock <= 0}>
                                  {inv.name} ({inv.category === "RAW_MATERIAL" ? "Raw Material" : inv.category === "FINISHED_GOOD" ? "Finished Good" : inv.category}) — {inv.currentStock} {inv.unit} avail
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              placeholder="Qty"
                              value={row.quantity}
                              onChange={(e) => updateItemRow(idx, { quantity: e.target.value })}
                              className={clsx(
                                "w-24 h-10 bg-gray-50 dark:bg-white/5 border px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none transition-all",
                                exceedsStock ? "border-red-300 focus:border-red-400" : "border-gray-200 dark:border-white/10 focus:border-orange-400"
                              )}
                            />
                            <span className="w-14 text-[10px] text-gray-400 shrink-0">
                              {row.inventoryItemId ? (sourceInventory.find((i) => i.id === row.inventoryItemId)?.unit ?? "") : ""}
                            </span>
                            <button
                              onClick={() => removeItemRow(idx)}
                              disabled={items.length === 1}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent transition-colors shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {exceedsStock && (
                            <p className="text-[10px] font-semibold text-red-500 pl-0.5">Exceeds available stock ({available}).</p>
                          )}
                        </div>
                      );
                    })}
                    <button
                      onClick={addItemRow}
                      className="flex items-center gap-1 text-[11px] font-bold text-orange-500 hover:text-orange-600 transition-colors"
                    >
                      <Plus size={13} /> Add another item
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={closeCreate}
                className="px-4 py-2.5 text-[12px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-xl text-[12px] font-bold transition-all shadow-sm shadow-orange-500/20"
              >
                {creating ? "Creating..." : "Create Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
