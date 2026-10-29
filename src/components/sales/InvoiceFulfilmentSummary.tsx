"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api/base";
import { formatINR } from "@/lib/lot-pricing";
export default function InvoiceFulfilmentSummary({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<any>(null);
  useEffect(() => { let stale = false; api.get(`/api/sales/invoices/${invoiceId}/fulfilment`).then(r => { if (!stale) setState(r.data); }).catch(() => {}); return () => { stale = true; }; }, [invoiceId]);
  if (!state) return null;
  return <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3 text-xs dark:border-orange-500/20 dark:bg-orange-500/5"><p className="font-bold">Fulfilment: {state.status.replace(/_/g, " ")}</p>{state.lines.map((l: any) => <div key={l.orderItemId} className="mt-1 text-slate-500"><p>{l.productName}: {l.fulfilledQty} {l.unit} fulfilled · {l.pendingQty} {l.unit} pending</p>{l.fulfilledQty > 0 && l.totalCost != null && <p>Actual cost {formatINR(l.totalCost)} · Gross profit {formatINR(l.fulfilledQty * l.netUnitPrice - l.totalCost)}</p>}</div>)}</div>;
}
