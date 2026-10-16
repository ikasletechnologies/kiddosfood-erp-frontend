"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Eye, Loader2, Pencil, Plus, Wallet, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  CentralFundEntry,
  CentralFundData,
  WarehouseApi,
} from "@/lib/api/warehouse.api";

const MAX_FUND = 1_000_000_000_000;
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);
const dateTime = (value: string) => new Date(value).toLocaleString("en-IN");
const errorMessage = (error: any) =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || "Request failed";

export default function CentralWarehouse() {
  const [data, setData] = useState<CentralFundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<CentralFundEntry | null>(null);
  const [editing, setEditing] = useState<CentralFundEntry | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await WarehouseApi.getCentralFunds());
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const validAmount = (raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid fund amount greater than zero");
      return null;
    }
    if (value > MAX_FUND) {
      toast.error("Fund amount is too large");
      return null;
    }
    return value;
  };

  const addFund = async (event: FormEvent) => {
    event.preventDefault();
    const value = validAmount(amount);
    if (value === null) return;
    setSaving(true);
    try {
      await WarehouseApi.addCentralFund({ amount: value, note: note.trim() || undefined });
      toast.success("Fund added successfully");
      setAmount("");
      setNote("");
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (entry: CentralFundEntry) => {
    setSelected(null);
    setEditing(entry);
    setEditAmount(String(entry.paidAmount));
    setEditNote(entry.transactionRef || "");
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const value = validAmount(editAmount);
    if (value === null) return;
    setSaving(true);
    try {
      await WarehouseApi.updateCentralFund(editing.id, { amount: value, note: editNote.trim() || undefined });
      toast.success("Fund entry updated successfully");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  }

  if (!data) return <div className="p-8 text-sm text-slate-500">Central Warehouse is not configured.</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-background dark:text-slate-100 sm:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-[#f58220]"><Wallet className="h-6 w-6" /></div>
            <div><h1 className="text-xl font-black text-slate-900 dark:text-white">Central Warehouse Fund</h1><p className="text-xs text-slate-500">{data.warehouse.name} · {data.warehouse.code || "Central"}</p></div>
          </div>
          <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available Fund</p><p className="text-xl font-black text-emerald-600">{money(data.balance)}</p></div>
        </div>

        <form onSubmit={addFund} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-card sm:p-6">
          <div className="mb-5"><h2 className="font-bold text-slate-900 dark:text-white">Add Fund</h2><p className="mt-1 text-xs text-slate-500">Add funds to the Central Warehouse account.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5"><span className="text-xs font-bold">Amount (₹) *</span><input type="number" min="0.01" max={MAX_FUND} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#f58220] dark:border-slate-700 dark:bg-slate-900" /></label>
            <label className="space-y-1.5"><span className="text-xs font-bold">Details</span><input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Optional fund details" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#f58220] dark:border-slate-700 dark:bg-slate-900" /></label>
          </div>
          <button type="submit" disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f58220] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e8740e] disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{saving ? "Adding..." : "Add Fund"}</button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-card">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="font-bold text-slate-900 dark:text-white">Fund Adding History</h2><p className="mt-1 text-xs text-slate-500">View details or edit an existing fund entry.</p></div>
          {data.history.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">No funds have been added yet.</div> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Details</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.history.map((entry) => <tr key={entry.id}><td className="px-5 py-4 font-semibold">{entry.paymentNumber || "—"}</td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{dateTime(entry.createdAt)}</td><td className="max-w-xs truncate px-5 py-4 text-slate-500">{entry.transactionRef || "—"}</td><td className="px-5 py-4 text-right font-black text-emerald-600">{money(entry.paidAmount)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => setSelected(entry)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-[#f58220]" title="View details"><Eye className="h-4 w-4" /></button><button onClick={() => openEdit(entry)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:text-[#f58220]" title="Edit fund"><Pencil className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>
          )}
        </div>
      </div>

      {selected && <Modal title="Fund Details" onClose={() => setSelected(null)}><Detail label="Reference" value={selected.paymentNumber || "—"} /><Detail label="Amount" value={money(selected.paidAmount)} /><Detail label="Date & Time" value={dateTime(selected.createdAt)} /><Detail label="Added By" value={selected.createdBy || "—"} /><Detail label="Details" value={selected.transactionRef || "—"} /><button onClick={() => openEdit(selected)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f58220] py-2.5 text-sm font-bold text-white"><Pencil className="h-4 w-4" /> Edit Fund</button></Modal>}
      {editing && <Modal title="Edit Fund" onClose={() => setEditing(null)}><form onSubmit={saveEdit} className="space-y-4"><label className="block space-y-1.5"><span className="text-xs font-bold">Amount (₹) *</span><input type="number" min="0.01" max={MAX_FUND} step="0.01" required value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#f58220]" /></label><label className="block space-y-1.5"><span className="text-xs font-bold">Details</span><textarea value={editNote} maxLength={500} onChange={(e) => setEditNote(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#f58220]" /></label><button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f58220] py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Saving..." : "Save Changes"}</button></form></Modal>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-card"><div className="mb-5 flex items-center justify-between"><h3 className="font-black">{title}</h3><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="space-y-3">{children}</div></div></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>;
}
