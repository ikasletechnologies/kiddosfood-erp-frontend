"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Wallet,
  Building2,
  Smartphone,
  Search,
  Calendar,
  FileSpreadsheet,
  Printer,
  X,
  ChevronDown,
  CheckCircle2,
  Share2,
  MoreVertical,
  Eye,
  Copy,
  MessageCircle,
  Receipt,
  CreditCard,
  Banknote,
  FileText,
} from "lucide-react";
import { clsx } from "clsx";
import { accountingApi, reportsApi } from "@/lib/api/accounting.api";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CashFlowSummary {
  accounts: any[];
  totalLiquidity: number;
  breakdown: {
    cash: number;
    bank: number;
    upi: number;
  };
}

interface CashFlowEntry {
  id: string;
  createdAt: string;
  date: string;
  time?: string;
  name: string | null;
  partyName: string | null;
  refNo: string;
  paymentNumber?: string;
  category: string;
  type: string;
  transactionType: string;
  paymentType: string;
  paymentMode: string;
  cashIn: number | null;
  cashOut: number | null;
  amount: number;
  paidAmount: number;
  runningBalance: number;
  flow: "IN" | "OUT";
  particulars: string;
  status: string;
  isCancelled?: boolean;
  createdBy?: string;
  approvedBy?: string;
  accountName?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  vendorInvoiceId?: string | null;
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

// ── Date Range Presets ─────────────────────────────────────────────────────────

const getDateRange = (preset: string, customStart: string, customEnd: string) => {
  const now = new Date();
  let from = new Date();
  let to = new Date();

  switch (preset) {
    case "Today":
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      break;
    case "Yesterday":
      from.setDate(now.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(now.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      break;
    case "This Week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      from = new Date(now.setDate(diff));
      from.setHours(0, 0, 0, 0);
      to = new Date();
      to.setHours(23, 59, 59, 999);
      break;
    }
    case "This Month":
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "This Year":
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case "Custom":
      if (customStart) {
        from = new Date(customStart);
        from.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        to = new Date(customEnd);
        to.setHours(23, 59, 59, 999);
      }
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
};

export default function CashFlowPage() {
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [rawEntries, setRawEntries] = useState<CashFlowEntry[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);
  const [totalCashIn, setTotalCashIn] = useState<number>(0);
  const [totalCashOut, setTotalCashOut] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState("This Month");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [flowFilter, setFlowFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Modals & Menu
  const [selectedEntry, setSelectedEntry] = useState<CashFlowEntry | null>(null);
  const [shareEntry, setShareEntry] = useState<CashFlowEntry | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // ── Fetch Cash Flow Data ─────────────────────────────────────────────────────

  const fetchCashFlow = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
      const [cashRes, daybookRes] = await Promise.all([
        accountingApi.getCashFlow().catch(() => ({ data: null })),
        reportsApi.getDayBook({ startDate: from, endDate: to, limit: 1000 }).catch(() => ({ data: { data: [] } })),
      ]);

      if (cashRes.data) {
        setSummary(cashRes.data);
      }

      const daybookData = daybookRes.data;
      const dataRows = Array.isArray(daybookData?.data) ? daybookData.data : Array.isArray(daybookData) ? daybookData : [];
      const baseOpening = Number(daybookData?.openingBalance || 0);

      // Derive category and map fields
      const mapped: CashFlowEntry[] = dataRows.map((item: any) => {
        const transType = item.type || item.transactionType || "Payment";
        let category = "Direct Payments";
        if (transType === "Sale") {
          category = "Sales & Revenue";
        } else if (transType === "Purchase") {
          category = "Purchases & Procurement";
        } else if (transType === "Expense") {
          category = "Operating Expenses";
        } else if (transType === "Transfer") {
          category = "Account Transfers";
        } else if (item.flow === "IN") {
          category = "Customer Receipts";
        } else if (item.flow === "OUT") {
          category = "Vendor Outflows";
        }

        const isFlowIn = item.flow === "IN";
        const cashIn = isFlowIn ? Number(item.moneyIn ?? item.amount ?? item.paidAmount ?? 0) : null;
        const cashOut = !isFlowIn ? Number(item.moneyOut ?? item.amount ?? item.paidAmount ?? 0) : null;

        return {
          id: item.id,
          createdAt: item.createdAt,
          date: item.date || item.createdAt,
          time: item.time,
          name: item.name || item.partyName || null,
          partyName: item.partyName || item.name || null,
          refNo: item.refNo || item.paymentNumber || "—",
          paymentNumber: item.paymentNumber,
          category,
          type: transType,
          transactionType: transType,
          paymentType: item.paymentType || item.paymentMode || "—",
          paymentMode: item.paymentMode || item.paymentType || "—",
          cashIn,
          cashOut,
          amount: Number(item.amount ?? item.paidAmount ?? 0),
          paidAmount: Number(item.paidAmount ?? item.amount ?? 0),
          runningBalance: 0,
          flow: item.flow || (cashIn !== null ? "IN" : "OUT"),
          particulars: item.particulars || "Settled Transaction",
          status: item.status || "PAID",
          isCancelled: item.isCancelled,
          createdBy: item.createdBy,
          approvedBy: item.approvedBy,
          accountName: item.accountName,
          orderId: item.orderId,
          invoiceId: item.invoiceId,
          vendorInvoiceId: item.vendorInvoiceId,
        };
      });

      // Compute Running Balance chronologically (oldest to newest)
      const chronological = [...mapped].sort(
        (a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime()
      );

      let currentBal = baseOpening;
      const withRunningBalance = chronological.map((row) => {
        const inAmt = row.cashIn ? Number(row.cashIn) : 0;
        const outAmt = row.cashOut ? Number(row.cashOut) : 0;
        currentBal = currentBal + inAmt - outAmt;
        return {
          ...row,
          runningBalance: currentBal,
        };
      });

      // Display descending (newest first)
      const displayRows = [...withRunningBalance].sort(
        (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
      );

      setRawEntries(displayRows);
      setOpeningBalance(baseOpening);
      setTotalCashIn(Number(daybookData?.totalMoneyIn ?? daybookData?.totalDebit ?? 0));
      setTotalCashOut(Number(daybookData?.totalMoneyOut ?? daybookData?.totalCredit ?? 0));
      setClosingBalance(Number(daybookData?.closingBalance ?? (baseOpening + totalCashIn - totalCashOut)));
    } catch (err: any) {
      console.error("Failed to load cash flow:", err);
      toast.error(err?.response?.data?.error || "Failed to load cash flow data");
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    fetchCashFlow();
  }, [fetchCashFlow]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // ── Filtered Rows ────────────────────────────────────────────────────────────

  const filteredEntries = useMemo(() => {
    return rawEntries.filter((row) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (row.name || row.partyName || "").toLowerCase().includes(q);
        const matchRef = (row.refNo || row.paymentNumber || "").toLowerCase().includes(q);
        const matchCat = (row.category || "").toLowerCase().includes(q);
        const matchType = (row.type || row.transactionType || "").toLowerCase().includes(q);
        const matchMode = (row.paymentType || row.paymentMode || "").toLowerCase().includes(q);
        const matchParticulars = (row.particulars || "").toLowerCase().includes(q);

        if (!matchName && !matchRef && !matchCat && !matchType && !matchMode && !matchParticulars) {
          return false;
        }
      }

      // 2. Flow Filter
      if (flowFilter !== "ALL" && row.flow !== flowFilter) return false;

      // 3. Category Filter
      if (categoryFilter !== "ALL" && row.category !== categoryFilter) return false;

      // 4. Type Filter
      if (typeFilter !== "ALL" && row.type.toUpperCase() !== typeFilter.toUpperCase()) return false;

      return true;
    });
  }, [rawEntries, searchQuery, flowFilter, categoryFilter, typeFilter]);

  // Summary totals based on active filters
  const computedSummary = useMemo(() => {
    const isFiltered = Boolean(searchQuery.trim() || flowFilter !== "ALL" || categoryFilter !== "ALL" || typeFilter !== "ALL");
    if (!isFiltered) {
      return {
        opening: openingBalance,
        cashIn: totalCashIn,
        cashOut: totalCashOut,
        netCashFlow: totalCashIn - totalCashOut,
        closing: closingBalance,
      };
    }
    const cashIn = filteredEntries.reduce((s, r) => s + (r.cashIn ? Number(r.cashIn) : 0), 0);
    const cashOut = filteredEntries.reduce((s, r) => s + (r.cashOut ? Number(r.cashOut) : 0), 0);
    return {
      opening: openingBalance,
      cashIn,
      cashOut,
      netCashFlow: cashIn - cashOut,
      closing: openingBalance + cashIn - cashOut,
    };
  }, [filteredEntries, searchQuery, flowFilter, categoryFilter, typeFilter, openingBalance, totalCashIn, totalCashOut, closingBalance]);

  // ── Print & Export Handlers ──────────────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  const handlePrintSingleRow = (entry: CashFlowEntry) => {
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error("Please allow popups to print voucher");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cash Flow Voucher - ${entry.refNo}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #1e293b; }
            .header { border-bottom: 2px solid #f97316; padding-bottom: 16px; margin-bottom: 24px; }
            .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
            .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
            .meta-item { background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .meta-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .meta-val { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px; font-family: monospace; }
            .amount-box { background: #fff7ed; border: 1px solid #ffedd5; padding: 20px; border-radius: 12px; text-align: right; margin-top: 24px; }
            .amount-label { font-size: 12px; font-weight: 700; color: #9a3412; text-transform: uppercase; }
            .amount-val { font-size: 24px; font-weight: 900; color: #ea580c; font-family: monospace; }
            .footer { margin-top: 48px; border-top: 1px dashed #cbd5e1; padding-top: 16px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">CASH FLOW VOUCHER</h1>
            <div class="subtitle">Cash Flow Transaction Receipt • Ref: ${entry.refNo}</div>
          </div>
          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">Date</div>
              <div class="meta-val">${formatDate(entry.date || entry.createdAt)} ${entry.time || ""}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Reference No</div>
              <div class="meta-val">${entry.refNo}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Party Name</div>
              <div class="meta-val" style="font-family: inherit;">${entry.name || entry.partyName || "—"}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Category</div>
              <div class="meta-val" style="font-family: inherit;">${entry.category}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Transaction Type</div>
              <div class="meta-val">${entry.type}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Running Balance</div>
              <div class="meta-val">${fmtCurrency(entry.runningBalance)}</div>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px;">
            <strong>Particulars:</strong> ${entry.particulars || "Settled Cash Flow Transaction"}
          </div>
          <div class="amount-box">
            <div class="amount-label">${entry.flow === "IN" ? "Cash Inflow" : "Cash Outflow"}</div>
            <div class="amount-val">${fmtCurrency(entry.amount)}</div>
          </div>
          <div class="footer">
            <span>Generated from ERP Cash Flow System</span>
            <span>Recorded By: ${entry.createdBy || "System"}</span>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleExportCSV = () => {
    if (!filteredEntries.length) {
      toast.error("No transactions to export for the selected period");
      return;
    }
    const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
    const headers = [
      "Date",
      "Ref No.",
      "Name",
      "Category",
      "Type",
      "Cash In",
      "Cash Out",
      "Running Balance",
      "Particulars",
    ];
    const rows = filteredEntries.map((e) => [
      `"${formatDate(e.date || e.createdAt)}"`,
      `"${(e.refNo || "").replace(/"/g, '""')}"`,
      `"${(e.name || e.partyName || "—").replace(/"/g, '""')}"`,
      `"${(e.category || "").replace(/"/g, '""')}"`,
      `"${(e.type || "").replace(/"/g, '""')}"`,
      `"${e.cashIn ? Number(e.cashIn).toFixed(2) : ""}"`,
      `"${e.cashOut ? Number(e.cashOut).toFixed(2) : ""}"`,
      `"${Number(e.runningBalance).toFixed(2)}"`,
      `"${(e.particulars || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Cash_Flow_${from}_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredEntries.length} Cash Flow records to CSV`);
  };

  const handleCopyShareLink = (entry: CashFlowEntry) => {
    const text = `Cash Flow Voucher: ${entry.refNo}\nParty: ${entry.name || "—"}\nCategory: ${entry.category}\nType: ${entry.type}\nAmount: ${fmtCurrency(entry.amount)} (${entry.flow === "IN" ? "Cash In" : "Cash Out"})\nRunning Balance: ${fmtCurrency(entry.runningBalance)}\nDate: ${formatDate(entry.date || entry.createdAt)}`;
    navigator.clipboard.writeText(text);
    toast.success("Cash flow transaction copied to clipboard!");
    setShareEntry(null);
  };

  const handleShareWhatsApp = (entry: CashFlowEntry) => {
    const text = `*Cash Flow Transaction Receipt*\nRef: ${entry.refNo}\nParty: ${entry.name || "—"}\nCategory: ${entry.category}\nType: ${entry.type}\nAmount: ${fmtCurrency(entry.amount)} (${entry.flow === "IN" ? "Cash In" : "Cash Out"})\nRunning Balance: ${fmtCurrency(entry.runningBalance)}\nDate: ${formatDate(entry.date || entry.createdAt)}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    setShareEntry(null);
  };

  // Helper for Type badge styling
  const getTypeBadgeClass = (type: string) => {
    const t = (type || "").toUpperCase();
    if (t.includes("PURCHASE")) {
      return "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20";
    }
    if (t.includes("SALE")) {
      return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20";
    }
    if (t.includes("EXPENSE")) {
      return "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20";
    }
    if (t.includes("TRANSFER")) {
      return "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20";
    }
    return "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20";
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#020617] text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">
      
      {/* ── Top Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Wallet className="h-5 w-5" />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
            Cash Flow
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            title="Export CSV"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            title="Print Statement"
          >
            <Printer className="h-4 w-4 text-gray-500 dark:text-slate-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">

        {/* ── Summary / KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
          {/* 1. Opening Balance */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-4 ring-slate-100 dark:ring-slate-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Opening Balance
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-gray-900 dark:text-white mt-1 truncate">
                {loading ? "..." : fmtCurrency(computedSummary.opening)}
              </div>
            </div>
          </div>

          {/* 2. Total Cash In */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Cash In
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(computedSummary.cashIn)}
              </div>
            </div>
          </div>

          {/* 3. Total Cash Out */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-50 dark:ring-rose-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Cash Out
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(computedSummary.cashOut)}
              </div>
            </div>
          </div>

          {/* 4. Closing Balance */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f58220] ring-4 ring-orange-50 dark:ring-orange-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Closing Balance
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[#f58220] dark:text-[#f58220] mt-1 truncate">
                {loading ? "..." : fmtCurrency(computedSummary.closing)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Liquidity Breakdown (Live Account Balances) ── */}
        {summary && (
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
                Live Account Liquidity
              </span>
              <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                Total Available: {fmtCurrency(summary.totalLiquidity)}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Cash in Hand</span>
                </div>
                <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{fmtCurrency(summary.breakdown.cash)}</span>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Bank Accounts</span>
                </div>
                <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{fmtCurrency(summary.breakdown.bank)}</span>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">UPI Wallets</span>
                </div>
                <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">{fmtCurrency(summary.breakdown.upi)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Filters & Search Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0 bg-white dark:bg-card p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search Name, Ref No, Category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-[#f58220] transition-colors"
            />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
          </div>

          {/* Date Filter Dropdown */}
          <div className="relative shrink-0">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220] transition-colors"
            >
              <option value="This Month">This Month</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Week">This Week</option>
              <option value="This Year">This Year</option>
              <option value="Custom">Custom Date Range</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          </div>

          {/* Custom Date Inputs */}
          {dateFilter === "Custom" && (
            <div className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-[#13151f] text-xs shrink-0">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
              />
              <span className="text-gray-400 dark:text-slate-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
              />
            </div>
          )}

          {/* Flow Filter */}
          <div className="relative shrink-0">
            <select
              value={flowFilter}
              onChange={(e) => setFlowFilter(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220] transition-colors"
            >
              <option value="ALL">All Flows</option>
              <option value="IN">Cash In (Inflows)</option>
              <option value="OUT">Cash Out (Outflows)</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          </div>

          {/* Category Filter */}
          <div className="relative shrink-0">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220] transition-colors"
            >
              <option value="ALL">All Categories</option>
              <option value="Sales & Revenue">Sales & Revenue</option>
              <option value="Purchases & Procurement">Purchases & Procurement</option>
              <option value="Operating Expenses">Operating Expenses</option>
              <option value="Account Transfers">Account Transfers</option>
              <option value="Customer Receipts">Customer Receipts</option>
              <option value="Vendor Outflows">Vendor Outflows</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          </div>

          <div className="flex-1" />

          {/* Refresh Button */}
          <button
            onClick={fetchCashFlow}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors shrink-0"
            title="Refresh Cash Flow"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-orange-500")} />
          </button>
        </div>

        {/* ── Cash Flow Main Table Container ── */}
        <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
          
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider truncate">
              Cash Flow Ledger & Movements
            </span>
            <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 shrink-0 ml-2">
              {filteredEntries.length} entries recorded
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
            {loading ? (
              <div className="py-20 flex flex-col justify-center items-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-[#f58220]" />
                <span className="text-xs font-medium text-gray-400 dark:text-slate-500">Auditing cash flow ledger...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-[11px] font-bold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Ref No.
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Name
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Category
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Type
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Cash In
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Cash Out
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Running Balance
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-center whitespace-nowrap">
                      Print / Share
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs font-medium">
                  {filteredEntries.length > 0 ? (
                    filteredEntries.map((row) => {
                      const partyDisplayName = row.name || row.partyName || "—";
                      const isCashIn = row.flow === "IN" && row.cashIn !== null;
                      const isCashOut = row.flow === "OUT" && row.cashOut !== null;

                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-orange-50/20 dark:hover:bg-orange-500/5 transition-colors group"
                        >
                          {/* 1. DATE */}
                          <td className="px-4 sm:px-5 py-3.5 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {formatDate(row.date || row.createdAt)}
                            </div>
                            {row.time && (
                              <div className="text-[10px] text-gray-400 dark:text-slate-500">{row.time}</div>
                            )}
                          </td>

                          {/* 2. REF NO. */}
                          <td className="px-4 sm:px-5 py-3.5 font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap">
                            <span className="bg-gray-100 dark:bg-white/5 px-2 py-1 rounded text-[11px] font-semibold">
                              {row.refNo || row.paymentNumber || "—"}
                            </span>
                          </td>

                          {/* 3. NAME */}
                          <td className="px-4 sm:px-5 py-3.5 text-gray-900 dark:text-white font-semibold whitespace-nowrap">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[11px] font-bold text-gray-600 dark:text-slate-300 uppercase shrink-0">
                                {partyDisplayName !== "—" ? partyDisplayName.charAt(0) : "P"}
                              </div>
                              <span className="truncate max-w-[170px]" title={partyDisplayName}>
                                {partyDisplayName}
                              </span>
                            </div>
                          </td>

                          {/* 4. CATEGORY */}
                          <td className="px-4 sm:px-5 py-3.5 text-gray-600 dark:text-slate-300 whitespace-nowrap">
                            <span className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded text-[11px] font-medium">
                              {row.category}
                            </span>
                          </td>

                          {/* 5. TYPE */}
                          <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                            <span
                              className={clsx(
                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                getTypeBadgeClass(row.type || row.transactionType)
                              )}
                            >
                              {row.type || row.transactionType}
                            </span>
                          </td>

                          {/* 6. CASH IN */}
                          <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-semibold whitespace-nowrap">
                            {isCashIn ? (
                              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                                {fmtCurrency(row.cashIn)}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* 7. CASH OUT */}
                          <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-semibold whitespace-nowrap">
                            {isCashOut ? (
                              <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded">
                                {fmtCurrency(row.cashOut)}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* 8. RUNNING BALANCE */}
                          <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-bold whitespace-nowrap">
                            <span
                              className={clsx(
                                row.runningBalance >= 0
                                  ? "text-gray-900 dark:text-white"
                                  : "text-rose-600 dark:text-rose-400"
                              )}
                            >
                              {fmtCurrency(row.runningBalance)}
                            </span>
                          </td>

                          {/* 9. PRINT / SHARE */}
                          <td className="px-4 sm:px-5 py-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handlePrintSingleRow(row)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                title="Print Voucher"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setShareEntry(row)}
                                className="p-1.5 text-gray-400 hover:text-[#f58220] dark:hover:text-[#f58220] hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors"
                                title="Share Transaction"
                              >
                                <Share2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>

                          {/* 10. ACTIONS */}
                          <td className="px-4 sm:px-5 py-3.5 text-right relative whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === row.id ? null : row.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors inline-flex items-center"
                              title="More Options"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {activeMenuId === row.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-4 top-10 w-44 bg-white dark:bg-[#181a26] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-20 py-1.5 text-left animate-in fade-in zoom-in-95 duration-100"
                              >
                                <button
                                  onClick={() => {
                                    setSelectedEntry(row);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5 text-blue-500" />
                                  <span>View Details</span>
                                </button>

                                <button
                                  onClick={() => {
                                    handlePrintSingleRow(row);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
                                >
                                  <Printer className="h-3.5 w-3.5 text-gray-500" />
                                  <span>Print Voucher</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setShareEntry(row);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
                                >
                                  <Share2 className="h-3.5 w-3.5 text-emerald-500" />
                                  <span>Share</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-16 text-center text-xs text-gray-400 dark:text-slate-500"
                      >
                        {searchQuery
                          ? `No cash flow movements match "${searchQuery}".`
                          : "No cash flow movements found for the selected period."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Transaction Details Modal ── */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181a26] rounded-2xl border border-gray-200 dark:border-white/10 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-lg">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Cash Flow Details</h3>
                  <div className="text-xs text-gray-400 dark:text-slate-500 font-mono">{selectedEntry.refNo}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Party Name</span>
                <span className="font-bold text-gray-900 dark:text-white mt-0.5 block">{selectedEntry.name || selectedEntry.partyName || "—"}</span>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Category</span>
                <span className="font-bold text-gray-900 dark:text-white mt-0.5 block">{selectedEntry.category}</span>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Date & Time</span>
                <span className="font-bold text-gray-900 dark:text-white mt-0.5 block">{formatDate(selectedEntry.date || selectedEntry.createdAt)} {selectedEntry.time || ""}</span>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Transaction Type</span>
                <span className="font-bold text-gray-900 dark:text-white mt-0.5 block">{selectedEntry.type}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Movement Flow</span>
                <span className={clsx("font-bold mt-0.5 block", selectedEntry.flow === "IN" ? "text-emerald-600" : "text-rose-600")}>
                  {selectedEntry.flow === "IN" ? `Cash In (${fmtCurrency(selectedEntry.cashIn)})` : `Cash Out (${fmtCurrency(selectedEntry.cashOut)})`}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Running Balance</span>
                <span className="font-bold font-mono text-gray-900 dark:text-white mt-0.5 block">{fmtCurrency(selectedEntry.runningBalance)}</span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5 text-xs">
              <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Particulars</span>
              <span className="text-gray-700 dark:text-slate-300 mt-1 block">{selectedEntry.particulars || "Settled Cash Flow Transaction"}</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-white/10">
              <button
                onClick={() => handlePrintSingleRow(selectedEntry)}
                className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 transition flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={() => {
                  setShareEntry(selectedEntry);
                  setSelectedEntry(null);
                }}
                className="px-4 py-2 bg-[#f58220] hover:bg-[#e0751a] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {shareEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181a26] rounded-2xl border border-gray-200 dark:border-white/10 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-[#f58220]" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Share Cash Flow Entry</h3>
              </div>
              <button
                onClick={() => setShareEntry(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 text-xs space-y-1">
              <div className="font-bold text-gray-900 dark:text-white">{shareEntry.refNo}</div>
              <div className="text-gray-500 dark:text-slate-400">Party: {shareEntry.name || "—"} • {shareEntry.category}</div>
              <div className="text-sm font-mono font-bold text-[#f58220]">{fmtCurrency(shareEntry.amount)} ({shareEntry.flow === "IN" ? "Cash In" : "Cash Out"})</div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleShareWhatsApp(shareEntry)}
                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Share via WhatsApp</span>
              </button>

              <button
                onClick={() => handleCopyShareLink(shareEntry)}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
              >
                <Copy className="h-4 w-4" />
                <span>Copy Summary Text</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
