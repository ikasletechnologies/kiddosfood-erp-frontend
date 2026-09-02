"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Printer,
  FileDown,
  ChevronDown,
  Package,
  AlertCircle,
  RefreshCw,
  X,
  Filter,
  Layers,
  Calendar
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";

export interface StockSummaryItem {
  id?: string;
  itemName: string;
  sku?: string;
  category?: string;
  unit?: string;
  salePrice: number;
  purchasePrice: number;
  stockQty: number;
  availableQty: number;
  qtyForSale: number;
  reservedQty: number;
  stockValue: number;
}

const DATE_PRESETS = [
  "This Month",
  "Today",
  "Yesterday",
  "This Week",
  "Last 7 Days",
  "Last Month",
  "This Quarter",
  "This Year",
  "Custom"
];

function getDateRange(
  preset: string,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = iso(now);

  if (preset === "Custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  if (preset === "Today") return { from: today, to: today };
  if (preset === "Yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: iso(y), to: iso(y) };
  }
  if (preset === "This Week") {
    const start = new Date(now);
    const day = start.getDay();
    const offset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - offset);
    return { from: iso(start), to: today };
  }
  if (preset === "Last 7 Days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { from: iso(start), to: today };
  }
  if (preset === "Last Month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(start), to: iso(end) };
  }
  if (preset === "This Quarter") {
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), startMonth, 1);
    return { from: iso(start), to: today };
  }
  if (preset === "This Year") {
    return { from: `${now.getFullYear()}-01-01`, to: today };
  }
  // Default: This Month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(start), to: today };
}

function fmtCurrency(val: number | undefined | null): string {
  const num = Number(val || 0);
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDisplayDate(isoStr?: string): string {
  if (!isoStr) return "—";
  const [y, m, d] = isoStr.split("-");
  if (!y || !m || !d) return isoStr;
  return `${d}/${m}/${y}`;
}

export default function StockSummaryReport() {
  const [reportData, setReportData] = useState<StockSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [datePreset, setDatePreset] = useState("This Month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showInStockOnly, setShowInStockOnly] = useState(false);

  const fetchStockSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const franchiseId =
        typeof window !== "undefined"
          ? localStorage.getItem("selectedFranchiseId") || undefined
          : undefined;

      const { from, to } = getDateRange(
        datePreset,
        customStartDate,
        customEndDate
      );

      const params: Record<string, any> = {
        franchiseId,
        startDate: from,
        endDate: to,
      };

      if (selectedCategory !== "ALL") {
        params.category = selectedCategory;
      }

      const res = await reportsApi.getStockSummary(params);
      const data = res.data;
      const rows = Array.isArray(data) ? data : data?.rows || [];

      const formatted: StockSummaryItem[] = rows.map((r: any) => {
        const salePrice = Number(
          r.salePrice ?? r.sellingPrice ?? r.customerPrice ?? r.basePrice ?? 0
        );
        const purchasePrice = Number(
          r.purchasePrice ?? r.costPrice ?? 0
        );
        const stockQty = Number(
          r.stockQty ?? r.currentStock ?? r.quantity ?? 0
        );
        const reservedQty = Number(
          r.reservedQty ?? r.reservedStock ?? 0
        );
        const availableQty = Number(
          r.availableQty ?? r.availableStock ?? Math.max(0, stockQty - reservedQty)
        );
        const qtyForSale = Number(
          r.qtyForSale ?? availableQty
        );
        const stockValue = Number(
          r.stockValue ?? (stockQty > 0 ? stockQty * purchasePrice : 0)
        );

        return {
          id: r.id,
          itemName: r.itemName || r.name || "—",
          sku: r.sku || "",
          category: r.category ? String(r.category).toUpperCase() : "",
          unit: r.unit || "",
          salePrice,
          purchasePrice,
          stockQty,
          availableQty,
          qtyForSale,
          reservedQty,
          stockValue,
        };
      });

      setReportData(formatted);
    } catch (err: any) {
      console.error("Failed to load stock summary:", err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Unable to load Stock Summary. Please try again."
      );
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [datePreset, customStartDate, customEndDate, selectedCategory]);

  useEffect(() => {
    fetchStockSummary();
  }, [fetchStockSummary]);

  // Dynamic Category Options from data + default list
  const categoryOptions = useMemo(() => {
    const catSet = new Set<string>();
    reportData.forEach((item) => {
      if (item.category) catSet.add(item.category);
    });

    const standardCats = [
      "RAW_MATERIAL",
      "SEMI_FINISHED",
      "FINISHED_GOOD",
      "PACKAGING",
    ];
    standardCats.forEach((c) => catSet.add(c));

    const list = Array.from(catSet).map((cat) => ({
      value: cat,
      label: cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    }));

    return [{ value: "ALL", label: "All Categories" }, ...list];
  }, [reportData]);

  // Combined Filtering
  const filteredData = useMemo(() => {
    return reportData.filter((row) => {
      // 1. Search filter (item name or SKU)
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        row.itemName.toLowerCase().includes(term) ||
        (row.sku && row.sku.toLowerCase().includes(term));

      // 2. Show in stock toggle (stockQty > 0)
      const matchesStock = showInStockOnly ? row.stockQty > 0 : true;

      // 3. Category filter
      let matchesCat = true;
      if (selectedCategory !== "ALL") {
        const cat = row.category || "";
        matchesCat = cat === selectedCategory || cat.startsWith(selectedCategory);
      }

      return matchesSearch && matchesStock && matchesCat;
    });
  }, [reportData, searchTerm, showInStockOnly, selectedCategory]);

  // Dynamic Totals computed strictly from filtered data
  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, r) => ({
        stockQty: acc.stockQty + r.stockQty,
        availableQty: acc.availableQty + r.availableQty,
        qtyForSale: acc.qtyForSale + r.qtyForSale,
        reservedQty: acc.reservedQty + r.reservedQty,
        stockValue: acc.stockValue + r.stockValue,
      }),
      {
        stockQty: 0,
        availableQty: 0,
        qtyForSale: 0,
        reservedQty: 0,
        stockValue: 0,
      }
    );
  }, [filteredData]);

  const { from, to } = getDateRange(
    datePreset,
    customStartDate,
    customEndDate
  );
  const displayPeriod = `${fmtDisplayDate(from)} to ${fmtDisplayDate(to)}`;

  // Print Report
  const handlePrint = () => {
    toast.success("Preparing print view...");
    window.print();
  };

  // PDF / Document generation
  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("Please enable pop-ups to generate PDF/Print");
      return;
    }

    const tableRows = filteredData
      .map(
        (r) => `
        <tr>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">
            ${r.itemName} ${r.sku ? `<span style="font-size: 10px; color: #64748b;">(${r.sku})</span>` : ""}
          </td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${fmtCurrency(r.salePrice)}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${fmtCurrency(r.purchasePrice)}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${r.stockQty.toLocaleString()} ${r.unit || ""}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${r.availableQty.toLocaleString()} ${r.unit || ""}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${r.qtyForSale.toLocaleString()} ${r.unit || ""}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: ${r.reservedQty > 0 ? "#ea580c" : "#64748b"};">${r.reservedQty.toLocaleString()} ${r.unit || ""}</td>
          <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${fmtCurrency(r.stockValue)}</td>
        </tr>`
      )
      .join("");

    const totalRowHtml = `
      <tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #0f172a;">
        <td style="padding: 8px 10px;">TOTAL</td>
        <td style="padding: 8px 10px; text-align: right;">—</td>
        <td style="padding: 8px 10px; text-align: right;">—</td>
        <td style="padding: 8px 10px; text-align: right;">${totals.stockQty.toLocaleString()}</td>
        <td style="padding: 8px 10px; text-align: right;">${totals.availableQty.toLocaleString()}</td>
        <td style="padding: 8px 10px; text-align: right;">${totals.qtyForSale.toLocaleString()}</td>
        <td style="padding: 8px 10px; text-align: right;">${totals.reservedQty.toLocaleString()}</td>
        <td style="padding: 8px 10px; text-align: right; color: #047857;">${fmtCurrency(totals.stockValue)}</td>
      </tr>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Stock Summary Report — ${displayPeriod}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; font-size: 11px; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #ea580c; padding-bottom: 8px; margin-bottom: 12px; }
            .title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; }
            .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background-color: #f1f5f9; padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 1px solid #cbd5e1; }
            th.text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Stock Summary Report</h1>
              <div class="meta">Period: <strong>${displayPeriod}</strong> &bull; Filter: <strong>${selectedCategory}</strong> &bull; Total Items: <strong>${filteredData.length}</strong></div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th class="text-right">Sale Price</th>
                <th class="text-right">Purchase Price</th>
                <th class="text-right">Stock Qty</th>
                <th class="text-right">Available Qty</th>
                <th class="text-right">Qty for Sale</th>
                <th class="text-right">Reserved Qty</th>
                <th class="text-right">Stock Value</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              ${totalRowHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">
      {/* ── Page Header Bar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs w-full min-w-0 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-lg shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Stock Summary
            </h1>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs"
            title="Download PDF"
          >
            <FileDown className="h-4 w-4 text-gray-500 dark:text-slate-400" />
            <span className="hidden xs:inline">PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs"
            title="Print Report"
          >
            <Printer className="h-4 w-4 text-gray-500 dark:text-slate-400" />
            <span className="hidden xs:inline">Print</span>
          </button>
          <button
            onClick={fetchStockSummary}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-orange-500")} />
          </button>
        </div>
      </div>

      {/* ── Main Content Body ── */}
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">
        {/* ── Filters Toolbar ── */}
        <div className="bg-white dark:bg-card p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex flex-wrap items-center justify-between gap-3 w-full min-w-0 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] xs:min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-[#f58220] transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220] transition"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="dark:bg-card">
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>

            {/* Date Preset Filter */}
            <div className="relative shrink-0">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220] transition"
              >
                {DATE_PRESETS.map((preset) => (
                  <option key={preset} value={preset} className="dark:bg-card">
                    {preset}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>

            {/* Custom Date Inputs */}
            {datePreset === "Custom" && (
              <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-[#13151f] text-xs shrink-0">
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

          {/* Show items in stock toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showInStockOnly}
                onChange={(e) => setShowInStockOnly(e.target.checked)}
                className="w-4 h-4 rounded text-[#f58220] border-gray-300 dark:border-slate-700 focus:ring-[#f58220] accent-[#f58220]"
              />
              <span>Show items in stock</span>
            </label>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchStockSummary}
              className="px-2.5 py-1 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/30 rounded-lg font-bold transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Main Stock Summary Table Container ── */}
        <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-wider">
                Stock Summary
              </span>
              <span className="text-[11px] text-gray-400 dark:text-slate-500">
                ({displayPeriod})
              </span>
            </div>
            <span className="text-xs font-medium text-gray-400 dark:text-slate-500 shrink-0 ml-2">
              {filteredData.length} items
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
            {loading ? (
              <div className="py-16 flex flex-col justify-center items-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-[#f58220]" />
                <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
                  Loading stock data...
                </span>
              </div>
            ) : (
              <table className="w-full text-left min-w-[860px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-[11px] font-bold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Item Name
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Sale Price
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Purchase Price
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Stock Qty
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Available Qty
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Qty for Sale
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Reserved Qty
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Stock Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs font-medium">
                  {filteredData.length > 0 ? (
                    filteredData.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        className="hover:bg-orange-50/20 dark:hover:bg-orange-500/5 transition-colors"
                      >
                        {/* Item Name */}
                        <td className="px-4 sm:px-5 py-3.5 text-gray-900 dark:text-white font-semibold">
                          <div className="flex flex-col">
                            <span>{row.itemName}</span>
                            {row.sku && (
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                                {row.sku}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Sale Price */}
                        <td className="px-4 sm:px-5 py-3.5 text-right font-mono text-gray-700 dark:text-slate-200">
                          {fmtCurrency(row.salePrice)}
                        </td>

                        {/* Purchase Price */}
                        <td className="px-4 sm:px-5 py-3.5 text-right font-mono text-gray-700 dark:text-slate-200">
                          {fmtCurrency(row.purchasePrice)}
                        </td>

                        {/* Stock Qty */}
                        <td
                          className={clsx(
                            "px-4 sm:px-5 py-3.5 text-right font-mono font-bold",
                            row.stockQty < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-gray-900 dark:text-white"
                          )}
                        >
                          {row.stockQty.toLocaleString()} {row.unit}
                        </td>

                        {/* Available Qty */}
                        <td className="px-4 sm:px-5 py-3.5 text-right font-mono text-gray-700 dark:text-slate-200">
                          {row.availableQty.toLocaleString()} {row.unit}
                        </td>

                        {/* Qty for Sale */}
                        <td className="px-4 sm:px-5 py-3.5 text-right font-mono text-gray-700 dark:text-slate-200">
                          {row.qtyForSale.toLocaleString()} {row.unit}
                        </td>

                        {/* Reserved Qty */}
                        <td
                          className={clsx(
                            "px-4 sm:px-5 py-3.5 text-right font-mono",
                            row.reservedQty > 0
                              ? "text-orange-600 dark:text-orange-400 font-bold"
                              : "text-gray-400 dark:text-slate-500"
                          )}
                        >
                          {row.reservedQty.toLocaleString()} {row.unit}
                        </td>

                        {/* Stock Value */}
                        <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {fmtCurrency(row.stockValue)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-16 text-center text-xs text-gray-400 dark:text-slate-500"
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="h-6 w-6 text-gray-300 dark:text-slate-600" />
                          <span>
                            {searchTerm || selectedCategory !== "ALL" || showInStockOnly
                              ? "No stock records match the selected filters."
                              : "No stock records found."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* ── TOTAL ROW ── */}
                {!loading && filteredData.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50/90 dark:bg-white/[0.04] border-t-2 border-gray-300 dark:border-white/10 font-bold text-xs text-gray-900 dark:text-white">
                      <td className="px-4 sm:px-5 py-3.5 uppercase tracking-wider font-extrabold text-[#f58220]">
                        TOTAL
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right text-gray-400 dark:text-slate-500">
                        —
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right text-gray-400 dark:text-slate-500">
                        —
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-black text-gray-900 dark:text-white">
                        {totals.stockQty.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-bold text-gray-800 dark:text-slate-200">
                        {totals.availableQty.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-bold text-gray-800 dark:text-slate-200">
                        {totals.qtyForSale.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-bold text-orange-600 dark:text-orange-400">
                        {totals.reservedQty.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {fmtCurrency(totals.stockValue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
