"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api/base';
import { useAuth } from '@/context/AuthContext';

export default function InvoiceInventoryStatus({ invoiceId, orderId, onPosted }: { invoiceId: string; orderId: string; onPosted: () => void | Promise<void> }) {
  const { user } = useAuth();
  const [review, setReview] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setReview((await api.get(`/api/sales/invoices/${invoiceId}/dispatch-review`)).data); setError(''); } catch (e:any) { setError(e.response?.data?.error || 'Could not verify inventory posting.'); } }, [invoiceId]);
  useEffect(() => { void load(); }, [load]);
  const post = async () => {
    if (!window.confirm('Confirm these goods are being dispatched. This creates a Delivery Challan and posts the selected lots once; payment is unchanged.')) return;
    setBusy(true); setError('');
    try { await api.post(`/api/sales/invoices/${invoiceId}/dispatch-selected`, { confirm: true }); await load(); await onPosted(); window.dispatchEvent(new Event('erp:refresh-inventory')); window.dispatchEvent(new Event('erp:refresh-invoices')); }
    catch (e:any) { setError(e.response?.data?.error || 'Dispatch failed; refresh and review stock.'); }
    finally { setBusy(false); }
  };
  const label = review?.inventoryStatus === 'FULFILLED' ? 'Posted / Dispatched' : review?.inventoryStatus === 'PARTIALLY_FULFILLED' ? 'Partially Dispatched' : review ? 'Pending' : 'Checking...';
  return <section className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 space-y-3 shadow-2xs">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Inventory Status: <span className={review?.inventoryStatus === 'FULFILLED' ? 'text-emerald-600' : 'text-amber-600'}>{label}</span></p>
      {review && review.inventoryStatus !== 'FULFILLED' && <div className="flex flex-wrap gap-2">{review.canPost && user?.role === 'SUPER_ADMIN' && <button type="button" disabled={busy} onClick={post} className="px-3.5 py-2 text-xs font-bold text-white bg-[#f58220] rounded-xl disabled:opacity-50">{busy ? 'Posting...' : 'Dispatch Selected Lots'}</button>}<Link className="px-3.5 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl" href={review.challans?.some((c:any) => ['DRAFT','IN_TRANSIT','OPEN'].includes(c.status)) ? '/sales/delivery-challan' : `/sales/delivery-challan?sourceInvoiceId=${orderId}`}>Open Delivery Challan</Link></div>}
    </div>
    {review?.inventoryStatus !== 'FULFILLED' && <p className="text-xs text-slate-500">Payment does not post inventory. Selected lots are deducted when the goods are dispatched through Delivery Challan.</p>}
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    {review?.warnings?.map((w:string) => <p key={w} className="text-xs text-amber-700 dark:text-amber-400">{w}</p>)}
    {!!review?.lines?.length && <div className="overflow-auto"><table className="w-full text-xs"><thead><tr>{['Selected Lot','Quantity','Lot Before','Lot After Posting'].map(h => <th className="text-left p-2 text-slate-500" key={h}>{h}</th>)}</tr></thead><tbody>{review.lines.map((l:any) => <tr key={l.orderItemId} className="border-t border-slate-100 dark:border-slate-800"><td className="p-2 font-mono">{l.lotNumber}</td><td className="p-2">{l.quantity} {l.unit}</td><td className="p-2">{l.beforeQty}</td><td className="p-2">{l.afterQty}</td></tr>)}</tbody></table></div>}
  </section>;
}
