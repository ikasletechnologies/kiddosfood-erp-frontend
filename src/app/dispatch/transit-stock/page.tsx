"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Truck, Search, CheckCircle, RefreshCw, X, Check, Loader2, PackageCheck
} from "lucide-react";
import { clsx } from "clsx";
import { salesApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatDate } from "@/lib/utils";

// Transit Stock = QUANTITY currently out of the warehouse and not yet
// delivered. Sourced entirely from SalesService.getTransitStock() — derived
// server-side from IN_TRANSIT Delivery Challans, not a separate manual-entry
// screen and not re-derived here client-side (that used to duplicate, and
// disagree with, the backend's own party/warehouse/UOM resolution).
interface TransitRow {
  challanId: string;
  challanNumber: string;
  sourceDocument: "SALES_INVOICE" | "DIRECT";
  partyType: string;
  partyName: string | null;
  sourceWarehouseName: string | null;
  productName: string;
  batchNumber: string | null;
  quantity: number;
  unit: string;
  dispatchDate: string;
  vehicleNo: string | null;
  driverName: string | null;
  status: string;
  expectedDeliveryDate?: string | null;
}

export default function TransitStockPage() {
  const [rows, setRows] = useState<TransitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<TransitRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchTransitStock = async () => {
    setLoading(true);
    try {
      const res = await salesApi.getTransitStock();
      setRows((res as any).data || []);
    } catch (e: any) {
      console.error(e);
      showToast("Failed to fetch transit stock", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransitStock();
  }, []);

  const openDeliverModal = (row: TransitRow) => {
    setSelectedRow(row);
  };

  // Delivery completion has exactly ONE implementation across the whole
  // Dispatch module (Delivery Challan list, this page, Dispatch Tracking) —
  // SalesService.markChallanDelivered — so a repeat click from any of them
  // is a safe no-op instead of a second, divergent delivery.
  const confirmDelivery = async () => {
    if (!selectedRow || submitting) return;
    setSubmitting(true);
    setMarkingId(selectedRow.challanId);
    try {
      await salesApi.markDeliveryChallanDelivered(selectedRow.challanId, {});
      showToast("Delivery completed successfully", "success");
      setSelectedRow(null);
      await fetchTransitStock();
    } catch (e: any) {
      console.error("Delivery error:", e);
      const msg = e?.response?.data?.error || e?.response?.data?.message || "Error marking as delivered";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
      setMarkingId(null);
    }
  };

  const filtered = rows.filter(r =>
    !search ||
    r.challanNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.partyName || "").toLowerCase().includes(search.toLowerCase()) ||
    r.productName.toLowerCase().includes(search.toLowerCase()) ||
    (r.batchNumber || "").toLowerCase().includes(search.toLowerCase())
  );

  // Every row here is already IN_TRANSIT by construction (getTransitStock
  // only returns IN_TRANSIT challans) — cards reflect real record counts,
  // not placeholder values. "Delayed" = past its expected delivery date;
  // "Returned" isn't tracked at the transit-quantity level (a return only
  // exists once goods are back at the warehouse, i.e. after delivery), so
  // it's omitted rather than shown as a fake zero.
  const stats = useMemo(() => {
    const uniqueChallans = new Set(rows.map(r => r.challanId));
    const now = new Date();
    const delayedChallans = new Set(
      rows.filter(r => {
        const exp = (r as any).expectedDeliveryDate;
        if (!exp) return false;
        const expDate = new Date(exp);
        if (isNaN(expDate.getTime())) return false;
        if (expDate.getHours() === 0 && expDate.getMinutes() === 0 && expDate.getSeconds() === 0) {
          expDate.setHours(23, 59, 59, 999);
        }
        return expDate < now;
      }).map(r => r.challanId)
    );
    return {
      activeTransit: uniqueChallans.size,
      inTransitQty: rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0),
      delayed: delayedChallans.size,
    };
  }, [rows]);

  const renderStatusBadge = (r: TransitRow) => {
    const isDelayed = (() => {
      const exp = (r as any).expectedDeliveryDate;
      if (!exp) return false;
      const expDate = new Date(exp);
      if (isNaN(expDate.getTime())) return false;
      if (expDate.getHours() === 0 && expDate.getMinutes() === 0 && expDate.getSeconds() === 0) {
        expDate.setHours(23, 59, 59, 999);
      }
      return expDate < new Date();
    })();

    const statusUpper = (r.status || "IN_TRANSIT").toUpperCase();

    if (statusUpper === "DELIVERED") {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Delivered
        </span>
      );
    }

    if (isDelayed) {
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 whitespace-nowrap shadow-2xs" title="Past expected delivery date">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          Delayed
        </span>
      );
    }

    return (
      <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 whitespace-nowrap shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        In Transit
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-background text-slate-800 dark:text-slate-100 w-full min-w-0">
      {/* Top Metric Cards & Search Bar */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-card shrink-0 space-y-4 w-full min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">Active Transit (Challans)</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400 truncate">{stats.activeTransit}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">In Transit Qty (all items)</p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400 truncate">{stats.inTransitQty}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">Delayed (past expected)</p>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400 truncate">{stats.delayed}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 w-full min-w-0">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Challan, Party, Product or Batch..."
              className="w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#13151f] text-slate-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors shadow-2xs"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <button
            onClick={fetchTransitStock}
            disabled={loading}
            className="p-2 border border-gray-300 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-slate-300 shrink-0 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin text-orange-500")} />
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 w-full min-w-0">
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden w-full min-w-0">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-56 text-gray-400 dark:text-slate-500 text-sm gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              <span>Loading Transit Stock...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-56 text-gray-400 dark:text-slate-500">
              <Truck size={36} className="mb-2.5 opacity-40 text-gray-400" />
              <div className="text-sm font-medium">No items currently in transit</div>
              {search && <p className="text-xs text-gray-400 mt-1">Try clearing your search filter</p>}
            </div>
          ) : (
            <div className="w-full max-w-full overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 font-semibold whitespace-nowrap w-[130px]">DC No</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap w-[100px]">Date</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap w-[140px]">Source Warehouse</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap w-[140px]">Party</th>
                    <th className="px-3 py-3 font-semibold text-center whitespace-nowrap w-[70px]">Type</th>
                    <th className="px-4 py-3 font-semibold min-w-[200px] max-w-[280px]">Product</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap w-[110px]">Batch</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap w-[90px]">Qty</th>
                    <th className="px-4 py-3 font-semibold text-center whitespace-nowrap w-[120px]">Status</th>
                    <th className="px-4 py-3 font-semibold text-center whitespace-nowrap w-[140px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filtered.map((r, i) => (
                    <tr key={`${r.challanId}-${i}`} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group">
                      {/* DC No */}
                      <td className="px-4 py-3 text-xs sm:text-sm font-bold font-mono text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        {r.challanNumber}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs sm:text-sm text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(r.dispatchDate)}
                      </td>

                      {/* Source Warehouse */}
                      <td className="px-4 py-3 text-xs sm:text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {r.sourceWarehouseName || "—"}
                      </td>

                      {/* Party */}
                      <td className="px-4 py-3 text-xs sm:text-sm text-gray-800 dark:text-slate-200 font-medium whitespace-nowrap">
                        {r.partyName || "—"}
                      </td>

                      {/* Type */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 uppercase">
                          {r.partyType}
                        </span>
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3 text-xs sm:text-sm text-gray-800 dark:text-slate-200 font-medium min-w-[200px] max-w-[280px]">
                        <div className="line-clamp-2 leading-snug break-words" title={r.productName}>
                          {r.productName}
                        </div>
                      </td>

                      {/* Batch */}
                      <td className="px-3 py-3 text-xs font-mono text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        {r.batchNumber || "—"}
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3 text-xs sm:text-sm font-bold font-mono text-right whitespace-nowrap text-gray-900 dark:text-white">
                        {r.quantity} <span className="text-xs text-gray-500 dark:text-slate-400 font-normal">{r.unit}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {renderStatusBadge(r)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDeliverModal(r)}
                          disabled={submitting || markingId === r.challanId}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:text-emerald-700 active:scale-95 rounded-lg text-xs font-semibold transition-all border border-emerald-200 dark:border-emerald-500/20 shadow-2xs disabled:opacity-50 cursor-pointer min-h-[32px] whitespace-nowrap"
                        >
                          {markingId === r.challanId ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle size={13} />
                              <span>Mark Delivered</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ERP CONFIRMATION MODAL (Replaces native browser confirm) */}
      {selectedRow && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            if (!submitting) {
              setSelectedRow(null);
            }
          }}
        >
          <div 
            className="bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <PackageCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Mark as Delivered</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Confirm Delivery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!submitting) setSelectedRow(null);
                }}
                disabled={submitting}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300">
                Are you sure you want to mark this delivery challan as delivered?
              </p>

              {/* Dynamic Challan Details Card */}
              <div className="bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/5 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400 font-medium">Challan:</span>
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{selectedRow.challanNumber}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-500 dark:text-slate-400 font-medium shrink-0">Product:</span>
                  <span className="font-semibold text-gray-800 dark:text-slate-200 text-right leading-snug break-words">{selectedRow.productName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400 font-medium">Quantity:</span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">
                    {selectedRow.quantity} <span className="font-normal text-gray-500 dark:text-slate-400">{selectedRow.unit}</span>
                  </span>
                </div>
                {selectedRow.partyName && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-slate-400 font-medium">Recipient:</span>
                    <span className="font-medium text-gray-800 dark:text-slate-200">
                      {selectedRow.partyName} <span className="text-gray-400 dark:text-slate-500 text-[11px]">({selectedRow.partyType})</span>
                    </span>
                  </div>
                )}
                {selectedRow.batchNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-slate-400 font-medium">Batch:</span>
                    <span className="font-mono text-gray-700 dark:text-slate-300">{selectedRow.batchNumber}</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed bg-blue-50/60 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 rounded-lg p-2.5">
                ℹ️ This will close the transit quantity and update the challan status to <span className="font-semibold text-emerald-600 dark:text-emerald-400">Delivered</span>.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                disabled={submitting}
                className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-white dark:hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelivery}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl transition-all shadow-sm disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Mark Delivered</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
