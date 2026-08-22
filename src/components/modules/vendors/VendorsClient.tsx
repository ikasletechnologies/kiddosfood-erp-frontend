"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Plus, Search,
  Edit2, Trash2,
  AlertCircle, History,
  TrendingUp, Wallet,
  CheckCircle2, FileText, Download,
  Phone, Mail, ShieldCheck, Zap, ArrowRight,
  Package, Truck, Receipt, LayoutDashboard, Settings2,
  AlertTriangle, Star, Calendar, FileCheck, Loader2,
  Printer, MoreVertical, Filter, ChevronDown, MessageSquare, Clock, X,
  Upload, FileSpreadsheet, Eye, Copy, ExternalLink
} from "lucide-react";
import { clsx } from "clsx";

import api, { vendorsApi, accountsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import AddPartyModal from "@/components/modals/AddPartyModal";
import { Modal } from "@/components/ui/Modal";



// Local YYYY-MM-DD — never use toISOString() for "today", it renders in UTC and
// silently shifts the date by a day whenever the local timezone has a non-zero offset.
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
  const { user } = useAuth();
  const { showToast } = useToast();

  // -- State --
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ all: true, active: false, inactive: false, toReceive: false, toPay: false });
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'OVERVIEW' | 'POS' | 'GRNS' | 'MATERIALS' | 'INVOICES' | 'LEDGER'>('OVERVIEW');

  const [selectedVendorDetail, setSelectedVendorDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [aging, setAging] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const [isNumberFilterOpen, setIsNumberFilterOpen] = useState(false);
  const [numberFilter, setNumberFilter] = useState({ category: 'Contains', value: '' });

  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState({ category: 'Equal To', value: '', endDate: '' });

  const [isTotalFilterOpen, setIsTotalFilterOpen] = useState(false);
  
  const [isTransactionSearchOpen, setIsTransactionSearchOpen] = useState(false);
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  
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
        setIsFilterOpen(false);
        setIsTypeFilterOpen(false);
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
  const [totalFilter, setTotalFilter] = useState({ category: 'Equal To', value: '', endValue: '' });

  const [isBalanceFilterOpen, setIsBalanceFilterOpen] = useState(false);
  const [balanceFilter, setBalanceFilter] = useState({ category: 'Equal To', value: '', endValue: '' });

  const transactionTypes = [
    "Sale", "Sale (e-Invoice)", "Purchase", "Credit Note",
    "Credit Note (e-Invoice)", "Debit Note", "Sale Order",
    "Purchase Order", "Payment-In", "Payment-Out", "Estimate",
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
  // One key per "opened this payment modal" — reused across retries within
  // that same session so a double-click or a slow/retried request can't
  // post the same settlement twice.
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
        if (!selectedVendorId && data.length > 0) setSelectedVendorId(data[0].id);
      }
      if (sRes.status === 'fulfilled') setSummary(sRes.value.data);
      if (aRes.status === 'fulfilled') {
        const accs = aRes.value.data || [];
        setAccounts(accs);
        if (accs.length > 0) {
          setPaymentForm(prev => ({ ...prev, accountId: prev.accountId || accs[0].id }));
        }
      }
    } catch (e) {
      showToast("Sync Error: Financial nodes unreachable", "error");
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
      showToast("Sync Error: Connection to node lost", "error");
    } finally {
      setDetailLoading(false);
      setLedgerLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (selectedVendorId) fetchVendorDetails(selectedVendorId); }, [selectedVendorId, fetchVendorDetails]);

  // -- Filtered Lists --
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchSearch = v.name?.toLowerCase().includes(search.toLowerCase()) || v.vendorCode?.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      if (filters.all) return true;

      const checkStatus = filters.active || filters.inactive;
      let statusMatch = true;
      if (checkStatus) {
        statusMatch = (filters.active && v.status === 'ACTIVE') || (filters.inactive && v.status !== 'ACTIVE');
      }

      const bal = Number(v.balance) || Number(v.closingBalance) || Number(v.openingBalance) || 0;
      const checkBalance = filters.toReceive || filters.toPay;
      let balanceMatch = true;
      if (checkBalance) {
        balanceMatch = (filters.toPay && bal > 0) || (filters.toReceive && bal < 0);
      }

      if (!checkStatus && !checkBalance) return false;

      return statusMatch && balanceMatch;
    });
  }, [vendors, search, filters]);

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

    // 2. Transaction Type (Advanced Filter Panel)
    if (ledgerTypeFilter !== "ALL") {
      result = result.filter(e => e.referenceType === ledgerTypeFilter);
    }

    // 3. Date Range (Advanced Filter Panel)
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

    // 4. Amount Range (Advanced Filter Panel)
    if (ledgerMinAmount) {
      result = result.filter(e => e.amount >= Number(ledgerMinAmount));
    }
    if (ledgerMaxAmount) {
      result = result.filter(e => e.amount <= Number(ledgerMaxAmount));
    }

    // 5. Balance Type (Advanced Filter Panel)
    if (ledgerBalanceType !== "ALL") {
      result = result.filter(e => e.type === ledgerBalanceType);
    }

    // 6. Inline Type Filter (from table header popover)
    if (selectedTypes.length > 0) {
      result = result.filter(e => {
        const cleanRefType = e.referenceType === 'PAYMENT' ? 'Payment Out' : e.referenceType === 'PURCHASE' ? 'Purchase' : e.referenceType === 'OPENING_BALANCE' ? 'Opening Balance' : e.referenceType;
        return selectedTypes.includes(cleanRefType);
      });
    }

    // 7. Inline Ref No Filter (from table header popover)
    if (numberFilter.value.trim()) {
      const val = numberFilter.value.toLowerCase().trim();
      result = result.filter(e => {
        const refId = (e.referenceId || '').toLowerCase();
        return numberFilter.category === 'Exact match' ? refId === val : refId.includes(val);
      });
    }

    // 8. Inline Date Filter (from table header popover)
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

    // 9. Inline Balance Filter (from table header popover)
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

    const fromDateStr = ledgerFromDate && range === 'filtered' ? new Date(ledgerFromDate).toLocaleDateString() : 'All Dates';
    const toDateStr = ledgerToDate && range === 'filtered' ? new Date(ledgerToDate).toLocaleDateString() : 'Present';

    let printDebitTotal = 0;
    let printCreditTotal = 0;
    for (const e of targetData) {
      if (e.type === 'DEBIT') printDebitTotal += e.amount;
      if (e.type === 'CREDIT') printCreditTotal += e.amount;
    }
    const printClosingBalance = printCreditTotal - printDebitTotal;

    const rowsHtml = [...targetData].reverse().map(e => {
      const balance = e.runningBalance || e.balanceAfterTransaction || 0;
      return `
        <tr>
          <td>${new Date(e.createdAt).toLocaleDateString()}</td>
          <td>${e.referenceType === 'PAYMENT' ? 'Payment Out' : e.referenceType === 'PURCHASE' ? 'Purchase' : e.referenceType === 'OPENING_BALANCE' ? 'Opening Balance' : e.referenceType}</td>
          <td>${e.referenceId || '—'}</td>
          <td>${e.note || '—'}</td>
          <td class="text-right color-debit">${e.type === 'DEBIT' ? '₹ ' + Math.round(e.amount).toLocaleString() : '₹ 0'}</td>
          <td class="text-right color-credit">${e.type === 'CREDIT' ? '₹ ' + Math.round(e.amount).toLocaleString() : '₹ 0'}</td>
          <td class="text-right">₹ ${Math.abs(Math.round(balance)).toLocaleString()} ${balance >= 0 ? 'Cr' : 'Dr'}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Vendor Ledger - ${selectedVendorDetail.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 40px; line-height: 1.4; }
            .header-container { display: flex; justify-content: space-between; border-bottom: 2px solid #f97316; padding-bottom: 10px; margin-bottom: 20px; }
            .company-info h1 { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
            .company-info p { margin: 2px 0; font-size: 11px; color: #64748b; }
            .title-info { text-align: right; }
            .title-info h2 { margin: 0; font-size: 20px; font-weight: 700; color: #f97316; }
            .title-info p { margin: 2px 0; font-size: 11px; color: #64748b; }
            
            .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; font-size: 13px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .meta-grid div p { margin: 4px 0; }
            .meta-grid div p strong { color: #0f172a; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 8px; font-weight: 700; text-align: left; color: #475569; }
            td { border: 1px solid #cbd5e1; padding: 8px; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            
            .text-right { text-align: right; }
            .color-debit { color: #ef4444; font-weight: 600; }
            .color-credit { color: #10b981; font-weight: 600; }

            .footer-summary { display: flex; justify-content: flex-end; margin-top: 20px; }
            .summary-table { width: 320px; font-size: 13px; font-weight: bold; border-collapse: collapse; }
            .summary-table td { padding: 6px 12px; border: none; }
            .summary-table tr.total-border { border-top: 1.5px solid #cbd5e1; border-bottom: 3.5px double #0f172a; }
            
            @media print {
              body { margin: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="company-info">
              <h1>Acme Industrial Corporation</h1>
              <p>Industrial Zone, Phase 1, New Delhi - 110020</p>
              <p>Email: accounts@acmeindustrial.com | Tel: +91 11 4567 8900</p>
            </div>
            <div class="title-info">
              <h2>VENDOR LEDGER</h2>
              <p>Printed On: ${new Date().toLocaleString()}</p>
              <p>Printed By: Administrator</p>
            </div>
          </div>
          
          <div class="meta-grid">
            <div>
              <p><strong>Vendor Name:</strong> ${selectedVendorDetail.name}</p>
              <p><strong>Vendor Code:</strong> ${selectedVendorDetail.vendorCode || '—'}</p>
              <p><strong>GSTIN:</strong> ${selectedVendorDetail.gstNumber || '—'}</p>
            </div>
            <div>
              <p><strong>Period:</strong> ${fromDateStr} to ${toDateStr}</p>
              <p><strong>Contact:</strong> ${selectedVendorDetail.contact || '—'}</p>
              <p><strong>Outstanding Balance:</strong> ₹ ${Math.abs(Math.round(printClosingBalance)).toLocaleString()} ${printClosingBalance >= 0 ? 'Cr' : 'Dr'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Description</th>
                <th style="text-align: right;">Debit</th>
                <th style="text-align: right;">Credit</th>
                <th style="text-align: right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer-summary">
            <table class="summary-table">
              <tr>
                <td>Total Debit:</td>
                <td style="text-align: right; color: #ef4444;">₹ ${Math.round(printDebitTotal).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Total Credit:</td>
                <td style="text-align: right; color: #10b981;">₹ ${Math.round(printCreditTotal).toLocaleString()}</td>
              </tr>
              <tr class="total-border">
                <td>Closing Balance:</td>
                <td style="text-align: right;">₹ ${Math.abs(Math.round(printClosingBalance)).toLocaleString()} ${printClosingBalance >= 0 ? 'Cr' : 'Dr'}</td>
              </tr>
            </table>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExportLedger = (format: 'csv' | 'xlsx', range: 'all' | 'filtered') => {
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
      runningDebit += debitVal;
      runningCredit += creditVal;
      
      return [
        new Date(e.createdAt).toLocaleDateString(),
        e.referenceType === 'PAYMENT' ? 'Payment Out' : e.referenceType === 'PURCHASE' ? 'Purchase' : e.referenceType === 'OPENING_BALANCE' ? 'Opening Balance' : e.referenceType,
        e.referenceId || '',
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

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const vendorCleanName = selectedVendorDetail.name.replace(/[^a-zA-Z0-9]/g, '_');
    const todayStr = new Date().toISOString().split('T')[0];
    const filename = `Vendor_Ledger_${vendorCleanName}_${todayStr}.${format}`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${format.toUpperCase()} successfully`, "success");
  };

  // -- Excel Import --

  const IMPORT_TEMPLATE_HEADERS = ["Name", "Contact", "Email", "GSTIN", "Category", "Credit Limit", "Payment Terms"];

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      IMPORT_TEMPLATE_HEADERS,
      ["Acme Traders", "9876543210", "acme@example.com", "27AAAAA1111A1Z1", "Raw material", "50000", "IMMEDIATE"],
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
    e.target.value = ""; // allow re-selecting the same file later
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
      showToast("Could not read that file — expected .xlsx or .csv", "error");
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
      showToast("Settings saved", "success");
      setIsSettingsOpen(false);
      fetchData();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // -- Actions --

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
      showToast("Financial settlement recorded", "success");
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
      const res = await vendorsApi.getById(vId); // Or use vendorInvoicesApi
      const invs = res.data?.invoices || [];
      setVendorInvoices(invs.filter((i: any) => i.status !== 'PAID' && i.status !== 'CANCELLED'));
    } catch (e) {
      setVendorInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const amountNum = Number(paymentForm.amount) || 0;
  const selectedAccount = accounts.find(a => a.id === paymentForm.accountId);
  const accountBalance = selectedAccount?.balance || 0;
  // Pay Due against a vendor that has no outstanding payable doesn't make sense —
  // block it rather than silently recording a payment with nothing to pay.
  const vendorNetPayable = Number(selectedVendor?.totalPurchased || 0) - Number(selectedVendor?.totalPaid || 0);
  const noPayableDue = paymentForm.type === 'PAYMENT' && vendorNetPayable <= 0;

  return (
    <div className="flex h-[calc(100vh-100px)] bg-slate-50 dark:bg-[#0b0c14] -m-4 overflow-hidden selection:bg-orange-500/30 selection:text-orange-500 transition-colors">

      {/* Sidebar */}
      <div className="w-[300px] border-r border-slate-200 flex flex-col shrink-0 bg-white relative z-10">
        
        {/* Sidebar Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-lg font-bold text-slate-800">Vendors</span>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Search & List Headers */}
        <div className="px-3 py-2 border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Vendor Name"
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-full text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-slate-700"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 relative filter-popover-container">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <span className="text-[12px] font-bold text-slate-500">Vendor Name</span>
              <Filter size={12} className="text-orange-500" />
            </div>

            {/* Filter Popover */}
            {isFilterOpen && (
              <div className="absolute top-full left-4 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-3">
                <div className="space-y-2 mb-3">
                  {[
                    { id: "all", label: "All" },
                    { id: "active", label: "Active" },
                    { id: "inactive", label: "Inactive" },
                    { id: "toReceive", label: "To Receive" },
                    { id: "toPay", label: "To Pay" },
                  ].map((f) => (
                    <label key={f.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={(filters as any)[f.id]}
                          onChange={(e) => setFilters({...filters, [f.id]: e.target.checked, all: f.id === 'all' ? e.target.checked : false})}
                          className="peer appearance-none w-4 h-4 rounded border border-slate-300 checked:bg-orange-500 checked:border-orange-500 cursor-pointer transition-colors" 
                        />
                        <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <span className="text-xs font-medium text-slate-700">{f.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <button 
                    onClick={() => { setFilters({ all: true, active: false, inactive: false, toReceive: false, toPay: false }); setIsFilterOpen(false); }}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-full transition-colors"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-1.5 cursor-pointer relative">
              <span className="text-[12px] font-bold text-slate-500">Amount</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-6 text-center text-xs font-semibold text-slate-400 animate-pulse">Loading vendors...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <ShieldCheck size={32} className="opacity-10 mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-[0.1em]">No vendors found</p>
            </div>
          ) : (
            filteredVendors.map(v => {
              const isActive = selectedVendorId === v.id;
              const bal = Number(v.balance) || Number(v.closingBalance) || Number(v.openingBalance) || 0;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVendorId(v.id)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-slate-50 transition-colors ${
                    isActive ? "bg-[#e6f4fc]" : "hover:bg-slate-50 bg-white"
                  }`}
                >
                  <span className="text-sm text-slate-800 truncate pr-2">{v.name}</span>
                  <div className="flex flex-col items-end shrink-0">
                    <span className={`text-sm font-semibold ${
                      bal > 0 ? "text-rose-500" : bal < 0 ? "text-emerald-500" : "text-slate-400"
                    }`}>
                      {bal === 0 ? "0.00" : Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {bal !== 0 && (
                      <span className="text-[9px] font-bold uppercase text-slate-400 -mt-0.5">
                        {bal > 0 ? "To Pay" : "To Receive"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white dark:bg-[#0b0c14]">
        {selectedVendor ? (
          <>
            {/* Party Details Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#0b0c14]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">{selectedVendor.name}</h2>
                  <button onClick={() => { setEditing(selectedVendor); setShowForm(true); }} className="text-orange-500 hover:text-orange-600 transition-colors">
                    <Edit2 size={16} />
                  </button>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold">
                  {selectedVendor.vendorCode || "V-NEW"}
                </span>
              </div>
              <div className="flex items-center gap-4">
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
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Wallet size={14} /> Record Payment
                </button>
                <div className="flex items-center gap-2 text-slate-400">
                  <button
                    onClick={() => {
                      setSettings({
                        enablePaymentReminder: !!selectedVendor?.paymentReminderEnabled,
                        reminderDays: String(selectedVendor?.paymentReminderDays ?? 1),
                      });
                      setIsSettingsOpen(true);
                    }}
                    className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  ><Settings2 size={18} /></button>
                  <div className="relative filter-popover-container">
                    <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><MoreVertical size={18} /></button>
                    <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFileSelect} />
                    {/* More Options Menu */}
                    {isMoreMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 dark:border-white/5 z-50 py-1.5">
                        <button
                          onClick={() => { setIsMoreMenuOpen(false); importFileRef.current?.click(); }}
                          className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <Upload size={14} className="text-emerald-500" /> Import from Excel
                        </button>
                        <button
                          onClick={() => { setIsMoreMenuOpen(false); router.push(`/reports?report=${encodeURIComponent('Party Statement')}`); }}
                          className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <FileText size={14} className="text-blue-500" /> Party Statement (Report)
                        </button>
                        <button
                          onClick={() => { setIsMoreMenuOpen(false); router.push(`/reports?report=${encodeURIComponent('All parties')}`); }}
                          className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <FileText size={14} className="text-indigo-500" /> All Parties (Report)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Selection */}
            <div className="flex gap-6 px-6 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#0b0c14] shrink-0">
              {[
                { id: 'OVERVIEW', label: 'Overview' },
                { id: 'LEDGER', label: 'Ledger (Transactions)' },
                { id: 'MATERIALS', label: 'Material History' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as any)}
                  className={clsx(
                    "text-xs font-bold uppercase tracking-wider pb-3 pt-3 border-b-2 transition-all",
                    selectedTab === tab.id ? "border-orange-500 text-orange-600" : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {selectedTab === 'OVERVIEW' && (
              <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/50 dark:bg-[#0b0c14]">
                {/* Financial Formula Card */}
                <div className="bg-white dark:bg-card p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Balance Formula</h4>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* 1. Total Purchases */}
                    <div>
                      <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
                        ₹ {Math.round(selectedVendor.totalPurchased || 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Total Purchases</p>
                    </div>

                    <div className="text-2xl text-slate-300 font-light hidden md:block">-</div>

                    {/* 2. To Pay */}
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
                        ₹ {Math.round(Math.abs(selectedVendor.balance || 0)).toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 text-center">
                        {Number(selectedVendor.balance) > 0 ? "To Pay" : Number(selectedVendor.balance) < 0 ? "Advance Credit" : "To Pay"}
                      </p>
                    </div>

                    <div className="text-2xl text-slate-300 font-light hidden md:block">=</div>

                    {/* 3. Payments Made */}
                    <div>
                      <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
                        ₹ {Math.round(selectedVendor.totalPayments || 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Payments Made</p>
                    </div>
                  </div>
                </div>

                {/* Profile Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Business Identity */}
                  <div className="bg-white dark:bg-card p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-4">Business Identity</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Vendor Code</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedVendorDetail?.vendorCode || selectedVendor.vendorCode || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">GSTIN</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedVendorDetail?.gstNumber || selectedVendor.gstNumber || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Material Category</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedVendorDetail?.category || selectedVendor.category || "General Supplier"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Credit Period</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {(() => {
                            const terms = selectedVendorDetail?.paymentTerms || selectedVendor.paymentTerms;
                            if (terms === 'NET_7') return '7 Days';
                            if (terms === 'NET_30') return '30 Days';
                            if (terms === 'ADVANCE') return 'Advance Payment';
                            return 'Immediate';
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact & Location */}
                  <div className="bg-white dark:bg-card p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-4">Contact &amp; Location</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Phone Number</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedVendorDetail?.contact || selectedVendor.contact || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Address</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedVendorDetail?.email || selectedVendor.email || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Registered Address</p>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{selectedVendorDetail?.address || selectedVendor.address || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">City and Pincode</p>
                        {(selectedVendorDetail?.city || selectedVendor.city || selectedVendorDetail?.pincode || selectedVendor.pincode) ? (
                          <span className="inline-block text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 rounded-lg">
                            {[selectedVendorDetail?.city || selectedVendor.city, selectedVendorDetail?.pincode || selectedVendor.pincode].filter(Boolean).join(', ')}
                          </span>
                        ) : (
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">—</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'LEDGER' && (
              <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0b0c14]">
                {/* Section Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-white/5 relative z-30">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-white">Transactions Ledger</h3>
                  <div className="flex items-center gap-4 text-slate-400">
                    {/* Search / Advanced Filter Toggle */}
                    <button 
                      onClick={() => setIsLedgerFilterPanelOpen(!isLedgerFilterPanelOpen)} 
                      className={`transition-colors p-1 rounded-lg ${isLedgerFilterPanelOpen ? 'bg-orange-500/10 text-orange-500' : 'hover:text-slate-600 dark:hover:text-slate-200'}`}
                      title="Advanced Filters & Search"
                    >
                      <Search size={16} />
                    </button>
                    
                    {/* Print Dropdown */}
                    <div className="relative filter-popover-container">
                      <button 
                        onClick={() => { setIsPrintDropdownOpen(!isPrintDropdownOpen); setIsExportDropdownOpen(false); }} 
                        className={`transition-colors p-1 rounded-lg ${isPrintDropdownOpen ? 'bg-orange-500/10 text-orange-500' : 'hover:text-slate-600 dark:hover:text-slate-200'}`}
                        title="Print Ledger"
                      >
                        <Printer size={16} />
                      </button>
                      {isPrintDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 py-1 font-normal text-slate-700 dark:text-slate-300">
                          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-white/5">
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Print Options</span>
                          </div>
                          <button onClick={() => { handlePrintLedger('filtered'); setIsPrintDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 text-xs flex items-center gap-2">
                            <span>Print Filtered Results</span>
                          </button>
                          <button onClick={() => { handlePrintLedger('all'); setIsPrintDropdownOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 text-xs flex items-center gap-2">
                            <span>Print All Transactions</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Export Dropdown */}
                    <div className="relative filter-popover-container">
                      <button 
                        onClick={() => { setIsExportDropdownOpen(!isExportDropdownOpen); setIsPrintDropdownOpen(false); }} 
                        className={`transition-colors p-1 rounded-lg text-emerald-600 ${isExportDropdownOpen ? 'bg-emerald-500/10' : 'hover:text-emerald-700'}`}
                        title="Export Ledger"
                      >
                        <FileText size={16} className="opacity-80" />
                      </button>
                      {isExportDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 py-1 font-normal text-slate-700 dark:text-slate-300">
                          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-white/5">
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Export Options</span>
                          </div>
                          
                          {/* Filtered options */}
                          <div className="p-1">
                            <button onClick={() => { handleExportLedger('xlsx', 'filtered'); setIsExportDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg text-xs flex items-center justify-between">
                              <span>Export Filtered to Excel</span>
                              <span className="text-[10px] text-slate-400 font-mono">.xlsx</span>
                            </button>
                            <button onClick={() => { handleExportLedger('csv', 'filtered'); setIsExportDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg text-xs flex items-center justify-between">
                              <span>Export Filtered to CSV</span>
                              <span className="text-[10px] text-slate-400 font-mono">.csv</span>
                            </button>
                            <button onClick={() => { handlePrintLedger('filtered'); setIsExportDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg text-xs flex items-center justify-between">
                              <span>Export Filtered to PDF</span>
                              <span className="text-[10px] text-slate-400 font-mono">.pdf</span>
                            </button>
                          </div>

                          <div className="border-t border-slate-100 dark:border-white/5 my-1"></div>

                          {/* All options */}
                          <div className="p-1">
                            <button onClick={() => { handleExportLedger('xlsx', 'all'); setIsExportDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg text-xs flex items-center justify-between">
                              <span>Export All to Excel</span>
                              <span className="text-[10px] text-slate-400 font-mono">.xlsx</span>
                            </button>
                            <button onClick={() => { handleExportLedger('csv', 'all'); setIsExportDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg text-xs flex items-center justify-between">
                              <span>Export All to CSV</span>
                              <span className="text-[10px] text-slate-400 font-mono">.csv</span>
                            </button>
                            <button onClick={() => { handlePrintLedger('all'); setIsExportDropdownOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg text-xs flex items-center justify-between">
                              <span>Export All to PDF</span>
                              <span className="text-[10px] text-slate-400 font-mono">.pdf</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Advanced Filter Panel */}
                {isLedgerFilterPanelOpen && (
                  <div className="px-6 py-4 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 space-y-4 relative z-20">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Search Input */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Search Query</label>
                        <input
                          type="text"
                          placeholder="Search number, description, amount..."
                          className="w-full mt-1 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 dark:bg-[#0b0c14] focus:outline-none focus:border-slate-300"
                          value={ledgerSearchQuery}
                          onChange={e => setLedgerSearchQuery(e.target.value)}
                        />
            {ledgerSearchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setLedgerSearchQuery("")} 
              />
            )}
                      </div>

                      {/* Transaction Type */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Transaction Type</label>
                        <select
                          className="w-full mt-1 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 dark:bg-[#0b0c14] focus:outline-none focus:border-slate-300"
                          value={ledgerTypeFilter}
                          onChange={e => setLedgerTypeFilter(e.target.value)}
                        >
                          <option value="ALL">All Types</option>
                          <option value="OPENING_BALANCE">Opening Balance</option>
                          <option value="PURCHASE">Purchase</option>
                          <option value="PAYMENT">Payment Out</option>
                        </select>
                      </div>

                      {/* Date Range */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">From Date</label>
                        <input
                          type="date"
                          className="w-full mt-1 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 dark:bg-[#0b0c14] focus:outline-none focus:border-slate-300"
                          value={ledgerFromDate}
                          onChange={e => setLedgerFromDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">To Date</label>
                        <input
                          type="date"
                          className="w-full mt-1 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 dark:bg-[#0b0c14] focus:outline-none focus:border-slate-300"
                          value={ledgerToDate}
                          onChange={e => setLedgerToDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Amount Range */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Min Amount</label>
                        <input
                          type="number"
                          placeholder="Min amount"
                          className="w-full mt-1 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 dark:bg-[#0b0c14] focus:outline-none focus:border-slate-300"
                          value={ledgerMinAmount}
                          onChange={e => setLedgerMinAmount(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Max Amount</label>
                        <input
                          type="number"
                          placeholder="Max amount"
                          className="w-full mt-1 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 dark:bg-[#0b0c14] focus:outline-none focus:border-slate-300"
                          value={ledgerMaxAmount}
                          onChange={e => setLedgerMaxAmount(e.target.value)}
                        />
                      </div>

                      {/* Balance Type (Debit / Credit) */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Balance Type</label>
                        <select
                          className="w-full mt-1 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 dark:bg-[#0b0c14] focus:outline-none focus:border-slate-300"
                          value={ledgerBalanceType}
                          onChange={e => setLedgerBalanceType(e.target.value)}
                        >
                          <option value="ALL">All Balances</option>
                          <option value="DEBIT">Debit Only</option>
                          <option value="CREDIT">Credit Only</option>
                        </select>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-end gap-2">
                        <button
                          onClick={() => {
                            setLedgerSearchQuery("");
                            setLedgerTypeFilter("ALL");
                            setLedgerFromDate("");
                            setLedgerToDate("");
                            setLedgerMinAmount("");
                            setLedgerMaxAmount("");
                            setLedgerBalanceType("ALL");
                            setSelectedTypes([]);
                            setNumberFilter({ category: 'Contains', value: '' });
                            setDateFilter({ category: 'Equal To', value: '', endDate: '' });
                            setBalanceFilter({ category: 'Equal To', value: '', endValue: '' });
                          }}
                          className="flex-1 py-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors"
                        >
                          Reset All
                        </button>
                        <button
                          onClick={() => setIsLedgerFilterPanelOpen(false)}
                          className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm border border-orange-500"
                        >
                          Apply / Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transactions Table */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white dark:bg-[#0b0c14] sticky top-0 z-10 border-b border-slate-200 dark:border-white/5">
                      <tr>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 dark:border-white/5 relative filter-popover-container">
                          <div className="flex items-center justify-between">
                            Type
                            <button onClick={() => setIsTypeFilterOpen(!isTypeFilterOpen)}>
                              <Filter size={14} className="text-slate-400 hover:text-slate-700" />
                            </button>
                          </div>
                          {/* Type Filter Popover */}
                          {isTypeFilterOpen && (
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-[#1a1c28] rounded-xl shadow-xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden flex flex-col font-normal text-slate-700 dark:text-slate-300 normal-case tracking-normal">
                              <div className="max-h-[240px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {transactionTypes.map(type => (
                                  <label key={type} className="flex items-start gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded cursor-pointer group">
                                    <input
                                      type="checkbox"
                                      checked={selectedTypes.includes(type)}
                                      onChange={(e) => {
                                        if (e.target.checked) setSelectedTypes([...selectedTypes, type]);
                                        else setSelectedTypes(selectedTypes.filter(t => t !== type));
                                      }}
                                      className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-rose-500 focus:ring-rose-500 cursor-pointer"
                                    />
                                    <span className="text-[11px] leading-tight group-hover:text-slate-900 dark:group-hover:text-white">{type}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="p-2 border-t border-slate-100 dark:border-white/10 flex items-center gap-2 bg-white dark:bg-[#1a1c28]">
                                <button
                                  onClick={() => { setSelectedTypes([]); setIsTypeFilterOpen(false); }}
                                  className="flex-1 py-1.5 bg-white dark:bg-white/10 border-2 border-slate-900 dark:border-white/20 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                  Clear
                                </button>
                                <button
                                  onClick={() => setIsTypeFilterOpen(false)}
                                  className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm border-2 border-orange-500"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          )}
                        </th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 dark:border-white/5 relative">
                          <div className="flex items-center justify-between">
                            Ref No
                            <button onClick={() => setIsNumberFilterOpen(!isNumberFilterOpen)}>
                              <Filter size={14} className="text-slate-400 hover:text-slate-700" />
                            </button>
                          </div>
                          {isNumberFilterOpen && (
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-[#1a1c28] rounded-xl shadow-xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden flex flex-col font-normal text-slate-700 dark:text-slate-300 normal-case tracking-normal">
                              <div className="p-3 space-y-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400">Select Category</label>
                                  <div className="relative mt-1">
                                    <select
                                      className="w-full appearance-none bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-slate-300"
                                      value={numberFilter.category}
                                      onChange={e => setNumberFilter({ ...numberFilter, category: e.target.value })}
                                    >
                                      <option>Contains</option>
                                      <option>Exact match</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400">Number</label>
                                  <input
                                    type="text"
                                    className="w-full mt-1 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 dark:bg-white/10 focus:outline-none focus:border-slate-300"
                                    value={numberFilter.value}
                                    onChange={e => setNumberFilter({ ...numberFilter, value: e.target.value })}
                                  />
                                </div>
                              </div>
                              <div className="p-2 border-t border-slate-100 dark:border-white/10 flex items-center gap-2 bg-white dark:bg-[#1a1c28]">
                                <button onClick={() => { setNumberFilter({ category: 'Contains', value: '' }); setIsNumberFilterOpen(false) }} className="flex-1 py-1.5 bg-white dark:bg-white/10 border-2 border-slate-900 dark:border-white/20 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-lg text-xs font-bold transition-colors">Clear</button>
                                <button onClick={() => setIsNumberFilterOpen(false)} className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-500 rounded-lg text-xs font-bold transition-colors shadow-sm">Apply</button>
                              </div>
                            </div>
                          )}
                        </th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 dark:border-white/5 relative">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">Date <ChevronDown size={12} className="text-slate-400" /></span>
                            <button onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}>
                              <Filter size={14} className="text-slate-400 hover:text-slate-700" />
                            </button>
                          </div>
                          {isDateFilterOpen && (
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-[#1a1c28] rounded-xl shadow-xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden flex flex-col font-normal text-slate-700 dark:text-slate-300 normal-case tracking-normal">
                              <div className="p-3 space-y-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400">Select Category</label>
                                  <div className="relative mt-1">
                                    <select
                                      className="w-full appearance-none bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-slate-300"
                                      value={dateFilter.category}
                                      onChange={e => setDateFilter({ ...dateFilter, category: e.target.value })}
                                    >
                                      <option>Equal To</option>
                                      <option>Less Than</option>
                                      <option>Greater Than</option>
                                      <option>Range</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400">{dateFilter.category === 'Range' ? 'Start Date' : 'Select Date'}</label>
                                  <div className="relative mt-1">
                                    <input
                                      type="date"
                                      className="w-full border border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-300 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                      value={dateFilter.value}
                                      onChange={e => setDateFilter({ ...dateFilter, value: e.target.value })}
                                    />
                                    <Calendar size={14} className="absolute right-2 top-1.5 text-blue-500 pointer-events-none" />
                                  </div>
                                </div>
                                {dateFilter.category === 'Range' && (
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400">End Date</label>
                                    <div className="relative mt-1">
                                      <input
                                        type="date"
                                        className="w-full border border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-300 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                        value={dateFilter.endDate}
                                        onChange={e => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                                      />
                                      <Calendar size={14} className="absolute right-2 top-1.5 text-blue-500 pointer-events-none" />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="p-2 border-t border-slate-100 dark:border-white/10 flex items-center gap-2 bg-white dark:bg-[#1a1c28]">
                                <button onClick={() => { setDateFilter({ category: 'Equal To', value: '', endDate: '' }); setIsDateFilterOpen(false) }} className="flex-1 py-1.5 bg-white dark:bg-white/10 border-2 border-slate-900 dark:border-white/20 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-lg text-xs font-bold transition-colors">Clear</button>
                                <button onClick={() => setIsDateFilterOpen(false)} className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-500 rounded-lg text-xs font-bold transition-colors shadow-sm">Apply</button>
                              </div>
                            </div>
                          )}
                        </th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 dark:border-white/5 relative">
                          Description
                        </th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 dark:border-white/5 relative text-right">
                          Debit
                        </th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 dark:border-white/5 relative text-right">
                          Credit
                        </th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 border-r border-slate-100 dark:border-white/5 relative text-right">
                          <div className="flex items-center justify-end gap-2">
                            Balance
                            <button onClick={() => setIsBalanceFilterOpen(!isBalanceFilterOpen)}>
                              <Filter size={14} className="text-slate-400 hover:text-slate-700" />
                            </button>
                          </div>
                          {isBalanceFilterOpen && (
                            <div className="absolute top-full right-0 mt-1 w-56 bg-white dark:bg-[#1a1c28] rounded-xl shadow-xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden flex flex-col font-normal text-slate-700 dark:text-slate-300 normal-case tracking-normal text-left">
                              <div className="p-3 space-y-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400">Select Category</label>
                                  <div className="relative mt-1">
                                    <select
                                      className="w-full appearance-none bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-slate-300"
                                      value={balanceFilter.category}
                                      onChange={e => setBalanceFilter({ ...balanceFilter, category: e.target.value })}
                                    >
                                      <option>Equal To</option>
                                      <option>Less Than</option>
                                      <option>Greater Than</option>
                                      <option>Range</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400">{balanceFilter.category === 'Range' ? 'Min Amount' : 'Amount'}</label>
                                  <input
                                    type="number"
                                    className="w-full mt-1 border border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-300"
                                    value={balanceFilter.value}
                                    onChange={e => setBalanceFilter({ ...balanceFilter, value: e.target.value })}
                                  />
                                </div>
                                {balanceFilter.category === 'Range' && (
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-400">Max Amount</label>
                                    <input
                                      type="number"
                                      className="w-full mt-1 border border-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-slate-300"
                                      value={balanceFilter.endValue}
                                      onChange={e => setBalanceFilter({ ...balanceFilter, endValue: e.target.value })}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="p-2 border-t border-slate-100 dark:border-white/10 flex items-center gap-2 bg-white dark:bg-[#1a1c28]">
                                <button onClick={() => { setBalanceFilter({ category: 'Equal To', value: '', endValue: '' }); setIsBalanceFilterOpen(false) }} className="flex-1 py-1.5 bg-white dark:bg-white/10 border-2 border-slate-900 dark:border-white/20 hover:bg-slate-50 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-lg text-xs font-bold transition-colors">Clear</button>
                                <button onClick={() => setIsBalanceFilterOpen(false)} className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-500 rounded-lg text-xs font-bold transition-colors shadow-sm">Apply</button>
                              </div>
                            </div>
                          )}
                        </th>
                        <th className="w-10 px-2 py-3 border-b border-slate-200 dark:border-white/5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {ledgerLoading ? (
                        <tr><td colSpan={8} className="text-center py-10 text-slate-400 font-medium">Loading...</td></tr>
                      ) : filteredLedger.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-10 text-slate-400 font-medium">No transactions found</td></tr>
                      ) : (
                        filteredLedger.map(e => {
                          const balance = e.runningBalance || e.balanceAfterTransaction || 0;
                          const cleanRefType = e.referenceType === 'PAYMENT' ? 'Payment Out' : e.referenceType === 'PURCHASE' ? 'Purchase' : e.referenceType === 'OPENING_BALANCE' ? 'Opening Balance' : e.referenceType;
                          return (
                            <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group">
                              <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">
                                {cleanRefType}
                              </td>
                              <td className="px-6 py-4 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">
                                {e.paymentNumber || e.referenceId || "—"}
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">{new Date(e.createdAt).toLocaleDateString()}</td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5">
                                <div>{e.note || "—"}</div>
                                {e.transactionRef && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Ref: {e.transactionRef}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-xs font-semibold text-red-600 dark:text-red-400 border-r border-slate-100 dark:border-white/5 text-right">
                                {e.type === 'DEBIT' ? `₹ ${Math.round(e.amount).toLocaleString()}` : '₹ 0'}
                              </td>
                              <td className="px-6 py-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-r border-slate-100 dark:border-white/5 text-right">
                                {e.type === 'CREDIT' ? `₹ ${Math.round(e.amount).toLocaleString()}` : '₹ 0'}
                              </td>
                              <td className="px-6 py-4 text-xs font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-white/5 text-right">
                                ₹ {Math.abs(Math.round(balance)).toLocaleString()} {balance >= 0 ? 'Cr' : 'Dr'}
                              </td>
                              <td className="px-2 py-4 text-center">
                                <div className="relative inline-block filter-popover-container">
                                  <button
                                    onClick={() => setOpenLedgerRowMenuId(openLedgerRowMenuId === e.id ? null : e.id)}
                                    className="text-slate-300 hover:text-slate-500"
                                  >
                                    <MoreVertical size={14} />
                                  </button>
                                  {openLedgerRowMenuId === e.id && (
                                    <div className="absolute top-full right-0 mt-1 w-52 bg-white dark:bg-[#1a1c28] rounded-xl shadow-xl border border-slate-100 dark:border-white/10 z-50 py-1.5 text-left">
                                      <button
                                        onClick={() => { setOpenLedgerRowMenuId(null); setLedgerDetailEntry(e); }}
                                        className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                                      >
                                        <Eye size={13} /> View Details
                                      </button>
                                      {(e.paymentNumber || e.referenceId) && (
                                        <button
                                          onClick={() => {
                                            setOpenLedgerRowMenuId(null);
                                            navigator.clipboard?.writeText(e.paymentNumber || e.referenceId || "");
                                            showToast("Reference copied", "success");
                                          }}
                                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                                        >
                                          <Copy size={13} /> Copy Reference ID
                                        </button>
                                      )}
                                      {e.referenceType === 'PURCHASE' && (
                                        <button
                                          onClick={() => { setOpenLedgerRowMenuId(null); router.push('/purchases/invoices'); }}
                                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                                        >
                                          <ExternalLink size={13} /> Open Purchase Bills
                                        </button>
                                      )}
                                      {(e.referenceType === 'PAYMENT' || e.referenceType === 'ADVANCE') && (
                                        <button
                                          onClick={() => { setOpenLedgerRowMenuId(null); router.push('/purchases/orders'); }}
                                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                                        >
                                          <ExternalLink size={13} /> Open Purchase Orders
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-900/50 font-bold border-t border-slate-200 dark:border-white/5 sticky bottom-0">
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-xs font-black text-slate-700 dark:text-slate-300 text-right">Totals:</td>
                        <td className="px-6 py-4 text-xs font-black text-red-600 dark:text-red-400 text-right">
                          ₹ {Math.round(ledgerTotals.totalDebit).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs font-black text-emerald-600 dark:text-emerald-400 text-right">
                          ₹ {Math.round(ledgerTotals.totalCredit).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs font-black text-slate-800 dark:text-white text-right">
                          ₹ {Math.abs(Math.round(ledgerTotals.closingBalance)).toLocaleString()} {ledgerTotals.closingBalance >= 0 ? 'Cr' : 'Dr'}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {selectedTab === 'MATERIALS' && (
              <div className="flex-1 overflow-auto p-6 bg-slate-50/50 dark:bg-[#0b0c14] custom-scrollbar">
                <div className="bg-white dark:bg-card rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500">Material Name</th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500">Item Code</th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500">Unit</th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 text-right">Vendor Price</th>
                        <th className="px-6 py-3 font-semibold text-xs text-slate-500 text-right">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {selectedVendorDetail?.suppliedMaterials?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-400 text-xs font-semibold">
                            No materials linked to this vendor yet.
                          </td>
                        </tr>
                      ) : (
                        selectedVendorDetail?.suppliedMaterials?.map((m: any) => (
                          <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-white">{m.material?.name || "—"}</td>
                            <td className="px-6 py-4 text-xs text-slate-500">{m.material?.itemCode || m.material?.id?.slice(0, 8) || "—"}</td>
                            <td className="px-6 py-4 text-xs text-slate-500">{m.material?.unit ? m.material.unit.replace(/^1\s*/, "") : "Units"}</td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-800 dark:text-white text-right">₹ {m.price || m.material?.basePrice || 0}</td>
                            <td className="px-6 py-4 text-xs text-slate-400 text-right">{m.lastUpdated ? new Date(m.lastUpdated).toLocaleDateString() : "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/30 dark:bg-[#0b0c14] relative overflow-hidden">
            {/* Decorative ambient glows */}
            <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center px-10">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-xl shadow-orange-500/30 flex items-center justify-center text-white mb-8 rotate-3">
                <Package size={32} />
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">No Suppliers Yet</h2>
              <p className="text-sm font-medium text-slate-400 mb-8 max-w-xs">Onboard your first vendor to start tracking purchase orders, GRNs, and payments.</p>
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-3 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 hover:shadow-2xl hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                <Plus size={18} strokeWidth={3} /> New Supplier
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddPartyModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSave={async (data) => {
          try {
            if (editing) await vendorsApi.update(editing.id, data);
            else await vendorsApi.create(data);
            showToast(editing ? "Vendor identity synchronized" : "New vendor registered", "success");
            setShowForm(false);
            fetchData();
          } catch (e: any) {
            showToast(e.response?.data?.error || "Transaction Aborted", "error");
            throw e;
          }
        }}
        initialData={editing}
        title={editing ? "EDIT VENDOR" : "ADD VENDOR"}
      />

      {/* Import from Excel */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); setImportRows([]); setImportResult(null); }}
        title="Import Vendors from Excel"
        size="lg"
        footer={
          importResult ? (
            <button
              onClick={() => { setShowImportModal(false); setImportRows([]); setImportResult(null); }}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={() => { setShowImportModal(false); setImportRows([]); }}
                className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing || importRows.filter(r => !r.error).length === 0}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                {importing ? "Importing…" : `Import ${importRows.filter(r => !r.error).length} Vendor${importRows.filter(r => !r.error).length === 1 ? '' : 's'}`}
              </button>
            </>
          )
        }
      >
        {importResult ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={32} />
            </div>
            <p className="text-lg font-bold text-slate-800">{importResult.success} vendor{importResult.success === 1 ? '' : 's'} imported</p>
            {importResult.failed > 0 && (
              <p className="text-sm text-rose-500 font-medium">{importResult.failed} row{importResult.failed === 1 ? '' : 's'} failed — check for duplicate names or invalid data and try again.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {importRows.length} row{importRows.length === 1 ? '' : 's'} found · {importRows.filter(r => r.error).length} with errors will be skipped.
              </p>
              <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:underline">
                <Download size={14} /> Download Template
              </button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
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
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i} className={clsx("border-t border-slate-100", row.error && "bg-rose-50/50")}>
                      <td className="px-3 py-2 font-semibold text-slate-800">{row.name || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.contact || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.email || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{row.gstNumber || "—"}</td>
                      <td className="px-3 py-2">
                        {row.error
                          ? <span className="text-rose-600 font-bold">{row.error}</span>
                          : <span className="text-emerald-600 font-bold">Ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!ledgerDetailEntry}
        onClose={() => setLedgerDetailEntry(null)}
        title="Transaction Details"
        size="sm"
        footer={
          <button
            onClick={() => setLedgerDetailEntry(null)}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors"
          >
            Close
          </button>
        }
      >
        {ledgerDetailEntry && (
          <div className="space-y-3 text-sm">
            {[
              { label: "Type", value: ledgerDetailEntry.referenceType === 'PAYMENT' ? 'Payment Out' : ledgerDetailEntry.referenceType === 'PURCHASE' ? 'Purchase' : ledgerDetailEntry.referenceType === 'OPENING_BALANCE' ? 'Opening Balance' : ledgerDetailEntry.referenceType },
              { label: "Reference", value: ledgerDetailEntry.paymentNumber || ledgerDetailEntry.referenceId || "—" },
              { label: "Date", value: new Date(ledgerDetailEntry.createdAt).toLocaleString() },
              { label: "Debit", value: ledgerDetailEntry.type === 'DEBIT' ? `₹ ${Math.round(ledgerDetailEntry.amount).toLocaleString()}` : "—" },
              { label: "Credit", value: ledgerDetailEntry.type === 'CREDIT' ? `₹ ${Math.round(ledgerDetailEntry.amount).toLocaleString()}` : "—" },
              { label: "Balance After", value: `₹ ${Math.abs(Math.round(ledgerDetailEntry.runningBalance || ledgerDetailEntry.balanceAfterTransaction || 0)).toLocaleString()} ${(ledgerDetailEntry.runningBalance || ledgerDetailEntry.balanceAfterTransaction || 0) >= 0 ? 'Cr' : 'Dr'}` },
              { label: "Note", value: ledgerDetailEntry.note || "—" },
              ...(ledgerDetailEntry.transactionRef ? [{ label: "Transaction Ref", value: ledgerDetailEntry.transactionRef }] : []),
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-50 dark:border-white/5 last:border-0">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest shrink-0">{row.label}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 text-right break-all">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col" style={{maxHeight: '92vh'}}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-800">Record Payment</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedVendor?.name}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 flex flex-col">
                <div className="space-y-3">
                  <div className="p-1 bg-gray-100 rounded-lg flex border border-gray-200">
                    <button onClick={() => setPaymentForm({ ...paymentForm, type: 'PAYMENT' })} className={clsx("flex-1 py-2 rounded-md text-xs font-semibold transition-colors", paymentForm.type === 'PAYMENT' ? "bg-white text-[#f58220] shadow-sm" : "text-gray-500")}>Pay Due</button>
                    <button onClick={() => setPaymentForm({ ...paymentForm, type: 'ADVANCE' })} className={clsx("flex-1 py-2 rounded-md text-xs font-semibold transition-colors", paymentForm.type === 'ADVANCE' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500")}>Advance</button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Transaction Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-300">₹</span>
                      <input value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="Enter amount" className="w-full pl-9 pr-4 py-3 text-xl font-bold text-gray-800 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#f58220] transition-colors placeholder:text-gray-300 placeholder:font-medium placeholder:text-base" />
                    </div>
                    {(() => {
                      const totalPurchased = Number(selectedVendor?.totalPurchased || 0);
                      const totalPaid = Number(selectedVendor?.totalPaid || 0);
                      const netPayable = totalPurchased - totalPaid;
                      const advanceCredit = Math.max(0, -netPayable);

                      if (paymentForm.type === 'PAYMENT') {
                        if (netPayable <= 0) {
                          return (
                            <p className="text-xs text-gray-500">
                              No outstanding balance.{advanceCredit > 0 && ` Vendor has ₹${Math.round(advanceCredit).toLocaleString()} advance credit.`}
                            </p>
                          );
                        }
                        return (
                          <div className="text-xs text-gray-500 space-y-0.5">
                            <p className="flex justify-between"><span>Outstanding payable</span><span className="font-semibold text-gray-700">₹{Math.round(totalPurchased).toLocaleString()}</span></p>
                            {totalPaid > 0 && <p className="flex justify-between"><span>Advance credit</span><span className="font-semibold text-gray-700">₹{Math.round(totalPaid).toLocaleString()}</span></p>}
                            <p className="flex justify-between"><span>Net payable</span><span className="font-semibold text-[#f58220]">₹{Math.round(netPayable).toLocaleString()}</span></p>
                          </div>
                        );
                      }
                      // ADVANCE tab
                      return (
                        <p className="text-xs text-gray-500">
                          {advanceCredit > 0 ? `Current advance credit: ₹${Math.round(advanceCredit).toLocaleString()}` : "No existing advance credit."}
                        </p>
                      );
                    })()}
                  </div>
                </div>

                {amountNum > 0 ? (() => {
                  const outstandingBefore = Math.max(0, selectedVendor?.balance || 0);
                  const outstandingAfter = paymentForm.type === 'PAYMENT'
                    ? Math.max(0, outstandingBefore - amountNum)
                    : outstandingBefore;
                  const advanceBefore = Math.abs(Math.min(0, selectedVendor?.balance || 0));
                  const advanceAfter = paymentForm.type === 'ADVANCE' ? advanceBefore + amountNum : advanceBefore;
                  const isOverdraft = amountNum > accountBalance;
                  return (
                    <div className={`p-4 border rounded-lg space-y-2 shrink-0 ${isOverdraft ? 'bg-rose-50 border-rose-200' : 'bg-orange-50 border-orange-100'}`}>
                      <p className={`text-xs font-semibold flex items-center gap-1.5 ${isOverdraft ? 'text-rose-600' : 'text-[#f58220]'}`}>
                        <Zap size={12} /> {isOverdraft ? '⚠ Insufficient Balance' : 'Payment Summary'}
                      </p>
                      {paymentForm.type === 'PAYMENT' ? (
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Outstanding Before</span><span className="font-semibold text-gray-700">₹{outstandingBefore.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Payment Amount</span><span className="font-semibold text-[#f58220]">− ₹{amountNum.toLocaleString()}</span></div>
                          <div className="flex justify-between border-t border-orange-200 pt-1"><span className="text-gray-500 font-medium">Outstanding After</span><span className="font-semibold text-emerald-600">₹{outstandingAfter.toLocaleString()}</span></div>
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Current Advance</span><span className="font-semibold text-gray-700">₹{advanceBefore.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">New Advance</span><span className="font-semibold text-indigo-600">+ ₹{amountNum.toLocaleString()}</span></div>
                          <div className="flex justify-between border-t border-indigo-200 pt-1"><span className="text-gray-500 font-medium">Total Advance</span><span className="font-semibold text-indigo-600">₹{advanceAfter.toLocaleString()}</span></div>
                        </div>
                      )}
                      {isOverdraft && <p className="text-xs text-rose-600 font-medium">Payment exceeds account balance by ₹{(amountNum - accountBalance).toLocaleString()}</p>}
                    </div>
                  );
                })() : (
                  <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center h-[110px] shrink-0 gap-1">
                    <Zap size={16} className="text-gray-300" />
                    <p className="text-xs text-gray-400 font-medium">Enter amount to see payment summary</p>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                {/* Transaction ID (Auto-generated, read-only) */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Transaction ID <span className="text-gray-300 font-normal">(Auto-generated · Read Only)</span></label>
                  <div className={`w-full px-3 py-2.5 border border-dashed rounded-lg text-sm font-semibold font-mono select-all transition-colors ${
                    nextPaymentNumber
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-gray-100 border-gray-300 text-gray-400 animate-pulse'
                  }`}>
                    {nextPaymentNumber || 'Generating…'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium text-gray-500">Debit From Account</label>
                    {accounts.length === 0 ? (
                      <div className="p-4 bg-rose-50 border-2 border-dashed border-rose-300 rounded-lg flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-rose-600">No bank/cash accounts available — a payment can&apos;t be recorded without one.</p>
                        <button
                          onClick={() => router.push('/banking/accounts')}
                          className="shrink-0 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors active:scale-95 flex items-center gap-1"
                        >
                          <Plus size={12} strokeWidth={3} /> Create Account
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <select value={paymentForm.accountId} onChange={e => setPaymentForm({ ...paymentForm, accountId: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 outline-none focus:border-[#f58220]">
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        {selectedAccount && (
                          <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${amountNum > accountBalance ? 'bg-rose-50 border border-rose-200 text-rose-600' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                            <span>Available Balance</span>
                            <span className="text-sm">₹{Math.round(accountBalance).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Payment Mode</label>
                    <select value={paymentForm.paymentMode} onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 outline-none focus:border-[#f58220]">
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="NEFT">NEFT</option>
                      <option value="RTGS">RTGS</option>
                      <option value="IMPS">IMPS</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">Transaction Date</label>
                    <input
                      type="date"
                      value={paymentForm.date}
                      onChange={async e => {
                        const newDate = e.target.value;
                        setPaymentForm({ ...paymentForm, date: newDate });
                        try {
                          const res = await vendorsApi.getNextPaymentNumber(newDate);
                          setNextPaymentNumber(res.data?.nextPaymentNumber || '');
                        } catch { setNextPaymentNumber(''); }
                      }}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 outline-none focus:border-[#f58220]"
                    />
                  </div>

                  {/* Reference Number - fixed label, mode-aware placeholder & required */}
                  <div className="space-y-1 col-span-2">
                    {(() => {
                      const modePlaceholder: Record<string, string> = {
                        CASH:          'Optional',
                        UPI:           'Enter UPI Reference ID (e.g. UPI987654321)',
                        BANK_TRANSFER: 'Enter UTR Number (e.g. UTR5485454)',
                        NEFT:          'Enter UTR Number (e.g. HDFC2026062600001)',
                        RTGS:          'Enter UTR Number (e.g. SBIN20260626XXXXX)',
                        IMPS:          'Enter IMPS Reference No. (e.g. IMPS987654321)',
                        CHEQUE:        'Enter Cheque Number (e.g. CHQ-001234)',
                      };
                      const isRequired = paymentForm.paymentMode !== 'CASH';
                      const isEmpty = !paymentForm.transactionRef.trim();
                      const isError = isRequired && isEmpty;
                      const placeholder = modePlaceholder[paymentForm.paymentMode] || 'Optional';
                      return (
                        <>
                          <label className="text-xs font-medium text-gray-500">
                            Reference Number {isRequired && <span className="text-rose-500">*</span>}
                          </label>
                          <input
                            placeholder={placeholder}
                            value={paymentForm.transactionRef}
                            onChange={e => setPaymentForm({ ...paymentForm, transactionRef: e.target.value })}
                            className={`w-full px-3 py-2.5 bg-white border rounded-lg text-sm font-medium text-gray-800 outline-none transition-colors ${
                              isError ? 'border-rose-300 ring-1 ring-rose-200' : 'border-gray-200 focus:border-[#f58220]'
                            }`}
                          />
                          {isError && <p className="text-xs text-rose-500 font-medium mt-0.5">Required — enter the bank/payment reference number</p>}
                        </>
                      );
                    })()}
                  </div>

                  {/* Allocate to Invoice */}
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium text-gray-500">
                      Apply to Bill
                    </label>
                    {paymentForm.type === 'PAYMENT' ? (
                      loadingInvoices ? (
                        <div className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400 animate-pulse">Loading invoices...</div>
                      ) : (
                        <select
                          value={paymentForm.vendorInvoiceId}
                          onChange={e => {
                            const inv = vendorInvoices.find(i => i.id === e.target.value);
                            setPaymentForm({ ...paymentForm, vendorInvoiceId: e.target.value, amount: inv ? inv.amount.toString() : paymentForm.amount });
                          }}
                          className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 outline-none focus:border-[#f58220]"
                        >
                          <option value="">— Direct Payment (Unallocated)</option>
                          {vendorInvoices.length === 0 ? (
                            <option disabled>No outstanding invoices</option>
                          ) : vendorInvoices.map(inv => (
                            <option key={inv.id} value={inv.id}>
                              {inv.invoiceNumber}    ₹{Math.round(inv.amount).toLocaleString()}   [{inv.status}]
                            </option>
                          ))}
                        </select>
                      )
                    ) : (
                      <div className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-400 select-none">
                        Advances are not linked to invoices
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Remarks / Internal Notes</label>
                  <input placeholder="Note for accounting..." value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 outline-none focus:border-[#f58220]" />
                </div>
              </div>
            </div>{/* end grid */}
            </div>{/* end scrollable body */}

            {/* Sticky Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 shrink-0 bg-white rounded-b-lg">
              <p className="text-xs text-gray-500">
                {accounts.length === 0
                  ? <span className="text-rose-500 font-semibold">⚠ No debit account available</span>
                  : noPayableDue
                  ? <span className="text-rose-500 font-semibold">⚠ No outstanding balance to pay — switch to Advance</span>
                  : !amountNum
                  ? <span className="text-gray-400 font-semibold">Enter payment details to continue</span>
                  : !paymentForm.accountId
                  ? <span className="text-rose-500 font-semibold">⚠ Select a debit account</span>
                  : paymentForm.paymentMode !== 'CASH' && !paymentForm.transactionRef.trim()
                  ? <span className="text-rose-500 font-semibold">⚠ Reference number required</span>
                  : amountNum > accountBalance
                  ? <span className="text-rose-500 font-semibold">⚠ Amount exceeds account balance</span>
                  : <span className="text-emerald-600 font-semibold">✓ Ready to record</span>}
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button
                  onClick={handlePayment}
                  className={clsx(
                    "px-6 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm",
                    saving || noPayableDue || !amountNum || !paymentForm.accountId || (paymentForm.paymentMode !== 'CASH' && !paymentForm.transactionRef.trim())
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                      : "bg-[#f58220] text-white hover:bg-[#e8740e] active:scale-95"
                  )}
                  disabled={saving || noPayableDue || !amountNum || !paymentForm.accountId || (paymentForm.paymentMode !== 'CASH' && !paymentForm.transactionRef.trim())}
                >
                  {saving ? "Processing…" : "Record Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Party Settings Slide-over */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex justify-end">
          <div className="w-[400px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white z-10 shrink-0">
              <h3 className="text-lg font-bold text-slate-700">Party Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Settings Content */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                <span className="text-sm font-bold text-slate-600">General</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.enablePaymentReminder}
                    onChange={(e) => setSettings({ ...settings, enablePaymentReminder: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Enable payment reminders</span>
                </div>

                {settings.enablePaymentReminder && (
                  <div className="pl-7 space-y-1.5">
                    <span className="text-xs font-semibold text-slate-500">Remind me X days before payment is due</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={settings.reminderDays}
                        onChange={(e) => setSettings({ ...settings, reminderDays: e.target.value })}
                        className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 text-center focus:outline-none focus:border-orange-400"
                      />
                      <span className="text-sm font-medium text-slate-500">day{Number(settings.reminderDays) === 1 ? '' : 's'} before due date</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
              >
                {savingSettings ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
