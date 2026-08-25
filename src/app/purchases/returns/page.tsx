"use client";

import { useState, useEffect } from "react";
import { X, 
  Package as PackageIcon, 
  Plus as PlusIcon, 
  Search as SearchIcon, 
  ArrowRight as ArrowRightIcon, 
  History as HistoryIcon, 
  CheckCircle2 as CheckCircle2Icon, 
  XCircle as XCircleIcon, 
  Clock as ClockIcon, 
  CheckCircle as CheckCircleIcon, 
  Loader2 as Loader2Icon 
} from "lucide-react";
import api from "@/lib/api";
import { clsx } from "clsx";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600 border-amber-100/50",
  APPROVED: "bg-emerald-50 text-emerald-600 border-emerald-100/50",
  REJECTED: "bg-rose-50 text-rose-600 border-rose-100/50",
  COMPLETED: "bg-blue-50 text-blue-600 border-blue-100/50"
};

export default function PurchaseReturnsPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vendorId: "", reason: "",
    items: [{ itemName: "", quantity: "1", unit: "pcs", rate: "" }]
  });

  async function loadData() {
    setLoading(true);
    try {
      const [rRes, vRes] = await Promise.all([
        api.get("/api/purchase/returns", { params: { search, status: statusFilter } }),
        api.get("/api/vendors")
      ]);
      setReturns(rRes.data);
      setVendors(vRes.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [search, statusFilter]);

  function addItem() { setForm({ ...form, items: [...form.items, { itemName: "", quantity: "1", unit: "pcs", rate: "" }] }); }
  function removeItem(i: number) { setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) }); }
  function updateItem(i: number, field: string, value: string) {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  }

  const refundTotal = form.items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate) || 0), 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/purchase/returns", {
        vendorId: form.vendorId,
        reason: form.reason,
        items: form.items.map(i => ({ itemName: i.itemName, quantity: Number(i.quantity), unit: i.unit, rate: Number(i.rate) }))
      });
      setShowForm(false);
      setForm({ vendorId: "", reason: "", items: [{ itemName: "", quantity: "1", unit: "pcs", rate: "" }] });
      loadData();
    } catch {}
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch(`/api/purchase/returns/${id}`, { status });
      loadData();
    } catch {}
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-6 space-y-8 animate-in fade-in duration-500">
      <div className="max-w-[1500px] mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-6">
          <div className="flex gap-2">
            <a href="/purchases/rfq" className="px-6 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-all flex items-center gap-2">RFQ</a>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2"
            >
              <PlusIcon size={16} /> New Return
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Pending", status: "PENDING", icon: ClockIcon, color: "text-amber-500", bg: "bg-amber-50/30 dark:bg-amber-500/5" },
            { label: "Approved", status: "APPROVED", icon: CheckCircle2Icon, color: "text-emerald-500", bg: "bg-emerald-50/30 dark:bg-emerald-500/5" },
            { label: "Rejected", status: "REJECTED", icon: XCircleIcon, color: "text-rose-500", bg: "bg-rose-50/30 dark:bg-rose-500/5" },
            { label: "Completed", status: "COMPLETED", icon: CheckCircleIcon, color: "text-blue-500", bg: "bg-blue-50/30 dark:bg-blue-500/5" },
          ].map(s => (
            <div key={s.label} className={clsx("rounded-[2rem] p-8 border border-gray-100 dark:border-white/5 shadow-xl shadow-black/[0.02] text-center bg-white dark:bg-[#12141c]")}>
               <div className={clsx("text-4xl font-black tracking-tighter mb-2", s.color)}>
                 {returns.filter(r => r.status === s.status).length}
               </div>
               <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search returns..."
              className="w-full pl-12 pr-6 py-3.5 bg-white dark:bg-[#12141c] border border-gray-100 dark:border-white/5 rounded-2xl text-sm font-bold shadow-xl shadow-black/[0.02] outline-none focus:ring-2 ring-orange-500/10 focus:border-orange-500 transition-all"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-6 py-3.5 text-sm bg-white dark:bg-[#12141c] border border-gray-100 dark:border-white/5 rounded-2xl font-black uppercase tracking-widest outline-none ring-orange-500/10 focus:ring-4 transition-all"
          >
            <option value="">All Status</option>
            {["PENDING","APPROVED","REJECTED","COMPLETED"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="bg-white dark:bg-[#12141c] rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl shadow-black/[0.02] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
              <tr>
                {["Return #","Vendor","Items","Refund Amount","Reason","Status","Actions"].map(h => (
                  <th key={h} className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="px-8 py-16 text-center"><Loader2Icon className="mx-auto text-orange-500 animate-spin" /></td></tr>
              ) : returns.length === 0 ? (
                <tr><td colSpan={7} className="px-8 py-16 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">No purchase returns found</td></tr>
              ) : returns.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/30 dark:hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-5 font-bold text-xs text-orange-600 font-mono tracking-tighter">{r.returnNumber}</td>
                  <td className="px-8 py-5">
                    <div className="font-black text-gray-900 dark:text-white uppercase text-xs">{r.vendor?.name}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 tracking-tight">{r.vendor?.contact}</div>
                  </td>
                  <td className="px-8 py-5 text-gray-600 font-black text-xs">{r.items?.length || 0}</td>
                  <td className="px-8 py-5">
                     <span className="text-sm font-black text-orange-600">₹{r.refundAmount?.toLocaleString()}</span>
                  </td>
                  <td className="px-8 py-5 text-gray-400 text-xs font-medium max-w-[200px] truncate">{r.reason}</td>
                  <td className="px-8 py-5">
                    <span className={clsx(
                      "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                      STATUS_COLORS[r.status]
                    )}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    {r.status === "PENDING" && (
                      <div className="flex gap-3">
                        <button onClick={() => updateStatus(r.id, "APPROVED")} className="text-emerald-600 hover:scale-110 transition-transform font-bold text-xs">Approve</button>
                        <button onClick={() => updateStatus(r.id, "REJECTED")} className="text-rose-600 hover:scale-110 transition-transform font-bold text-xs">Reject</button>
                      </div>
                    )}
                    {r.status === "APPROVED" && (
                      <button onClick={() => updateStatus(r.id, "COMPLETED")} className="text-blue-600 hover:scale-110 transition-transform font-bold text-xs uppercase tracking-widest">Mark Completed</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#12141c] rounded-[2.5rem] shadow-2xl w-full max-w-xl p-10 space-y-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 rounded-bl-[150px] -mr-16 -mt-16" />
             
             <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Manual Purchase Return</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Record a new return document</p>
             </div>

            <form onSubmit={handleCreate} className="space-y-6 relative z-10">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor *</label>
                  <select required value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-white/5 border border-gray-200 rounded-2xl text-sm font-bold outline-none ring-orange-500/10 focus:ring-4 transition-all">
                    <option value="">Select vendor...</option>
                    {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason *</label>
                  <input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-white/5 border border-gray-200 rounded-2xl text-sm font-bold outline-none ring-orange-500/10 focus:ring-4 transition-all" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Returned Items</label>
                  <button type="button" onClick={addItem} className="text-orange-600 text-[10px] font-black uppercase tracking-widest">+ Add Row</button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-orange-200">
                  {form.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-3 items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="col-span-5"><input placeholder="Item name" required value={item.itemName} onChange={(e) => updateItem(i, "itemName", e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" /></div>
                      <div className="col-span-2 text-center border-l border-gray-200"><input type="number" placeholder="Qty" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="w-full bg-transparent text-center text-sm font-black outline-none" required /></div>
                      <div className="col-span-2 text-center border-l border-gray-200"><input placeholder="Unit" value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="w-full bg-transparent text-center text-xs font-bold text-gray-400 outline-none" /></div>
                      <div className="col-span-2 text-center border-l border-gray-200"><input type="number" placeholder="Rate" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(i, "rate", e.target.value)} className="w-full bg-transparent text-center text-sm font-black text-orange-600 outline-none" required /></div>
                      <div className="col-span-1 text-right">{form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-rose-400 hover:text-rose-600 transition-colors">✕</button>}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-orange-600/5 rounded-2xl px-6 py-5 flex items-center justify-between border border-orange-500/10">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Refund Value</span>
                <span className="text-2xl font-black text-orange-600 tracking-tighter">₹{refundTotal.toLocaleString()}</span>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-[2] bg-orange-600 text-white py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/20 hover:bg-orange-700 transition-all">Submit Return Claim</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border-2 border-gray-100 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 hover:bg-gray-50 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
