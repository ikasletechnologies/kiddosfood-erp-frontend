"use client";

import { useState, useEffect } from "react";
import { 
  Landmark as LandmarkIcon, 
  Search as SearchIcon, 
  TrendingUp as TrendingUpIcon, 
  ArrowUpRight as ArrowUpRightIcon, 
  ArrowDownLeft as ArrowDownLeftIcon, 
  Calendar as CalendarIcon, 
  Building2 as Building2Icon, 
  FileText as FileTextIcon,
  CreditCard as CreditCardIcon,
  History as HistoryIcon,
  CheckCircle2 as CheckCircle2Icon,
  Clock as ClockIcon
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";
import { formatDate } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  description: string;
  date: string;
  reference?: string;
  status: string;
}

export default function SupplierLedgerPage() {
  const { user } = useAuth();
  const [ledger, setLedger] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [franchiseData, setFranchiseData] = useState<any>(null);

  useEffect(() => {
    fetchLedger();
  }, []);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      // In this business model, the "Supplier" for a franchise is the HQ.
      // We fetch the franchise's own financial relationship data.
      if (user?.franchiseId) {
        const [frRes, transRes] = await Promise.all([
          api.get(`/api/franchise/${user.franchiseId}`),
          api.get(`/api/accounting/ledger-summary?franchiseId=${user.franchiseId}`)
        ]);
        setFranchiseData(frRes.data);
        setLedger(transRes.data);
        setTransactions(transRes.data?.transactions || []);
      }
    } catch (error) {
      toast.error("Failed to fetch ledger data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-4 md:p-6 animate-in fade-in duration-700">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 pb-2 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchLedger}
            className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 transition-all shadow-sm"
          >
            <HistoryIcon size={18} className={clsx("text-slate-400", loading && "animate-spin")} />
          </button>
          <Link href="/franchise-orders" className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center">
            Record Payment to HQ
          </Link>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 dark:bg-slate-950 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUpIcon size={120} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Total Outstanding (To HQ)</p>
          <p className="text-5xl font-black tracking-tighter mb-6">
            ₹{(franchiseData?.outstandingAmount || 0).toLocaleString()}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex-1 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[8px] font-black uppercase text-slate-500">Credit Limit</p>
              <p className="text-sm font-black">₹{(franchiseData?.creditLimit || 0).toLocaleString()}</p>
            </div>
            <div className="flex-1 px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <p className="text-[8px] font-black uppercase text-emerald-500">Available</p>
              <p className="text-sm font-black text-emerald-400">₹{((franchiseData?.creditLimit || 0) - (franchiseData?.outstandingAmount || 0)).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600">
              <ArrowDownLeftIcon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Payments</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">₹{(ledger?.expenses?.paid || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-[65%]" />
          </div>
          <p className="text-[10px] font-bold text-slate-500 mt-3 flex items-center gap-1.5">
            <CheckCircle2Icon size={12} className="text-emerald-500" />
            Total payments made this period
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-orange-50 dark:bg-orange-500/10 rounded-2xl text-orange-600">
              <FileTextIcon size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unpaid Invoices</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {(ledger?.invoices?.due || 0) > 0 ? (ledger?.invoices?.due || 0).toLocaleString() : '0'}
              </p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
            <ClockIcon size={12} className="text-orange-500" />
            Pending dues to be cleared
          </p>
          <button className="mt-6 text-orange-500 text-[10px] font-black uppercase tracking-widest hover:underline text-left">
            View Invoice History →
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Recent Transactions</h2>
          <div className="relative group w-72">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Filter transactions..." 
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none text-xs font-bold"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Date & Reference</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Description</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Debit (Paid)</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Credit (Due)</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-900 dark:text-white">{formatDate(t.date)}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.reference || 'TRX-'+t.id.slice(0,5)}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.description}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-emerald-600">
                      {t.type === "DEBIT" ? `₹${t.amount.toLocaleString()}` : "—"}
                    </p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-rose-500">
                      {t.type === "CREDIT" ? `₹${t.amount.toLocaleString()}` : "—"}
                    </p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className={clsx(
                      "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                      t.status === "SUCCESS" || t.status === "COMPLETED" 
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                    )}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
