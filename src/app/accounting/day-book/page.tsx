"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Printer,
  Share2,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  FileSpreadsheet,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  FileText,
  Copy,
  MessageCircle,
  Mail,
  ExternalLink,
  ChevronDown,
  Eye,
  Receipt,
  Plus,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";
import { formatDate } from "@/lib/utils";
import { exportReportToExcel } from "@/lib/excelExport";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DayBookEntry {
  id: string;
  createdAt: string;
  date: string;
  time?: string;
  name: string | null;
  partyName: string | null;
  refNo: string;
  paymentNumber?: string;
  type: string;
  transactionType: string;
  paymentType: string;
  paymentMode: string;
  total: number;
  moneyIn: number | null;
  moneyOut: number | null;
  amount: number;
  paidAmount: number;
  accountingType: "DEBIT" | "CREDIT";
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

interface DayBookReportResponse {
  data: DayBookEntry[];
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  totalMoneyIn?: number;
  totalMoneyOut?: number;
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

// ── Currency Formatter ─────────────────────────────────────────────────────────

const fmtCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return "—";
  return `₹${Number(val).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
};

export default function DayBookPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);
  const [totalMoneyIn, setTotalMoneyIn] = useState<number>(0);
  const [totalMoneyOut, setTotalMoneyOut] = useState<number>(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("Today");
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [paymentModeFilter, setPaymentModeFilter] = useState("ALL");

  // Modals & Active Actions
  const [selectedEntry, setSelectedEntry] = useState<DayBookEntry | null>(null);
  const [shareEntry, setShareEntry] = useState<DayBookEntry | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // ── Fetch Day Book Data ──────────────────────────────────────────────────────

  const fetchDayBook = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
      const params: any = {
        startDate: from,
        endDate: to,
        limit: 200,
      };
      if (paymentModeFilter !== "ALL") {
        params.paymentMode = paymentModeFilter;
      }
      if (typeFilter !== "ALL") {
        params.voucherType = typeFilter;
      }

      const res = await reportsApi.getDayBook(params);
      const data: DayBookReportResponse = res.data;

      const rawEntries = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? (data as any) : [];
      setEntries(rawEntries);
      setOpeningBalance(Number(data?.openingBalance || 0));
      setClosingBalance(Number(data?.closingBalance || 0));
      setTotalMoneyIn(Number(data?.totalMoneyIn ?? data?.totalDebit ?? 0));
      setTotalMoneyOut(Number(data?.totalMoneyOut ?? data?.totalCredit ?? 0));
    } catch (err: any) {
      console.error("Failed to load Day Book:", err);
      toast.error(err?.response?.data?.error || "Failed to load Day Book entries");
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customStartDate, customEndDate, paymentModeFilter, typeFilter]);

  useEffect(() => {
    fetchDayBook();
  }, [fetchDayBook]);

  // Close actions dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // ── Filtered Rows ────────────────────────────────────────────────────────────

  const filteredEntries = useMemo(() => {
    return entries.filter((row) => {
      // 1. Search filter across Name, Ref No, Type, Payment Mode, Particulars
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = (row.name || row.partyName || "").toLowerCase().includes(query);
        const matchRef = (row.refNo || row.paymentNumber || "").toLowerCase().includes(query);
        const matchType = (row.type || row.transactionType || "").toLowerCase().includes(query);
        const matchPaymentType = (row.paymentType || row.paymentMode || "").toLowerCase().includes(query);
        const matchParticulars = (row.particulars || "").toLowerCase().includes(query);

        if (!matchName && !matchRef && !matchType && !matchPaymentType && !matchParticulars) {
          return false;
        }
      }

      // 2. Type filter
      if (typeFilter !== "ALL") {
        const rowType = (row.type || row.transactionType || "").toUpperCase();
        if (rowType !== typeFilter.toUpperCase()) return false;
      }

      // 3. Payment Mode filter
      if (paymentModeFilter !== "ALL") {
        const rowMode = (row.paymentType || row.paymentMode || "").toUpperCase();
        if (rowMode !== paymentModeFilter.toUpperCase()) return false;
      }

      return true;
    });
  }, [entries, searchTerm, typeFilter, paymentModeFilter]);

  // Computed summary totals based on filtered items
  const computedSummary = useMemo(() => {
    const isSearching = Boolean(searchTerm.trim() || typeFilter !== "ALL" || paymentModeFilter !== "ALL");
    if (!isSearching) {
      return {
        opening: openingBalance,
        moneyIn: totalMoneyIn,
        moneyOut: totalMoneyOut,
        closing: closingBalance,
      };
    }
    const moneyIn = filteredEntries.reduce((s, r) => s + (r.moneyIn ? Number(r.moneyIn) : 0), 0);
    const moneyOut = filteredEntries.reduce((s, r) => s + (r.moneyOut ? Number(r.moneyOut) : 0), 0);
    return {
      opening: openingBalance,
      moneyIn,
      moneyOut,
      closing: openingBalance + moneyIn - moneyOut,
    };
  }, [filteredEntries, searchTerm, typeFilter, paymentModeFilter, openingBalance, totalMoneyIn, totalMoneyOut, closingBalance]);

  // ── Print & Share Handlers ───────────────────────────────────────────────────

  const handlePrintFullReport = () => {
    window.print();
  };

  const handlePrintSingleRow = (entry: DayBookEntry) => {
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error("Please allow popups to print voucher");
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Day Book Voucher - ${entry.refNo}</title>
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
            <h1 class="title">ACCOUNTING VOUCHER</h1>
            <div class="subtitle">Day Book Transaction Receipt • Reference: ${entry.refNo}</div>
          </div>
          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">Date & Time</div>
              <div class="meta-val">${formatDate(entry.date || entry.createdAt)} ${entry.time || ""}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Voucher / Ref No</div>
              <div class="meta-val">${entry.refNo}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Party Name</div>
              <div class="meta-val" style="font-family: inherit;">${entry.name || entry.partyName || "—"}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Transaction Type</div>
              <div class="meta-val">${entry.type || entry.transactionType}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Payment Mode</div>
              <div class="meta-val">${entry.paymentType || entry.paymentMode}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Flow Direction</div>
              <div class="meta-val" style="color: ${entry.flow === "IN" ? "#16a34a" : "#dc2626"};">${entry.flow === "IN" ? "MONEY IN (Receipt)" : "MONEY OUT (Payment)"}</div>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px;">
            <strong>Particulars:</strong> ${entry.particulars || "Transaction Recorded"}
          </div>
          <div class="amount-box">
            <div class="amount-label">Transaction Amount</div>
            <div class="amount-val">${fmtCurrency(entry.total || entry.amount)}</div>
          </div>
          <div class="footer">
            <span>Generated from ERP System</span>
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

  const handleExportExcel = () => {
    if (filteredEntries.length === 0) {
      toast.error("No entries to export");
      return;
    }

    const columns = [
      { header: "Date", key: "formattedDate" },
      { header: "Ref No", key: "refNo" },
      { header: "Name / Party", key: "party" },
      { header: "Type", key: "type" },
      { header: "Payment Type", key: "paymentType" },
      { header: "Total (₹)", key: "total", format: "currency" as const },
      { header: "Money In (₹)", key: "moneyIn", format: "currency" as const },
      { header: "Money Out (₹)", key: "moneyOut", format: "currency" as const },
      { header: "Particulars", key: "particulars" },
    ];

    const data = filteredEntries.map((e) => ({
      formattedDate: formatDate(e.date || e.createdAt),
      refNo: e.refNo,
      party: e.name || e.partyName || "—",
      type: e.type || e.transactionType,
      paymentType: e.paymentType || e.paymentMode,
      total: Number(e.total || e.amount || 0),
      moneyIn: e.moneyIn !== null && e.moneyIn !== undefined ? Number(e.moneyIn) : "",
      moneyOut: e.moneyOut !== null && e.moneyOut !== undefined ? Number(e.moneyOut) : "",
      particulars: e.particulars || "",
    }));

    const totalMoneyIn = filteredEntries.reduce((s, e) => s + (Number(e.moneyIn) || 0), 0);
    const totalMoneyOut = filteredEntries.reduce((s, e) => s + (Number(e.moneyOut) || 0), 0);
    const totalTransAmt = filteredEntries.reduce((s, e) => s + (Number(e.total || e.amount) || 0), 0);
    const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);

    exportReportToExcel({
      filename: `Day-Book_${dateFilter.replace(/\s+/g, "-")}.xlsx`,
      sheetName: "Day Book",
      title: "Day Book Transaction Report",
      subtitle: `${from} to ${to}`,
      columns,
      data,
      totals: {
        total: totalTransAmt,
        moneyIn: totalMoneyIn,
        moneyOut: totalMoneyOut,
      },
    });

    toast.success(`Exported ${filteredEntries.length} entries to Excel`);
  };

  const handleCopyShareLink = (entry: DayBookEntry) => {
    const text = `Transaction Voucher: ${entry.refNo}\nParty: ${entry.name || "—"}\nType: ${entry.type}\nPayment: ${entry.paymentType}\nTotal: ${fmtCurrency(entry.total)}\nDate: ${formatDate(entry.date || entry.createdAt)}`;
    navigator.clipboard.writeText(text);
    toast.success("Transaction summary copied to clipboard!");
    setShareEntry(null);
  };

  const handleShareWhatsApp = (entry: DayBookEntry) => {
    const text = `*Day Book Transaction Receipt*\nRef: ${entry.refNo}\nParty: ${entry.name || "—"}\nType: ${entry.type} (${entry.paymentType})\nTotal: ${fmtCurrency(entry.total)}\nDate: ${formatDate(entry.date || entry.createdAt)}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    setShareEntry(null);
  };

  // Helper for Payment Mode icon
  const getPaymentModeIcon = (mode: string) => {
    const m = (mode || "").toUpperCase();
    if (m.includes("CASH")) return <Banknote className="h-3.5 w-3.5 text-emerald-600" />;
    if (m.includes("UPI")) return <Smartphone className="h-3.5 w-3.5 text-blue-600" />;
    if (m.includes("CARD")) return <CreditCard className="h-3.5 w-3.5 text-purple-600" />;
    if (m.includes("BANK") || m.includes("NEFT")) return <Building2 className="h-3.5 w-3.5 text-indigo-600" />;
    return <FileText className="h-3.5 w-3.5 text-gray-500" />;
  };

  // Helper for Transaction Type badge styling
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
      
      {/* ── Top Header / Breadcrumb Bar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
            Day Book
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            title="Excel Report"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Excel Report</span>
          </button>

          <button
            onClick={handlePrintFullReport}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
            title="Print Day Book"
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

          {/* 2. Total Money In */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 dark:ring-emerald-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Money In
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(computedSummary.moneyIn)}
              </div>
            </div>
          </div>

          {/* 3. Total Money Out */}
          <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs flex items-center gap-3.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-50 dark:ring-rose-500/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Money Out
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-1 truncate">
                {loading ? "..." : fmtCurrency(computedSummary.moneyOut)}
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

        {/* ── Filters & Search Toolbar ── */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full min-w-0 bg-white dark:bg-card p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-white/5 shadow-2xs">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search Name, Ref No, Type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-[#f58220] transition-colors"
            />
            {searchTerm && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearchTerm("")} 
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
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
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

          {/* Type Filter */}
          <div className="relative shrink-0">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220] transition-colors"
            >
              <option value="ALL">All Types</option>
              <option value="SALE">Sale</option>
              <option value="PURCHASE">Purchase</option>
              <option value="RECEIPT">Receipt</option>
              <option value="PAYMENT">Payment</option>
              <option value="EXPENSE">Expense</option>
              <option value="TRANSFER">Transfer</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          </div>

          {/* Payment Mode Filter */}
          <div className="relative shrink-0">
            <select
              value={paymentModeFilter}
              onChange={(e) => setPaymentModeFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220] transition-colors"
            >
              <option value="ALL">All Payment Modes</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          </div>

          <div className="flex-1" />

          {/* Refresh Button */}
          <button
            onClick={fetchDayBook}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors shrink-0"
            title="Refresh Day Book"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-orange-500")} />
          </button>
        </div>

        {/* ── Day Book Main Table Container ── */}
        <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-2xs w-full min-w-0">
          
          <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider truncate">
              Daily Transactions & Voucher Entries
            </span>
            <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 shrink-0 ml-2">
              {filteredEntries.length} entries recorded
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar w-full max-w-full">
            {loading ? (
              <div className="py-20 flex flex-col justify-center items-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin text-[#f58220]" />
                <span className="text-xs font-medium text-gray-400 dark:text-slate-500">Loading daily transactions...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-white/[0.02] text-gray-500 dark:text-slate-400 text-[11px] font-bold border-b border-gray-200 dark:border-white/5 uppercase tracking-wider">
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Name
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Ref No
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Type
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold whitespace-nowrap">
                      Payment Type
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Total
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Money In
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 font-bold text-right whitespace-nowrap">
                      Money Out
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
                      const isMoneyIn = row.flow === "IN" && row.moneyIn !== null;
                      const isMoneyOut = row.flow === "OUT" && row.moneyOut !== null;

                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-orange-50/20 dark:hover:bg-orange-500/5 transition-colors group"
                        >
                          {/* 1. NAME */}
                          <td className="px-4 sm:px-5 py-3.5 text-gray-900 dark:text-white font-semibold whitespace-nowrap">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[11px] font-bold text-gray-600 dark:text-slate-300 uppercase shrink-0">
                                {partyDisplayName !== "—" ? partyDisplayName.charAt(0) : "P"}
                              </div>
                              <span className="truncate max-w-[180px]" title={partyDisplayName}>
                                {partyDisplayName}
                              </span>
                            </div>
                          </td>

                          {/* 2. REF NO */}
                          <td className="px-4 sm:px-5 py-3.5 font-mono text-gray-600 dark:text-slate-300 whitespace-nowrap">
                            <span className="bg-gray-100 dark:bg-white/5 px-2 py-1 rounded text-[11px] font-semibold">
                              {row.refNo || row.paymentNumber || "—"}
                            </span>
                          </td>

                          {/* 3. TYPE */}
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

                          {/* 4. PAYMENT TYPE */}
                          <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-gray-700 dark:text-slate-300 font-medium">
                              {getPaymentModeIcon(row.paymentType || row.paymentMode)}
                              <span className="capitalize">{String(row.paymentType || row.paymentMode || "—").toLowerCase().replace(/_/g, " ")}</span>
                            </div>
                          </td>

                          {/* 5. TOTAL */}
                          <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white whitespace-nowrap">
                            {fmtCurrency(row.total || row.amount)}
                          </td>

                          {/* 6. MONEY IN */}
                          <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-semibold whitespace-nowrap">
                            {isMoneyIn ? (
                              <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                                {fmtCurrency(row.moneyIn)}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* 7. MONEY OUT */}
                          <td className="px-4 sm:px-5 py-3.5 text-right font-mono font-semibold whitespace-nowrap">
                            {isMoneyOut ? (
                              <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded">
                                {fmtCurrency(row.moneyOut)}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* 8. PRINT / SHARE */}
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

                          {/* 9. ACTIONS */}
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
                                  <span>Print Receipt</span>
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
                        colSpan={9}
                        className="px-5 py-16 text-center text-xs text-gray-400 dark:text-slate-500"
                      >
                        {searchTerm
                          ? `No transactions match "${searchTerm}".`
                          : "No Day Book entries found for the selected date range."}
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
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Transaction Details</h3>
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
                <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Date & Time</span>
                <span className="font-bold text-gray-900 dark:text-white mt-0.5 block">{formatDate(selectedEntry.date || selectedEntry.createdAt)} {selectedEntry.time || ""}</span>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Transaction Type</span>
                <span className="font-bold text-gray-900 dark:text-white mt-0.5 block">{selectedEntry.type || selectedEntry.transactionType}</span>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5">
                <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Payment Method</span>
                <span className="font-bold text-gray-900 dark:text-white mt-0.5 block">{selectedEntry.paymentType || selectedEntry.paymentMode}</span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg border border-gray-100 dark:border-white/5 text-xs">
              <span className="text-gray-400 dark:text-slate-500 font-semibold block text-[10px] uppercase">Particulars / Description</span>
              <span className="text-gray-700 dark:text-slate-300 mt-1 block">{selectedEntry.particulars || "Standard accounting entry"}</span>
            </div>

            <div className="bg-orange-50/50 dark:bg-orange-500/10 p-4 rounded-xl border border-orange-200/60 dark:border-orange-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-orange-900 dark:text-orange-300 uppercase tracking-wider block">Total Amount</span>
                <span className="text-xs text-orange-700/80 dark:text-orange-400/80">{selectedEntry.flow === "IN" ? "Payment Received" : "Payment Disbursed"}</span>
              </div>
              <div className="text-2xl font-black font-mono text-[#f58220]">
                {fmtCurrency(selectedEntry.total || selectedEntry.amount)}
              </div>
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
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Share Transaction</h3>
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
              <div className="text-gray-500 dark:text-slate-400">Party: {shareEntry.name || "—"} • {shareEntry.type}</div>
              <div className="text-sm font-mono font-bold text-[#f58220]">{fmtCurrency(shareEntry.total || shareEntry.amount)}</div>
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
