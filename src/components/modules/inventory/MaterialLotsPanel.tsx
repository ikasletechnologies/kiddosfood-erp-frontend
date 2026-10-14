"use client";

import { useEffect, useState } from "react";
import { Loader2, PackageOpen } from "lucide-react";
import { clsx } from "clsx";
import { rawMaterialsApi } from "@/lib/api";

type Lot = {
  id: string;
  lotNumber: string;
  billNumber: string | null;
  vendorBatchNo: string | null;
  source: "PURCHASE" | "PRODUCTION" | "OTHER";
  supplier: { id: string; name: string } | null;
  poNumber: string | null;
  purchaseDate: string | null;
  receivedAt: string;
  purchaseQty: number | null;
  purchaseUnit: string | null;
  purchasePrice: number | null;
  receivedQty: number;
  availableQty: number;
  pendingReturnQty: number;
  unitCost: number;
  stockValue: number;
  expDate: string | null;
  status: string;
  warehouse: { id: string; name: string } | null;
};

export type LotSummary = {
  activeLots: number;
  lotQty: number;
  lotValue: number;
  untrackedQty: number;
  untrackedValue: number;
  totalValue: number;
  weightedAvgCost: number;
};

export const formatINR = (n: number) =>
  `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const formatQty = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
  QC_HOLD: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
  RECEIVED: "text-blue-600 bg-blue-50 dark:bg-blue-500/10",
  BLOCKED: "text-red-600 bg-red-50 dark:bg-red-500/10",
  EXPIRED: "text-red-600 bg-red-50 dark:bg-red-500/10",
  RETURNED: "text-slate-500 bg-slate-100 dark:bg-white/5",
};

export default function MaterialLotsPanel({ itemId, unit, summary }: { itemId: string; unit: string; summary?: LotSummary }) {
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConsumed, setShowConsumed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    rawMaterialsApi.getLots(itemId)
      .then((res) => { if (!cancelled) setLots(res.data?.lots ?? []); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || "Failed to load batches"); });
    return () => { cancelled = true; };
  }, [itemId]);

  if (error) return <p className="px-6 py-4 text-xs font-semibold text-red-500">{error}</p>;
  if (!lots) {
    return (
      <div className="px-6 py-5 flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Loading purchase batches…
      </div>
    );
  }

  const active = lots.filter((l) => l.availableQty > 0.0001);
  const consumed = lots.length - active.length;
  const visible = showConsumed ? lots : active;
  const today = new Date();

  return (
    <div className="px-4 sm:px-6 py-4 bg-slate-50/60 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Purchase Batches · {active.length} active
        </p>
        {consumed > 0 && (
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showConsumed} onChange={(e) => setShowConsumed(e.target.checked)} className="rounded" />
            Show {consumed} fully consumed
          </label>
        )}
      </div>

      {visible.length === 0 && !(summary && summary.untrackedQty > 0) ? (
        <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
          <PackageOpen size={16} /> No purchase batches with stock. Batches are created when a GRN is approved.
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-card">
          <table className="w-full text-left text-[11px] min-w-[1100px]">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">
              <tr>
                <th className="px-3 py-2.5">Lot No.</th>
                <th className="px-3 py-2.5">Supplier</th>
                <th className="px-3 py-2.5">Purchase / Receipt</th>
                <th className="px-3 py-2.5 text-right">Unit Cost</th>
                <th className="px-3 py-2.5 text-right">Received</th>
                <th className="px-3 py-2.5 text-right">Available</th>
                <th className="px-3 py-2.5 text-right">Batch Value</th>
                <th className="px-3 py-2.5">Expiry</th>
                <th className="px-3 py-2.5">Warehouse</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((lot) => {
                const expired = lot.expDate && new Date(lot.expDate) < today;
                const boughtInOtherUnit = lot.purchaseUnit && lot.purchaseQty != null && lot.purchaseUnit.toUpperCase() !== unit.toUpperCase();
                return (
                  <tr key={lot.id} className={clsx(lot.availableQty <= 0.0001 && "opacity-50")}>
                    <td className="px-3 py-2.5">
                      <p className="font-mono font-semibold text-slate-800 dark:text-white">{lot.lotNumber}</p>
                      {lot.vendorBatchNo && <p className="text-[10px] text-slate-400">Mfr batch: {lot.vendorBatchNo}</p>}
                      {lot.billNumber && <p className="text-[10px] text-slate-400">{lot.billNumber}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{lot.supplier?.name || (lot.source === "PRODUCTION" ? "In-house production" : "—")}</p>
                      {lot.poNumber && <p className="text-[10px] font-mono text-slate-400">{lot.poNumber}</p>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {lot.purchaseDate && <p className="text-[10px] text-slate-400">PO: {formatDate(lot.purchaseDate)}</p>}
                      <p>Rcvd: {formatDate(lot.receivedAt)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{formatINR(lot.unitCost)}/{unit}</p>
                      {boughtInOtherUnit && lot.purchasePrice != null && (
                        <p className="text-[10px] text-slate-400">{formatINR(lot.purchasePrice)}/{lot.purchaseUnit}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-600 dark:text-slate-300">
                      <p>{formatQty(lot.receivedQty)} {unit}</p>
                      {boughtInOtherUnit && <p className="text-[10px] text-slate-400">{formatQty(lot.purchaseQty!)} {lot.purchaseUnit}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <p className="font-bold text-slate-800 dark:text-white">{formatQty(lot.availableQty)} {unit}</p>
                      {lot.pendingReturnQty > 0 && <p className="text-[10px] text-amber-600">{formatQty(lot.pendingReturnQty)} pending return</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-800 dark:text-white whitespace-nowrap">{formatINR(lot.stockValue)}</td>
                    <td className={clsx("px-3 py-2.5 whitespace-nowrap", expired ? "text-red-600 font-semibold" : "text-slate-600 dark:text-slate-300")}>
                      {formatDate(lot.expDate)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{lot.warehouse?.name || "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={clsx("text-[9px] font-bold px-2 py-0.5 rounded-full", STATUS_STYLES[lot.status] || STATUS_STYLES.RETURNED)}>
                        {lot.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {summary && summary.untrackedQty > 0.0001 && (
                <tr className="bg-slate-50/50 dark:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-semibold text-slate-500" colSpan={5}>
                    Untracked stock <span className="font-normal text-slate-400">(opening balance / adjustments, valued at average cost)</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatQty(summary.untrackedQty)} {unit}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatINR(summary.untrackedValue)}</td>
                  <td colSpan={3} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
