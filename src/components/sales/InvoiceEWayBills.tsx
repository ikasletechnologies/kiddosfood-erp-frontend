"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ewayBillApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function InvoiceEWayBills({ invoiceId, cancelled = false }: { invoiceId: string; cancelled?: boolean }) {
  const [rows,setRows] = useState<any[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(false);
  useEffect(()=>{
    let stale=false;
    setLoading(true);setError(false);setRows([]);
    ewayBillApi.getAll({sourceType:'SALE_INVOICE',sourceId:invoiceId,status:'ALL'}).then(r=>{if(!stale)setRows(r.data || []);}).catch(()=>{if(!stale)setError(true);}).finally(()=>{if(!stale)setLoading(false);});
    return ()=>{stale=true;};
  },[invoiceId]);
  return <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-card">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold">E-Way Bill</h3>
      {!cancelled && !loading && !error && rows.every(r=>r.status==='CANCELLED') && <Link href={`/sales/eway-bill?invoiceId=${encodeURIComponent(invoiceId)}`} className="rounded-lg border border-orange-300 px-3 py-2 text-xs font-semibold text-orange-600">Generate E-Way Bill</Link>}
    </div>
    {loading ? <p className="mt-2 text-xs text-slate-500">Loading E-Way Bills...</p> : error ? <p className="mt-2 text-xs text-rose-600">Unable to load E-Way Bill status.</p> : !rows.length ? <p className="mt-2 text-xs text-slate-500">No E-Way Bill linked. Preparation does not dispatch stock.</p> :
      <div className="mt-3 space-y-3">{rows.map(row=><div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-white/10"><div><p className="font-semibold">{row.ewbNumber || row.refNumber} · {row.displayStatus || row.status}</p><p className="mt-1 text-slate-500">Generated: {row.ewbDate ? formatDateTime(row.ewbDate) : 'Not generated'} · Valid until: {row.validUntil ? formatDateTime(row.validUntil) : 'Not issued'}</p></div><Link href={`/sales/eway-bill?ewbId=${encodeURIComponent(row.id)}`} className="font-semibold text-orange-600">View / Download</Link></div>)}</div>}
  </section>;
}
