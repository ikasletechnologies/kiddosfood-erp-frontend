"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, FileText, FileSpreadsheet, Printer } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportCsv, exportExcel, exportPdf } from "../_lib/export";

interface SupplyRow { section: string; description: string; taxableValue: number; centralTax: number; stateTax: number; integratedTax: number; cess: number }
interface ReportData {
  basicDetails: { financialYear: string; gstin: string; legalName: string; tradeName: string };
  outwardAndInwardSupplies: SupplyRow[];
  summary: { totalOutputTax: number; totalInputTax: number; netTaxPayable: number };
}
const EMPTY: ReportData = { basicDetails: { financialYear: "", gstin: "", legalName: "", tradeName: "" }, outwardAndInwardSupplies: [], summary: { totalOutputTax: 0, totalInputTax: 0, netTaxPayable: 0 } };

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

  const headers = ["Section", "Description", "Taxable Value", "CGST", "SGST", "IGST"];
  const rows = data.outwardAndInwardSupplies.map((r) => [r.section, r.description, r.taxableValue, r.centralTax, r.stateTax, r.integratedTax]);
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
            Annual consolidated GST return for the selected financial year.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Output Tax</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{fmt(data.summary.totalOutputTax)}</p>
            </div>
            <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total ITC</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{fmt(data.summary.totalInputTax)}</p>
            </div>
            <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Tax Payable</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{fmt(data.summary.netTaxPayable)}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => exportCsv(`${filenameBase}.csv`, headers, rows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-blue-600 transition-colors" title="Export CSV"><FileText size={16} /></button>
            <button onClick={() => exportExcel(`${filenameBase}.xlsx`, "GSTR-9", `GSTR-9 FY ${financialYear}`, headers, rows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-emerald-600 transition-colors" title="Export Excel"><FileSpreadsheet size={16} /></button>
            <button onClick={() => exportPdf(`${filenameBase}.pdf`, "GSTR-9", `Financial Year ${financialYear}`, headers, rows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-red-600 transition-colors" title="Export PDF"><Printer size={16} /></button>
          </div>

          <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  {headers.map((h) => <th key={h} className="text-left px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {data.outwardAndInwardSupplies.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-5 py-3 font-semibold text-slate-500">{r.section}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{r.description}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.taxableValue)}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.centralTax)}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.stateTax)}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.integratedTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
