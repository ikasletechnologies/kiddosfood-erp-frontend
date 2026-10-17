"use client";

// Finished Goods Stock Hub / Set Price: the production lots under one product.
// Each lot keeps its own stock, production cost, expiry and warehouse; all
// lots sell at the product's prices (Customer / Dealer / Franchise, set once
// in Production > Set Price). Lots are never merged — the totals below the
// table are shown separately for reference.
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, PackageOpen } from "lucide-react";
import { clsx } from "clsx";
import { lotPricingApi } from "@/lib/api";
import { formatINR, PRICE_TIERS, SaleLot } from "@/lib/lot-pricing";

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const formatQty = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

type Prices = { customerPrice?: number | null; dealerPrice?: number | null; franchisePrice?: number | null };

export default function FinishedGoodsLotsPanel({ sku, unit, prices, includeEmpty }: { sku: string; unit: string; prices?: Prices | null; includeEmpty?: boolean }) {
  const [lots, setLots] = useState<SaleLot[] | null>(null);
  const [showCost, setShowCost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    lotPricingApi.listLots({ sku, location: "HQ", includeEmpty: includeEmpty || undefined })
      .then((res) => { if (!cancelled) { setLots(res.data?.lots ?? []); setShowCost(!!res.data?.showCost); } })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || "Failed to load lots"); });
    return () => { cancelled = true; };
  }, [sku, includeEmpty]);

  if (error) return <p className="px-6 py-4 text-xs font-semibold text-red-500">{error}</p>;
  if (!lots) {
    return (
      <div className="px-6 py-5 flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Loading production lots…
      </div>
    );
  }

  const total = lots.reduce((s, l) => s + l.availableQty, 0);
  const costValue = lots.reduce((s, l) => s + (l.unitCost != null ? l.currentQty * l.unitCost : 0), 0);
  const tiers = PRICE_TIERS.map((t) => ({ ...t, price: Number(prices?.[t.key]) > 0 ? Number(prices?.[t.key]) : null }));
  const showMargins = showCost && tiers.some((t) => t.price != null);

  return (
    <div className="px-4 sm:px-6 py-4 bg-slate-50/60 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Production Lots · {lots.length} lot{lots.length === 1 ? "" : "s"} · {formatQty(total)} {unit} available
        </p>
        {prices && (
          <p className="text-[11px] text-slate-500">
            All lots sell at:{" "}
            {tiers.map((t, i) => (
              <span key={t.key}>
                {i > 0 && " · "}
                {t.label} <b className="text-slate-700 dark:text-slate-200">{t.price != null ? formatINR(t.price) : "not set"}</b>
              </span>
            ))}
            <span className="text-slate-400"> (excl. GST)</span>
          </p>
        )}
      </div>

      {lots.length === 0 ? (
        <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
          <PackageOpen size={16} /> No production lots with stock. Lots are created when packaging is confirmed.
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-card">
          <table className="w-full text-left text-[11px] min-w-[760px]">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">
              <tr>
                <th className="px-3 py-2.5">Lot No.</th>
                <th className="px-3 py-2.5">Produced</th>
                <th className="px-3 py-2.5">Expiry</th>
                <th className="px-3 py-2.5">Warehouse</th>
                <th className="px-3 py-2.5 text-right">Available</th>
                {showCost && <th className="px-3 py-2.5 text-right">Production Cost</th>}
                {showCost && <th className="px-3 py-2.5 text-right">Stock Value</th>}
                {showMargins && <th className="px-3 py-2.5 text-right">Margin / Unit (C · D · F)</th>}
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lots.map((lot) => {
                // Expired ON its expiry date (same rule as the server).
                const expired = !!lot.expiryDate && new Date(lot.expiryDate) < new Date(new Date().setHours(24, 0, 0, 0));
                const status = expired ? "EXPIRED" : lot.sellable === false ? String(lot.stockStatus || "UNAVAILABLE").replace(/_/g, " ") : lot.availableQty > 0 ? "SELLABLE" : "SOLD OUT";
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
                    {showCost && <td className="px-3 py-2.5 text-right whitespace-nowrap text-slate-700 dark:text-slate-300">{formatINR(lot.stockValue ?? null)}</td>}
                    {showMargins && (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {tiers.map((t, i) => {
                          const m = t.price != null && lot.unitCost != null ? Math.round((t.price - lot.unitCost) * 100) / 100 : null;
                          return (
                            <span key={t.key} title={`${t.label} price ${t.price != null ? formatINR(t.price) : "not set"}`} className={clsx("font-semibold", m == null ? "text-slate-400" : m < 0 ? "text-rose-600" : "text-emerald-600")}>
                              {i > 0 && <span className="text-slate-300"> · </span>}
                              {m == null ? "—" : `${m < 0 ? "−" : "+"}${formatINR(Math.abs(m))}`}
                              {m != null && m < 0 && <AlertTriangle size={10} className="inline ml-0.5 -mt-0.5" aria-label={`${t.label} price below this lot's cost`} />}
                            </span>
                          );
                        })}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center">
                      <span className={clsx(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
                        status === "SELLABLE" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
                          : status === "SOLD OUT" ? "text-slate-500 bg-slate-100 dark:bg-white/5"
                          : "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
                      )}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Aggregate valuation, shown separately — each lot keeps its own cost. */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-3 py-2.5 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-500">
            <span>Total available: <b className="text-slate-700 dark:text-slate-200">{formatQty(total)} {unit}</b></span>
            {showCost && <span>Inventory value at cost: <b className="text-slate-700 dark:text-slate-200">{formatINR(costValue)}</b></span>}
          </div>
        </div>
      )}
    </div>
  );
}
