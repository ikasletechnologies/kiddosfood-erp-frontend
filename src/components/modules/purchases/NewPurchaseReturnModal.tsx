import { useState } from "react";
import { X } from "lucide-react";
import api from "@/lib/api/base";
import { useToast } from "@/context/ToastContext";

export default function NewPurchaseReturnModal({ vendors, onClose, onSuccess }: { vendors: any[], onClose: () => void, onSuccess: () => void }) {
  const [form, setForm] = useState({
    vendorId: "",
    reason: "",
    items: [{ itemName: "", quantity: "1", unit: "pcs", rate: "" }]
  });
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  function addItem() { 
    setForm({ ...form, items: [...form.items, { itemName: "", quantity: "1", unit: "pcs", rate: "" }] }); 
  }
  function removeItem(i: number) { 
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) }); 
  }
  function updateItem(i: number, field: string, value: string) {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  }

  const refundTotal = form.items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate) || 0), 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/purchase/returns", {
        vendorId: form.vendorId,
        reason: form.reason,
        returnSource: "MANUAL", // Explicitly setting this per requirements
        items: form.items.map(i => ({ 
          itemName: i.itemName, 
          quantity: Number(i.quantity), 
          unit: i.unit, 
          rate: Number(i.rate) 
        }))
      });
      showToast("Purchase Return created successfully!", "success");
      onSuccess();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Failed to create return", "error");
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-[#12141c] rounded-[2.5rem] shadow-2xl w-full max-w-2xl p-10 space-y-8 relative overflow-hidden border border-slate-100 dark:border-white/10">
         <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 rounded-bl-[150px] -mr-16 -mt-16" />
         
         <div className="flex justify-between items-start relative z-10">
           <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Manual Purchase Return</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Record a new return document</p>
           </div>
           <button type="button" onClick={onClose} className="p-2 bg-gray-50 dark:bg-white/5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 dark:text-slate-400">
              <X size={18} />
           </button>
         </div>

        <form onSubmit={handleCreate} className="space-y-6 relative z-10">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor *</label>
              <select required value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold outline-none ring-orange-500/10 focus:ring-4 dark:text-white transition-all">
                <option value="" className="dark:bg-[#12141c]">Select vendor...</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id} className="dark:bg-[#12141c]">{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason *</label>
              <input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full px-4 py-3.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-bold outline-none ring-orange-500/10 focus:ring-4 dark:text-white transition-all" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Returned Items</label>
              <button type="button" onClick={addItem} className="text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-widest hover:text-orange-700">+ Add Row</button>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-orange-200">
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-3 items-center p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                  <div className="col-span-5"><input placeholder="Item name" required value={item.itemName} onChange={(e) => updateItem(i, "itemName", e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none dark:text-white" /></div>
                  <div className="col-span-2 text-center border-l border-gray-200 dark:border-white/10"><input type="number" placeholder="Qty" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="w-full bg-transparent text-center text-sm font-black outline-none dark:text-white" required /></div>
                  <div className="col-span-2 text-center border-l border-gray-200 dark:border-white/10"><input placeholder="Unit" value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="w-full bg-transparent text-center text-xs font-bold text-gray-400 dark:text-slate-400 outline-none" /></div>
                  <div className="col-span-2 text-center border-l border-gray-200 dark:border-white/10"><input type="number" placeholder="Rate" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(i, "rate", e.target.value)} className="w-full bg-transparent text-center text-sm font-black text-orange-600 dark:text-orange-400 outline-none" required /></div>
                  <div className="col-span-1 text-right">{form.items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-rose-400 hover:text-rose-600 transition-colors">✕</button>}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-orange-600/5 dark:bg-orange-950/20 rounded-2xl px-6 py-5 flex items-center justify-between border border-orange-500/10 dark:border-orange-500/20">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">Refund Value</span>
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400 tracking-tighter">₹{refundTotal.toLocaleString()}</span>
          </div>

          <div className="flex gap-4 pt-4">
            <button disabled={submitting} type="submit" className="flex-[2] bg-orange-600 text-white py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/20 hover:bg-orange-700 transition-all disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Return Claim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
