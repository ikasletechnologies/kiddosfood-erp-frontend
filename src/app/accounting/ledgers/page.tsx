"use client";

import { useState, useEffect, useCallback } from "react";
import { X,
  Building2,
  Search,
  ArrowDownRight,
  FileText,
  Plus,
  ShieldAlert,
  ChevronRight,
  Calculator,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { clsx } from "clsx";
import { franchiseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";

interface Franchise {
  id: string;
  name: string;
  location: string;
  ownerName: string;
  contactNum: string;
  status: string;
  outstandingAmount: number;
  creditLimit: number;
  walletBalance: number;
  isHQ?: boolean;
  ledgerEntries?: Array<{
    id: string;
    type: "DEBIT" | "CREDIT";
    amount: number;
    balanceAfter: number;
    referenceType: string;
    referenceId?: string;
    note?: string;
    createdAt: string;
  }>;
}

interface LedgerLine {
  id: string;
  date: string;
  type: string;
  ref?: string;
  reference?: string;
  description?: string;
  debit: number | null;
  credit: number | null;
}

export default function BranchLedgerPage() {
  const { user } = useAuth();
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loadingFranchises, setLoadingFranchises] = useState(true);
  const [franchiseError, setFranchiseError] = useState<string | null>(null);

  const [activeFranchiseId, setActiveFranchiseId] = useState<string | null>(null);
  const [ledgerLines, setLedgerLines] = useState<(LedgerLine & { balance: number })[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  // Fetch franchises
  const fetchFranchises = useCallback(async () => {
    setLoadingFranchises(true);
    setFranchiseError(null);
    try {
      const res = await franchiseApi.getAll();
      const data: Franchise[] = res.data?.franchises ?? res.data ?? [];
      // Filter out HQ since HQ is the main settlement entity and doesn't
      // settle with itself — Franchise.isHQ is the one real definition of
      // HQ (see FranchiseService.getHqFranchise), not a name/id guess.
      let filtered = data.filter((f) => !f.isHQ);

      // If the user is a franchise admin, filter only their own franchise
      if (user && user.role === "FRANCHISE_ADMIN" && user.franchiseId) {
        filtered = filtered.filter((f) => f.id === user.franchiseId);
      }

      setFranchises(filtered);
      // Auto-select first franchise
      if (filtered.length > 0 && !activeFranchiseId) {
        setActiveFranchiseId(filtered[0].id);
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      setFranchiseError(
        err?.response?.data?.error || err.message || "Failed to load branch directory"
      );
      setFranchises([]);
    } finally {
      setLoadingFranchises(false);
    }
  }, [activeFranchiseId, user]);

  // Fetch ledger when franchise changes
  const fetchLedger = useCallback(async (franchiseId: string) => {
    // If franchise admin, restrict to their own franchiseId
    if (user && user.role === "FRANCHISE_ADMIN" && user.franchiseId && franchiseId !== user.franchiseId) {
      franchiseId = user.franchiseId;
    }
    setLoadingLedger(true);
    setLedgerError(null);
    try {
      const res = await franchiseApi.getById(franchiseId);
      const franchise: Franchise = res.data;
      const rawEntries = franchise.ledgerEntries || [];

      // Calculate running balances
      const computed = rawEntries.map((line) => {
        const isDebit = line.type === "DEBIT";
        const debit = isDebit ? line.amount : null;
        const credit = !isDebit ? line.amount : null;

        return {
          id: line.id,
          date: line.createdAt,
          type: line.referenceType,
          ref: line.referenceId || "—",
          reference: line.referenceId || "—",
          description: line.note || "",
          debit,
          credit,
          balance: line.balanceAfter,
        };
      });
      setLedgerLines(computed);
    } catch (err: any) {
      console.error("Fetch ledger error:", err);
      setLedgerError(
        err?.response?.data?.error || err.message || "Failed to load branch ledger statement"
      );
      setLedgerLines([]);
    } finally {
      setLoadingLedger(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFranchises();
  }, [fetchFranchises]);

  useEffect(() => {
    if (user && user.role === "FRANCHISE_ADMIN" && user.franchiseId) {
      setActiveFranchiseId(user.franchiseId);
    }
  }, [user]);

  useEffect(() => {
    if (activeFranchiseId) fetchLedger(activeFranchiseId);
  }, [activeFranchiseId, fetchLedger]);

  const filteredFranchises = franchises.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const activeFranchise = franchises.find((f) => f.id === activeFranchiseId);
  const totalOwed = activeFranchise?.outstandingAmount ?? 0;

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row gap-4 sm:gap-6 p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 animate-in fade-in duration-500">
      {/* LEFT: BRANCH DIRECTORY */}
      <div className="w-full md:w-80 flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shrink-0 shadow-sm md:h-full">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 size={16} className="text-orange-500" />
              Branch Directory
            </h2>
            <button
              onClick={fetchFranchises}
              disabled={loadingFranchises}
              className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50 transition-all active:scale-95"
            >
              <RefreshCw size={14} className={loadingFranchises ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
            <input
              type="text"
              placeholder="Search branches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-orange-500 transition-all"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
          {/* Loading */}
          {loadingFranchises &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-3/4" />
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}

          {/* Error */}
          {!loadingFranchises && franchiseError && (
            <div className="p-6 text-center bg-red-50 dark:bg-red-950/20 m-4 rounded-xl border border-red-100 dark:border-red-900/30">
              <AlertCircle size={24} className="mx-auto text-red-400 mb-2" />
              <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">{franchiseError}</p>
              <button onClick={fetchFranchises} className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors">
                Retry Connection
              </button>
            </div>
          )}

          {/* Empty */}
          {!loadingFranchises && !franchiseError && filteredFranchises.length === 0 && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-100 dark:border-slate-700">
                <Building2 size={20} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {search ? "No branches match your search." : "Branch directory is empty."}
              </p>
            </div>
          )}

          {/* Franchise list */}
          {!loadingFranchises &&
            !franchiseError &&
            filteredFranchises.map((franchise) => {
              const isActive = franchise.id === activeFranchiseId;
              return (
                <button
                  key={franchise.id}
                  onClick={() => setActiveFranchiseId(franchise.id)}
                  className={clsx(
                    "w-full text-left p-4 flex items-center gap-3 transition-all relative overflow-hidden group",
                    isActive ? "bg-orange-50 dark:bg-orange-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  )}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />}
                  <div
                    className={clsx(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all",
                      isActive
                        ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-600 group-hover:text-orange-500 shadow-sm"
                    )}
                  >
                    <Building2 size={18} />
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <h3
                      className={clsx(
                        "text-sm font-bold truncate transition-colors",
                        isActive ? "text-orange-700 dark:text-orange-400" : "text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400"
                      )}
                    >
                      {franchise.name}
                    </h3>
                    <p className={clsx("text-xs font-semibold truncate mt-0.5", isActive ? "text-orange-500/80 dark:text-orange-400/80" : "text-slate-500 dark:text-slate-400")}>
                      {franchise.location || "Branch Outlet"}
                    </p>
                  </div>
                  <ChevronRight size={16} className={clsx("transition-transform group-hover:translate-x-1 shrink-0", isActive ? "text-orange-500" : "text-slate-300 dark:text-slate-600")} />
                </button>
              );
            })}
        </div>
      </div>

      {/* RIGHT: LEDGER VIEW */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden min-w-0 shadow-sm md:h-full">
        {activeFranchise ? (
          <>
            {/* Ledger Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-start justify-between gap-6 bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30">
                    ID: {activeFranchise.id}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator size={14} className="text-slate-400" />
                    Absolute Ledger Truth
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate max-w-2xl mb-2 tracking-tight">
                  {activeFranchise.name}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-lg leading-relaxed">
                  Balances calculate dynamically based solely on debits (orders placed) and credits (payments processed). Balances are never statically stored.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 shrink-0 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="w-full sm:w-auto sm:pr-6 sm:border-r border-slate-200 dark:border-slate-700 text-center sm:text-right">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Total Outstanding
                  </p>
                  {loadingLedger ? (
                    <div className="h-8 w-24 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse mx-auto sm:ml-auto sm:mr-0" />
                  ) : (
                    <p className={clsx("text-2xl font-bold tabular-nums tracking-tight", totalOwed > 0 ? "text-red-600 dark:text-red-500" : "text-emerald-600 dark:text-emerald-500")}>
                      {totalOwed > 0 ? "₹" : ""}
                      {totalOwed.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
                <div className="w-full sm:w-auto flex sm:flex-col justify-between sm:justify-start gap-4 sm:gap-2 text-left min-w-[120px]">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Credit Limit</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">₹{activeFranchise.creditLimit?.toLocaleString("en-IN") || 0}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Wallet Balance</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-500">₹{activeFranchise.walletBalance?.toLocaleString("en-IN") || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="flex-1 overflow-auto flex flex-col bg-white dark:bg-slate-800">
              <div className="overflow-x-auto min-w-full inline-block align-middle">
                <table className="min-w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                    <tr className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-6 py-4 whitespace-nowrap">Date</th>
                      <th className="px-6 py-4 whitespace-nowrap">Reference</th>
                      <th className="px-6 py-4 whitespace-nowrap">Entry Type</th>
                      <th className="px-6 py-4 text-right whitespace-nowrap">
                        Debit <span className="text-red-500 ml-1">(+)</span>
                      </th>
                      <th className="px-6 py-4 text-right whitespace-nowrap">
                        Credit <span className="text-emerald-500 ml-1">(-)</span>
                      </th>
                      <th className="px-6 py-4 text-right whitespace-nowrap">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {/* Loading skeleton */}
                    {loadingLedger &&
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j} className="px-6 py-4">
                              <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-full" />
                            </td>
                          ))}
                        </tr>
                      ))}

                    {/* Error */}
                    {!loadingLedger && ledgerError && (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <div className="w-12 h-12 bg-red-50 dark:bg-red-950/20 rounded-xl flex items-center justify-center mx-auto mb-3 border border-red-100 dark:border-red-900/30">
                            <AlertCircle size={24} className="text-red-500" />
                          </div>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">{ledgerError}</p>
                          <button
                            onClick={() => activeFranchiseId && fetchLedger(activeFranchiseId)}
                            className="text-xs uppercase font-bold tracking-wider text-orange-500 hover:text-orange-600 transition-colors"
                          >
                            Retry Request
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* Empty */}
                    {!loadingLedger && !ledgerError && ledgerLines.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center">
                          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-700">
                            <ShieldAlert size={28} className="text-slate-400" />
                          </div>
                          <p className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                            Blank Ledger
                          </p>
                          <p className="text-sm font-medium text-slate-400">
                            Operational entries will sequentially appear here once recorded.
                          </p>
                        </td>
                      </tr>
                    )}

                    {/* Data rows */}
                    {!loadingLedger &&
                      !ledgerError &&
                      ledgerLines.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                              {formatDate(line.date)}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm max-w-[200px] truncate">
                              {line.ref || line.reference || line.description || "—"}
                            </p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {line.type === "ORDER" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30">
                                <FileText size={14} /> Branch Order
                              </span>
                            ) : line.type === "PAYMENT" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30">
                                <ArrowDownRight size={14} /> Payment Received
                              </span>
                            ) : line.type === "ADJUSTMENT" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/30">
                                <Plus size={14} /> Adjustment
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                {line.type || "System Entry"}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {line.debit ? (
                              <span className="font-bold text-red-600 dark:text-red-500 tabular-nums">
                                ₹{line.debit.toLocaleString("en-IN")}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {line.credit ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-500 tabular-nums">
                                ₹{line.credit.toLocaleString("en-IN")}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <span
                              className={clsx(
                                "font-bold text-sm tabular-nums",
                                line.balance > 0 ? "text-slate-900 dark:text-white" : "text-emerald-600 dark:text-emerald-500"
                              )}
                            >
                              ₹{line.balance.toLocaleString("en-IN")}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-6">
              <Building2 size={32} className="text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Select a Branch Record</h3>
            <p className="text-sm font-medium max-w-sm mx-auto leading-relaxed">
              Choose a franchise branch from the sidebar to inspect their immutable source of truth ledger and outstanding settlement data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
