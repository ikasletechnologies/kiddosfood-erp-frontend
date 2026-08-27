"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  IndianRupee,
  CreditCard,
  Building2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Wallet,
  Zap,
  Factory,
  Plus,
  Send,
  RefreshCw,
  Landmark,
  Target,
  ShieldAlert,
  PackageCheck,
  Receipt,
  Store,
  Clock,
} from "lucide-react";
import { clsx } from "clsx";
import { dashboardApi, franchiseApi } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  KPICard,
  ProductionYieldGauge,
  BusinessPerformanceChart,
  InvoiceReportTable,
  PremiumFilter,
} from "@/components/dashboard/DashboardComponents";
import { DateRangePickerModal } from "@/components/dashboard/DateRangePickerModal";
import { DrillDownDrawer, DrillDownItem } from "@/components/dashboard/DrillDownDrawer";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import toast from "react-hot-toast";

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>("");

  // Period Filter
  const [period, setPeriod] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Outlet Filter
  const [selectedOutletId, setSelectedOutletId] = useState("all");
  const [selectedOutletName, setSelectedOutletName] = useState("All Outlets (HQ)");
  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletDropdownOpen, setOutletDropdownOpen] = useState(false);
  const [outletSearch, setOutletSearch] = useState("");
  const outletDropdownRef = useRef<HTMLDivElement>(null);

  // Export Dropdown
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Drill-down slideover
  const [drillDownItem, setDrillDownItem] = useState<DrillDownItem | null>(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);

  const fetchOutlets = useCallback(async () => {
    try {
      const res = await franchiseApi.getAll();
      // Franchise.isHQ is the one real definition of HQ (see
      // FranchiseService.getHqFranchise) — not a name/id guess. The
      // "Distribution Center" name exclusion is a separate, unrelated
      // demo-data filter and is left as-is.
      const cleanList = (res.data ?? []).filter(
        (f: any) =>
          !f.isHQ &&
          !f.name?.includes("Distribution Center")
      );
      setOutlets(cleanList);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchOutlets();
    setLastRefreshedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [fetchOutlets]);

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

  const fetchDashboard = useCallback(
    (manual = false) => {
      if (manual) setIsRefreshing(true);
      else setLoading(true);

      let endDateStr = new Date().toISOString();
      let startDateStr = new Date().toISOString();

      if (period === "custom" && customStartDate && customEndDate) {
        startDateStr = new Date(customStartDate).toISOString();
        const endD = new Date(customEndDate);
        endD.setHours(23, 59, 59, 999);
        endDateStr = endD.toISOString();
      } else {
        let startDate = new Date();
        if (period === "today") startDate.setHours(0, 0, 0, 0);
        else if (period === "week") startDate.setDate(startDate.getDate() - 7);
        else if (period === "month") startDate.setMonth(startDate.getMonth() - 1);
        else startDate.setFullYear(2020);
        startDateStr = startDate.toISOString();
      }

      dashboardApi
        .getSummary({
          startDate: startDateStr,
          endDate: endDateStr,
          period,
          ...(selectedOutletId !== "all" ? { franchiseId: selectedOutletId } : {}),
        })
        .then((res) => {
          setData(res.data);
          setError(null);
          setLastRefreshedTime(
            new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          );
        })
        .catch((err) =>
          setError(err.response?.data?.error || "Failed to load dashboard telemetry.")
        )
        .finally(() => {
          setLoading(false);
          setIsRefreshing(false);
        });
    },
    [period, customStartDate, customEndDate, selectedOutletId]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handlePeriodChange = (val: string) => {
    if (val === "custom") {
      setIsDatePickerOpen(true);
    } else {
      setPeriod(val);
    }
  };

  const handleApplyCustomDates = (start: string, end: string, presetLabel?: string) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setPeriod("custom");
    toast.success(`Date filter: ${presetLabel || `${start} to ${end}`}`);
  };

  const handleOpenDrillDown = (item: DrillDownItem) => {
    setDrillDownItem(item);
    setIsDrillDownOpen(true);
  };

  const getExportRows = () => {
    const s = data?.stats || {};
    return [
      ["Report Generated", new Date().toLocaleString()],
      ["Period", period.toUpperCase()],
      ["Outlet Scope", selectedOutletName],
      ["Today Revenue", formatCurrency(s.revenueToday || 0)],
      ["Net Operating Profit", formatCurrency((s.totalSales || 0) - (s.totalPurchase || 0))],
      ["Inventory Value", formatCurrency(s.inventoryValue || 0)],
      ["Today Collection", formatCurrency(s.todayCollection || 0)],
      ["Pending Receivables", formatCurrency(s.outstandingAmount || 0)],
      ["Vendor Payables", formatCurrency(s.vendorPayables || 0)],
      ["Production Quantity", `${(s.productionQuantity || 0).toLocaleString()} units`],
      ["Yield Percentage", `${s.yieldPercentage || 100}%`],
      ["Wastage / Rejections", `${(s.wastage || 0).toLocaleString()} units`],
    ];
  };

  const handleExportExcel = () => {
    setExportDropdownOpen(false);
    const rows = getExportRows();
    const csvContent = [
      "Metric,Value",
      ...rows.map(([label, value]) => `"${label}","${String(value).replace(/"/g, '""')}"`),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = url;
    downloadAnchor.download = `Kiddos_ERP_Dashboard_${period}.csv`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV export downloaded!");
  };

  const handleExportPDF = () => {
    setExportDropdownOpen(false);
    const rows = getExportRows();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to export as PDF");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Kiddos ERP Executive Dashboard (${period.toUpperCase()})</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; color: #0f172a; }
            h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
            p { font-size: 12px; color: #64748b; margin-top: 0; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
            th { text-transform: uppercase; font-size: 10px; color: #64748b; background: #f8fafc; font-weight: bold; }
            td:last-child { text-align: right; font-weight: bold; }
            th:last-child { text-align: right; }
          </style>
        </head>
        <body>
          <h1>Kiddos Foods — Executive Dashboard Telemetry</h1>
          <p>Generated: ${new Date().toLocaleString()} | Scope: ${selectedOutletName} | Range: ${period.toUpperCase()}</p>
          <table>
            <thead><tr><th>Metric</th><th>Recorded Value</th></tr></thead>
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
    toast.success("Preparing printable report...");
  };

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#12141c] p-8 rounded-2xl border border-rose-200 dark:border-rose-500/20 shadow-lg text-center max-w-md space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Connection Error
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchDashboard();
            }}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
          >
            Re-sync Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const stats = data?.stats;

  // ── CORE EXECUTIVE KPIs ──
  const generalKPIs: DrillDownItem[] = [
    {
      title: "TODAY REVENUE",
      value: formatCurrency(stats?.revenueToday || 0),
      icon: Zap,
      colorClass: "orange",
      insight: stats?.orderCountToday ? `${stats.orderCountToday} Orders Today` : "",
      href: "/sales/invoices",
      breakdown: [
        { label: "B2B Franchise Invoices", value: formatCurrency(stats?.b2bSalesToday || (stats?.revenueToday ? stats.revenueToday * 0.65 : 0)) },
        { label: "B2C Counter Receipts", value: formatCurrency(stats?.b2cSalesToday || (stats?.revenueToday ? stats.revenueToday * 0.35 : 0)) },
      ],
    },
    {
      title: "NET PROFIT",
      value: formatCurrency((stats?.totalSales || 0) - (stats?.totalPurchase || 0)),
      icon: TrendingUp,
      colorClass: "emerald",
      insight: `Net Margin: ${stats?.totalSales > 0 ? (((stats.totalSales - stats.totalPurchase) / stats.totalSales) * 100).toFixed(1) : 0}%`,
      href: "/reports?report=Profit And Loss",
      breakdown: [
        { label: "Gross Sales Revenue", value: formatCurrency(stats?.totalSales || 0) },
        { label: "Total Procurement Bills", value: formatCurrency(stats?.totalPurchase || 0) },
      ],
    },
    {
      title: "INVENTORY VALUE",
      value: formatCurrency(stats?.inventoryValue || 0),
      icon: Package,
      colorClass: "blue",
      insight: stats?.inventoryItemCount ? `${stats.inventoryItemCount} Active SKUs` : "",
      href: "/inventory/raw-material-stock",
      breakdown: [
        { label: "Raw Materials Stock", value: formatCurrency((stats?.inventoryValue || 0) * 0.58) },
        { label: "Packaging Stock", value: formatCurrency((stats?.inventoryValue || 0) * 0.18) },
        { label: "Finished Goods Stock", value: formatCurrency((stats?.inventoryValue || 0) * 0.24) },
      ],
    },
  ];

  // ── FINANCIAL & PRODUCTION KPIs ──
  const secondaryKPIs: DrillDownItem[] = [
    {
      title: "CASH POSITION",
      value: formatCurrency(stats?.dailyCashPosition || 0),
      icon: Landmark,
      colorClass: "blue",
      insight: "",
      href: "/accounting/cash-flow",
    },
    {
      title: "PENDING RECEIVABLES",
      value: formatCurrency(stats?.outstandingAmount || 0),
      icon: Wallet,
      colorClass: "amber",
      insight: stats?.overdueDealersCount ? `${stats.overdueDealersCount} Overdue Accounts` : "",
      href: "/accounting/ledgers?type=receivables",
    },
    {
      title: "VENDOR PAYABLES",
      value: formatCurrency(stats?.vendorPayables || 0),
      icon: CreditCard,
      colorClass: "rose",
      insight: "",
      href: "/vendors",
    },
    {
      title: "PRODUCTION QUANTITY",
      value: `${(stats?.productionQuantity || 0).toLocaleString()} Units`,
      icon: Factory,
      colorClass: "indigo",
      insight: `Yield Rate: ${stats?.yieldPercentage || 100}%`,
      href: "/production/batches",
    },
  ];

  // Chart data
  const chartData = (data?.historicalSales || []).map((s: any) => ({
    date: s.date,
    sales: s.sales || 0,
    orders: s.orders,
    purchase: s.purchase || 0,
    profit: (s.sales || 0) - (s.purchase || 0),
  }));

  const filteredOutletList = outlets.filter((o) =>
    o.name?.toLowerCase().includes(outletSearch.toLowerCase())
  );

  return (
    <div className="min-h-full space-y-6 animate-in fade-in duration-200">
      {/* ── 1. TOP ACTION TOOLBAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Refresh telemetry"
          >
            <RefreshCw
              size={13}
              className={clsx("transition-transform", isRefreshing && "animate-spin text-[#F58220]")}
            />
            <span>Refresh</span>
          </button>
        </div>

        {/* Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Outlet Dropdown */}
          <div className="relative" ref={outletDropdownRef}>
            <button
              type="button"
              onClick={() => setOutletDropdownOpen((o) => !o)}
              className="px-3 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm hover:border-[#F58220] transition-all flex items-center gap-1.5"
            >
              <Building2 size={13} className="text-[#F58220]" />
              <span className="max-w-[120px] truncate">{selectedOutletName}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {outletDropdownOpen && (
              <div className="absolute right-0 z-50 mt-1.5 w-60 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden p-1">
                <div className="p-1.5 border-b border-slate-100 dark:border-white/5">
                  <input
                    type="text"
                    placeholder="Search outlet..."
                    value={outletSearch}
                    onChange={(e) => setOutletSearch(e.target.value)}
                    className="w-full px-2.5 py-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs outline-none focus:border-[#F58220]"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOutletId("all");
                      setSelectedOutletName("All Outlets (HQ)");
                      setOutletDropdownOpen(false);
                      toast.success("Scope: All Outlets");
                    }}
                    className={clsx(
                      "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                      selectedOutletId === "all"
                        ? "bg-[#F58220] text-white"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                    )}
                  >
                    All Outlets (HQ)
                  </button>

                  {filteredOutletList.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelectedOutletId(o.id);
                        setSelectedOutletName(o.name);
                        setOutletDropdownOpen(false);
                        toast.success(`Scope: ${o.name}`);
                      }}
                      className={clsx(
                        "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                        selectedOutletId === o.id
                          ? "bg-[#F58220] text-white"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                      )}
                    >
                      {o.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              type="button"
              onClick={() => setExportDropdownOpen((o) => !o)}
              className="px-3 py-1.5 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm hover:border-[#F58220] transition-all flex items-center gap-1.5"
            >
              <span>Export</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 z-50 mt-1.5 w-44 bg-white dark:bg-[#12141c] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden p-1">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <FileSpreadsheet size={14} className="text-emerald-600" />
                  <span>Export as Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <FileText size={14} className="text-rose-600" />
                  <span>Export as PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Segmented Period Filter */}
          <PremiumFilter
            options={[
              { label: "Today", value: "today" },
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
              { label: "Custom", value: "custom" },
            ]}
            active={period}
            onChange={handlePeriodChange}
          />

          {/* Primary & Secondary Action Buttons */}
          <Link
            href="/purchases/new"
            className="px-3.5 py-1.5 bg-[#F58220] hover:bg-[#e0751a] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Create Purchase Order</span>
          </Link>

          <Link
            href="/franchise-orders"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <Send size={13} strokeWidth={2.5} />
            <span>Dispatch</span>
          </Link>
        </div>
      </div>

      {/* ── 2. EXECUTIVE CORE KPIs (3 CARDS) ── */}
      <div className="space-y-2">
        <h2 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          EXECUTIVE OVERVIEW
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {generalKPIs.map((kpi, i) => (
            <KPICard
              key={i}
              {...kpi}
              colorClass={i === 0 ? "orange" : i === 1 ? "emerald" : "blue"}
              onClick={() => handleOpenDrillDown(kpi)}
            />
          ))}
        </div>
      </div>

      {/* ── 3. FINANCIAL & PRODUCTION METRICS (4 CARDS) ── */}
      <div className="space-y-2">
        <h2 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          FINANCIAL & OPERATIONAL HEALTH
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {secondaryKPIs.map((kpi, i) => (
            <KPICard
              key={i}
              {...kpi}
              colorClass={i === 0 ? "blue" : i === 1 ? "amber" : i === 2 ? "rose" : "indigo"}
              onClick={() => handleOpenDrillDown(kpi)}
            />
          ))}
        </div>
      </div>

      {/* ── 4. BUSINESS PERFORMANCE ANALYTICS ── */}
      <div className="grid grid-cols-1 gap-4">
        <BusinessPerformanceChart
          data={chartData}
          title="Business Performance Analytics"
          period={period}
          setPeriod={setPeriod}
        />
      </div>

      {/* ── 5. DETAILED REPORT TABLES (6 REQUESTED TABLES) ── */}
      <div className="space-y-3">
        <h2 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Reports & Transaction Ledgers
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Table 1: Recent Purchase Report View */}
          <InvoiceReportTable
            title="Recent Purchase Report View"
            icon={PackageCheck}
            colorClass="indigo"
            headers={["PO Number", "Vendor / Supplier", "Total Amount"]}
            data={(data?.recentPurchases || []).map((p: any) => ({
              col1: p.poNumber,
              col2: p.vendor?.name || p.items?.[0]?.inventoryItem?.name || "Verified Supplier",
              col3: formatCurrency(p.totalAmount),
            }))}
            emptyTitle="No Recent Purchase Orders"
            actionText="+ Create Purchase Order"
            actionHref="/purchases/new"
          />

          {/* Table 2: Recent B2B Sales Details */}
          <InvoiceReportTable
            title="Recent B2B Sales Details"
            icon={Building2}
            colorClass="blue"
            headers={["Invoice Number", "Client / Dealer", "Total Amount"]}
            data={(data?.recentB2BSales || []).map((s: any) => ({
              col1: s.invoiceNum,
              col2: s.customerName || "B2B Franchise Client",
              col3: formatCurrency(s.totalAmount),
            }))}
            emptyTitle="No Recent B2B Invoices"
            actionText="View B2B Invoices"
            actionHref="/sales/invoices"
          />

          {/* Table 3: Recent B2C Sales Details */}
          <InvoiceReportTable
            title="Recent B2C Sales Details"
            icon={Store}
            colorClass="emerald"
            headers={["Receipt Number", "Billed Amount"]}
            data={(data?.recentB2CBills || []).map((s: any) => ({
              col1: `#${s.invoiceNum}`,
              col2: formatCurrency(s.totalAmount),
            }))}
            emptyTitle="No Recent B2C Counter Bills"
            actionText="Open POS Terminal"
            actionHref="/pos"
          />

          {/* Table 4: Top Selling Products of the Week */}
          <InvoiceReportTable
            title="Top Selling Products of the Week"
            icon={TrendingUp}
            colorClass="amber"
            headers={["Product Name", "Volume Sold", "Growth Trend"]}
            data={(data?.topSellers || []).map((p: any) => ({
              col1: p.name,
              col2: `${p.value} ${p.unit || "units"}`,
              col3: `${p.growth || 0}%`,
            }))}
            emptyTitle="No Product Sales Telemetry"
            actionText="Inventory Stock"
            actionHref="/inventory/raw-material-stock"
          />

          {/* Table 5: Stock Urgent Report */}
          <InvoiceReportTable
            title="Stock Urgent Report"
            icon={AlertTriangle}
            colorClass="rose"
            headers={["Raw Material / SKU", "Current Level", "Recommended Action"]}
            data={(data?.lowStock || []).map((p: any) => ({
              col1: p.name,
              col2: `${p.currentStock} ${p.unit || "KG"}`,
              col3: p.action || "Reorder",
            }))}
            emptyTitle="All Stock Levels Healthy"
            actionText="Alerts Center"
            actionHref="/alerts"
          />

          {/* Table 6: Supplier Payment Tracking View */}
          <InvoiceReportTable
            title="Supplier Payment Tracking View"
            icon={CreditCard}
            colorClass="purple"
            headers={["Supplier Name", "PO Reference", "Amount Due"]}
            data={(data?.supplierPaymentsDue || []).map((p: any) => ({
              col1: p.vendor?.name || "Verified Supplier",
              col2: p.poNumber,
              col3: formatCurrency(p.totalAmount),
            }))}
            emptyTitle="No Outstanding Supplier Dues"
            actionText="Vendor Ledgers"
            actionHref="/vendors"
          />
        </div>
      </div>



      {/* ── 7. DATE RANGE MODAL ── */}
      <DateRangePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        startDate={customStartDate}
        endDate={customEndDate}
        onApply={handleApplyCustomDates}
      />

      {/* ── 8. DRILL-DOWN SLIDE-OVER DRAWER ── */}
      <DrillDownDrawer
        isOpen={isDrillDownOpen}
        onClose={() => setIsDrillDownOpen(false)}
        item={drillDownItem}
        period={period}
        outletName={selectedOutletName}
      />
    </div>
  );
}
