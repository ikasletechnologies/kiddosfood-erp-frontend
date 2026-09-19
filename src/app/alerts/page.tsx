"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { alertsApi, inventoryApi, franchiseOrdersApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Bell,
  CheckCircle2,
  Package,
  ShoppingCart,
  RefreshCw,
  Clock,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  Building2,
  ArrowRight
} from "lucide-react";
import { clsx } from "clsx";

interface AlertItem {
  id: string;
  type: "inventory" | "order" | "payment" | "dispatch" | "system";
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  itemName?: string;
  category?: string;
  franchiseId?: string;
}

const AlertCard = React.memo(({ alert, onMarkRead }: { alert: AlertItem; onMarkRead: (id: string) => void }) => {
  const isOutOfStock = alert.severity === "critical" || alert.title.toLowerCase().includes("out of stock");
  const isRunningLow = alert.severity === "warning" && alert.type === "inventory";
  const isShipment = alert.title.toLowerCase().includes("shipment") || alert.title.toLowerCase().includes("transit");
  const isOrderPending = alert.type === "order" && !isShipment;

  let badgeText = "ATTENTION NEEDED";
  let badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/40";
  
  if (isOutOfStock) {
    badgeText = "OUT OF STOCK";
    badgeStyle = "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800/40 font-black";
  } else if (isRunningLow) {
    badgeText = "RUNNING LOW";
    badgeStyle = "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/40 font-bold";
  } else if (isShipment) {
    badgeText = "INCOMING SHIPMENT";
    badgeStyle = "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800/40 font-bold";
  } else if (isOrderPending) {
    badgeText = "ORDER NEEDS ATTENTION";
    badgeStyle = "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800/40 font-bold";
  }

  // Authoritative secondary button target
  const secondaryHref = alert.type === "inventory" ? "/inventory/stock" : "/franchise/orders";

  return (
    <div
      className={clsx(
        "p-5 rounded-xl border transition-all duration-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4",
        !alert.read
          ? "bg-white dark:bg-card border-l-4 border-l-[#f58220] border-gray-200 dark:border-white/10"
          : "bg-gray-50/50 dark:bg-card/40 border-gray-200 dark:border-white/5 opacity-90"
      )}
    >
      <div className="space-y-2 flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={clsx("px-2.5 py-0.5 rounded text-[11px] uppercase tracking-wider border", badgeStyle)}>
            {badgeText}
          </span>
          {!alert.read && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-[#f58220]">
              <span className="w-2 h-2 rounded-full bg-[#f58220] animate-pulse" />
              New
            </span>
          )}
        </div>

        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {alert.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-1 font-medium">
            {alert.message}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-slate-400 pt-1">
          <span className="flex items-center gap-1 font-medium">
            <Building2 size={13} className="text-gray-400" />
            Central Warehouse
          </span>
          <span className="flex items-center gap-1">
            <Clock size={13} />
            {alert.time}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-white/5">
        {alert.actionLabel && alert.actionHref && (
          <Link
            href={alert.actionHref}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#f58220] text-white hover:bg-[#e07318] transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <span>{alert.actionLabel}</span>
            <ArrowRight size={14} />
          </Link>
        )}

        <Link
          href={secondaryHref}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-white/10"
        >
          {alert.type === "inventory" ? "View Inventory" : "View Details"}
        </Link>

        {!alert.read && (
          <button
            onClick={() => onMarkRead(alert.id)}
            className="px-2.5 py-2 text-xs font-medium text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="Mark as read"
          >
            Mark Read
          </button>
        )}
      </div>
    </div>
  );
});

AlertCard.displayName = "AlertCard";

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [backendSummary, setBackendSummary] = useState<any>(null);
  const [activeChip, setActiveChip] = useState<"all" | "stock" | "orders" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const effectiveBranchId = user?.franchiseId;
      const isFranchise = user?.role !== "SUPER_ADMIN" && Boolean(effectiveBranchId);

      const queryParams: any = {};
      if (effectiveBranchId) queryParams.franchiseId = effectiveBranchId;
      if (searchQuery.trim()) queryParams.search = searchQuery.trim();

      const [alertsRes, summaryRes] = await Promise.all([
        alertsApi.getAlerts(queryParams).catch(() => ({ data: { data: [] } })),
        alertsApi.getSummary(effectiveBranchId ? { franchiseId: effectiveBranchId } : undefined).catch(() => ({ data: null }))
      ]);

      const rawData = alertsRes?.data?.data || (Array.isArray(alertsRes?.data) ? alertsRes.data : []);
      
      const loadedAlerts: AlertItem[] = rawData.map((a: any) => ({
        id: a.id,
        type: (a.type?.toLowerCase() || "inventory") as AlertItem["type"],
        severity: (a.severity?.toLowerCase() || "info") as AlertItem["severity"],
        title: a.title,
        message: a.message,
        time: new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: Boolean(a.isRead),
        actionLabel: a.actionLabel,
        actionHref: a.actionHref,
        category: a.metadata?.category,
      }));

      setAlerts(loadedAlerts);
      if (summaryRes?.data) {
        setBackendSummary(summaryRes.data);
      }
    } catch (e) {
      console.error("Failed to load alerts:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [user, searchQuery]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const markRead = useCallback((id: string) => {
    alertsApi.markAsRead?.(id)?.catch(() => {});
    setAlerts((p) => p.map((a) => a.id === id ? { ...a, read: true } : a));
  }, []);

  const markAllRead = useCallback(() => {
    alertsApi.markAllAsRead?.()?.catch(() => {});
    setAlerts((p) => p.map((a) => ({ ...a, read: true })));
  }, []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (activeChip === "stock" && a.type !== "inventory") return false;
      if (activeChip === "orders" && a.type !== "order") return false;
      if (activeChip === "unread" && a.read) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = a.title.toLowerCase().includes(q);
        const matchMsg = a.message.toLowerCase().includes(q);
        if (!matchTitle && !matchMsg) return false;
      }
      return true;
    });
  }, [alerts, activeChip, searchQuery]);

  // Summary card metrics
  const needsAttentionCount = backendSummary?.needsAttention ?? alerts.length;
  const outOfStockCount = backendSummary?.outOfStockCount ?? alerts.filter(a => a.severity === "critical" && a.type === "inventory").length;
  const runningLowCount = backendSummary?.runningLowCount ?? alerts.filter(a => a.severity === "warning" && a.type === "inventory").length;
  const pendingActionsCount = backendSummary?.pendingActionsCount ?? alerts.filter(a => a.type === "order").length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-foreground">
      {/* Page Header */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Alerts & Notifications
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">Things that need your attention</p>
        </div>

        <div className="flex items-center gap-3">
          {alerts.some(a => !a.read) && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 bg-white dark:bg-card text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm cursor-pointer"
            >
              <CheckCircle2 size={14} className="text-emerald-500" />
              Mark All Read
            </button>
          )}

          <button
            onClick={fetchAlerts}
            className="p-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-card rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
            title="Refresh alerts"
          >
            <RefreshCw size={15} className={clsx("transition-transform", isRefreshing && "animate-spin text-[#f58220]")} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Top Operational KPI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 flex items-center gap-3.5 shadow-sm">
            <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 text-[#f58220]">
              <Bell size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold">NEEDS ATTENTION</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{needsAttentionCount}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 flex items-center gap-3.5 shadow-sm">
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold">OUT OF STOCK</p>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{outOfStockCount}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 flex items-center gap-3.5 shadow-sm">
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <Package size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold">RUNNING LOW</p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{runningLowCount}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 flex items-center gap-3.5 shadow-sm">
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
              <ShoppingCart size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold">PENDING ACTIONS</p>
              <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">{pendingActionsCount}</h3>
            </div>
          </div>
        </div>

        {/* Filter Chips Toolbar & Search */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-xl p-1.5 shadow-sm">
            {[
              { id: "all", label: `All (${alerts.length})` },
              { id: "stock", label: `Stock (${alerts.filter(a => a.type === "inventory").length})` },
              { id: "orders", label: `Orders (${alerts.filter(a => a.type === "order").length})` },
              { id: "unread", label: `Unread (${alerts.filter(a => !a.read).length})` },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setActiveChip(chip.id as any)}
                className={clsx(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  activeChip === chip.id
                    ? "bg-[#f58220] text-white shadow-sm"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alerts..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none focus:border-[#f58220] bg-white dark:bg-card text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 shadow-sm"
            />
            {searchQuery && (
              <X
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
                onClick={() => setSearchQuery("")}
              />
            )}
          </div>
        </div>

        {/* Alert Cards Container */}
        <div className="space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center text-sm text-gray-500 dark:text-slate-400 shadow-sm">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-60" />
              All Clear — No active alerts match your view
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onMarkRead={markRead} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
