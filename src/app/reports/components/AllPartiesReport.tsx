"use client";

import { useState, useEffect, Fragment } from "react";
import { X,
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  Filter as FilterIcon,
  Search as SearchIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";
import * as XLSX from "xlsx";
import { formatDate, formatDateTime } from "@/lib/utils";

interface PartyRow {
  id: string;
  partyType: string;
  partyName: string;
  email: string | null;
  phoneNo: string;
  receivableBalance: number | null;
  payableBalance: number | null;
  creditLimit: number | null;
}

interface InvoicePayment {
  paymentNumber: string;
  date: string;
  method: string;
  account: string;
  amount: number;
  isCancelled: boolean;
  status: string;
}

interface InvoiceRow {
  invoiceNumber: string;
  createdAt: string;
  invoiceTotal: number;
  paidAmount: number;
  balance: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  payments: InvoicePayment[];
}

const PARTY_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  DEALER: "Dealer",
  FRANCHISE: "Franchise",
  VENDOR: "Vendor",
};

// Convert a plain YYYY-MM-DD date-input value into a boundary-inclusive
// local-time ISO string before it reaches the backend. Sending the bare
// "YYYY-MM-DD" for an end date would parse (per the ISO 8601 date-only rule)
// as UTC midnight — that boundary EXCLUDES the whole selected day for any
// server not running in UTC, which is exactly the "date filter at boundary
// dates" case Phase B needs to get right. Backend logic (Order.createdAt
// gte/lte) is untouched; only the string this page sends it is fixed.
function toDayStart(dateStr: string) {
  return `${dateStr}T00:00:00.000`;
}
function toDayEnd(dateStr: string) {
  return `${dateStr}T23:59:59.999`;
}

export default function CentralAllPartiesReport({
  reportData,
  loading: externalLoading,
  filterType,
}: {
  reportData: any;
  loading: boolean;
  filterType?: "receivables" | "payables";
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Cosmetic-only checkbox preserved for Payables/Reports usages of this
  // shared component (it never filtered anything before Phase B either —
  // out of scope here, kept only so those pages don't visually lose it).
  const [legacyDateFilterCheckbox, setLegacyDateFilterCheckbox] = useState(false);

  // Real data state
  const [rows, setRows] = useState<PartyRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Party-type filter (Receivables only: Customer / Dealer / Franchise / All)
  const [partyTypeFilter, setPartyTypeFilter] = useState<"ALL" | "CUSTOMER" | "DEALER" | "FRANCHISE">("ALL");

  // Date filter (Receivables only) — filters on Order.createdAt, labeled
  // "Created Date" everywhere in this UI per the Phase B decision: this app
  // has no persisted invoiceDate field, so createdAt must never be
  // mislabeled as "Invoice Date".
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  // Drill-down (Receivables only)
  const [drillDownParty, setDrillDownParty] = useState<PartyRow | null>(null);
  const [drillDownInvoices, setDrillDownInvoices] = useState<InvoiceRow[]>([]);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const isReceivables = filterType === "receivables";

  useEffect(() => {
    setLoading(true);
    const params: any = {};
    if (isReceivables) {
      // datasetType is the real party-type-class constraint: it makes the
      // backend query itself exclude every Vendor row, even under "All
      // Party Types" (partyType intentionally omitted below). Relying on
      // partyType alone would leave "All" mapped to the backend's
      // unfiltered default, which also returns Vendor rows for the generic
      // Reports > All Parties page — that's exactly how a Vendor with a
      // positive ledger balance used to leak into this table.
      params.datasetType = "RECEIVABLE";
      if (partyTypeFilter !== "ALL") params.partyType = partyTypeFilter;
      if (dateFilterEnabled && appliedStartDate) params.startDate = toDayStart(appliedStartDate);
      if (dateFilterEnabled && appliedEndDate) params.endDate = toDayEnd(appliedEndDate);
    } else if (filterType === "payables") {
      // Mirror constraint for Payables: query-layer restriction to Vendor
      // rows only, not a downstream balance-sign filter.
      params.datasetType = "PAYABLE";
    }
    reportsApi.getAllParties(params).then((res: any) => {
      if (!res.data || res.data.length === 0) {
        setRows([]);
      } else {
        const parsed = res.data.map((c: any) => ({
          id: c.id,
          partyType: c.partyType || "",
          partyName: c.name,
          email: c.email || null,
          phoneNo: c.phone || "—",
          receivableBalance: c.currentBalance > 0 ? c.currentBalance : null,
          payableBalance: c.currentBalance < 0 ? Math.abs(c.currentBalance) : null,
          creditLimit: c.creditLimit ?? null
        }));
        setRows(parsed);
      }
    }).catch(() => {
      setRows([]);
      toast.error("Failed to load parties");
    }).finally(() => {
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, partyTypeFilter, dateFilterEnabled, appliedStartDate, appliedEndDate]);

  // Search matches Party Name, Phone, Email — same fields the backend
  // `search` param matches server-side; done client-side here since the
  // full (already filtered-by-partyType/date) result set is already local.
  let filtered = rows.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      r.partyName.toLowerCase().includes(q) ||
      (r.phoneNo || "").toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q)
    );
  });

  if (filterType === "receivables") {
    // The `datasetType: "RECEIVABLE"` request param already keeps Vendor out
    // of `rows` entirely; `partyType !== "VENDOR"` here is a defense-in-depth
    // backstop only, not the actual fix — it must never be the sole guard.
    filtered = filtered
      .map(r => ({ ...r, payableBalance: null }))
      .filter(r => r.partyType !== "VENDOR" && r.receivableBalance !== null && r.receivableBalance > 0);
  } else if (filterType === "payables") {
    filtered = filtered
      .map(r => ({ ...r, receivableBalance: null }))
      .filter(r => r.payableBalance !== null && r.payableBalance > 0);
  }

  const handlePrint = () => {
    window.print();
  };

  const handleApplyDateFilter = () => {
    if (!startDateInput && !endDateInput) {
      toast.error("Pick at least one date");
      return;
    }
    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
  };

  const handleResetDateFilter = () => {
    setDateFilterEnabled(false);
    setStartDateInput("");
    setEndDateInput("");
    setAppliedStartDate("");
    setAppliedEndDate("");
  };

  const openDrillDown = (row: PartyRow) => {
    if (!isReceivables) return;
    if (!["CUSTOMER", "DEALER", "FRANCHISE"].includes(row.partyType)) return;
    setDrillDownParty(row);
    setExpandedInvoice(null);
    setDrillDownLoading(true);
    reportsApi.getPartyInvoices({ partyType: row.partyType, partyId: row.id }).then((res: any) => {
      setDrillDownInvoices(res.data || []);
    }).catch(() => {
      setDrillDownInvoices([]);
      toast.error("Failed to load invoices for this party");
    }).finally(() => {
      setDrillDownLoading(false);
    });
  };

  const closeDrillDown = () => {
    setDrillDownParty(null);
    setDrillDownInvoices([]);
    setExpandedInvoice(null);
  };

  const handleExcel = () => {
    try {
      const rowsToExport = selectedIds.length > 0
        ? filtered.filter(r => selectedIds.includes(r.id))
        : filtered;

      if (!rowsToExport || rowsToExport.length === 0) {
        toast.error("No parties to export");
        return;
      }

      const aoa: any[][] = [];
      aoa.push([filterType === "receivables" ? "RECEIVABLES REPORT" : filterType === "payables" ? "PAYABLES REPORT" : "ALL PARTIES REPORT"]);
      aoa.push(["Generated Date:", formatDate(new Date())]);
      if (isReceivables) {
        aoa.push(["Party Type Filter:", partyTypeFilter === "ALL" ? "All" : PARTY_TYPE_LABELS[partyTypeFilter]]);
        aoa.push(["Created Date Period:", dateFilterEnabled && appliedStartDate && appliedEndDate
          ? `${formatDate(appliedStartDate)} to ${formatDate(appliedEndDate)}`
          : "All Records"]);
      }
      if (selectedIds.length > 0) aoa.push(["Selected Parties Count:", selectedIds.length]);
      aoa.push([]);

      if (isReceivables) {
        // Receivables export columns per spec: no Payable Balance column.
        aoa.push(["#", "Party Name", "Party Type", "Email", "Phone No", "Receivable Balance (Rs)", "Credit Limit (Rs)"]);
        rowsToExport.forEach((r, idx) => {
          aoa.push([
            idx + 1,
            r.partyName || "",
            PARTY_TYPE_LABELS[r.partyType] || r.partyType || "—",
            r.email || "—",
            r.phoneNo || "—",
            r.receivableBalance !== null ? Number(r.receivableBalance) : 0,
            // Never fabricate 0 for a party type with no creditLimit column (Dealer) — real "—".
            r.creditLimit !== null ? Number(r.creditLimit) : "—"
          ]);
        });
        aoa.push([]);
        aoa.push(["TOTALS", "", "", "", "", rowsToExport.reduce((s, r) => s + (r.receivableBalance || 0), 0), ""]);
      } else {
        aoa.push(["#", "Party Name", "Party Type", "Email", "Phone No", "Receivable Balance (Rs)", "Payable Balance (Rs)", "Credit Limit (Rs)"]);
        rowsToExport.forEach((r, idx) => {
          aoa.push([
            idx + 1,
            r.partyName || "",
            PARTY_TYPE_LABELS[r.partyType] || r.partyType || "—",
            r.email || "—",
            r.phoneNo || "—",
            r.receivableBalance !== null ? Number(r.receivableBalance) : 0,
            r.payableBalance !== null ? Number(r.payableBalance) : 0,
            r.creditLimit !== null ? Number(r.creditLimit) : "—"
          ]);
        });
        aoa.push([]);
        aoa.push([
          "TOTALS", "", "", "", "",
          rowsToExport.reduce((s, r) => s + (r.receivableBalance || 0), 0),
          rowsToExport.reduce((s, r) => s + (r.payableBalance || 0), 0),
          ""
        ]);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isReceivables ? "Receivables" : "All Parties");

      const filename = `${isReceivables ? "Receivables" : "All_Parties"}_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(selectedIds.length > 0 ? `Exported ${selectedIds.length} selected parties to Excel!` : "Report exported to Excel!");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to export Excel file");
    }
  };

  const fmt = (val: number | null) => val !== null ? `₹ ${val.toFixed(2)}` : "—";

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(r => r.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const totalReceivable = filtered.reduce((s, r) => s + (r.receivableBalance || 0), 0);
  const totalPayable = filtered.reduce((s, r) => s + (r.payableBalance || 0), 0);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PAID: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30",
      PARTIAL: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30",
      UNPAID: "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30",
    };
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${styles[status] || ""}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] dark:bg-[#090a0f] space-y-4 p-6 overflow-hidden">
      {/* Top Header Row */}
      <div className="no-print flex flex-col gap-4 bg-white dark:bg-[#12141c] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {isReceivables ? (
              <>
                <div className="relative">
                  <select
                    value={partyTypeFilter}
                    onChange={(e) => setPartyTypeFilter(e.target.value as any)}
                    className="px-3 pr-8 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none min-w-[140px]"
                  >
                    <option value="ALL">All Party Types</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="DEALER">Dealer</option>
                    <option value="FRANCHISE">Franchise</option>
                  </select>
                  <ChevronDownIcon size={14} className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dateFilterEnabled}
                    onChange={(e) => {
                      setDateFilterEnabled(e.target.checked);
                      if (!e.target.checked) handleResetDateFilter();
                    }}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">Created Date Filter</span>
                </label>

                {dateFilterEnabled && (
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 font-extrabold uppercase text-[10px]">From</span>
                    <input
                      type="date"
                      value={startDateInput}
                      onChange={(e) => setStartDateInput(e.target.value)}
                      className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28 font-bold"
                    />
                    <span className="text-slate-400 font-bold">To</span>
                    <input
                      type="date"
                      value={endDateInput}
                      onChange={(e) => setEndDateInput(e.target.value)}
                      className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28 font-bold"
                    />
                    <button
                      onClick={handleApplyDateFilter}
                      className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={handleResetDateFilter}
                      className="px-2.5 py-1 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-wider transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={legacyDateFilterCheckbox}
                    onChange={(e) => setLegacyDateFilterCheckbox(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">Date Filter</span>
                </label>
                <div className="relative">
                  <select className="px-3 pr-8 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none min-w-[140px]">
                    <option>All parties</option>
                  </select>
                  <ChevronDownIcon size={14} className="absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-6">
            <button onClick={handleExcel} className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-600 transition-colors">
              <ExcelIcon size={20} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Excel Report</span>
            </button>
            <button onClick={handlePrint} className="flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-blue-600 transition-colors">
              <PrinterIcon size={20} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block border-b-2 border-slate-300 pb-3 mb-2">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
          {filterType === "receivables" ? "Receivables Report" : filterType === "payables" ? "Payables Report" : "All Parties Report"}
        </h2>
        {isReceivables && (
          <>
            <p className="text-xs font-bold text-slate-600">
              Created Date Period: {dateFilterEnabled && appliedStartDate && appliedEndDate
                ? `${formatDate(appliedStartDate)} To ${formatDate(appliedEndDate)}`
                : "All Records"}
            </p>
            <p className="text-xs font-bold text-slate-600">
              Party Type: {partyTypeFilter === "ALL" ? "All" : PARTY_TYPE_LABELS[partyTypeFilter]}
            </p>
          </>
        )}
      </div>

      <div className="bg-white dark:bg-[#12141c] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col flex-1 overflow-hidden relative">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0 no-print">
          <div className="relative max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search name, phone or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#090a0f] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {searchQuery && (
              <X
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
                onClick={() => setSearchQuery("")}
              />
            )}
          </div>
        </div>

        <div className="overflow-auto custom-scrollbar flex-1 w-full max-w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/40 z-10 shadow-sm border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 w-12 text-center no-print">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 w-12">
                  <div className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">#</span>
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PARTY NAME</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PARTY TYPE</span>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">EMAIL</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between group cursor-pointer gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PHONE NO.</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 text-right">
                  <div className="flex items-center justify-end group cursor-pointer gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">RECEIVABLE BALANCE</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
                {filterType !== "receivables" && (
                  <th className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 text-right">
                    <div className="flex items-center justify-end group cursor-pointer gap-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PAYABLE BALANCE</span>
                      <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </th>
                )}
                <th className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end group cursor-pointer gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CREDIT LIMIT</span>
                    <FilterIcon size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {loading || externalLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-32 text-center h-full">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-40 text-center h-full align-middle">
                    <div className="text-slate-600 dark:text-slate-400 font-medium">
                      No records to show
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const isSelected = selectedIds.includes(row.id);
                  const clickable = isReceivables && ["CUSTOMER", "DEALER", "FRANCHISE"].includes(row.partyType);
                  return (
                    <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'}`}>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-center no-print">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(row.id)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-center">{idx + 1}</td>
                      <td
                        className={`px-4 py-4 border-r border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-white ${clickable ? "cursor-pointer hover:text-blue-600 hover:underline" : ""}`}
                        onClick={() => clickable && openDrillDown(row)}
                        title={clickable ? "View outstanding invoices" : undefined}
                      >
                        {row.partyName}
                      </td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{PARTY_TYPE_LABELS[row.partyType] || row.partyType || "—"}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{row.email || "—"}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-right">{row.phoneNo}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-right font-medium text-emerald-500">{fmt(row.receivableBalance)}</td>
                      {filterType !== "receivables" && (
                        <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-right font-medium">{fmt(row.payableBalance)}</td>
                      )}
                      <td className="px-4 py-4 text-right font-medium">{fmt(row.creditLimit)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-[#12141c] border-t border-slate-200 dark:border-slate-800 p-4 shrink-0 flex justify-between items-center text-[11px] font-semibold tracking-wide">
          <div className="text-slate-600 dark:text-slate-400">
            Total Receivable: <span className="text-emerald-500 ml-1">{fmt(totalReceivable)}</span>
          </div>
          {filterType !== "receivables" && (
            <div className="text-slate-600 dark:text-slate-400">
              Total Payable: <span className="text-emerald-500 ml-1">{fmt(totalPayable)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Drill-down modal — outstanding invoices + payment history for one party */}
      {drillDownParty && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeDrillDown}>
          <div
            className="bg-white dark:bg-[#12141c] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">{drillDownParty.partyName}</h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  {PARTY_TYPE_LABELS[drillDownParty.partyType] || drillDownParty.partyType} — Invoice History
                </p>
              </div>
              <button onClick={closeDrillDown} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-auto flex-1">
              {drillDownLoading ? (
                <div className="py-24 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                </div>
              ) : drillDownInvoices.length === 0 ? (
                <div className="py-24 text-center text-sm font-semibold text-slate-500">No invoices found for this party.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest w-8"></th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Invoice No.</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Created Date</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Invoice Total</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Paid Amount</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Balance</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {drillDownInvoices.map((inv) => {
                      const isExpanded = expandedInvoice === inv.invoiceNumber;
                      return (
                        <Fragment key={inv.invoiceNumber}>
                          <tr
                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 cursor-pointer"
                            onClick={() => setExpandedInvoice(isExpanded ? null : inv.invoiceNumber)}
                          >
                            <td className="px-4 py-3 text-center">
                              <ChevronRightIcon size={14} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{inv.invoiceNumber}</td>
                            <td className="px-4 py-3">{formatDate(inv.createdAt)}</td>
                            <td className="px-4 py-3 text-right">{fmt(inv.invoiceTotal)}</td>
                            <td className="px-4 py-3 text-right">{fmt(inv.paidAmount)}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-white">{fmt(inv.balance)}</td>
                            <td className="px-4 py-3 text-center">{statusBadge(inv.status)}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/60 dark:bg-slate-900/40">
                              <td></td>
                              <td colSpan={6} className="px-4 py-3">
                                {inv.payments.length === 0 ? (
                                  <p className="text-[11px] text-slate-500 italic">No payments recorded for this invoice.</p>
                                ) : (
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-2 py-1">Payment No.</th>
                                        <th className="px-2 py-1">Payment Date</th>
                                        <th className="px-2 py-1">Method</th>
                                        <th className="px-2 py-1">Account</th>
                                        <th className="px-2 py-1 text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {inv.payments.map((p, pi) => (
                                        <tr key={pi} className={`text-[11px] ${p.isCancelled ? "opacity-50 line-through" : ""}`}>
                                          <td className="px-2 py-1 font-bold text-slate-700 dark:text-slate-200">{p.paymentNumber}</td>
                                          <td className="px-2 py-1">{formatDateTime(p.date)}</td>
                                          <td className="px-2 py-1">{p.method}</td>
                                          <td className="px-2 py-1">{p.account}</td>
                                          <td className="px-2 py-1 text-right">₹ {Number(p.amount).toFixed(2)}{p.isCancelled ? " (cancelled)" : ""}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
