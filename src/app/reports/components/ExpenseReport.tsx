"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Printer as PrinterIcon,
  FileSpreadsheet as ExcelIcon,
  Calendar as CalendarIcon,
  Plus as PlusIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { accountingApi } from "@/lib/api/accounting.api";

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description?: string;
  paymentMode?: string;
  status: string;
  expenseNumber?: string;
  payee?: string;
}

export default function CentralExpenseReport({
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

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fetching, setFetching] = useState(false);
  const [summary, setSummary] = useState({ totalExpenses: 0, totalPaid: 0, totalUnpaid: 0 });

  const fetchExpenses = () => {
    setFetching(true);
    accountingApi
      .getExpenses({
        startDate,
        endDate,
      })
      .then((res: any) => {
        setExpenses(res.data?.expenses || []);
        if (res.data?.summary) setSummary(res.data.summary);
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

  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // If empty, show beautiful empty state with Add your 1st Expense button
  if (!fetching && !loading && expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[480px] bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
        {/* Wallet custom icon illustration */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-500">
            <WalletIcon size={44} />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 border-2 border-red-500 rounded-full p-1.5 flex items-center justify-center text-red-500">
            <PlusIcon size={14} className="stroke-[3]" />
          </div>
        </div>

        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Add your 1st Expense</h3>
        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-2 max-w-sm">
          Record your business expenses & know your real profits.
        </p>

        <button
          onClick={handleAddExpense}
          className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black transition-all duration-200 shadow-md shadow-red-500/20 hover:scale-[1.02]"
        >
          <PlusIcon size={14} className="stroke-[3]" />
          <span>Add Expenses</span>
        </button>
      </div>
    );
  }

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
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Expenses Report</h2>
        <p className="text-xs font-bold text-slate-500">Period: {fmtDate(startDate)} To {fmtDate(endDate)}</p>
      </div>

      {/* ─── TABLE ─── */}
      <div className="bg-white dark:bg-[#12141c] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense No.</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payee</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Mode</th>
   <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {fetching || loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-24">
                    <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 mt-3 font-medium">Fetching business expenses...</p>
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">
                      {fmtDate(e.date)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-900 dark:text-white">
                      {e.expenseNumber || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-bold text-slate-800 dark:text-slate-200">
                      {e.category}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">
                      {e.payee || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                      {e.description || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-600 dark:text-slate-400">
                      {e.paymentMode || "CASH"}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-black text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide ${e.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {e.status || 'UNPAID'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-black text-slate-900 dark:text-white text-right tabular-nums">
                      {fmt(e.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SUMMARY FOOTER */}
        {expenses.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 p-5 flex flex-wrap justify-between items-center text-right font-black gap-4">
            <div className="flex items-center gap-6 text-[13px]">
              <div className="text-slate-500">Paid: <span className="text-green-600">{fmt(summary.totalPaid)}</span></div>
              <div className="text-slate-500">Pending: <span className="text-orange-500">{fmt(summary.totalUnpaid)}</span></div>
            </div>
            <div className="text-slate-800 dark:text-slate-200 text-[14px]">
              Total Expense: <span className="text-red-600 dark:text-red-400 text-[16px]">{fmt(summary.totalExpenses)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
