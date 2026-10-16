"use client";

// Production > Set Price — selling price per finished-goods lot.
//
// Every confirmed packaging run is its own lot with its own production cost
// (from the packaging cost snapshot, read-only here). This screen gives each
// lot its own selling price; older lots keep theirs when the same SKU is
// produced again. Price changes are audited server-side and never alter
// finalized invoices.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Eye, History, Layers, Loader2, Package, Pencil, RefreshCw, Search, Tags } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui/Modal";
import { franchiseApi, lotPricingApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatINR, priceCheck, LOT_PRICED, LOT_PRICING_PENDING, SaleLot } from "@/lib/lot-pricing";

const INPUT = "w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder:text-slate-500";
const LABEL = "block text-[11px] font-semibold text-gray-500 dark:text-slate-400 mb-1";

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const formatQty = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const apiError = (e: any, fallback: string) => e?.response?.data?.error || fallback;

type Filters = { search: string; category: string; status: string; warehouseId: string; from: string; to: string; location: string; includeEmpty: boolean };
const EMPTY_FILTERS: Filters = { search: "", category: "", status: "", warehouseId: "", from: "", to: "", location: "HQ", includeEmpty: false };

export default function SetPriceClient() {
  const { showToast } = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [data, setData] = useState<{ lots: SaleLot[]; summary: any; categories: string[]; canEdit: boolean; showCost: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; isHQ?: boolean }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [pricing, setPricing] = useState<SaleLot | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lotPricingApi.listLots({
        search: filters.search || undefined,
        category: filters.category || undefined,
        status: filters.status || undefined,
        warehouseId: filters.warehouseId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        location: filters.location || undefined,
        includeEmpty: filters.includeEmpty || undefined,
      });
      setData(res.data);
      // Warehouse options come from the lots themselves (only real holders).
      if (!filters.warehouseId) {
        const seen = new Map<string, string>();
        (res.data?.lots || []).forEach((l: SaleLot) => { if (l.warehouse) seen.set(l.warehouse.id, l.warehouse.name); });
        setWarehouses(Array.from(seen.entries()).map(([id, name]) => ({ id, name })));
      }
    } catch (e) {
      showToast(apiError(e, "Failed to load finished-goods lots"), "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    franchiseApi.getAll().then((r) => setBranches((r.data?.data || r.data || []).filter((f: any) => !f.isHQ))).catch(() => setBranches([]));
  }, []);

  const lots = data?.lots || [];
  const summary = data?.summary;
  const showCost = !!data?.showCost;
  const canEdit = !!data?.canEdit;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 w-full min-w-0">
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0"><Tags size={20} /></div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">Set Price</h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">Selling price for each finished-goods production lot</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 self-start sm:self-auto">
          <RefreshCw size={14} className={clsx(loading && "animate-spin")} /> Refresh
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 w-full min-w-0">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard icon={<Layers size={16} />} label="Finished Goods Lots" value={summary ? String(summary.totalLots) : "—"} />
          <SummaryCard icon={<Clock size={16} />} label="Awaiting Pricing" value={summary ? String(summary.awaitingPricing) : "—"} tone={summary?.awaitingPricing ? "warn" : undefined} onClick={() => set("status", filters.status === LOT_PRICING_PENDING ? "" : LOT_PRICING_PENDING)} active={filters.status === LOT_PRICING_PENDING} />
          <SummaryCard icon={<CheckCircle2 size={16} />} label="Priced Lots" value={summary ? String(summary.pricedLots) : "—"} onClick={() => set("status", filters.status === LOT_PRICED ? "" : LOT_PRICED)} active={filters.status === LOT_PRICED} />
          <SummaryCard icon={<Package size={16} />} label="Available Priced Stock" value={summary ? `${formatQty(summary.availablePricedQty)} pkts` : "—"} hint={summary ? `${formatINR(summary.availablePricedValue)} excl. GST` : undefined} />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-3 sm:p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
          <div className="col-span-2">
            <label className={LABEL}>Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className={clsx(INPUT, "pl-8")} placeholder="Product, SKU or lot" value={filters.search} onChange={(e) => set("search", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Category</label>
            <select className={INPUT} value={filters.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">All</option>
              {(data?.categories || []).map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Produced from</label>
            <input type="date" className={INPUT} value={filters.from} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Produced to</label>
            <input type="date" className={INPUT} value={filters.to} onChange={(e) => set("to", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Pricing status</label>
            <select className={INPUT} value={filters.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">All</option>
              <option value={LOT_PRICING_PENDING}>Awaiting pricing</option>
              <option value={LOT_PRICED}>Priced</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Warehouse</label>
            <select className={INPUT} value={filters.warehouseId} onChange={(e) => set("warehouseId", e.target.value)}>
              <option value="">All</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {canEdit ? (
            <div>
              <label className={LABEL}>Location</label>
              <select className={INPUT} value={filters.location} onChange={(e) => set("location", e.target.value)}>
                <option value="HQ">HQ</option>
                <option value="ALL">All locations</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          ) : <div />}
          <label className="col-span-2 md:col-span-4 lg:col-span-8 flex items-center gap-2 text-[11px] font-semibold text-gray-500 cursor-pointer">
            <input type="checkbox" checked={filters.includeEmpty} onChange={(e) => set("includeEmpty", e.target.checked)} className="rounded" />
            Include sold-out lots
            {(filters !== EMPTY_FILTERS) && (
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="ml-auto text-orange-600 hover:underline">Clear filters</button>
            )}
          </label>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs min-w-[980px]">
              <thead className="bg-gray-50/70 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Production Lot</th>
                  <th className="px-4 py-3">Produced</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  {showCost && <th className="px-4 py-3 text-right">Cost / Packet</th>}
                  <th className="px-4 py-3 text-right">Selling / Packet</th>
                  {showCost && <th className="px-4 py-3 text-right">Est. Profit / Loss</th>}
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {loading && !data ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Loading lots…</td></tr>
                ) : lots.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No finished-goods lots match these filters. Lots are created when packaging is confirmed.</td></tr>
                ) : lots.map((lot) => {
                  const priced = lot.pricingStatus === LOT_PRICED;
                  return (
                    <tr key={lot.id} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 dark:text-white uppercase">{lot.productName}</p>
                        <p className="text-[10px] font-mono text-gray-400">{lot.sku}{lot.packSize ? ` · ${lot.packSize}` : ""}{lot.location !== "HQ" ? ` · ${lot.location}` : ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-gray-800 dark:text-slate-200">{lot.lotNumber}</p>
                        {lot.warehouse && <p className="text-[10px] text-gray-400">{lot.warehouse.name}</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-slate-300">{formatDate(lot.productionDate)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p className="font-bold text-gray-900 dark:text-white">{formatQty(lot.availableQty)} {lot.unit}</p>
                        {lot.reservedQty > 0 && <p className="text-[10px] text-purple-600">{formatQty(lot.reservedQty)} reserved</p>}
                      </td>
                      {showCost && <td className="px-4 py-3 text-right whitespace-nowrap text-gray-700 dark:text-slate-300">{formatINR(lot.unitCost ?? null)}</td>}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {priced ? (
                          <>
                            <p className="font-bold text-gray-900 dark:text-white">{formatINR(lot.sellingPrice)}</p>
                            <p className="text-[10px] text-gray-400">{lot.priceTaxInclusive ? "incl. GST" : "excl. GST"}</p>
                          </>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      {showCost && (
                        <td className={clsx("px-4 py-3 text-right whitespace-nowrap font-semibold", lot.unitProfit == null ? "text-gray-400" : lot.unitProfit < 0 ? "text-rose-600" : "text-emerald-600")}>
                          {lot.unitProfit == null ? "—" : (
                            <>
                              {lot.unitProfit < 0 ? "−" : "+"}{formatINR(Math.abs(lot.unitProfit))}
                              {lot.marginPct != null && <span className="block text-[10px] font-normal">{lot.marginPct}% margin</span>}
                            </>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", priced ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10" : "text-amber-700 bg-amber-50 dark:bg-amber-500/10")}>
                          {priced ? "PRICED" : "AWAITING PRICE"}
                        </span>
                        {lot.belowCost && <AlertTriangle size={12} className="inline ml-1 text-rose-500" aria-label="Below production cost" />}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1.5">
                          {canEdit && (
                            <button onClick={() => setPricing(lot)} className={clsx("inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold", priced ? "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:bg-gray-200" : "bg-orange-500 text-white hover:bg-orange-600")}>
                              {priced ? <><Pencil size={12} /> Edit Price</> : <><Tags size={12} /> Set Price</>}
                            </button>
                          )}
                          <button onClick={() => setViewing(lot.id)} title="View lot" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:bg-gray-200">
                            <Eye size={12} /> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {pricing && (
        <SetPriceModal
          lot={pricing}
          showCost={showCost}
          onClose={() => setPricing(null)}
          onSaved={() => { setPricing(null); load(); }}
        />
      )}
      {viewing && <ViewLotModal lotId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function SummaryCard({ icon, label, value, hint, tone, onClick, active }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: "warn"; onClick?: () => void; active?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={clsx(
        "text-left bg-white dark:bg-card rounded-xl border p-3 sm:p-4 flex items-start gap-3 transition-colors",
        active ? "border-orange-400 ring-2 ring-orange-500/20" : "border-gray-200 dark:border-white/5",
        onClick && "hover:border-orange-300",
      )}
    >
      <div className={clsx("p-2 rounded-lg shrink-0", tone === "warn" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10" : "bg-orange-50 text-[#f58220] dark:bg-orange-500/10")}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
        {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
      </div>
    </Tag>
  );
}

function SetPriceModal({ lot, showCost, onClose, onSaved }: { lot: SaleLot; showCost: boolean; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const editing = lot.pricingStatus === LOT_PRICED;
  const [price, setPrice] = useState(editing ? String(lot.sellingPrice) : (lot.masterPrice ? String(lot.masterPrice) : ""));
  const [taxInclusive, setTaxInclusive] = useState(editing ? lot.priceTaxInclusive : false);
  const [reason, setReason] = useState("");
  const [ackBelowCost, setAckBelowCost] = useState(false);
  const [saving, setSaving] = useState(false);

  const value = Number(price);
  const valid = Number.isFinite(value) && value > 0;
  const check = useMemo(() => valid ? priceCheck(value, taxInclusive, lot.taxPercent, lot.unitCost) : null, [valid, value, taxInclusive, lot.taxPercent, lot.unitCost]);
  const unchanged = editing && valid && Math.abs(value - (lot.sellingPrice || 0)) < 0.001 && taxInclusive === lot.priceTaxInclusive;

  const save = async () => {
    if (!valid || unchanged) return;
    if (check?.belowCost && !ackBelowCost) return;
    setSaving(true);
    try {
      await lotPricingApi.setPrice(lot.id, {
        sellingPrice: Math.round(value * 100) / 100,
        taxInclusive,
        reason: reason.trim() || undefined,
        acknowledgeBelowCost: ackBelowCost || undefined,
        expectedPrice: editing ? lot.sellingPrice : null,
      });
      showToast(`Lot ${lot.lotNumber} priced at ${formatINR(value)}`, "success");
      onSaved();
    } catch (e: any) {
      showToast(apiError(e, "Failed to save price"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="2xl"
      title={editing ? "EDIT LOT PRICE" : "SET LOT PRICE"}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300">Cancel</button>
          <button
            onClick={save}
            disabled={!valid || unchanged || saving || (!!check?.belowCost && !ackBelowCost)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={13} className="animate-spin" />} Save Price
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <Detail label="Product" value={lot.productName} wide />
          <Detail label="SKU" value={lot.sku} mono />
          <Detail label="Production Lot" value={lot.lotNumber} mono />
          <Detail label="Production Date" value={formatDate(lot.productionDate)} />
          <Detail label="Pack Size" value={lot.packSize || "—"} />
          <Detail label="Available" value={`${formatQty(lot.availableQty)} ${lot.unit}`} />
          {showCost && <Detail label="Production Cost / Packet" value={formatINR(lot.unitCost ?? null)} hint="From packaging cost (read-only)" />}
          <Detail label="GST" value={`${lot.taxPercent}%`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Selling Price / Packet (₹)</label>
            <input type="number" min={0} step="0.01" inputMode="decimal" autoFocus className={INPUT} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            {!editing && lot.masterPrice ? <p className="text-[10px] text-gray-400 mt-1">Pre-filled from Product Master price {formatINR(lot.masterPrice)}</p> : null}
          </div>
          <div>
            <label className={LABEL}>Price entered</label>
            <div className="flex rounded-xl border border-gray-300 dark:border-white/10 overflow-hidden text-xs font-semibold">
              {[false, true].map((incl) => (
                <button key={String(incl)} type="button" onClick={() => setTaxInclusive(incl)} className={clsx("flex-1 py-2", taxInclusive === incl ? "bg-orange-500 text-white" : "bg-white dark:bg-[#13151f] text-gray-600 dark:text-slate-300")}>
                  {incl ? "Including GST" : "Excluding GST"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {check && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Detail label="Price excl. GST" value={formatINR(check.priceExclTax)} />
            <Detail label="Price incl. GST" value={formatINR(check.priceInclTax)} />
            {showCost && <Detail label="Est. Profit / Packet" value={check.unitProfit == null ? "—" : `${check.unitProfit < 0 ? "−" : "+"}${formatINR(Math.abs(check.unitProfit))}`} tone={check.unitProfit == null ? undefined : check.unitProfit < 0 ? "loss" : "profit"} />}
            {showCost && <Detail label="Est. Margin" value={check.marginPct == null ? "—" : `${check.marginPct}%`} tone={check.marginPct == null ? undefined : check.marginPct < 0 ? "loss" : "profit"} />}
          </div>
        )}

        {check?.warning && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 p-3 space-y-2" role="alert">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-start gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-px" />{check.warning}</p>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-rose-700 dark:text-rose-400 cursor-pointer">
              <input type="checkbox" checked={ackBelowCost} onChange={(e) => setAckBelowCost(e.target.checked)} className="rounded" />
              I confirm this lot should be sold below its production cost.
            </label>
          </div>
        )}

        {editing && (
          <div>
            <label className={LABEL}>Reason for change (optional, kept in price history)</label>
            <input className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. festival pricing" />
          </div>
        )}
        <p className="text-[10px] text-gray-400">The new price applies to new sales from this lot only. Saved invoices keep the price they were billed at; other lots of this product keep their own prices.</p>
      </div>
    </Modal>
  );
}

function ViewLotModal({ lotId, onClose }: { lotId: string; onClose: () => void }) {
  const [lot, setLot] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    lotPricingApi.getLot(lotId).then((r) => setLot(r.data)).catch((e) => setError(apiError(e, "Failed to load lot")));
  }, [lotId]);

  return (
    <Modal isOpen onClose={onClose} size="lg" title={lot ? `LOT ${lot.lotNumber}` : "LOT DETAILS"}>
      {error ? <p className="text-sm text-rose-600">{error}</p> : !lot ? (
        <div className="py-8 text-center text-xs text-gray-400"><Loader2 size={16} className="inline animate-spin mr-2" />Loading…</div>
      ) : (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Detail label="Product" value={lot.productName} wide />
            <Detail label="SKU" value={lot.sku} mono />
            <Detail label="Production Batch" value={lot.productionBatchCode || "—"} mono />
            <Detail label="Pack Size" value={lot.packSize || "—"} />
            <Detail label="Produced" value={`${formatQty(lot.producedQty)} ${lot.unit}`} />
            <Detail label="Available" value={`${formatQty(lot.availableQty)} ${lot.unit}`} />
            <Detail label="Reserved" value={`${formatQty(lot.reservedQty)} ${lot.unit}`} />
            <Detail label="Production Date" value={formatDate(lot.productionDate)} />
            <Detail label="Packaging Date" value={formatDate(lot.packagingDate)} />
            <Detail label="Expiry" value={formatDate(lot.expiryDate)} />
            <Detail label="Warehouse" value={lot.warehouse?.name || lot.location} />
            <Detail label="Stock Status" value={String(lot.stockStatus || "").replace(/_/g, " ")} />
            {lot.unitCost !== undefined && <Detail label="Production Cost / Packet" value={formatINR(lot.unitCost)} />}
            <Detail label="Selling Price" value={lot.sellingPrice ? `${formatINR(lot.sellingPrice)} ${lot.priceTaxInclusive ? "incl." : "excl."} GST` : "Awaiting price"} />
            {lot.unitProfit !== undefined && <Detail label="Est. Profit / Packet" value={lot.unitProfit == null ? "—" : `${lot.unitProfit < 0 ? "−" : "+"}${formatINR(Math.abs(lot.unitProfit))}`} tone={lot.unitProfit == null ? undefined : lot.unitProfit < 0 ? "loss" : "profit"} />}
            {lot.pricedAt && <Detail label="Last Priced" value={`${formatDate(lot.pricedAt)}${lot.pricedByName ? ` · ${lot.pricedByName}` : ""}`} />}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5"><History size={13} /> Price history</p>
            {lot.history.length === 0 ? <p className="text-gray-400">No price set yet.</p> : (
              <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-x-auto">
                <table className="w-full text-left min-w-[520px]">
                  <thead className="bg-gray-50 dark:bg-white/[0.02] text-[10px] uppercase tracking-wider text-gray-500">
                    <tr><th className="px-3 py-2">When</th><th className="px-3 py-2 text-right">From</th><th className="px-3 py-2 text-right">To</th><th className="px-3 py-2">By</th><th className="px-3 py-2">Reason</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {lot.history.map((h: any) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(h.effectiveAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                        <td className="px-3 py-2 text-right">{h.previousPrice != null ? formatINR(h.previousPrice) : "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatINR(h.newPrice)} <span className="text-[10px] font-normal text-gray-400">{h.taxInclusive ? "incl." : "excl."}</span>
                          {h.belowCost && <AlertTriangle size={11} className="inline ml-1 text-rose-500" aria-label="Below cost" />}
                        </td>
                        <td className="px-3 py-2">{h.changedBy || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{h.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Detail({ label, value, hint, mono, wide, tone }: { label: string; value: string; hint?: string; mono?: boolean; wide?: boolean; tone?: "profit" | "loss" }) {
  return (
    <div className={clsx("rounded-lg bg-gray-50 dark:bg-white/[0.03] px-3 py-2 min-w-0", wide && "col-span-2")}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={clsx("font-semibold truncate", mono && "font-mono", tone === "loss" ? "text-rose-600" : tone === "profit" ? "text-emerald-600" : "text-gray-800 dark:text-slate-100")}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}
