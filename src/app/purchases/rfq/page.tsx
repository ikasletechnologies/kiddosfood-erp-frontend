"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, FileText, FileDown, CheckCircle2, XCircle } from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request for Quotation (RFQ)</h1>
          <p className="text-sm text-gray-500 mt-1">Manage vendor bidding and quotations</p>
        </div>
        <button onClick={() => setShowRFQForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Create RFQ
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RFQ #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Linked PR</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quotes</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : rfqs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No RFQs found</td></tr>
            ) : rfqs.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="hover:bg-gray-50 bg-white">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">{r.rfqNumber}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{r.purchaseRequest?.prNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.deadline ? new Date(r.deadline).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.quotations?.length || 0}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'OPEN' && (
                       <button onClick={() => setShowQuoteForm(r.id)} className="text-blue-600 hover:text-blue-800 font-medium text-xs">
                          Add Quote
                       </button>
                    )}
                  </td>
                </tr>
                {r.quotations && r.quotations.length > 0 && (
                   <tr className="bg-gray-50/50">
                      <td colSpan={6} className="px-8 py-3">
                         <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                            <table className="w-full text-xs">
                               <thead className="bg-gray-100/50 text-gray-500">
                                  <tr>
                                     <th className="px-3 py-2 text-left font-medium">Vendor</th>
                                     <th className="px-3 py-2 text-left font-medium">Total Amount</th>
                                     <th className="px-3 py-2 text-left font-medium">Valid Until</th>
                                     <th className="px-3 py-2 text-left font-medium">Status</th>
                                     <th className="px-3 py-2 text-right font-medium">Action</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-gray-100">
                                  {r.quotations.map((q: any) => (
                                     <tr key={q.id}>
                                        <td className="px-3 py-2 font-medium text-gray-900">{q.vendor?.name}</td>
                                        <td className="px-3 py-2">₹{q.totalAmount.toLocaleString()}</td>
                                        <td className="px-3 py-2 text-gray-500">{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}</td>
                                        <td className="px-3 py-2">
                                           <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide
                                              ${q.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : 
                                                q.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                              {q.status}
                                           </span>
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                           {q.status === 'PENDING' && r.status === 'OPEN' && (
                                              <button onClick={() => convertToPO(q.id)} className="text-green-600 font-medium hover:underline">Accept & Create Purchase Order</button>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-semibold">Open New RFQ</h2></div>
            <form onSubmit={handleCreateRFQ} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Purchase Request (Optional)</label>
                <select value={rfqForm.purchaseRequestId} onChange={e => setRFQForm({...rfqForm, purchaseRequestId: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                   <option value="">-- No PR Linked --</option>
                   {prs.map(pr => <option key={pr.id} value={pr.id}>{pr.prNumber} ({pr.department})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                <input type="date" value={rfqForm.deadline} onChange={e => setRFQForm({...rfqForm, deadline: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={rfqForm.notes} onChange={e => setRFQForm({...rfqForm, notes: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={3}></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                 <button type="submit" className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-black">Create RFQ</button>
                 <button type="button" onClick={() => setShowRFQForm(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuoteForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl my-4">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-semibold">Log Vendor Quotation</h2></div>
            <form onSubmit={handleAddQuote} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                    <select required value={quoteForm.vendorId} onChange={e => setQuoteForm({...quoteForm, vendorId: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                       <option value="">Select Vendor...</option>
                       {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                    <input type="date" value={quoteForm.validUntil} onChange={e => setQuoteForm({...quoteForm, validUntil: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                 </div>
              </div>
              <div>
                 <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Quoted Items *</label>
                    <button type="button" onClick={() => setQuoteForm({...quoteForm, items: [...quoteForm.items, { itemName: "", quantity: "1", unit: "pcs", quotedRate: "0", notes: "" }]})} className="text-xs text-blue-600">+ Add Item</button>
                 </div>
                 {quoteForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                       <input required placeholder="Item Name" value={item.itemName} onChange={e => { const items = [...quoteForm.items]; items[idx].itemName = e.target.value; setQuoteForm({...quoteForm, items}); }} className="flex-1 border rounded px-2 py-1 text-sm" />
                       <input required type="number" placeholder="Qty" value={item.quantity} onChange={e => { const items = [...quoteForm.items]; items[idx].quantity = e.target.value; setQuoteForm({...quoteForm, items}); }} className="w-20 border rounded px-2 py-1 text-sm" />
                       <input required type="number" placeholder="Rate" value={item.quotedRate} onChange={e => { const items = [...quoteForm.items]; items[idx].quotedRate = e.target.value; setQuoteForm({...quoteForm, items}); }} className="w-24 border rounded px-2 py-1 text-sm" />
                    </div>
                 ))}
              </div>
              <div className="flex gap-3 pt-4">
                 <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Submit Quote</button>
                 <button type="button" onClick={() => setShowQuoteForm(null)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
