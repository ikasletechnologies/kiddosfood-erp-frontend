"use client";

import { useState, useEffect } from "react";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Building2, 
  Activity,
  ChevronLeft,
  ChevronRight,
  Info
} from "lucide-react";
import { auditApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  createdAt: string;
  user: { fullName: string, role: string };
  franchise?: { name: string };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
    startDate: "",
    endDate: ""
  });

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await auditApi.getLogs(filters);
      setLogs(res.data);
    } catch (error) {
      toast.error("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes("CREATE")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    if (action.includes("UPDATE")) return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
    if (action.includes("DELETE")) return "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";
    if (action.includes("LOGIN")) return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    return "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400";
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-4 md:p-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-orange-500" size={28} />
            Audit Logs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor system activities and user actions across the platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchLogs}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all active:scale-95"
          >
            Refresh Logs
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-6 shadow-sm flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Search Action</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="e.g. UPDATE_STOCK"
              value={filters.action}
              onChange={e => setFilters({...filters, action: e.target.value})}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-sm font-medium"
            />
          </div>
        </div>
        
        <div className="space-y-1.5 w-48">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Start Date</label>
          <input 
            type="date" 
            value={filters.startDate}
            onChange={e => setFilters({...filters, startDate: e.target.value})}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-sm font-medium"
          />
        </div>

        <div className="space-y-1.5 w-48">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">End Date</label>
          <input 
            type="date" 
            value={filters.endDate}
            onChange={e => setFilters({...filters, endDate: e.target.value})}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 text-sm font-medium"
          />
        </div>

        <button 
          onClick={fetchLogs}
          className="bg-slate-900 dark:bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95"
        >
          Apply Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-wider text-slate-500">Activity & Time</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-wider text-slate-500">User Details</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-wider text-slate-500">Target Franchise</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-wider text-slate-500">Entity Info</th>
                <th className="px-6 py-5 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-6"><div className="h-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl w-full" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <Activity size={48} />
                      <p className="text-sm font-black uppercase tracking-widest">No activity logs found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <span className={`w-fit px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${getActionColor(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                          <Calendar size={12} />
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold shrink-0">
                          {log.user?.fullName?.[0] || 'S'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">{log.user?.fullName || 'System User'}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{log.user?.role || 'ADMIN'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                        <Building2 size={14} className="text-slate-400" />
                        {log.franchise?.name || 'Global HQ'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.entityType || 'SYSTEM'}</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">ID: {log.entityId?.slice(0, 8) || 'N/A'}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button className="p-2 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl text-slate-400 hover:text-orange-500 transition-all">
                        <Info size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
