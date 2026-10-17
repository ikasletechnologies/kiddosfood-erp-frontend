"use client";

// Production > Set Price — the Customer / Dealer / Franchise selling prices of
// each finished product SKU (pack size is part of the SKU, so APPAM 250g and
// APPAM 500g are priced separately).
//
// Prices are set once, after the product's first packaging. Later production
// runs add lots with their own production cost but reuse these prices — they
// are never reset or raised automatically. Sales Orders, Estimates, Invoices
// and POS pick the price for the party type. Prices are stored excl. GST and
// every change is audited.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Eye, History, Loader2, Pencil, RefreshCw, Search, SlidersHorizontal, Tags, X } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui/Modal";
import { franchiseApi, lotPricingApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatINR, priceCheck, PRICE_TIERS, PRODUCT_FULLY_PRICED, PRODUCT_PRICING_PENDING } from "@/lib/lot-pricing";
import FinishedGoodsLotsPanel from "@/components/modules/inventory/FinishedGoodsLotsPanel";

const INPUT = "w-full border border-gray-300 dark:border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-[#13151f] placeholder-gray-400 dark:placeholder:text-slate-500";
const LABEL = "block text-[11px] font-semibold text-gray-500 dark:text-slate-400 mb-1";

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const formatQty = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const apiError = (e: any, fallback: string) => e?.response?.data?.error || fallback;

type TierKey = "customerPrice" | "dealerPrice" | "franchisePrice";
type Tier = { key: TierKey; label: string; price: number | null; priceInclTax: number | null; unitProfit?: number | null; marginPct?: number | null; belowCost?: boolean };
type ProductRow = {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  packSize: string | null;
  location: string;
  taxPercent: number;
  customerPrice: number | null;
  dealerPrice: number | null;
  franchisePrice: number | null;
  tiers: Tier[];
  pricingStatus: string;
  missingTiers: string[];
  lotCount: number;
  availableQty: number;
  totalQty: number;
  warehouses: Array<{ id: string; name: string }>;
  latestLotNumber: string | null;
  latestProductionAt: string | null;
  legacyLotPrice: { price: number; lotNumber: string } | null;
  latestCost?: number | null;
  stockValue?: number | null;
};

type StatusTab = typeof PRODUCT_PRICING_PENDING | typeof PRODUCT_FULLY_PRICED | "ALL";
type Filters = { search: string; category: string; warehouseId: string; productId: string; location: string; inStock: boolean };
const EMPTY_FILTERS: Filters = { search: "", category: "", warehouseId: "", productId: "", location: "HQ", inStock: false };

export default function SetPriceClient() {
  const { showToast } = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [tab, setTab] = useState<StatusTab>(PRODUCT_PRICING_PENDING);
  const [showFilters, setShowFilters] = useState(false);
  const [data, setData] = useState<{ products: ProductRow[]; summary: any; categories: string[]; warehouses: Array<{ id: string; name: string }>; canEdit: boolean; showCost: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  // Status is filtered here (not on the server) so every tab count stays right.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lotPricingApi.listProducts({
        search: filters.search || undefined,
        category: filters.category || undefined,
        warehouseId: filters.warehouseId || undefined,
        productId: filters.productId || undefined,
        location: filters.location || undefined,
        inStock: filters.inStock || undefined,
      });
      setData(res.data);
    } catch (e) {
      showToast(apiError(e, "Failed to load products"), "error");
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    franchiseApi.getAll().then((r) => setBranches((r.data?.data || r.data || []).filter((f: any) => !f.isHQ))).catch(() => setBranches([]));
  }, []);

  const all = useMemo(() => data?.products || [], [data]);
  const rows = useMemo(() => (tab === "ALL" ? all : all.filter((p) => p.pricingStatus === tab)), [all, tab]);
  const counts: Record<StatusTab, number> = {
    [PRODUCT_PRICING_PENDING]: all.filter((p) => p.pricingStatus === PRODUCT_PRICING_PENDING).length,
    [PRODUCT_FULLY_PRICED]: all.filter((p) => p.pricingStatus === PRODUCT_FULLY_PRICED).length,
    ALL: all.length,
  } as Record<StatusTab, number>;
  const showCost = !!data?.showCost;
  const canEdit = !!data?.canEdit;
  const activeFilters = [filters.category, filters.warehouseId, filters.productId, filters.location !== "HQ" ? filters.location : "", filters.inStock ? "1" : ""].filter(Boolean).length;
  const cols = 7 + (showCost ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 w-full min-w-0">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 w-full min-w-0">
        {/* Title */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0"><Tags size={18} /></div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">Set Price</h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">Set Customer, Dealer and Franchise prices once per product. New production lots reuse them automatically.</p>
            </div>
          </div>
          <button onClick={load} title="Refresh" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50">
            <RefreshCw size={14} className={clsx(loading && "animate-spin")} /> Refresh
          </button>
        </div>

        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
          {/* Status tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 pt-3">
            <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
              {([
                [PRODUCT_PRICING_PENDING, "Awaiting prices"],
                [PRODUCT_FULLY_PRICED, "Priced"],
                ["ALL", "All products"],
              ] as Array<[StatusTab, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={clsx("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors", tab === id ? "bg-white dark:bg-[#13151f] text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-800 dark:hover:text-white")}
                >
                  {label}
                  <span className={clsx("min-w-[20px] px-1.5 rounded-full text-[10px] font-bold", id === PRODUCT_PRICING_PENDING && counts[id] > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" : "bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-slate-300")}>
                    {counts[id]}
                  </span>
                </button>
              ))}
            </div>
            {data?.summary && (
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                Stock ready to sell: <strong className="text-gray-800 dark:text-white">{formatQty(data.summary.availableQty)}</strong>
                {showCost && data.summary.stockValue != null && <> · Inventory value {formatINR(data.summary.stockValue)}</>}
              </p>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 border-b border-gray-100 dark:border-white/5">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className={clsx(INPUT, "pl-9 pr-8")} placeholder="Search product or SKU" value={filters.search} onChange={(e) => set("search", e.target.value)} />
              {filters.search && <X size={14} onClick={() => set("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer" />}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={clsx("inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border", showFilters || activeFilters ? "border-orange-300 text-orange-700 bg-orange-50 dark:bg-orange-500/10" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300")}
            >
              <SlidersHorizontal size={14} /> Filters{activeFilters ? ` (${activeFilters})` : ""}
            </button>
            {(activeFilters > 0 || filters.search) && (
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-semibold text-gray-500 hover:text-orange-600">Clear</button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 px-3 sm:px-4 py-3 bg-gray-50/60 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
              <div>
                <label className={LABEL}>Product</label>
                <select className={INPUT} value={filters.productId} onChange={(e) => set("productId", e.target.value)}>
                  <option value="">All</option>
                  {all.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Category</label>
                <select className={INPUT} value={filters.category} onChange={(e) => set("category", e.target.value)}>
                  <option value="">All</option>
                  {(data?.categories || []).map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Warehouse</label>
                <select className={INPUT} value={filters.warehouseId} onChange={(e) => set("warehouseId", e.target.value)}>
                  <option value="">All</option>
                  {(data?.warehouses || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              {canEdit && (
                <div>
                  <label className={LABEL}>Location</label>
                  <select className={INPUT} value={filters.location} onChange={(e) => set("location", e.target.value)}>
                    <option value="HQ">HQ</option>
                    <option value="ALL">All locations</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-gray-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={filters.inStock} onChange={(e) => set("inStock", e.target.checked)} className="rounded" />
                In stock only
              </label>
            </div>
          )}

          {/* Products */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                <tr>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5 text-right">Available</th>
                  {showCost && <th className="px-4 py-2.5 text-right">Latest cost / unit</th>}
                  {PRICE_TIERS.map((t) => <th key={t.key} className="px-4 py-2.5 text-right">{t.label} price</th>)}
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 w-[120px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {loading && !data ? (
                  <tr><td colSpan={cols} className="px-4 py-14 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Loading products…</td></tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={cols} className="px-4 py-14 text-center">
                      {tab === PRODUCT_PRICING_PENDING && all.length > 0 ? (
                        <p className="text-sm font-semibold text-emerald-600">Every product has all three prices. 🎉</p>
                      ) : (
                        <p className="text-gray-400">No products match. A product appears here after its first packaging is confirmed.</p>
                      )}
                    </td>
                  </tr>
                ) : rows.map((p) => {
                  const open = expanded === p.id;
                  const priced = p.pricingStatus === PRODUCT_FULLY_PRICED;
                  return (
                    <Fragment key={p.id}>
                      <tr className={clsx("hover:bg-gray-50/60 dark:hover:bg-white/[0.02] align-middle", open && "bg-orange-50/30 dark:bg-orange-500/5")}>
                        <td className="px-4 py-3 max-w-[280px]">
                          <div className="flex items-start gap-1.5">
                            <button type="button" onClick={() => setExpanded(open ? null : p.id)} title={open ? "Hide production lots" : "View production lots"} aria-expanded={open} className="mt-0.5 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/5">
                              <ChevronRight size={14} className={clsx("text-gray-400 transition-transform", open && "rotate-90 text-orange-500")} />
                            </button>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white truncate" title={p.name}>{p.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">
                                <span className="font-mono">{p.sku}</span>
                                {p.packSize ? ` · ${p.packSize}` : ""}
                                {p.location !== "HQ" ? ` · ${p.location}` : ""}
                                {` · ${p.lotCount} lot${p.lotCount === 1 ? "" : "s"}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="font-bold text-gray-900 dark:text-white">{formatQty(p.availableQty)}</span> <span className="text-gray-400">{p.unit}</span>
                        </td>
                        {showCost && <td className="px-4 py-3 text-right whitespace-nowrap text-gray-600 dark:text-slate-300">{formatINR(p.latestCost ?? null)}</td>}
                        {p.tiers.map((t) => (
                          <td key={t.key} className="px-4 py-3 text-right whitespace-nowrap">
                            {t.price != null ? (
                              <>
                                <p className={clsx("font-bold", t.belowCost ? "text-rose-600" : "text-gray-900 dark:text-white")}>
                                  {t.belowCost && <AlertTriangle size={11} className="inline mr-1 -mt-0.5" aria-label="Below latest production cost" />}
                                  {formatINR(t.price)}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {showCost && t.marginPct != null ? <span className={clsx((t.unitProfit ?? 0) < 0 ? "text-rose-600" : "text-emerald-600")}>{t.marginPct}% · </span> : null}
                                  {formatINR(t.priceInclTax)} incl.
                                </p>
                              </>
                            ) : (
                              <span className="text-[11px] font-semibold text-amber-600">Not set</span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          {priced ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10">PRICED</span>
                          ) : (
                            <div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-amber-700 bg-amber-50 dark:bg-amber-500/10">AWAITING</span>
                              {p.legacyLotPrice && <p className="text-[10px] text-gray-400 mt-1">Old lot price {formatINR(p.legacyLotPrice.price)}</p>}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {canEdit && (
                              <button
                                onClick={() => setEditing(p)}
                                className={clsx("inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold", priced ? "text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200" : "text-white bg-orange-500 hover:bg-orange-600")}
                              >
                                {priced ? <><Pencil size={12} /> Edit</> : "Set price"}
                              </button>
                            )}
                            <button onClick={() => setViewing(p.id)} title="Product details & price history" className="p-1.5 rounded-lg text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-white/5"><Eye size={14} /></button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={cols} className="p-0">
                            <FinishedGoodsLotsPanel sku={p.sku} unit={p.unit} prices={p} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <SetPricesModal
          product={editing}
          showCost={showCost}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
      {viewing && <ViewProductModal id={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function SetPricesModal({ product, showCost, onClose, onSaved }: { product: ProductRow; showCost: boolean; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast();
  const editing = PRICE_TIERS.some((t) => product[t.key] != null);
  const [values, setValues] = useState<Record<TierKey, string>>({
    customerPrice: product.customerPrice != null ? String(product.customerPrice) : "",
    dealerPrice: product.dealerPrice != null ? String(product.dealerPrice) : "",
    franchisePrice: product.franchisePrice != null ? String(product.franchisePrice) : "",
  });
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [reason, setReason] = useState("");
  const [ackBelowCost, setAckBelowCost] = useState(false);
  const [saving, setSaving] = useState(false);

  const cost = showCost ? product.latestCost ?? null : null;
  const checks = PRICE_TIERS.map((t) => {
    const raw = values[t.key].trim();
    const n = Number(raw);
    const valid = raw !== "" && Number.isFinite(n) && n > 0;
    return { ...t, raw, n, valid, invalid: raw !== "" && !valid, check: valid ? priceCheck(n, taxInclusive, product.taxPercent, cost) : null };
  });
  const filled = checks.filter((c) => c.valid);
  const invalid = checks.some((c) => c.invalid);
  const below = checks.filter((c) => c.check?.belowCost);
  const willBeComplete = filled.length === PRICE_TIERS.length;
  const unchanged = !taxInclusive && checks.every((c) => {
    const cur = product[c.key];
    return c.valid ? cur != null && Math.abs(cur - c.n) < 0.001 : cur == null;
  });

  // Converting excl./incl. keeps the same figures typed — say which basis applies.
  const save = async () => {
    if (invalid || !filled.length || unchanged) return;
    if (below.length && !ackBelowCost) return;
    setSaving(true);
    try {
      await lotPricingApi.setProductPrices(product.id, {
        customerPrice: checks[0].valid ? Math.round(checks[0].n * 100) / 100 : null,
        dealerPrice: checks[1].valid ? Math.round(checks[1].n * 100) / 100 : null,
        franchisePrice: checks[2].valid ? Math.round(checks[2].n * 100) / 100 : null,
        taxInclusive,
        reason: reason.trim() || undefined,
        acknowledgeBelowCost: ackBelowCost || undefined,
        expected: { customerPrice: product.customerPrice, dealerPrice: product.dealerPrice, franchisePrice: product.franchisePrice },
      });
      showToast(`${product.name}: prices saved${willBeComplete ? "" : " (still awaiting the remaining price)"}`, "success");
      onSaved();
    } catch (e: any) {
      if (e?.response?.data?.code === "BELOW_COST_CONFIRMATION_REQUIRED") setAckBelowCost(false);
      showToast(apiError(e, "Failed to save prices"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={editing ? "Edit prices" : "Set prices"}
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <p className="text-[11px] text-gray-400">{willBeComplete ? "All three prices set — product will be Priced." : "Leave a price blank if it isn't decided yet."}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200">Cancel</button>
            <button
              type="button"
              onClick={save}
              disabled={saving || invalid || !filled.length || unchanged || (below.length > 0 && !ackBelowCost)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 size={13} className="animate-spin" />} Save prices
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Detail label="Product" value={product.name} wide />
          <Detail label="SKU" value={product.sku} mono />
          <Detail label="Pack size" value={product.packSize || "—"} />
          <Detail label="In stock" value={`${formatQty(product.availableQty)} ${product.unit}`} />
          {showCost && <Detail label="Latest production cost" value={formatINR(cost)} hint={product.latestLotNumber ? `lot ${product.latestLotNumber}` : undefined} />}
          <Detail label="GST" value={`${product.taxPercent}%`} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-slate-300">Prices per {product.unit.toLowerCase()}</p>
          <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
            {[false, true].map((incl) => (
              <button
                key={String(incl)}
                type="button"
                onClick={() => setTaxInclusive(incl)}
                className={clsx("px-3 py-1 rounded-lg text-[11px] font-semibold", taxInclusive === incl ? "bg-white dark:bg-[#13151f] text-gray-900 dark:text-white shadow-sm" : "text-gray-500")}
              >
                {incl ? "Including GST" : "Excluding GST"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {checks.map((c) => (
            <div key={c.key} className={clsx("rounded-xl border p-3", c.check?.belowCost ? "border-rose-300 bg-rose-50/40 dark:bg-rose-500/5" : "border-gray-200 dark:border-white/10")}>
              <label className={LABEL} htmlFor={`price-${c.key}`}>{c.label} price</label>
              <div className="flex items-center rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#13151f] focus-within:border-orange-400">
                <span className="pl-2.5 text-sm text-gray-400">₹</span>
                <input
                  id={`price-${c.key}`}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={values[c.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [c.key]: e.target.value }))}
                  placeholder="Not set"
                  className="w-full px-2 py-2 text-sm font-semibold bg-transparent outline-none text-gray-900 dark:text-white"
                />
              </div>
              <div className="mt-1.5 min-h-[30px] text-[10px] leading-snug text-gray-500">
                {c.invalid ? (
                  <span className="font-semibold text-rose-600">Enter a price above ₹0</span>
                ) : c.check ? (
                  <>
                    <p>{taxInclusive ? `${formatINR(c.check.priceExclTax)} excl. GST` : `${formatINR(c.check.priceInclTax)} incl. GST`}</p>
                    {c.check.unitProfit != null && (
                      <p className={clsx("font-semibold", c.check.belowCost ? "text-rose-600" : "text-emerald-600")}>
                        {c.check.belowCost ? `Loss ${formatINR(Math.abs(c.check.unitProfit))}` : `Profit ${formatINR(c.check.unitProfit)}`} · {c.check.marginPct}%
                      </p>
                    )}
                  </>
                ) : product[c.key] == null ? (
                  <span className="text-amber-600">Required for Priced status</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {product.legacyLotPrice && !editing && (
          <p className="text-[11px] text-gray-500">
            Earlier lot price (old per-lot pricing): <strong>{formatINR(product.legacyLotPrice.price)}</strong> excl. GST on lot {product.legacyLotPrice.lotNumber}. Shown for reference only.
          </p>
        )}

        {below.length > 0 && (
          <label className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-300 cursor-pointer">
            <input type="checkbox" checked={ackBelowCost} onChange={(e) => setAckBelowCost(e.target.checked)} className="mt-0.5 rounded" />
            <span>
              <strong>{below.map((b) => b.label).join(", ")}</strong> {below.length > 1 ? "prices are" : "price is"} below the latest production cost ({formatINR(cost)}). Sales at this price make a loss. Tick to save anyway.
            </span>
          </label>
        )}

        {editing && (
          <div>
            <label className={LABEL} htmlFor="price-reason">Reason for change (optional)</label>
            <input id="price-reason" className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Revised distributor rates" maxLength={500} />
          </div>
        )}
        <p className="text-[10px] text-gray-400">
          Prices are stored excluding GST and apply to every lot of this product, now and in future production. Existing invoices and orders keep their prices.
        </p>
      </div>
    </Modal>
  );
}

function ViewProductModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { showToast } = useToast();
  const [p, setP] = useState<(ProductRow & { history: any[] }) | null>(null);
  useEffect(() => {
    lotPricingApi.getProduct(id).then((r) => setP(r.data)).catch((e) => { showToast(apiError(e, "Failed to load product"), "error"); onClose(); });
  }, [id, onClose, showToast]);

  return (
    <Modal isOpen onClose={onClose} size="xl" title={p ? p.name : "Product"}>
      {!p ? (
        <div className="py-10 text-center text-xs text-gray-400"><Loader2 className="inline animate-spin mr-2" size={14} />Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Detail label="SKU" value={p.sku} mono />
            <Detail label="Pack size" value={p.packSize || "—"} />
            <Detail label="Available" value={`${formatQty(p.availableQty)} ${p.unit}`} hint={`${formatQty(p.totalQty)} on hand · ${p.lotCount} lots`} />
            <Detail label="Status" value={p.pricingStatus === PRODUCT_FULLY_PRICED ? "Priced" : `Awaiting ${p.missingTiers.join(", ")}`} />
            {p.latestCost !== undefined && <Detail label="Latest production cost" value={formatINR(p.latestCost ?? null)} hint={p.latestLotNumber ? `lot ${p.latestLotNumber}` : undefined} />}
            {p.stockValue !== undefined && <Detail label="Inventory value" value={formatINR(p.stockValue ?? null)} hint="at production cost" />}
            <Detail label="GST" value={`${p.taxPercent}%`} />
            <Detail label="Last produced" value={formatDate(p.latestProductionAt)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {p.tiers.map((t) => (
              <div key={t.key} className="rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t.label} price</p>
                <p className={clsx("text-base font-bold", t.price == null ? "text-amber-600" : t.belowCost ? "text-rose-600" : "text-gray-900 dark:text-white")}>{t.price != null ? formatINR(t.price) : "Not set"}</p>
                {t.price != null && (
                  <p className="text-[10px] text-gray-400">
                    {formatINR(t.priceInclTax)} incl. GST{t.marginPct != null ? ` · ${t.marginPct}% margin` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5"><History size={12} /> Price history</p>
            {p.history.length === 0 ? (
              <p className="text-xs text-gray-400">No price changes yet.</p>
            ) : (
              <div className="overflow-x-auto custom-scrollbar rounded-xl border border-gray-200 dark:border-white/10">
                <table className="w-full text-left text-[11px] min-w-[620px]">
                  <thead className="bg-gray-50 dark:bg-white/[0.03] text-gray-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2">When</th>
                      {PRICE_TIERS.map((t) => <th key={t.key} className="px-3 py-2 text-right">{t.label}</th>)}
                      <th className="px-3 py-2">By / reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {p.history.map((h) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(h.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                        {PRICE_TIERS.map((t) => {
                          const before = h.previous?.[t.key];
                          const after = h.prices?.[t.key];
                          const changed = (before ?? null) !== (after ?? null);
                          return (
                            <td key={t.key} className="px-3 py-2 text-right whitespace-nowrap">
                              {changed && before != null && <span className="text-gray-400 line-through mr-1">{formatINR(before)}</span>}
                              <span className={clsx(changed ? "font-bold text-gray-900 dark:text-white" : "text-gray-500")}>{after != null ? formatINR(after) : "—"}</span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          <p className="text-gray-700 dark:text-slate-200">{h.by || "—"}</p>
                          <p className="text-[10px] text-gray-400">
                            {h.enteredTaxInclusive ? "Entered incl. GST" : "Entered excl. GST"}
                            {h.belowCost?.length ? ` · below cost: ${h.belowCost.join(", ")}` : ""}
                            {h.reason ? ` · ${h.reason}` : ""}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="-mx-6 -mb-6">
            <FinishedGoodsLotsPanel sku={p.sku} unit={p.unit} prices={p} includeEmpty />
          </div>
        </div>
      )}
    </Modal>
  );
}

function Detail({ label, value, hint, mono, wide }: { label: string; value: string; hint?: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={clsx("min-w-0", wide && "col-span-2")}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={clsx("font-semibold text-gray-800 dark:text-slate-100 truncate", mono && "font-mono")} title={value}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}
