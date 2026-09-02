"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  FileText,
  Printer,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Search,
  X,
  RotateCcw,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportExcel, exportPdf } from "../_lib/export";

interface OutwardRow { category: string; taxableValue: number; cgst: number; sgst: number; igst: number; cess: number }
interface ItcSummary { taxableValue: number; cgst: number; sgst: number; igst: number; cess: number; total: number }
interface Reconciliation { totalOutputGst: number; eligibleItc: number; netGstPayable: number }
interface ReportData {
  financialYear: string;
  outwardSupplies: OutwardRow[];
  itcSummary: ItcSummary;
  reconciliation: Reconciliation;
}

const EMPTY: ReportData = {
  financialYear: "",
  outwardSupplies: [],
  itcSummary: { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 },
  reconciliation: { totalOutputGst: 0, eligibleItc: 0, netGstPayable: 0 },
};

function currentFinancialYear() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export default function GSTR9Page() {
  const [data, setData] = useState<ReportData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());
  const [search, setSearch] = useState("");

  const fyOptions = useMemo(() => {
    const [y] = currentFinancialYear().split("-").map(Number);
    return Array.from({ length: 5 }, (_, i) => y - i).map((year) => `${year}-${year + 1}`);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getGSTR9({ financialYear });
      setData({ ...EMPTY, ...(res.data || {}) });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load GSTR-9");
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [financialYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResetFilters = () => {
    setFinancialYear(currentFinancialYear());
    setSearch("");
  };

  const isFiltered = search.trim() !== "" || financialYear !== currentFinancialYear();

  const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const [fyStartYear] = financialYear.split("-");
  const periodLabel = fyStartYear ? `01/04/${fyStartYear} – 31/03/${Number(fyStartYear) + 1}` : "";

  const filterItem = (text: string) => {
    if (!search.trim()) return true;
    return text.toLowerCase().includes(search.trim().toLowerCase());
  };

  const filteredOutward = useMemo(
    () => data.outwardSupplies.filter((r) => filterItem(r.category)),
    [data.outwardSupplies, search]
  );

  const outwardHeaders = ["Category", "Taxable Value", "CGST", "SGST", "IGST", "Cess"];
  const outwardRows = filteredOutward.map((r) => [r.category, r.taxableValue, r.cgst, r.sgst, r.igst, r.cess]);

  const itcHeaders = ["Eligible Purchases Taxable Value", "Eligible CGST", "Eligible SGST", "Eligible IGST", "Eligible Cess", "Total Eligible ITC"];
  const itcRows = [[data.itcSummary.taxableValue, data.itcSummary.cgst, data.itcSummary.sgst, data.itcSummary.igst, data.itcSummary.cess, data.itcSummary.total]];

  const allHeaders = ["Section", ...outwardHeaders];
  const allRows: (string | number)[][] = [
    ...outwardRows.map((r) => ["Outward Supplies", ...r]),
    ["ITC Summary", "Eligible Purchases", data.itcSummary.taxableValue, data.itcSummary.cgst, data.itcSummary.sgst, data.itcSummary.igst, data.itcSummary.cess],
    ["Reconciliation", "Output GST", data.reconciliation.totalOutputGst, "", "", "", ""],
    ["Reconciliation", "Eligible ITC", data.reconciliation.eligibleItc, "", "", "", ""],
    ["Reconciliation", "Net GST Payable", data.reconciliation.netGstPayable, "", "", "", ""],
  ];

  const filenameBase = `GSTR9_FY_${financialYear}`;

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5 p-3.5 sm:p-6 text-slate-800 dark:text-slate-100 w-full min-w-0 print:p-0 print:m-0 print:max-w-none">
      {/* ── Print-only Header ── */}
      <div className="hidden print:flex flex-row justify-between items-start border-b-2 border-gray-800 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">GSTR-9 (ANNUAL GST RETURN)</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Financial Year: {financialYear} {periodLabel && `(${periodLabel})`}
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
            <Calendar size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              GSTR-9 (Annual Return)
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Annual GST summary for FY {financialYear}{periodLabel && ` (${periodLabel})`} — consolidated across returns
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          title="Refresh GSTR-9"
          className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <RefreshCw size={15} className={clsx(loading && "animate-spin text-[#f58220]")} />
        </button>
      </div>

      {/* ── Main Filter Bar (FY Selector + Search + Print/PDF) ── */}
      <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xs print:hidden">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* 1. Search Bar */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search category description or supply item…"
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

          {/* 2. FY Selector & Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2">
              <span className="text-xs font-bold text-gray-400 uppercase">FY:</span>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="text-xs font-bold bg-transparent text-gray-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {fyOptions.map((fy) => (
                  <option key={fy} value={fy} className="bg-white dark:bg-card text-gray-900 dark:text-white">
                    {fy}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Reset to current FY and clear search"
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
                title="Print GSTR-9"
              >
                <Printer className="h-3.5 w-3.5 text-[#f58220]" />
                <span>Print</span>
              </button>
              <button
                onClick={() =>
                  exportPdf(
                    `${filenameBase}.pdf`,
                    "GSTR-9 Annual Return",
                    `Financial Year ${financialYear} (${periodLabel})`,
                    allHeaders,
                    allRows
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
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Consolidating Annual GSTR-9 records…</p>
        </div>
      ) : (
        <>
          {/* ── KPI Summary Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0 print:grid-cols-3 print:gap-2">
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Total Output GST
                </span>
                <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#f58220] print:hidden">
                  <ArrowUpRight size={16} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-gray-900 dark:text-white mt-2 print:text-base">
                {fmt(data.reconciliation.totalOutputGst)}
              </p>
            </div>

            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xs print:border-gray-300 print:shadow-none print:p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Total Eligible ITC
                </span>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 print:hidden">
                  <ArrowDownLeft size={16} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 print:text-base">
                {fmt(data.reconciliation.eligibleItc)}
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
                {fmt(data.reconciliation.netGstPayable)}
              </p>
            </div>
          </div>

          {/* ── Outward Supplies Summary ── */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200 bg-gray-50/50 dark:bg-white/[0.02]">
              Outward Supplies Summary ({filteredOutward.length})
            </div>
            <div className="overflow-x-auto custom-scrollbar print:overflow-visible">
              <table className="w-full text-xs text-left border-collapse min-w-[650px] print:min-w-0 print:text-[9pt]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 print:bg-gray-100">
                    {outwardHeaders.map((h, i) => (
                      <th
                        key={h}
                        className={clsx(
                          "px-4 py-2.5 font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black",
                          i >= 1 && "text-right"
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 print:divide-gray-200">
                  {filteredOutward.map((r, idx) => {
                    const isTotal = r.category === "Total Outward Supplies";
                    return (
                      <tr key={idx} className={clsx(isTotal ? "bg-orange-50/50 dark:bg-orange-500/5 font-bold" : "hover:bg-gray-50/70 dark:hover:bg-white/[0.02]")}>
                        <td className={clsx("px-4 py-2.5 print:text-black", isTotal ? "font-bold text-[#f58220]" : "text-gray-900 dark:text-white")}>{r.category}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-900 dark:text-white print:text-black">{fmt(r.taxableValue)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 print:text-black">{fmt(r.cgst)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 print:text-black">{fmt(r.sgst)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 print:text-black">{fmt(r.igst)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-gray-600 dark:text-slate-300 print:text-black">{fmt(r.cess)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Inward / ITC Summary ── */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200 bg-gray-50/50 dark:bg-white/[0.02]">
              Inward / ITC Summary
            </div>
            <div className="overflow-x-auto custom-scrollbar print:overflow-visible">
              <table className="w-full text-xs text-left border-collapse min-w-[650px] print:min-w-0 print:text-[9pt]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/10 print:bg-gray-100">
                    {itcHeaders.map((h) => (
                      <th key={h} className="px-4 py-2.5 text-right font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px] tracking-wider print:text-black">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 print:divide-gray-200">
                  <tr>
                    {itcRows[0].map((v, i) => (
                      <td key={i} className={clsx("px-4 py-2.5 text-right font-mono print:text-black", i === itcRows[0].length - 1 ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white")}>
                        {fmt(v as number)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Annual Reconciliation ── */}
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xs overflow-hidden print:border-none print:shadow-none">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-200 bg-gray-50/50 dark:bg-white/[0.02]">
              Annual Reconciliation
            </div>
            <div className="overflow-x-auto custom-scrollbar print:overflow-visible">
              <table className="w-full text-xs text-left border-collapse min-w-[300px] print:min-w-0 print:text-[9pt]">
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 print:divide-gray-200">
                  <tr className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white print:text-black">Total Output GST</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-gray-900 dark:text-white print:text-black">{fmt(data.reconciliation.totalOutputGst)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors print:hover:bg-transparent">
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white print:text-black">Less: Eligible ITC</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 print:text-black">- {fmt(data.reconciliation.eligibleItc)}</td>
                  </tr>
                  <tr className="bg-orange-50/50 dark:bg-orange-500/5 font-bold">
                    <td className="px-4 py-2.5 font-bold text-[#f58220] print:text-black">Net GST Payable</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-[#f58220] print:text-black">{fmt(data.reconciliation.netGstPayable)}</td>
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
