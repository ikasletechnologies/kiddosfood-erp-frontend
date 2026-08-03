"use client";

import { useState, useEffect } from "react";
import { ArrowRightLeft, Clock, CheckCircle2, Package, TrendingUp, Truck } from "lucide-react";
import { clsx } from "clsx";
import { franchiseApi, logisticsApi } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  IN_TRANSIT:"bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

export default function FranchiseTransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inTransit, setInTransit] = useState<{ totalTransfersInTransit: number; itemTotals: any[] } | null>(null);

  useEffect(() => {
    franchiseApi.getTransfers()
      .then((res) => setTransfers(res.data ?? []))
      .catch(() => setTransfers([]))
      .finally(() => setLoading(false));

    logisticsApi.getInTransit()
      .then((res) => setInTransit(res.data))
      .catch(() => setInTransit(null));
  }, []);

  const handleComplete = async (id: string) => {
    try {
      await franchiseApi.completeTransfer(id);
      setTransfers((prev) =>
        prev.map((t) => t.id === id ? { ...t, status: "COMPLETED" } : t)
      );
    } catch (err) {
      console.error("Failed to complete transfer", err);
    }
  };

  const inTransitCount = transfers.filter((t) => t.status === "IN_TRANSIT").length;

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
        {inTransitCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl">
            <TrendingUp size={14} className="text-blue-500" />
            <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400">
              {inTransitCount} In Transit
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["Total", "Pending", "In Transit", "Completed"].map((label, i) => {
          const counts = [
            transfers.length,
            transfers.filter((t) => t.status === "PENDING").length,
            transfers.filter((t) => t.status === "IN_TRANSIT").length,
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
        <div className="py-20 text-center text-gray-300 dark:text-slate-600 space-y-2">
          <CheckCircle2 size={48} strokeWidth={1} className="mx-auto" />
          <p className="text-sm font-semibold">No transfers recorded yet</p>
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
                      {t.fromFranchise?.name ?? "HQ"} → {t.toFranchise?.name ?? "Branch"}
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock size={10} />
                      Transfer #{t.id?.slice(0, 8)} · {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
                <span className={clsx("px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0", STATUS_STYLES[t.status] ?? STATUS_STYLES.PENDING)}>
                  {t.status?.replace("_", " ")}
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
                        {item.quantity} {item.unit ?? "units"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {t.status === "IN_TRANSIT" && (
                <div className="mt-4">
                  <button
                    onClick={() => handleComplete(t.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-[12px] font-bold transition-all"
                  >
                    <CheckCircle2 size={13} /> Mark as Received
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
