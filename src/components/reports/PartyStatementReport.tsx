"use client";

// Reports → Party Reports → Party Statement.
// One party, one party type, or all parties (Franchise, Customer, Dealer,
// Vendor). All figures come from /api/reports/party-ledger, which reads the
// posted ledgers and keeps every party's running balance separate; combined
// views show receivable and payable totals apart, never one netted balance.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ChevronDown, Download, Eye, Loader2, Printer, RefreshCw, Search, X } from "lucide-react";
import { clsx } from "clsx";
import { reportsApi } from "@/lib/api";

type PartyType = "FRANCHISE" | "CUSTOMER" | "DEALER" | "VENDOR";
type TypeFilter = "ALL" | PartyType;
type Preset = "Today" | "This Week" | "This Month" | "Last Month" | "Custom";

const TYPE_TABS: Array<{ id: TypeFilter; label: string; plural: string }> = [
  { id: "ALL", label: "All Parties", plural: "All Parties" },
  { id: "FRANCHISE", label: "Franchise", plural: "All Franchises" },
  { id: "CUSTOMER", label: "Customer", plural: "All Customers" },
  { id: "DEALER", label: "Dealer", plural: "All Dealers" },
  { id: "VENDOR", label: "Vendor", plural: "All Vendors" },
];
const TYPE_LABEL: Record<string, string> = { FRANCHISE: "Franchise", CUSTOMER: "Customer", DEALER: "Dealer", VENDOR: "Vendor" };
const TYPE_STYLE: Record<string, string> = {
  FRANCHISE: "text-purple-700 bg-purple-50 dark:bg-purple-500/10",
  CUSTOMER: "text-blue-700 bg-blue-50 dark:bg-blue-500/10",
  DEALER: "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10",
  VENDOR: "text-amber-700 bg-amber-50 dark:bg-amber-500/10",
};
const PRESETS: Preset[] = ["Today", "This Week", "This Month", "Last Month", "Custom"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function rangeFor(preset: Preset, from: string, to: string): { from: string; to: string } {
  const now = new Date();
  if (preset === "Custom" && from && to) return from <= to ? { from, to } : { from: to, to: from };
  if (preset === "Today") return { from: iso(now), to: iso(now) };
  if (preset === "This Week") {
    const s = new Date(now);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return { from: iso(s), to: iso(now) };
  }
  if (preset === "Last Month") {
    return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
}

const inr = (n: number | null | undefined) =>
  `₹${Math.abs(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const withSide = (n: number, label?: string) => (Math.abs(n) < 0.005 ? inr(0) : `${inr(n)} ${label || ""}`.trim());
const day = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

interface PartyRow { id: string; name: string; partyType: PartyType; phone?: string | null }

export default function PartyStatementReport({ initialPartyId, initialPartyType }: { initialPartyId?: string; initialPartyType?: string }) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    const t = (initialPartyType || "").toUpperCase();
    return TYPE_TABS.some((x) => x.id === t) ? (t as TypeFilter) : "ALL";
  });
  const [partyId, setPartyId] = useState(initialPartyId || "");
  const [preset, setPreset] = useState<Preset>("This Month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const [parties, setParties] = useState<PartyRow[]>([]);

  useEffect(() => { const t = setTimeout(() => setSearch(searchInput.trim()), 350); return () => clearTimeout(t); }, [searchInput]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const { from, to } = rangeFor(preset, customFrom, customTo);

  const load = useCallback(async () => {
    if (preset === "Custom" && !(customFrom && customTo)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getPartyLedger({ partyType: typeFilter, partyId: partyId || undefined, from, to, search: search || undefined });
      setData(res.data);
      if (Array.isArray(res.data?.parties)) setParties(res.data.parties);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load party statement");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, partyId, from, to, search, preset, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const pickable = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return parties
      .filter((p) => typeFilter === "ALL" || p.partyType === typeFilter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.phone || "").includes(q));
  }, [parties, typeFilter, pickerQuery]);

  const selectedParty = parties.find((p) => p.id === partyId && (typeFilter === "ALL" || p.partyType === typeFilter));
  const tab = TYPE_TABS.find((t) => t.id === typeFilter)!;
  const single = !!data?.party;
  const txns: any[] = data?.transactions || [];
  const summaries: any[] = data?.partySummaries || [];

  const choosePartyType = (t: TypeFilter) => { setTypeFilter(t); setPartyId(""); };
  const viewParty = (p: { partyId: string; partyType: PartyType }) => { setTypeFilter(p.partyType); setPartyId(p.partyId); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const scopeLabel = single ? `${data.party.name} (${TYPE_LABEL[data.party.partyType]})` : tab.plural;

  const exportExcel = () => {
    if (!data) return;
    const rows: any[][] = [
      ["Party Statement", scopeLabel],
      ["Period", `${day(from)} to ${day(to)}`],
      ...(search ? [["Search", search]] : []),
      [],
    ];
    if (single) {
      const s = data.summary;
      rows.push(["Opening Balance", s.openingBalance], ["Total Debits", s.totalDebit], ["Total Credits", s.totalCredit], ["Closing Balance", `${s.closingBalance} ${s.closingLabel || ""}`.trim()], []);
    } else {
      const c = data.combined;
      rows.push(["Total Debits", c.totalDebit], ["Total Credits", c.totalCredit], ["Total Receivable", c.totalReceivable], ["Total Payable", c.totalPayable], [],
        ["Party", "Party Type", "Opening", "Debits", "Credits", "Closing", "Dr/Cr"],
        ...summaries.map((p) => [p.partyName, TYPE_LABEL[p.partyType], p.openingBalance, p.totalDebit, p.totalCredit, Math.abs(p.closingBalance), p.closingLabel]),
        []);
    }
    rows.push(["Date", "Party Name", "Party Type", "Voucher No", "Transaction", "Particulars", "Debit", "Credit", "Balance", "Dr/Cr"]);
    for (const t of txns) rows.push([day(t.date), t.partyName, TYPE_LABEL[t.partyType], t.voucherNo, t.txnType, t.particular, t.debit, t.credit, Math.abs(t.balance), t.balanceLabel]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Party Statement");
    XLSX.writeFile(wb, `party-statement-${single ? data.party.name.replace(/\s+/g, "-") : typeFilter.toLowerCase()}-${from}-to-${to}.xlsx`);
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Controls */}
      <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-3 sm:p-4 space-y-3 print:hidden">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => choosePartyType(t.id)}
              className={clsx("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors", typeFilter === t.id ? "bg-[#f58220] border-[#f58220] text-white" : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-orange-300")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1.2fr)_auto_minmax(180px,1fr)_auto] gap-2.5 items-end">
          {/* Party picker */}
          <div ref={pickerRef} className="relative">
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-slate-400 mb-1">Select Party</label>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-left text-gray-800 dark:text-white"
            >
              <span className="truncate">
                {selectedParty ? <>{selectedParty.name} <span className="text-[10px] text-gray-400">· {TYPE_LABEL[selectedParty.partyType]}</span></> : tab.plural}
              </span>
              <ChevronDown size={14} className="text-gray-400 shrink-0" />
            </button>
            {pickerOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-white/5">
                  <input autoFocus value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} placeholder="Search party name or phone…" className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none focus:border-orange-400" />
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <button type="button" onClick={() => { setPartyId(""); setPickerOpen(false); }} className={clsx("w-full text-left px-3 py-2 text-xs font-semibold hover:bg-orange-50 dark:hover:bg-white/5", !partyId && "text-[#f58220]")}>
                    {tab.plural}
                  </button>
                  {pickable.map((p) => (
                    <button key={`${p.partyType}-${p.id}`} type="button" onClick={() => { setPartyId(p.id); setPickerOpen(false); }} className={clsx("w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-xs hover:bg-orange-50 dark:hover:bg-white/5", p.id === partyId && "bg-orange-50/60 dark:bg-white/5")}>
                      <span className="truncate text-gray-800 dark:text-white">{p.name}{p.phone ? <span className="text-gray-400"> · {p.phone}</span> : null}</span>
                      <span className={clsx("shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded", TYPE_STYLE[p.partyType])}>{TYPE_LABEL[p.partyType]}</span>
                    </button>
                  ))}
                  {pickable.length === 0 && <p className="px-3 py-3 text-xs text-gray-400">No parties found.</p>}
                </div>
              </div>
            )}
          </div>

          {/* Date filter */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-slate-400 mb-1">Period</label>
            <div className="flex flex-wrap gap-1.5">
              <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className="px-2.5 py-2 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-800 dark:text-white">
                {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {preset === "Custom" && (
                <>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="From date" className="px-2 py-2 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs" />
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="To date" className="px-2 py-2 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs" />
                </>
              )}
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-slate-400 mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Party, voucher, invoice, reference…" className="w-full pl-8 pr-7 py-2 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220]" />
              {searchInput && <X size={13} onClick={() => setSearchInput("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer" />}
            </div>
          </div>

          <div className="flex gap-1.5">
            <button type="button" onClick={exportExcel} disabled={!data || loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 disabled:opacity-40"><Download size={14} /> Excel</button>
            <button type="button" onClick={() => window.print()} disabled={!data || loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 disabled:opacity-40"><Printer size={14} /> Print</button>
            <button type="button" onClick={load} title="Refresh" className="inline-flex items-center px-2.5 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50"><RefreshCw size={14} className={clsx(loading && "animate-spin")} /></button>
          </div>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-2 mb-2">
        <div className="text-base font-black uppercase">Party Statement — {scopeLabel}</div>
        <div className="text-xs">Period: {day(from)} to {day(to)}{search ? ` · Search: ${search}` : ""}</div>
      </div>

      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      {!data && loading && <div className="py-16 text-center text-gray-400 text-sm"><Loader2 className="inline animate-spin mr-2" size={16} />Loading statement…</div>}

      {data && (
        <>
          {/* Party details (one party) */}
          {single && (
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-3 sm:p-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
              <div className="text-sm font-bold text-gray-900 dark:text-white">{data.party.name}</div>
              <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded", TYPE_STYLE[data.party.partyType])}>{TYPE_LABEL[data.party.partyType]}</span>
              {data.party.phone && <span className="text-gray-500">📞 {data.party.phone}</span>}
              {data.party.email && <span className="text-gray-500">{data.party.email}</span>}
              {data.party.gstNumber && <span className="text-gray-500">GSTIN {data.party.gstNumber}</span>}
              {data.party.address && <span className="text-gray-500 truncate max-w-md">{data.party.address}</span>}
              <span className="text-gray-400">{data.party.orientation === "PAYABLE" ? "Payable account" : "Receivable account"}</span>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {single ? (
              <>
                <Card label="Opening Balance" value={withSide(data.summary.openingBalance, sideOf(data.party.partyType, data.summary.openingBalance))} />
                <Card label="Total Debits" value={inr(data.summary.totalDebit)} />
                <Card label="Total Credits" value={inr(data.summary.totalCredit)} />
                <Card
                  label="Closing Balance"
                  value={withSide(data.summary.closingBalance, data.summary.closingLabel)}
                  hint={data.summary.position === "SETTLED" ? "Settled" : data.summary.position === "RECEIVABLE" ? `Outstanding receivable ${inr(data.summary.outstanding)}` : `Outstanding payable ${inr(data.summary.outstanding)}`}
                  tone={data.summary.position === "RECEIVABLE" ? "rec" : data.summary.position === "PAYABLE" ? "pay" : undefined}
                />
              </>
            ) : (
              <>
                <Card label="Total Debits" value={inr(data.combined.totalDebit)} hint={`${data.combined.parties} part${data.combined.parties === 1 ? "y" : "ies"} with activity`} />
                <Card label="Total Credits" value={inr(data.combined.totalCredit)} />
                <Card label="Total Receivable" value={inr(data.combined.totalReceivable)} hint="Parties who owe us (Dr)" tone="rec" />
                <Card label="Total Payable" value={inr(data.combined.totalPayable)} hint="Parties we owe (Cr)" tone="pay" />
              </>
            )}
          </div>

          {/* Per-party balances (multi-party views) */}
          {!single && summaries.length > 0 && (
            <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-white/5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Party Balances · {day(from)} – {day(to)}</div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[720px]">
                  <thead className="bg-gray-50/70 dark:bg-white/[0.02] text-[10px] uppercase tracking-wider text-gray-500">
                    <tr><th className="px-4 py-2">Party</th><th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">Opening</th><th className="px-4 py-2 text-right">Debits</th><th className="px-4 py-2 text-right">Credits</th><th className="px-4 py-2 text-right">Closing</th><th className="px-4 py-2 text-right print:hidden">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {summaries.map((p) => (
                      <tr key={`${p.partyType}-${p.partyId}`}>
                        <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">{p.partyName}</td>
                        <td className="px-4 py-2"><span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded", TYPE_STYLE[p.partyType])}>{TYPE_LABEL[p.partyType]}</span></td>
                        <td className="px-4 py-2 text-right font-mono">{withSide(p.openingBalance, sideOf(p.partyType, p.openingBalance))}</td>
                        <td className="px-4 py-2 text-right font-mono">{inr(p.totalDebit)}</td>
                        <td className="px-4 py-2 text-right font-mono">{inr(p.totalCredit)}</td>
                        <td className={clsx("px-4 py-2 text-right font-mono font-bold", p.position === "RECEIVABLE" ? "text-emerald-700" : p.position === "PAYABLE" ? "text-rose-600" : "text-gray-500")}>{withSide(p.closingBalance, p.closingLabel)}</td>
                        <td className="px-4 py-2 text-right print:hidden">
                          <button type="button" onClick={() => viewParty(p)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#f58220] hover:underline"><Eye size={12} /> Statement</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ledger */}
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{single ? "Party Ledger" : "Combined Ledger"} · {txns.length} transaction{txns.length === 1 ? "" : "s"}</span>
              {!single && <span className="text-[10px] text-gray-400">Balance is each party&apos;s own running balance</span>}
              {data.truncated && <span className="text-[10px] font-semibold text-amber-600">Showing the latest 5,000 rows — narrow the period or party.</span>}
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className={clsx("w-full text-left text-xs", single ? "min-w-[760px]" : "min-w-[980px]")}>
                <thead className="bg-gray-50/70 dark:bg-white/[0.02] text-[10px] uppercase tracking-wider text-gray-500 whitespace-nowrap">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    {!single && <th className="px-4 py-2">Party</th>}
                    {!single && <th className="px-4 py-2">Type</th>}
                    <th className="px-4 py-2">Particulars</th>
                    <th className="px-4 py-2">Voucher No</th>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                    {!single && <th className="px-4 py-2 text-right print:hidden">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {single && (
                    <tr className="bg-gray-50/50 dark:bg-white/[0.02] font-semibold">
                      <td className="px-4 py-2">{day(from)}</td>
                      <td className="px-4 py-2" colSpan={4}>Opening Balance</td>
                      <td className="px-4 py-2 text-right font-mono">{withSide(data.summary.openingBalance, sideOf(data.party.partyType, data.summary.openingBalance))}</td>
                    </tr>
                  )}
                  {txns.length === 0 && (
                    <tr><td colSpan={single ? 6 : 9} className="px-4 py-10 text-center text-gray-400">No transactions in this period{search ? " matching the search" : ""}.</td></tr>
                  )}
                  {txns.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-2 whitespace-nowrap">{day(t.date)}</td>
                      {!single && <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">{t.partyName}</td>}
                      {!single && <td className="px-4 py-2"><span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded", TYPE_STYLE[t.partyType])}>{TYPE_LABEL[t.partyType]}</span></td>}
                      <td className="px-4 py-2"><div className="font-semibold text-gray-800 dark:text-slate-200">{t.txnType}</div>{t.particular !== t.txnType && <div className="text-[10px] text-gray-400">{t.particular}</div>}</td>
                      <td className="px-4 py-2 font-mono whitespace-nowrap">{t.voucherNo}</td>
                      <td className="px-4 py-2 text-right font-mono">{t.debit ? inr(t.debit) : "—"}</td>
                      <td className="px-4 py-2 text-right font-mono">{t.credit ? inr(t.credit) : "—"}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold whitespace-nowrap">{withSide(t.balance, t.balanceLabel)}</td>
                      {!single && (
                        <td className="px-4 py-2 text-right print:hidden">
                          <button type="button" onClick={() => viewParty({ partyId: t.partyId, partyType: t.partyType })} className="text-[11px] font-semibold text-[#f58220] hover:underline">View party</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {single && (
                    <tr className="bg-gray-50/50 dark:bg-white/[0.02] font-bold">
                      <td className="px-4 py-2">{day(to)}</td>
                      <td className="px-4 py-2" colSpan={2}>Closing Balance</td>
                      <td className="px-4 py-2 text-right font-mono">{inr(data.summary.totalDebit)}</td>
                      <td className="px-4 py-2 text-right font-mono">{inr(data.summary.totalCredit)}</td>
                      <td className="px-4 py-2 text-right font-mono">{withSide(data.summary.closingBalance, data.summary.closingLabel)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Dr/Cr side for a balance on this party type (receivable side: positive = Dr; vendor: positive = Cr). */
function sideOf(partyType: string, balance: number): string {
  if (Math.abs(balance) < 0.005) return "";
  const owesUs = partyType === "VENDOR" ? balance < 0 : balance > 0;
  return owesUs ? "Dr" : "Cr";
}

function Card({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "rec" | "pay" }) {
  return (
    <div className="bg-white dark:bg-card p-3.5 rounded-xl border border-gray-200 dark:border-white/5 min-w-0 print:border-gray-300">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
      <div className={clsx("text-lg font-bold mt-0.5 truncate", tone === "rec" ? "text-emerald-700 dark:text-emerald-400" : tone === "pay" ? "text-rose-600 dark:text-rose-400" : "text-gray-900 dark:text-white")}>{value}</div>
      {hint && <div className="text-[10px] text-gray-400 truncate">{hint}</div>}
    </div>
  );
}
