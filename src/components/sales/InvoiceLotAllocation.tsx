"use client";
import { useEffect, useRef, useState } from "react";
import api from "@/lib/api/base";
import LotSelector from "./LotSelector";
import { invoiceLotPool, LotAllocation, SaleLot, toAllocation } from "@/lib/lot-pricing";

export default function InvoiceLotAllocation({ productId, productName, sku, quantity, unit, price, selectedLotId, selections, manualClaims, franchiseId, warehouseId, pendingOnly, showCost, autoPrompt = false, onManualApply }: {
  productId: string; productName: string; sku?: string; quantity: number; unit: string; price: number;
  selectedLotId?: string; selections?: LotAllocation[]; manualClaims?: Record<string, number>; priorQuantity?: number;
  franchiseId?: string; warehouseId?: string; pendingOnly?: boolean; showCost?: boolean; autoPrompt?: boolean;
  onManualApply: (allocations: LotAllocation[]) => void;
}) {
  const [lots, setLots] = useState<SaleLot[] | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = JSON.stringify([productId, quantity, unit, franchiseId, warehouseId]);
  const ready = loadedKey === requestKey && lots !== null;
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const promptedKey = useRef("");
  useEffect(() => {
    let stale = false; setLots(null); setError(false); setOpen(false); promptedKey.current = "";
    const timer = setTimeout(() => {
      api.get('/api/sales/invoices/lot-suggestions', { params: { productId, quantity, unit, franchiseId, warehouseId } })
        .then(r => { if (!stale) { setLots(r.data.lots || []); setLoadedKey(requestKey); } }).catch(() => { if (!stale) setError(true); });
    }, 180);
    return () => { stale = true; clearTimeout(timer); };
  }, [productId, quantity, unit, franchiseId, warehouseId, requestKey]);
  const available = invoiceLotPool(ready ? lots : [], manualClaims).filter(l => l.selectable && l.availableQty > 0);
  const chosen = selections ?? (selectedLotId ? available.filter(l => l.id === selectedLotId).map(l => toAllocation(l, quantity, price)) : []);
  const allocated = chosen.reduce((sum, a) => sum + a.quantity, 0);
  const invalid = (!!selectedLotId && !available.some(l => l.id === selectedLotId)) || allocated > quantity + 0.0001 || chosen.some(a => !available.some(l => l.id === a.lotId && a.quantity <= l.availableQty + 0.0001));
  const pending = Math.max(0, quantity - allocated);
  const only = available.length === 1 ? available[0] : null;
  useEffect(() => {
    if (ready && only && quantity > 0 && !pendingOnly && !selectedLotId && selections === undefined) {
      onManualApply([toAllocation(only, Math.min(quantity, only.availableQty), price)]);
    }
  }, [ready, only?.id, only?.availableQty, quantity, pendingOnly, selectedLotId, selections, price, onManualApply]);
  useEffect(() => {
    // Prompt once per quantity/product/warehouse, without choosing between lots
    // or reopening after Cancel. Saved/manual selections remain untouched.
    if (autoPrompt && ready && quantity > 0 && available.length > 1 && !pendingOnly &&
        !selectedLotId && selections === undefined && promptedKey.current !== requestKey) {
      promptedKey.current = requestKey;
      setOpen(true);
    }
  }, [autoPrompt, ready, quantity, available.length, pendingOnly, selectedLotId, selections, requestKey]);
  const action = <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-orange-400 px-2 py-1 text-orange-600 font-semibold">{chosen.length ? "Change" : "Select Lots"}</button>;
  return <div className="space-y-1 text-[11px] text-slate-500 min-w-0">
    {!ready ? <p>{error ? "Availability unavailable. Save as pending or retry." : "Checking lots..."}</p> : <>
      <div className="flex flex-wrap items-center gap-2">
        {chosen.length > 0 ? <span>{chosen.length === 1 ? `Lot: ${chosen[0].lotNumber}` : `${chosen.length} Lots Selected`} · {allocated} {unit}{only ? ` · Available: ${only.availableQty} ${unit}` : ""}</span>
          : <span>{available.length ? `${available.length} Lots Available` : "Out of Stock"}</span>}
        {(available.length > 1 || (chosen.length > 0 && !only) || ((invalid || pendingOnly || selections?.length === 0) && available.length > 0)) && action}
      </div>
      {invalid && <p role="alert" className="text-rose-600">Lot availability changed. Select available lots again.</p>}
      {pending > 0 && <p className="text-amber-600">{pending} {unit} pending fulfilment</p>}
    </>}
    <LotSelector open={open} onClose={() => setOpen(false)} productId={productId} productName={productName} sku={sku} quantity={quantity} price={price} franchiseId={franchiseId} warehouseId={warehouseId} invoiceMode unit={unit} showCost={showCost}
      initial={Object.fromEntries(chosen.map(a => [a.lotId, a.quantity]))} manualClaims={manualClaims}
      onApply={values => { onManualApply(values); setOpen(false); }} />
  </div>;
}
