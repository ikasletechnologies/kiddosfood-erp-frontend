"use client";

// Finished Goods Stock Hub: the production lots under one product, each with
// its own production cost and selling price (Production > Set Price). Lot figures
// are never merged into one price; the valuation totals below the table are
// shown separately for reference.
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, PackageOpen } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";
import { lotPricingApi } from "@/lib/api";
import { formatINR, LOT_PRICED, SaleLot } from "@/lib/lot-pricing";

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const formatQty = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

export default function FinishedGoodsLotsPanel({ sku, unit }: { sku: string; unit: string }) {
  const [lots, setLots] = useState<SaleLot[] | null>(null);
  const [showCost, setShowCost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    lotPricingApi.listLots({ sku, location: "HQ" })
      .then((res) => { if (!cancelled) { setLots(res.data?.lots ?? []); setShowCost(!!res.data?.showCost); } })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || "Failed to load lots"); });
    return () => { cancelled = true; };
  }, [sku]);

  if (error) return <p className="px-6 py-4 text-xs font-semibold text-red-500">{error}</p>;
  if (!lots) {
    return (
      <div className="px-6 py-5 flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Loading production lots…
      </div>
    );
  }

  const total = lots.reduce((s, l) => s + l.availableQty, 0);
  const costValue = lots.reduce((s, l) => s + (l.unitCost != null ? l.availableQty * l.unitCost : 0), 0);
  const sellValue = lots.reduce((s, l) => s + (l.sellingPriceExclTax != null ? l.availableQty * l.sellingPriceExclTax : 0), 0);
  const unpriced = lots.filter((l) => l.pricingStatus !== LOT_PRICED).length;

  return (
    <div className="px-4 sm:px-6 py-4 bg-slate-50/60 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Production Lots · {lots.length} with stock · {formatQty(total)} {unit} available
        </p>
        {unpriced > 0 && (
          <Link href="/sales/set-price" className="text-[11px] font-semibold text-amber-600 hover:underline">
            {unpriced} lot{unpriced === 1 ? "" : "s"} awaiting price → Set Price
          </Link>
        )}
      </div>

      {lots.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
          <PackageOpen size={16} /> No production lots with stock. Lots are created when packaging is confirmed.
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-card">
          <table className="w-full text-left text-[11px] min-w-[900px]">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">
              <tr>
                <th className="px-3 py-2.5">Lot No.</th>
                <th className="px-3 py-2.5">Produced</th>
                <th className="px-3 py-2.5">Expiry</th>
                <th className="px-3 py-2.5">Warehouse</th>
                <th className="px-3 py-2.5 text-right">Available</th>
                {showCost && <th className="px-3 py-2.5 text-right">Production Cost</th>}
                <th className="px-3 py-2.5 text-right">Selling Price</th>
                {showCost && <th className="px-3 py-2.5 text-right">Profit / Unit</th>}
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lots.map((lot) => {
                // Expired ON its expiry date (same rule as the server).
                const expired = lot.expiryDate && new Date(lot.expiryDate) < new Date(new Date().setHours(24, 0, 0, 0));
                return (
                  <tr key={lot.id}>
                    <td className="px-3 py-2.5">
                      <p className="font-mono font-semibold text-slate-800 dark:text-white">{lot.lotNumber}</p>
                      {lot.packSize && <p className="text-[10px] text-slate-400">{lot.packSize}</p>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(lot.productionDate)}</td>
                    <td className={clsx("px-3 py-2.5 whitespace-nowrap", expired ? "text-red-600 font-semibold" : "text-slate-600 dark:text-slate-300")}>{formatDate(lot.expiryDate)}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{lot.warehouse?.name || "—"}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <p className="font-bold text-slate-800 dark:text-white">{formatQty(lot.availableQty)} {unit}</p>
                      {lot.reservedQty > 0 && <p className="text-[10px] text-purple-600">{formatQty(lot.reservedQty)} reserved</p>}
                    </td>
                    {showCost && <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-700 dark:text-slate-300">{formatINR(lot.unitCost ?? null)}</td>}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {lot.sellingPrice != null ? (
                        <>
                          <p className="font-bold text-slate-800 dark:text-white">{formatINR(lot.sellingPrice)}</p>
                          <p className="text-[10px] text-slate-400">{lot.priceTaxInclusive ? "incl." : "excl."} GST</p>
                        </>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    {showCost && (
                      <td className={clsx("px-3 py-2.5 text-right whitespace-nowrap font-semibold", lot.unitProfit == null ? "text-slate-400" : lot.unitProfit < 0 ? "text-rose-600" : "text-emerald-600")}>
                        {lot.unitProfit == null ? "—" : `${lot.unitProfit < 0 ? "−" : "+"}${formatINR(Math.abs(lot.unitProfit))}`}
                        {lot.belowCost && <AlertTriangle size={11} className="inline ml-1" aria-label="Below production cost" />}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center">
                      <span className={clsx("text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", lot.pricingStatus === LOT_PRICED ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" : "text-amber-600 bg-amber-50 dark:bg-amber-500/10")}>
                        {lot.pricingStatus === LOT_PRICED ? "PRICED" : "AWAITING PRICE"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Aggregate valuation, shown separately — never used as a lot price. */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-3 py-2.5 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-500">
            <span>Total available: <b className="text-slate-700 dark:text-slate-200">{formatQty(total)} {unit}</b></span>
            {showCost && <span>Stock value at cost: <b className="text-slate-700 dark:text-slate-200">{formatINR(costValue)}</b></span>}
            <span>Priced stock at selling price (excl. GST): <b className="text-slate-700 dark:text-slate-200">{formatINR(sellValue)}</b>{unpriced > 0 ? " (priced lots only)" : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}
