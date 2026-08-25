"use client";

import { useState, useEffect } from "react";
import { Plus, Search, FileText, CheckCircle2, XCircle, X } from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-end">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> New PR
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="">All Status</option>
          {["DRAFT","PENDING_APPROVAL","APPROVED","REJECTED"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">PR #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Dept</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Requester</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No Purchase Requests found</td></tr>
            ) : requests.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">
                   <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      {r.prNumber}
                   </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-700">{r.department}</td>
                <td className="px-4 py-3 text-gray-600">{r.requestedBy || 'System'}</td>
                <td className="px-4 py-3">
                   <div className="text-gray-900 font-medium">{r.items?.length || 0} items</div>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>{r.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === "PENDING_APPROVAL" && (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => updateStatus(r.id, "APPROVED")} className="text-green-600 hover:bg-green-50 p-1 rounded transition-colors" title="Approve">
                         <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => updateStatus(r.id, "REJECTED")} className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors" title="Reject">
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

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl my-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
               <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  New Purchase Request
               </h2>
               <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white transition-colors">
                    <option value="KITCHEN">Kitchen</option>
                    <option value="FRONT_DESK">Front Desk</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="HR">HR</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority Notes</label>
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Urgent, requires approval today" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white transition-colors" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                  <label className="text-sm font-semibold text-gray-900">Requested Items</label>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 text-blue-600 text-xs font-medium hover:text-blue-700 bg-blue-50 px-2 py-1 rounded">
                     <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {form.items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                      <div className="flex-1">
                         <select required value={item.inventoryItemId} onChange={(e) => updateItem(i, "inventoryItemId", e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm">
                            <option value="">Select Material...</option>
                            {inventory.map((inv: any) => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
                         </select>
                      </div>
                      <div className="w-24">
                         <input type="number" placeholder="Qty" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm" required />
                      </div>
                      <div className="w-20">
                         <input placeholder="Unit" value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm" />
                      </div>
                      <div className="flex-1">
                         <input placeholder="Purpose / Notes" value={item.notes} onChange={(e) => updateItem(i, "notes", e.target.value)} className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm" />
                      </div>
                      {form.items.length > 1 && (
                         <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded mt-0.5">
                            <XCircle className="w-4 h-4" />
                         </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="submit" className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-black transition-colors">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
