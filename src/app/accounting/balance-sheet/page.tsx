"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Landmark,
  RefreshCw,
  Search,
  Printer,
  ChevronDown,
  ChevronRight,
  Wallet,
  Building2,
  Smartphone,
  Users,
  Package,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Scale,
} from "lucide-react";
import { clsx } from "clsx";
import { reportsApi } from "@/lib/api/accounting.api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LineItem {
  name: string;
  amount: number;
  notes?: string;
}

interface BalanceSheetData {
  assets: LineItem[];
  liabilities: LineItem[];
  details: {
    sundryDebtors: { name: string; amount: number }[];
    sundryCreditors: { name: string; amount: number }[];
    accounts: { name: string; type: string; balance: number }[];
    cashBalance: number;
    bankBalance: number;
    upiBalance: number;
    totalDebtorsDebit: number;
    inventoryValuation: number;
    sundryCreditorsBalance: number;
    totalSales: number;
    totalCOGS: number;
    totalExpenses: number;
    netProfit: number;
  };
}

// ── Currency Formatter ─────────────────────────────────────────────────────────

const fmtCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return "—";
  const num = Number(val);
  const isNegative = num < 0;
  const absFormatted = Math.abs(num).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-₹${absFormatted}` : `₹${absFormatted}`;
};

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");

  // Expand / collapse states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    accounts: true,
    debtors: false,
    creditors: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    setExpandedSections({
      accounts: true,
      debtors: true,
      creditors: true,
    });
  };

  const collapseAll = () => {
    setExpandedSections({
      accounts: false,
      debtors: false,
      creditors: false,
    });
  };

  // ── Fetch Balance Sheet Data ──────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getBalanceSheet({ endDate: asOfDate });
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to load balance sheet:", err);
      toast.error(err?.response?.data?.error || "Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Calculations ─────────────────────────────────────────────────────────────

  const totalAssets = useMemo(() => {
    if (!data?.assets) return 0;
    // Current Assets already summarizes cash + bank + debtors + inventory
    // Top-level main line items: Fixed Assets + Non Current Assets + Current Assets + Other Assets
    return (
      (data.assets.find((a) => a.name === "Fixed Assets")?.amount || 0) +
      (data.assets.find((a) => a.name === "Non Current Assets")?.amount || 0) +
      (data.assets.find((a) => a.name === "Current Assets")?.amount || 0) +
      (data.assets.find((a) => a.name === "Other Assets")?.amount || 0)
    );
  }, [data]);

  const totalLiabilitiesOnly = useMemo(() => {
    if (!data?.liabilities) return 0;
    return (
      (data.liabilities.find((l) => l.name === "Long-term Liabilities")?.amount || 0) +
      (data.liabilities.find((l) => l.name === "Current Liabilities")?.amount || 0) +
      (data.liabilities.find((l) => l.name === "Other Liabilities")?.amount || 0)
    );
  }, [data]);

  const totalEquity = useMemo(() => {
    if (!data?.liabilities) return 0;
    return (
      (data.liabilities.find((l) => l.name === "Capital Account")?.amount || 0) +
      (data.liabilities.find((l) => l.name.includes("Retained Earnings"))?.amount || 0)
    );
  }, [data]);

  const totalLiabilitiesAndEquity = totalLiabilitiesOnly + totalEquity;
  const difference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
  const isBalanced = difference < 0.01;

  // ── Print Handler ────────────────────────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  // ── Filtered breakdown items ─────────────────────────────────────────────────

  const filteredAccounts = useMemo(() => {
    const accs = data?.details?.accounts || [];
    if (!searchQuery.trim()) return accs;
    const q = searchQuery.toLowerCase().trim();
    return accs.filter((a) => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q));
  }, [data, searchQuery]);

  const filteredDebtors = useMemo(() => {
    const d = data?.details?.sundryDebtors || [];
    if (!searchQuery.trim()) return d;
    const q = searchQuery.toLowerCase().trim();
    return d.filter((item) => item.name.toLowerCase().includes(q));
  }, [data, searchQuery]);

  const filteredCreditors = useMemo(() => {
    const c = data?.details?.sundryCreditors || [];
    if (!searchQuery.trim()) return c;
    const q = searchQuery.toLowerCase().trim();
    return c.filter((item) => item.name.toLowerCase().includes(q));
  }, [data, searchQuery]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#020617] text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">
      
      {/* ── Top Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Landmark className="h-5 w-5" />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
            Balance Sheet
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            title="Print Balance Sheet"
          >
            <Printer className="h-4 w-4 text-gray-500 dark:text-slate-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">

        {/* ── Summary / KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
          {/* 1. Total Assets */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Assets
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(totalAssets)}
              </div>
            </div>
          </div>

          {/* 2. Total Liabilities */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-50 dark:ring-rose-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Liabilities
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(totalLiabilitiesOnly)}
              </div>
            </div>
          </div>

          {/* 3. Equity & Retained Earnings */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-50 dark:ring-blue-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Equity &amp; Net Profit
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-blue-600 dark:text-blue-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(totalEquity)}
              </div>
            </div>
          </div>

          {/* 4. Total Liabilities & Equity */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f58220] ring-4 ring-orange-50 dark:ring-orange-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Liabilities + Equity
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[#f58220] dark:text-[#f58220] mt-1 truncate">
                {loading ? "..." : fmtCurrency(totalLiabilitiesAndEquity)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Filters & Search Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0 bg-white dark:bg-card p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search Asset / Liability Account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-[#f58220] transition-colors"
            />
          </div>

          {/* As Of Date Selector */}
          <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-[#13151f] text-xs shrink-0">
            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase">As of:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="text-xs font-semibold text-gray-800 dark:text-white outline-none bg-transparent cursor-pointer"
            />
          </div>

          {/* Expand / Collapse All */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/10 transition-colors"
            >
              Collapse All
            </button>
          </div>

          <div className="flex-1" />

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors shrink-0"
            title="Refresh Balance Sheet"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-orange-500")} />
          </button>
        </div>

        {/* ── Balance Status Banner (if difference exists) ── */}
        {!isBalanced && !loading && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3.5 sm:p-4 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Assets and Liabilities &amp; Equity differ by {fmtCurrency(difference)}.</span>
              <p className="text-amber-700/90 dark:text-amber-400/90 text-[11px]">
                Capital account equity allocations or long-term liability entries not yet finalized in the general ledger account for the variance as of {formatDate(asOfDate)}.
              </p>
            </div>
          </div>
        )}

        {/* ── Balance Sheet Main Grid ── */}
        {loading ? (
          <div className="py-24 bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 flex flex-col justify-center items-center gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-[#f58220]" />
            <span className="text-xs font-medium text-gray-400 dark:text-slate-500">Calculating balance sheet position...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full min-w-0">
            
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ── LEFT COLUMN: ASSETS ── */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden shadow-2xs flex flex-col justify-between">
              <div>
                <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02] flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Assets
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {fmtCurrency(totalAssets)}
                  </span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                  
                  {/* 1. Current Assets Group */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wide flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        Current Assets
                      </span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        {fmtCurrency(
                          (data?.details?.cashBalance || 0) +
                          (data?.details?.bankBalance || 0) +
                          (data?.details?.upiBalance || 0) +
                          (data?.details?.totalDebtorsDebit || 0) +
                          (data?.details?.inventoryValuation || 0)
                        )}
                      </span>
                    </div>

                    <div className="space-y-2 pl-2">
                      {/* A. Cash & Bank Accounts */}
                      <div className="bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleSection("accounts")}
                            className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-200 hover:text-[#f58220] transition-colors text-left"
                          >
                            {expandedSections.accounts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>Cash &amp; Bank Liquidity</span>
                          </button>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">
                            {fmtCurrency((data?.details?.cashBalance || 0) + (data?.details?.bankBalance || 0) + (data?.details?.upiBalance || 0))}
                          </span>
                        </div>

                        {expandedSections.accounts && (
                          <div className="pl-5 pt-1.5 space-y-1.5 border-t border-gray-200/60 dark:border-white/5 text-[11px]">
                            {filteredAccounts.length > 0 ? (
                              filteredAccounts.map((acc, i) => (
                                <div key={i} className="flex justify-between items-center text-gray-600 dark:text-slate-400">
                                  <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                    {acc.type === "CASH" && <Wallet className="h-3 w-3 text-emerald-600" />}
                                    {acc.type === "BANK" && <Building2 className="h-3 w-3 text-blue-600" />}
                                    {acc.type === "UPI" && <Smartphone className="h-3 w-3 text-purple-600" />}
                                    <span className="truncate">{acc.name}</span>
                                  </div>
                                  <span className="font-mono font-medium text-gray-800 dark:text-slate-200">{fmtCurrency(acc.balance)}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-400">No account details found</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* B. Sundry Debtors (Receivables) */}
                      <div className="bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleSection("debtors")}
                            className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-200 hover:text-[#f58220] transition-colors text-left"
                          >
                            {expandedSections.debtors ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>Sundry Debtors (Receivables)</span>
                          </button>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">
                            {fmtCurrency(data?.details?.totalDebtorsDebit || 0)}
                          </span>
                        </div>

                        {expandedSections.debtors && (
                          <div className="pl-5 pt-1.5 space-y-1.5 border-t border-gray-200/60 dark:border-white/5 text-[11px] max-h-48 overflow-y-auto custom-scrollbar">
                            {filteredDebtors.length > 0 ? (
                              filteredDebtors.map((d, i) => (
                                <div key={i} className="flex justify-between items-center text-gray-600 dark:text-slate-400">
                                  <span className="truncate max-w-[200px]">{d.name}</span>
                                  <span className="font-mono font-medium text-gray-800 dark:text-slate-200">{fmtCurrency(d.amount)}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-400">No customer receivables</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* C. Inventory Stock Valuation */}
                      <div className="bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-200">
                          <Package className="h-3.5 w-3.5 text-orange-500" />
                          <span>Inventory Stock Valuation</span>
                        </div>
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">
                          {fmtCurrency(data?.details?.inventoryValuation || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Non-Current Assets */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wide">
                        Non-Current Assets
                      </span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-white">
                        {fmtCurrency(0)}
                      </span>
                    </div>
                    <div className="pl-2 space-y-1.5 text-gray-600 dark:text-slate-400 text-[11px]">
                      <div className="flex justify-between">
                        <span>Fixed Assets</span>
                        <span className="font-mono">{fmtCurrency(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Other Non-Current Assets</span>
                        <span className="font-mono">{fmtCurrency(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assets Footer Total */}
              <div className="px-5 py-4 border-t-2 border-gray-200 dark:border-white/10 bg-gray-50/90 dark:bg-white/[0.03] flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Total Assets
                </span>
                <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {fmtCurrency(totalAssets)}
                </span>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ── RIGHT COLUMN: LIABILITIES & EQUITY ── */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden shadow-2xs flex flex-col justify-between">
              <div>
                <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02] flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Liabilities &amp; Equity
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                    {fmtCurrency(totalLiabilitiesAndEquity)}
                  </span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                  
                  {/* 1. Current Liabilities Group */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wide flex items-center gap-1.5">
                        <ArrowDownLeft className="h-3.5 w-3.5 text-rose-600" />
                        Current Liabilities
                      </span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        {fmtCurrency(data?.details?.sundryCreditorsBalance || 0)}
                      </span>
                    </div>

                    <div className="space-y-2 pl-2">
                      {/* A. Sundry Creditors (Vendor Payables) */}
                      <div className="bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleSection("creditors")}
                            className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-slate-200 hover:text-[#f58220] transition-colors text-left"
                          >
                            {expandedSections.creditors ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>Sundry Creditors (Payables)</span>
                          </button>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">
                            {fmtCurrency(data?.details?.sundryCreditorsBalance || 0)}
                          </span>
                        </div>

                        {expandedSections.creditors && (
                          <div className="pl-5 pt-1.5 space-y-1.5 border-t border-gray-200/60 dark:border-white/5 text-[11px] max-h-48 overflow-y-auto custom-scrollbar">
                            {filteredCreditors.length > 0 ? (
                              filteredCreditors.map((c, i) => (
                                <div key={i} className="flex justify-between items-center text-gray-600 dark:text-slate-400">
                                  <span className="truncate max-w-[200px]">{c.name}</span>
                                  <span className="font-mono font-medium text-gray-800 dark:text-slate-200">{fmtCurrency(c.amount)}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-400">No vendor payables</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* B. Other Current Liabilities */}
                      <div className="bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-lg p-3 flex items-center justify-between">
                        <span className="font-semibold text-gray-800 dark:text-slate-200">GST / Tax Payables</span>
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">{fmtCurrency(0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Non-Current Liabilities */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wide">
                        Non-Current Liabilities
                      </span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-white">
                        {fmtCurrency(0)}
                      </span>
                    </div>
                    <div className="pl-2 space-y-1.5 text-gray-600 dark:text-slate-400 text-[11px]">
                      <div className="flex justify-between">
                        <span>Long-term Loans &amp; Borrowings</span>
                        <span className="font-mono">{fmtCurrency(0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Equity & Reserves Group */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wide flex items-center gap-1.5">
                        <Scale className="h-3.5 w-3.5 text-blue-600" />
                        Equity &amp; Reserves
                      </span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        {fmtCurrency(totalEquity)}
                      </span>
                    </div>

                    <div className="space-y-2 pl-2">
                      <div className="bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-lg p-3 flex items-center justify-between">
                        <span className="font-semibold text-gray-800 dark:text-slate-200">Capital Account</span>
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">{fmtCurrency(0)}</span>
                      </div>

                      <div className="bg-blue-50/40 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-blue-900 dark:text-blue-300 block">
                            Retained Earnings / Current Period Net Profit
                          </span>
                          <span className="text-[10px] text-blue-700/80 dark:text-blue-400/80">
                            Synced from Profit &amp; Loss Statement
                          </span>
                        </div>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {fmtCurrency(data?.details?.netProfit || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Liabilities & Equity Footer Total */}
              <div className="px-5 py-4 border-t-2 border-gray-200 dark:border-white/10 bg-gray-50/90 dark:bg-white/[0.03] flex items-center justify-between">
                <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                  Total Liabilities &amp; Equity
                </span>
                <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
                  {fmtCurrency(totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
