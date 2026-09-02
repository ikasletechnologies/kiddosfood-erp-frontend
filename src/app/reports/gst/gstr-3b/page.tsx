"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  FileText,
  Printer,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Calendar,
  Search,
  X,
  RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportExcel, exportPdf } from "../_lib/export";

interface OutwardRow { description: string; taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }
interface ItcRow { description: string; igst: number; cgst: number; sgst: number; cess: number }
interface ReportData {
  outwardSupplies: OutwardRow[];
  interStateSupplies: { description: string; taxableValue: number; integratedTax: number }[];
  eligibleITC: { available: ItcRow[]; ineligible: ItcRow[] };
  netGstLiability: { cgst: number; sgst: number; igst: number };
  summary: { totalOutputTax: number; totalInputTax: number; netGstPayable: number };
}

const EMPTY: ReportData = {
  outwardSupplies: [],
  interStateSupplies: [],
  eligibleITC: { available: [], ineligible: [] },
  netGstLiability: { cgst: 0, sgst: 0, igst: 0 },
  summary: { totalOutputTax: 0, totalInputTax: 0, netGstPayable: 0 },
};

function getDefaultStartDate() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function getDefaultEndDate() {
  return new Date().toISOString().split("T")[0];
}

export default function GSTR3BPage() {
  const [data, setData] = useState<ReportData>(EMPTY);
  const [loading, setLoading] = useState(true);

  // Single date filter state: inputs for editing, applied for data fetching
  const [fromInput, setFromInput] = useState(getDefaultStartDate);
  const [toInput, setToInput] = useState(getDefaultEndDate);
  const [appliedRange, setAppliedRange] = useState({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  });

  const [search, setSearch] = useState("");

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
      const res = await reportsApi.getGSTR3B({
        startDate: appliedRange.startDate,
        endDate: appliedRange.endDate,
      });
      setData({ ...EMPTY, ...(res.data || {}) });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load GSTR-3B");
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [appliedRange.startDate, appliedRange.endDate]);

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
  };

  const isFiltered =
    search.trim() !== "" ||
    fromInput !== getDefaultStartDate() ||
    toInput !== getDefaultEndDate();

  const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filterItem = (text: string) => {
    if (!search.trim()) return true;
    return text.toLowerCase().includes(search.trim().toLowerCase());
  };

  const filteredOutward = useMemo(
    () => data.outwardSupplies.filter((r) => filterItem(r.description)),
    [data.outwardSupplies, search]
  );

  const filteredItc = useMemo(
    () => data.eligibleITC.available.filter((r) => filterItem(r.description)),
    [data.eligibleITC.available, search]
  );

  const headers = ["Section", "Description", "Taxable Value", "CGST", "SGST", "IGST"];
  const rows: (string | number)[][] = [
    ...filteredOutward.map((r) => ["3.1 Outward", r.description, r.taxableValue, r.cgst, r.sgst, r.igst]),
    ...filteredItc.map((r) => ["4 Eligible ITC", r.description, "", r.cgst, r.sgst, r.igst]),
    ["6 Net GST Payable", "Payable after component-wise ITC utilisation", "", data.netGstLiability.cgst, data.netGstLiability.sgst, data.netGstLiability.igst],
  ];
  const filenameBase = `GSTR3B_${appliedRange.startDate}_${appliedRange.endDate}`;

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5 p-3.5 sm:p-6 text-slate-800 dark:text-slate-100 w-full min-w-0 print:p-0 print:m-0 print:max-w-none">
      {/* ── Print-only Header ── */}
      <div className="hidden print:flex flex-row justify-between items-start border-b-2 border-gray-800 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">GSTR-3B (MONTHLY SUMMARY RETURN)</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Return Period: {appliedRange.startDate} to {appliedRange.endDate}
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
            <Receipt size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              GSTR-3B (Monthly Summary)
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Auto-consolidated output GST liability, eligible ITC and net payable
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          title="Refresh GSTR-3B"
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
              placeholder="Search supply or ITC category description…"
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
                title="Print GSTR-3B"
              >
                <Printer className="h-3.5 w-3.5 text-[#f58220]" />
                <span>Print</span>
              </button>
              <button
                onClick={() =>
                  exportPdf(
                    `${filenameBase}.pdf`,
                    "GSTR-3B Summary",
                    `${appliedRange.startDate} to ${appliedRange.endDate}`,
                    headers,
                    rows
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
                title="Export PDF"
              >
                <FileText className="h-3.5 w-3.5 text-rose-500" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-28 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 text-[#f58220] animate-spin" />
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Consolidating GSTR-3B records…</p>
        </div>
      ) : (
        <>
          {/* ── KPI Summary Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0 print:grid-cols-3 print:gap-2">
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Output GST Liability
                </span>
                <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#f58220] print:hidden">
                  <ArrowUpRight size={16} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-gray-900 dark:text-white mt-2 print:text-base">
                {fmt(data.summary.totalOutputTax)}
              </p>
            </div>

            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Eligible ITC
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 print:hidden">
                  <ArrowDownLeft size={16} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 print:text-base">
                {fmt(data.summary.totalInputTax)}
              </p>
            </div>

            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Net GST Payable
                </span>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 print:hidden">
                  <Wallet size={16} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[#f58220] mt-2 print:text-base">
                {fmt(data.summary.netGstPayable)}
              </p>
            </div>
          </div>

          {/* ── 3.1 Outward Taxable Supplies ── */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200 bg-gray-50/50 dark:bg-white/[0.02]">
              3.1 Outward Taxable Supplies ({filteredOutward.length})
            </div>
            <div className="overflow-x-auto custom-scrollbar print:overflow-visible">
              <table className="w-full text-xs text-left border-collapse min-w-[600px] print:min-w-0 print:text-[9pt]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 print:bg-gray-100">
                    <th className="px-4 py-2.5 font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">Description</th>
                    <th className="px-4 py-2.5 text-right font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">Taxable Value</th>
                    <th className="px-4 py-2.5 text-right font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">CGST</th>
                    <th className="px-4 py-2.5 text-right font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">SGST</th>
                    <th className="px-4 py-2.5 text-right font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">IGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 print:divide-gray-200">
                  {filteredOutward.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white print:text-black">{r.description}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-900 dark:text-white print:text-black">{fmt(r.taxableValue)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 print:text-black">{fmt(r.cgst)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 print:text-black">{fmt(r.sgst)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 print:text-black">{fmt(r.igst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 4. Eligible ITC ── */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200 bg-gray-50/50 dark:bg-white/[0.02]">
              4. Eligible ITC (Input Tax Credit) ({filteredItc.length})
            </div>
            <div className="overflow-x-auto custom-scrollbar print:overflow-visible">
              <table className="w-full text-xs text-left border-collapse min-w-[500px] print:min-w-0 print:text-[9pt]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 print:bg-gray-100">
                    <th className="px-4 py-2.5 font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">Description</th>
                    <th className="px-4 py-2.5 text-right font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">CGST</th>
                    <th className="px-4 py-2.5 text-right font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">SGST</th>
                    <th className="px-4 py-2.5 text-right font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">IGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 print:divide-gray-200">
                  {filteredItc.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white print:text-black">{r.description}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium print:text-black">{fmt(r.cgst)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium print:text-black">{fmt(r.sgst)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium print:text-black">{fmt(r.igst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 6. Net GST Payable ── */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200 bg-gray-50/50 dark:bg-white/[0.02]">
              6. Net GST Payable (after component-wise ITC utilisation)
            </div>
            <div className="overflow-x-auto custom-scrollbar print:overflow-visible">
              <table className="w-full text-xs text-left border-collapse min-w-[300px] print:min-w-0 print:text-[9pt]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 print:bg-gray-100">
                    <th className="px-4 py-2.5 font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">Tax Head</th>
                    <th className="px-4 py-2.5 text-right font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">Net Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 print:divide-gray-200">
                  <tr className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white print:text-black">Central Tax (CGST)</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900 dark:text-white print:text-black">{fmt(data.netGstLiability.cgst)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white print:text-black">State Tax (SGST)</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900 dark:text-white print:text-black">{fmt(data.netGstLiability.sgst)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white print:text-black">Integrated Tax (IGST)</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-900 dark:text-white print:text-black">{fmt(data.netGstLiability.igst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
