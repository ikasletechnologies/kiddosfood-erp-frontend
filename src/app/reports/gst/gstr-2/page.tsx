"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Printer,
  Truck,
  Search,
  DollarSign,
  ArrowDownLeft,
  Receipt,
  Undo2,
  Calendar,
  X,
  RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportExcel, exportPdf } from "../_lib/export";

interface GSTR2Row {
  invoiceNumber: string;
  poNumber: string;
  date: string;
  vendorName: string;
  vendorGstin: string;
  placeOfSupply: string;
  taxableValue: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  cessAmount: number;
  reverseCharge: string;
  totalTax: number;
  eligibleItc: number;
  totalAmount: number;
  status: string;
}

interface DebitNoteRow {
  returnNumber: string;
  date: string;
  vendorName: string;
  vendorGstin: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

type ReportData = { data: GSTR2Row[]; debitNotes: DebitNoteRow[]; totalTaxableValue: number; totalInputGST: number };
const EMPTY: ReportData = { data: [], debitNotes: [], totalTaxableValue: 0, totalInputGST: 0 };

function getDefaultStartDate() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function getDefaultEndDate() {
  return new Date().toISOString().split("T")[0];
}

export default function GSTR2Page() {
  const [result, setResult] = useState<ReportData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"bills" | "debitNotes">("bills");

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
      const res = await reportsApi.getGSTR2({
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
        gstRate: gstRate || undefined,
      });
      setResult({ ...EMPTY, ...(res.data || {}) });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load GSTR-2");
      setResult(EMPTY);
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
    () => Array.from(new Set(result.data.map((r) => r.taxRate))).filter((r) => r != null && !isNaN(r)).sort((a, b) => a - b),
    [result.data]
  );

  const matchesSearch = (r: { vendorName?: string; invoiceNumber?: string; vendorGstin?: string; poNumber?: string; returnNumber?: string; placeOfSupply?: string }) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (r.vendorName || "").toLowerCase().includes(q) ||
      (r.invoiceNumber || "").toLowerCase().includes(q) ||
      (r.returnNumber || "").toLowerCase().includes(q) ||
      (r.vendorGstin || "").toLowerCase().includes(q) ||
      (r.poNumber || "").toLowerCase().includes(q) ||
      (r.placeOfSupply || "").toLowerCase().includes(q)
    );
  };

  const filteredBills = useMemo(() => result.data.filter(matchesSearch), [result.data, search]);
  const filteredDebitNotes = useMemo(() => result.debitNotes.filter(matchesSearch), [result.debitNotes, search]);

  const current = tab === "bills" ? filteredBills : filteredDebitNotes;

  const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const headers =
    tab === "bills"
      ? ["Bill No", "PO No", "Date", "Vendor", "Vendor GSTIN", "Place of Supply", "Tax Rate", "Taxable Value", "RCM", "CGST", "SGST", "IGST", "Cess", "Total Tax", "Eligible ITC", "Bill Value"]
      : ["Return No", "Date", "Vendor", "Vendor GSTIN", "Taxable Value", "CGST", "SGST", "IGST", "Total Tax"];

  const toRows = () =>
    tab === "bills"
      ? (current as GSTR2Row[]).map((r) => [r.invoiceNumber, r.poNumber, r.date, r.vendorName, r.vendorGstin, r.placeOfSupply || "—", r.taxRate != null ? `${r.taxRate}%` : "—", r.taxableValue, r.reverseCharge || "N", r.cgst, r.sgst, r.igst, r.cessAmount ?? 0, r.totalTax, r.eligibleItc, r.totalAmount])
      : (current as DebitNoteRow[]).map((r) => [r.returnNumber, r.date, r.vendorName, r.vendorGstin, r.taxableValue, r.cgst, r.sgst, r.igst, r.totalTax]);

  const filenameBase = `GSTR2_${tab === "bills" ? "Purchase_Bills" : "Debit_Notes"}_${appliedRange.startDate}_${appliedRange.endDate}`;

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5 p-3.5 sm:p-6 text-slate-800 dark:text-slate-100 w-full min-w-0 print:p-0 print:m-0 print:max-w-none">
      {/* ── Print-only Header ── */}
      <div className="hidden print:flex flex-row justify-between items-start border-b-2 border-gray-800 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">GSTR-2 (INWARD SUPPLIES & ITC REGISTER)</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Period: {appliedRange.startDate} to {appliedRange.endDate} &bull; Section: {tab === "bills" ? "Purchase Bills" : "Purchase Debit Notes"}
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
            <Truck size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              GSTR-2 (Inward Supplies)
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Inward supplies & input tax credit — Purchase Bills and Purchase Debit Notes
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          title="Refresh GSTR-2"
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
              placeholder="Search vendor, bill no, PO no, GSTIN, place of supply…"
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

          {/* 2. Date Range & Action Buttons */}
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
                title="Print GSTR-2"
              >
                <Printer className="h-3.5 w-3.5 text-[#f58220]" />
                <span>Print</span>
              </button>
              <button
                onClick={() =>
                  exportPdf(
                    `${filenameBase}.pdf`,
                    "GSTR-2 Inward Supplies",
                    `${tab === "bills" ? "Purchase Bills" : "Debit Notes"} · ${appliedRange.startDate} to ${appliedRange.endDate}`,
                    headers,
                    toRows()
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
                    "GSTR-2",
                    `GSTR-2 Inward Supplies (${tab === "bills" ? "Purchase Bills" : "Debit Notes"})`,
                    headers,
                    toRows()
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
            {fmt(result.totalTaxableValue)}
          </p>
        </div>

        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Input GST / ITC
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 print:hidden">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 print:text-base">
            {fmt(result.totalInputGST)}
          </p>
        </div>

        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Purchase Bills
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 print:hidden">
              <Receipt size={16} />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-gray-900 dark:text-white mt-2 print:text-base">
            {result.data.length}
          </p>
        </div>

        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Debit Notes
            </span>
            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#f58220] print:hidden">
              <Undo2 size={16} />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-[#f58220] mt-2 print:text-base">
            {result.debitNotes.length}
          </p>
        </div>
      </div>

      {/* ── Table Container with Tabs ── */}
      <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
        {/* Tab Selector */}
        <div className="p-3.5 sm:p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shrink-0">
            <button
              onClick={() => setTab("bills")}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                tab === "bills"
                  ? "bg-white dark:bg-card text-[#f58220] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Purchase Bills ({result.data.length})
            </button>
            <button
              onClick={() => setTab("debitNotes")}
              className={clsx(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                tab === "debitNotes"
                  ? "bg-white dark:bg-card text-[#f58220] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Debit Notes ({result.debitNotes.length})
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-slate-400 font-medium">
            Showing <span className="font-bold text-gray-900 dark:text-white">{current.length}</span> records
            {search && <span> matching &ldquo;{search}&rdquo;</span>}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto custom-scrollbar w-full min-w-0 print:overflow-visible">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-6 w-6 text-[#f58220] animate-spin" />
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Loading GSTR-2 records…</p>
            </div>
          ) : current.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-center px-4">
              <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl text-gray-400">
                <Truck size={32} />
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-slate-200">
                No {tab === "bills" ? "purchase bills" : "debit notes"} found
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm">
                {search
                  ? `No records matching "${search}" for the selected period.`
                  : "No transaction records match the selected date range and filter criteria."}
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
          ) : tab === "bills" ? (
            <table className="w-full text-xs text-left border-collapse min-w-[1200px] print:min-w-0 print:text-[9pt]">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 print:bg-gray-100">
                  {headers.map((h, i) => (
                    <th
                      key={h}
                      className={clsx(
                        "px-3.5 py-3 font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider whitespace-nowrap print:text-black print:px-2 print:py-1.5",
                        i >= 6 && i !== 8 && "text-right",
                        i === 8 && "text-center"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 print:divide-gray-200">
                {filteredBills.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                    <td className="px-3.5 py-2.5 font-bold text-[#f58220] whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.invoiceNumber}</td>
                    <td className="px-3.5 py-2.5 text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.poNumber || "—"}</td>
                    <td className="px-3.5 py-2.5 text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.date}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-gray-900 dark:text-white max-w-[180px] truncate print:text-black print:px-2 print:py-1.5">{r.vendorName}</td>
                    <td className="px-3.5 py-2.5 text-gray-600 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.vendorGstin || "—"}</td>
                    <td className="px-3.5 py-2.5 text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.placeOfSupply || "—"}</td>
                    <td className="px-3.5 py-2.5 text-right text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.taxRate}%</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-medium text-gray-900 dark:text-white whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.taxableValue)}</td>
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap print:px-2 print:py-1.5">
                      <span className={clsx("px-2 py-0.5 rounded-md text-[10px] font-bold border print:border-none print:p-0", r.reverseCharge === "Y" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10")}>
                        {r.reverseCharge || "N"}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.cgst)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.sgst)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.igst)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.cessAmount || 0)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.totalTax)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.eligibleItc)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-[#f58220] whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs text-left border-collapse min-w-[800px] print:min-w-0 print:text-[9pt]">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 print:bg-gray-100">
                  {headers.map((h, i) => (
                    <th
                      key={h}
                      className={clsx(
                        "px-3.5 py-3 font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider whitespace-nowrap print:text-black print:px-2 print:py-1.5",
                        i >= 4 && "text-right"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 print:divide-gray-200">
                {filteredDebitNotes.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                    <td className="px-3.5 py-2.5 font-bold text-[#f58220] whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.returnNumber}</td>
                    <td className="px-3.5 py-2.5 text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.date}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-gray-900 dark:text-white max-w-[180px] truncate print:text-black print:px-2 print:py-1.5">{r.vendorName}</td>
                    <td className="px-3.5 py-2.5 text-gray-600 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap print:text-black print:px-2 print:py-1.5">{r.vendorGstin || "—"}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-medium text-gray-900 dark:text-white whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.taxableValue)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.cgst)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.sgst)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.igst)}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap print:text-black print:px-2 print:py-1.5">{fmt(r.totalTax)}</td>
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
