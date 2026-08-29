"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { inventoryApi } from "@/lib/api";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ShoppingCart,
  Package,
  X,
  Filter,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  Clock,
  ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";

type AlertType = "inventory" | "order" | "payment" | "dispatch" | "system";
type AlertSeverity = "critical" | "warning" | "info" | "success";

interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
}

const TYPE_CONFIG: Record<AlertType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  inventory: { label: "Inventory", icon: Package,      color: "text-[#F58220]",  bg: "bg-orange-50 dark:bg-orange-950/30",  border: "border-orange-200/60 dark:border-orange-500/20" },
  order:     { label: "Order",     icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200/60 dark:border-emerald-500/20" },
  payment:   { label: "Payment",   icon: Shield,       color: "text-purple-600",  bg: "bg-purple-50 dark:bg-purple-950/30",  border: "border-purple-200/60 dark:border-purple-500/20" },
  dispatch:  { label: "Dispatch",  icon: TrendingUp,   color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200/60 dark:border-blue-500/20" },
  system:    { label: "System",    icon: RefreshCw,    color: "text-slate-600",   bg: "bg-slate-50 dark:bg-white/5",         border: "border-slate-200 dark:border-white/10" },
};

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  critical: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-500/20",
  warning:  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-500/20",
  info:     "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-500/20",
  success:  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-500/20",
};

function mapApiAlerts(apiItems: any[]): Alert[] {
  return apiItems.map((item: any, i: number) => ({
    id: item.id ?? String(i),
    type: "inventory" as AlertType,
    severity: item.currentStock === 0 ? "critical" : "warning",
    title: item.currentStock === 0
      ? `Critical: ${item.name} Out of Stock`
      : `Low Stock: ${item.name}`,
    message: `${item.name} has ${item.currentStock} ${item.unit ?? "units"} remaining. Minimum threshold: ${item.minStockLevel ?? item.reorderPoint ?? "N/A"}.`,
    time: "Just now",
    read: false,
    actionLabel: "Reorder",
    actionHref: "/purchases/new",
  }));
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filterType, setFilterType] = useState<"all" | AlertType>("all");
  const [filterSeverity, setFilterSeverity] = useState<"all" | AlertSeverity>("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAlerts = () => {
    setIsRefreshing(true);
    inventoryApi.getAlerts()
      .then((res) => {
        const mapped = mapApiAlerts(res.data ?? []);
        setAlerts(mapped);
      })
      .catch(() => {})
      .finally(() => setIsRefreshing(false));
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const filtered = alerts.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
    if (showUnreadOnly && a.read) return false;
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.read).length;
  const criticalCount = alerts.filter((a) => a.severity === "critical" && !a.read).length;
  const inventoryCount = alerts.filter((a) => a.type === "inventory").length;
  const orderCount = alerts.filter((a) => a.type === "order").length;

  const markRead = (id: string) => setAlerts((p) => p.map((a) => a.id === id ? { ...a, read: true } : a));
  const markAllRead = () => setAlerts((p) => p.map((a) => ({ ...a, read: true })));
  const dismiss = (id: string) => setAlerts((p) => p.filter((a) => a.id !== id));

  return (
    <div className="min-h-full space-y-6 animate-in fade-in duration-200">
      {/* ── 1. TOP ACTION TOOLBAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAlerts}
            className="p-1.5 px-2.5 sm:px-3 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0"
            title="Refresh alerts"
          >
            <RefreshCw
              size={13}
              className={clsx("transition-transform shrink-0", isRefreshing && "animate-spin text-[#F58220]")}
            />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="px-2.5 sm:px-3 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm hover:border-[#F58220] transition-all flex items-center gap-1.5 shrink-0"
            >
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>Mark All Read</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>Live Monitoring</span>
          </div>
        </div>
      </div>

      {/* ── 2. STATS CARDS (Matching Dashboard KPI Design) ── */}
      <div className="space-y-2">
        <h2 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          ALERT SUMMARY
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Card 1: Unread */}
          <div className="bg-white dark:bg-[#12141c] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between min-h-[125px] sm:min-h-[135px] w-full min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 bg-orange-50 text-[#F58220] border-orange-200/60 dark:bg-orange-950/30 dark:border-orange-500/20">
                <Bell size={16} strokeWidth={2.2} />
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex-1 min-w-0">
                UNREAD ALERTS
              </p>
            </div>
            <div className="my-2 sm:my-2.5 min-w-0">
              <h3 className="text-xl xs:text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {unreadCount}
              </h3>
            </div>
            <div className="min-h-[18px] min-w-0">
              {unreadCount > 0 && (
                <p className="text-[11px] sm:text-xs font-medium text-[#F58220] truncate">
                  Requires owner attention
                </p>
              )}
            </div>
          </div>

          {/* Card 2: Critical */}
          <div className="bg-white dark:bg-[#12141c] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between min-h-[125px] sm:min-h-[135px] w-full min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 bg-rose-50 text-rose-600 border-rose-200/60 dark:bg-rose-950/30 dark:border-rose-500/20">
                <AlertTriangle size={16} strokeWidth={2.2} />
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex-1 min-w-0">
                CRITICAL ISSUES
              </p>
            </div>
            <div className="my-2 sm:my-2.5 min-w-0">
              <h3 className="text-xl xs:text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {criticalCount}
              </h3>
            </div>
            <div className="min-h-[18px] min-w-0">
              {criticalCount > 0 && (
                <p className="text-[11px] sm:text-xs font-medium text-rose-600 truncate">
                  Immediate action required
                </p>
              )}
            </div>
          </div>

          {/* Card 3: Inventory */}
          <div className="bg-white dark:bg-[#12141c] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between min-h-[125px] sm:min-h-[135px] w-full min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 bg-blue-50 text-blue-600 border-blue-200/60 dark:bg-blue-950/30 dark:border-blue-500/20">
                <Package size={16} strokeWidth={2.2} />
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex-1 min-w-0">
                INVENTORY ALERTS
              </p>
            </div>
            <div className="my-2 sm:my-2.5 min-w-0">
              <h3 className="text-xl xs:text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {inventoryCount}
              </h3>
            </div>
            <div className="min-h-[18px] min-w-0">
              {inventoryCount > 0 && (
                <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                  Low stock / reorder triggers
                </p>
              )}
            </div>
          </div>

          {/* Card 4: Orders */}
          <div className="bg-white dark:bg-[#12141c] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between min-h-[125px] sm:min-h-[135px] w-full min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-500/20">
                <ShoppingCart size={16} strokeWidth={2.2} />
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex-1 min-w-0">
                ORDER ALERTS
              </p>
            </div>
            <div className="my-2 sm:my-2.5 min-w-0">
              <h3 className="text-xl xs:text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {orderCount}
              </h3>
            </div>
            <div className="min-h-[18px] min-w-0">
              {orderCount > 0 && (
                <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                  Pending dispatch approvals
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. FILTER BAR (Dashboard Segmented Style) ── */}
      <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-white/10 p-3 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-2 w-full lg:w-auto min-w-0">
          {/* Type filters with isolated horizontal scroll */}
          <div className="overflow-x-auto custom-scrollbar w-full sm:w-auto max-w-full pb-1 sm:pb-0">
            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/60 dark:border-white/5 gap-0.5 shrink-0 min-w-full sm:min-w-0">
              {(["all", "inventory", "order", "payment", "dispatch", "system"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterType(t)}
                  className={clsx(
                    "px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold capitalize transition-all select-none whitespace-nowrap shrink-0",
                    filterType === t
                      ? "bg-white dark:bg-slate-800 text-[#F58220] shadow-sm border border-slate-200 dark:border-white/10 font-black"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  )}
                >
                  {t === "all" ? "All Types" : TYPE_CONFIG[t as AlertType]?.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-white/10 shrink-0" />

          {/* Severity filters with isolated horizontal scroll */}
          <div className="overflow-x-auto custom-scrollbar w-full sm:w-auto max-w-full pb-1 sm:pb-0">
            <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/60 dark:border-white/5 gap-0.5 shrink-0 min-w-full sm:min-w-0">
              {(["all", "critical", "warning", "info", "success"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterSeverity(s)}
                  className={clsx(
                    "px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold capitalize transition-all select-none whitespace-nowrap shrink-0",
                    filterSeverity === s
                      ? "bg-white dark:bg-slate-800 text-[#F58220] shadow-sm border border-slate-200 dark:border-white/10 font-black"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  )}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Unread Filter Button */}
        <button
          type="button"
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          className={clsx(
            "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 w-full sm:w-auto",
            showUnreadOnly
              ? "bg-[#F58220] text-white border-[#F58220]"
              : "bg-white dark:bg-[#12141c] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-slate-300"
          )}
        >
          {showUnreadOnly ? <EyeOff size={13} className="shrink-0" /> : <Eye size={13} className="shrink-0" />}
          <span>{showUnreadOnly ? "Showing Unread" : "Unread Only"}</span>
        </button>
      </div>

      {/* ── 4. ALERT LIST (Clean Invoice/Dashboard Style Cards) ── */}
      <div className="space-y-3 w-full min-w-0">
        {filtered.map((alert) => {
          const typeConf = TYPE_CONFIG[alert.type] || TYPE_CONFIG.system;
          const Icon = typeConf.icon;

          return (
            <div
              key={alert.id}
              className={clsx(
                "bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-white/10 p-3.5 sm:p-4 shadow-sm hover:border-slate-300 dark:hover:border-white/20 transition-all flex items-start gap-3 sm:gap-4 w-full min-w-0",
                !alert.read && "ring-1 ring-[#F58220]/20"
              )}
            >
              {/* Type Icon */}
              <div
                className={clsx(
                  "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border",
                  typeConf.bg,
                  typeConf.color,
                  typeConf.border
                )}
              >
                <Icon size={15} strokeWidth={2.2} />
              </div>

              {/* Alert Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words">
                      {alert.title}
                    </h3>
                    {!alert.read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F58220] shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <span
                      className={clsx(
                        "px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border",
                        SEVERITY_BADGE[alert.severity]
                      )}
                    >
                      {alert.severity}
                    </span>
                    <button
                      type="button"
                      onClick={() => dismiss(alert.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Dismiss alert"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed break-words">
                  {alert.message}
                </p>

                {/* Footer Meta & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Clock size={11} className="shrink-0" /> {alert.time}
                    </span>

                    <span
                      className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded border",
                        typeConf.bg,
                        typeConf.color,
                        typeConf.border
                      )}
                    >
                      {typeConf.label}
                    </span>

                    {!alert.read && (
                      <button
                        type="button"
                        onClick={() => markRead(alert.id)}
                        className="text-[11px] text-slate-500 hover:text-[#F58220] font-bold transition-colors"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>

                  {alert.actionLabel && alert.actionHref && (
                    <Link
                      href={alert.actionHref}
                      className="text-[11px] font-bold text-white bg-[#F58220] hover:bg-[#e0751a] px-3 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-sm shrink-0 ml-auto"
                    >
                      <span>{alert.actionLabel}</span>
                      <ChevronRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white dark:bg-[#12141c] rounded-2xl border border-slate-200 dark:border-white/10 p-6 sm:p-12 text-center space-y-2 w-full max-w-full">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={18} className="text-emerald-500" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">All Clear — No Active Alerts</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed px-2">
              All inventory thresholds, purchase orders, and system checks are operating within normal parameters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
