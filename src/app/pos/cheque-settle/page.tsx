"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Search,
  Calendar,
  CheckCircle2,
  Landmark,
  MoreVertical,
  User,
  AlertCircle,
  X,
  Loader2,
  ShieldCheck
} from "lucide-react";
import { clsx } from "clsx";
import { chequesApi, accountsApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import Link from "next/link";

interface Cheque {
  id: string;
  chequeNumber: string;
  bankName: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "PENDING" | "CLEARED" | "BOUNCED";
  type: "PAYABLE" | "RECEIVABLE";
  payeeName: string;
}

export default function ChequeSettlePage() {
  const [loading, setLoading] = useState(true);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "CLEARED" | "BOUNCED">("PENDING");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [clearingCheque, setClearingCheque] = useState<Cheque | null>(null);
  const [clearAccountId, setClearAccountId] = useState("");
  const [clearing, setClearing] = useState(false);

  const fetchCheques = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chequesApi.getAll();
      setCheques(res.data);
    } catch (e) {
      toast.error("Failed to load cheques");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await accountsApi.getAll();
      setAccounts(res.data);
      if (res.data.length > 0) setClearAccountId(res.data[0].id);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchCheques();
    fetchAccounts();
  }, [fetchCheques, fetchAccounts]);

  const handleConfirmClear = async () => {
    if (!clearingCheque || !clearAccountId) return;
    try {
      setClearing(true);
      await chequesApi.updateStatus(clearingCheque.id, "CLEARED", clearAccountId);
      toast.success("Cheque cleared and posted to the ledger");
      setClearingCheque(null);
      fetchCheques();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to clear cheque");
    } finally {
      setClearing(false);
    }
  };

  const filteredCheques = cheques.filter((c) => {
    const matchesSearch =
      c.chequeNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.payeeName.toLowerCase().includes(search.toLowerCase()) ||
      c.bankName.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "ALL" || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-[1400px] mx-auto h-[calc(100vh-100px)] flex flex-col space-y-6 py-6 px-4 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex items-center justify-between gap-6 bg-white dark:bg-card/40 p-8 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl shadow-black/[0.03]">
        <div className="flex items-center gap-6">
          <Link href="/pos" className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-slate-100 transition-all">
            <ArrowLeft size={20} className="text-slate-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-500 rounded-xl shadow-lg shadow-violet-500/20">
                <Landmark size={20} className="text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Cheque <span className="text-slate-400 font-medium italic">Settlement</span>
              </h1>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 ml-14">Manage post-dated and current cheques collection</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 dark:bg-white/5 p-1 rounded-2xl flex border border-slate-200 dark:border-white/10">
            {(["PENDING", "CLEARED", "BOUNCED", "ALL"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={clsx("px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filter === f ? "bg-white dark:bg-[#12141c] text-violet-600 shadow-lg shadow-black/5 border border-slate-100 dark:border-white/5" : "text-slate-400 hover:text-slate-600")}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Sidebar Filters */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-card/40 p-6 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-xl shadow-black/[0.02]">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-5 flex items-center gap-2">
              <Search size={14} className="text-violet-500" /> Search Registry
            </h3>
            <div className="relative group">
              <input type="text" placeholder="Cheque #, Bank, Name..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-4 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-500 transition-all" />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
            </div>
          </div>

          <div className="bg-white dark:bg-card/40 p-6 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-xl shadow-black/[0.02] flex flex-col items-center text-center space-y-4">
             <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <ShieldCheck size={32} />
             </div>
             <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uncleared Total</p>
               <h4 className="text-2xl font-black text-slate-900 dark:text-white">₹{cheques.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.amount, 0).toLocaleString()}</h4>
             </div>
             <p className="text-[9px] font-medium text-slate-400 leading-relaxed uppercase">
               Clearing a cheque here posts a real payment to the ledger and updates the chosen account&apos;s balance.
             </p>
          </div>
        </div>

        {/* Cheque List */}
        <div className="lg:col-span-3 bg-white dark:bg-card/40 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-2xl shadow-black/[0.03] overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 dark:border-white/5 flex items-center justify-between shrink-0">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Instrument Registry</h3>
            <span className="px-3 py-1 bg-violet-100 dark:bg-violet-500/10 text-violet-600 text-[10px] font-black rounded-lg uppercase">
              {filteredCheques.length} Instruments Found
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-8 scrollbar-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-300">
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest">Loading Registry...</p>
              </div>
            ) : filteredCheques.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 space-y-4 opacity-50">
                <AlertCircle size={48} strokeWidth={1.5} />
                <p className="text-sm font-black uppercase tracking-widest">No cheques match criteria</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                {filteredCheques.map(cheque => (
                  <div key={cheque.id} className={clsx("group p-6 rounded-[32px] border transition-all duration-300 relative overflow-hidden",
                    cheque.status !== 'PENDING' ? "bg-slate-50/50 border-slate-100 grayscale-[0.5]" : "bg-white dark:bg-[#12141c] border-slate-100 dark:border-white/5 hover:border-violet-300 dark:hover:border-violet-500/30 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1")}>

                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                          cheque.status === 'CLEARED' ? "bg-emerald-500/10 text-emerald-500" : cheque.status === 'BOUNCED' ? "bg-rose-500/10 text-rose-500" : "bg-violet-500/10 text-violet-500 group-hover:rotate-12")}>
                          <Landmark size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight">{cheque.bankName}</h4>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{cheque.chequeNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={clsx("text-xl font-black tracking-tight", cheque.status === 'CLEARED' ? "text-emerald-500" : cheque.status === 'BOUNCED' ? "text-rose-500" : "text-slate-900 dark:text-white")}>
                          ₹{cheque.amount.toLocaleString()}
                        </p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{cheque.type}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-50 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400"><User size={14} /></div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Payee</p>
                          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[80px]">{cheque.payeeName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400"><Calendar size={14} /></div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Due</p>
                          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{new Date(cheque.dueDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {cheque.status === 'PENDING' ? (
                        <button onClick={() => setClearingCheque(cheque)}
                          className="flex-1 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 active:scale-95">
                          <CheckCircle2 size={14} /> Mark Cleared
                        </button>
                      ) : (
                        <div className={clsx("flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2",
                          cheque.status === 'CLEARED' ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600")}>
                          <CheckCircle2 size={14} /> {cheque.status === 'CLEARED' ? 'Cleared & Settled' : 'Bounced'}
                        </div>
                      )}
                      <button className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl text-slate-400 hover:text-slate-900 transition-all">
                        <MoreVertical size={16} />
                      </button>
                    </div>

                    {cheque.status !== 'PENDING' && (
                       <div className="absolute top-4 right-4 rotate-12 opacity-10">
                          <CheckCircle2 size={120} />
                       </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Cheque Modal */}
      {clearingCheque && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-widest">Clear Cheque</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{clearingCheque.chequeNumber} · ₹{clearingCheque.amount.toLocaleString()}</p>
              </div>
              <button type="button" onClick={() => setClearingCheque(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Clearing this {clearingCheque.type === "RECEIVABLE" ? "incoming" : "outgoing"} cheque will
                {clearingCheque.type === "RECEIVABLE" ? " credit " : " debit "}
                the account below by ₹{clearingCheque.amount.toLocaleString()}.
              </p>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Clear Into / From Account *</label>
                <select
                  value={clearAccountId}
                  onChange={(e) => setClearAccountId(e.target.value)}
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-violet-500 transition-all">
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (₹{(a.balance || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-8 bg-slate-50 dark:bg-white/5 flex gap-3">
              <button type="button" onClick={() => setClearingCheque(null)} className="flex-1 py-4 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                disabled={clearing || !clearAccountId}
                className="flex-[2] py-4 bg-violet-500 hover:bg-violet-600 disabled:bg-slate-300 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-violet-500/20 transition-all">
                {clearing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                {clearing ? "Clearing..." : "Confirm Clearance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
