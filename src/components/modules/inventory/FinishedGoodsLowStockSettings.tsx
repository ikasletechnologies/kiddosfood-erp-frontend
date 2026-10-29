"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import api from '@/lib/api/base';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { finishedGoodsStockStatus } from '@/lib/finished-goods-stock';

const endpoint = '/api/settings/finished-goods-low-stock';
const changed = 'erp:finished-goods-low-stock-changed';
const storageKey = 'erp:finished-goods-low-stock-updated';
type Setting = { threshold: number | null; error: string; refresh: () => Promise<void>; save: (value: number) => Promise<void> };
const Context = createContext<Setting | null>(null);
const message = (e: any) => e.response?.data?.message || e.response?.data?.error || 'Could not load the global low-stock setting. Please retry.';

export function FinishedGoodsLowStockProvider({ children }: { children: React.ReactNode }) {
  const [threshold, setThreshold] = useState<number | null>(null);
  const [error, setError] = useState('');
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    try {
      const response = await api.get(endpoint);
      const value = response.data.finishedGoodsLowStockThreshold;
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid setting response');
      if (request === version.current) { setThreshold(value); setError(''); }
    } catch (e) { if (request === version.current) setError(message(e)); }
  }, []);
  useEffect(() => {
    refresh();
    const onChange = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (Number.isSafeInteger(value) && value >= 0) { version.current++; setThreshold(value); setError(''); }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey) refresh(); };
    window.addEventListener(changed, onChange); window.addEventListener('focus', refresh); window.addEventListener('storage', onStorage);
    return () => { version.current++; window.removeEventListener(changed, onChange); window.removeEventListener('focus', refresh); window.removeEventListener('storage', onStorage); };
  }, [refresh]);
  const save = async (value: number) => {
    const response = await api.put(endpoint, { finishedGoodsLowStockThreshold: value });
    const saved = response.data.finishedGoodsLowStockThreshold;
    if (!Number.isSafeInteger(saved) || saved < 0) throw new Error('Could not confirm the saved setting. Please refresh.');
    version.current++; setThreshold(saved); setError('');
    window.dispatchEvent(new CustomEvent(changed, { detail: saved }));
    try { localStorage.setItem(storageKey, String(Date.now())); } catch { /* Focus refresh still works if storage is unavailable. */ }
  };
  return <Context.Provider value={{ threshold, error, refresh, save }}>{children}</Context.Provider>;
}

export function useFinishedGoodsLowStock() {
  const value = useContext(Context);
  if (!value) throw new Error('Finished Goods stock settings require their provider.');
  return value;
}

export function FinishedGoodsLowStockNotice() {
  const { error, refresh } = useFinishedGoodsLowStock();
  if (!error) return null;
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><p>{error}</p><button type="button" className="font-semibold underline" onClick={refresh}>Retry Stock Settings</button></div>;
}

export function LowStockSettingsButton() {
  const { user } = useAuth();
  const { threshold, save } = useFinishedGoodsLowStock();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const role = String((user as any)?.role?.name || user?.role || '').toUpperCase();
  if (role !== 'SUPER_ADMIN') return null;
  const close = () => { if (!saving) setOpen(false); };
  const submit = async () => {
    const value = Number(draft);
    if (!/^\d+$/.test(draft) || !Number.isSafeInteger(value) || value < 0) { setError('Enter a non-negative whole number.'); return; }
    setSaving(true); setError('');
    try { await save(value); setOpen(false); }
    catch (e: any) { setError(e.response?.data?.message || e.response?.data?.error || e.message || 'Could not save settings.'); }
    finally { setSaving(false); }
  };
  return <>
    <button type="button" disabled={threshold === null} onClick={() => { setDraft(String(threshold)); setError(''); setOpen(true); }} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-orange-200 bg-white px-4 py-2.5 text-xs font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-40 dark:bg-slate-900"><Settings2 size={16} aria-hidden="true" />Low Stock Settings</button>
    {open && <Modal isOpen onClose={close} title="Global Low Stock Settings" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">One alert quantity for every Finished Goods SKU. This does not change stock quantities.</p>
        <label className="block text-sm font-semibold">Low Stock Alert Quantity<div className="relative mt-2"><input aria-label="Low Stock Alert Quantity" type="number" min={0} step={1} max={Number.MAX_SAFE_INTEGER} value={draft} onChange={event => setDraft(event.target.value)} disabled={saving} className="w-full rounded-lg border border-slate-200 bg-white p-3 pr-12 text-slate-900 outline-none focus:ring-2 focus:ring-orange-300 dark:bg-slate-900 dark:text-white" /><span className="absolute right-4 top-3 text-sm font-semibold text-slate-500">PC</span></div></label>
        <p className="text-xs text-slate-500">Zero available is Out of Stock. Positive stock at or below this quantity is Low Stock.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={close} disabled={saving} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={submit} disabled={saving} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{saving ? 'Saving...' : 'Save Settings'}</button></div>
      </div>
    </Modal>}
  </>;
}

export function FinishedGoodsStockBadge({ available }: { available: number }) {
  const { threshold } = useFinishedGoodsLowStock();
  if (threshold === null) return <span className="text-[10px] text-slate-400">Checking stock setting...</span>;
  const status = finishedGoodsStockStatus(available, threshold);
  const colour = status === 'OUT_OF_STOCK' ? 'bg-rose-50 text-rose-700' : status === 'LOW_STOCK' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';
  return <span className={`mt-1 inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${colour}`}>{status === 'OUT_OF_STOCK' ? 'Out of Stock' : status === 'LOW_STOCK' ? 'Low Stock' : 'In Stock'}</span>;
}
