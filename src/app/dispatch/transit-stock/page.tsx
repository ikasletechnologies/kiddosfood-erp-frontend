"use client";

import { useState, useEffect, useMemo } from "react";
import { Truck, Search, CheckCircle, RefreshCw, Calendar } from "lucide-react";
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
}

export default function TransitStockPage() {
  const [rows, setRows] = useState<TransitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
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

  // Delivery completion has exactly ONE implementation across the whole
  // Dispatch module (Delivery Challan list, this page, Dispatch Tracking) —
  // SalesService.markChallanDelivered — so a repeat click from any of them
  // is a safe no-op instead of a second, divergent delivery.
  const handleMarkDelivered = async (challanId: string) => {
    if (!window.confirm("Mark this challan as Delivered? Transit quantity will close and the challan status will update.")) return;
    setMarkingId(challanId);
    try {
      await salesApi.markDeliveryChallanDelivered(challanId, {});
      showToast("Delivery completed successfully", "success");
      fetchTransitStock();
    } catch (e: any) {
      showToast(e?.response?.data?.error || "Error marking as delivered", "error");
    } finally {
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
      rows.filter(r => (r as any).expectedDeliveryDate && new Date((r as any).expectedDeliveryDate) < now).map(r => r.challanId)
    );
    return {
      activeTransit: uniqueChallans.size,
      inTransitQty: rows.reduce((s, r) => s + r.quantity, 0),
      delayed: delayedChallans.size,
    };
  }, [rows]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-background text-slate-800 dark:text-slate-100">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-card shrink-0 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Active Transit (Challans)</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.activeTransit}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">In Transit Qty (all items)</p>
              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{stats.inTransitQty}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Delayed (past expected delivery)</p>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{stats.delayed}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Challan, Party, Product or Batch..."
              className="w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-white/10 bg-white dark:bg-[#13151f] text-slate-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
            />
          </div>
          <button
            onClick={fetchTransitStock}
            className="p-2 border border-gray-300 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-slate-300"
            title="Refresh"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48 text-gray-400 dark:text-slate-500 text-sm">Loading Transit Stock...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-48 text-gray-400 dark:text-slate-500">
              <Truck size={32} className="mb-2 opacity-50" />
              <div className="text-sm">No items currently in transit</div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3 font-medium whitespace-nowrap">DC No</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Date</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Source Warehouse</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Party</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Type</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Product</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Batch</th>
                    <th className="px-5 py-3 font-medium text-right whitespace-nowrap">Qty</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Status</th>
                    <th className="px-5 py-3 font-medium text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filtered.map((r, i) => (
                    <tr key={`${r.challanId}-${i}`} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-orange-600 dark:text-orange-400">{r.challanNumber}</td>
                      <td className="px-5 py-3 text-sm text-gray-600 dark:text-slate-400">{formatDate(r.dispatchDate)}</td>
                      <td className="px-5 py-3 text-sm text-gray-700 dark:text-slate-300">{r.sourceWarehouseName || "—"}</td>
                      <td className="px-5 py-3 text-sm text-gray-700 dark:text-slate-300 font-medium">{r.partyName || "—"}</td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10">{r.partyType}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-800 dark:text-slate-200">{r.productName}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-600 dark:text-slate-400">{r.batchNumber || "—"}</td>
                      <td className="px-5 py-3 text-sm font-medium text-right">
                        {r.quantity} <span className="text-xs text-gray-500 dark:text-slate-400 font-normal">{r.unit}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                          In Transit
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => handleMarkDelivered(r.challanId)}
                          disabled={markingId === r.challanId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:text-emerald-700 rounded-lg text-xs font-semibold transition-colors border border-emerald-200 dark:border-emerald-500/20 shadow-sm disabled:opacity-50"
                        >
                          <CheckCircle size={14} /> {markingId === r.challanId ? "..." : "Delivered"}
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
    </div>
  );
}
