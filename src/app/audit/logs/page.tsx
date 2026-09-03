"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Building2, 
  Activity,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  X,
  Eye,
  Copy,
  Check,
  AlertTriangle,
  Layers,
  ChevronDown,
  Clock,
  Key,
  FileText
} from "lucide-react";
import { auditApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";
import RequireSuperAdmin from "@/components/auth/RequireSuperAdmin";
import { formatDate } from "@/lib/utils";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  createdAt: string;
  user: { fullName: string; role: string };
  franchise?: { name: string };
}

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CREATE: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/20" },
  UPDATE: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-500/20" },
  DELETE: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20" },
  LOGIN: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" },
  LOGOUT: { bg: "bg-gray-100 dark:bg-white/5", text: "text-gray-700 dark:text-slate-400", border: "border-gray-200 dark:border-white/10" },
  APPROVE: { bg: "bg-indigo-50 dark:bg-indigo-500/10", text: "text-indigo-700 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-500/20" },
  REJECT: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20" },
};

function getActionStyle(action: string) {
  const act = (action || "").toUpperCase();
  for (const key of Object.keys(ACTION_COLORS)) {
    if (act.includes(key)) return ACTION_COLORS[key];
  }
  return { bg: "bg-gray-100 dark:bg-white/5", text: "text-gray-700 dark:text-slate-300", border: "border-gray-200 dark:border-white/10" };
}

const getDateRange = (preset: string, customStart: string, customEnd: string) => {
  const now = new Date();
  let from = new Date();
  let to = new Date();

  switch (preset) {
    case "Today":
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      break;
    case "Yesterday":
      from.setDate(now.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(now.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      break;
    case "Last 7 Days":
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      break;
    case "This Month":
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "This Year":
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case "Custom":
      if (customStart) {
        from = new Date(customStart);
        from.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        to = new Date(customEnd);
        to.setHours(23, 59, 59, 999);
      }
      break;
    default:
      from = new Date(2000, 0, 1, 0, 0, 0, 0);
      to = new Date(2099, 11, 31, 23, 59, 59, 999);
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [selectedEntity, setSelectedEntity] = useState("ALL");
  const [datePreset, setDatePreset] = useState("All Time");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Drawer inspection state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.getLogs();
      const raw = Array.isArray(res.data) ? res.data : res.data?.logs || [];
      setLogs(raw);
    } catch {
      toast.error("Failed to fetch audit activity logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Dynamic filter options based on real log records
  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.action) set.add(l.action.toUpperCase());
    });
    return Array.from(set).sort();
  }, [logs]);

  const uniqueEntities = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.entityType) set.add(l.entityType.toUpperCase());
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchAction = (log.action || "").toLowerCase().includes(q);
        const matchEntity = (log.entityType || "").toLowerCase().includes(q);
        const matchEntityId = (log.entityId || "").toLowerCase().includes(q);
        const matchUser = (log.user?.fullName || "").toLowerCase().includes(q);
        const matchFranchise = (log.franchise?.name || "").toLowerCase().includes(q);
        const matchDetails = (typeof log.details === "string" ? log.details : JSON.stringify(log.details || "")).toLowerCase().includes(q);

        if (!matchAction && !matchEntity && !matchEntityId && !matchUser && !matchFranchise && !matchDetails) {
          return false;
        }
      }

      // 2. Action Filter
      if (selectedAction !== "ALL" && (log.action || "").toUpperCase() !== selectedAction) {
        return false;
      }

      // 3. Entity Filter
      if (selectedEntity !== "ALL" && (log.entityType || "").toUpperCase() !== selectedEntity) {
        return false;
      }

      // 4. Date Preset Filter
      if (datePreset !== "All Time") {
        const { from, to } = getDateRange(datePreset, customStartDate, customEndDate);
        const logDate = new Date(log.createdAt).toISOString().split("T")[0];
        if (logDate < from || logDate > to) return false;
      }

      return true;
    });
  }, [logs, searchQuery, selectedAction, selectedEntity, datePreset, customStartDate, customEndDate]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const totalEvents = filteredLogs.length;
    const todayEvents = logs.filter(l => new Date(l.createdAt).toISOString().split("T")[0] === todayStr).length;

    const uniqueUsers = new Set(logs.map(l => l.userId || l.user?.fullName).filter(Boolean)).size;
    const highRiskEvents = logs.filter(l => {
      const act = (l.action || "").toUpperCase();
      return act.includes("DELETE") || act.includes("CANCEL") || act.includes("REJECT") || act.includes("PURGE");
    }).length;

    return { totalEvents, todayEvents, uniqueUsers, highRiskEvents };
  }, [logs, filteredLogs]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleExportCSV = () => {
    if (!filteredLogs.length) {
      toast.error("No audit logs to export");
      return;
    }

    const headers = ["Timestamp", "Action", "Actor Name", "Actor Role", "Entity Type", "Entity ID", "Franchise / Branch", "Details"];
    const rows = filteredLogs.map(l => [
      `"${new Date(l.createdAt).toLocaleString()}"`,
      `"${(l.action || "").replace(/"/g, '""')}"`,
      `"${(l.user?.fullName || "System User").replace(/"/g, '""')}"`,
      `"${(l.user?.role || "ADMIN").replace(/"/g, '""')}"`,
      `"${(l.entityType || "SYSTEM").replace(/"/g, '""')}"`,
      `"${(l.entityId || "N/A").replace(/"/g, '""')}"`,
      `"${(l.franchise?.name || "Global HQ").replace(/"/g, '""')}"`,
      `"${(typeof l.details === "string" ? l.details : JSON.stringify(l.details || "")).replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Audit_Logs_Security_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Audit activity report exported to CSV");
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedAction("ALL");
    setSelectedEntity("ALL");
    setDatePreset("All Time");
  };

  const hasActiveFilters = searchQuery || selectedAction !== "ALL" || selectedEntity !== "ALL" || datePreset !== "All Time";

  return (
    <RequireSuperAdmin>
      <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 w-full min-w-0 animate-in fade-in duration-300">

        {/* ── Top Header Toolbar ── */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs w-full min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                Audit &amp; Security Logs
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
                Real-time activity logs, authorization events, and entity state changes across the ERP
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between lg:justify-end min-w-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
              title="Export CSV"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
              title="Print Audit Report"
            >
              <Printer className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={fetchLogs}
              title="Refresh Logs"
              className="p-2 sm:p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={15} className={clsx(loading && "animate-spin text-indigo-600")} />
            </button>
          </div>
        </div>

        {/* ── KPI Investigation Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
          {/* Total Events */}
          <div
            onClick={() => setDatePreset("All Time")}
            className={clsx(
              "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs relative overflow-hidden",
              datePreset === "All Time"
                ? "bg-slate-900 text-white border-slate-800"
                : "bg-white dark:bg-card border-gray-200 dark:border-white/5 text-gray-900 dark:text-white hover:border-indigo-500/50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className={clsx("text-[11px] font-bold uppercase tracking-wider", datePreset === "All Time" ? "text-slate-400" : "text-gray-500 dark:text-slate-400")}>
                Total Events
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                <Activity size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight mt-2">
              {kpis.totalEvents}
            </p>
            <div className="flex items-center gap-1 mt-2 text-[11px] font-medium text-slate-400">
              <span>Matching active query</span>
            </div>
          </div>

          {/* Today's Events */}
          <div
            onClick={() => setDatePreset("Today")}
            className={clsx(
              "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs",
              datePreset === "Today"
                ? "bg-blue-600 text-white border-blue-700 shadow-blue-500/10"
                : "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30 hover:border-blue-400"
            )}
          >
            <div className="flex items-center justify-between">
              <span className={clsx("text-[11px] font-bold uppercase tracking-wider", datePreset === "Today" ? "text-white/80" : "text-blue-700 dark:text-blue-400")}>
                Today&apos;s Activity
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Calendar size={16} />
              </div>
            </div>
            <p className={clsx("text-xl sm:text-2xl font-bold font-mono tracking-tight mt-2", datePreset === "Today" ? "text-white" : "text-blue-600 dark:text-blue-400")}>
              {kpis.todayEvents}
            </p>
            <div className={clsx("flex items-center gap-1 mt-2 text-[11px] font-semibold", datePreset === "Today" ? "text-white/80" : "text-blue-600 dark:text-blue-400")}>
              <span>Logged today</span>
            </div>
          </div>

          {/* Active Actors */}
          <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Unique Actors
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <User size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold font-mono text-gray-900 dark:text-white tracking-tight mt-2">
              {kpis.uniqueUsers}
            </p>
            <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span>System operators &amp; admins</span>
            </div>
          </div>

          {/* High-Risk / Deletion Events */}
          <div className="bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/30 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                High-Risk Ops
              </span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertTriangle size={16} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tracking-tight mt-2">
              {kpis.highRiskEvents}
            </p>
            <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              <span>Deletes, cancellations &amp; voids</span>
            </div>
          </div>
        </div>

        {/* ── Multi-Dimensional Filters Bar ── */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 shadow-2xs space-y-3 w-full min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search user, action, entity ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:border-indigo-500"
              />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
              {searchQuery && (
                <X
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  onClick={() => setSearchQuery("")}
                />
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Action Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-indigo-500 max-w-[150px] truncate"
                >
                  <option value="ALL">All Actions</option>
                  {uniqueActions.map(act => (
                    <option key={act} value={act}>{act}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              </div>

              {/* Entity Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-indigo-500 max-w-[150px] truncate"
                >
                  <option value="ALL">All Entities</option>
                  {uniqueEntities.map(ent => (
                    <option key={ent} value={ent}>{ent}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              </div>

              {/* Date Presets Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-indigo-500"
                >
                  <option value="All Time">All Time</option>
                  <option value="Today">Today</option>
                  <option value="Yesterday">Yesterday</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="This Month">This Month</option>
                  <option value="This Year">This Year</option>
                  <option value="Custom">Custom Range</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              </div>

              {datePreset === "Custom" && (
                <div className="flex items-center gap-1.5 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 bg-gray-50 dark:bg-[#13151f] text-xs shrink-0">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
                  />
                  <span className="text-gray-400 dark:text-slate-500 text-xs">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Active Filter Indicators */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                Showing {filteredLogs.length} matching events
              </span>
              <button
                onClick={clearAllFilters}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold cursor-pointer select-none inline-flex items-center gap-1"
              >
                <X size={13} />
                <span>Clear All Filters</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Main Logs Display ── */}
        <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
          <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
              Activity History Stream ({filteredLogs.length})
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 animate-pulse">Loading audit logs...</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center p-6">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600">
                <Activity size={28} />
              </div>
              <div>
                <p className="text-gray-800 dark:text-white font-bold text-sm">No audit logs found</p>
                <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">Try changing your search query, action type, or date range.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto custom-scrollbar w-full max-w-full">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-gray-50/75 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-gray-200 dark:border-white/5">
                      <th className="px-4 sm:px-6 py-3">Timestamp</th>
                      <th className="px-4 sm:px-6 py-3">Action</th>
                      <th className="px-4 sm:px-6 py-3">Actor / User</th>
                      <th className="px-4 sm:px-6 py-3">Entity &amp; Reference</th>
                      <th className="px-4 sm:px-6 py-3">Franchise / Branch</th>
                      <th className="px-4 sm:px-6 py-3 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                    {filteredLogs.map(log => {
                      const actStyle = getActionStyle(log.action);
                      return (
                        <tr key={log.id} className="hover:bg-indigo-50/20 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                            <p className="font-semibold text-gray-900 dark:text-white">{formatDate(log.createdAt)}</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono mt-0.5">
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </p>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5">
                            <span className={clsx("inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", actStyle.bg, actStyle.text, actStyle.border)}>
                              {log.action?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                                {log.user?.fullName?.[0] || "U"}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">{log.user?.fullName || "System User"}</p>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">{log.user?.role || "ADMIN"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-[10px] font-bold uppercase text-gray-700 dark:text-slate-300">
                                {log.entityType || "SYSTEM"}
                              </span>
                              {log.entityId && (
                                <span className="font-mono text-[10px] text-gray-500 dark:text-slate-400 truncate max-w-[120px]" title={log.entityId}>
                                  {log.entityId.length > 12 ? `${log.entityId.slice(0, 10)}…` : log.entityId}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5">
                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-300">
                              <Building2 size={13} className="text-gray-400 shrink-0" />
                              <span className="truncate max-w-[130px]">{log.franchise?.name || "Global HQ"}</span>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="px-2.5 py-1 bg-white dark:bg-card border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-200 hover:bg-gray-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (< 768px) */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
                {filteredLogs.map(log => {
                  const actStyle = getActionStyle(log.action);
                  return (
                    <div key={log.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={clsx("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", actStyle.bg, actStyle.text, actStyle.border)}>
                            {log.action?.replace(/_/g, " ")}
                          </span>
                          <p className="font-bold text-gray-900 dark:text-white text-xs mt-1">
                            {log.user?.fullName || "System User"} ({log.user?.role || "ADMIN"})
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-gray-500 font-mono">{formatDate(log.createdAt)}</p>
                          <p className="text-[9px] text-gray-400 font-mono">{new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs bg-gray-50 dark:bg-white/[0.02] p-2.5 rounded-xl">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-400">Target Entity</span>
                          <p className="font-bold text-gray-800 dark:text-white mt-0.5">{log.entityType || "SYSTEM"}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] uppercase font-bold text-gray-400">Entity ID</span>
                          <p className="font-mono text-[10px] text-gray-500 mt-0.5 truncate max-w-[120px]">
                            {log.entityId || "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Building2 size={12} />
                          {log.franchise?.name || "Global HQ"}
                        </span>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Inspect Event
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Event Inspection Drawer / Modal ── */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => setSelectedLog(null)} />
            <div className="relative w-full max-w-xl bg-white dark:bg-card shadow-2xl h-full flex flex-col border-l border-gray-200 dark:border-white/10 animate-in slide-in-from-right duration-300">
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/[0.01]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Audit Event Inspection</h2>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">{selectedLog.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar text-xs">
                {/* Event Summary */}
                <div className="bg-gray-50 dark:bg-white/[0.02] p-4 rounded-xl border border-gray-100 dark:border-white/5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Action:</span>
                    <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase", getActionStyle(selectedLog.action).bg, getActionStyle(selectedLog.action).text)}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Timestamp:</span>
                    <span className="font-mono font-semibold text-gray-800 dark:text-white">
                      {new Date(selectedLog.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Actor / User:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {selectedLog.user?.fullName || "System User"} ({selectedLog.user?.role || "ADMIN"})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Location / Franchise:</span>
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {selectedLog.franchise?.name || "Global HQ"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Entity Type:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{selectedLog.entityType || "SYSTEM"}</span>
                  </div>
                  {selectedLog.entityId && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Entity ID:</span>
                      <button
                        onClick={() => handleCopy(selectedLog.entityId, "Entity ID")}
                        className="font-mono font-bold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <span>{selectedLog.entityId}</span>
                        {copiedField === "Entity ID" ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Structured Changes / Details */}
                {selectedLog.details && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Event Details &amp; Changes</span>
                      <button
                        onClick={() => setShowRawJson(!showRawJson)}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {showRawJson ? "Show Structured View" : "Show Raw JSON"}
                      </button>
                    </div>

                    {showRawJson ? (
                      <div className="relative">
                        <pre className="p-3 bg-gray-900 text-gray-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 custom-scrollbar">
                          {typeof selectedLog.details === "string"
                            ? selectedLog.details
                            : JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                        <button
                          onClick={() => handleCopy(typeof selectedLog.details === "string" ? selectedLog.details : JSON.stringify(selectedLog.details, null, 2), "JSON")}
                          className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs"
                          title="Copy JSON"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl space-y-2">
                        {typeof selectedLog.details === "object" && selectedLog.details !== null ? (
                          Object.entries(selectedLog.details).map(([key, val]) => (
                            <div key={key} className="flex justify-between items-start text-xs border-b border-gray-100 dark:border-white/5 pb-1.5 last:border-0 last:pb-0">
                              <span className="text-gray-400 font-semibold">{key}:</span>
                              <span className="font-mono font-medium text-gray-800 dark:text-slate-200 text-right max-w-[240px] break-words">
                                {typeof val === "object" ? JSON.stringify(val) : String(val)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-700 dark:text-slate-300 font-medium">
                            {String(selectedLog.details)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-end bg-gray-50/50 dark:bg-white/[0.01]">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireSuperAdmin>
  );
}
