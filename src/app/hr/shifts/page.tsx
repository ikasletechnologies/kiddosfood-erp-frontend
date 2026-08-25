"use client";

import { useState, useEffect } from "react";
import { Plus, Clock } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [shiftForm, setShiftForm] = useState({ name: "", startTime: "", endTime: "" });
  const [assignForm, setAssignForm] = useState({ employeeId: "", shiftId: "", date: "" });

  async function loadData() {
    setLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([
        api.get("/api/shifts"),
        api.get("/api/employees")
      ]);
      setShifts(sRes.data);
      setEmployees(eRes.data);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreateShift(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/shifts", shiftForm);
      setShowShiftForm(false);
      setShiftForm({ name: "", startTime: "", endTime: "" });
      loadData();
    } catch {}
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/shifts/assign", assignForm);
      setShowAssignForm(false);
      setAssignForm({ employeeId: "", shiftId: "", date: "" });
      loadData();
    } catch {}
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create shifts and assign employees</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAssignForm(true)} className="border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Assign Shift</button>
          <button onClick={() => setShowShiftForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> New Shift
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-8 text-gray-400">Loading...</div>
        ) : shifts.length === 0 ? (
          <div className="col-span-3 text-center py-8 text-gray-400">No shifts created yet</div>
        ) : shifts.map((shift) => (
          <div key={shift.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{shift.name}</div>
                <div className="text-sm text-gray-500 mt-1">{shift.startTime} – {shift.endTime}</div>
                <div className="text-xs text-gray-400 mt-1">{shift.employees?.length || 0} assignments</div>
              </div>
            </div>
            {shift.employees?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <div className="text-xs text-gray-500 mb-2">Recent Assignments</div>
                {shift.employees.slice(0, 3).map((es: any) => (
                  <div key={es.id} className="text-xs text-gray-600 py-0.5">
                    {es.employee?.user?.fullName} — {formatDate(es.date)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showShiftForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100"><h2 className="text-lg font-semibold">Create Shift</h2></div>
            <form onSubmit={handleCreateShift} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift Name *</label>
                <input required placeholder="e.g. Morning Shift" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                  <input required type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                  <input required type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create</button>
                <button type="button" onClick={() => setShowShiftForm(false)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-100"><h2 className="text-lg font-semibold">Assign Shift</h2></div>
            <form onSubmit={handleAssign} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select required value={assignForm.employeeId} onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select employee...</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.user.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift *</label>
                <select required value={assignForm.shiftId} onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select shift...</option>
                  {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input required type="date" min={new Date().toISOString().split("T")[0]} value={assignForm.date} onChange={(e) => setAssignForm({ ...assignForm, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Assign</button>
                <button type="button" onClick={() => setShowAssignForm(false)} className="flex-1 border border-gray-200 py-2 rounded-lg text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
