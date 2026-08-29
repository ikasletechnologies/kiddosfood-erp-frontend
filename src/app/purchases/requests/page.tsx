"use client";

import { useState, useEffect } from "react";
import { Plus, Search, FileText, CheckCircle2, XCircle, X } from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700"
};

export default function PurchaseRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    department: "KITCHEN",
    notes: "",
    items: [{ inventoryItemId: "", quantity: "1", unit: "pcs", notes: "" }]
  });

  async function loadData() {
    setLoading(true);
    try {
      const [rRes, iRes] = await Promise.all([
        api.get("/api/purchase-requests", { params: { search, status: statusFilter } }),
        api.get("/api/inventory")
      ]);
      setRequests(rRes.data);
      setInventory(iRes.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [search, statusFilter]);

  function addItem() { setForm({ ...form, items: [...form.items, { inventoryItemId: "", quantity: "1", unit: "pcs", notes: "" }] }); }
  function removeItem(i: number) { setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) }); }
  function updateItem(i: number, field: string, value: string) {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/purchase-requests", {
        ...form,
        items: form.items.map(i => ({ inventoryItemId: i.inventoryItemId, quantity: Number(i.quantity), unit: i.unit, notes: i.notes }))
      });
      setShowForm(false);
      setForm({ department: "KITCHEN", notes: "", items: [{ inventoryItemId: "", quantity: "1", unit: "pcs", notes: "" }] });
      loadData();
    } catch (e: any) { toast.error(e.response?.data?.error || "Error creating PR") }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch(`/api/purchase-requests/${id}/status`, { status });
      loadData();
    } catch {}
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 min-h-screen">
      <div className="flex items-center justify-end">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> New PR
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests..." className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none focus:border-[#f58220]" />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-slate-200 outline-none">
          <option value="" className="dark:bg-card">All Status</option>
          {["DRAFT","PENDING_APPROVAL","APPROVED","REJECTED"].map(s => <option key={s} value={s} className="dark:bg-card">{s.replace("_", " ")}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden w-full min-w-0">
        <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
          <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">PR #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Dept</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Requester</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No Purchase Requests found</td></tr>
            ) : requests.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">
                   <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                      {r.prNumber}
                   </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-700 dark:text-slate-200">{r.department}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{r.requestedBy || 'System'}</td>
                <td className="px-4 py-3">
                   <div className="text-gray-900 dark:text-white font-medium">{r.items?.length || 0} items</div>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>{r.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === "PENDING_APPROVAL" && (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => updateStatus(r.id, "APPROVED")} className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 p-1 rounded transition-colors" title="Approve">
                         <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => updateStatus(r.id, "REJECTED")} className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 p-1 rounded transition-colors" title="Reject">
                         <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-xl my-4 text-gray-800 dark:text-slate-100">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
               <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                  <FileText className="w-5 h-5 text-[#f58220]" />
                  New Purchase Request
               </h2>
               <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Department</label>
                  <select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-[#13151f] text-gray-800 dark:text-white focus:bg-white transition-colors outline-none">
                    <option value="KITCHEN" className="dark:bg-card">Kitchen</option>
                    <option value="FRONT_DESK" className="dark:bg-card">Front Desk</option>
                    <option value="MAINTENANCE" className="dark:bg-card">Maintenance</option>
                    <option value="HR" className="dark:bg-card">HR</option>
                    <option value="OTHER" className="dark:bg-card">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Priority Notes</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Urgent, requires approval today" className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-[#13151f] text-gray-800 dark:text-white focus:bg-white transition-colors outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-white/5 pb-2">
                  <label className="text-sm font-semibold text-gray-900 dark:text-white">Requested Items</label>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 text-[#f58220] text-xs font-medium hover:text-[#e8740e] bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 rounded cursor-pointer">
                     <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {form.items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start bg-gray-50/50 dark:bg-white/[0.02] p-2.5 rounded-lg border border-gray-100 dark:border-white/5">
                      <div className="flex-1">
                         <select required value={item.inventoryItemId} onChange={(e) => updateItem(i, "inventoryItemId", e.target.value)} className="w-full border border-gray-200 dark:border-white/10 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none">
                            <option value="" className="dark:bg-card">Select Material...</option>
                            {inventory.map((inv: any) => <option key={inv.id} value={inv.id} className="dark:bg-card">{inv.name}</option>)}
                         </select>
                      </div>
                      <div className="w-24">
                         <input type="number" placeholder="Qty" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="w-full border border-gray-200 dark:border-white/10 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none" required />
                      </div>
                      <div className="w-20">
                         <input placeholder="Unit" value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="w-full border border-gray-200 dark:border-white/10 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none" />
                      </div>
                      <div className="flex-1">
                         <input placeholder="Purpose / Notes" value={item.notes} onChange={(e) => updateItem(i, "notes", e.target.value)} className="w-full border border-gray-200 dark:border-white/10 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500" />
                      </div>
                      {form.items.length > 1 && (
                         <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 rounded mt-0.5 cursor-pointer">
                            <XCircle className="w-4 h-4" />
                         </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                <button type="submit" className="flex-1 bg-[#f58220] hover:bg-[#e8740e] text-white py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
