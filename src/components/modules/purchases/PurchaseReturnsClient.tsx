"use client";

import { useState, useEffect } from "react";
import { X, 
  Plus as PlusIcon, 
  Search as SearchIcon, 
  CheckCircle2 as CheckCircle2Icon, 
  XCircle as XCircleIcon, 
  Clock as ClockIcon, 
  CheckCircle as CheckCircleIcon, 
  Loader2 as Loader2Icon,
  Eye as EyeIcon
} from "lucide-react";
import api from "@/lib/api/base";
import { clsx } from "clsx";
import PurchaseReturnDetailsModal from "./PurchaseReturnDetailsModal";
import NewPurchaseReturnModal from "./NewPurchaseReturnModal";
import { useToast } from "@/context/ToastContext";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600 border-amber-100/50",
  APPROVED: "bg-emerald-50 text-emerald-600 border-emerald-100/50",
  REJECTED: "bg-rose-50 text-rose-600 border-rose-100/50",
  COMPLETED: "bg-blue-50 text-blue-600 border-blue-100/50",
  CANCELLED: "bg-gray-50 text-gray-600 border-gray-100/50"
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
        setSelectedReturn(null); // Close modal if open to refresh
      }
      loadData();
    } catch (e: any) {
      showToast(e.response?.data?.error || "Failed to update status", "error");
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-6 space-y-8 animate-in fade-in duration-500">
      <div className="max-w-[1500px] mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Purchase Returns</h1>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">Manage vendor returns & GRN rejections</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewForm(true)}
              className="px-6 py-2.5 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2"
            >
              <PlusIcon size={16} /> New Purchase Return
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
          {[
            { label: "All", status: "", icon: ClockIcon, color: "text-gray-500", bg: "bg-gray-50/30 dark:bg-gray-500/5" },
            { label: "Pending", status: "PENDING", icon: ClockIcon, color: "text-amber-500", bg: "bg-amber-50/30 dark:bg-amber-500/5" },
            { label: "Approved", status: "APPROVED", icon: CheckCircle2Icon, color: "text-emerald-500", bg: "bg-emerald-50/30 dark:bg-emerald-500/5" },
            { label: "Completed", status: "COMPLETED", icon: CheckCircleIcon, color: "text-blue-500", bg: "bg-blue-50/30 dark:bg-blue-500/5" },
            { label: "Cancelled", status: "CANCELLED", icon: XCircleIcon, color: "text-rose-500", bg: "bg-rose-50/30 dark:bg-rose-500/5" },
          ].map(s => {
            const count = s.status === "" ? returns.length : returns.filter(r => r.status === s.status).length;
            return (
              <div 
                key={s.label} 
                onClick={() => setStatusFilter(s.status)}
                className={clsx(
                  "rounded-[2rem] p-6 border cursor-pointer shadow-sm text-center transition-all",
                  statusFilter === s.status 
                    ? "border-orange-200 bg-orange-50/50 shadow-orange-500/10" 
                    : "border-gray-100 hover:border-orange-100 hover:bg-orange-50/10 bg-white"
                )}
              >
                <div className={clsx("text-4xl font-black tracking-tighter mb-2", s.color)}>
                  {count}
                </div>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">{s.label}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search returns..."
              className="w-full pl-12 pr-6 py-3.5 bg-white dark:bg-[#12141c] border border-gray-100 dark:border-white/5 rounded-2xl text-sm font-bold shadow-xl shadow-black/[0.02] outline-none focus:ring-2 ring-orange-500/10 focus:border-orange-500 transition-all"
            />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-6 py-3.5 text-sm bg-white dark:bg-[#12141c] border border-gray-100 dark:border-white/5 rounded-2xl font-black uppercase tracking-widest outline-none ring-orange-500/10 focus:ring-4 transition-all"
          >
            <option value="">All Status</option>
            {["PENDING","APPROVED","COMPLETED","CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="bg-white dark:bg-[#12141c] rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-xl shadow-black/[0.02] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
              <tr>
                {["Return #","Vendor","Source","Amount","Date","Status",""].map(h => (
                  <th key={h} className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="px-8 py-16 text-center"><Loader2Icon className="mx-auto text-orange-500 animate-spin" /></td></tr>
              ) : returns.length === 0 ? (
                <tr><td colSpan={7} className="px-8 py-16 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">No purchase returns found</td></tr>
              ) : returns.map((r) => (
                <tr 
                  key={r.id} 
                  onClick={() => setSelectedReturn(r)}
                  className="hover:bg-gray-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-8 py-5 font-bold text-xs text-orange-600 font-mono tracking-tighter">{r.returnNumber}</td>
                  <td className="px-8 py-5">
                    <div className="font-black text-gray-900 dark:text-white uppercase text-xs">{r.vendor?.name}</div>
                  </td>
                  <td className="px-8 py-5">
                    {r.returnSource === "GRN_REJECTION" ? (
                      <span className="px-2 py-1 rounded text-[10px] font-black tracking-widest bg-purple-50 text-purple-600 border border-purple-100">
                        GRN REJECTION
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-[10px] font-black tracking-widest bg-gray-50 text-gray-500 border border-gray-200">
                        NORMAL RETURN
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5">
                     <span className="text-sm font-black text-gray-800">₹{r.refundAmount?.toLocaleString()}</span>
                  </td>
                  <td className="px-8 py-5 text-gray-500 text-xs font-bold">
                    {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-8 py-5">
                    <span className={clsx(
                      "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border inline-block",
                      STATUS_COLORS[r.status] || STATUS_COLORS.PENDING
                    )}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-gray-400 hover:text-gray-600">
                      <EyeIcon size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
