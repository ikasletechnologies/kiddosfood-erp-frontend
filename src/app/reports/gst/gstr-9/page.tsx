"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, FileText, FileSpreadsheet, Printer } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportCsv, exportExcel, exportPdf } from "../_lib/export";

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

  const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const [fyStartYear] = financialYear.split("-");
  const periodLabel = fyStartYear ? `01/04/${fyStartYear} – 31/03/${Number(fyStartYear) + 1}` : "";

  const outwardHeaders = ["Category", "Taxable Value", "CGST", "SGST", "IGST", "Cess"];
  const outwardRows = data.outwardSupplies.map((r) => [r.category, r.taxableValue, r.cgst, r.sgst, r.igst, r.cess]);

  const itcHeaders = ["Eligible Purchase Taxable Value", "Eligible CGST", "Eligible SGST", "Eligible IGST", "Eligible Cess", "Total Eligible ITC"];
  const itcRows = [[data.itcSummary.taxableValue, data.itcSummary.cgst, data.itcSummary.sgst, data.itcSummary.igst, data.itcSummary.cess, data.itcSummary.total]];

  const reconHeaders = ["Total Output GST", "Less: Eligible ITC", "Net GST Payable"];
  const reconRows = [[data.reconciliation.totalOutputGst, data.reconciliation.eligibleItc, data.reconciliation.netGstPayable]];

  const allHeaders = ["Section", ...outwardHeaders];
  const allRows: (string | number)[][] = [
    ...outwardRows.map((r) => ["Outward Supplies", ...r]),
    ["ITC Summary", "Eligible Purchases", data.itcSummary.taxableValue, data.itcSummary.cgst, data.itcSummary.sgst, data.itcSummary.igst, data.itcSummary.cess],
    ["Reconciliation", "Output GST", data.reconciliation.totalOutputGst, "", "", "", ""],
    ["Reconciliation", "Eligible ITC", data.reconciliation.eligibleItc, "", "", "", ""],
    ["Reconciliation", "Net GST Payable", data.reconciliation.netGstPayable, "", "", "", ""],
  ];

  const filenameBase = `GSTR9_${financialYear}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 py-4 text-slate-800 dark:text-slate-100 w-full min-w-0">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-gray-100 dark:border-white/5 pb-6 w-full min-w-0">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full shrink-0" />
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">GSTR-9</h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Annual GST summary for FY {financialYear}{periodLabel && ` (${periodLabel})`} — consolidated from GSTR-1, GSTR-2 and GSTR-3B.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 font-medium bg-white dark:bg-[#13151f]">
            {fyOptions.map((fy) => <option key={fy} value={fy}>{fy}</option>)}
          </select>
          <button onClick={fetchData} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:text-blue-600 transition-all active:scale-90">
            <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-4">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((i) => <div key={i} className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/20 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
          </div>
        </div>
      ) : (
        <>
          {/* 1. Annual Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Output GST</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{fmt(data.reconciliation.totalOutputGst)}</p>
            </div>
            <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Eligible ITC</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{fmt(data.reconciliation.eligibleItc)}</p>
            </div>
            <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net GST Payable</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{fmt(data.reconciliation.netGstPayable)}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => exportCsv(`${filenameBase}.csv`, allHeaders, allRows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-blue-600 transition-colors" title="Export CSV"><FileText size={16} /></button>
            <button onClick={() => exportExcel(`${filenameBase}.xlsx`, "GSTR-9", `GSTR-9 FY ${financialYear}`, allHeaders, allRows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-emerald-600 transition-colors" title="Export Excel"><FileSpreadsheet size={16} /></button>
            <button onClick={() => exportPdf(`${filenameBase}.pdf`, "GSTR-9", `Financial Year ${financialYear} (${periodLabel})`, allHeaders, allRows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-red-600 transition-colors" title="Export PDF"><Printer size={16} /></button>
          </div>

          {/* 2. Outward Supplies Summary */}
          <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 font-black text-xs uppercase tracking-widest text-slate-500">Outward Supplies Summary</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  {outwardHeaders.map((h) => <th key={h} className="text-left px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {data.outwardSupplies.map((r, idx) => {
                  const isTotal = r.category === "Total Outward Supplies";
                  return (
                    <tr key={idx} className={isTotal ? "bg-slate-50/70 dark:bg-white/[0.03]" : undefined}>
                      <td className={clsx("px-5 py-3", isTotal ? "font-black text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-200")}>{r.category}</td>
                      <td className={clsx("px-5 py-3 text-right font-mono", isTotal && "font-bold")}>{fmt(r.taxableValue)}</td>
                      <td className={clsx("px-5 py-3 text-right font-mono", isTotal && "font-bold")}>{fmt(r.cgst)}</td>
                      <td className={clsx("px-5 py-3 text-right font-mono", isTotal && "font-bold")}>{fmt(r.sgst)}</td>
                      <td className={clsx("px-5 py-3 text-right font-mono", isTotal && "font-bold")}>{fmt(r.igst)}</td>
                      <td className={clsx("px-5 py-3 text-right font-mono", isTotal && "font-bold")}>{fmt(r.cess)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 3. Inward / ITC Summary */}
          <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 font-black text-xs uppercase tracking-widest text-slate-500">Inward / ITC Summary</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  {itcHeaders.map((h) => <th key={h} className="text-left px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                <tr>
                  {itcRows[0].map((v, i) => (
                    <td key={i} className={clsx("px-5 py-3 text-right font-mono", i === itcRows[0].length - 1 && "font-bold text-emerald-600")}>{fmt(v as number)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-gray-100 dark:border-white/5">
              Every eligible Purchase Bill in this bucket — Kiddos does not currently track ITC eligibility categories (import of goods/services, reverse charge, ISD, ineligible/blocked credit) separately.
            </p>
          </div>

          {/* 4. Annual Reconciliation */}
          <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 font-black text-xs uppercase tracking-widest text-slate-500">Annual Reconciliation</div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                <tr>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-200">Total Output GST</td>
                  <td className="px-5 py-3 text-right font-mono">{fmt(data.reconciliation.totalOutputGst)}</td>
                </tr>
                <tr>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-200">Less: Eligible ITC</td>
                  <td className="px-5 py-3 text-right font-mono text-emerald-600">- {fmt(data.reconciliation.eligibleItc)}</td>
                </tr>
                <tr className="bg-slate-50/70 dark:bg-white/[0.03]">
                  <td className="px-5 py-3 font-black text-slate-900 dark:text-white">Net GST Payable</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-blue-600">{fmt(data.reconciliation.netGstPayable)}</td>
                </tr>
              </tbody>
            </table>
            <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-gray-100 dark:border-white/5">
              Tax Paid / Balance Payable is not shown — Kiddos does not track GST challan/payment data separately from customer and vendor payments.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
