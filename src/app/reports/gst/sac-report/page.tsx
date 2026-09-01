"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, FileText, FileSpreadsheet, Printer, Wrench } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportCsv, exportExcel, exportPdf } from "../_lib/export";

interface SacRow {
  sacCode: string;
  serviceName: string;
  taxableValue: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

export default function SacReportPage() {
  const [rows, setRows] = useState<SacRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [gstRate, setGstRate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getSacReport({ startDate, endDate, gstRate: gstRate || undefined });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load SAC report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, gstRate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rates = useMemo(() => Array.from(new Set(rows.map((r) => r.gstRate))).sort((a, b) => a - b), [rows]);
  const filtered = useMemo(
    () => rows.filter((r) => !search || r.serviceName?.toLowerCase().includes(search.toLowerCase()) || r.sacCode?.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totals = filtered.reduce(
    (acc, r) => ({
      taxableValue: acc.taxableValue + (r.taxableValue || 0),
      totalTax: acc.totalTax + (r.totalTax || 0),
    }),
    { taxableValue: 0, totalTax: 0 }
  );

  const headers = ["SAC Code", "Service Name", "GST Rate", "Taxable Value", "CGST", "SGST", "IGST", "Total Tax"];
  const toRows = filtered.map((r) => [r.sacCode, r.serviceName, r.gstRate, r.taxableValue, r.cgst, r.sgst, r.igst, r.totalTax]);
  const filenameBase = `SACReport_${startDate}_${endDate}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6 py-4 text-slate-800 dark:text-slate-100 w-full min-w-0">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-gray-100 dark:border-white/5 pb-6 w-full min-w-0">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full shrink-0" />
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">SAC Report</h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Service sales grouped by SAC code. Goods lines never appear here.
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxable Value</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{fmt(totals.taxableValue)}</p>
        </div>
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Tax</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{fmt(totals.totalTax)}</p>
        </div>
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SAC Lines</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{filtered.length}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border-b border-gray-100 dark:border-white/5">
          <input
            type="text"
            placeholder="Search service / SAC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 font-medium bg-white dark:bg-[#13151f] w-56"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 font-medium bg-white dark:bg-[#13151f]">
              <option value="">All Rates</option>
              {rates.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
            <button onClick={() => exportCsv(`${filenameBase}.csv`, headers, toRows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-blue-600 transition-colors" title="Export CSV"><FileText size={16} /></button>
            <button onClick={() => exportExcel(`${filenameBase}.xlsx`, "SAC Report", `SAC Report ${startDate} to ${endDate}`, headers, toRows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-emerald-600 transition-colors" title="Export Excel"><FileSpreadsheet size={16} /></button>
            <button onClick={() => exportPdf(`${filenameBase}.pdf`, "SAC Report", `${startDate} to ${endDate}`, headers, toRows)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-red-600 transition-colors" title="Export PDF"><Printer size={16} /></button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center gap-4">
              <div className="flex gap-1.5">
                {[1, 2, 3].map((i) => <div key={i} className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/20 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center gap-3 text-center">
              <Wrench size={36} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No service sales for the selected period.</p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  {headers.map((h) => <th key={h} className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {filtered.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-semibold text-blue-600">{r.sacCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{r.serviceName}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{r.gstRate}%</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.taxableValue)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.cgst)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.sgst)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.igst)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(r.totalTax)}</td>
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
