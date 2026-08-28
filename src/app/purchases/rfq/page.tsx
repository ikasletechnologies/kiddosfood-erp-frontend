"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, FileText, FileDown, CheckCircle2, XCircle } from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  CLOSED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700"
};

export default function RequestForQuotationPage() {
  const [rfqs, setRFQs] = useState<any[]>([]);
  const [prs, setPRs] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  const [showRFQForm, setShowRFQForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState<string | null>(null);
  
  const [rfqForm, setRFQForm] = useState({ purchaseRequestId: "", deadline: "", notes: "" });
  const [quoteForm, setQuoteForm] = useState({
     vendorId: "", validUntil: "", notes: "",
     items: [{ itemName: "", quantity: "1", unit: "pcs", quotedRate: "0", notes: "" }]
  });

  async function loadData() {
    setLoading(true);
    try {
      const [rRes, pRes, vRes] = await Promise.all([
        api.get("/api/purchase/rfqs", { params: { search, status: statusFilter } }),
        api.get("/api/purchase-requests", { params: { status: "APPROVED" } }),
        api.get("/api/vendors")
      ]);
      setRFQs(rRes.data);
      setPRs(pRes.data);
      setVendors(vRes.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [search, statusFilter]);

  async function handleCreateRFQ(e: React.FormEvent) {
     e.preventDefault();
     try {
        await api.post("/api/purchase/rfqs", rfqForm);
        setShowRFQForm(false);
        setRFQForm({ purchaseRequestId: "", deadline: "", notes: "" });
        loadData();
     } catch (e: any) { alert(e.response?.data?.error || "Error"); }
  }

  async function handleAddQuote(e: React.FormEvent) {
     e.preventDefault();
     if (!showQuoteForm) return;
     try {
        await api.post(`/api/purchase/rfqs/${showQuoteForm}/quotations`, {
           ...quoteForm,
           items: quoteForm.items.map(i => ({
              ...i, quantity: Number(i.quantity), quotedRate: Number(i.quotedRate)
           }))
        });
        setShowQuoteForm(null);
        setQuoteForm({ vendorId: "", validUntil: "", notes: "", items: [{ itemName: "", quantity: "1", unit: "pcs", quotedRate: "0", notes: "" }] });
        loadData();
     } catch (e: any) { alert(e.response?.data?.error || "Error"); }
  }

  async function convertToPO(quotationId: string) {
     if(!confirm("Convert this quotation to a Purchase Order? Other quotations will be rejected.")) return;
     try {
        await api.post(`/api/purchase/rfqs/${quotationId}/convert-to-po`);
        loadData();
     } catch (e: any) { alert(e.response?.data?.error || "Error"); }
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 min-h-screen">
      <div className="flex items-center justify-end">
        <button onClick={() => setShowRFQForm(true)} className="flex items-center gap-2 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Create RFQ
        </button>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">RFQ #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Linked PR</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Deadline</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Quotes</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">Loading...</td></tr>
            ) : rfqs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No RFQs found</td></tr>
            ) : rfqs.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-white/[0.02] bg-white dark:bg-card">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">{r.rfqNumber}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-slate-400 font-mono text-xs">{r.purchaseRequest?.prNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{formatDate(r.deadline)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{r.quotations?.length || 0}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'OPEN' && (
                       <button onClick={() => setShowQuoteForm(r.id)} className="text-[#f58220] hover:text-[#e8740e] font-semibold text-xs cursor-pointer">
                          Add Quote
                       </button>
                    )}
                  </td>
                </tr>
                {r.quotations && r.quotations.length > 0 && (
                   <tr className="bg-gray-50/50 dark:bg-white/[0.01]">
                      <td colSpan={6} className="px-8 py-3">
                         <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] overflow-hidden">
                            <table className="w-full text-xs">
                               <thead className="bg-gray-100/50 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400">
                                  <tr>
                                     <th className="px-3 py-2 text-left font-medium">Vendor</th>
                                     <th className="px-3 py-2 text-left font-medium">Total Amount</th>
                                     <th className="px-3 py-2 text-left font-medium">Valid Until</th>
                                     <th className="px-3 py-2 text-left font-medium">Status</th>
                                     <th className="px-3 py-2 text-right font-medium">Action</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                  {r.quotations.map((q: any) => (
                                     <tr key={q.id}>
                                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{q.vendor?.name}</td>
                                        <td className="px-3 py-2 text-gray-800 dark:text-slate-200">₹{q.totalAmount.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{formatDate(q.validUntil)}</td>
                                        <td className="px-3 py-2">
                                           <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide
                                              ${q.status === 'ACCEPTED' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 
                                                q.status === 'REJECTED' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'}`}>
                                              {q.status}
                                           </span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                           {q.status === 'PENDING' && r.status === 'OPEN' && (
                                              <button onClick={() => convertToPO(q.id)} className="text-green-600 dark:text-green-400 font-medium hover:underline cursor-pointer">Accept & Create Purchase Order</button>
                                           )}
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      </td>
                   </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showRFQForm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-xl my-4 text-gray-800 dark:text-slate-100">
            <div className="p-6 border-b border-gray-100 dark:border-white/5"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Open New RFQ</h2></div>
            <form onSubmit={handleCreateRFQ} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Link Purchase Request (Optional)</label>
                <select value={rfqForm.purchaseRequestId} onChange={e => setRFQForm({...rfqForm, purchaseRequestId: e.target.value})} className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none">
                   <option value="" className="dark:bg-card">-- No PR Linked --</option>
                   {prs.map(pr => <option key={pr.id} value={pr.id} className="dark:bg-card">{pr.prNumber} ({pr.department})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Deadline</label>
                <input type="date" value={rfqForm.deadline} onChange={e => setRFQForm({...rfqForm, deadline: e.target.value})} className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea value={rfqForm.notes} onChange={e => setRFQForm({...rfqForm, notes: e.target.value})} className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500" rows={3}></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                 <button type="submit" className="flex-1 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg py-2 text-sm font-semibold transition-colors cursor-pointer">Create RFQ</button>
                 <button type="button" onClick={() => setShowRFQForm(false)} className="flex-1 border border-gray-200 dark:border-white/10 rounded-lg py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuoteForm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-xl my-4 text-gray-800 dark:text-slate-100">
            <div className="p-6 border-b border-gray-100 dark:border-white/5"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Log Vendor Quotation</h2></div>
            <form onSubmit={handleAddQuote} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Vendor *</label>
                    <select required value={quoteForm.vendorId} onChange={e => setQuoteForm({...quoteForm, vendorId: e.target.value})} className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none">
                       <option value="" className="dark:bg-card">Select Vendor...</option>
                       {vendors.map(v => <option key={v.id} value={v.id} className="dark:bg-card">{v.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Valid Until</label>
                    <input type="date" value={quoteForm.validUntil} onChange={e => setQuoteForm({...quoteForm, validUntil: e.target.value})} className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none" />
                 </div>
              </div>
              <div>
                 <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Quoted Items *</label>
                    <button type="button" onClick={() => setQuoteForm({...quoteForm, items: [...quoteForm.items, { itemName: "", quantity: "1", unit: "pcs", quotedRate: "0", notes: "" }]})} className="text-xs text-[#f58220] hover:text-[#e8740e] font-semibold cursor-pointer">+ Add Item</button>
                 </div>
                 {quoteForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                       <input required placeholder="Item Name" value={item.itemName} onChange={e => { const items = [...quoteForm.items]; items[idx].itemName = e.target.value; setQuoteForm({...quoteForm, items}); }} className="flex-1 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white rounded px-2.5 py-1.5 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500" />
                       <input required type="number" placeholder="Qty" value={item.quantity} onChange={e => { const items = [...quoteForm.items]; items[idx].quantity = e.target.value; setQuoteForm({...quoteForm, items}); }} className="w-20 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white rounded px-2.5 py-1.5 text-sm outline-none" />
                       <input required type="number" placeholder="Rate" value={item.quotedRate} onChange={e => { const items = [...quoteForm.items]; items[idx].quotedRate = e.target.value; setQuoteForm({...quoteForm, items}); }} className="w-24 border border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] text-gray-800 dark:text-white rounded px-2.5 py-1.5 text-sm outline-none" />
                    </div>
                 ))}
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                 <button type="submit" className="flex-1 bg-[#f58220] hover:bg-[#e8740e] text-white rounded-lg py-2 text-sm font-semibold transition-colors cursor-pointer">Submit Quote</button>
                 <button type="button" onClick={() => setShowQuoteForm(null)} className="flex-1 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
