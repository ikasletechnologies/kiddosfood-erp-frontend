"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, FileText, FileSpreadsheet, Printer, Truck } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportCsv, exportExcel, exportPdf } from "../_lib/export";

interface GSTR2Row {
  invoiceNumber: string;
  poNumber: string;
  date: string;
  vendorName: string;
  vendorGstin: string;
  taxableValue: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  igst: number;
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

export default function GSTR2Page() {
  const [result, setResult] = useState<ReportData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"bills" | "debitNotes">("bills");
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
      const res = await reportsApi.getGSTR2({ startDate, endDate, gstRate: gstRate || undefined });
      setResult({ ...EMPTY, ...(res.data || {}) });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load GSTR-2");
      setResult(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, gstRate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rates = useMemo(() => Array.from(new Set(result.data.map((r) => r.taxRate))).sort((a, b) => a - b), [result.data]);

  const filteredBills = useMemo(
    () => result.data.filter((r) => !search || r.vendorName.toLowerCase().includes(search.toLowerCase()) || r.invoiceNumber.toLowerCase().includes(search.toLowerCase())),
    [result.data, search]
  );
  const filteredDebitNotes = useMemo(
    () => result.debitNotes.filter((r) => !search || r.vendorName.toLowerCase().includes(search.toLowerCase())),
    [result.debitNotes, search]
  );

  const current = tab === "bills" ? filteredBills : filteredDebitNotes;

  const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const headers = tab === "bills"
    ? ["Bill No", "PO No", "Date", "Vendor", "Vendor GSTIN", "Tax Rate", "Taxable Value", "CGST", "SGST", "IGST", "Total Tax", "Eligible ITC", "Amount"]
    : ["Return No", "Date", "Vendor", "Vendor GSTIN", "Taxable Value", "CGST", "SGST", "IGST", "Total Tax"];

  const toRows = () =>
    tab === "bills"
      ? (current as GSTR2Row[]).map((r) => [r.invoiceNumber, r.poNumber, r.date, r.vendorName, r.vendorGstin, r.taxRate, r.taxableValue, r.cgst, r.sgst, r.igst, r.totalTax, r.eligibleItc, r.totalAmount])
      : (current as DebitNoteRow[]).map((r) => [r.returnNumber, r.date, r.vendorName, r.vendorGstin, r.taxableValue, r.cgst, r.sgst, r.igst, r.totalTax]);

  const filenameBase = `GSTR2_${tab}_${startDate}_${endDate}`;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 py-4 text-slate-800 dark:text-slate-100 w-full min-w-0">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-gray-100 dark:border-white/5 pb-6 w-full min-w-0">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full shrink-0" />
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">GSTR-2</h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Inward supplies — Purchase Bills and applicable Purchase Debit Notes. A raw PO/GRN never appears here.
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxable Value</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{fmt(result.totalTaxableValue)}</p>
        </div>
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Input GST / ITC</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{fmt(result.totalInputGST)}</p>
        </div>
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Bills</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{result.data.length}</p>
        </div>
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Debit Notes</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{result.debitNotes.length}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border-b border-gray-100 dark:border-white/5">
          <div className="flex border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden text-xs font-black uppercase tracking-wider">
            {(["bills", "debitNotes"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={clsx("px-4 py-2 transition-colors", tab === t ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5")}>
                {t === "bills" ? "Purchase Bills" : "Debit Notes"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search vendor / bill…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 font-medium bg-white dark:bg-[#13151f] w-48"
            />
            <select value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="text-sm border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 font-medium bg-white dark:bg-[#13151f]">
              <option value="">All Rates</option>
              {rates.map((r) => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
            <button onClick={() => exportCsv(`${filenameBase}.csv`, headers, toRows())} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-blue-600 transition-colors" title="Export CSV">
              <FileText size={16} />
            </button>
            <button onClick={() => exportExcel(`${filenameBase}.xlsx`, "GSTR-2", `GSTR-2 (${tab}) ${startDate} to ${endDate}`, headers, toRows())} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-emerald-600 transition-colors" title="Export Excel">
              <FileSpreadsheet size={16} />
            </button>
            <button onClick={() => exportPdf(`${filenameBase}.pdf`, "GSTR-2", `${tab} · ${startDate} to ${endDate}`, headers, toRows())} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-red-600 transition-colors" title="Export PDF">
              <Printer size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center gap-4">
              <div className="flex gap-1.5">
                {[1, 2, 3].map((i) => <div key={i} className="w-2 h-2 rounded-full bg-slate-200 dark:bg-white/20 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />)}
              </div>
            </div>
          ) : current.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center gap-3 text-center">
              <Truck size={36} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No data for the selected period.</p>
            </div>
          ) : tab === "bills" ? (
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  {headers.map((h) => <th key={h} className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {(filteredBills).map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-semibold text-blue-600">{r.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.poNumber}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{r.vendorName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.vendorGstin}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{r.taxRate}%</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.taxableValue)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.cgst)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.sgst)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.igst)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(r.totalTax)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600">{fmt(r.eligibleItc)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  {headers.map((h) => <th key={h} className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {(filteredDebitNotes).map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-semibold text-blue-600">{r.returnNumber}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{r.vendorName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.vendorGstin}</td>
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
