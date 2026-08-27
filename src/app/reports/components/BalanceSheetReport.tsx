"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  ArrowLeft as ArrowLeftIcon,
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  Calendar as CalendarIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";
import { formatDate } from "@/lib/utils";

interface ReportData {
  kpiValue: string;
  kpiSubText: string;
  rows: Record<string, any>[];
}

type ViewState = "sheet" | "summary";

export default function CentralBalanceSheetReport({
  reportData,
  loading,
}: {
  reportData: ReportData | null;
  loading: boolean;
}) {
  const [layout, setLayout] = useState<"horizontal" | "vertical">("horizontal");
  const [period, setPeriod] = useState("Custom");
  const [startDate] = useState("2026-04-01");
  const [endDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  // Drilldown state
  const [viewState, setViewState] = useState<ViewState>("sheet");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [summaryData, setSummaryData] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Collapsible state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    capitalAccount: true,
    ownersEquity: false,
    reservesSurplus: true,
    currentLiabilities: true,
    currentAssets: true,
    sundryDebtors: true,
  });

  const toggle = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  // Parse the raw API response (direct from backend, not the transformed version)
  const [rawApiData, setRawApiData] = useState<any>(null);

  useEffect(() => {
    if (!loading) {
      reportsApi.getBalanceSheet({ startDate, endDate }).then((res: any) => {
        setRawApiData(res.data);
      }).catch(() => {});
    }
  }, [loading, startDate, endDate]);

  // Drilldown handler
  const handleDrilldown = async (accountName: string) => {
    setSelectedAccount(accountName);
    setViewState("summary");
    setSummaryLoading(true);
    try {
      const res = await reportsApi.getAccountSummary({
        accountName,
        startDate,
        endDate,
      });
      setSummaryData(res.data);
    } catch {
      setSummaryData({
        accountName,
        openingBalance: "0 Cr.",
        rows: [],
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: "0 Cr.",
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          Computing balance sheet from ledger accounts...
        </p>
      </div>
    );
  }

  // Extract details from raw API data
  const details = rawApiData?.details || {};
  const assets = rawApiData?.assets || [];
  const liabilities = rawApiData?.liabilities || [];

  const findAmt = (arr: any[], search: string) => {
    const row = arr.find((r: any) => r.name?.toLowerCase().includes(search.toLowerCase()));
    return row?.amount ?? 0;
  };

  const currentAssetsAmt = findAmt(assets, "Current Assets");
  const fixedAssetsAmt = findAmt(assets, "Fixed Assets");
  const nonCurrentAssetsAmt = findAmt(assets, "Non Current");
  const otherAssetsAmt = findAmt(assets, "Other Assets");

  const longTermAmt = findAmt(liabilities, "Long-term");
  const currentLiabAmt = findAmt(liabilities, "Current Liabilities");
  const otherLiabAmt = findAmt(liabilities, "Other Liabilities");
  const retainedAmt = findAmt(liabilities, "Retained Earnings") || findAmt(liabilities, "Profit");

  const sundryDebtors: { name: string; amount: number }[] = details.sundryDebtors || [];
  const sundryCreditors: { name: string; amount: number }[] = details.sundryCreditors || [];
  const cashBalance = details.cashBalance || 0;
  const bankBalance = details.bankBalance || 0;
  const upiBalance = details.upiBalance || 0;
  const netProfit = details.netProfit || retainedAmt || 0;
  const reservesSurplus = netProfit;
  const capitalAmt = reservesSurplus;

  const totalAssets = fixedAssetsAmt + nonCurrentAssetsAmt + currentAssetsAmt + otherAssetsAmt;
  const totalLiabilities = capitalAmt + longTermAmt + currentLiabAmt + otherLiabAmt;

  const fmt = (v: number) => v === 0 ? "0" : v.toLocaleString("en-IN");
  const fmtDate = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const handlePrint = () => { toast.success("Preparing print layout..."); window.print(); };
  const handleExcel = () => toast.success("Excel export coming soon!");

  // ── Chevron + Bullet helpers ────────────────────────────────────────────────
  const Chev = ({ k }: { k: string }) =>
    expanded[k] ? (
      <ChevronDownIcon size={14} className="text-blue-600 dark:text-blue-400 shrink-0 cursor-pointer" onClick={() => toggle(k)} />
    ) : (
      <ChevronRightIcon size={14} className="text-blue-600 dark:text-blue-400 shrink-0 cursor-pointer" onClick={() => toggle(k)} />
    );

  const Bullet = () => <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />;

  // ── Row renderer ────────────────────────────────────────────────────────────
  const Row = ({ label, amount, indent = 0, bold = false, bullet = false, chevron, color, clickable }: {
    label: string; amount: number; indent?: number; bold?: boolean; bullet?: boolean; chevron?: string; color?: string; clickable?: boolean;
  }) => (
    <div
      className={`flex items-center justify-between py-2 px-4 border-b border-slate-100/60 dark:border-slate-800/40 transition-colors ${clickable ? "cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"} ${bold ? "font-bold" : ""}`}
      style={{ paddingLeft: `${16 + indent * 20}px` }}
      onClick={clickable ? () => handleDrilldown(label) : undefined}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {chevron && <Chev k={chevron} />}
        {bullet && <Bullet />}
        <span className={`text-[13px] truncate ${color || "text-slate-700 dark:text-slate-300"} ${bold ? "font-bold" : "font-medium"} ${clickable ? "underline decoration-dotted underline-offset-2" : ""}`}>
          {label}
        </span>
      </div>
      <span className={`text-[13px] tabular-nums shrink-0 ${color || "text-slate-700 dark:text-slate-300"} ${bold ? "font-bold" : "font-medium"}`}>
        {fmt(amount)}
      </span>
    </div>
  );

  // ── TRANSACTION SUMMARY DRILLDOWN ───────────────────────────────────────────
  if (viewState === "summary") {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewState("sheet")}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors no-print"
              >
                <ArrowLeftIcon size={16} className="text-slate-500" />
              </button>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Transaction Summary
              </h2>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button onClick={handlePrint} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center gap-1.5">
                <PrinterIcon size={12} /> Pdf
              </button>
              <button onClick={handleExcel} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-1.5">
                <ExcelIcon size={12} /> xls
              </button>
            </div>
          </div>

          {/* Account info bar */}
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-end gap-6 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Account Name: </span>
              <span className="font-bold text-blue-700 dark:text-blue-400">{summaryData?.accountName || selectedAccount}</span>
            </div>
            <div className="border-l border-slate-300 dark:border-slate-600 pl-4">
              <span className="text-slate-400 font-medium">Opening Balance: </span>
              <span className="font-bold text-blue-700 dark:text-blue-400">{summaryData?.openingBalance || "0 Cr."}</span>
            </div>
          </div>

          {/* Table */}
          {summaryLoading ? (
            <div className="p-10 text-center">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 mt-3">Loading transaction summary...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-3 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest" rowSpan={2}>Month</th>
                  <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center border-l border-slate-200 dark:border-slate-700" colSpan={2}>
                    Transactions in the Period
                  </th>
                  <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right border-l border-slate-200 dark:border-slate-700" rowSpan={2}>
                    Closing Balance
                  </th>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-5 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center border-l border-slate-200 dark:border-slate-700">Debit</th>
                  <th className="px-5 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Credit</th>
                </tr>
              </thead>
              <tbody>
                {(summaryData?.rows || []).map((row: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3 text-[13px] font-medium text-blue-700 dark:text-blue-400">{row.month}</td>
                    <td className="px-5 py-3 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-center border-l border-slate-100 dark:border-slate-800 tabular-nums">
                      {fmt(row.debit)}
                    </td>
                    <td className="px-5 py-3 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-center tabular-nums">
                      {fmt(row.credit)}
                    </td>
                    <td className="px-5 py-3 text-[13px] font-medium text-slate-700 dark:text-slate-300 text-right border-l border-slate-100 dark:border-slate-800 tabular-nums">
                      {row.closingBalance}
                    </td>
                  </tr>
                ))}
                {(!summaryData?.rows || summaryData.rows.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-xs text-slate-400">No transactions found for this period.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-orange-50 dark:bg-orange-950/20 border-t-2 border-orange-400 dark:border-orange-600">
                  <td className="px-5 py-3 text-[13px] font-black text-blue-600 dark:text-blue-400">Total</td>
                  <td className="px-5 py-3 text-[13px] font-black text-blue-600 dark:text-blue-400 text-center border-l border-orange-300 dark:border-orange-800 tabular-nums">
                    {fmt(summaryData?.totalDebit || 0)}
                  </td>
                  <td className="px-5 py-3 text-[13px] font-black text-blue-600 dark:text-blue-400 text-center tabular-nums">
                    {fmt(summaryData?.totalCredit || 0)}
                  </td>
                  <td className="px-5 py-3 text-[13px] font-black text-blue-600 dark:text-blue-400 text-right border-l border-orange-300 dark:border-orange-800 tabular-nums">
                    {summaryData?.closingBalance || "0 Cr."}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ── EQUITIES & LIABILITIES PANEL ────────────────────────────────────────────
  const EquitiesPanel = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Account</span>
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Amount</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <h3 className="text-[15px] font-black text-slate-800 dark:text-white px-4 pt-4 pb-2">
          Equities & Liabilities
        </h3>

        <Row label="Capital Account" amount={capitalAmt} chevron="capitalAccount" bold color="text-blue-700 dark:text-blue-400" clickable />
        {expanded.capitalAccount && (
          <>
            <Row label="Owner's Equity" amount={0} indent={2} chevron="ownersEquity" color="text-emerald-600 dark:text-emerald-400" clickable />
            {expanded.ownersEquity && (
              <Row label="Owner's Equity [Default]" amount={0} indent={3} bullet />
            )}
            <Row label="Reserves & Surplus" amount={reservesSurplus} indent={2} chevron="reservesSurplus" color="text-blue-600 dark:text-blue-400" />
            {expanded.reservesSurplus && (
              <>
                <Row label="Reserves & Surplus [Default]" amount={0} indent={3} bullet />
                <Row label="Net Income (Profit)" amount={netProfit} indent={3} bullet />
                <Row label="Revaluation Reserve" amount={0} indent={3} bullet />
                <Row label="Retained Earnings" amount={0} indent={3} bullet />
              </>
            )}
          </>
        )}

        <Row label="Long-term Liabilities" amount={longTermAmt} indent={0} bullet />
        <Row label="Current Liabilities" amount={currentLiabAmt} chevron="currentLiabilities" color="text-blue-700 dark:text-blue-400" clickable />
        {expanded.currentLiabilities && (
          <>
            <Row label="Sundry Creditors" amount={sundryCreditors.reduce((s, c) => s + c.amount, 0)} indent={2} bullet clickable />
            {sundryCreditors.map((c, i) => (
              <Row key={i} label={c.name} amount={c.amount} indent={3} bullet />
            ))}
            <Row label="Outward Duties & Taxes" amount={0} indent={2} bullet />
            <Row label="Other Current Liabilities" amount={0} indent={2} bullet />
          </>
        )}
        <Row label="Other Liabilities" amount={otherLiabAmt} indent={0} bullet />
      </div>

      <div className="px-4 py-3 bg-orange-50 dark:bg-orange-950/20 border-t-2 border-orange-400 dark:border-orange-600 flex items-center justify-between mt-auto">
        <span className="text-[13px] font-black text-orange-600 dark:text-orange-400">Total Equities & Liabilities</span>
        <span className="text-[13px] font-black text-orange-600 dark:text-orange-400 tabular-nums">{fmt(totalLiabilities)}</span>
      </div>
    </div>
  );

  // ── ASSETS PANEL ────────────────────────────────────────────────────────────
  const AssetsPanel = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Account</span>
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Amount</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <h3 className="text-[15px] font-black text-slate-800 dark:text-white px-4 pt-4 pb-2">Assets</h3>

        <Row label="Fixed Assets" amount={fixedAssetsAmt} indent={0} bullet />
        <Row label="Non Current Assets" amount={nonCurrentAssetsAmt} indent={0} bullet />

        <Row label="Current Assets" amount={currentAssetsAmt} chevron="currentAssets" color="text-blue-700 dark:text-blue-400" clickable />
        {expanded.currentAssets && (
          <>
            <Row label="Sundry Debtors" amount={sundryDebtors.reduce((s, d) => s + d.amount, 0)} indent={2} chevron="sundryDebtors" color="text-emerald-600 dark:text-emerald-400" clickable />
            {expanded.sundryDebtors && sundryDebtors.map((d, i) => (
              <Row key={i} label={d.name} amount={d.amount} indent={3} bullet clickable />
            ))}
            <Row label="Input Duties & Taxes" amount={0} indent={2} bullet />
            <Row label="Bank Accounts" amount={bankBalance} indent={2} bullet clickable />
            <Row label="Cash Accounts" amount={cashBalance} indent={2} bullet clickable />
            <Row label="Other Current Assets" amount={upiBalance} indent={2} bullet />
          </>
        )}
        <Row label="Other Assets" amount={otherAssetsAmt} indent={0} bullet />
      </div>

      <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/20 border-t-2 border-blue-400 dark:border-blue-600 flex items-center justify-between mt-auto">
        <span className="text-[13px] font-black text-blue-600 dark:text-blue-400">Total Assets</span>
        <span className="text-[13px] font-black text-blue-600 dark:text-blue-400 tabular-nums">{fmt(totalAssets)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Balance Sheet</h2>
          <div className="flex items-center gap-2 no-print">
            <button onClick={handlePrint} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center gap-1.5">
              <PrinterIcon size={12} /> Pdf
            </button>
            <button onClick={handleExcel} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-1.5">
              <ExcelIcon size={12} /> xls
            </button>
          </div>
        </div>

        {/* Period + Layout Toggle */}
        <div className="px-5 pb-3 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold text-slate-500 dark:text-slate-400">Period :</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="appearance-none px-3 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold cursor-pointer outline-none"
            >
              <option>This Month</option>
              <option>This Year</option>
              <option>Custom</option>
            </select>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg font-bold text-slate-600 dark:text-slate-300">
              <CalendarIcon size={12} className="text-slate-400" />
              <span>{fmtDate(startDate)} To {fmtDate(endDate)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 no-print">
            <span className={layout === "horizontal" ? "text-blue-600 dark:text-blue-400" : ""}>Horizontal</span>
            <button
              onClick={() => setLayout(layout === "horizontal" ? "vertical" : "horizontal")}
              className="relative w-10 h-5 rounded-full bg-blue-500 dark:bg-blue-600 transition-colors"
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${layout === "horizontal" ? "left-0.5" : "left-[22px]"}`} />
            </button>
            <span className={layout === "vertical" ? "text-blue-600 dark:text-blue-400" : ""}>Vertical</span>
          </div>
        </div>

        <div className="px-5 pb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Balance Sheet as on {formatDate(endDate)}
        </div>

        {layout === "horizontal" ? (
          <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700 min-h-[500px]">
            <EquitiesPanel />
            <AssetsPanel />
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            <div className="border-t border-slate-200 dark:border-slate-700"><EquitiesPanel /></div>
            <div className="border-t border-slate-200 dark:border-slate-700"><AssetsPanel /></div>
          </div>
        )}
      </div>
    </div>
  );
}
