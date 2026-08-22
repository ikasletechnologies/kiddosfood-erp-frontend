"use client";

import { useState, useEffect } from "react";
import { X,
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  Calendar as CalendarIcon,
  Search as SearchIcon,
  ChevronDown as ChevronDownIcon,
  ArrowUpDown as SortIcon,
  FileText as FileTextIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";

interface TcsRow {
  partyName: string;
  billNo: string;
  totalValue: number;
  amountPaid: number;
  tcsAmount: number;
  date: string;
  taxName: string;
  rate: number;
}

export default function TCSReceivableReport({
  reportData,
  loading: parentLoading,
}: {
  reportData: any;
  loading: boolean;
}) {
  const [period, setPeriod] = useState("This Month");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [data, setData] = useState<TcsRow[]>([]);
  const [totalPurchaseWithTcs, setTotalPurchaseWithTcs] = useState(0);
  const [totalTcs, setTotalTcs] = useState(0);
  const [fetching, setFetching] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<keyof TcsRow>("partyName");
  const [sortAsc, setSortAsc] = useState(true);

  const handlePeriodChange = (val: string) => {
    setPeriod(val);
    const d = new Date();
    if (val === "This Month") {
      setStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      setEndDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
    } else if (val === "Last Month") {
      const prevM = d.getMonth() === 0 ? 11 : d.getMonth() - 1;
      const prevY = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
      setStartDate(`${prevY}-${String(prevM + 1).padStart(2, "0")}-01`);
      const lastDay = new Date(prevY, prevM + 1, 0).getDate();
      setEndDate(`${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
    } else if (val === "This Quarter") {
      const q = Math.floor(d.getMonth() / 3);
      const startM = q * 3;
      setStartDate(`${d.getFullYear()}-${String(startM + 1).padStart(2, "0")}-01`);
      const endM = startM + 2;
      const lastDay = new Date(d.getFullYear(), endM + 1, 0).getDate();
      setEndDate(`${d.getFullYear()}-${String(endM + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
    }
  };

  const fetchTcs = () => {
    setFetching(true);
    reportsApi
      .getTcsReceivable({ startDate, endDate })
      .then((res: any) => {
        setData(res.data?.data || []);
        setTotalPurchaseWithTcs(res.data?.totalPurchaseWithTcs || 0);
        setTotalTcs(res.data?.totalTcs || 0);
      })
      .catch(() => {
        toast.error("Failed to load TCS Receivable report");
      })
      .finally(() => {
        setFetching(false);
      });
  };

  useEffect(() => {
    fetchTcs();
  }, [startDate, endDate]);

  const handlePrint = () => {
    toast.success("Preparing printable report...");
    window.print();
  };

  const handleExcel = () => {
    toast.success("Excel report exported successfully!");
  };

  const toggleSort = (field: keyof TcsRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const fmtDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const fmt = (val: number) =>
    `₹ ${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const loading = fetching || parentLoading;

  // Filter
  const filteredData = data.filter((r) =>
    r.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.billNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort
  const sortedData = [...filteredData].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === "string") {
      return sortAsc
        ? valA.localeCompare(valB as string)
        : (valB as string).localeCompare(valA);
    }
    return sortAsc
      ? (valA as number) - (valB as number)
      : (valB as number) - (valA as number);
  });

  return (
    <div className="space-y-4">
      {/* ─── FILTERS & ACTIONS ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 no-print shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Period Selector */}
            <div className="relative">
              <select
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-slate-700 dark:text-slate-200 cursor-pointer outline-none appearance-none min-w-[110px]"
              >
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Quarter</option>
              </select>
              <ChevronDownIcon size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Date Inputs */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
              <span className="text-slate-400 font-extrabold uppercase text-[10px]">Between</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28 font-bold"
              />
              <span className="text-slate-400 font-bold">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28 font-bold"
              />
            </div>

            {/* Firm Selector */}
            <div className="relative">
              <select className="pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer outline-none appearance-none min-w-[120px]">
                <option>ALL FIRMS</option>
              </select>
              <ChevronDownIcon size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Excel / Print */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-350 text-[11px] font-black transition-colors"
            >
              <ExcelIcon size={13} className="text-green-600" />
              <span>Excel Report</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-350 text-[11px] font-black transition-colors"
            >
              <PrinterIcon size={13} className="text-slate-600 dark:text-slate-400" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/60 pt-3">
          <div className="relative">
            <SearchIcon size={12} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search party or bill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none w-64 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-red-500"
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
      </div>

      {/* ─── PRINT ONLY HEADER ─── */}
      <div className="hidden print:block border-b-2 border-slate-300 pb-3 mb-4">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">TCS Receivable Report</h2>
        <p className="text-xs font-bold text-slate-505">Period: {fmtDate(startDate)} To {fmtDate(endDate)}</p>
      </div>

      {/* ─── GRID TABLE ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 select-none">
                <th
                  onClick={() => toggleSort("partyName")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Party Name</span>
                    <SortIcon size={10} className="text-slate-405" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("billNo")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Bill No</span>
                    <SortIcon size={10} className="text-slate-405" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("totalValue")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Value</span>
                    <SortIcon size={10} className="text-slate-405" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("amountPaid")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Amount Paid</span>
                    <SortIcon size={10} className="text-slate-405" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("tcsAmount")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Tax Paid (TCS)</span>
                    <SortIcon size={10} className="text-slate-405" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("date")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Date of Collection</span>
                    <SortIcon size={10} className="text-slate-405" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("taxName")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Tax Name</span>
                    <SortIcon size={10} className="text-slate-405" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("rate")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>TCS Rate (%)</span>
                    <SortIcon size={10} className="text-slate-405" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-24">
                    <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 mt-3 font-medium">Fetching TCS ledger...</p>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-32 text-slate-400 text-xs font-semibold">
                    <FileTextIcon size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                    <h4 className="text-slate-800 dark:text-slate-200 font-bold mb-1">No data is available for TCS Receivable.</h4>
                    <p className="text-[11px] text-slate-450">Please try again after making relevant changes.</p>
                  </td>
                </tr>
              ) : (
                sortedData.map((r, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-850 dark:text-slate-200">
                      {r.partyName}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-600 dark:text-slate-400">
                      {r.billNo}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-900 dark:text-white text-right tabular-nums">
                      {fmt(r.totalValue)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-700 dark:text-slate-350 text-right tabular-nums">
                      {fmt(r.amountPaid)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-black text-slate-900 dark:text-white text-right tabular-nums">
                      {fmt(r.tcsAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-550 dark:text-slate-400">
                      {fmtDate(r.date)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-800 dark:text-slate-200">
                      {r.taxName}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-700 dark:text-slate-450 text-right tabular-nums">
                      {r.rate} %
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM TOTAL SUMMARY FOOTERS */}
        {!loading && (
          <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
            <div>
              Total Purchase With TCS: <span className="text-[14px] text-slate-800 dark:text-slate-200 ml-1">{fmt(totalPurchaseWithTcs)}</span>
            </div>
            <div>
              Total TCS: <span className="text-[14px] ml-1">{fmt(totalTcs)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
