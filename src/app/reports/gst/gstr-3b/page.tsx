"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, FileText, FileSpreadsheet, Printer } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportCsv, exportExcel, exportPdf } from "../_lib/export";

interface OutwardRow { description: string; taxableValue: number; igst: number; cgst: number; sgst: number; cess: number }
interface ItcRow { description: string; igst: number; cgst: number; sgst: number; cess: number }
interface ReportData {
  outwardSupplies: OutwardRow[];
  interStateSupplies: { description: string; taxableValue: number; integratedTax: number }[];
  eligibleITC: { available: ItcRow[]; ineligible: ItcRow[] };
  summary: { totalOutputTax: number; totalInputTax: number; netGstPayable: number };
}
const EMPTY: ReportData = { outwardSupplies: [], interStateSupplies: [], eligibleITC: { available: [], ineligible: [] }, summary: { totalOutputTax: 0, totalInputTax: 0, netGstPayable: 0 } };

export default function GSTR3BPage() {
  const [data, setData] = useState<ReportData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getGSTR3B({ startDate, endDate });
      setData({ ...EMPTY, ...(res.data || {}) });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load GSTR-3B");
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const headers = ["Section", "Description", "Taxable Value", "CGST", "SGST", "IGST"];
  const rows: (string | number)[][] = [
    ...data.outwardSupplies.map((r) => ["3.1 Outward", r.description, r.taxableValue, r.cgst, r.sgst, r.igst]),
    ...data.eligibleITC.available.map((r) => ["4 Eligible ITC", r.description, "", r.cgst, r.sgst, r.igst]),
  ];
  const filenameBase = `GSTR3B_${startDate}_${endDate}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 py-4 text-slate-800 dark:text-slate-100 w-full min-w-0">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-gray-100 dark:border-white/5 pb-6 w-full min-w-0">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full shrink-0" />
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">GSTR-3B</h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Auto-consolidated output GST liability, eligible ITC and net payable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 font-medium bg-white dark:bg-[#13151f]" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 font-medium bg-white dark:bg-[#13151f]" />
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
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Output GST Liability</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{fmt(data.summary.totalOutputTax)}</p>
            </div>
            <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eligible ITC</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{fmt(data.summary.totalInputTax)}</p>
            </div>
            <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net GST Payable</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{fmt(data.summary.netGstPayable)}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => exportCsv(`${filenameBase}.csv`, headers, rows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-blue-600 transition-colors" title="Export CSV"><FileText size={16} /></button>
            <button onClick={() => exportExcel(`${filenameBase}.xlsx`, "GSTR-3B", `GSTR-3B ${startDate} to ${endDate}`, headers, rows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-emerald-600 transition-colors" title="Export Excel"><FileSpreadsheet size={16} /></button>
            <button onClick={() => exportPdf(`${filenameBase}.pdf`, "GSTR-3B", `${startDate} to ${endDate}`, headers, rows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-red-600 transition-colors" title="Export PDF"><Printer size={16} /></button>
          </div>

          <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 font-black text-xs uppercase tracking-widest text-slate-500">3.1 Outward Taxable Supplies</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  <th className="text-left px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">Description</th>
                  <th className="text-right px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">Taxable Value</th>
                  <th className="text-right px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">CGST</th>
                  <th className="text-right px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">SGST</th>
                  <th className="text-right px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">IGST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {data.outwardSupplies.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{r.description}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.taxableValue)}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.cgst)}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.sgst)}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.igst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 font-black text-xs uppercase tracking-widest text-slate-500">4. Eligible ITC</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  <th className="text-left px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">Description</th>
                  <th className="text-right px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">CGST</th>
                  <th className="text-right px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">SGST</th>
                  <th className="text-right px-5 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider">IGST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {data.eligibleITC.available.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">{r.description}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.cgst)}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.sgst)}</td>
                    <td className="px-5 py-3 text-right font-mono">{fmt(r.igst)}</td>
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
