"use client";

import { useState, useEffect } from "react";
import {
  X,
  Plus as PlusIcon,
  Search as SearchIcon,
  CheckCircle2 as CheckCircle2Icon,
  XCircle as XCircleIcon,
  Clock as ClockIcon,
  CheckCircle as CheckCircleIcon,
  Loader2 as Loader2Icon,
  Eye as EyeIcon,
  RefreshCw,
  RotateCcw
} from "lucide-react";
import api from "@/lib/api/base";
import { clsx } from "clsx";
import PurchaseReturnDetailsModal from "./PurchaseReturnDetailsModal";
import NewPurchaseReturnModal from "./NewPurchaseReturnModal";
import { useToast } from "@/context/ToastContext";
import { formatDate } from "@/lib/utils";

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: "Pending",   color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-900/40" },
  APPROVED:  { label: "Approved",  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-900/40" },
  COMPLETED: { label: "Completed", color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-900/40" },
  CANCELLED: { label: "Cancelled", color: "text-gray-600 dark:text-slate-400",  bg: "bg-gray-50 dark:bg-white/5",         border: "border-gray-200 dark:border-white/10" },
  REJECTED:  { label: "Rejected",  color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-950/30",    border: "border-rose-200 dark:border-rose-900/40" },
};

export default function PurchaseReturnsClient() {
  const [returns, setReturns] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  // Details view
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);

  const { showToast } = useToast();

  async function loadData() {
    setLoading(true);
    try {
      const [rRes, vRes] = await Promise.all([
        api.get("/api/purchase/returns", { params: { search, status: statusFilter } }),
        api.get("/api/vendors")
      ]);
      setReturns(rRes.data || []);
      setVendors(vRes.data || []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load purchase returns", "error");
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [search, statusFilter]);

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch(`/api/purchase/returns/${id}`, { status });
      showToast(`Return marked as ${status}`, "success");
      if (selectedReturn?.id === id) {
        setSelectedReturn(null);
      }
      loadData();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Failed to update status", "error");
    }
  }

  const filteredReturns = returns.filter(r => {
    const matchSearch = !search ||
      r.returnNumber?.toLowerCase().includes(search.toLowerCase()) ||
      r.vendor?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background text-gray-800 dark:text-foreground">
      {/* ── Page Header Toolbar ── */}
      <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-white/5 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-800 dark:text-white">Purchase Returns</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">Manage vendor returns & GRN rejections</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all cursor-pointer"
        >
          <PlusIcon className="h-4 w-4" /> New Purchase Return
        </button>
      </div>

      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {[
            { label: "All Returns", status: "", dot: "bg-gray-400", color: "text-gray-900 dark:text-white" },
            { label: "Pending", status: "PENDING", dot: "bg-amber-500", color: "text-amber-700 dark:text-amber-400" },
            { label: "Approved", status: "APPROVED", dot: "bg-emerald-500", color: "text-emerald-700 dark:text-emerald-400" },
            { label: "Completed", status: "COMPLETED", dot: "bg-blue-500", color: "text-blue-700 dark:text-blue-400" },
            { label: "Cancelled", status: "CANCELLED", dot: "bg-rose-500", color: "text-rose-700 dark:text-rose-400" },
          ].map(s => {
            const count = s.status === "" ? returns.length : returns.filter(r => r.status === s.status).length;
            const isActive = statusFilter === s.status;
            return (
              <div
                key={s.label}
                onClick={() => setStatusFilter(s.status)}
                className={clsx(
                  "bg-white dark:bg-card rounded-lg border px-4 py-3 flex items-center gap-3 shadow-sm cursor-pointer transition-colors",
                  isActive
                    ? "border-[#f58220] ring-1 ring-[#f58220]/20"
                    : "border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10"
                )}
              >
                <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} />
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{s.label}</p>
                  <p className={clsx("text-lg font-bold mt-0.5", s.color)}>{count}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search return # or vendor..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-[#f58220] bg-white dark:bg-card text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            {search && (
              <X
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                onClick={() => setSearch("")}
              />
            )}
          </div>

          <div className="flex items-center bg-white dark:bg-card border border-gray-200 dark:border-white/10 rounded-lg p-1 text-xs gap-1">
            {[
              { label: "All", value: "" },
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" },
              { label: "Completed", value: "COMPLETED" },
              { label: "Cancelled", value: "CANCELLED" },
            ].map(st => (
              <button
                key={st.label}
                onClick={() => setStatusFilter(st.value)}
                className={clsx(
                  "px-3 py-1 rounded font-semibold transition-colors cursor-pointer",
                  statusFilter === st.value
                    ? "bg-[#f58220] text-white"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            className="p-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-card rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors ml-auto cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400 dark:text-slate-500 flex flex-col items-center gap-2">
            <Loader2Icon className="animate-spin text-[#f58220] h-6 w-6" />
            <span>Loading returns...</span>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 p-12 text-center shadow-sm">
            <RotateCcw className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">No Purchase Returns Found</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Process vendor returns or GRN rejections.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="inline-flex items-center gap-1.5 bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" /> New Purchase Return
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Return #</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredReturns.map(r => {
                  const style = STATUS_STYLES[r.status] || {
                    label: r.status,
                    color: "text-gray-600 dark:text-slate-400",
                    bg: "bg-gray-50 dark:bg-white/5",
                    border: "border-gray-200 dark:border-white/10"
                  };

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedReturn(r)}
                      className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-xs font-bold text-gray-800 dark:text-white">
                        {r.returnNumber}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-slate-200">
                        {r.vendor?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.returnSource === "GRN_REJECTION" ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/40">
                            GRN REJECTION
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-white/10">
                            NORMAL RETURN
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-white">
                        ₹ {(r.refundAmount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx("inline-block px-2 py-0.5 rounded text-[11px] font-semibold border", style.color, style.bg, style.border)}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedReturn(r); }}
                          className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 rounded text-xs font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewForm && (
        <NewPurchaseReturnModal
          vendors={vendors}
          onClose={() => setShowNewForm(false)}
          onSuccess={() => {
            setShowNewForm(false);
            loadData();
          }}
        />
      )}

      {selectedReturn && (
        <PurchaseReturnDetailsModal
          data={selectedReturn}
          onClose={() => setSelectedReturn(null)}
          onUpdateStatus={updateStatus}
        />
      )}
    </div>
  );
}

