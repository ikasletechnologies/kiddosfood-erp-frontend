"use client";

// Lot selection for one product on a sales line (Estimate, Sales Order,
// Proforma, Sale Invoice, POS). Lists the product's sellable finished-goods
// lots — stock, expiry, warehouse and (for cost viewers) each lot's own
// production cost — and lets the operator take quantities from several lots.
// Every lot sells at the line's price (the party's Set Price); the lot only
// decides which stock is issued and what it cost. Each chosen lot becomes its
// own line. The server re-checks every lot when the document is saved.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Layers, Loader2, PackageOpen, Wand2 } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui/Modal";
import { lotPricingApi } from "@/lib/api";
import {
  allocationProfit, fifoSuggestion, formatINR, summarizeAllocations, toAllocation,
  LotAllocation, SaleLot,
} from "@/lib/lot-pricing";

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—";
const formatQty = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

export interface LotSelectorProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  /** "HQ" for Estimate / Sales Order / Proforma; otherwise the seller branch. */
  scope?: "HQ";
  franchiseId?: string | null;
  /** Quantity on the line when the selector opened (used by "Fill oldest first"). */
  quantity?: number;
  /** The line's selling price per unit excl. GST (the party's price) — the same for every lot. */
  price: number;
  /** Quantities already chosen per lot (when re-opening the selector). */
  initial?: Record<string, number>;
  showCost?: boolean;
  onApply: (allocations: LotAllocation[]) => void;
  /** POS: keep the standard (non-lot) line instead. */
  onUseStandard?: () => void;
  /** Lets a caller react to the loaded options (e.g. POS auto-selects a single lot). */
  onLoaded?: (lots: SaleLot[]) => void;
}

export default function LotSelector(props: LotSelectorProps) {
  const { open, onClose, productId, productName, scope, franchiseId, quantity, price, initial, showCost, onApply, onUseStandard } = props;
  const [lots, setLots] = useState<SaleLot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !productId) return;
    let cancelled = false;
    setLots(null);
    setError(null);
    lotPricingApi.saleLotOptions({ productId, ...(scope ? { scope } : { franchiseId: franchiseId || undefined }) })
      .then((res) => {
        if (cancelled) return;
        const list: SaleLot[] = res.data?.lots ?? [];
        setLots(list);
        props.onLoaded?.(list);
        // Re-opened: keep the current split. First open with exactly one
        // lot: prefill it (nothing to choose between). With several lots
        // nothing is pre-chosen — the operator picks (or fills oldest first).
        const selectable = list.filter((l) => l.selectable);
        const start: Record<string, number> = initial && Object.keys(initial).length
          ? initial
          : selectable.length === 1 && (quantity || 0) > 0
            ? { [selectable[0].id]: Math.min(quantity || 0, selectable[0].availableQty) }
            : {};
        setQty(Object.fromEntries(Object.entries(start).map(([k, v]) => [k, String(v)])));
      })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || "Could not load lots for this product."); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, scope, franchiseId]);

  const selectable = useMemo(() => (lots || []).filter((l) => l.selectable), [lots]);

  const allocations = useMemo(() => selectable
    .map((l) => toAllocation(l, Number(qty[l.id]) || 0, price))
    .filter((a) => a.quantity > 0), [selectable, qty, price]);
  const summary = useMemo(() => summarizeAllocations(allocations), [allocations]);
  const errors = selectable
    .filter((l) => (Number(qty[l.id]) || 0) > l.availableQty + 1e-9 || (Number(qty[l.id]) || 0) < 0)
    .map((l) => `Lot ${l.lotNumber}: only ${formatQty(l.availableQty)} available.`);
  const warnings = showCost ? allocations.map((a) => allocationProfit(a).warning).filter(Boolean) as string[] : [];

  const fill = () => {
    const s = fifoSuggestion(selectable, quantity || 0);
    setQty(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])));
  };

  const apply = () => {
    if (errors.length || !allocations.length) return;
    onApply(allocations);
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="xl"
      title={`SELECT LOTS · ${productName}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="flex gap-2">
            {selectable.length > 0 && (quantity || 0) > 0 && (
              <button type="button" onClick={fill} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10">
                <Wand2 size={13} /> Fill {formatQty(quantity || 0)} oldest first
              </button>
            )}
            {onUseStandard && (
              <button type="button" onClick={onUseStandard} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
                Bill without lot
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200">Cancel</button>
            <button
              type="button"
              onClick={apply}
              disabled={!allocations.length || errors.length > 0}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply {allocations.length > 1 ? `${allocations.length} lots` : "lot"}
            </button>
          </div>
        </div>
      }
    >
      {error ? (
        <p className="text-sm font-semibold text-rose-600">{error}</p>
      ) : !lots ? (
        <div className="flex items-center gap-2 py-8 justify-center text-xs font-semibold text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Loading lots…
        </div>
      ) : lots.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-xs text-slate-400">
          <PackageOpen size={22} />
          No sellable lots in stock for this product. Lots are created when packaging is confirmed.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Selling price <strong className="text-slate-800 dark:text-white">{price > 0 ? `${formatINR(price)} / unit` : "not set"}</strong> (excl. GST) for every lot — choose which lots the stock comes from.
          </p>
          <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left text-[11px] min-w-[760px]">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">
                <tr>
                  <th className="px-3 py-2.5">Lot</th>
                  <th className="px-3 py-2.5">Produced</th>
                  <th className="px-3 py-2.5">Expiry</th>
                  <th className="px-3 py-2.5">Warehouse</th>
                  <th className="px-3 py-2.5 text-right">Available</th>
                  {showCost && <th className="px-3 py-2.5 text-right">Cost / Unit</th>}
                  <th className="px-3 py-2.5 text-right w-28">Quantity</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  {showCost && <th className="px-3 py-2.5 text-right">Profit / Loss</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectable.map((lot) => {
                  const q = Number(qty[lot.id]) || 0;
                  const over = q > lot.availableQty + 1e-9;
                  const p = showCost && q > 0 ? allocationProfit(toAllocation(lot, q, price)) : null;
                  return (
                    <tr key={lot.id} className={clsx(q > 0 && "bg-orange-50/40 dark:bg-orange-500/5")}>
                      <td className="px-3 py-2">
                        <p className="font-mono font-semibold text-slate-800 dark:text-white">{lot.lotNumber}</p>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(lot.productionDate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDate(lot.expiryDate)}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{lot.warehouse?.name || lot.location}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{formatQty(lot.availableQty)} {lot.unit}</td>
                      {showCost && <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600 dark:text-slate-300">{formatINR(lot.unitCost ?? null)}</td>}
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={lot.availableQty}
                          step="any"
                          inputMode="decimal"
                          value={qty[lot.id] ?? ""}
                          onChange={(e) => setQty((prev) => ({ ...prev, [lot.id]: e.target.value }))}
                          aria-label={`Quantity from lot ${lot.lotNumber}`}
                          className={clsx(
                            "w-24 px-2 py-1.5 rounded-lg border text-right text-xs font-semibold bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30",
                            over ? "border-rose-400 text-rose-600" : "border-slate-200 dark:border-white/10 text-slate-800 dark:text-white",
                          )}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-white whitespace-nowrap">
                        {q > 0 && price > 0 ? formatINR(Math.round(price * q * 100) / 100) : "—"}
                      </td>
                      {showCost && (
                        <td className={clsx("px-3 py-2 text-right font-semibold whitespace-nowrap", p?.lineProfit == null ? "text-slate-400" : p.lineProfit < 0 ? "text-rose-600" : "text-emerald-600")}>
                          {p?.lineProfit == null ? "—" : `${p.lineProfit < 0 ? "−" : ""}${formatINR(Math.abs(p.lineProfit))}`}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(errors.length > 0 || warnings.length > 0) && (
            <div className="space-y-1">
              {errors.map((e) => (
                <p key={e} className="text-[11px] font-semibold text-rose-600 flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-px" />{e}</p>
              ))}
              {warnings.map((w) => (
                <p key={w} role="alert" className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-px" />{w}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <Stat label="Total Quantity" value={formatQty(summary.totalQuantity)} />
            <Stat label="Selling Value (excl. GST)" value={formatINR(summary.totalValue)} />
            <Stat label="Lots Chosen" value={String(allocations.length)} />
            {showCost ? (
              <Stat
                label="Est. Gross Profit"
                value={summary.profit == null ? "—" : `${summary.profit < 0 ? "−" : ""}${formatINR(Math.abs(summary.profit))}`}
                hint={summary.marginPct != null ? `${summary.marginPct}% margin · avg cost ${formatINR(summary.weightedAvgCost)}` : undefined}
                tone={summary.profit == null ? undefined : summary.profit < 0 ? "loss" : "profit"}
              />
            ) : (
              <Stat label="Price / Unit" value={formatINR(price)} hint="excl. GST" />
            )}
          </div>
          <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Layers size={12} /> Each lot is added as its own line at the same price. Prices exclude GST; discounts can still be applied per line.
          </p>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={clsx("text-sm font-bold", tone === "loss" ? "text-rose-600" : tone === "profit" ? "text-emerald-600" : "text-slate-800 dark:text-white")}>{value}</p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

/**
 * Row control under a line's item name: "Select lots" once a product is
 * chosen, or the line's lot tag (click to change). Nothing for free-text lines.
 */
export function LotLineControl({ productId, lotNumber, readOnly, onOpen }: { productId?: string | null; lotNumber?: string | null; readOnly?: boolean; onOpen: () => void }) {
  if (!productId) return null;
  if (lotNumber) return <LotChip lotNumber={lotNumber} onClick={readOnly ? undefined : onOpen} />;
  if (readOnly) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10"
    >
      <Layers size={10} /> Select lots
    </button>
  );
}

/** Compact lot tag shown under the item name on a lot line. */
export function LotChip({ lotNumber, onClick }: { lotNumber?: string | null; onClick?: () => void }) {
  if (!lotNumber) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? "Change lots" : undefined}
      className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-500/10 text-[10px] font-mono font-semibold text-orange-700 dark:text-orange-400 disabled:cursor-default"
    >
      <Layers size={10} /> Lot {lotNumber}
    </button>
  );
}
