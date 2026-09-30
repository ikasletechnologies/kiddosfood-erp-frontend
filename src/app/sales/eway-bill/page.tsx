"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, RefreshCw, Download, FileCheck2, Loader2, Calendar, X } from "lucide-react";
import { clsx } from "clsx";
import { ewayBillApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { formatDate, formatDateTime } from "@/lib/utils";
import EWayBillForm from "./EWayBillForm";
import EWayBillDetail from "./EWayBillDetail";
import { S, Masters, STATUS_BADGE, STATUS_LABEL, SOURCE_LABELS, timeLeft, apiError, formatEwbNo, downloadJson } from "./ewaybill-ui";

// E-Way Bill register (Sales menu).
// the Sale Invoice screen. EWB numbers come from the NIC portal — drafts are
// exported as the portal's bulk-upload JSON, then the issued number is
// recorded back here (see EWayBillService on the backend).

type View = { name: "list" } | { name: "form"; editing?: any } | { name: "detail"; row: any };

const TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "GENERATED", label: "Active" },
  { key: "EXPIRED", label: "Expired" },
  { key: "CANCELLED", label: "Cancelled" },
];

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EWayBillPage() {
  const { showToast } = useToast();
  const [view, setView] = useState<View>({ name: "list" });
  const [masters, setMasters] = useState<Masters | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    ewayBillApi.getMasters().then((r) => setMasters(r.data)).catch((e) => showToast(apiError(e, "Failed to load E-Way Bill settings"), "error"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        ewayBillApi.getAll({ status: tab, search: search || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined }),
        ewayBillApi.getStats(),
      ]);
      setRows(list.data || []);
      setStats(st.data);
      setSelected(new Set());
    } catch (e) {
      showToast(apiError(e, "Failed to load E-Way Bills"), "error");
    } finally {
      setLoading(false);
    }
  }, [tab, search, fromDate, toDate]);

  useEffect(() => {
    if (view.name !== "list") return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, view.name]);

  const openDetail = async (id: string, print = false) => {
    try {
      const r = await ewayBillApi.getById(id);
      setView({ name: "detail", row: r.data });
      if (print) setTimeout(() => window.print(), 400);
    } catch (e) {
      showToast(apiError(e, "Failed to open E-Way Bill"), "error");
    }
  };

  const deleteDraft = async (r: any) => {
    if (!window.confirm(`Delete draft ${r.refNumber} (${r.docType} ${r.docNo})?`)) return;
    try {
      await ewayBillApi.remove(r.id);
      showToast("Draft deleted", "success");
      load();
    } catch (e) {
      showToast(apiError(e, "Delete failed"), "error");
    }
  };

  const drafts = rows.filter((r) => r.status === "DRAFT");
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allDraftsSelected = drafts.length > 0 && drafts.every((d) => selected.has(d.id));

  const exportSelected = async () => {
    setExporting(true);
    try {
      const res = await ewayBillApi.exportJson(Array.from(selected));
      downloadJson(res.data, `ewaybills-${new Date().toISOString().slice(0, 10)}.json`);
      showToast(`${selected.size} E-Way Bill(s) exported for bulk generation`, "success");
    } catch (e) {
      showToast(apiError(e, "Export failed"), "error");
    } finally {
      setExporting(false);
    }
  };

  if (!masters) {
    return (
      <div className={clsx(S.page, "flex flex-col items-center justify-center gap-2 py-20")}>
        <RefreshCw className="h-8 w-8 animate-spin text-[#f58220] opacity-70" />
        <p className="text-xs text-gray-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  if (view.name === "form") {
    return (
      <EWayBillForm
        masters={masters}
        editing={view.editing}
        onCancel={() => (view.editing ? setView({ name: "detail", row: view.editing }) : setView({ name: "list" }))}
        onSaved={(row) => setView({ name: "detail", row })}
      />
    );
  }

  if (view.name === "detail") {
    return (
      <EWayBillDetail
        masters={masters}
        row={view.row}
        onBack={() => setView({ name: "list" })}
        onEdit={() => setView({ name: "form", editing: view.row })}
        onChanged={(row) => (row ? setView({ name: "detail", row }) : setView({ name: "list" }))}
      />
    );
  }

  const summary = [
    { label: "Drafts", value: String(stats?.draft ?? 0), color: "text-gray-700 dark:text-slate-200", dot: "bg-gray-400", tab: "DRAFT" },
    { label: "Active", value: String(stats?.active ?? 0), sub: stats ? `${inr(stats.activeValue)} in transit` : "", color: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500", tab: "GENERATED" },
    { label: "Expiring in 24h", value: String(stats?.expiringSoon ?? 0), color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500", tab: "GENERATED" },
    { label: "Expired", value: String(stats?.expired ?? 0), color: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500", tab: "EXPIRED" },
  ];

  const filtersActive = search || tab !== "ALL" || fromDate || toDate;

  return (
    <div className={S.page}>
      {/* ── Page Header Toolbar ── */}
      <div className={S.pageHeader}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={S.iconTile}><FileCheck2 className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h1 className={S.pageTitle}>E-Way Bills</h1>
            <p className={S.pageSubtitle}>Create, track, and manage GST e-way bills for goods movement</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button onClick={exportSelected} disabled={exporting} className={S.btnSecondary} title="Download NIC bulk-upload JSON">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
              <span>Export JSON ({selected.size})</span>
            </button>
          )}
          <button onClick={() => setView({ name: "form" })} className={S.btnPrimary}>
            <Plus className="h-4 w-4 shrink-0" /> <span>New E-Way Bill</span>
          </button>
        </div>
      </div>

      <div className={S.container}>
        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full min-w-0">
          {summary.map((s) => (
            <button
              key={s.label}
              onClick={() => setTab(s.tab)}
              className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-3.5 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0 shadow-2xs text-left hover:border-orange-300 dark:hover:border-orange-500/30 transition-colors cursor-pointer"
            >
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{s.label}</p>
                <p className={clsx("text-base sm:text-xl font-bold truncate", s.color)}>{s.value}</p>
                {s.sub && <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{s.sub}</p>}
              </div>
            </button>
          ))}
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 w-full min-w-0">
          <div className="relative flex-1 min-w-0 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search EWB no., document, party, vehicle..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm outline-none focus:border-[#f58220] bg-white dark:bg-[#13151f] text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200" onClick={() => setSearch("")} />
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end min-w-0">
            <div className={S.segWrap}>
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} className={clsx(S.seg, tab === t.key ? S.segOn : S.segOff)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-card text-xs sm:text-sm text-gray-700 dark:text-slate-200 shrink-0">
              <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500 shrink-0" />
              <input type="date" aria-label="From date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent outline-none font-medium text-xs w-[112px] dark:[color-scheme:dark]" />
              <span className="text-gray-300 dark:text-slate-600 px-0.5">to</span>
              <input type="date" aria-label="To date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent outline-none font-medium text-xs w-[112px] dark:[color-scheme:dark]" />
              {(fromDate || toDate) && (
                <X size={14} className="text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => { setFromDate(""); setToDate(""); }} />
              )}
            </div>

            <button onClick={load} className={S.btnRefresh} title="Refresh" aria-label="Refresh E-Way Bills">
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* ── List ── */}
        {loading && rows.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-8 w-8 animate-spin text-[#f58220] opacity-70" />
            <p className="text-xs text-gray-500 dark:text-slate-400">Loading e-way bills...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-2xs w-full min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center">
              <FileCheck2 className="h-7 w-7 sm:h-8 sm:w-8 text-[#f58220]" />
            </div>
            <div className="max-w-md">
              <p className="text-gray-900 dark:text-white font-bold text-base sm:text-lg">No E-Way Bills Found</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
                {filtersActive
                  ? "No e-way bills match your search or filter criteria."
                  : "Create one from a sale invoice, delivery challan or stock transfer."}
              </p>
            </div>
            <button onClick={() => setView({ name: "form" })} className={S.btnPrimary}>
              <Plus className="h-4 w-4" /> Create E-Way Bill
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
            <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className={S.theadRow}>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" className="h-3.5 w-3.5 accent-[#f58220] cursor-pointer" disabled={drafts.length === 0} checked={allDraftsSelected}
                        title="Select drafts for bulk JSON export"
                        onChange={() => setSelected(allDraftsSelected ? new Set() : new Set(drafts.map((d) => d.id)))} />
                    </th>
                    <th className={S.th}>Doc Date</th>
                    <th className={S.th}>EWB No.</th>
                    <th className={S.th}>Document</th>
                    <th className={S.th}>Party Name</th>
                    <th className={S.th}>Vehicle</th>
                    <th className="text-right px-4 py-3">Value</th>
                    <th className={S.th}>Valid Until</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className={S.tbody}>
                  {rows.map((r) => {
                    const st = r.displayStatus || r.status;
                    const isDraft = r.status === "DRAFT";
                    const soon = st === "GENERATED" && r.validUntil && new Date(r.validUntil).getTime() - Date.now() < 24 * 3_600_000;
                    return (
                      <tr key={r.id} className={clsx(S.tr, "cursor-pointer")} onClick={() => openDetail(r.id)}>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {isDraft && <input type="checkbox" className="h-3.5 w-3.5 accent-[#f58220] cursor-pointer" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400 whitespace-nowrap">{formatDate(r.docDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {r.ewbNumber ? (
                            <span className="font-mono font-bold text-orange-600 dark:text-orange-400 text-xs">{formatEwbNo(r.ewbNumber)}</span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-slate-500">Not yet generated</span>
                          )}
                          <div className="text-[11px] text-gray-400 dark:text-slate-500 font-mono">{r.refNumber}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs font-semibold text-gray-800 dark:text-white">{r.docType} {r.docNo}</div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10">
                            {SOURCE_LABELS[r.sourceType]?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start max-w-[200px] sm:max-w-[240px]">
                            <span className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm truncate w-full" title={r.toTradeName}>{r.toTradeName}</span>
                            <span className="text-[11px] text-gray-400 dark:text-slate-500 truncate w-full">
                              {(r.fromPlace || r.fromPincode)} → {(r.toPlace || r.toPincode)} · {r.transDistance} km
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-slate-300 whitespace-nowrap">
                          {r.vehicleNo || r.transDocNo || <span className="font-sans text-amber-600 dark:text-amber-400">Part B pending</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-gray-900 dark:text-white text-xs sm:text-sm whitespace-nowrap">{inr(r.totInvValue)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {r.validUntil && st !== "CANCELLED" ? (
                            <>
                              <div className="text-xs text-gray-700 dark:text-slate-300">{formatDateTime(r.validUntil)}</div>
                              <div className={clsx("text-[11px]", soon ? "text-amber-600 dark:text-amber-400 font-semibold" : st === "EXPIRED" ? "text-rose-500" : "text-gray-400 dark:text-slate-500")}>
                                {timeLeft(r.validUntil)}
                              </div>
                            </>
                          ) : <span className="text-gray-400 dark:text-slate-500">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={clsx(S.badgeBase, STATUS_BADGE[st])}>{STATUS_LABEL[st]}</span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                            <button onClick={() => openDetail(r.id)} className={clsx(S.rowAction, "text-[#2563eb] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10")} title="View">
                              View
                            </button>
                            <button onClick={() => openDetail(r.id, true)} className={clsx(S.rowAction, "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5")} title="Print">
                              Print
                            </button>
                            {isDraft && (
                              <button onClick={() => deleteDraft(r)} className={clsx(S.rowAction, "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10")} title="Delete Draft">
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
