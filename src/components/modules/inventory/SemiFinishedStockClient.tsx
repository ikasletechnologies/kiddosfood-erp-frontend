"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Eye, Layers, Loader2, RefreshCw, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { semiFinishedApi, SemiFinishedInventory, SemiFinishedLot } from "@/lib/api/semi-finished.api";
import { formatINR } from "@/lib/lot-pricing";

const qty = (value: number) => Number(value).toLocaleString("en-IN", { maximumFractionDigits: 4 });
const totals = (values?: Record<string, number>) => Object.entries(values || {}).map(([unit, value]) => `${qty(value)} ${unit}`).join(" · ") || "—";
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-IN") : "—";
const control = "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-orange-400 dark:border-white/10 dark:bg-card dark:text-slate-200";

export default function SemiFinishedStockClient() {
  const [filters, setFilters] = useState({ search: "", warehouseId: "", sourceType: "", expiryStatus: "" });
  const [data, setData] = useState<SemiFinishedInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [viewing, setViewing] = useState<{ row: SemiFinishedLot; source: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try { const response = await semiFinishedApi.list(filters); if (!cancelled) setData(response.data); }
      catch (e: any) { if (!cancelled) setError(e?.response?.data?.error || "Could not load semi-finished goods. Please retry."); }
      finally { if (!cancelled) setLoading(false); }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filters, revision]);
  const summary = data?.summary;
  const cards = [
    ["Total Semi-Finished Product Families", summary?.productFamilies ?? 0],
    ["Available Unpacked Quantity", totals(summary?.availableByUnit)],
    ["Active Bulk Lots", summary?.activeLots ?? 0],
    ["Manufactured Bulk Stock", totals(summary?.manufacturedByUnit)],
    ["Purchased Bulk Stock", totals(summary?.purchasedByUnit)],
    ["Expiring Soon Lots", summary?.expiringSoonLots ?? 0],
  ];
  const update = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const selected = viewing?.row;
  return (
    <section className="space-y-5 min-w-0" aria-label="Semi-Finished Goods inventory">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Layers size={19} className="text-orange-500" />Semi-Finished Goods</h2><p className="mt-1 text-xs text-slate-500">Live unpacked bulk lots from manufacturing and purchases. Packaging uses this same stock.</p></div>
        <button onClick={() => setRevision(r => r + 1)} className={control} disabled={loading}><RefreshCw size={13} className="mr-2 inline" />Refresh</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-card"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-lg font-bold text-slate-900 dark:text-white break-words">{loading && !data ? "—" : value}</p></div>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="relative flex-1 min-w-[200px]"><Search size={14} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Search semi-finished goods" className={`${control} w-full pl-9`} placeholder="Search product, family, bulk lot or supplier" value={filters.search} onChange={e => update("search", e.target.value)} /></label>
        <select aria-label="Warehouse" className={control} value={filters.warehouseId} onChange={e => update("warehouseId", e.target.value)}><option value="">All warehouses</option>{data?.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <select aria-label="Source type" className={control} value={filters.sourceType} onChange={e => update("sourceType", e.target.value)}><option value="">All sources</option><option value="MANUFACTURED">Manufactured</option><option value="PURCHASE">Purchased Bulk</option></select>
        <select aria-label="Expiry status" className={control} value={filters.expiryStatus} onChange={e => update("expiryStatus", e.target.value)}><option value="">All expiry statuses</option><option value="VALID">Valid</option><option value="EXPIRING_SOON">Expiring soon</option><option value="EXPIRED">Expired</option></select>
      </div>
      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><AlertTriangle size={16} className="mr-2 inline" />{error}<button onClick={() => setRevision(r => r + 1)} className="ml-3 font-bold underline">Retry</button></div> : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-card">
          <table className="w-full min-w-[1600px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-white/5"><tr>{["Product name", "Product family / ID", "Bulk lot number", "Source type", "Warehouse", "Original bulk qty", "Already packaged", "Remaining unpacked", "Unit", ...(data?.showCost ? ["Cost per unit", "Remaining value"] : []), "Production / receipt date", "Expiry date", "Status", "Action"].map(label => <th key={label} className="px-4 py-3 whitespace-nowrap">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? <tr><td colSpan={data?.showCost ? 15 : 13} className="p-12 text-center text-slate-500"><Loader2 size={16} className="mr-2 inline animate-spin" />Loading bulk inventory…</td></tr> : !data?.rows.length ? <tr><td colSpan={data?.showCost ? 15 : 13} className="p-12 text-center text-slate-500">No unpacked bulk lots match your filters.</td></tr> : data.rows.map(row => (
                <tr key={row.id} className="text-slate-700 dark:text-slate-200">
                  <td className="px-4 py-3 font-bold">{row.productName}</td><td className="px-4 py-3"><p className="font-mono">{row.familyCode}</p><p className="mt-1 text-[10px] text-slate-400" title={row.familyId}>{row.familyId}</p></td>
                  <td className="px-4 py-3 font-mono">{row.lotNumber}</td><td className="px-4 py-3 whitespace-nowrap">{row.sourceType === "PURCHASE" ? "Purchased Bulk" : "Manufactured"}</td><td className="px-4 py-3">{row.warehouse?.name || "Unassigned"}</td>
                  <td className="px-4 py-3">{qty(row.originalQty)}</td><td className="px-4 py-3">{qty(row.packagedQty)}</td><td className="px-4 py-3"><strong className="text-orange-600">{qty(row.remainingQty)}</strong>{row.reservedQty > 0 && <p className="text-[10px] text-slate-400">{qty(row.reservedQty)} reserved</p>}</td><td className="px-4 py-3">{row.unit}</td>
                  {data.showCost && <><td className="px-4 py-3 whitespace-nowrap">{formatINR(row.unitCost)}</td><td className="px-4 py-3 whitespace-nowrap">{formatINR(row.remainingValue)}</td></>}
                  <td className="px-4 py-3 whitespace-nowrap">{date(row.productionDate)}</td><td className="px-4 py-3 whitespace-nowrap">{date(row.expiryDate)}</td>
                  <td className="px-4 py-3"><span className={`rounded-lg px-2 py-1 text-[10px] font-bold whitespace-nowrap ${row.availableQty > 0 ? "bg-orange-50 text-orange-700" : "bg-rose-50 text-rose-700"}`}>{row.status.replace(/_/g, " ")}</span></td>
                  <td className="px-4 py-3"><div className="flex flex-col items-start gap-2 whitespace-nowrap"><button onClick={() => setViewing({ row, source: false })} className="font-semibold hover:text-orange-500"><Eye size={12} className="mr-1 inline" />View Details</button><button onClick={() => setViewing({ row, source: true })} className="font-semibold hover:text-orange-500">View Source {row.sourceType === "PURCHASE" ? "Purchase Lot" : "Batch"}</button>{row.packagingUrl && row.availableQty > 0 ? <Link href={row.packagingUrl} className="font-bold text-orange-600">Go to Packaging <ArrowRight size={12} className="inline" /></Link> : <span className="text-[10px] text-slate-400">Unavailable for packaging</span>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-400">Summary quantities include only usable, unreserved stock. Expired and blocked lots remain visible for traceability. Pending packaging reservations and wastage can make remaining stock differ from original quantity less confirmed packaging.</p>
      {selected && <Modal isOpen onClose={() => setViewing(null)} size="lg" title={`${viewing.source ? "Source" : "Bulk lot details"}: ${selected.lotNumber}`}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {Object.entries({ Product: selected.productName, "Product family / ID": `${selected.familyCode} / ${selected.familyId}`, "Source type": selected.sourceType === "PURCHASE" ? "Purchased Bulk" : "Manufactured", "Source batch": selected.sourceBatchCode || "—", "Source batch ID": selected.productBatchId || "—", "Physical lot ID": selected.unreleased ? "Released by existing Packaging transaction" : selected.id, Supplier: selected.supplier || "—", "Purchase order": selected.purchaseOrderNumber || "—", "PO ID": selected.purchaseOrderId || "—", "GRN ID": selected.goodsReceiptId || "—", Warehouse: selected.warehouse?.name || "Unassigned", "Original quantity": `${qty(selected.originalQty)} ${selected.unit}`, "Already packaged": `${qty(selected.packagedQty)} ${selected.unit}`, "Remaining unpacked": `${qty(selected.remainingQty)} ${selected.unit}`, "Available for packaging": `${qty(selected.availableQty)} ${selected.unit}`, "Production / receipt date": date(selected.productionDate), "Expiry date": date(selected.expiryDate), ...(data?.showCost ? { "Actual bulk cost / unit": formatINR(selected.unitCost), "Remaining value": formatINR(selected.remainingValue) } : {}) }).map(([label, value]) => <div key={label}><dt className="mb-1 font-bold uppercase text-[10px] text-slate-400">{label}</dt><dd className="break-words font-semibold text-slate-800 dark:text-white">{value}</dd></div>)}
        </dl>
        {selected.packagingUrl && selected.availableQty > 0 && <Link href={selected.packagingUrl} className="mt-5 inline-flex rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white">Go to Packaging</Link>}
      </Modal>}
    </section>
  );
}
