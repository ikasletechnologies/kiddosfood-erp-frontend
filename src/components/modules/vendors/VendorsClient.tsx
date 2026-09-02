"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Plus, Search, Edit2, History,
  Wallet, CheckCircle2, FileText, Download,
  Phone, Mail, ShieldCheck, Zap,
  Package, Store, Settings2,
  Calendar, Loader2,
  Printer, MoreVertical, ChevronDown, ChevronLeft, X,
  Upload, Eye, Copy, ExternalLink, RefreshCw, MapPin
} from "lucide-react";
import { clsx } from "clsx";

import api, { vendorsApi, accountsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import AddPartyModal from "@/components/modals/AddPartyModal";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const VENDOR_STATUS = [
  { value: "ACTIVE", label: "Active", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-400/10", border: "border-emerald-200 dark:border-emerald-400/20" },
  { value: "BLOCKED", label: "Blocked", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-400/10", border: "border-amber-200 dark:border-amber-400/20" },
  { value: "BLACKLISTED", label: "Blacklisted", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-400/10", border: "border-rose-200 dark:border-rose-400/20" },
];

export default function VendorsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");
  const newParam = searchParams.get("new");
  const returnToParam = searchParams.get("returnTo");

  const { user } = useAuth();
  const { showToast } = useToast();

  // -- State --
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "TO_PAY" | "TO_RECEIVE">("ALL");

  useEffect(() => {
    if (actionParam === "new" || newParam === "true") {
      setEditing(null);
      setShowForm(true);
    }
  }, [actionParam, newParam]);

  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'OVERVIEW' | 'LEDGER' | 'MATERIALS'>('OVERVIEW');

  const [selectedVendorDetail, setSelectedVendorDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [aging, setAging] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  // Table Filters State
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const [isNumberFilterOpen, setIsNumberFilterOpen] = useState(false);
  const [numberFilter, setNumberFilter] = useState({ category: 'Contains', value: '' });

  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState({ category: 'Equal To', value: '', endDate: '' });

  const [isBalanceFilterOpen, setIsBalanceFilterOpen] = useState(false);
  const [balanceFilter, setBalanceFilter] = useState({ category: 'Equal To', value: '', endValue: '' });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [openLedgerRowMenuId, setOpenLedgerRowMenuId] = useState<string | null>(null);
  const [ledgerDetailEntry, setLedgerDetailEntry] = useState<any>(null);

  // Excel Import
  const importFileRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ name: string; contact: string; email: string; gstNumber: string; category: string; creditLimit: string; paymentTerms: string; error?: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  // Advanced Filters State
  const [isLedgerFilterPanelOpen, setIsLedgerFilterPanelOpen] = useState(false);
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("ALL");
  const [ledgerFromDate, setLedgerFromDate] = useState("");
  const [ledgerToDate, setLedgerToDate] = useState("");
  const [ledgerMinAmount, setLedgerMinAmount] = useState("");
  const [ledgerMaxAmount, setLedgerMaxAmount] = useState("");
  const [ledgerBalanceType, setLedgerBalanceType] = useState("ALL");

  // Print & Export Dropdown States
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.filter-popover-container')) {
        setIsTypeFilterOpen(false);
        setIsNumberFilterOpen(false);
        setIsDateFilterOpen(false);
        setIsBalanceFilterOpen(false);
        setIsMoreMenuOpen(false);
        setIsPrintDropdownOpen(false);
        setIsExportDropdownOpen(false);
        setOpenLedgerRowMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [settings, setSettings] = useState({
    enablePaymentReminder: false,
    reminderDays: "1"
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const formatReferenceType = (refType: string) => {
    if (refType === 'PAYMENT') return 'Payment Out';
    if (refType === 'PURCHASE') return 'Purchase';
    if (refType === 'OPENING_BALANCE') return 'Opening Balance';
    if (refType === 'RETURN' || refType === 'PURCHASE_RETURN') return 'Purchase Return';
    if (refType === 'ADVANCE') return 'Advance Payment';
    if (refType === 'ADJUSTMENT') return 'Adjustment';
    return refType;
  };

  const transactionTypes = [
    "Purchase Return", "Purchase", "Payment Out", "Opening Balance", "Credit Note",
    "Debit Note", "Sale Order", "Purchase Order", "Payment-In", "Payment-Out", "Estimate",
    "Proforma Invoice", "Delivery Challan", "Receivable Opening Balance",
    "Payable Opening Balance", "Party to Party [Received]",
    "Party to Party [Paid]", "Sale FA", "Sale FA (e-Invoice)",
    "Purchase FA", "Sale[Cancelled]", "Job work out (Challan)",
    "Purchase (Job work)", "Journal Entry"
  ];

  // -- Modals --
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [nextPaymentNumber, setNextPaymentNumber] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    note: "",
    type: "PAYMENT" as "PAYMENT" | "ADVANCE",
    accountId: "",
    paymentMode: "CASH",
    transactionRef: "",
    vendorInvoiceId: "",
    date: toLocalDateStr(new Date())
  });
  const [vendorInvoices, setVendorInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  const paymentIdempotencyKeyRef = useRef("");
  useEffect(() => {
    if (showPaymentModal) {
      paymentIdempotencyKeyRef.current = `vendor-pay-${selectedVendorId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, [showPaymentModal, selectedVendorId]);

  // -- Data Fetching --
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, sRes, aRes] = await Promise.allSettled([
        vendorsApi.getAll(),
        vendorsApi.getSummary(),
        accountsApi.getAll()
      ]);

      if (vRes.status === 'fulfilled') {
        const data = vRes.value.data || [];
        setVendors(data);
        if (!selectedVendorId && data.length > 0) {
          // On desktop, auto-select first vendor. On mobile, let user pick.
          if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            setSelectedVendorId(data[0].id);
          }
        }
      }
      if (sRes.status === 'fulfilled') setSummary(sRes.value.data);
      if (aRes.status === 'fulfilled') {
        const accs = aRes.value.data || [];
        setAccounts(accs);
      }
    } catch (e) {
      showToast("Sync Error: Failed to fetch vendor records", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedVendorId, showToast]);

  const fetchVendorDetails = useCallback(async (vendorId: string) => {
    setDetailLoading(true);
    setLedgerLoading(true);
    try {
      const [lRes, dRes, aRes] = await Promise.all([
        vendorsApi.getLedger(vendorId),
        vendorsApi.getById(vendorId),
        vendorsApi.getAging(vendorId)
      ]);

      setLedger(lRes.data || []);
      setSelectedVendorDetail(dRes.data);
      setAging(aRes.data || { current: 0, thirtySixty: 0, sixtyNinety: 0, overNinety: 0 });
    } catch (e) {
      showToast("Failed to fetch vendor ledger", "error");
    } finally {
      setDetailLoading(false);
      setLedgerLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (selectedVendorId) fetchVendorDetails(selectedVendorId); }, [selectedVendorId, fetchVendorDetails]);

  // -- Filtered Vendors List --
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchSearch =
        !search.trim() ||
        v.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.vendorCode?.toLowerCase().includes(search.toLowerCase()) ||
        v.contact?.toLowerCase().includes(search.toLowerCase()) ||
        v.phone?.toLowerCase().includes(search.toLowerCase()) ||
        v.email?.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      const bal = Number(v.balance) || Number(v.closingBalance) || Number(v.openingBalance) || 0;

      if (statusFilter === "ACTIVE") return v.status === "ACTIVE";
      if (statusFilter === "TO_PAY") return bal > 0;
      if (statusFilter === "TO_RECEIVE") return bal < 0;

      return true;
    });
  }, [vendors, search, statusFilter]);

  const selectedVendor = useMemo(() => vendors.find(v => v.id === selectedVendorId) || null, [vendors, selectedVendorId]);

  // -- Ledger Filtering, Totals, Print & Export --
  const filteredLedger = useMemo(() => {
    let result = [...ledger];

    // 1. Search Query
    if (ledgerSearchQuery.trim()) {
      const q = ledgerSearchQuery.toLowerCase().trim();
      result = result.filter(e => {
        const matchTxId = e.id?.toLowerCase().includes(q);
        const matchRefId = e.referenceId?.toLowerCase().includes(q);
        const matchNote = e.note?.toLowerCase().includes(q);
        const matchAmount = String(e.amount).includes(q);
        const matchVendor = selectedVendorDetail?.name?.toLowerCase().includes(q);
        return matchTxId || matchRefId || matchNote || matchAmount || matchVendor;
      });
    }

    // 2. Transaction Type
    if (ledgerTypeFilter !== "ALL") {
      result = result.filter(e => e.referenceType === ledgerTypeFilter);
    }

    // 3. Date Range
    if (ledgerFromDate) {
      const from = new Date(ledgerFromDate);
      from.setHours(0,0,0,0);
      result = result.filter(e => new Date(e.createdAt) >= from);
    }
    if (ledgerToDate) {
      const to = new Date(ledgerToDate);
      to.setHours(23,59,59,999);
      result = result.filter(e => new Date(e.createdAt) <= to);
    }

    // 4. Amount Range
    if (ledgerMinAmount) {
      result = result.filter(e => e.amount >= Number(ledgerMinAmount));
    }
    if (ledgerMaxAmount) {
      result = result.filter(e => e.amount <= Number(ledgerMaxAmount));
    }

    // 5. Balance Type
    if (ledgerBalanceType !== "ALL") {
      result = result.filter(e => e.type === ledgerBalanceType);
    }

    // 6. Inline Type Filter
    if (selectedTypes.length > 0) {
      result = result.filter(e => {
        const cleanRefType = formatReferenceType(e.referenceType);
        return selectedTypes.includes(cleanRefType);
      });
    }

    // 7. Inline Ref No Filter
    if (numberFilter.value.trim()) {
      const val = numberFilter.value.toLowerCase().trim();
      result = result.filter(e => {
        const refId = (e.referenceId || '').toLowerCase();
        return numberFilter.category === 'Exact match' ? refId === val : refId.includes(val);
      });
    }

    // 8. Inline Date Filter
    if (dateFilter.value) {
      const targetDate = new Date(dateFilter.value);
      targetDate.setHours(0,0,0,0);
      if (dateFilter.category === 'Range' && dateFilter.endDate) {
        const end = new Date(dateFilter.endDate);
        end.setHours(23,59,59,999);
        result = result.filter(e => {
          const d = new Date(e.createdAt);
          return d >= targetDate && d <= end;
        });
      } else if (dateFilter.category === 'Greater Than') {
        result = result.filter(e => new Date(e.createdAt) > targetDate);
      } else if (dateFilter.category === 'Less Than') {
        result = result.filter(e => new Date(e.createdAt) < targetDate);
      } else {
        result = result.filter(e => {
          const d = new Date(e.createdAt);
          return d.getFullYear() === targetDate.getFullYear() && d.getMonth() === targetDate.getMonth() && d.getDate() === targetDate.getDate();
        });
      }
    }

    // 9. Inline Balance Filter
    if (balanceFilter.value) {
      const val = Number(balanceFilter.value);
      result = result.filter(e => {
        const balance = e.runningBalance || e.balanceAfterTransaction || 0;
        const absBal = Math.abs(balance);
        if (balanceFilter.category === 'Range' && balanceFilter.endValue) {
          const end = Number(balanceFilter.endValue);
          return absBal >= val && absBal <= end;
        } else if (balanceFilter.category === 'Greater Than') {
          return absBal > val;
        } else if (balanceFilter.category === 'Less Than') {
          return absBal < val;
        } else {
          return absBal === val;
        }
      });
    }

    return result;
  }, [ledger, ledgerSearchQuery, ledgerTypeFilter, ledgerFromDate, ledgerToDate, ledgerMinAmount, ledgerMaxAmount, ledgerBalanceType, selectedVendorDetail, selectedTypes, numberFilter, dateFilter, balanceFilter]);

  const ledgerTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const e of filteredLedger) {
      if (e.type === 'DEBIT') totalDebit += e.amount;
      if (e.type === 'CREDIT') totalCredit += e.amount;
    }
    const closingBalance = totalCredit - totalDebit;
    return { totalDebit, totalCredit, closingBalance };
  }, [filteredLedger]);

  const handlePrintLedger = (range: 'all' | 'filtered') => {
    if (!selectedVendorDetail) return;
    
    const targetData = range === 'all' ? ledger : filteredLedger;
    if (targetData.length === 0) {
      showToast("No transactions found to print.", "error");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast("Pop-up blocked. Please allow pop-ups to print.", "error");
      return;
    }

    let printDebitTotal = 0;
    let printCreditTotal = 0;
    for (const e of targetData) {
      if (e.type === 'DEBIT') printDebitTotal += e.amount;
      if (e.type === 'CREDIT') printCreditTotal += e.amount;
    }

    const rowsHtml = [...targetData].reverse().map(e => {
      const balance = e.runningBalance || e.balanceAfterTransaction || 0;
      const refNo = e.returnNumber || e.paymentNumber || e.referenceId || '—';
      return `
        <tr>
          <td>${formatDate(e.createdAt)}</td>
          <td>${formatReferenceType(e.referenceType)}</td>
          <td>${refNo}</td>
          <td>${e.note || '—'}</td>
          <td style="text-align: right; color: #dc2626;">${e.type === 'DEBIT' ? '₹ ' + Math.round(e.amount).toLocaleString() : '₹ 0'}</td>
          <td style="text-align: right; color: #16a34a;">${e.type === 'CREDIT' ? '₹ ' + Math.round(e.amount).toLocaleString() : '₹ 0'}</td>
          <td style="text-align: right; font-weight: bold;">₹ ${Math.abs(Math.round(balance)).toLocaleString()} ${balance >= 0 ? 'Cr' : 'Dr'}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vendor Statement - ${selectedVendorDetail.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 30px; font-size: 12px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f97316; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: bold; color: #f97316; margin: 0; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
            td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
            .total-row td { font-weight: bold; background: #f8fafc; border-top: 2px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">VENDOR STATEMENT</h1>
              <p style="margin: 4px 0; color: #64748b;">${selectedVendorDetail.name}</p>
              <p style="margin: 2px 0; color: #64748b;">Vendor Code: ${selectedVendorDetail.vendorCode || '—'} | GSTIN: ${selectedVendorDetail.gstNumber || '—'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: bold;">Date: ${formatDate(new Date())}</p>
              <p style="margin: 2px 0; color: #64748b;">Total Records: ${targetData.length}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Description</th>
                <th style="text-align: right;">Debit (₹)</th>
                <th style="text-align: right;">Credit (₹)</th>
                <th style="text-align: right;">Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="total-row">
                <td colspan="4" style="text-align: right;">Totals:</td>
                <td style="text-align: right; color: #dc2626;">₹ ${Math.round(printDebitTotal).toLocaleString()}</td>
                <td style="text-align: right; color: #16a34a;">₹ ${Math.round(printCreditTotal).toLocaleString()}</td>
                <td style="text-align: right;">₹ ${Math.abs(Math.round(printCreditTotal - printDebitTotal)).toLocaleString()} ${(printCreditTotal - printDebitTotal) >= 0 ? 'Cr' : 'Dr'}</td>
              </tr>
            </tbody>
          </table>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportLedger = (formatType: 'xlsx' | 'pdf', range: 'all' | 'filtered') => {
    if (!selectedVendorDetail) return;
    
    const targetData = range === 'all' ? ledger : filteredLedger;
    if (targetData.length === 0) {
      showToast("No data to export.", "error");
      return;
    }

    const headers = ['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'];
    
    let runningDebit = 0;
    let runningCredit = 0;
    
    const rows = [...targetData].reverse().map(e => {
      const balance = e.runningBalance || e.balanceAfterTransaction || 0;
      const debitVal = e.type === 'DEBIT' ? Math.round(e.amount) : 0;
      const creditVal = e.type === 'CREDIT' ? Math.round(e.amount) : 0;
      const refNo = e.returnNumber || e.paymentNumber || e.referenceId || '';
      runningDebit += debitVal;
      runningCredit += creditVal;
      
      return [
        formatDate(e.createdAt),
        formatReferenceType(e.referenceType),
        refNo,
        e.note || '',
        debitVal,
        creditVal,
        `${Math.abs(Math.round(balance))} ${balance >= 0 ? 'Cr' : 'Dr'}`
      ];
    });

    rows.push([
      'Totals',
      '',
      '',
      '',
      runningDebit,
      runningCredit,
      `${Math.abs(Math.round(runningCredit - runningDebit))} ${(runningCredit - runningDebit) >= 0 ? 'Cr' : 'Dr'}`
    ]);

    const vendorCleanName = selectedVendorDetail.name.replace(/[^a-zA-Z0-9]/g, '_');
    const todayStr = new Date().toISOString().split('T')[0];
    const filename = `Vendor_Ledger_${vendorCleanName}_${todayStr}.${formatType}`;

    if (formatType === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([
        [`Vendor Transactions Ledger - ${selectedVendorDetail.name}`],
        [`Vendor Code: ${selectedVendorDetail.vendorCode || '-'} | GSTIN: ${selectedVendorDetail.gstNumber || '-'} | Date: ${formatDate(new Date())}`],
        [],
        headers,
        ...rows
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ledger");
      XLSX.writeFile(wb, filename);
      showToast("Excel file (.xlsx) downloaded successfully", "success");
      return;
    }

    if (formatType === 'pdf') {
      handlePrintLedger(range);
    }
  };

  const handleDownloadSelectedPartyReport = () => {
    const vendor = selectedVendorDetail || selectedVendor;
    if (!vendor) {
      showToast("Please select a party first.", "error");
      return;
    }
    const vendorCleanName = vendor.name.replace(/[^a-zA-Z0-9]/g, '_');
    const todayStr = new Date().toISOString().split('T')[0];
    const filename = `Party_Statement_${vendorCleanName}_${todayStr}.xlsx`;

    const targetData = ledger.length > 0 ? ledger : filteredLedger;
    const headers = ['Date', 'Transaction Type', 'Reference No.', 'Particulars / Notes', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'];
    
    let runningDebit = 0;
    let runningCredit = 0;
    
    const rows = [...targetData].reverse().map(e => {
      const balance = e.runningBalance || e.balanceAfterTransaction || 0;
      const debitVal = e.type === 'DEBIT' ? Math.round(e.amount) : 0;
      const creditVal = e.type === 'CREDIT' ? Math.round(e.amount) : 0;
      const refNo = e.returnNumber || e.paymentNumber || e.referenceId || '';
      runningDebit += debitVal;
      runningCredit += creditVal;
      
      return [
        formatDate(e.createdAt),
        formatReferenceType(e.referenceType),
        refNo,
        e.note || '',
        debitVal,
        creditVal,
        `${Math.abs(Math.round(balance))} ${(balance >= 0) ? 'Cr' : 'Dr'}`
      ];
    });

    const aoa = [
      ['PARTY STATEMENT REPORT'],
      [`Party Name: ${vendor.name}`, `Vendor Code: ${vendor.vendorCode || '-'}`],
      [`Contact: ${vendor.contact || vendor.phone || '-'}`, `Email: ${vendor.email || '-'}`],
      [`GSTIN: ${vendor.gstNumber || vendor.gstin || '-'}`, `Category: ${vendor.category || '-'}`],
      [`Generated Date: ${formatDate(new Date())}`],
      [],
      headers,
      ...rows,
      [],
      ['SUMMARY', '', '', '', 'Total Debit (₹)', 'Total Credit (₹)', 'Net Balance (₹)'],
      ['', '', '', '', runningDebit, runningCredit, `${Math.abs(Math.round(runningCredit - runningDebit))} ${(runningCredit - runningDebit >= 0) ? 'Cr' : 'Dr'}`]
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Party Statement");
    XLSX.writeFile(wb, filename);
    showToast(`Party Statement for ${vendor.name} downloaded (.xlsx)`, "success");
  };

  const handleDownloadAllPartiesReport = async () => {
    try {
      let list = vendors;
      if (!list || list.length === 0) {
        const res = await vendorsApi.getAll();
        list = res.data?.vendors || res.data || [];
      }

      if (!list || list.length === 0) {
        showToast("No party data available to download.", "error");
        return;
      }

      const headers = [
        '#', 'Vendor Code', 'Party Name', 'Contact Number', 'Email Address',
        'GST Number', 'Category', 'Payment Terms', 'Advance Credit (₹)',
        'Total Purchases (₹)', 'Balance Due (₹)', 'Status'
      ];

      let totalAdvance = 0;
      let totalPurchases = 0;
      let totalBalanceDue = 0;

      const rows = list.map((v: any, idx: number) => {
        const adv = Number(v.advanceBalance || v.advanceCredit || 0);
        const pur = Number(v.totalPurchases || 0);
        const bal = Number(v.balanceDue || v.currentBalance || 0);
        totalAdvance += adv;
        totalPurchases += pur;
        totalBalanceDue += bal;

        return [
          idx + 1,
          v.vendorCode || '-',
          v.name || '',
          v.contact || v.phone || v.mobile || '—',
          v.email || '—',
          v.gstNumber || v.gstin || '—',
          v.category || '—',
          v.paymentTerms || 'IMMEDIATE',
          adv,
          pur,
          bal,
          v.status || 'ACTIVE'
        ];
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const filename = `All_Parties_Report_${todayStr}.xlsx`;

      const aoa = [
        ['ALL PARTIES MASTER REPORT'],
        [`Generated Date: ${formatDate(new Date())}`, `Total Parties Count: ${list.length}`],
        [],
        headers,
        ...rows,
        [],
        ['TOTALS', '', '', '', '', '', '', '', totalAdvance, totalPurchases, totalBalanceDue, '']
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "All Parties");
      XLSX.writeFile(wb, filename);
      showToast("All Parties report downloaded (.xlsx)", "success");
    } catch (err) {
      console.error("Failed to download All Parties report:", err);
      showToast("Failed to download All Parties report", "error");
    }
  };

  // -- Excel Import --
  const IMPORT_TEMPLATE_HEADERS = ["Name", "Contact", "Email", "GSTIN", "Category", "Credit Limit", "Payment Terms"];

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      IMPORT_TEMPLATE_HEADERS,
      ["GreenLeaf Ingredients Pvt Ltd", "9820154321", "sales@greenleaf.com", "27AABCG1234F1Z5", "RAW_MATERIAL", "50000", "NET_30"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendors");
    XLSX.writeFile(wb, "vendor_import_template.xlsx");
  };

  const pickField = (row: Record<string, any>, ...keys: string[]) => {
    for (const key of Object.keys(row)) {
      if (keys.some(k => k.toLowerCase() === key.trim().toLowerCase())) {
        const val = row[key];
        return val === undefined || val === null ? "" : String(val).trim();
      }
    }
    return "";
  };

  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      if (rows.length === 0) {
        showToast("No rows found in the file", "error");
        return;
      }

      const parsed = rows.map(row => {
        const name = pickField(row, "name", "vendor name", "party name");
        const contact = pickField(row, "contact", "phone", "mobile", "phone number").replace(/\D/g, "");
        const rowData = {
          name,
          contact,
          email: pickField(row, "email"),
          gstNumber: pickField(row, "gstin", "gst number", "gst"),
          category: pickField(row, "category", "material category"),
          creditLimit: pickField(row, "credit limit"),
          paymentTerms: pickField(row, "payment terms") || "IMMEDIATE",
        };
        let error: string | undefined;
        if (!rowData.name) error = "Missing name";
        else if (!/^\d{10}$/.test(rowData.contact)) error = "Contact must be 10 digits";
        return { ...rowData, error };
      });

      setImportRows(parsed);
      setImportResult(null);
      setShowImportModal(true);
    } catch (err) {
      console.error(err);
      showToast("Could not read file — expected .xlsx or .csv", "error");
    }
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter(r => !r.error);
    if (validRows.length === 0) return;

    setImporting(true);
    let success = 0, failed = 0;
    for (const row of validRows) {
      try {
        await vendorsApi.create({
          name: row.name,
          contact: row.contact,
          email: row.email || undefined,
          gstNumber: row.gstNumber || undefined,
          category: row.category || undefined,
          creditLimit: row.creditLimit ? Number(row.creditLimit) : 0,
          paymentTerms: row.paymentTerms || "IMMEDIATE",
        });
        success++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    setImportResult({ success, failed });
    fetchData();
  };

  const handleSaveSettings = async () => {
    if (!selectedVendorId) return;
    setSavingSettings(true);
    try {
      await vendorsApi.update(selectedVendorId, {
        paymentReminderEnabled: settings.enablePaymentReminder,
        paymentReminderDays: Number(settings.reminderDays) || 1,
      });
      showToast("Settings saved successfully", "success");
      setIsSettingsOpen(false);
      fetchData();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // -- Payment Actions --
  const amountNum = Number(paymentForm.amount) || 0;
  const selectedAccount = accounts.find(a => a.id === paymentForm.accountId);
  const accountBalance = selectedAccount?.balance || 0;
  const vendorNetPayable = Number(selectedVendor?.totalPurchased || 0) - Number(selectedVendor?.totalPaid || 0);

  const getFilteredAccounts = () => {
    if (paymentForm.paymentMode === "CASH") {
      return accounts.filter(a => a.type === "CASH");
    } else {
      return accounts.filter(a => a.type === "BANK");
    }
  };

  const handlePaymentModeChange = (mode: string) => {
    setPaymentForm(prev => {
      const filtered = mode === "CASH"
        ? accounts.filter(a => a.type === "CASH")
        : accounts.filter(a => a.type === "BANK");
      const isStillValid = filtered.some(a => a.id === prev.accountId);
      return {
        ...prev,
        paymentMode: mode,
        accountId: isStillValid ? prev.accountId : ""
      };
    });
  };

  const handlePayment = async () => {
    const isRefRequired = paymentForm.paymentMode !== 'CASH';
    if (!selectedVendorId || !paymentForm.amount || !paymentForm.accountId) {
      showToast("Please select an account and amount", "error");
      return;
    }
    if (isRefRequired && !paymentForm.transactionRef.trim()) {
      showToast("Reference Number is required for non-cash payments", "error");
      return;
    }
    if (paymentForm.type === 'PAYMENT' && amountNum > vendorNetPayable + 0.01) {
      showToast(`Payment amount cannot exceed Net Payable of ₹${vendorNetPayable.toLocaleString()}`, "error");
      return;
    }
    if (amountNum > accountBalance) {
      showToast(`Payment amount cannot exceed Available Account Balance of ₹${accountBalance.toLocaleString()}`, "error");
      return;
    }
    setSaving(true);
    try {
      await vendorsApi.recordPayment(selectedVendorId, {
        amount: Number(paymentForm.amount),
        type: paymentForm.type === 'PAYMENT' ? 'INVOICE_LINKED' : paymentForm.type,
        note: paymentForm.note || `${paymentForm.type} Settlement`,
        accountId: paymentForm.accountId,
        vendorInvoiceId: paymentForm.vendorInvoiceId || undefined,
        paymentMode: paymentForm.paymentMode,
        transactionRef: paymentForm.transactionRef.trim() || undefined,
        idempotencyKey: paymentIdempotencyKeyRef.current
      });
      showToast("Financial settlement recorded successfully", "success");
      setShowPaymentModal(false);
      fetchData();
      fetchVendorDetails(selectedVendorId);
    } catch (e: any) {
      showToast(e.response?.data?.error || "Settlement Failed", "error");
    } finally { setSaving(false); }
  };

  const fetchVendorInvoices = async (vId: string) => {
    setLoadingInvoices(true);
    try {
      const res = await vendorsApi.getById(vId);
      const invs = res.data?.invoices || [];
      setVendorInvoices(invs.filter((i: any) => i.status !== 'PAID' && i.status !== 'CANCELLED'));
    } catch {
      setVendorInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-background text-gray-800 dark:text-slate-100 -m-3 sm:-m-4 md:-m-6 w-[calc(100%+1.5rem)] sm:w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] min-w-0">

      {/* ── Top Header / Breadcrumb Bar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 text-[#f58220] rounded-xl shrink-0">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate">
                Vendors
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                {vendors.length} Total
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
              Suppliers, material procurement ledger and financial settlements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFileSelect} />
          <button
            onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition-all whitespace-nowrap"
            title="Import Vendors from Excel"
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Import</span>
          </button>

          <button
            onClick={handleDownloadAllPartiesReport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition-all whitespace-nowrap"
            title="Export All Vendors to Excel"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#f58220] hover:bg-[#e0751a] text-white text-xs font-semibold rounded-lg shadow-sm transition-all shadow-orange-500/10 whitespace-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {/* ── Main Master-Detail Workspace ── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 w-full min-w-0 bg-white dark:bg-card border-b border-gray-200 dark:border-white/5">

        {/* ── Left Sidebar (Vendor Master List) ── */}
        <div className={clsx(
          "w-full md:w-[320px] lg:w-[360px] border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/5 flex flex-col shrink-0 bg-white dark:bg-card min-w-0",
          selectedVendorId ? "hidden md:flex" : "flex"
        )}>
          
          {/* Search Input */}
          <div className="p-3 border-b border-gray-100 dark:border-white/5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor name, code, contact..."
                className="w-full pl-9 pr-7 py-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 rounded-xl text-xs outline-none focus:border-[#F58220] text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              />
              {search && (
                <X 
                  size={14} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                  onClick={() => setSearch("")} 
                />
              )}
            </div>

            {/* Quick Filter Chips */}
            <div className="flex items-center gap-1 mt-2.5 overflow-x-auto custom-scrollbar pb-0.5">
              {[
                { id: "ALL", label: "All" },
                { id: "ACTIVE", label: "Active" },
                { id: "TO_PAY", label: "To Pay" },
                { id: "TO_RECEIVE", label: "To Receive" },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={clsx(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all",
                    statusFilter === f.id
                      ? "bg-orange-500 text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vendors List Scroll Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[300px] md:min-h-0">
            {loading ? (
              <div className="p-8 text-center space-y-3">
                <Loader2 size={24} className="animate-spin text-orange-500 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">Loading vendors...</p>
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-slate-400 dark:text-slate-500">
                <Store size={36} className="opacity-30 mb-3" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">No vendors found</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  {search ? "No vendor matches your search query." : "Add your first vendor to begin tracking orders."}
                </p>
                {!search && (
                  <button
                    onClick={() => { setEditing(null); setShowForm(true); }}
                    className="mt-4 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold transition-all shadow-2xs"
                  >
                    + Add Vendor
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredVendors.map(v => {
                  const isActive = selectedVendorId === v.id;
                  const bal = Number(v.balance) || Number(v.closingBalance) || Number(v.openingBalance) || 0;

                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVendorId(v.id)}
                      className={clsx(
                        "p-3.5 cursor-pointer transition-all flex items-center justify-between gap-3 border-l-4",
                        isActive
                          ? "border-[#f58220] bg-orange-50/70 dark:bg-orange-500/10"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-white/5 bg-white dark:bg-card"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={clsx(
                            "text-xs sm:text-sm font-semibold truncate",
                            isActive ? "text-slate-900 dark:text-white font-bold" : "text-slate-800 dark:text-slate-200"
                          )}>
                            {v.name}
                          </h3>
                          {v.vendorCode && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 shrink-0">
                              {v.vendorCode}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          <span>{v.category || "Raw Material"}</span>
                          {v.contact && <span>• {v.contact}</span>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={clsx(
                          "text-xs sm:text-sm font-bold font-mono",
                          bal > 0 ? "text-rose-600 dark:text-rose-400" : bal < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                        )}>
                          ₹ {Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                          {bal > 0 ? "To Pay" : bal < 0 ? "To Receive" : "Settled"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Workspace (Vendor Profile, Tabs & Ledger) ── */}
        <div className={clsx(
          "flex-1 flex flex-col min-w-0 bg-white dark:bg-card overflow-hidden",
          !selectedVendorId ? "hidden md:flex" : "flex"
        )}>
          {selectedVendor ? (
            <>
              {/* ── Vendor Profile Header Card ── */}
              <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-white/5 bg-white dark:bg-card">
                
                {/* Mobile Back Button */}
                <button
                  onClick={() => setSelectedVendorId(null)}
                  className="md:hidden flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 mb-3 bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 rounded-lg w-fit"
                >
                  <ChevronLeft size={16} />
                  <span>Back to Vendor List</span>
                </button>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Vendor Identity */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                        {selectedVendor.name}
                      </h2>

                      {selectedVendor.vendorCode && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {selectedVendor.vendorCode}
                        </span>
                      )}

                      <span className={clsx(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                        selectedVendor.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20"
                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-400/10 dark:text-rose-400 dark:border-rose-400/20"
                      )}>
                        {selectedVendor.status || "ACTIVE"}
                      </span>
                    </div>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      {(selectedVendorDetail?.contact || selectedVendor.contact) && (
                        <a href={`tel:${selectedVendorDetail?.contact || selectedVendor.contact}`} className="flex items-center gap-1.5 hover:text-orange-600 transition-colors">
                          <Phone size={13} className="text-slate-400" />
                          <span>{selectedVendorDetail?.contact || selectedVendor.contact}</span>
                        </a>
                      )}

                      {(selectedVendorDetail?.email || selectedVendor.email) && (
                        <a href={`mailto:${selectedVendorDetail?.email || selectedVendor.email}`} className="flex items-center gap-1.5 hover:text-orange-600 transition-colors">
                          <Mail size={13} className="text-slate-400" />
                          <span>{selectedVendorDetail?.email || selectedVendor.email}</span>
                        </a>
                      )}

                      {(selectedVendorDetail?.gstNumber || selectedVendor.gstNumber) && (
                        <div className="flex items-center gap-1.5 font-mono">
                          <ShieldCheck size={13} className="text-slate-400" />
                          <span>GSTIN: {selectedVendorDetail?.gstNumber || selectedVendor.gstNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      onClick={async () => {
                        fetchVendorInvoices(selectedVendor.id);
                        const todayStr = toLocalDateStr(new Date());
                        setPaymentForm(prev => ({ ...prev, transactionRef: '', vendorInvoiceId: '', amount: '', note: '', date: todayStr }));
                        try {
                          const res = await vendorsApi.getNextPaymentNumber(todayStr);
                          setNextPaymentNumber(res.data?.nextPaymentNumber || '');
                        } catch { setNextPaymentNumber(''); }
                        setShowPaymentModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-[#f58220] hover:bg-[#e0751a] text-white rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap"
                    >
                      <Wallet size={14} />
                      <span>Record Payment</span>
                    </button>

                    <button
                      onClick={() => { setEditing(selectedVendorDetail || selectedVendor); setShowForm(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all shadow-2xs"
                      title="Edit Vendor Details"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => {
                        setSettings({
                          enablePaymentReminder: !!selectedVendor?.paymentReminderEnabled,
                          reminderDays: String(selectedVendor?.paymentReminderDays ?? 1),
                        });
                        setIsSettingsOpen(true);
                      }}
                      className="p-2 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 rounded-lg transition-colors"
                      title="Vendor Settings"
                    >
                      <Settings2 size={16} />
                    </button>

                    <div className="relative filter-popover-container">
                      <button
                        onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                        className="p-2 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 rounded-lg transition-colors"
                        title="More Reports"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {isMoreMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 py-1 font-normal text-slate-700 dark:text-slate-300">
                          <button
                            onClick={() => {
                              setIsMoreMenuOpen(false);
                              handleDownloadSelectedPartyReport();
                            }}
                            className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <FileText size={14} className="text-orange-500" />
                            <span>Party Statement (.xlsx)</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsMoreMenuOpen(false);
                              handleDownloadAllPartiesReport();
                            }}
                            className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <FileText size={14} className="text-blue-500" />
                            <span>All Parties Report (.xlsx)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Tab Navigation ── */}
              <div className="flex gap-4 sm:gap-6 px-4 sm:px-6 border-b border-gray-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] shrink-0 overflow-x-auto custom-scrollbar">
                {[
                  { id: 'OVERVIEW', label: 'Overview' },
                  { id: 'LEDGER', label: 'Ledger (Transactions)' },
                  { id: 'MATERIALS', label: 'Material History' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTab(tab.id as any)}
                    className={clsx(
                      "text-xs font-bold uppercase tracking-wider py-3 border-b-2 transition-all whitespace-nowrap",
                      selectedTab === tab.id
                        ? "border-[#f58220] text-[#f58220]"
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Tab 1: OVERVIEW ── */}
              {selectedTab === 'OVERVIEW' && (
                <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/40 dark:bg-card">
                  {/* Financial Formula Card */}
                  <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-2xs">
                    <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                      Balance Breakdown
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-xl">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Purchases</div>
                        <div className="text-lg sm:text-xl font-bold font-mono text-slate-800 dark:text-white mt-1">
                          ₹ {Math.round(selectedVendor.totalPurchased || 0).toLocaleString()}
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-xl">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payments Made</div>
                        <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                          ₹ {Math.round(selectedVendor.totalPayments || 0).toLocaleString()}
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-xl">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {Number(selectedVendor.balance) > 0 ? "Net Payable (To Pay)" : Number(selectedVendor.balance) < 0 ? "Advance Balance" : "Net Balance"}
                        </div>
                        <div className={clsx(
                          "text-lg sm:text-xl font-bold font-mono mt-1",
                          Number(selectedVendor.balance) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        )}>
                          ₹ {Math.abs(Math.round(selectedVendor.balance || 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile Details Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                    {/* Business Identity */}
                    <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-2xs">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-orange-500" />
                        <span>Business Identity</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vendor Code</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 font-mono mt-0.5">{selectedVendorDetail?.vendorCode || selectedVendor.vendorCode || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">GSTIN</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 font-mono mt-0.5">{selectedVendorDetail?.gstNumber || selectedVendor.gstNumber || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Material Category</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedVendorDetail?.category || selectedVendor.category || "Raw Material"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Credit Period</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                            {(() => {
                              const terms = selectedVendorDetail?.paymentTerms || selectedVendor.paymentTerms;
                              if (terms === 'NET_7') return '7 Days (Net 7)';
                              if (terms === 'NET_30') return '30 Days (Net 30)';
                              if (terms === 'ADVANCE') return 'Advance Payment';
                              return 'Immediate';
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Contact & Location */}
                    <div className="bg-white dark:bg-card p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-2xs">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <MapPin size={16} className="text-orange-500" />
                        <span>Contact & Location</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedVendorDetail?.contact || selectedVendor.contact || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedVendorDetail?.email || selectedVendor.email || "—"}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billing / Registered Address</p>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                            {[
                              selectedVendorDetail?.address || selectedVendor.address,
                              selectedVendorDetail?.city || selectedVendor.city,
                              selectedVendorDetail?.state || selectedVendor.state,
                              selectedVendorDetail?.pincode || selectedVendor.pincode
                            ].filter(Boolean).join(", ") || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab 2: LEDGER (TRANSACTIONS) ── */}
              {selectedTab === 'LEDGER' && (
                <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-card overflow-hidden">
                  
                  {/* Ledger Toolbar */}
                  <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between gap-3 flex-wrap bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="relative flex-1 max-w-sm">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search transactions, reference..."
                          value={ledgerSearchQuery}
                          onChange={e => setLedgerSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-white dark:bg-card outline-none focus:border-orange-500"
                        />
                        {ledgerSearchQuery && (
                          <X size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer" onClick={() => setLedgerSearchQuery("")} />
                        )}
                      </div>

                      <select
                        value={ledgerTypeFilter}
                        onChange={e => setLedgerTypeFilter(e.target.value)}
                        className="px-2.5 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-white dark:bg-card outline-none focus:border-orange-500"
                      >
                        <option value="ALL">All Types</option>
                        <option value="PURCHASE">Purchase</option>
                        <option value="PAYMENT">Payment Out</option>
                        <option value="RETURN">Purchase Return</option>
                        <option value="OPENING_BALANCE">Opening Balance</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handlePrintLedger('filtered')}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-2xs"
                        title="Print Statement"
                      >
                        <Printer size={13} />
                        <span className="hidden sm:inline">Print</span>
                      </button>

                      <button
                        onClick={() => handleExportLedger('xlsx', 'filtered')}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-2xs"
                        title="Export Excel"
                      >
                        <Download size={13} />
                        <span className="hidden sm:inline">Excel</span>
                      </button>
                    </div>
                  </div>

                  {/* Transactions Table Container */}
                  <div className="flex-1 overflow-auto custom-scrollbar p-3 sm:p-4">
                    <div className="w-full overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/10">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Reference No</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 text-right">Debit (₹)</th>
                            <th className="px-4 py-3 text-right">Credit (₹)</th>
                            <th className="px-4 py-3 text-right">Balance (₹)</th>
                            <th className="w-8 px-2 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                          {ledgerLoading ? (
                            <tr>
                              <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                                <Loader2 size={20} className="animate-spin text-orange-500 mx-auto mb-2" />
                                Loading transactions...
                              </td>
                            </tr>
                          ) : filteredLedger.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                                No transactions found for this vendor.
                              </td>
                            </tr>
                          ) : (
                            filteredLedger.map(e => {
                              const balance = e.runningBalance || e.balanceAfterTransaction || 0;
                              const cleanRefType = formatReferenceType(e.referenceType);
                              const refNo = e.returnNumber || e.paymentNumber || e.referenceId || "—";

                              return (
                                <tr key={e.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                                    <span className={clsx(
                                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                      e.referenceType === 'PURCHASE' ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400" :
                                      e.referenceType === 'PAYMENT' ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" :
                                      "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
                                    )}>
                                      {cleanRefType}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                                    {refNo}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                    {formatDate(e.createdAt)}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                                    {e.note || "—"}
                                  </td>
                                  <td className="px-4 py-3 font-semibold font-mono text-rose-600 dark:text-rose-400 text-right">
                                    {e.type === 'DEBIT' ? `₹ ${Math.round(e.amount).toLocaleString()}` : '₹ 0'}
                                  </td>
                                  <td className="px-4 py-3 font-semibold font-mono text-emerald-600 dark:text-emerald-400 text-right">
                                    {e.type === 'CREDIT' ? `₹ ${Math.round(e.amount).toLocaleString()}` : '₹ 0'}
                                  </td>
                                  <td className="px-4 py-3 font-bold font-mono text-slate-800 dark:text-white text-right">
                                    ₹ {Math.abs(Math.round(balance)).toLocaleString()} {balance >= 0 ? 'Cr' : 'Dr'}
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <button
                                      onClick={() => setLedgerDetailEntry(e)}
                                      className="text-slate-400 hover:text-slate-600 p-1"
                                      title="View Details"
                                    >
                                      <Eye size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-slate-900/50 font-bold border-t border-slate-200 dark:border-white/5 sticky bottom-0 text-xs">
                          <tr>
                            <td colSpan={4} className="px-4 py-3 text-right uppercase tracking-wider text-slate-500">
                              Totals:
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-rose-600 dark:text-rose-400">
                              ₹ {Math.round(ledgerTotals.totalDebit).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                              ₹ {Math.round(ledgerTotals.totalCredit).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">
                              ₹ {Math.abs(Math.round(ledgerTotals.closingBalance)).toLocaleString()} {ledgerTotals.closingBalance >= 0 ? 'Cr' : 'Dr'}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab 3: MATERIAL HISTORY ── */}
              {selectedTab === 'MATERIALS' && (
                <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/40 dark:bg-card custom-scrollbar">
                  <div className="w-full overflow-x-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-card">
                    <table className="w-full text-left border-collapse min-w-[650px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-3">Material Name</th>
                          <th className="px-4 py-3">SKU / Code</th>
                          <th className="px-4 py-3">Unit</th>
                          <th className="px-4 py-3 text-right">Supplied Qty</th>
                          <th className="px-4 py-3 text-right">Vendor Price</th>
                          <th className="px-4 py-3 text-right">Total Amount</th>
                          <th className="px-4 py-3 text-right">Last Supplied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                        {selectedVendorDetail?.suppliedMaterials?.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                              No raw materials linked to this vendor yet.
                            </td>
                          </tr>
                        ) : (
                          selectedVendorDetail?.suppliedMaterials?.map((m: any) => {
                            const unitStr = m.material?.unit || "g";
                            const qty = m.totalQuantity !== undefined ? m.totalQuantity : (m.quantity || 0);
                            const price = Number(m.price || m.material?.costPrice || 0);
                            const totalAmt = Number(m.totalAmount !== undefined ? m.totalAmount : (qty * price));

                            return (
                              <tr key={m.id || m.materialId} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{m.material?.name || "—"}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{m.material?.sku || "—"}</td>
                                <td className="px-4 py-3 text-slate-500 font-medium">{unitStr}</td>
                                <td className="px-4 py-3 font-semibold font-mono text-slate-700 dark:text-slate-300 text-right">
                                  {qty} {unitStr}
                                </td>
                                <td className="px-4 py-3 font-semibold font-mono text-slate-800 dark:text-white text-right">
                                  ₹ {price.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 font-bold font-mono text-slate-900 dark:text-white text-right">
                                  ₹ {totalAmt.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-slate-400 text-right">{formatDate(m.lastUpdated)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/40 dark:bg-card">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4">
                <Store size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Select a Vendor</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6">
                Choose a vendor from the list to view their financial profile, ledger statements, and transaction history.
              </p>
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>Add New Vendor</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <AddPartyModal
        isOpen={showForm}
        partyType="vendor"
        onClose={() => {
          setShowForm(false);
          if (returnToParam && (actionParam === "new" || newParam === "true")) {
            router.push(returnToParam);
          }
        }}
        onSave={async (data) => {
          try {
            let savedVendor: any;
            if (editing) {
              const res = await vendorsApi.update(editing.id, data);
              savedVendor = res.data;
            } else {
              const res = await vendorsApi.create(data);
              savedVendor = res.data;
            }
            showToast(editing ? "Vendor profile updated successfully" : "New vendor registered successfully", "success");
            setShowForm(false);

            if (returnToParam) {
              const vendorId = savedVendor?.id || savedVendor?.vendor?.id;
              const targetUrl = vendorId
                ? `${returnToParam}${returnToParam.includes('?') ? '&' : '?'}vendorId=${vendorId}`
                : returnToParam;
              router.push(targetUrl);
            } else {
              fetchData();
              if (savedVendor?.id) setSelectedVendorId(savedVendor.id);
            }
          } catch (e: any) {
            const err = e.response?.data?.error || e.response?.data?.message || "";
            if (err.toLowerCase().includes("gst") && (err.toLowerCase().includes("exist") || err.toLowerCase().includes("duplicate") || err.toLowerCase().includes("unique"))) {
              showToast("GST Number already exists", "error");
            } else {
              showToast(err || "Failed to save vendor", "error");
            }
            throw e;
          }
        }}
        initialData={editing}
        title={editing ? "EDIT VENDOR" : "ADD VENDOR"}
      />

      {/* Import from Excel Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); setImportRows([]); setImportResult(null); }}
        title="Import Vendors from Excel"
        size="lg"
        footer={
          importResult ? (
            <button
              onClick={() => { setShowImportModal(false); setImportRows([]); setImportResult(null); }}
              className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors"
            >
              Done
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowImportModal(false); setImportRows([]); }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing || importRows.filter(r => !r.error).length === 0}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                {importing ? "Importing…" : `Import ${importRows.filter(r => !r.error).length} Vendors`}
              </button>
            </div>
          )
        }
      >
        {importResult ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-slate-800">{importResult.success} vendors imported successfully</p>
            {importResult.failed > 0 && (
              <p className="text-xs text-rose-500">{importResult.failed} rows failed due to validation errors.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <p className="text-slate-500">
                {importRows.length} rows found ({importRows.filter(r => !r.error).length} valid).
              </p>
              <button onClick={handleDownloadTemplate} className="text-orange-600 font-semibold hover:underline flex items-center gap-1">
                <Download size={12} /> Download Template
              </button>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-[40vh]">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-slate-500">Name</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-500">Contact</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-500">Email</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-500">GSTIN</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importRows.map((row, i) => (
                    <tr key={i} className={clsx(row.error && "bg-rose-50/50")}>
                      <td className="px-3 py-1.5 font-medium">{row.name || "—"}</td>
                      <td className="px-3 py-1.5">{row.contact || "—"}</td>
                      <td className="px-3 py-1.5">{row.email || "—"}</td>
                      <td className="px-3 py-1.5 font-mono">{row.gstNumber || "—"}</td>
                      <td className="px-3 py-1.5">
                        {row.error ? <span className="text-rose-500 font-semibold">{row.error}</span> : <span className="text-emerald-600 font-semibold">Valid</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Transaction Details Modal */}
      <Modal
        isOpen={!!ledgerDetailEntry}
        onClose={() => setLedgerDetailEntry(null)}
        title="Transaction Details"
        size="sm"
        footer={
          <button
            onClick={() => setLedgerDetailEntry(null)}
            className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors"
          >
            Close
          </button>
        }
      >
        {ledgerDetailEntry && (
          <div className="space-y-2.5 text-xs">
            {[
              { label: "Type", value: formatReferenceType(ledgerDetailEntry.referenceType) },
              { label: "Reference", value: ledgerDetailEntry.returnNumber || ledgerDetailEntry.paymentNumber || ledgerDetailEntry.referenceId || "—" },
              { label: "Date", value: new Date(ledgerDetailEntry.createdAt).toLocaleString() },
              { label: "Debit", value: ledgerDetailEntry.type === 'DEBIT' ? `₹ ${Math.round(ledgerDetailEntry.amount).toLocaleString()}` : "—" },
              { label: "Credit", value: ledgerDetailEntry.type === 'CREDIT' ? `₹ ${Math.round(ledgerDetailEntry.amount).toLocaleString()}` : "—" },
              { label: "Balance After", value: `₹ ${Math.abs(Math.round(ledgerDetailEntry.runningBalance || ledgerDetailEntry.balanceAfterTransaction || 0)).toLocaleString()} ${(ledgerDetailEntry.runningBalance || ledgerDetailEntry.balanceAfterTransaction || 0) >= 0 ? 'Cr' : 'Dr'}` },
              { label: "Note", value: ledgerDetailEntry.note || "—" },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 py-1 border-b border-slate-50 dark:border-white/5 last:border-0">
                <span className="font-bold text-slate-400 uppercase tracking-wider shrink-0">{row.label}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#13151f] rounded-2xl shadow-xl w-full max-w-2xl flex flex-col border border-slate-200 dark:border-white/10 max-h-[92vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 dark:border-white/10 shrink-0">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-gray-800 dark:text-white">Record Payment</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{selectedVendor?.name}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 custom-scrollbar space-y-4">
              <div className="p-1 bg-gray-100 dark:bg-white/5 rounded-lg flex border border-gray-200 dark:border-white/10">
                <button
                  onClick={() => setPaymentForm({ ...paymentForm, type: 'PAYMENT' })}
                  className={clsx("flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors", paymentForm.type === 'PAYMENT' ? "bg-white dark:bg-white/10 text-[#f58220] shadow-sm" : "text-gray-500")}
                >
                  Pay Due
                </button>
                <button
                  onClick={() => setPaymentForm({ ...paymentForm, type: 'ADVANCE' })}
                  className={clsx("flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors", paymentForm.type === 'ADVANCE' ? "bg-white dark:bg-white/10 text-indigo-600 shadow-sm" : "text-gray-500")}
                >
                  Advance
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400">Payment Amount *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-gray-400">₹</span>
                  <input
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value.replace(/[^0-9.]/g, '') })}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 text-lg font-bold text-gray-800 dark:text-white bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:border-[#f58220]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Debit Account *</label>
                  <select
                    value={paymentForm.accountId}
                    onChange={e => setPaymentForm({ ...paymentForm, accountId: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium outline-none focus:border-[#f58220]"
                  >
                    <option value="">Select Account</option>
                    {getFilteredAccounts().map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type}) — ₹{a.balance.toLocaleString()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Payment Mode</label>
                  <select
                    value={paymentForm.paymentMode}
                    onChange={e => handlePaymentModeChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium outline-none focus:border-[#f58220]"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Date</label>
                  <input
                    type="date"
                    value={paymentForm.date}
                    onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium outline-none focus:border-[#f58220]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">
                    Reference / UTR {paymentForm.paymentMode !== 'CASH' && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    value={paymentForm.transactionRef}
                    onChange={e => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })}
                    placeholder="e.g. UTR / Txn Ref"
                    className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium outline-none focus:border-[#f58220]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 block">Notes / Remarks</label>
                <input
                  value={paymentForm.note}
                  onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  placeholder="e.g. Settlement for Raw Materials"
                  className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium outline-none focus:border-[#f58220]"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-white/10 shrink-0 bg-gray-50 dark:bg-[#0e1017]">
              <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handlePayment}
                disabled={saving || !amountNum || !paymentForm.accountId}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
              >
                {saving ? "Processing…" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Party Settings Drawer */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex justify-end backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-[#13151f] h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-white/10 animate-in slide-in-from-right">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200 dark:border-white/10 shrink-0">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Vendor Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enablePaymentReminder}
                  onChange={(e) => setSettings({ ...settings, enablePaymentReminder: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Enable payment reminders</span>
              </label>

              {settings.enablePaymentReminder && (
                <div className="pl-7 space-y-1.5">
                  <span className="text-[11px] text-slate-400">Remind X days before payment is due</span>
                  <input
                    type="number"
                    min={1}
                    value={settings.reminderDays}
                    onChange={(e) => setSettings({ ...settings, reminderDays: e.target.value })}
                    className="w-20 px-3 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
              >
                {savingSettings ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
