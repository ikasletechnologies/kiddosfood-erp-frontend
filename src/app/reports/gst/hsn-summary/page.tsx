"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Printer,
  Package,
  Search,
  DollarSign,
  Receipt,
  Calendar,
  X,
  RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportExcel, exportPdf } from "../_lib/export";

interface HsnRow {
  hsn: string;
  productName: string;
  unit: string;
  quantity: number;
  gstRate: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalValue: number;
}

function getDefaultStartDate() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function getDefaultEndDate() {
  return new Date().toISOString().split("T")[0];
}

export default function HsnSummaryPage() {
  const [rows, setRows] = useState<HsnRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Single date filter state: inputs for editing, applied for data fetching
  const [fromInput, setFromInput] = useState(getDefaultStartDate);
  const [toInput, setToInput] = useState(getDefaultEndDate);
  const [appliedRange, setAppliedRange] = useState({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  });

  const [search, setSearch] = useState("");
  const [gstRate, setGstRate] = useState("");

  // Only commit date range when BOTH from and to dates are fully specified and valid (from <= to)
  useEffect(() => {
    if (fromInput && toInput && fromInput <= toInput) {
      if (fromInput !== appliedRange.startDate || toInput !== appliedRange.endDate) {
        setAppliedRange({ startDate: fromInput, endDate: toInput });
      }
    }
  }, [fromInput, toInput, appliedRange.startDate, appliedRange.endDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getHsnSummary({
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
        gstRate: gstRate || undefined,
      });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load HSN summary");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedRange.startDate, appliedRange.endDate, gstRate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResetFilters = () => {
    const defaultStart = getDefaultStartDate();
    const defaultEnd = getDefaultEndDate();
    setFromInput(defaultStart);
    setToInput(defaultEnd);
    setAppliedRange({ startDate: defaultStart, endDate: defaultEnd });
    setSearch("");
    setGstRate("");
  };

  const isFiltered =
    search.trim() !== "" ||
    gstRate !== "" ||
    fromInput !== getDefaultStartDate() ||
    toInput !== getDefaultEndDate();

  const rates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.gstRate))).filter((r) => r != null && !isNaN(r)).sort((a, b) => a - b),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          (r.productName || "").toLowerCase().includes(q) ||
          (r.hsn || "").toLowerCase().includes(q) ||
          (r.unit || "").toLowerCase().includes(q)
        );
      }),
    [rows, search]
  );

  const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totals = filtered.reduce(
    (acc, r) => ({
      taxableValue: acc.taxableValue + (r.taxableValue || 0),
      totalValue: acc.totalValue + (r.totalValue || 0),
      cgstAmount: acc.cgstAmount + (r.cgstAmount || 0),
      sgstAmount: acc.sgstAmount + (r.sgstAmount || 0),
      igstAmount: acc.igstAmount + (r.igstAmount || 0),
    }),
    { taxableValue: 0, totalValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 }
  );

  const headers = ["HSN Code", "Product", "UOM", "Quantity", "GST Rate", "Taxable Value", "CGST", "SGST", "IGST", "Total Value"];
  const toRows = filtered.map((r) => [r.hsn, r.productName, r.unit, r.quantity, r.gstRate != null ? `${r.gstRate}%` : "—", r.taxableValue, r.cgstAmount, r.sgstAmount, r.igstAmount, r.totalValue]);
  const filenameBase = `SalesSummaryHSN_${appliedRange.startDate}_${appliedRange.endDate}`;

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5 p-3.5 sm:p-6 text-slate-800 dark:text-slate-100 w-full min-w-0 print:p-0 print:m-0 print:max-w-none">
      {/* ── Print-only Header ── */}
      <div className="hidden print:flex flex-row justify-between items-start border-b-2 border-gray-800 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">SALES SUMMARY (HSN CODE-WISE)</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Period: {appliedRange.startDate} to {appliedRange.endDate}
            {search && ` &bull; Search: "${search}"`}
          </p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <p className="font-bold text-gray-900">Kiddos Food</p>
          <p>GSTIN: 33AAAAA0000A1Z5</p>
          <p className="text-[10px] text-gray-400">Date: {new Date().toLocaleDateString("en-IN")}</p>
        </div>
      </div>

      {/* ── Screen Page Header ── */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-white/10 pb-4 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Package size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Sales Summary (HSN)
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Goods sales grouped by Harmonized System of Nomenclature (HSN) code
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          title="Refresh HSN Summary"
          className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <RefreshCw size={15} className={clsx(loading && "animate-spin text-[#f58220]")} />
        </button>
      </div>

      {/* ── Main Filter Bar (Single Date Filter + Search) ── */}
      <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xs print:hidden">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* 1. Search Bar */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product name, HSN code, or unit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm bg-gray-50/50 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-md"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 2. Date Range & Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* From Date */}
            <div className="flex items-center gap-1.5 bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 flex-1 sm:flex-none min-w-[130px]">
              <Calendar size={13} className="text-gray-400 shrink-0" />
              <span className="text-[11px] font-bold text-gray-400 uppercase">From</span>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="text-xs font-semibold bg-transparent text-gray-800 dark:text-slate-200 focus:outline-none w-full cursor-pointer"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1.5 bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 flex-1 sm:flex-none min-w-[130px]">
              <Calendar size={13} className="text-gray-400 shrink-0" />
              <span className="text-[11px] font-bold text-gray-400 uppercase">To</span>
              <input
                type="date"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="text-xs font-semibold bg-transparent text-gray-800 dark:text-slate-200 focus:outline-none w-full cursor-pointer"
              />
            </div>

            {/* GST Rate Select */}
            {rates.length > 0 && (
              <select
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                className="text-xs border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-2 font-medium bg-gray-50/50 dark:bg-white/5 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#f58220]/20 focus:border-[#f58220] cursor-pointer"
              >
                <option value="">All Rates</option>
                {rates.map((r) => (
                  <option key={r} value={r}>
                    {r}% Rate
                  </option>
                ))}
              </select>
            )}

            {/* Reset Button */}
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Reset filters"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {/* Print & PDF Actions */}
            <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-gray-200 dark:border-white/10">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
                title="Print HSN Summary"
              >
                <Printer className="h-3.5 w-3.5 text-[#f58220]" />
                <span>Print</span>
              </button>
              <button
                onClick={() =>
                  exportPdf(
                    `${filenameBase}.pdf`,
                    "Sales Summary (HSN)",
                    `${appliedRange.startDate} to ${appliedRange.endDate}`,
                    headers,
                    toRows
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
                title="Export PDF"
              >
                <FileText className="h-3.5 w-3.5 text-rose-500" />
                <span>PDF</span>
              </button>
              <button
                onClick={() =>
                  exportExcel(
                    `${filenameBase}.xlsx`,
                    "HSN Summary",
                    "Sales Summary (HSN Code-wise)",
                    headers,
                    toRows
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
                title="Export Excel"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Excel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0 print:grid-cols-4 print:gap-2">
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Taxable Value
            </span>
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#f58220] print:hidden">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-gray-900 dark:text-white mt-2 print:text-base">
            {fmt(totals.taxableValue)}
          </p>
        </div>

        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Total GST
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 print:hidden">
              <Receipt size={16} />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 print:text-base">
            {fmt(totals.cgstAmount + totals.sgstAmount + totals.igstAmount)}
          </p>
        </div>

        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Total Value
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 print:hidden">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-gray-900 dark:text-white mt-2 print:text-base">
            {fmt(totals.totalValue)}
          </p>
        </div>

        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              HSN Lines
            </span>
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#f58220] print:hidden">
              <Package size={16} />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-[#f58220] mt-2 print:text-base">
            {filtered.length}
          </p>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
        <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between print:hidden">
          <span className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200">
            HSN Summary Records
          </span>
          <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">
            Showing <span className="font-bold text-gray-900 dark:text-white">{filtered.length}</span> items
            {search && <span> matching &ldquo;{search}&rdquo;</span>}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto custom-scrollbar w-full min-w-0 print:overflow-visible">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-6 w-6 text-[#f58220] animate-spin" />
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Loading HSN summary records…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-center px-4">
              <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl text-gray-400">
                <Package size={32} />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-slate-200">No goods sales found</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm">
                {search
                  ? `No goods items matching "${search}" in this period.`
                  : "No items matching the selected criteria have been sold in this period."}
              </p>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="mt-2 px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 text-xs font-bold rounded-xl text-gray-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse min-w-[850px] print:min-w-0 print:text-[9pt]">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 print:bg-gray-100">
                  {headers.map((h, i) => (
                    <th
                      key={h}
                      className={clsx(
                        "px-3.5 py-3 font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider whitespace-nowrap print:text-black print:px-2 print:py-1.5",
                        i >= 3 && "text-right"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 print:divide-gray-200">
                {filtered.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                    <td className="px-3.5 py-2.5 font-bold text-[#f58220] whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.hsn || "—"}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-gray-900 dark:text-white max-w-[200px] truncate print:text-black print:px-2 print:py-1.5">{r.productName}</td>
                    <td className="px-3.5 py-2.5 text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.unit || "NOS"}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-900 dark:text-white whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.quantity}</td>
                    <td className="px-3.5 py-2.5 text-right text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.gstRate}%</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-medium text-gray-900 dark:text-white whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.taxableValue)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.cgstAmount)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.sgstAmount)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.igstAmount)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-[#f58220] whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
