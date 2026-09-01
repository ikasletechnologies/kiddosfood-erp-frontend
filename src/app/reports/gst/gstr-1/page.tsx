"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, FileText, FileSpreadsheet, Printer, Receipt } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api";
import { exportCsv, exportExcel, exportPdf } from "../_lib/export";

interface GSTR1Row {
  invoiceNo: string;
  date: string;
  partyName: string;
  gstin: string;
  b2bType: string;
  placeOfSupply: string;
  taxRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cessAmount: number;
  totalTax: number;
  totalAmount: number;
}

interface CreditNoteRow {
  invoiceNo: string;
  date: string;
  partyName: string;
  gstin: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

type ReportData = { sale: GSTR1Row[]; saleReturn: GSTR1Row[]; creditNotes: CreditNoteRow[]; totalTaxableValue: number; totalOutputGST: number };

const EMPTY: ReportData = { sale: [], saleReturn: [], creditNotes: [], totalTaxableValue: 0, totalOutputGST: 0 };

export default function GSTR1Page() {
  const [data, setData] = useState<ReportData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"sale" | "saleReturn" | "creditNotes">("sale");
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
      const res = await reportsApi.getGSTR1({ startDate, endDate, gstRate: gstRate || undefined });
      setData({ ...EMPTY, ...(res.data || {}) });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load GSTR-1");
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, gstRate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rates = useMemo(() => Array.from(new Set(data.sale.map((r) => r.taxRate))).sort((a, b) => a - b), [data.sale]);

  const matchesSearch = (r: { partyName: string; invoiceNo: string; gstin?: string }) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.partyName.toLowerCase().includes(q) ||
      r.invoiceNo.toLowerCase().includes(q) ||
      (r.gstin || "").toLowerCase().includes(q)
    );
  };
  const filteredSale = useMemo(() => data.sale.filter(matchesSearch), [data.sale, search]);
  const filteredReturns = useMemo(() => data.saleReturn.filter(matchesSearch), [data.saleReturn, search]);
  const filteredCreditNotes = useMemo(() => data.creditNotes.filter(matchesSearch), [data.creditNotes, search]);

  const current = tab === "sale" ? filteredSale : tab === "saleReturn" ? filteredReturns : filteredCreditNotes;

  const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const headers = ["Invoice No", "Date", "Party", "GSTIN", "Place of Supply", "Tax Rate", "Taxable Value", "CGST", "SGST", "IGST", "Cess", "Total Tax", "Invoice Value"];
  const toRows = (rows: (GSTR1Row | CreditNoteRow)[]) =>
    rows.map((r: any) => [r.invoiceNo, r.date, r.partyName, r.gstin, r.placeOfSupply || "—", r.taxRate ?? "—", r.taxableValue, r.cgst, r.sgst, r.igst, r.cessAmount ?? 0, r.totalTax, r.totalAmount ?? ""]);

  const filenameBase = `GSTR1_${tab}_${startDate}_${endDate}`;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 py-4 text-slate-800 dark:text-slate-100 w-full min-w-0">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-b border-gray-100 dark:border-white/5 pb-6 w-full min-w-0">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-blue-500 rounded-full shrink-0" />
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">GSTR-1</h1>
          </div>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            Outward taxable supplies — final Tax Invoices and applicable Sales Credit/Debit Notes only.
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
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{fmt(data.totalTaxableValue)}</p>
        </div>
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Output GST</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{fmt(data.totalOutputGST)}</p>
        </div>
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sale Invoices</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{data.sale.length}</p>
        </div>
        <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Credit Notes</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{data.creditNotes.length}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-card border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border-b border-gray-100 dark:border-white/5">
          <div className="flex border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden text-xs font-black uppercase tracking-wider">
            {(["sale", "saleReturn", "creditNotes"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={clsx("px-4 py-2 transition-colors", tab === t ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5")}>
                {t === "sale" ? "Sale" : t === "saleReturn" ? "Sale Return" : "Credit Notes"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search party / invoice / GSTIN…"
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
            <button onClick={() => exportCsv(`${filenameBase}.csv`, headers, toRows(current))} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-blue-600 transition-colors" title="Export CSV">
              <FileText size={16} />
            </button>
            <button onClick={() => exportExcel(`${filenameBase}.xlsx`, "GSTR-1", `GSTR-1 (${tab}) ${startDate} to ${endDate}`, headers, toRows(current))} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-emerald-600 transition-colors" title="Export Excel">
              <FileSpreadsheet size={16} />
            </button>
            <button onClick={() => exportPdf(`${filenameBase}.pdf`, "GSTR-1", `${tab} · ${startDate} to ${endDate}`, headers, toRows(current))} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-500 hover:text-red-600 transition-colors" title="Export PDF">
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
              <Receipt size={36} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No data for the selected period.</p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                  {headers.map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {current.map((r: any, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-semibold text-blue-600">{r.invoiceNo}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{r.partyName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.gstin}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.placeOfSupply || "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{r.taxRate ?? "—"}%</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.taxableValue)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.cgst)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.sgst)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.igst)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(r.cessAmount || 0)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(r.totalTax)}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.totalAmount != null ? fmt(r.totalAmount) : "—"}</td>
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
