"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Truck,
  CheckCircle2,
  Package,
  Clock,
  AlertTriangle,
  RotateCcw,
  Search,
} from "lucide-react";
import { clsx } from "clsx";
import { salesApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";

// Dispatch Tracking = SHIPMENT STATUS (vehicle/driver/dates/party), as
// distinct from Transit Stock = QUANTITY (see /dispatch/transit-stock).
// Sourced from SalesService.getDispatchTracking() — one row per Delivery
// Challan, deliberately not a separate model (see backend comment): a DC
// already carries every field this view needs, so a parallel
// "DispatchTracking" table would just be a second copy of the same
// shipment kept in sync by hand.
//
// This route previously showed an unrelated POS home-delivery feed
// (order.riderName / /api/delivery/active) with a hardcoded "Active
// Riders" roster and fixed 24min/99.2%/94.8% performance stats — none of
// that was wired to any real rider/fleet model, and it had nothing to do
// with Delivery Challan dispatch. Removed; that backend API is untouched
// in case something else still depends on it, this page just no longer
// reads it.

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  DELIVERED: { label: "Delivered", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  IN_TRANSIT: { label: "In Transit", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500" },
  DRAFT: { label: "Draft", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400" },
  CANCELLED: { label: "Cancelled", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500" },
};
function getConf(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
}

export default function DispatchTrackingPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchTracking = async () => {
    setLoading(true);
    try {
      const res = await salesApi.getDispatchTracking();
      setRows((res as any).data || []);
    } catch (err) {
      console.error("Failed to fetch dispatch tracking:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, []);

  const filtered = rows.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.challanNumber?.toLowerCase().includes(q) ||
      r.dispatchId?.toLowerCase().includes(q) ||
      r.invoiceNumber?.toLowerCase().includes(q) ||
      r.partyName?.toLowerCase().includes(q) ||
      r.vehicleNo?.toLowerCase().includes(q) ||
      r.driverName?.toLowerCase().includes(q)
    );
  });

  // Real record counts only — no placeholder fleet stats.
  const stats = useMemo(() => ({
    total: rows.length,
    inTransit: rows.filter(r => r.status === "IN_TRANSIT").length,
    delivered: rows.filter(r => r.status === "DELIVERED" || r.status === "CLOSED").length,
    delayed: rows.filter(r => {
      if (r.status !== "IN_TRANSIT" || !r.expectedDeliveryDate) return false;
      const expDate = new Date(r.expectedDeliveryDate);
      if (isNaN(expDate.getTime())) return false;
      if (expDate.getHours() === 0 && expDate.getMinutes() === 0 && expDate.getSeconds() === 0) {
        expDate.setHours(23, 59, 59, 999);
      }
      return expDate < new Date();
    }).length,
  }), [rows]);

  const handleMarkDelivered = async (challanId: string) => {
    if (!window.confirm("Mark this shipment as Delivered?")) return;
    setMarkingId(challanId);
    try {
      await salesApi.markDeliveryChallanDelivered(challanId, {});
      showToast("Delivery confirmed", "success");
      fetchTracking();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Failed to confirm delivery", "error");
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 dark:bg-background min-h-screen text-slate-800 dark:text-slate-100 w-full min-w-0">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end items-start sm:items-center border-b border-slate-200 dark:border-white/10 pb-4 w-full min-w-0">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-lg p-1 shadow-sm">
            <div className="flex items-center px-2 text-slate-400 dark:text-slate-500"><Search size={14} /></div>
            <input
              type="text"
              placeholder="Search DC, invoice, party, vehicle, driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none text-slate-700 dark:text-white focus:ring-0 p-1 font-semibold text-sm outline-none w-64 placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center border border-slate-200 dark:border-white/10 rounded-lg overflow-x-auto custom-scrollbar max-w-full bg-white dark:bg-card">
            {["ALL", "IN_TRANSIT", "DELIVERED", "DRAFT"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx("px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap", statusFilter === s ? "bg-orange-500 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5")}
              >
                {s === "ALL" ? "All" : getConf(s).label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchTracking}
            title="Refresh Data"
            className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-150 active:scale-95 shrink-0"
          >
            <RotateCcw size={16} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Stats Row — real record counts only */}
      <div className="flex items-center gap-3 flex-wrap w-full min-w-0">
        {[
          { label: "Total Dispatches", value: stats.total, icon: Package, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10", borderColor: "border-indigo-200 dark:border-indigo-500/20" },
          { label: "In Transit", value: stats.inTransit, icon: Truck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10", borderColor: "border-blue-200 dark:border-blue-500/20" },
          { label: "Delivered", value: stats.delivered, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", borderColor: "border-emerald-200 dark:border-emerald-500/20" },
          { label: "Delayed", value: stats.delayed, icon: AlertTriangle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", borderColor: "border-rose-200 dark:border-rose-500/20" },
        ].map((s) => (
          <div key={s.label} className={clsx("flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm bg-white dark:bg-card flex-1 min-w-[150px]", s.borderColor)}>
            <div className={clsx("p-2 rounded-lg", s.bg)}><s.icon size={16} className={s.color} /></div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Shipments Table */}
      <div className="bg-white dark:bg-card border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden w-full min-w-0">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">Loading dispatches...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Truck size={40} className="text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{search || statusFilter !== "ALL" ? "No dispatches match your filters." : "No dispatches yet."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-y border-slate-200 dark:border-white/5">
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dispatch ID</th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">DC No</th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Invoice No</th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Party</th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vehicle / Driver</th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Dispatch Date</th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">Status</th>
                  <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.map((r) => {
                  const conf = getConf(r.status);
                  return (
                    <tr key={r.challanId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 sm:px-5 py-3">
                        <p className="text-[13px] font-bold text-orange-600 dark:text-orange-400 font-mono">{r.dispatchId}</p>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200">{r.challanNumber}</td>
                      <td className="px-4 sm:px-5 py-3 text-[13px] text-slate-600 dark:text-slate-300">{r.invoiceNumber || "—"}</td>
                      <td className="px-4 sm:px-5 py-3">
                        <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">{r.partyName || "—"}</div>
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{r.partyType}</div>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-[13px] text-slate-600 dark:text-slate-300">
                        {r.vehicleNo || "—"}{r.driverName ? ` / ${r.driverName}` : ""}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-[13px] text-slate-500 dark:text-slate-400">{formatDate(r.dispatchDate)}</td>
                      <td className="px-4 sm:px-5 py-3 text-center">
                        <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider", conf.bg, conf.color, conf.border, "dark:bg-white/5 dark:border-white/10")}>
                          <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", conf.dot, r.status === "IN_TRANSIT" && "animate-pulse")} />
                          {conf.label}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right">
                        {r.status === "IN_TRANSIT" ? (
                          <button
                            onClick={() => handleMarkDelivered(r.challanId)}
                            disabled={markingId === r.challanId}
                            className="px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {markingId === r.challanId ? "..." : "Mark Delivered"}
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 text-xs font-bold text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="px-4 sm:px-5 py-3 bg-slate-50/50 dark:bg-white/[0.01] border-t border-slate-200 dark:border-white/5">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Showing {filtered.length} of {rows.length} dispatches</p>
          </div>
        )}
      </div>
    </div>
  );
}
