"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Wallet, Search, RefreshCw, Filter, ArrowUpRight, ArrowDownRight,
  Clock, AlertCircle, CheckCircle2, User, FileText, ChevronDown,
  Calendar, FileSpreadsheet, Printer, X, Eye, DollarSign,
  Building2, Smartphone, CreditCard, ChevronRight, Layers,
  Phone, Mail, MapPin, Receipt, ArrowRight
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { customersApi, salesApi } from "@/lib/api/sales.api";
import { accountingApi } from "@/lib/api/accounting.api";
import api from "@/lib/api/base";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReceivableItem {
  id: string;
  invoiceNumber: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: "PAID" | "PARTIAL" | "UNPAID" | "OVERDUE";
  daysOverdue: number;
  agingBucket: "0-30" | "31-60" | "61-90" | "90+";
  items?: any[];
  payments?: any[];
}

interface CustomerSummary {
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueAmount: number;
  invoiceCount: number;
  overdueCount: number;
}

// ── Helper: Format Currency ───────────────────────────────────────────────────

const fmtINR = (amount: number) => {
  return `₹${(Number(amount) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// ── Date Preset Helpers ────────────────────────────────────────────────────────

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
    case "Last 7 Days":
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      break;
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
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
};

export default function ReceivablesPage() {
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);

  // View mode
  const [viewMode, setViewMode] = useState<"INVOICES" | "CUSTOMERS">("INVOICES");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OVERDUE" | "DUE_SOON" | "PARTIAL" | "UNPAID" | "PAID">("ALL");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("ALL");
  const [agingFilter, setAgingFilter] = useState<"ALL" | "0-30" | "31-60" | "61-90" | "90+">("ALL");
  const [datePreset, setDatePreset] = useState<string>("All Time");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Modal / Drawer States
  const [selectedInvoice, setSelectedInvoice] = useState<ReceivableItem | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<ReceivableItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  // ── Fetch Receivables Data ───────────────────────────────────────────────────

  const fetchReceivables = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Invoices & Customers in parallel
      const [invoicesRes, ordersRes, customersRes] = await Promise.all([
        api.get("/api/finance/invoices").catch(() => ({ data: [] })),
        salesApi.getSalesOrders().catch(() => ({ data: { orders: [] } })),
        customersApi.getAll().catch(() => ({ data: [] }))
      ]);

      const rawInvoices = Array.isArray(invoicesRes.data)
        ? invoicesRes.data
        : invoicesRes.data?.invoices || invoicesRes.data?.data || [];

      const rawOrders = Array.isArray(ordersRes.data)
        ? ordersRes.data
        : ordersRes.data?.orders || ordersRes.data?.data || [];

      const rawCustomers = Array.isArray(customersRes.data)
        ? customersRes.data
        : customersRes.data?.customers || customersRes.data?.data || [];

      setCustomersList(rawCustomers);

      // Customer map by ID and Name for fast lookup
      const custMap = new Map<string, any>();
      rawCustomers.forEach((c: any) => {
        if (c.id) custMap.set(c.id, c);
        if (c._id) custMap.set(c._id, c);
        if (c.name) custMap.set(c.name.toLowerCase().trim(), c);
      });

      // Unified items collector
      const combinedItems: ReceivableItem[] = [];
      const seenIds = new Set<string>();

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      // Process Invoices
      rawInvoices.forEach((inv: any) => {
        const id = inv.id || inv._id || `inv-${Math.random()}`;
        if (seenIds.has(id)) return;
        seenIds.add(id);

        const customer = custMap.get(inv.order?.customerId || inv.customerId) || custMap.get((inv.order?.customerName || inv.customerName || "").toLowerCase().trim()) || inv.order?.customer || inv.customer || {};
        const total = Number(inv.finalAmount ?? inv.grandTotal ?? inv.totalAmount ?? inv.amount ?? inv.total ?? 0);
        
        // Sum payment amounts checking both paidAmount and amount
        const directPaymentSum = inv.payments?.reduce((s: number, p: any) => {
          if (p.isCancelled || (p.status && p.status !== 'PAID' && p.status !== 'SUCCESS')) return s;
          return s + Number(p.paidAmount ?? p.amount ?? 0);
        }, 0) || 0;
        
        const paid = Number(inv.paidAmount ?? inv.advanceAmount ?? (directPaymentSum > 0 ? directPaymentSum : (inv.status === 'PAID' || inv.order?.paymentStatus === 'PAID' ? total : 0)));
        const outstanding = Math.max(0, total - paid);

        const invDateStr = inv.invoiceDate || inv.date || inv.order?.createdAt || inv.createdAt || new Date().toISOString();
        const dueDateStr = inv.dueDate || invDateStr;
        const dueTime = new Date(dueDateStr).getTime();

        const isOverdue = outstanding > 0.01 && dueTime < today;
        const daysOverdue = isOverdue ? Math.max(0, Math.floor((today - dueTime) / (1000 * 60 * 60 * 24))) : 0;

        let status: "PAID" | "PARTIAL" | "UNPAID" | "OVERDUE" = "UNPAID";
        if (outstanding <= 0.01) {
          status = "PAID";
        } else if (isOverdue) {
          status = "OVERDUE";
        } else if (paid > 0) {
          status = "PARTIAL";
        } else {
          status = "UNPAID";
        }

        let agingBucket: "0-30" | "31-60" | "61-90" | "90+" = "0-30";
        if (daysOverdue > 90) agingBucket = "90+";
        else if (daysOverdue > 60) agingBucket = "61-90";
        else if (daysOverdue > 30) agingBucket = "31-60";

        const invNumber = inv.order?.invoiceNum || inv.invoiceNumber || inv.invoiceNo || inv.billNumber || `INV-${id.slice(-6).toUpperCase()}`;

        combinedItems.push({
          id,
          invoiceNumber: invNumber,
          orderId: inv.orderId || inv.order?.id || inv.salesOrderId,
          customerId: inv.order?.customerId || inv.customerId || customer.id || "",
          customerName: inv.order?.customerName || inv.order?.customer?.name || inv.customerName || customer.name || (inv.payments?.[0]?.transactionRef) || "Walk-in Customer",
          customerPhone: inv.order?.customerPhone || inv.order?.customer?.phone || inv.customerPhone || customer.phone || customer.mobile || "—",
          customerEmail: inv.order?.customerEmail || inv.order?.customer?.email || inv.customerEmail || customer.email || "—",
          invoiceDate: invDateStr,
          dueDate: dueDateStr,
          totalAmount: total,
          paidAmount: paid,
          outstandingAmount: outstanding,
          status,
          daysOverdue,
          agingBucket,
          items: inv.order?.orderItems || inv.items || [],
          payments: inv.payments || []
        });
      });

      // Process Orders not already captured by invoice
      rawOrders.forEach((ord: any) => {
        const id = ord.id || ord._id || `ord-${Math.random()}`;
        const invNum = ord.orderNumber || ord.invoiceNumber || `SO-${id.slice(-6).toUpperCase()}`;
        if (seenIds.has(id) || combinedItems.some(i => i.invoiceNumber === invNum)) return;
        seenIds.add(id);

        const customer = custMap.get(ord.customerId) || custMap.get((ord.customerName || "").toLowerCase().trim()) || ord.customer || {};
        const total = Number(ord.grandTotal || ord.totalAmount || ord.total || 0);
        
        const directPaymentSum = ord.payments?.reduce((s: number, p: any) => {
          if (p.isCancelled || (p.status && p.status !== 'PAID' && p.status !== 'SUCCESS')) return s;
          return s + Number(p.paidAmount ?? p.amount ?? 0);
        }, 0) || 0;
        
        const paid = Number(ord.paidAmount ?? ord.advanceAmount ?? (directPaymentSum > 0 ? directPaymentSum : (ord.paymentStatus === 'PAID' || ord.status === 'COMPLETED' ? total : 0)));
        const outstanding = Math.max(0, total - paid);

        const invDateStr = ord.orderDate || ord.createdAt || new Date().toISOString();
        const dueDateStr = ord.dueDate || invDateStr;
        const dueTime = new Date(dueDateStr).getTime();

        const isOverdue = outstanding > 0.01 && dueTime < today;
        const daysOverdue = isOverdue ? Math.max(0, Math.floor((today - dueTime) / (1000 * 60 * 60 * 24))) : 0;

        let status: "PAID" | "PARTIAL" | "UNPAID" | "OVERDUE" = "UNPAID";
        if (outstanding <= 0.01) {
          status = "PAID";
        } else if (isOverdue) {
          status = "OVERDUE";
        } else if (paid > 0) {
          status = "PARTIAL";
        } else {
          status = "UNPAID";
        }

        let agingBucket: "0-30" | "31-60" | "61-90" | "90+" = "0-30";
        if (daysOverdue > 90) agingBucket = "90+";
        else if (daysOverdue > 60) agingBucket = "61-90";
        else if (daysOverdue > 30) agingBucket = "31-60";

        combinedItems.push({
          id,
          invoiceNumber: invNum,
          orderId: id,
          customerId: ord.customerId || customer.id || "",
          customerName: ord.customerName || customer.name || "Standard Customer",
          customerPhone: ord.customerPhone || customer.phone || "—",
          customerEmail: ord.customerEmail || customer.email || "—",
          invoiceDate: invDateStr,
          dueDate: dueDateStr,
          totalAmount: total,
          paidAmount: paid,
          outstandingAmount: outstanding,
          status,
          daysOverdue,
          agingBucket,
          items: ord.items || [],
          payments: ord.payments || []
        });
      });

      // Sort by due date ascending (most urgent first)
      combinedItems.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      setReceivables(combinedItems);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load receivables ledger");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceivables();
  }, [fetchReceivables]);

  // ── Filtered Receivables ─────────────────────────────────────────────────────

  const filteredReceivables = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const in7Days = today + (7 * 24 * 60 * 60 * 1000);

    return receivables.filter((item) => {
      // 1. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInv = item.invoiceNumber.toLowerCase().includes(q);
        const matchName = item.customerName.toLowerCase().includes(q);
        const matchPhone = item.customerPhone.toLowerCase().includes(q);
        const matchEmail = item.customerEmail.toLowerCase().includes(q);
        if (!matchInv && !matchName && !matchPhone && !matchEmail) return false;
      }

      // 2. Customer Filter
      if (selectedCustomerId !== "ALL") {
        if (item.customerId !== selectedCustomerId && item.customerName !== selectedCustomerId) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter === "OVERDUE" && item.status !== "OVERDUE") return false;
      if (statusFilter === "UNPAID" && item.status !== "UNPAID") return false;
      if (statusFilter === "PARTIAL" && item.status !== "PARTIAL") return false;
      if (statusFilter === "PAID" && item.status !== "PAID") return false;
      if (statusFilter === "DUE_SOON") {
        const dueTime = new Date(item.dueDate).getTime();
        const isDueSoon = item.outstandingAmount > 0.01 && dueTime >= today && dueTime <= in7Days;
        if (!isDueSoon) return false;
      }

      // 4. Aging Filter
      if (agingFilter !== "ALL" && item.agingBucket !== agingFilter) return false;

      // 5. Date Preset Filter
      if (datePreset !== "All Time") {
        const { from, to } = getDateRange(datePreset, customStartDate, customEndDate);
        const invDate = new Date(item.invoiceDate).toISOString().split("T")[0];
        if (invDate < from || invDate > to) return false;
      }

      return true;
    });
  }, [receivables, searchQuery, selectedCustomerId, statusFilter, agingFilter, datePreset, customStartDate, customEndDate]);

  // ── Customer Summary Breakdown ───────────────────────────────────────────────

  const customerSummaries = useMemo(() => {
    const map = new Map<string, CustomerSummary>();

    filteredReceivables.forEach((item) => {
      const key = item.customerId || item.customerName;
      let existing = map.get(key);
      if (!existing) {
        existing = {
          customerId: item.customerId,
          customerName: item.customerName,
          phone: item.customerPhone,
          email: item.customerEmail,
          totalInvoiced: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          overdueAmount: 0,
          invoiceCount: 0,
          overdueCount: 0,
        };
        map.set(key, existing);
      }

      existing.totalInvoiced += item.totalAmount;
      existing.totalPaid += item.paidAmount;
      existing.totalOutstanding += item.outstandingAmount;
      existing.invoiceCount += 1;

      if (item.status === "OVERDUE") {
        existing.overdueAmount += item.outstandingAmount;
        existing.overdueCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [filteredReceivables]);

  // ── KPI Metrics (Overall) ────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const in7Days = today + (7 * 24 * 60 * 60 * 1000);

    const totalOutstanding = receivables.reduce((s, r) => s + r.outstandingAmount, 0);
    const totalOverdue = receivables.filter(r => r.status === "OVERDUE").reduce((s, r) => s + r.outstandingAmount, 0);
    const dueSoon = receivables.filter(r => {
      const dueTime = new Date(r.dueDate).getTime();
      return r.outstandingAmount > 0.01 && dueTime >= today && dueTime <= in7Days;
    }).reduce((s, r) => s + r.outstandingAmount, 0);
    const totalCollected = receivables.reduce((s, r) => s + r.paidAmount, 0);

    return { totalOutstanding, totalOverdue, dueSoon, totalCollected };
  }, [receivables]);

  // ── Quick Payment Submission ─────────────────────────────────────────────────

  const handleOpenPayment = (inv: ReceivableItem) => {
    setPaymentModalInvoice(inv);
    setPaymentAmount(inv.outstandingAmount.toFixed(2));
    setPaymentMode("CASH");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentReference("");
    setPaymentNotes(`Payment for ${inv.invoiceNumber}`);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;

    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (amount > paymentModalInvoice.outstandingAmount + 0.01) {
      toast.error(`Payment amount cannot exceed outstanding balance (${fmtINR(paymentModalInvoice.outstandingAmount)})`);
      return;
    }

    setRecordingPayment(true);
    try {
      await accountingApi.recordPayment({
        customerId: paymentModalInvoice.customerId,
        invoiceId: paymentModalInvoice.id,
        orderId: paymentModalInvoice.orderId,
        amount,
        paymentMode,
        paymentDate,
        reference: paymentReference,
        notes: paymentNotes,
        type: "INFLOW",
        direction: "IN",
        status: "PAID"
      });

      toast.success(`Payment of ${fmtINR(amount)} recorded successfully`);
      setPaymentModalInvoice(null);
      fetchReceivables();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  // ── Export CSV ───────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (filteredReceivables.length === 0) {
      toast.error("No receivables to export");
      return;
    }

    const headers = [
      "Invoice Number",
      "Customer Name",
      "Phone",
      "Email",
      "Invoice Date",
      "Due Date",
      "Invoice Amount",
      "Paid Amount",
      "Outstanding Balance",
      "Status",
      "Days Overdue"
    ];

    const rows = filteredReceivables.map(r => [
      `"${r.invoiceNumber.replace(/"/g, '""')}"`,
      `"${r.customerName.replace(/"/g, '""')}"`,
      `"${r.customerPhone.replace(/"/g, '""')}"`,
      `"${r.customerEmail.replace(/"/g, '""')}"`,
      `"${formatDate(r.invoiceDate)}"`,
      `"${formatDate(r.dueDate)}"`,
      `"${r.totalAmount.toFixed(2)}"`,
      `"${r.paidAmount.toFixed(2)}"`,
      `"${r.outstandingAmount.toFixed(2)}"`,
      `"${r.status}"`,
      `"${r.daysOverdue}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Receivables_Ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Receivables ledger exported to CSV");
  };

  const handlePrint = () => {
    window.print();
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setSelectedCustomerId("ALL");
    setAgingFilter("ALL");
    setDatePreset("All Time");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "ALL" || selectedCustomerId !== "ALL" || agingFilter !== "ALL" || datePreset !== "All Time";

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 bg-gray-50 dark:bg-background min-h-screen text-gray-800 dark:text-slate-100 animate-in fade-in duration-300 w-full min-w-0">

      {/* ── Top Header Toolbar ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Receipt size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Accounts Receivable
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Live customer outstanding balances, aging schedules, and payment collection
            </p>
          </div>
        </div>

        {/* View Mode & Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between lg:justify-end min-w-0">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("INVOICES")}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "INVOICES"
                  ? "bg-white dark:bg-card text-[#f58220] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              By Invoices
            </button>
            <button
              onClick={() => setViewMode("CUSTOMERS")}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "CUSTOMERS"
                  ? "bg-white dark:bg-card text-[#f58220] shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              By Customer
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
              title="Export CSV"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-white/5 transition-colors shadow-2xs cursor-pointer"
              title="Print Statement"
            >
              <Printer className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={fetchReceivables}
              title="Refresh Ledger"
              className="p-2 sm:p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={15} className={clsx(loading && "animate-spin text-[#f58220]")} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Interactive KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
        {/* Total Outstanding */}
        <div
          onClick={() => setStatusFilter(statusFilter === "UNPAID" ? "ALL" : "UNPAID")}
          className={clsx(
            "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs relative overflow-hidden",
            statusFilter === "UNPAID" || statusFilter === "ALL"
              ? "bg-slate-900 text-white border-slate-800"
              : "bg-white dark:bg-card border-gray-200 dark:border-white/5 text-gray-900 dark:text-white hover:border-[#f58220]/50"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={clsx("text-[11px] font-bold uppercase tracking-wider", statusFilter === "UNPAID" || statusFilter === "ALL" ? "text-slate-400" : "text-gray-500 dark:text-slate-400")}>
              Total Receivables
            </span>
            <div className="p-2 rounded-xl bg-orange-500/10 text-[#f58220]">
              <Wallet size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight mt-2">
            {fmtINR(kpis.totalOutstanding)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] font-medium text-slate-400">
            <span>Pending customer balances</span>
          </div>
        </div>

        {/* Overdue */}
        <div
          onClick={() => setStatusFilter(statusFilter === "OVERDUE" ? "ALL" : "OVERDUE")}
          className={clsx(
            "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs",
            statusFilter === "OVERDUE"
              ? "bg-rose-600 text-white border-rose-700 shadow-rose-500/10"
              : "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30 hover:border-rose-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={clsx("text-[11px] font-bold uppercase tracking-wider", statusFilter === "OVERDUE" ? "text-white/80" : "text-rose-700 dark:text-rose-400")}>
              Overdue Amount
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertCircle size={16} />
            </div>
          </div>
          <p className={clsx("text-xl sm:text-2xl font-black font-mono tracking-tight mt-2", statusFilter === "OVERDUE" ? "text-white" : "text-rose-600 dark:text-rose-400")}>
            {fmtINR(kpis.totalOverdue)}
          </p>
          <div className={clsx("flex items-center gap-1 mt-2 text-[11px] font-semibold", statusFilter === "OVERDUE" ? "text-white/80" : "text-rose-600 dark:text-rose-400")}>
            <span>Past due payment date</span>
          </div>
        </div>

        {/* Due Soon */}
        <div
          onClick={() => setStatusFilter(statusFilter === "DUE_SOON" ? "ALL" : "DUE_SOON")}
          className={clsx(
            "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs",
            statusFilter === "DUE_SOON"
              ? "bg-amber-600 text-white border-amber-700 shadow-amber-500/10"
              : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 hover:border-amber-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={clsx("text-[11px] font-bold uppercase tracking-wider", statusFilter === "DUE_SOON" ? "text-white/80" : "text-amber-700 dark:text-amber-400")}>
              Due in Next 7 Days
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <p className={clsx("text-xl sm:text-2xl font-black font-mono tracking-tight mt-2", statusFilter === "DUE_SOON" ? "text-white" : "text-amber-600 dark:text-amber-400")}>
            {fmtINR(kpis.dueSoon)}
          </p>
          <div className={clsx("flex items-center gap-1 mt-2 text-[11px] font-semibold", statusFilter === "DUE_SOON" ? "text-white/80" : "text-amber-600 dark:text-amber-400")}>
            <span>Upcoming collections</span>
          </div>
        </div>

        {/* Total Collected */}
        <div
          onClick={() => setStatusFilter(statusFilter === "PAID" ? "ALL" : "PAID")}
          className={clsx(
            "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs",
            statusFilter === "PAID"
              ? "bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/10"
              : "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 hover:border-emerald-400"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={clsx("text-[11px] font-bold uppercase tracking-wider", statusFilter === "PAID" ? "text-white/80" : "text-emerald-700 dark:text-emerald-400")}>
              Total Collected
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className={clsx("text-xl sm:text-2xl font-black font-mono tracking-tight mt-2", statusFilter === "PAID" ? "text-white" : "text-emerald-600 dark:text-emerald-400")}>
            {fmtINR(kpis.totalCollected)}
          </p>
          <div className={clsx("flex items-center gap-1 mt-2 text-[11px] font-semibold", statusFilter === "PAID" ? "text-white/80" : "text-emerald-600 dark:text-emerald-400")}>
            <span>Settled invoice receipts</span>
          </div>
        </div>
      </div>

      {/* ── Multi-Dimensional Filters Bar ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 shadow-2xs space-y-3 w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search invoice, customer, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:border-[#f58220]"
            />
            {searchQuery && (
              <X
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                onClick={() => setSearchQuery("")}
              />
            )}
          </div>

          {/* Controls Cluster */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Customer Dropdown */}
            <div className="relative shrink-0">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220] max-w-[170px] truncate"
              >
                <option value="ALL">All Customers</option>
                {customersList.map((c: any) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>

            {/* Aging Bucket Dropdown */}
            <div className="relative shrink-0">
              <select
                value={agingFilter}
                onChange={(e) => setAgingFilter(e.target.value as any)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220]"
              >
                <option value="ALL">All Aging</option>
                <option value="0-30">0 – 30 Days</option>
                <option value="31-60">31 – 60 Days</option>
                <option value="61-90">61 – 90 Days</option>
                <option value="90+">90+ Days</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>

            {/* Date Preset Dropdown */}
            <div className="relative shrink-0">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-[#f58220]"
              >
                <option value="All Time">All Time</option>
                <option value="This Month">This Month</option>
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="This Year">This Year</option>
                <option value="Custom">Custom Range</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            </div>

            {datePreset === "Custom" && (
              <div className="flex items-center gap-1.5 border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 bg-gray-50 dark:bg-[#13151f] text-xs shrink-0">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
                />
                <span className="text-gray-400 dark:text-slate-500 text-xs">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs text-gray-700 dark:text-white outline-none bg-transparent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Status Filter Tabs & Active Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar p-0.5">
            {[
              { id: "ALL", label: "All Records" },
              { id: "OVERDUE", label: "Overdue" },
              { id: "DUE_SOON", label: "Due Soon" },
              { id: "PARTIAL", label: "Partially Paid" },
              { id: "UNPAID", label: "Unpaid" },
              { id: "PAID", label: "Paid" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={clsx(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                  statusFilter === tab.id
                    ? "bg-[#f58220] text-white shadow-2xs"
                    : "bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer select-none inline-flex items-center gap-1"
            >
              <X size={13} />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main Data View: Invoices or Customers ── */}
      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[#f58220] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 animate-pulse">
            Auditing accounts receivable and customer aging schedules...
          </p>
        </div>
      ) : viewMode === "INVOICES" ? (
        /* ── INVOICES VIEW ── */
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-2xs w-full min-w-0">
          <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
              Receivables Invoices Ledger ({filteredReceivables.length})
            </span>
            <span className="text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
              Total Outstanding: {fmtINR(filteredReceivables.reduce((s, r) => s + r.outstandingAmount, 0))}
            </span>
          </div>

          {/* Desktop / Tablet Table */}
          <div className="hidden md:block overflow-x-auto custom-scrollbar w-full max-w-full">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/5 bg-gray-50/75 dark:bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  <th className="px-4 sm:px-6 py-3">Invoice &amp; Date</th>
                  <th className="px-4 sm:px-6 py-3">Customer Party</th>
                  <th className="px-4 sm:px-6 py-3">Due Date &amp; Aging</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Invoice Amount</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Paid Amount</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Outstanding</th>
                  <th className="px-4 sm:px-6 py-3 text-center">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                {filteredReceivables.length > 0 ? (
                  filteredReceivables.map((inv) => (
                    <tr key={inv.id} className="hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 sm:px-6 py-3.5">
                        <p className="font-bold text-gray-900 dark:text-white font-mono">{inv.invoiceNumber}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono mt-0.5">
                          {formatDate(inv.invoiceDate)}
                        </p>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5">
                        <p className="font-semibold text-gray-800 dark:text-slate-100">{inv.customerName}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{inv.customerPhone}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5">
                        <p className={clsx("font-bold font-mono", inv.status === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-gray-700 dark:text-slate-300")}>
                          {formatDate(inv.dueDate)}
                        </p>
                        {inv.daysOverdue > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                            {inv.daysOverdue} days overdue
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 dark:text-slate-500">On schedule</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right font-mono font-semibold text-gray-900 dark:text-white">
                        {fmtINR(inv.totalAmount)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {fmtINR(inv.paidAmount)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                        <span className={inv.outstandingAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {fmtINR(inv.outstandingAmount)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-center">
                        <span
                          className={clsx(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            inv.status === "PAID"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              : inv.status === "OVERDUE"
                              ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                              : inv.status === "PARTIAL"
                              ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                              : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                          )}
                        >
                          {inv.status === "OVERDUE" ? "OVERDUE" : inv.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          {inv.outstandingAmount > 0.01 && (
                            <button
                              onClick={() => handleOpenPayment(inv)}
                              className="px-2.5 py-1 bg-[#f58220] hover:bg-[#e0751a] text-white text-[11px] font-bold rounded-lg transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1"
                            >
                              <DollarSign size={12} />
                              <span>Collect</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-gray-400 dark:text-slate-500">
                      <Receipt size={32} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                      <p className="font-semibold text-xs sm:text-sm">No receivables matching the selected criteria</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (< 768px) */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
            {filteredReceivables.length > 0 ? (
              filteredReceivables.map((inv) => (
                <div key={inv.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{inv.customerName}</p>
                      <p className="font-mono text-xs font-bold text-gray-500 dark:text-slate-400 mt-0.5">{inv.invoiceNumber}</p>
                    </div>
                    <span
                      className={clsx(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0",
                        inv.status === "PAID"
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200"
                          : inv.status === "OVERDUE"
                          ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200"
                          : inv.status === "PARTIAL"
                          ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200"
                          : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200"
                      )}
                    >
                      {inv.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-white/[0.02] p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400">Due Date</span>
                      <p className={clsx("font-mono font-bold mt-0.5", inv.status === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-gray-800 dark:text-slate-200")}>
                        {formatDate(inv.dueDate)}
                      </p>
                      {inv.daysOverdue > 0 && (
                        <p className="text-[10px] text-rose-500 font-semibold">{inv.daysOverdue} days overdue</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Outstanding</span>
                      <p className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400 mt-0.5">
                        {fmtINR(inv.outstandingAmount)}
                      </p>
                      <p className="text-[10px] text-gray-400">Total: {fmtINR(inv.totalAmount)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 cursor-pointer"
                    >
                      View Details
                    </button>
                    {inv.outstandingAmount > 0.01 && (
                      <button
                        onClick={() => handleOpenPayment(inv)}
                        className="px-3.5 py-1.5 bg-[#f58220] hover:bg-[#e0751a] text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <DollarSign size={13} />
                        <span>Collect Payment</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 dark:text-slate-500">
                <Receipt size={28} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                <p className="font-semibold text-xs">No receivables found</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── CUSTOMER AGGREGATION VIEW ── */
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-2xs w-full min-w-0">
          <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
              Customer Accounts Summary ({customerSummaries.length})
            </span>
            <span className="text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
              Total Outstanding: {fmtINR(customerSummaries.reduce((s, c) => s + c.totalOutstanding, 0))}
            </span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {customerSummaries.length > 0 ? (
              customerSummaries.map((cust) => (
                <div key={cust.customerId || cust.customerName} className="p-4 sm:p-5 hover:bg-orange-50/20 dark:hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                      <User size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{cust.customerName}</h3>
                        {cust.overdueCount > 0 && (
                          <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full text-[10px] font-bold">
                            {cust.overdueCount} Overdue
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-1 flex-wrap">
                        {cust.phone !== "—" && (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={12} /> {cust.phone}
                          </span>
                        )}
                        <span>•</span>
                        <span>{cust.invoiceCount} Total Invoices</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 dark:border-white/5">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-bold uppercase text-gray-400">Total Outstanding</span>
                      <p className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                        {fmtINR(cust.totalOutstanding)}
                      </p>
                      <p className="text-[10px] text-gray-400">Collected: {fmtINR(cust.totalPaid)}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedCustomerId(cust.customerId || cust.customerName);
                        setViewMode("INVOICES");
                      }}
                      className="px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-gray-200 dark:border-white/10 transition-all cursor-pointer inline-flex items-center gap-1 shrink-0"
                    >
                      <span>View Invoices</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-gray-400 dark:text-slate-500">
                <User size={32} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                <p className="font-semibold text-xs sm:text-sm">No customers matching active filters</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Invoice Details Slide-over / Modal ── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-lg">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{selectedInvoice.invoiceNumber}</h3>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">Invoice Details &amp; Receivable Summary</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Customer Info Card */}
              <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 rounded-xl p-3.5 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer Party</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedInvoice.customerName}</p>
                <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400 pt-1">
                  <span>Phone: {selectedInvoice.customerPhone}</span>
                  <span>•</span>
                  <span>Email: {selectedInvoice.customerEmail}</span>
                </div>
              </div>

              {/* Financial Balance Summary */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
                  <span className="text-[10px] font-bold uppercase text-gray-400">Invoice Total</span>
                  <p className="text-sm font-bold font-mono text-gray-900 dark:text-white mt-1">
                    {fmtINR(selectedInvoice.totalAmount)}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Total Paid</span>
                  <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {fmtINR(selectedInvoice.paidAmount)}
                  </p>
                </div>
                <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
                  <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">Outstanding</span>
                  <p className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                    {fmtINR(selectedInvoice.outstandingAmount)}
                  </p>
                </div>
              </div>

              {/* Schedule Dates */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Invoice Date</span>
                  <p className="font-mono font-semibold text-gray-800 dark:text-slate-200 mt-0.5">{formatDate(selectedInvoice.invoiceDate)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Due Date</span>
                  <p className={clsx("font-mono font-bold mt-0.5", selectedInvoice.status === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-gray-800 dark:text-slate-200")}>
                    {formatDate(selectedInvoice.dueDate)}
                  </p>
                  {selectedInvoice.daysOverdue > 0 && (
                    <p className="text-[10px] text-rose-500 font-bold">{selectedInvoice.daysOverdue} days overdue</p>
                  )}
                </div>
              </div>

              {/* Items List (if available) */}
              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Invoice Items</span>
                  <div className="border border-gray-100 dark:border-white/5 rounded-xl divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
                    {selectedInvoice.items.map((item: any, idx: number) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-slate-200">{item.name || item.productName || `Item #${idx + 1}`}</p>
                          <p className="text-[10px] text-gray-400">Qty: {item.quantity || 1} • Rate: {fmtINR(item.rate || item.price || 0)}</p>
                        </div>
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          {fmtINR(item.total || (item.quantity * item.rate) || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-white/[0.01]">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Close
              </button>
              {selectedInvoice.outstandingAmount > 0.01 && (
                <button
                  onClick={() => {
                    const inv = selectedInvoice;
                    setSelectedInvoice(null);
                    handleOpenPayment(inv);
                  }}
                  className="px-4 py-2 bg-[#f58220] hover:bg-[#e0751a] text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <DollarSign size={14} />
                  <span>Collect Payment</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <form onSubmit={handleRecordPayment} className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <DollarSign size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Collect Payment</h3>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">Record customer settlement for {paymentModalInvoice.invoiceNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs">
              {/* Outstanding Banner */}
              <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">Current Outstanding</span>
                  <p className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{fmtINR(paymentModalInvoice.outstandingAmount)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-gray-400">Customer</span>
                  <p className="font-semibold text-gray-800 dark:text-slate-200 mt-0.5 truncate max-w-[140px]">{paymentModalInvoice.customerName}</p>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paymentModalInvoice.outstandingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-[#f58220]"
                />
              </div>

              {/* Payment Mode */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                  Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["CASH", "UPI", "BANK", "CARD"].map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      className={clsx(
                        "py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        paymentMode === mode
                          ? "bg-[#f58220] text-white border-[#f58220] shadow-2xs"
                          : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Date & Reference */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-[#f58220]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">Ref / Txn #</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-12345"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-[#f58220]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">Notes</label>
                <input
                  type="text"
                  placeholder="Optional payment notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-[#f58220]"
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-white/[0.01]">
              <button
                type="button"
                onClick={() => setPaymentModalInvoice(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordingPayment}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {recordingPayment ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Confirm Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
