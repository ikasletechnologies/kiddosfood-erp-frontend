"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Clock, LogIn, LogOut, Search } from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

export default function AttendancePage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [todayLogs, setTodayLogs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const [eRes, aRes] = await Promise.all([
        api.get("/api/employees"),
        api.get("/api/attendance", { params: { startDate: todayStr, endDate: todayStr } }),
      ]);
      setEmployees(eRes.data || []);
      const byEmployee: Record<string, any> = {};
      (aRes.data || []).forEach((log: any) => { byEmployee[log.employeeId] = log; });
      setTodayLogs(byEmployee);
    } catch {
      toast.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleClockIn = async (employeeId: string) => {
    setActing(employeeId);
    try {
      await api.post(`/api/employees/${employeeId}/clock-in`);
      toast.success("Clocked in");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to clock in");
    } finally {
      setActing(null);
    }
  };

  const handleClockOut = async (employeeId: string) => {
    setActing(employeeId);
    try {
      await api.post(`/api/employees/${employeeId}/clock-out`);
      toast.success("Clocked out");
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to clock out");
    } finally {
      setActing(null);
    }
  };

  const filtered = employees.filter((e) =>
    (e.user?.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.employeeCode || "").toLowerCase().includes(search.toLowerCase())
  );

  const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="p-6 space-y-6 text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-end">
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none focus:border-[#f58220]"
          />
          {search && (
            <X 
              size={14} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
              onClick={() => setSearch("")} 
            />
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
            <tr>
              {["Employee", "Clock In", "Clock Out", "Action"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No employees found</td></tr>
            ) : filtered.map((emp) => {
              const log = todayLogs[emp.id];
              return (
                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{emp.user?.fullName}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{emp.employeeCode}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{fmtTime(log?.clockIn) || "—"}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{fmtTime(log?.clockOut) || "—"}</td>
                  <td className="px-4 py-3">
                    {!log?.clockIn ? (
                      <button
                        onClick={() => handleClockIn(emp.id)}
                        disabled={acting === emp.id}
                        className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-600 disabled:opacity-60"
                      >
                        <LogIn className="w-3.5 h-3.5" /> Clock In
                      </button>
                    ) : !log?.clockOut ? (
                      <button
                        onClick={() => handleClockOut(emp.id)}
                        disabled={acting === emp.id}
                        className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-60"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Clock Out
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Day Complete</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
