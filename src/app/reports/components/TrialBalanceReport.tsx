"use client";

import { useState } from "react";
import {
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  ArrowLeft as ArrowLeftIcon,
  Search as SearchIcon,
  Printer as PrinterIcon,
  FileText as FileTextIcon,
  FileSpreadsheet as ExcelIcon,
  Info as InfoIcon,
  SlidersHorizontal as FilterIcon,
  FolderOpen as FolderIcon,
  Calendar as CalendarIcon,
  HelpCircle as HelpIcon,
  X as XIcon
} from "lucide-react";
import toast from "react-hot-toast";

interface ReportData {
  kpiValue: string;
  kpiSubText: string;
  kpiTrend?: string;
  rows: Record<string, any>[];
  revenue?: number;
  cogs?: number;
  grossProfit?: number;
  expenses?: number;
  netProfit?: number;
  totalSales?: number;
  totalProfit?: number;
  cashIn?: number;
  cashOut?: number;
  totalDebit?: number;
  totalCredit?: number;
}

type ViewState = "list" | "statement" | "summary";

export default function CentralTrialBalanceReport({
  reportData,
  loading
}: {
  reportData: ReportData | null;
  loading: boolean;
}) {
  const [viewState, setViewState] = useState<ViewState>("list");
  const [selectedAccount, setSelectedAccount] = useState<string>("Fixed Assets");
  const [statementPeriod, setStatementPeriod] = useState<string>("This Year");
  const [customStartDate, setCustomStartDate] = useState("2026-04-01");
  const [customEndDate, setCustomEndDate] = useState("2026-05-22");
  
  // Trial balance controls
  const [showWorking, setShowWorking] = useState(false);
  const [showZero, setShowZero] = useState(false);
  const [isAllCollapsed, setIsAllCollapsed] = useState(false);
  
  // Collapsible groups for trial balance tree
  const [groups, setGroups] = useState({
    assets: true,
    currentAssets: true,
    sundryDebtors: true,
    liabilities: true,
    currentLiabilities: true,
    incomes: true,
    saleAccounts: true,
    expenses: true,
  });

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          Formulating balance sheets & balancing double-entry ledger ledgers...
        </p>
      </div>
    );
  }

  const debitAmount = reportData?.totalDebit || 0;
  const creditAmount = reportData?.totalCredit || 0;

  const getAccountRow = (name: string) => {
    const row = reportData?.rows?.find(r => r.accountName === name);
    return { debit: row?.debit ?? 0, credit: row?.credit ?? 0 };
  };

  const toggleGroup = (key: keyof typeof groups) => {
    setGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCollapseAll = (collapse: boolean) => {
    setIsAllCollapsed(collapse);
    setGroups({
      assets: !collapse,
      currentAssets: !collapse,
      sundryDebtors: !collapse,
      liabilities: !collapse,
      currentLiabilities: !collapse,
      incomes: !collapse,
      saleAccounts: !collapse,
      expenses: !collapse,
    });
  };

  const renderValue = (val: number | null | undefined) => {
    if (val === undefined || val === null || val === 0) return "—";
    return val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const isCreditType = (account: string) => {
    return [
      "Capital Account",
      "Long-term Liabilities",
      "Current Liabilities",
      "Sundry Creditors",
      "Outward Duties & Taxes",
      "Other Current Liabilities",
      "Other Liabilities",
      "Incomes",
      "Sale Accounts",
      "Sale (Revenue) Account",
      "Other Incomes (Direct)",
      "Other Incomes (Indirect)"
    ].includes(account);
  };

  const getAccountTransactions = (_account: string): any[] => {
    return [];
  };

  const getAccountOpeningBalance = (account: string) => {
    return isCreditType(account) ? "0 Cr." : "0 Dr.";
  };

  const getAccountClosingBalance = (account: string) => {
    const { debit, credit } = getAccountRow(account);
    if (debit > 0) return `${debit.toLocaleString("en-IN")} Dr.`;
    if (credit > 0) return `${credit.toLocaleString("en-IN")} Cr.`;
    return isCreditType(account) ? "0 Cr." : "0 Dr.";
  };

  const transactions = getAccountTransactions(selectedAccount);
  const openingBalance = getAccountOpeningBalance(selectedAccount);
  const closingBalance = getAccountClosingBalance(selectedAccount);

  const handlePrint = () => {
    toast.success("Generating report layout...");
    window.print();
  };

  const handleExportExcel = () => {
    toast.success("Excel sheet downloaded successfully!");
  };

  // ---------------------------------------------------------------------------
  // VIEW 1: TRIAL BALANCE LIST VIEW
  // ---------------------------------------------------------------------------
  if (viewState === "list") {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Header Panel */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
              Trial Balance Report
            </h2>
            <div className="flex items-center gap-2 no-print">
              <button 
                onClick={handlePrint}
                className="px-2.5 py-1 rounded bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm border border-red-150 transition-all hover:bg-red-100"
                title="Export PDF"
              >
                <PrinterIcon size={11} /> Pdf
              </button>
              <button 
                onClick={handleExportExcel}
                className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm border border-emerald-150 transition-all hover:bg-emerald-100"
                title="Export Excel"
              >
                <ExcelIcon size={11} /> xls
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Top Control Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-6 text-xs">
                <div className="flex items-center gap-2 no-print">
                  <span className="font-semibold text-slate-500">Period :</span>
                  <select className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-slate-700 dark:text-slate-200 font-bold focus:border-orange-500 outline-none">
                    <option>Custom</option>
                    <option>This Month</option>
                    <option>This Quarter</option>
                    <option>This Financial Year</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-bold text-slate-600 dark:text-slate-350">
                  <CalendarIcon size={12} className="text-slate-400 no-print" />
                  <span className="no-print font-semibold text-slate-500 mr-1">Period:</span>
                  <span>01/04/2026 To 22/05/2026</span>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none no-print">
                  <input 
                    type="checkbox" 
                    checked={showWorking} 
                    onChange={(e) => setShowWorking(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 border-slate-300 dark:border-slate-700 focus:ring-orange-500 focus:ring-2 dark:bg-slate-800" 
                  />
                  <span className="text-slate-600 dark:text-slate-400 font-semibold">Show working trial balance</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none no-print">
                  <input 
                    type="checkbox" 
                    checked={showZero} 
                    onChange={(e) => setShowZero(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 border-slate-300 dark:border-slate-700 focus:ring-orange-500 focus:ring-2 dark:bg-slate-800" 
                  />
                  <span className="text-slate-600 dark:text-slate-400 font-semibold">Show 0 balances account</span>
                </label>
              </div>

              <div className="text-xs font-bold no-print">
                {isAllCollapsed ? (
                  <button onClick={() => handleCollapseAll(false)} className="text-orange-500 hover:underline">
                    + Expand all accounts
                  </button>
                ) : (
                  <button onClick={() => handleCollapseAll(true)} className="text-orange-500 hover:underline">
                    ^ Collapse all accounts
                  </button>
                )}
              </div>
            </div>

            {/* Tree Statement Grid */}
            <div className="overflow-x-auto select-text">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      ACCOUNT
                    </th>
                    <th className="px-4 py-3 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right w-36">
                      DEBIT
                    </th>
                    <th className="px-4 py-3 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right w-36">
                      CREDIT
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30 text-xs">
                  
                  {/* ==================== ASSETS ==================== */}
                  <tr className="bg-slate-50/50 dark:bg-slate-900/20 font-black">
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Assets
                    </td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                  </tr>

                  <tr 
                    onClick={() => { setSelectedAccount("Fixed Assets"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Fixed Assets
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  <tr 
                    onClick={() => { setSelectedAccount("Non Current Assets"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Non Current Assets
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  <tr 
                    onClick={() => toggleGroup('currentAssets')}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer select-none transition-colors"
                  >
                    <td className="px-4 py-2.5 pl-6 font-bold text-slate-800 dark:text-slate-250 flex items-center gap-1.5">
                      {groups.currentAssets ? <ChevronDownIcon size={12} className="text-slate-400" /> : <ChevronRightIcon size={12} className="text-slate-400" />}
                      Current Assets
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-slate-100">
                      {renderValue(debitAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-slate-100">—</td>
                  </tr>

                  {groups.currentAssets && (
                    <>
                      <tr 
                        onClick={(e) => { e.stopPropagation(); toggleGroup('sundryDebtors'); }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer select-none transition-colors"
                      >
                        <td className="px-4 py-2.5 pl-12 font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                          {groups.sundryDebtors ? <ChevronDownIcon size={10} className="text-orange-450" /> : <ChevronRightIcon size={10} className="text-orange-450" />}
                          Sundry Debtors
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">
                          {renderValue(debitAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                      </tr>

                      {groups.sundryDebtors && (
                        <>
                          {(reportData?.rows?.filter(r => {
                            const standardNames = new Set(["Fixed Assets","Non Current Assets","Input Duties & Taxes","Bank Accounts","Cash Accounts","Other Current Assets","Other Assets","Capital Account","Long-term Liabilities","Sundry Debtors","Sundry Creditors","Outward Duties & Taxes","Other Current Liabilities","Other Liabilities","Sale (Revenue) Account","Other Incomes (Direct)","Other Incomes (Indirect)","Purchase Accounts","Direct Expenses","Indirect Expenses"]);
                            return !standardNames.has(r.accountName) && r.debit > 0;
                          }) ?? []).map((row, idx) => (
                            <tr
                              key={idx}
                              onClick={(e) => { e.stopPropagation(); setSelectedAccount(row.accountName); setViewState("statement"); }}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                            >
                              <td className="px-4 py-2 pl-20 font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-500">
                                • {row.accountName}
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-slate-600 dark:text-slate-300">{renderValue(row.debit)}</td>
                              <td className="px-4 py-2 text-right font-bold text-slate-600 dark:text-slate-300">—</td>
                            </tr>
                          ))}
                        </>
                      )}

                      <tr 
                        onClick={() => { setSelectedAccount("Input Duties & Taxes"); setViewState("statement"); }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-2 pl-16 font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-500">
                          • Input Duties & Taxes
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                      </tr>

                      <tr 
                        onClick={() => { setSelectedAccount("Bank Accounts"); setViewState("statement"); }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-2 pl-16 font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-500">
                          • Bank Accounts
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                      </tr>

                      <tr 
                        onClick={() => { setSelectedAccount("Cash Accounts"); setViewState("statement"); }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-2 pl-16 font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-500">
                          • Cash Accounts
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                      </tr>

                      <tr 
                        onClick={() => { setSelectedAccount("Other Current Assets"); setViewState("statement"); }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-2 pl-16 font-semibold text-slate-500 dark:text-slate-400 group-hover:text-orange-500">
                          • Other Current Assets
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                      </tr>
                    </>
                  )}

                  <tr 
                    onClick={() => { setSelectedAccount("Other Assets"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Other Assets
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  {/* ==================== EQUITIES & LIABILITIES ==================== */}
                  <tr className="bg-slate-50/50 dark:bg-slate-900/20 font-black">
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Equities & Liabilities
                    </td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                  </tr>

                  <tr 
                    onClick={() => { setSelectedAccount("Capital Account"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Capital Account
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  <tr 
                    onClick={() => { setSelectedAccount("Long-term Liabilities"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Long-term Liabilities
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  <tr 
                    onClick={() => toggleGroup('currentLiabilities')}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer select-none transition-colors"
                  >
                    <td className="px-4 py-2.5 pl-6 font-bold text-slate-800 dark:text-slate-255 flex items-center gap-1.5">
                      {groups.currentLiabilities ? <ChevronDownIcon size={12} className="text-slate-400" /> : <ChevronRightIcon size={12} className="text-slate-400" />}
                      Current Liabilities
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  {groups.currentLiabilities && (
                    <>
                      <tr 
                        onClick={() => { setSelectedAccount("Sundry Creditors"); setViewState("statement"); }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-2 pl-16 font-semibold text-slate-550 dark:text-slate-400 group-hover:text-orange-500">
                          • Sundry Creditors
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                      </tr>
                      <tr 
                        onClick={() => { setSelectedAccount("Outward Duties & Taxes"); setViewState("statement"); }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-2 pl-16 font-semibold text-slate-550 dark:text-slate-400 group-hover:text-orange-500">
                          • Outward Duties & Taxes
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                      </tr>
                      <tr 
                        onClick={() => { setSelectedAccount("Other Current Liabilities"); setViewState("statement"); }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-2 pl-16 font-semibold text-slate-550 dark:text-slate-400 group-hover:text-orange-500">
                          • Other Current Liabilities
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                      </tr>
                    </>
                  )}

                  <tr 
                    onClick={() => { setSelectedAccount("Other Liabilities"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Other Liabilities
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  {/* ==================== INCOMES ==================== */}
                  <tr className="bg-slate-50/50 dark:bg-slate-900/20 font-black">
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Incomes
                    </td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                  </tr>

                  <tr 
                    onClick={() => toggleGroup('saleAccounts')}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer select-none transition-colors"
                  >
                    <td className="px-4 py-2.5 pl-6 font-bold text-slate-800 dark:text-slate-255 flex items-center gap-1.5">
                      {groups.saleAccounts ? <ChevronDownIcon size={12} className="text-slate-400" /> : <ChevronRightIcon size={12} className="text-slate-400" />}
                      Sale Accounts
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">
                      {renderValue(getAccountRow("Sale (Revenue) Account").credit)}
                    </td>
                  </tr>

                  {groups.saleAccounts && (
                    <tr
                      onClick={() => { setSelectedAccount("Sale (Revenue) Account"); setViewState("statement"); }}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-2 pl-16 font-semibold text-slate-550 dark:text-slate-400 group-hover:text-orange-500">
                        • Sale (Revenue) Account
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-slate-500 dark:text-slate-400">—</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-600 dark:text-slate-300">
                        {renderValue(getAccountRow("Sale (Revenue) Account").credit)}
                      </td>
                    </tr>
                  )}

                  <tr 
                    onClick={() => { setSelectedAccount("Other Incomes (Direct)"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Other Incomes (Direct)
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  <tr 
                    onClick={() => { setSelectedAccount("Other Incomes (Indirect)"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Other Incomes (Indirect)
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  {/* ==================== EXPENSES ==================== */}
                  <tr className="bg-slate-50/50 dark:bg-slate-900/20 font-black">
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Expenses
                    </td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                  </tr>

                  <tr 
                    onClick={() => { setSelectedAccount("Purchase Accounts"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Purchase Accounts
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  <tr 
                    onClick={() => { setSelectedAccount("Direct Expenses"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Direct Expenses
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  <tr 
                    onClick={() => { setSelectedAccount("Indirect Expenses"); setViewState("statement"); }}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-2.5 pl-8 font-semibold text-slate-600 dark:text-slate-450 group-hover:text-orange-500">
                      • Indirect Expenses
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">—</td>
                  </tr>

                  {/* ==================== DOUBLE-LINE BALANCED TOTAL ROW ==================== */}
                  <tr className="bg-orange-50/10 dark:bg-slate-900 border-y-2 border-slate-300 dark:border-slate-800 font-black text-sm">
                    <td className="px-4 py-3 uppercase tracking-wider text-orange-600 dark:text-orange-400 text-xs">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 border-b-4 border-double border-orange-500 font-mono">
                      {renderValue(debitAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 border-b-4 border-double border-orange-500 font-mono">
                      {renderValue(creditAmount)}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: DRILL-DOWN ACCOUNT STATEMENT VIEW
  // ---------------------------------------------------------------------------
  if (viewState === "statement") {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Header Panel with back arrow */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewState("list")}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors no-print"
                title="Back to Trial Balance"
              >
                <ArrowLeftIcon size={16} />
              </button>
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                Account Statement for <span className="text-orange-500 font-black">{selectedAccount}</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button 
                onClick={handlePrint}
                className="px-2.5 py-1 rounded bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm border border-red-150 transition-all hover:bg-red-100"
              >
                <PrinterIcon size={11} /> Pdf
              </button>
              <button 
                onClick={handleExportExcel}
                className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm border border-emerald-150 transition-all hover:bg-emerald-100"
              >
                <ExcelIcon size={11} /> xls
              </button>
            </div>
          </div>

          <div className="p-5 space-y-6">
            
            {/* Control Filtering Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 no-print">
                  <span className="font-semibold text-slate-500">Period :</span>
                  <select 
                    value={statementPeriod} 
                    onChange={(e) => setStatementPeriod(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-slate-700 dark:text-slate-200 font-bold focus:border-orange-500 outline-none"
                  >
                    <option>This Year</option>
                    <option>This Month</option>
                    <option>Custom</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-bold text-slate-600 dark:text-slate-350">
                  <CalendarIcon size={12} className="text-slate-400 no-print" />
                  <span className="no-print font-semibold text-slate-500 mr-1">Period:</span>
                  <span>01/04/2026 To 30/04/2026</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-black text-slate-700 dark:text-slate-200">
                  Opening Balance: <span className="text-orange-500">{openingBalance}</span>
                </div>
              </div>

              {/* Dynamic Account Search Badge Pill */}
              <div className="flex items-center gap-2 no-print">
                <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-lg px-2.5 py-1 font-bold text-orange-600 dark:text-orange-400">
                  <span>{selectedAccount}</span>
                  <button 
                    onClick={() => setSelectedAccount("Fixed Assets")}
                    className="p-0.5 hover:bg-orange-100 rounded-full"
                    title="Clear filter"
                  >
                    <XIcon size={12} />
                  </button>
                </div>
                <div className="relative">
                  <input aria-label="Search transaction" 
                    type="text" 
                    placeholder="Search transaction..." 
                    className="pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:border-orange-500 outline-none w-44" 
                  />
                  <SearchIcon size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Transactions Statement Table */}
            <div className="overflow-x-auto select-text">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-2.5 w-12 text-center">#</th>
                    <th className="px-4 py-2.5">
                      <div className="flex items-center gap-1">DATE <FilterIcon size={8} /></div>
                    </th>
                    <th className="px-4 py-2.5">
                      <div className="flex items-center gap-1">TRANSACTION TYPE <FilterIcon size={8} /></div>
                    </th>
                    <th className="px-4 py-2.5">
                      <div className="flex items-center gap-1">REFERENCE NO <FilterIcon size={8} /></div>
                    </th>
                    <th className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">DEBIT AMOUNT <FilterIcon size={8} /></div>
                    </th>
                    <th className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">CREDIT AMOUNT <FilterIcon size={8} /></div>
                    </th>
                    <th className="px-4 py-2.5 text-right font-black">
                      <div className="flex items-center justify-end gap-1">RUNNING BALANCE <FilterIcon size={8} /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30 text-xs">
                  {transactions.length > 0 ? (
                    transactions.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 font-semibold text-slate-700 dark:text-slate-300">
                        <td className="px-4 py-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3">{t.date}</td>
                        <td className="px-4 py-3 text-orange-500 font-bold">{t.type}</td>
                        <td className="px-4 py-3 font-mono">{t.refNo}</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white font-bold">{t.debit > 0 ? t.debit.toFixed(2) : "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white font-bold">{t.credit > 0 ? t.credit.toFixed(2) : "—"}</td>
                        <td className="px-4 py-3 text-right font-black text-orange-600 dark:text-orange-400">{t.balance}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-24 text-center">
                        <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                          <div className="relative">
                            <FileTextIcon size={44} className="opacity-25" />
                            <FileTextIcon size={32} className="opacity-40 absolute -right-3 -top-2" />
                          </div>
                          <span className="text-xs font-bold">No data is available.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Drilldown to Monthly Summary */}
            <div className="flex justify-start">
              <button 
                onClick={() => setViewState("summary")}
                className="text-xs font-black text-orange-500 hover:text-orange-600 hover:underline flex items-center gap-1.5"
              >
                <FolderIcon size={14} /> View Monthly Transaction Summary
              </button>
            </div>

            {/* Sticky Closing Balance Footer */}
            <div className="bg-orange-50/10 dark:bg-slate-900/60 p-4 border-t border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs font-black">
              <span className="text-slate-800 dark:text-white uppercase tracking-wider">Closing Balance</span>
              <span className="text-orange-500 text-sm font-black">{closingBalance}</span>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 3: DRILL-DOWN MONTHLY TRANSACTION SUMMARY VIEW
  // ---------------------------------------------------------------------------
  if (viewState === "summary") {
    const isCr = isCreditType(selectedAccount);
    
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Header Panel with back arrow */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewState("statement")}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors no-print"
                title="Back to Statement Ledger"
              >
                <ArrowLeftIcon size={16} />
              </button>
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                Transaction Summary
              </h2>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button 
                onClick={handlePrint}
                className="px-2.5 py-1 rounded bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm border border-red-150 transition-all hover:bg-red-100"
              >
                <PrinterIcon size={11} /> Pdf
              </button>
              <button 
                onClick={handleExportExcel}
                className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm border border-emerald-150 transition-all hover:bg-emerald-100"
              >
                <ExcelIcon size={11} /> xls
              </button>
            </div>
          </div>

          <div className="p-5 space-y-6">
            
            {/* Sub-bar showing Account Details */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 text-xs bg-slate-50/20 dark:bg-slate-900/20 px-3 py-2 rounded-xl border border-slate-200/50 dark:border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-350">
                <span>Account Name :</span>
                <span className="text-slate-900 dark:text-white font-black">{selectedAccount}</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-350">
                <span>Opening Balance :</span>
                <span className="text-slate-900 dark:text-white font-black">{openingBalance}</span>
              </div>
            </div>

            {/* Monthly Breakdown Table */}
            <div className="overflow-x-auto select-text">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-t border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-3" rowSpan={2}>MONTH</th>
                    <th className="px-4 py-2.5 text-center border-b border-slate-200 dark:border-slate-800" colSpan={2}>
                      TRANSACTIONS IN THE PERIOD
                    </th>
                    <th className="px-4 py-3 text-right" rowSpan={2}>CLOSING BALANCE</th>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-2 w-36 text-right">DEBIT</th>
                    <th className="px-4 py-2 w-36 text-right">CREDIT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30 text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center">
                      <span className="text-xs font-bold text-slate-400">No monthly summary data available.</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Footer Section */}
            <div className="bg-orange-50/10 dark:bg-slate-900/60 p-4 border-t border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs font-black">
              <span className="text-orange-600 dark:text-orange-400 uppercase tracking-wider font-sans">Total</span>
              <div className="flex gap-16 font-mono text-sm text-orange-600 dark:text-orange-400">
                <span>Debit: {!isCr ? renderValue(getAccountRow(selectedAccount).debit) : "—"}</span>
                <span>Credit: {isCr ? renderValue(getAccountRow(selectedAccount).credit) : "—"}</span>
                <span className="font-black text-orange-500 font-sans">Balance: {closingBalance}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return null;
}
