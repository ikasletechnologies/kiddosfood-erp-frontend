"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CreditCard, Search, RefreshCw, Filter, ArrowUpRight, ArrowDownRight,
  Clock, AlertCircle, CheckCircle2, Building2, FileText, ChevronDown,
  Calendar, FileSpreadsheet, Printer, X, Eye, IndianRupee,
  Smartphone, ChevronRight, Layers, Phone, Mail, Receipt, ArrowRight,
  Truck, ShieldAlert
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { vendorsApi, vendorInvoicesApi, purchaseOrdersApi } from "@/lib/api/procurement.api";
import { accountsApi, accountingApi } from "@/lib/api/accounting.api";
import api from "@/lib/api/base";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PayableBill {
  id: string;
  billNumber: string;
  poId?: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  vendorEmail: string;
  billDate: string;
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

interface VendorSummary {
  vendorId: string;
  vendorName: string;
  phone: string;
  email: string;
  totalBilled: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueAmount: number;
  billCount: number;
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

export default function PayablesPage() {
  const [loading, setLoading] = useState(true);
  const [payables, setPayables] = useState<PayableBill[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [accountsList, setAccountsList] = useState<any[]>([]);

  // View mode
  const [viewMode, setViewMode] = useState<"BILLS" | "VENDORS">("BILLS");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OVERDUE" | "DUE_SOON" | "PARTIAL" | "UNPAID" | "PAID">("ALL");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("ALL");
  const [agingFilter, setAgingFilter] = useState<"ALL" | "0-30" | "31-60" | "61-90" | "90+">("ALL");
  const [datePreset, setDatePreset] = useState<string>("All Time");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Modal States
  const [selectedBill, setSelectedBill] = useState<PayableBill | null>(null);
  const [paymentModalBill, setPaymentModalBill] = useState<PayableBill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("BANK");
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  // ── Fetch Payables Data ──────────────────────────────────────────────────────

  const fetchPayables = useCallback(async () => {
    setLoading(true);
    try {
      const [invoicesRes, posRes, vendorsRes, accountsRes] = await Promise.all([
        vendorInvoicesApi.getAll().catch(() => ({ data: [] })),
        purchaseOrdersApi.getAll().catch(() => ({ data: [] })),
        vendorsApi.getAll().catch(() => ({ data: [] })),
        accountsApi.getAll().catch(() => ({ data: [] }))
      ]);

      const rawInvoices = Array.isArray(invoicesRes.data)
        ? invoicesRes.data
        : invoicesRes.data?.invoices || invoicesRes.data?.data || [];

      const rawPOs = Array.isArray(posRes.data)
        ? posRes.data
        : posRes.data?.purchaseOrders || posRes.data?.data || [];

      const rawVendors = Array.isArray(vendorsRes.data)
        ? vendorsRes.data
        : vendorsRes.data?.vendors || vendorsRes.data?.data || [];

      const rawAccounts = Array.isArray(accountsRes.data)
        ? accountsRes.data
        : accountsRes.data?.accounts || accountsRes.data?.data || [];

      setVendorsList(rawVendors);
      setAccountsList(rawAccounts);
      if (rawAccounts.length > 0 && !paymentAccountId) {
        setPaymentAccountId(rawAccounts[0].id || rawAccounts[0]._id);
      }

      // Vendor map
      const vendorMap = new Map<string, any>();
      rawVendors.forEach((v: any) => {
        if (v.id) vendorMap.set(v.id, v);
        if (v._id) vendorMap.set(v._id, v);
        if (v.name) vendorMap.set(v.name.toLowerCase().trim(), v);
      });

      const combinedBills: PayableBill[] = [];
      const seenIds = new Set<string>();

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      // Process Vendor Invoices
      rawInvoices.forEach((inv: any) => {
        const id = inv.id || inv._id || `vinv-${Math.random()}`;
        if (seenIds.has(id)) return;
        seenIds.add(id);

        const vendor = vendorMap.get(inv.vendorId) || vendorMap.get((inv.vendorName || "").toLowerCase().trim()) || inv.vendor || {};
        const total = Number(inv.grandTotal || inv.totalAmount || inv.amount || inv.total || 0);
        const paid = Number(inv.paidAmount || (inv.payments?.reduce((s: number, p: any) => s + (p.amount || 0), 0)) || 0);
        const outstanding = Math.max(0, total - paid);

        const billDateStr = inv.invoiceDate || inv.date || inv.createdAt || new Date().toISOString();
        const dueDateStr = inv.dueDate || billDateStr;
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

        combinedBills.push({
          id,
          billNumber: inv.invoiceNumber || inv.billNumber || `PB-${id.slice(-6).toUpperCase()}`,
          poId: inv.purchaseOrderId || inv.poId,
          vendorId: inv.vendorId || vendor.id || "",
          vendorName: inv.vendorName || vendor.name || "Commercial Supplier",
          vendorPhone: inv.vendorPhone || vendor.phone || vendor.mobile || "—",
          vendorEmail: inv.vendorEmail || vendor.email || "—",
          billDate: billDateStr,
          dueDate: dueDateStr,
          totalAmount: total,
          paidAmount: paid,
          outstandingAmount: outstanding,
          status,
          daysOverdue,
          agingBucket,
          items: inv.items || [],
          payments: inv.payments || []
        });
      });

      // Process Purchase Orders (with confirmed/received status) not already in bills
      rawPOs.forEach((po: any) => {
        const id = po.id || po._id || `po-${Math.random()}`;
        const billNum = po.poNumber || po.orderNumber || `PO-${id.slice(-6).toUpperCase()}`;
        if (seenIds.has(id) || combinedBills.some(b => b.billNumber === billNum)) return;
        seenIds.add(id);

        const vendor = vendorMap.get(po.vendorId) || vendorMap.get((po.vendorName || "").toLowerCase().trim()) || po.vendor || {};
        const total = Number(po.grandTotal || po.totalAmount || po.total || 0);
        const paid = Number(po.advancePaid || po.paidAmount || (po.status === 'PAID' ? total : 0));
        const outstanding = Math.max(0, total - paid);

        const billDateStr = po.orderDate || po.createdAt || new Date().toISOString();
        const dueDateStr = po.expectedDeliveryDate || po.dueDate || billDateStr;
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

        combinedBills.push({
          id,
          billNumber: billNum,
          poId: id,
          vendorId: po.vendorId || vendor.id || "",
          vendorName: po.vendorName || vendor.name || "Registered Vendor",
          vendorPhone: po.vendorPhone || vendor.phone || "—",
          vendorEmail: po.vendorEmail || vendor.email || "—",
          billDate: billDateStr,
          dueDate: dueDateStr,
          totalAmount: total,
          paidAmount: paid,
          outstandingAmount: outstanding,
          status,
          daysOverdue,
          agingBucket,
          items: po.items || [],
          payments: po.payments || []
        });
      });

      // Sort by due date ascending
      combinedBills.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      setPayables(combinedBills);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load payables ledger");
    } finally {
      setLoading(false);
    }
  }, [paymentAccountId]);

  useEffect(() => {
    fetchPayables();
  }, [fetchPayables]);

  // ── Filtered Payables ────────────────────────────────────────────────────────

  const filteredPayables = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const in7Days = today + (7 * 24 * 60 * 60 * 1000);

    return payables.filter((bill) => {
      // 1. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchBill = bill.billNumber.toLowerCase().includes(q);
        const matchName = bill.vendorName.toLowerCase().includes(q);
        const matchPhone = bill.vendorPhone.toLowerCase().includes(q);
        const matchEmail = bill.vendorEmail.toLowerCase().includes(q);
        if (!matchBill && !matchName && !matchPhone && !matchEmail) return false;
      }

      // 2. Vendor Filter
      if (selectedVendorId !== "ALL") {
        if (bill.vendorId !== selectedVendorId && bill.vendorName !== selectedVendorId) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter === "OVERDUE" && bill.status !== "OVERDUE") return false;
      if (statusFilter === "UNPAID" && bill.status !== "UNPAID") return false;
      if (statusFilter === "PARTIAL" && bill.status !== "PARTIAL") return false;
      if (statusFilter === "PAID" && bill.status !== "PAID") return false;
      if (statusFilter === "DUE_SOON") {
        const dueTime = new Date(bill.dueDate).getTime();
        const isDueSoon = bill.outstandingAmount > 0.01 && dueTime >= today && dueTime <= in7Days;
        if (!isDueSoon) return false;
      }

      // 4. Aging Filter
      if (agingFilter !== "ALL" && bill.agingBucket !== agingFilter) return false;

      // 5. Date Preset Filter
      if (datePreset !== "All Time") {
        const { from, to } = getDateRange(datePreset, customStartDate, customEndDate);
        const bDate = new Date(bill.billDate).toISOString().split("T")[0];
        if (bDate < from || bDate > to) return false;
      }

      return true;
    });
  }, [payables, searchQuery, selectedVendorId, statusFilter, agingFilter, datePreset, customStartDate, customEndDate]);

  // ── Vendor Summary Breakdown ─────────────────────────────────────────────────

  const vendorSummaries = useMemo(() => {
    const map = new Map<string, VendorSummary>();

    filteredPayables.forEach((bill) => {
      const key = bill.vendorId || bill.vendorName;
      let existing = map.get(key);
      if (!existing) {
        existing = {
          vendorId: bill.vendorId,
          vendorName: bill.vendorName,
          phone: bill.vendorPhone,
          email: bill.vendorEmail,
          totalBilled: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          overdueAmount: 0,
          billCount: 0,
          overdueCount: 0,
        };
        map.set(key, existing);
      }

      existing.totalBilled += bill.totalAmount;
      existing.totalPaid += bill.paidAmount;
      existing.totalOutstanding += bill.outstandingAmount;
      existing.billCount += 1;

      if (bill.status === "OVERDUE") {
        existing.overdueAmount += bill.outstandingAmount;
        existing.overdueCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [filteredPayables]);

  // ── KPI Metrics (Overall) ────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const in7Days = today + (7 * 24 * 60 * 60 * 1000);

    const totalOutstanding = payables.reduce((s, b) => s + b.outstandingAmount, 0);
    const totalOverdue = payables.filter(b => b.status === "OVERDUE").reduce((s, b) => s + b.outstandingAmount, 0);
    const dueSoon = payables.filter(b => {
      const dueTime = new Date(b.dueDate).getTime();
      return b.outstandingAmount > 0.01 && dueTime >= today && dueTime <= in7Days;
    }).reduce((s, b) => s + b.outstandingAmount, 0);
    const totalPaid = payables.reduce((s, b) => s + b.paidAmount, 0);

    return { totalOutstanding, totalOverdue, dueSoon, totalPaid };
  }, [payables]);

  // ── Payment Disbursement Submission ──────────────────────────────────────────

  const handleOpenPayment = (bill: PayableBill) => {
    setPaymentModalBill(bill);
    setPaymentAmount(bill.outstandingAmount.toFixed(2));
    setPaymentMode("BANK");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentReference("");
    setPaymentNotes(`Payment for ${bill.billNumber}`);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalBill) return;

    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid disbursement amount");
      return;
    }

    if (amount > paymentModalBill.outstandingAmount + 0.01) {
      toast.error(`Disbursement amount cannot exceed outstanding balance (${fmtINR(paymentModalBill.outstandingAmount)})`);
      return;
    }

    setRecordingPayment(true);
    try {
      if (paymentModalBill.vendorId) {
        await vendorsApi.recordPayment(paymentModalBill.vendorId, {
          amount,
          note: paymentNotes || `Supplier payment for ${paymentModalBill.billNumber}`,
          accountId: paymentAccountId || (accountsList[0]?.id || accountsList[0]?._id),
          paymentMode,
          referenceId: paymentModalBill.id,
          vendorInvoiceId: paymentModalBill.id,
          transactionRef: paymentReference,
          date: paymentDate
        });
      } else {
        await accountingApi.recordPayment({
          vendorId: paymentModalBill.vendorId,
          billId: paymentModalBill.id,
          amount,
          paymentMode,
          paymentDate,
          reference: paymentReference,
          notes: paymentNotes,
          type: "OUTFLOW",
          direction: "OUT",
          status: "PAID"
        });
      }

      toast.success(`Disbursement of ${fmtINR(amount)} recorded successfully`);
      setPaymentModalBill(null);
      fetchPayables();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to record payment disbursement");
    } finally {
      setRecordingPayment(false);
    }
  };

  // ── Export CSV ───────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (filteredPayables.length === 0) {
      toast.error("No payables to export");
      return;
    }

    const headers = [
      "Bill / PO Number",
      "Supplier Name",
      "Phone",
      "Email",
      "Bill Date",
      "Due Date",
      "Bill Amount",
      "Paid Amount",
      "Outstanding Balance",
      "Status",
      "Days Overdue"
    ];

    const rows = filteredPayables.map(b => [
      `"${b.billNumber.replace(/"/g, '""')}"`,
      `"${b.vendorName.replace(/"/g, '""')}"`,
      `"${b.vendorPhone.replace(/"/g, '""')}"`,
      `"${b.vendorEmail.replace(/"/g, '""')}"`,
      `"${formatDate(b.billDate)}"`,
      `"${formatDate(b.dueDate)}"`,
      `"${b.totalAmount.toFixed(2)}"`,
      `"${b.paidAmount.toFixed(2)}"`,
      `"${b.outstandingAmount.toFixed(2)}"`,
      `"${b.status}"`,
      `"${b.daysOverdue}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Accounts_Payable_Ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Accounts payable ledger exported to CSV");
  };

  const handlePrint = () => {
    window.print();
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setSelectedVendorId("ALL");
    setAgingFilter("ALL");
    setDatePreset("All Time");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "ALL" || selectedVendorId !== "ALL" || agingFilter !== "ALL" || datePreset !== "All Time";

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 bg-gray-50 dark:bg-background min-h-screen text-gray-800 dark:text-slate-100 animate-in fade-in duration-300 w-full min-w-0">

      {/* ── Top Header Toolbar ── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
            <CreditCard size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
              Accounts Payable
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Supplier bills, purchase liabilities, aging schedules, and payout management
            </p>
          </div>
        </div>

        {/* View Mode & Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between lg:justify-end min-w-0">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("BILLS")}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "BILLS"
                  ? "bg-white dark:bg-card text-rose-600 dark:text-rose-400 shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              By Bills
            </button>
            <button
              onClick={() => setViewMode("VENDORS")}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "VENDORS"
                  ? "bg-white dark:bg-card text-rose-600 dark:text-rose-400 shadow-2xs"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              By Supplier
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
              onClick={fetchPayables}
              title="Refresh Ledger"
              className="p-2 sm:p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={15} className={clsx(loading && "animate-spin text-rose-600")} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Interactive KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 w-full min-w-0">
        {/* Total Outstanding Payables */}
        <div
          onClick={() => setStatusFilter(statusFilter === "UNPAID" ? "ALL" : "UNPAID")}
          className={clsx(
            "rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer shadow-2xs relative overflow-hidden",
            statusFilter === "UNPAID" || statusFilter === "ALL"
              ? "bg-slate-900 text-white border-slate-800"
              : "bg-white dark:bg-card border-gray-200 dark:border-white/5 text-gray-900 dark:text-white hover:border-rose-500/50"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={clsx("text-[11px] font-bold uppercase tracking-wider", statusFilter === "UNPAID" || statusFilter === "ALL" ? "text-slate-400" : "text-gray-500 dark:text-slate-400")}>
              Total Payables
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <CreditCard size={16} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight mt-2">
            {fmtINR(kpis.totalOutstanding)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-[11px] font-medium text-slate-400">
            <span>Pending supplier liabilities</span>
          </div>
        </div>

        {/* Overdue Payables */}
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
              Overdue Payables
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertCircle size={16} />
            </div>
          </div>
          <p className={clsx("text-xl sm:text-2xl font-black font-mono tracking-tight mt-2", statusFilter === "OVERDUE" ? "text-white" : "text-rose-600 dark:text-rose-400")}>
            {fmtINR(kpis.totalOverdue)}
          </p>
          <div className={clsx("flex items-center gap-1 mt-2 text-[11px] font-semibold", statusFilter === "OVERDUE" ? "text-white/80" : "text-rose-600 dark:text-rose-400")}>
            <span>Past supplier credit terms</span>
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
            <span>Upcoming payout obligations</span>
          </div>
        </div>

        {/* Total Paid */}
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
              Total Disbursed
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className={clsx("text-xl sm:text-2xl font-black font-mono tracking-tight mt-2", statusFilter === "PAID" ? "text-white" : "text-emerald-600 dark:text-emerald-400")}>
            {fmtINR(kpis.totalPaid)}
          </p>
          <div className={clsx("flex items-center gap-1 mt-2 text-[11px] font-semibold", statusFilter === "PAID" ? "text-white/80" : "text-emerald-600 dark:text-emerald-400")}>
            <span>Settled vendor disbursements</span>
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
              placeholder="Search bill, supplier, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:border-rose-500"
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
            {/* Vendor Dropdown */}
            <div className="relative shrink-0">
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-rose-500 max-w-[170px] truncate"
              >
                <option value="ALL">All Suppliers</option>
                {vendorsList.map((v: any) => (
                  <option key={v.id || v._id} value={v.id || v._id}>
                    {v.name}
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
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-rose-500"
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
                className="appearance-none pl-3 pr-8 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-700 dark:text-slate-200 outline-none cursor-pointer focus:border-rose-500"
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

        {/* Status Filter Tabs */}
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
                    ? "bg-rose-600 text-white shadow-2xs"
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

      {/* ── Main Data View: Bills or Vendors ── */}
      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 animate-pulse">
            Auditing accounts payable and supplier credit schedules...
          </p>
        </div>
      ) : viewMode === "BILLS" ? (
        /* ── BILLS VIEW ── */
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-2xs w-full min-w-0">
          <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
              Supplier Bills &amp; Liabilities Ledger ({filteredPayables.length})
            </span>
            <span className="text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
              Total Outstanding: {fmtINR(filteredPayables.reduce((s, b) => s + b.outstandingAmount, 0))}
            </span>
          </div>

          {/* Desktop / Tablet Table */}
          <div className="hidden md:block overflow-x-auto custom-scrollbar w-full max-w-full">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/5 bg-gray-50/75 dark:bg-white/[0.02] text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  <th className="px-4 sm:px-6 py-3">Bill / PO &amp; Date</th>
                  <th className="px-4 sm:px-6 py-3">Supplier / Vendor</th>
                  <th className="px-4 sm:px-6 py-3">Due Date &amp; Aging</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Bill Amount</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Paid Amount</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Outstanding</th>
                  <th className="px-4 sm:px-6 py-3 text-center">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                {filteredPayables.length > 0 ? (
                  filteredPayables.map((bill) => (
                    <tr key={bill.id} className="hover:bg-rose-50/20 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 sm:px-6 py-3.5">
                        <p className="font-bold text-gray-900 dark:text-white font-mono">{bill.billNumber}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono mt-0.5">
                          {formatDate(bill.billDate)}
                        </p>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5">
                        <p className="font-semibold text-gray-800 dark:text-slate-100">{bill.vendorName}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{bill.vendorPhone}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5">
                        <p className={clsx("font-bold font-mono", bill.status === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-gray-700 dark:text-slate-300")}>
                          {formatDate(bill.dueDate)}
                        </p>
                        {bill.daysOverdue > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                            {bill.daysOverdue} days overdue
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 dark:text-slate-500">On schedule</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right font-mono font-semibold text-gray-900 dark:text-white">
                        {fmtINR(bill.totalAmount)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {fmtINR(bill.paidAmount)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                        <span className={bill.outstandingAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {fmtINR(bill.outstandingAmount)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-center">
                        <span
                          className={clsx(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            bill.status === "PAID"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                              : bill.status === "OVERDUE"
                              ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                              : bill.status === "PARTIAL"
                              ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                              : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                          )}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedBill(bill)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                          {bill.outstandingAmount > 0.01 && (
                            <button
                              onClick={() => handleOpenPayment(bill)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1"
                            >
                              <IndianRupee size={12} />
                              <span>Pay</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-gray-400 dark:text-slate-500">
                      <CreditCard size={32} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                      <p className="font-semibold text-xs sm:text-sm">No payables matching the selected criteria</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (< 768px) */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-white/5">
            {filteredPayables.length > 0 ? (
              filteredPayables.map((bill) => (
                <div key={bill.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{bill.vendorName}</p>
                      <p className="font-mono text-xs font-bold text-gray-500 dark:text-slate-400 mt-0.5">{bill.billNumber}</p>
                    </div>
                    <span
                      className={clsx(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0",
                        bill.status === "PAID"
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200"
                          : bill.status === "OVERDUE"
                          ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200"
                          : bill.status === "PARTIAL"
                          ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200"
                          : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200"
                      )}
                    >
                      {bill.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-white/[0.02] p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400">Due Date</span>
                      <p className={clsx("font-mono font-bold mt-0.5", bill.status === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-gray-800 dark:text-slate-200")}>
                        {formatDate(bill.dueDate)}
                      </p>
                      {bill.daysOverdue > 0 && (
                        <p className="text-[10px] text-rose-500 font-semibold">{bill.daysOverdue} days overdue</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Outstanding</span>
                      <p className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400 mt-0.5">
                        {fmtINR(bill.outstandingAmount)}
                      </p>
                      <p className="text-[10px] text-gray-400">Bill Total: {fmtINR(bill.totalAmount)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setSelectedBill(bill)}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-card hover:bg-gray-50 cursor-pointer"
                    >
                      View Details
                    </button>
                    {bill.outstandingAmount > 0.01 && (
                      <button
                        onClick={() => handleOpenPayment(bill)}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <IndianRupee size={13} />
                        <span>Make Payment</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-400 dark:text-slate-500">
                <CreditCard size={28} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                <p className="font-semibold text-xs">No payables found</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── VENDOR AGGREGATION VIEW ── */
        <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-2xs w-full min-w-0">
          <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">
              Supplier Accounts Summary ({vendorSummaries.length})
            </span>
            <span className="text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
              Total Outstanding: {fmtINR(vendorSummaries.reduce((s, v) => s + v.totalOutstanding, 0))}
            </span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {vendorSummaries.length > 0 ? (
              vendorSummaries.map((vend) => (
                <div key={vend.vendorId || vend.vendorName} className="p-4 sm:p-5 hover:bg-rose-50/20 dark:hover:bg-white/[0.02] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-3 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
                      <Building2 size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{vend.vendorName}</h3>
                        {vend.overdueCount > 0 && (
                          <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full text-[10px] font-bold">
                            {vend.overdueCount} Overdue
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-1 flex-wrap">
                        {vend.phone !== "—" && (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={12} /> {vend.phone}
                          </span>
                        )}
                        <span>•</span>
                        <span>{vend.billCount} Total Purchase Bills</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 dark:border-white/5">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-bold uppercase text-gray-400">Total Outstanding</span>
                      <p className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                        {fmtINR(vend.totalOutstanding)}
                      </p>
                      <p className="text-[10px] text-gray-400">Paid: {fmtINR(vend.totalPaid)}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedVendorId(vend.vendorId || vend.vendorName);
                        setViewMode("BILLS");
                      }}
                      className="px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-gray-200 dark:border-white/10 transition-all cursor-pointer inline-flex items-center gap-1 shrink-0"
                    >
                      <span>View Bills</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-gray-400 dark:text-slate-500">
                <Building2 size={32} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                <p className="font-semibold text-xs sm:text-sm">No suppliers matching active filters</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bill Details Modal ── */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{selectedBill.billNumber}</h3>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">Purchase Bill Details &amp; Liability Summary</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Vendor Info Card */}
              <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 rounded-xl p-3.5 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Supplier / Vendor</span>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedBill.vendorName}</p>
                <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400 pt-1">
                  <span>Phone: {selectedBill.vendorPhone}</span>
                  <span>•</span>
                  <span>Email: {selectedBill.vendorEmail}</span>
                </div>
              </div>

              {/* Financial Balance Summary */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
                  <span className="text-[10px] font-bold uppercase text-gray-400">Bill Total</span>
                  <p className="text-sm font-bold font-mono text-gray-900 dark:text-white mt-1">
                    {fmtINR(selectedBill.totalAmount)}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Paid Amount</span>
                  <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {fmtINR(selectedBill.paidAmount)}
                  </p>
                </div>
                <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
                  <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">Outstanding</span>
                  <p className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                    {fmtINR(selectedBill.outstandingAmount)}
                  </p>
                </div>
              </div>

              {/* Schedule Dates */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-white/5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Bill Date</span>
                  <p className="font-mono font-semibold text-gray-800 dark:text-slate-200 mt-0.5">{formatDate(selectedBill.billDate)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Due Date</span>
                  <p className={clsx("font-mono font-bold mt-0.5", selectedBill.status === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-gray-800 dark:text-slate-200")}>
                    {formatDate(selectedBill.dueDate)}
                  </p>
                  {selectedBill.daysOverdue > 0 && (
                    <p className="text-[10px] text-rose-500 font-bold">{selectedBill.daysOverdue} days overdue</p>
                  )}
                </div>
              </div>

              {/* Items List */}
              {selectedBill.items && selectedBill.items.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Purchased Items</span>
                  <div className="border border-gray-100 dark:border-white/5 rounded-xl divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
                    {selectedBill.items.map((item: any, idx: number) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-slate-200">{item.name || item.itemName || `Item #${idx + 1}`}</p>
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
                onClick={() => setSelectedBill(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Close
              </button>
              {selectedBill.outstandingAmount > 0.01 && (
                <button
                  onClick={() => {
                    const bill = selectedBill;
                    setSelectedBill(null);
                    handleOpenPayment(bill);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <IndianRupee size={14} />
                  <span>Make Payment</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Disbursement Modal ── */}
      {paymentModalBill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <form onSubmit={handleRecordPayment} className="bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg">
                  <IndianRupee size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Make Supplier Payment</h3>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500">Record payout disbursement for {paymentModalBill.billNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalBill(null)}
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
                  <p className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{fmtINR(paymentModalBill.outstandingAmount)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-gray-400">Supplier</span>
                  <p className="font-semibold text-gray-800 dark:text-slate-200 mt-0.5 truncate max-w-[140px]">{paymentModalBill.vendorName}</p>
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
                  max={paymentModalBill.outstandingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-mono font-bold text-gray-900 dark:text-white outline-none focus:border-rose-500"
                />
              </div>

              {/* Account Selection */}
              {accountsList.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                    Paid From Account
                  </label>
                  <div className="relative">
                    <select
                      value={paymentAccountId}
                      onChange={(e) => setPaymentAccountId(e.target.value)}
                      className="w-full appearance-none px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold text-gray-800 dark:text-white outline-none cursor-pointer focus:border-rose-500"
                    >
                      {accountsList.map((acc: any) => (
                        <option key={acc.id || acc._id} value={acc.id || acc._id}>
                          {acc.name} ({acc.type}) — Balance: {fmtINR(acc.balance || 0)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Payment Mode */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                  Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {["BANK", "CASH", "UPI", "CHEQUE"].map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setPaymentMode(mode)}
                      className={clsx(
                        "py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        paymentMode === mode
                          ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
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
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-rose-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">Ref / Cheque #</label>
                  <input
                    type="text"
                    placeholder="e.g. CHQ-98765"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">Notes</label>
                <input
                  type="text"
                  placeholder="Optional disbursement notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#13151f] border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-white/5 flex items-center justify-end gap-2 bg-gray-50/50 dark:bg-white/[0.01]">
              <button
                type="button"
                onClick={() => setPaymentModalBill(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recordingPayment}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {recordingPayment ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Confirm Payout</span>
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
