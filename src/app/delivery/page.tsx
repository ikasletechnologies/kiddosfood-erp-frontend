"use client";

import { useState, useEffect } from "react";
import {
  Truck,
  CheckCircle2,
  MapPin,
  Phone,
  Search,
  User,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  ChevronRight,
  Package,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
} from "lucide-react";
import { clsx } from "clsx";
import api from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  DELIVERED: {
    label: "Delivered",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  IN_TRANSIT: {
    label: "In Transit",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    dot: "bg-blue-500",
  },
  ASSIGNED: {
    label: "Assigned",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
    dot: "bg-amber-500",
  },
  PENDING: {
    label: "Pending",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-500/20",
    dot: "bg-slate-400",
  },
};

function getConf(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
}

export default function DeliveryPage() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/delivery/active");
      setDeliveries(response.data);
    } catch (err) {
      console.error("Failed to fetch deliveries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const filtered = deliveries.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.transaction?.invoiceNum?.toLowerCase().includes(q) ||
      d.id?.toLowerCase().includes(q) ||
      d.riderName?.toLowerCase().includes(q) ||
      d.customerPhone?.includes(q)
    );
  });

  const deliveredCount = deliveries.filter((d) => d.status === "DELIVERED").length;
  const inTransitCount = deliveries.filter((d) => d.status === "IN_TRANSIT").length;
  const assignedCount = deliveries.filter((d) => d.status === "ASSIGNED").length;

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 print:bg-white print:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center print:hidden border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">
              <Truck size={22} className="text-orange-500" />
              Dispatch Tracking
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
              <Sparkles size={12} className="animate-pulse" /> Live
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track live orders, manage riders, and verify successful handovers
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm">
            <div className="flex items-center px-2 text-slate-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder="Search orders, riders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-semibold text-sm outline-none w-44"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchDeliveries}
            title="Refresh Data"
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95"
          >
            <RotateCcw size={16} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Stats + Summary Row */}
      <div className="flex flex-col lg:flex-row gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {[
            { label: "Total Orders", value: deliveries.length, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/20", borderColor: "border-indigo-200 dark:border-indigo-900/30" },
            { label: "In Transit", value: inTransitCount, icon: Truck, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20", borderColor: "border-blue-200 dark:border-blue-900/30" },
            { label: "Assigned", value: assignedCount, icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/20", borderColor: "border-amber-200 dark:border-amber-900/30" },
            { label: "Delivered", value: deliveredCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20", borderColor: "border-emerald-200 dark:border-emerald-900/30" },
          ].map((s) => (
            <div
              key={s.label}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm bg-white dark:bg-slate-800",
                s.borderColor
              )}
            >
              <div className={clsx("p-2 rounded-lg", s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {s.label}
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Summary */}
        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-3 rounded-xl shadow-sm">
          <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
            Performance :
          </span>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-orange-500" />
              <span className="text-slate-500 font-semibold">Avg. Time</span>
              <span className="font-black text-slate-900 dark:text-white">24 min</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500" />
              <span className="text-slate-500 font-semibold">Success</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">99.2%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Shipments Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
                Loading active deliveries...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <Truck size={40} className="text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">
                {search ? "No deliveries match your search." : "No active deliveries at the moment."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto select-text">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-700/60">
                    <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Rider
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">
                      Status
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                  {filtered.map((order) => {
                    const conf = getConf(order.status);
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 sm:px-5 py-3">
                          <p className="text-[13px] font-bold text-orange-600 dark:text-orange-400 font-mono">
                            #{order.transaction?.invoiceNum || order.id.slice(0, 8)}
                          </p>
                        </td>
                        <td className="px-4 sm:px-5 py-3">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-slate-400 shrink-0" />
                            <span className="text-[13px] sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                              {order.riderName || "Seeking Rider"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-slate-400 shrink-0" />
                            <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                              {order.customerPhone || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-center">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider",
                              conf.bg,
                              conf.color,
                              conf.border
                            )}
                          >
                            <span
                              className={clsx(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                conf.dot,
                                order.status === "IN_TRANSIT" && "animate-pulse"
                              )}
                            />
                            {conf.label}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-right">
                          <button className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded-lg transition-colors">
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 sm:px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-700/60">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Showing {filtered.length} of {deliveries.length} shipments
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar: Fleet Activity */}
        <div className="space-y-6">
          {/* Active Riders Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Active Riders
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  12 Online
                </span>
              </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
              {[
                { id: 152, orders: 12 },
                { id: 304, orders: 8 },
                { id: 456, orders: 15 },
              ].map((rider) => (
                <div
                  key={rider.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 flex items-center justify-center">
                    <User size={14} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
                      Rider #{rider.id}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Active • {rider.orders} orders today
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-slate-300 dark:text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Performance Card */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Delivery Performance
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">
                    Avg. Delivery Time
                  </span>
                  <span className="text-[13px] font-black text-slate-900 dark:text-white">
                    24 mins
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full w-[85%] rounded-full transition-all" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">
                    Success Rate
                  </span>
                  <span className="text-[13px] font-black text-emerald-600 dark:text-emerald-400">
                    99.2%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[99%] rounded-full transition-all" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">
                    On-Time Rate
                  </span>
                  <span className="text-[13px] font-black text-blue-600 dark:text-blue-400">
                    94.8%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full w-[94.8%] rounded-full transition-all" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
