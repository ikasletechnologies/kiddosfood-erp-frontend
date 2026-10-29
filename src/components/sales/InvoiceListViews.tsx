"use client";

import { ReactNode, useEffect, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { clsx } from "clsx";

export type InvoiceListView = "card" | "table";

/** Match the app's user-scoped local UI preferences; never persist invoice data. */
export function useInvoiceListView(userId?: string) {
  const key = userId ? `erp_sales_invoice_view_${userId}` : null;
  const [preference, setPreference] = useState<{ key: string | null; view: InvoiceListView }>({ key: null, view: "card" });
  useEffect(() => {
    let view: InvoiceListView = "card";
    try { if (key && localStorage.getItem(key) === "table") view = "table"; } catch {}
    setPreference({ key, view });
  }, [key]);
  const setView = (view: InvoiceListView) => {
    setPreference({ key, view });
    try { if (key) localStorage.setItem(key, view); } catch {}
  };
  return [preference.key === key ? preference.view : "card", setView] as const;
}

export function InvoiceViewSwitcher({ view, onChange }: { view: InvoiceListView; onChange: (view: InvoiceListView) => void }) {
  return <div role="group" aria-label="Invoice display view" className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-0.5 dark:border-white/10 dark:bg-card">
    {([['card', 'Card View', LayoutGrid], ['table', 'Table View', Table2]] as const).map(([value, label, Icon]) =>
      <button key={value} type="button" aria-pressed={view === value} onClick={() => onChange(value)} className={clsx("inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400", view === value ? "bg-[#f58220] text-white" : "text-slate-600 hover:bg-orange-50 dark:text-slate-300 dark:hover:bg-white/5")}>
        <Icon size={14} aria-hidden="true" />{label}
      </button>)}
  </div>;
}

export interface InvoiceCardData {
  id: string;
  number: string;
  date: string;
  partyName: string;
  partyType: string;
  paymentType: string;
  total: number;
  balance: number;
  status: string;
  statusClassName: string;
}

const money = (value: number) => value.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function InvoiceCards({ items, onOpen, renderActions }: { items: InvoiceCardData[]; onOpen: (id: string) => void; renderActions: (id: string) => ReactNode }) {
  return <div aria-label="Invoice cards" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {items.map(invoice => <article key={invoice.id} aria-label={`Invoice ${invoice.number}`} className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" onClick={() => onOpen(invoice.id)} className="min-w-0 break-all text-left font-mono text-xs font-bold text-orange-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:text-orange-400">{invoice.number}</button>
        <span className={clsx("inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", invoice.statusClassName)}>{invoice.status}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{invoice.date}</p>
      <h2 className="mt-4 break-words text-sm font-semibold leading-relaxed text-gray-900 dark:text-white">{invoice.partyName}</h2>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{invoice.partyType}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-slate-500 dark:text-slate-400">Transaction</dt><dd className="mt-1 font-medium">Sale</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Payment Type</dt><dd className="mt-1 font-medium">{invoice.paymentType}</dd></div>
        <div className="min-w-0"><dt className="text-slate-500 dark:text-slate-400">Amount</dt><dd className="mt-1 break-words text-base font-bold tabular-nums">{money(invoice.total)}</dd></div>
        <div className="min-w-0"><dt className="text-slate-500 dark:text-slate-400">Balance Due</dt><dd className={clsx("mt-1 break-words text-base font-bold tabular-nums", invoice.balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{money(invoice.balance)}</dd></div>
      </dl>
      <div className="mt-auto pt-4"><div className="border-t border-gray-100 pt-3 dark:border-white/10">{renderActions(invoice.id)}</div></div>
    </article>)}
  </div>;
}
