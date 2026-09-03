"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  Calendar as CalendarIcon,
  Plus as PlusIcon,
  ShoppingCart as ShoppingCartIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { reportsApi } from "@/lib/api/accounting.api";

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
}

export default function CentralExpenseCategoryReport({
  reportData,
  loading,
}: {
  reportData: any;
  loading: boolean;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const [categoryRows, setCategoryRows] = useState<any[]>([]);
  const [totalExpense, setTotalExpense] = useState<number>(0);
  const [fetching, setFetching] = useState(false);

  const fetchExpenses = () => {
    setFetching(true);
    reportsApi.getExpenseCategory({
        startDate,
        endDate,
      })
      .then((res: any) => {
        setCategoryRows(res.data?.categoryBreakdown || []);
        setTotalExpense(res.data?.summary?.totalExpenses || 0);
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
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 no-print shadow-sm">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
          <CalendarIcon size={14} className="text-slate-400" />
          <span>From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28"
          />
          <span>To</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent outline-none border-none text-slate-700 dark:text-slate-200 w-28"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleAddExpense}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black transition-all shadow-sm shadow-red-500/10"
          >
            <PlusIcon size={13} className="stroke-[3]" />
            <span>Add Expense</span>
          </button>
          <button
            onClick={handleExcel}
            className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            title="Excel Export"
          >
            <ExcelIcon size={15} className="text-green-600" />
          </button>
          <button
            onClick={handlePrint}
            className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            title="Print"
          >
            <PrinterIcon size={15} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* ─── PRINT-ONLY HEADER ─── */}
      <div className="hidden print:block border-b-2 border-slate-300 pb-3 mb-4">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Expense Category Report</h2>
        <p className="text-xs font-bold text-slate-500">Period: {fmtDate(startDate)} To {fmtDate(endDate)}</p>
      </div>

      {/* ─── TABLE ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense Category</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Count</th>
   <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">% of Total</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {fetching || loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-24">
                    <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 mt-3 font-medium">Fetching expense categories...</p>
                  </td>
                </tr>
              ) : categoryRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-32 text-slate-400 text-xs font-semibold">
                    <ShoppingCartIcon size={24} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                    No transactions to show
                  </td>
                </tr>
              ) : (
                categoryRows.map((r, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-800 dark:text-slate-200">
                      {r.category}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                      {r.count}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
                      {totalExpense > 0 ? ((r.totalAmount / totalExpense) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-black text-slate-900 dark:text-white text-right tabular-nums">
                      {fmt(r.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SUMMARY FOOTER */}
        {!fetching && !loading && (
          <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 p-5 flex justify-end items-center text-right font-black">
            <div className="text-slate-800 dark:text-slate-200 text-[14px]">
              Total Expense: <span className="text-red-600 dark:text-red-400 text-[16px]">{fmt(totalExpense)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
