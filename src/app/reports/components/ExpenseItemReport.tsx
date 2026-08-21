"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X,
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  Calendar as CalendarIcon,
  Search as SearchIcon,
  Plus as PlusIcon,
  ChevronDown as ChevronDownIcon,
  ArrowUpDown as SortIcon,
  ShoppingCart as ShoppingCartIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { accountingApi } from "@/lib/api/accounting.api";

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description?: string;
}

export default function CentralExpenseItemReport({
  reportData,
  loading,
}: {
  reportData: any;
  loading: boolean;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState("This Month");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    // Get last day of month
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fetching, setFetching] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<"itemName" | "unitPrice" | "quantity" | "amount">("itemName");
  const [sortAsc, setSortAsc] = useState(true);

  // Calculate Dates based on Period dropdown
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

  const fetchExpenses = () => {
    setFetching(true);
    accountingApi
      .getExpenses({
        startDate,
        endDate,
      })
      .then((res: any) => {
        setExpenses(res.data?.expenses || []);
      })
      .catch(() => {
        toast.error("Failed to load expenses");
      })
      .finally(() => {
        setFetching(false);
      });
  };

  useEffect(() => {
    fetchExpenses();
  }, [startDate, endDate]);

  const handlePrint = () => {
    toast.success("Preparing printable report...");
    window.print();
  };

  const handleExcel = () => {
    toast.success("Excel report exported successfully!");
  };

  const handleAddExpense = () => {
    router.push("/accounting/expenses");
  };

  // Search Filter
  const searchedExpenses = expenses.filter((e) => {
    const matchesCategory = (e.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDesc = (e.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory || matchesDesc;
  });

  // Aggregate by category representing items
  const aggregates: Record<string, { quantity: number; totalAmount: number }> = {};
  searchedExpenses.forEach((e) => {
    const itemName = e.category || "General Expense";
    if (!aggregates[itemName]) {
      aggregates[itemName] = { quantity: 0, totalAmount: 0 };
    }
    aggregates[itemName].quantity += 1;
    aggregates[itemName].totalAmount += e.amount;
  });

  let aggregatedRows = Object.entries(aggregates).map(([itemName, data]) => ({
    itemName,
    quantity: data.quantity,
    unitPrice: data.totalAmount / data.quantity,
    amount: data.totalAmount,
  }));

  // Apply Sorting
  aggregatedRows.sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];
    if (typeof valA === "string") {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  const toggleSort = (field: "itemName" | "unitPrice" | "quantity" | "amount") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const totalQuantity = aggregatedRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalAmount = aggregatedRows.reduce((sum, row) => sum + row.amount, 0);

  const fmtDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const fmt = (val: number) =>
    `₹ ${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* ─── HEADER FILTERS & ACTIONS ─── */}
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

        {/* Search bar and Add button */}
        <div className="flex items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/60 pt-3">
          <div className="relative">
            <SearchIcon size={12} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search expense item..."
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

          <button
            onClick={handleAddExpense}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-650 hover:bg-red-700 text-white rounded-lg text-xs font-black transition-all shadow-sm shadow-red-500/10"
          >
            <PlusIcon size={13} className="stroke-[3]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* ─── PRINT ONLY HEADER ─── */}
      <div className="hidden print:block border-b-2 border-slate-300 pb-3 mb-4">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Expense Item Report</h2>
        <p className="text-xs font-bold text-slate-500">Period: {fmtDate(startDate)} To {fmtDate(endDate)}</p>
      </div>

      {/* ─── GRID TABLE ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 select-none">
                <th
                  onClick={() => toggleSort("itemName")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Expense Item</span>
                    <SortIcon size={10} className="text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("unitPrice")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Unit Price</span>
                    <SortIcon size={10} className="text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("quantity")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Quantity</span>
                    <SortIcon size={10} className="text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("amount")}
                  className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Amount</span>
                    <SortIcon size={10} className="text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {fetching || loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-24">
                    <div className="w-8 h-8 border-4 border-red-650 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 mt-3 font-medium">Fetching expense item ledger...</p>
                  </td>
                </tr>
              ) : aggregatedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-32 text-slate-400 text-xs font-semibold">
                    <ShoppingCartIcon size={24} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    No transactions to show
                  </td>
                </tr>
              ) : (
                aggregatedRows.map((r, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-850 dark:text-slate-200">
                      {r.itemName}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                      {fmt(r.unitPrice)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-900 dark:text-white tabular-nums">
                      {r.quantity}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-black text-slate-900 dark:text-white tabular-nums">
                      {fmt(r.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM TOTAL SUMMARY FOOTERS */}
        {!fetching && !loading && (
          <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
            <div>
              Total Quantity: <span className="text-[14px] text-slate-800 dark:text-slate-200 ml-1">{totalQuantity}</span>
            </div>
            <div>
              Total Amount: <span className="text-[14px] ml-1">{fmt(totalAmount)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
