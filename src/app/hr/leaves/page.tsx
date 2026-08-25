"use client";

import { useState, useEffect } from "react";
import { Plus, Check, X, Calendar } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

interface Leave {
  id: string;
  days: number;
  reason: string;
  startDate: string;
  endDate: string;
  status: string;
  employee: { user: { fullName: string }; employeeCode: string };
  leaveType: { name: string; isPaid: boolean };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600"
};

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [form, setForm] = useState({ employeeId: "", leaveTypeId: "", startDate: "", endDate: "", days: "1", reason: "" });
  const [typeForm, setTypeForm] = useState({ name: "", maxDays: "15", isPaid: true });
  const [balances, setBalances] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const [lRes, ltRes, empRes] = await Promise.all([
        api.get("/api/leaves", { params: { status: statusFilter } }),
        api.get("/api/leave-types"),
        api.get("/api/employees")
      ]);
      setLeaves(lRes.data);
      setLeaveTypes(ltRes.data);
      setEmployees(empRes.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [statusFilter]);

  useEffect(() => {
    if (!form.employeeId) { setBalances([]); return; }
    api.get(`/api/employees/${form.employeeId}/leave-balances`)
      .then((res) => setBalances(res.data || []))
      .catch(() => setBalances([]));
  }, [form.employeeId]);

  const selectedBalance = balances.find((b) => b.leaveTypeId === form.leaveTypeId);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/leaves", { ...form, days: Number(form.days) });
      setShowForm(false);
      setForm({ employeeId: "", leaveTypeId: "", startDate: "", endDate: "", days: "1", reason: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to apply leave");
    }
  }

  async function handleApprove(id: string, status: "APPROVED" | "REJECTED") {
    try {
      await api.patch(`/api/leaves/${id}/approve`, { status });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update leave status");
    }
  }

  async function handleCreateType(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/leave-types", { ...typeForm, maxDays: Number(typeForm.maxDays) });
      setShowTypeForm(false);
      setTypeForm({ name: "", maxDays: "15", isPaid: true });
      loadData();
    } catch {}
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage employee leave requests</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTypeForm(true)} className="border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Leave Types</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Apply Leave
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["PENDING","APPROVED","REJECTED","CANCELLED"].map(s => (
          <div key={s} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{leaves.filter(l => l.status === s).length}</div>
            <div className="text-xs text-gray-500 mt-1">{s}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Employee","Leave Type","Duration","Days","Reason","Status","Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : leaves.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No leave requests</td></tr>
            ) : leaves.map((leave) => (
              <tr key={leave.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{leave.employee.user.fullName}</div>
                  <div className="text-xs text-gray-400">{leave.employee.employeeCode}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-700">{leave.leaveType.name}</span>
                  <span className={`ml-1 text-xs ${leave.leaveType.isPaid ? "text-green-600" : "text-gray-400"}`}>({leave.leaveType.isPaid ? "Paid" : "Unpaid"})</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                </td>
                <td className="px-4 py-3 font-medium text-gray-700">{leave.days}d</td>
                <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{leave.reason}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[leave.status] || ""}`}>{leave.status}</span>
                </td>
                <td className="px-4 py-3">
                  {leave.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(leave.id, "APPROVED")} className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleApprove(leave.id, "REJECTED")} className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100">
                        <X className="w-3 h-3" />
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-semibold">Apply Leave</h2></div>
            <form onSubmit={handleApply} className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Employee *</label>
                  <Link href="/hr/employees" className="text-xs text-blue-600 hover:underline">Manage employees</Link>
                </div>
                <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select employee...</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.user.fullName} ({e.employeeCode})</option>)}
                </select>
                {form.employeeId && (
                  <p className="mt-1.5 text-xs text-blue-600 font-bold uppercase tracking-tight">
                    Applying for: {employees.find(e => e.id === form.employeeId)?.user.fullName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                <select required value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select type...</option>
                  {leaveTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name} (max {t.maxDays}d)</option>)}
                </select>
                {selectedBalance && (
                  <p className={`mt-1.5 text-xs font-semibold ${selectedBalance.remaining <= 0 ? "text-red-600" : "text-gray-500"}`}>
                    {selectedBalance.remaining} of {selectedBalance.allocated} day(s) remaining in {selectedBalance.year}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From *</label>
                  <input required type="date" value={form.startDate} min={new Date().toISOString().split("T")[0]} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To *</label>
                  <input required type="date" value={form.endDate} min={form.startDate || new Date().toISOString().split("T")[0]} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days *</label>
                <input required type="number" min="1" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Submit</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTypeForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Leave Types</h2>
            </div>
            <div className="p-5 space-y-3">
              {leaveTypes.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm font-medium text-gray-700">{t.name}</span>
                  <span className="text-xs text-gray-400">{t.maxDays}d • {t.isPaid ? "Paid" : "Unpaid"}</span>
                </div>
              ))}
              <form onSubmit={handleCreateType} className="pt-3 space-y-3">
                <input required placeholder="Leave type name" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input required type="number" placeholder="Max days" value={typeForm.maxDays} onChange={(e) => setTypeForm({ ...typeForm, maxDays: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={typeForm.isPaid} onChange={(e) => setTypeForm({ ...typeForm, isPaid: e.target.checked })} />
                  Paid leave
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium">Add</button>
                  <button type="button" onClick={() => setShowTypeForm(false)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm font-medium">Close</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
