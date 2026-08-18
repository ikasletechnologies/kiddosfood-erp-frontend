"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart, Package, TrendingUp, TrendingDown,
  AlertTriangle, Clock, IndianRupee, Target, Calendar,
  CreditCard, Receipt, Activity, Search, Download, ChevronDown, FileSpreadsheet, FileText,
  BarChart3, Wallet, Zap, LayoutDashboard, Factory, Settings2, Settings, Plus, Send, Building2,
  Bell, ShieldAlert, History, Repeat, Store, Truck, CheckCircle2, XCircle, Landmark, PackageCheck
} from "lucide-react";
import { clsx } from "clsx";
import { dashboardApi, franchiseApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  KPICard, RevenueIntelligence, PremiumFilter, ReportTableWidget
} from "@/components/dashboard/DashboardComponents";
import toast from "react-hot-toast";

function ActivityFeedWidget() {
  const activities = [
    { title: "Batch #B2026-92 Completed", time: "10 mins ago", type: "production", desc: "100 KG Recipe scaled and completed by Factory Manager.", status: "SUCCESS" },
    { title: "Vendor Payment Recorded", time: "42 mins ago", type: "finance", desc: "₹45,000 paid to supplier FreshOils Ltd.", status: "PAID" },
    { title: "Outlet Stock Dispatched", time: "2 hours ago", type: "inventory", desc: "Challan #DC-9082 dispatched to Franchise Alpha.", status: "IN_TRANSIT" },
    { title: "Low Stock Alert: Sugar", time: "5 hours ago", type: "alert", desc: "Raw material 'Sugar' is below reorder level (120 KG left).", status: "WARNING" },
    { title: "POS Day Closing Settlement", time: "Yesterday", type: "pos", desc: "Counter shift closed with total collection of ₹38,200.", status: "CLOSED" },
  ];

  return (
    <div className="bg-white dark:bg-[#12141c] p-6 rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
          <Activity size={14} className="text-orange-500" />
          Live Activity Feed
        </h3>
        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Real-time alerts</span>
      </div>
      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
        {activities.map((act, i) => (
          <div key={i} className="flex items-start gap-3 text-xs border-b border-slate-50 dark:border-white/[0.02] pb-3 last:border-0 last:pb-0">
            <div className={clsx(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
              act.type === 'production' && 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
              act.type === 'finance' && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
              act.type === 'inventory' && 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
              act.type === 'alert' && 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
              act.type === 'pos' && 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
            )}>
              {act.type === 'production' && <Factory size={14} />}
              {act.type === 'finance' && <IndianRupee size={14} />}
              {act.type === 'inventory' && <Package size={14} />}
              {act.type === 'alert' && <AlertTriangle size={14} />}
              {act.type === 'pos' && <Store size={14} />}
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="flex justify-between items-center">
                <p className="font-black text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-tight">{act.title}</p>
                <span className="text-[9px] text-slate-400 font-medium">{act.time}</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{act.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("all");
  const [selectedOutletName, setSelectedOutletName] = useState("All Outlets");

  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletDropdownOpen, setOutletDropdownOpen] = useState(false);
  const outletDropdownRef = useRef<HTMLDivElement>(null);

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const fetchOutlets = useCallback(async () => {
    try {
      const res = await franchiseApi.getAll();
      const cleanList = (res.data ?? []).filter((f: any) =>
        !f.name?.includes("Headquarters (HQ)") &&
        !f.name?.includes("Distribution Center") &&
        f.id !== "hq-001"
      );
      setOutlets(cleanList);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchOutlets(); }, [fetchOutlets]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (outletDropdownRef.current && !outletDropdownRef.current.contains(e.target as Node)) {
        setOutletDropdownOpen(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchDashboard = useCallback(() => {
    setLoading(true);

    let endDateStr = new Date().toISOString();
    let startDateStr = new Date().toISOString();

    if (period === "custom" && customStartDate && customEndDate) {
      startDateStr = new Date(customStartDate).toISOString();
      const endD = new Date(customEndDate);
      endD.setHours(23, 59, 59, 999);
      endDateStr = endD.toISOString();
    } else {
      let startDate = new Date();
      if (period === "today") startDate.setHours(0,0,0,0);
      else if (period === "week") startDate.setDate(startDate.getDate() - 7);
      else if (period === "month") startDate.setMonth(startDate.getMonth() - 1);
      else startDate.setFullYear(2020);
      startDateStr = startDate.toISOString();
    }

    dashboardApi.getSummary({
      startDate: startDateStr,
      endDate: endDateStr,
      period,
      ...(selectedOutletId !== "all" ? { franchiseId: selectedOutletId } : {})
    })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [period, customStartDate, customEndDate, selectedOutletId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const getExportRows = () => {
    const s = data?.stats || {};
    return [
      ["Report Generated", new Date().toLocaleString()],
      ["Period", period],
      ["Outlet", selectedOutletName],
      ["Today Revenue", formatCurrency(s.revenueToday || 0)],
      ["Net Profit", formatCurrency((s.totalSales || 0) - (s.totalPurchase || 0))],
      ["Inventory Value", formatCurrency(s.inventoryValue || 0)],
      ["Today Collection", formatCurrency(s.todayCollection || 0)],
      ["Pending Receivables", formatCurrency(s.outstandingAmount || 0)],
      ["Vendor Payables", formatCurrency(s.vendorPayables || 0)],
      ["Daily Cash Position", formatCurrency(s.dailyCashPosition || 0)],
      ["Production Quantity", `${(s.productionQuantity || 0).toLocaleString()} units`],
      ["Yield Percentage", `${s.yieldPercentage || 100}%`],
      ["Wastage / Rejections", `${(s.wastage || 0).toLocaleString()} units`],
    ];
  };

  const handleExportExcel = () => {
    setExportDropdownOpen(false);
    const rows = getExportRows();
    const csvContent = ["Metric,Value", ...rows.map(([label, value]) => `"${label}","${String(value).replace(/"/g, '""')}"`)].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `ERP_Executive_Telemetry_${period}.csv`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Excel (CSV) report downloaded successfully!");
  };

  const handleExportPDF = () => {
    setExportDropdownOpen(false);
    const rows = getExportRows();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow pop-ups to export as PDF");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>ERP Executive Telemetry - ${period}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            th { text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; color: #64748b; }
            td:first-child { font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>HQ Control Center — Executive Telemetry</h1>
          <table>
            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
            <tbody>
              ${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
    toast.success("Preparing PDF export...");
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#090a0f] p-4">
      <div className="bg-white dark:bg-[#12141c] p-10 rounded-[3rem] border border-rose-500/20 shadow-2xl shadow-rose-500/10 flex flex-col items-center text-center max-w-md animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6">
          <AlertTriangle size={40} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest mb-3">Telemetry Failure</h2>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">{error}</p>
        <button
          onClick={() => { setError(null); fetchDashboard(); }}
          className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl active:scale-95"
        >
          Re-establish Connection
        </button>
      </div>
    </div>
  );

  if (loading && !data) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#090a0f]">
      <div className="flex flex-col items-center gap-6 animate-pulse">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-xl shadow-blue-600/20" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Establishing Mission Control Link...</p>
      </div>
    </div>
  );

  const stats = data?.stats;

  // --- LAYER 1: CEO SUMMARY (LIVE DATA WITH DRILL DOWNS) ---
  const generalKPIs = [
    { title: "Today Revenue", value: formatCurrency(stats?.revenueToday || 0), trend: stats?.revenueChangePct || "0", icon: Zap, colorClass: "orange", insight: `${stats?.orderCountToday || 0} Orders Today`, href: "/sales/invoices" },
    { title: "Net Profit", value: formatCurrency((stats?.totalSales || 0) - (stats?.totalPurchase || 0)), icon: TrendingUp, colorClass: "emerald", subtext: `Profit for this ${period}`, insight: `Margin: ${stats?.totalSales > 0 ? (((stats.totalSales - stats.totalPurchase) / stats.totalSales) * 100).toFixed(1) : 0}%`, href: "/reports?report=Profit And Loss" },
    { title: "Inventory Value", value: formatCurrency(stats?.inventoryValue || 0), icon: Package, colorClass: "blue", subtext: "Warehouse Asset Net Worth", insight: `${stats?.inventoryItemCount || 0} Active SKUs`, href: "/inventory/raw-material-stock" },
  ];

  const cashKPIs = [
    { title: "Today Collection", value: formatCurrency(stats?.todayCollection || 0), icon: IndianRupee, colorClass: "emerald", subtext: "Payments collected today", insight: `Returns: ${formatCurrency(stats?.salesReturnsToday || 0)}`, href: "/sales/payment-in" },
    { title: "Pending Receivables", value: formatCurrency(stats?.outstandingAmount || 0), icon: Wallet, colorClass: "amber", subtext: "Outstanding dealer balance", insight: `${stats?.overdueDealersCount || 0} overdue accounts`, href: "/accounting/ledgers?type=receivables" },
    { title: "Vendor Payables", value: formatCurrency(stats?.vendorPayables || 0), icon: CreditCard, colorClass: "rose", subtext: "Pending supplier invoices", insight: "Liability ledger total", href: "/vendors" },
    { title: "Daily Cash Position", value: formatCurrency(stats?.dailyCashPosition || 0), icon: Landmark, colorClass: "blue", subtext: "Total Cash & Bank Balance", insight: "Active liquidity assets", href: "/accounting/cash-flow" },
  ];

  const productionKPIs = [
    { title: "Production Quantity", value: `${(stats?.productionQuantity || 0).toLocaleString()} units`, icon: Factory, colorClass: "indigo", subtext: `Produced in this ${period}`, insight: "Completed yield output", href: "/production/batches" },
    { title: "Yield Percentage", value: `${stats?.yieldPercentage || 100}%`, icon: Target, colorClass: "emerald", subtext: "Completed vs planned yield", insight: `Yield performance rate`, href: "/production" },
    { title: "Wastage / Rejections", value: `${(stats?.wastage || 0).toLocaleString()} units`, icon: ShieldAlert, colorClass: "rose", subtext: "Rejected batch quantities", insight: "Material loss tracking", href: "/production/wastage" },
  ];

  // --- LAYER 2: REVENUE SOURCES ---
  const revenueBreakdown = (data?.revenueBreakdown || []).map((b: any, i: number) => ({
    label: b.label,
    value: b.value,
    percent: stats?.revenueToday ? (b.value / stats.revenueToday) * 100 : 0,
    color: i === 0 ? "bg-blue-500" : i === 1 ? "bg-emerald-500" : i === 2 ? "bg-amber-500" : "bg-rose-500"
  }));

  // --- ANALYTICS & OPERATIONS ---
  const chartData = (data?.historicalSales || []).map((s: any) => ({
    date: s.date,
    sales: s.sales || 0,
    orders: s.orders,
    purchase: s.purchase || 0,
    profit: (s.sales || 0) - (s.purchase || 0),
  }));

  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#090a0f] p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-1000">

      {/* ── HEADER ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase transition-colors hover:text-[#F58220]">HQ Control Center</h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center flex-wrap gap-4 xl:justify-end w-full xl:w-auto">
          {/* Actions & Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Filter by Outlet */}
            <div className="relative" ref={outletDropdownRef}>
              <button
                type="button"
                onClick={() => setOutletDropdownOpen(o => !o)}
                className="px-4 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm hover:border-[#F58220] focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {selectedOutletName}
                <ChevronDown size={12} className={clsx("text-slate-400 transition-transform", outletDropdownOpen && "rotate-180")} />
              </button>

              {outletDropdownOpen && (
                <div className="absolute z-20 mt-2 w-56 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="max-h-64 overflow-y-auto py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOutletId("all");
                        setSelectedOutletName("All Outlets");
                        setOutletDropdownOpen(false);
                        toast.success("Telemetry filtered for: All Outlets");
                      }}
                      className={clsx(
                        "w-full text-left px-4 py-2 text-[11px] font-bold transition-colors",
                        selectedOutletId === "all" ? "bg-orange-500 text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                      )}
                    >
                      All Outlets
                    </button>
                    {outlets.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setSelectedOutletId(o.id);
                          setSelectedOutletName(o.name);
                          setOutletDropdownOpen(false);
                          toast.success(`Telemetry filtered for: ${o.name}`);
                        }}
                        className={clsx(
                          "w-full text-left px-4 py-2 text-[11px] font-bold transition-colors",
                          selectedOutletId === o.id ? "bg-orange-500 text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                        )}
                      >
                        {o.name}
                      </button>
                    ))}
                    {outlets.length === 0 && (
                      <p className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">No franchises yet</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setOutletDropdownOpen(false); router.push("/franchise?new=1"); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-orange-500 border-t border-slate-100 dark:border-white/5 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
                  >
                    <Plus size={14} /> Add Franchise
                  </button>
                </div>
              )}
            </div>

            {/* Export Action */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                type="button"
                onClick={() => setExportDropdownOpen(o => !o)}
                className="px-4 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm hover:border-[#F58220] transition-all flex items-center gap-1.5"
              >
                <Download size={12} className="text-slate-400" /> Export
              </button>

              {exportDropdownOpen && (
                <div className="absolute right-0 z-20 mt-2 w-48 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 py-1">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <FileSpreadsheet size={14} className="text-emerald-500" /> Export as Excel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <FileText size={14} className="text-rose-500" /> Export as PDF
                  </button>
                </div>
              )}
            </div>

            {period === 'custom' && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300 w-full sm:w-auto">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="flex-1 sm:flex-initial px-4 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm focus:border-[#F58220] focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="flex-1 sm:flex-initial px-4 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-full text-[11px] font-bold text-slate-700 dark:text-slate-300 outline-none shadow-sm focus:border-[#F58220] focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
            )}
            <PremiumFilter
              options={[
                { label: 'Today', value: 'today' },
                { label: 'Week', value: 'week' },
                { label: 'Month', value: 'month' },
                { label: 'Custom', value: 'custom' },
              ]}
              active={period}
              onChange={setPeriod}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <Link href="/purchases/new" className="flex-1 sm:flex-initial justify-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl active:scale-95 flex items-center gap-3 whitespace-nowrap">
              <Plus size={16} strokeWidth={3} /> Create Purchase Order
            </Link>
            <Link href="/franchise-orders" className="flex-1 sm:flex-initial justify-center bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 hover:scale-105 transition-all active:scale-95 flex items-center gap-3 shadow-xl shadow-blue-500/20 whitespace-nowrap">
              <Send size={16} strokeWidth={3} /> Dispatch
            </Link>
          </div>
        </div>
      </div>

      {/* ── GENERAL OVERVIEW & CORE KPIs ── */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Executive Overview (Click Card to Drill Down)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {generalKPIs.map((kpi: any, i) => (
            <Link href={kpi.href} key={i}>
              <KPICard {...kpi} className="cursor-pointer" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── CASH & ACCOUNTS PILLAR ── */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Pillar A: Cash & Accounts Control (Click Card to Drill Down)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cashKPIs.map((kpi: any, i) => (
            <Link href={kpi.href} key={i}>
              <KPICard {...kpi} className="cursor-pointer" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── PRODUCTION PILLAR ── */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          Pillar B: Production & Manufacturing Control (Click Card to Drill Down)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {productionKPIs.map((kpi: any, i) => (
            <Link href={kpi.href} key={i}>
              <KPICard {...kpi} className="cursor-pointer" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── LAYER 2: REVENUE INTELLIGENCE & LIVE ACTIVITY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <RevenueIntelligence
            data={chartData}
            title="Revenue Analytics"
            trend={stats?.revenueChangePct || "0"}
            period={period}
            setPeriod={setPeriod}
          />
        </div>
        <div className="lg:col-span-4">
          <ActivityFeedWidget />
        </div>
      </div>

      {/* ── REPORT TABLES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ReportTableWidget
              title="Recent Purchase Report View"
              icon={PackageCheck}
              color="indigo"
              headers={['PO Number', 'Vendor', 'Amount']}
              data={(data?.recentPurchases || []).map((p: any) => ({
                col1: p.poNumber,
                col2: p.vendor?.name || p.items?.[0]?.inventoryItem?.name || 'Vendor',
                col3: formatCurrency(p.totalAmount)
              }))}
            />

            <ReportTableWidget
              title="Recent B2B Sales Details"
              icon={Building2}
              color="blue"
              headers={['Invoice #', 'Client', 'Amount']}
              data={(data?.recentB2BSales || []).map((s: any) => ({
                col1: s.invoiceNum,
                col2: s.customerName || 'B2B Client',
                col3: formatCurrency(s.totalAmount)
              }))}
            />

            <ReportTableWidget
              title="Recent B2C Sales Details"
              icon={Store}
              color="emerald"
              headers={['Invoice #', 'Amount']}
              data={(data?.recentB2CBills || []).map((s: any) => ({
                col1: `#${s.invoiceNum}`,
                col2: formatCurrency(s.totalAmount)
              }))}
            />

            <ReportTableWidget
              title="Top Selling Products of the Week"
              icon={TrendingUp}
              color="amber"
              headers={['Product', 'Units Sold', 'Trend']}
              data={(data?.topSellers || []).map((p: any) => ({
                col1: p.name,
                col2: `${p.value} ${p.unit}`,
                col3: `${p.growth}%`
              }))}
            />

            <ReportTableWidget
              title="Stock Urgent Report"
              icon={AlertTriangle}
              color="rose"
              headers={['Product', 'Current Stock', 'Action']}
              data={(data?.lowStock || []).map((p: any) => ({
                col1: p.name,
                col2: `${p.currentStock} ${p.unit}`,
                col3: p.action
              }))}
            />

            <ReportTableWidget
              title="Supplier payment Tracking View"
              icon={CreditCard}
              color="purple"
              headers={['Vendor', 'PO Number', 'Amount Due']}
              data={(data?.supplierPaymentsDue || []).map((p: any) => ({
                col1: p.vendor?.name || 'Vendor',
                col2: p.poNumber,
                col3: formatCurrency(p.totalAmount)
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
