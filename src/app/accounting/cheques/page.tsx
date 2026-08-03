"use client";

import { useState, useEffect } from "react";
import { 
  CreditCard, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Building2, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ArrowUpRight,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Stamp,
  X,
  Loader2,
  Save,
  ChevronDown
} from "lucide-react";
import { clsx } from "clsx";
import { chequesApi, franchiseApi, accountsApi } from "@/lib/api";
import { toast } from "react-hot-toast";

export default function ChequeRegistryPage() {
  const [cheques, setCheques] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalVolume: 0,
    pendingClearance: 0,
    clearedToday: 0,
    bouncedRisk: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "CLEARED" | "BOUNCED">("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    chequeNumber: "",
    bankName: "",
    payeeName: "",
    entityBranch: "",
    amount: "",
    type: "PAYABLE",
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    notes: "",
    franchiseId: ""
  });

  const [franchises, setFranchises] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [clearingCheque, setClearingCheque] = useState<any>(null);
  const [clearAccountId, setClearAccountId] = useState("");
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchData();
    fetchFranchises();
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await accountsApi.getAll();
      setAccounts(res.data);
      if (res.data.length > 0) setClearAccountId(res.data[0].id);
    } catch (error) {}
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [chequesRes, statsRes] = await Promise.all([
        chequesApi.getAll(),
        chequesApi.getStats()
      ]);
      setCheques(chequesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error("Failed to load cheque data");
    } finally {
      setLoading(false);
    }
  };

  const fetchFranchises = async () => {
    try {
      const res = await franchiseApi.getAll();
      setFranchises(res.data);
      if (res.data.length > 0) {
        setFormData(prev => ({ ...prev, franchiseId: res.data[0].id }));
      }
    } catch (error) {}
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await chequesApi.create(formData);
      toast.success("Cheque recorded successfully");
      setShowAddModal(false);
      fetchData();
      setFormData({
        chequeNumber: "",
        bankName: "",
        payeeName: "",
        entityBranch: "",
        amount: "",
        type: "PAYABLE",
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        notes: "",
        franchiseId: franchises[0]?.id || ""
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to record cheque");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await chequesApi.updateStatus(id, status);
      toast.success(`Cheque marked as ${status}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // Clearing moves real money — it needs a cash/bank account to clear into (for a
  // RECEIVABLE cheque) or out of (for a PAYABLE cheque), so it gets its own modal
  // instead of firing straight from the table row.
  const handleConfirmClear = async () => {
    if (!clearingCheque || !clearAccountId) return;
    try {
      setClearing(true);
      await chequesApi.updateStatus(clearingCheque.id, "CLEARED", clearAccountId);
      toast.success("Cheque cleared and posted to the ledger");
      setClearingCheque(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to clear cheque");
    } finally {
      setClearing(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case "CLEARED": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "BOUNCED": return "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400";
      case "PENDING": return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
      default: return "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400";
    }
  };

  const filteredCheques = cheques.filter(c => {
    const matchesSearch = c.chequeNumber.toLowerCase().includes(search.toLowerCase()) || 
                         c.payeeName.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "ALL" || c.status === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto p-4 md:p-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Stamp className="text-orange-500" size={32} />
            Cheque Registry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Manage Post-Dated Cheques (PDC), clearance cycles and bouncing records
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20 active:scale-95"
        >
          <Plus size={18} strokeWidth={3} />
          Record New Cheque
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Volume", value: `₹${stats.totalVolume.toLocaleString()}`, icon: Banknote, color: "text-slate-600" },
          { label: "Pending Clearance", value: `₹${stats.pendingClearance.toLocaleString()}`, icon: Clock, color: "text-amber-500" },
          { label: "Cleared Today", value: `₹${stats.clearedToday.toLocaleString()}`, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Bounced (Risk)", value: `₹${stats.bouncedRisk.toLocaleString()}`, icon: AlertCircle, color: "text-rose-500" },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-800 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit">
          {["ALL", "PENDING", "CLEARED", "BOUNCED"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={clsx(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === tab 
                  ? "bg-white dark:bg-slate-900 text-orange-500 shadow-sm" 
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative group w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search cheque # or payee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-medium text-sm"
          />
        </div>
      </div>

      {/* Cheque Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-orange-500" size={40} />
              <p className="text-sm font-bold text-slate-500">Syncing with registry...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-500">Cheque Info</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-500">Payee / Entity</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-500">Amount</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-500">Critical Dates</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-500">Status</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCheques.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Stamp size={40} className="text-slate-200" />
                        <p className="text-sm font-bold text-slate-400">No cheque records found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCheques.map((cheque) => (
                    <tr key={cheque.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-500 transition-all">
                            <Stamp size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{cheque.chequeNumber}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{cheque.bankName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{cheque.payeeName}</p>
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <Building2 size={12} />
                            {cheque.franchise?.name || 'HQ Central'}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-lg font-black text-slate-900 dark:text-white">₹{cheque.amount.toLocaleString()}</p>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${cheque.type === 'PAYABLE' ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {cheque.type}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <Calendar size={12} className="text-slate-300" />
                            Issued: {new Date(cheque.issueDate).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">
                            <Clock size={12} />
                            Due: {new Date(cheque.dueDate).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <span className={clsx(
                            "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2",
                            getStatusStyle(cheque.status)
                          )}>
                            <div className={clsx("w-1.5 h-1.5 rounded-full animate-pulse", 
                              cheque.status === 'CLEARED' ? 'bg-emerald-500' : 
                              cheque.status === 'BOUNCED' ? 'bg-rose-500' : 'bg-amber-500'
                            )} />
                            {cheque.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          {cheque.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => setClearingCheque(cheque)}
                                className="p-2.5 bg-emerald-50 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl transition-all"
                                title="Mark as Cleared"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleUpdateStatus(cheque.id, 'BOUNCED')}
                                className="p-2.5 bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all"
                                title="Mark as Bounced"
                              >
                                <AlertCircle size={18} />
                              </button>
                            </>
                          )}
                          <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-900 transition-all">
                            <MoreVertical size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── RECORD NEW CHEQUE MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <form onSubmit={handleCreate}>
              <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-widest">Record New Cheque</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry into Registry</p>
                </div>
                <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cheque Number *</label>
                    <input required type="text" placeholder="e.g. CHQ-889021"
                      value={formData.chequeNumber}
                      onChange={(e) => setFormData({...formData, chequeNumber: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bank Name *</label>
                    <input required type="text" placeholder="e.g. HDFC BANK"
                      value={formData.bankName}
                      onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Payee / Entity Name *</label>
                  <input required type="text" placeholder="e.g. Global Supplies Inc"
                    value={formData.payeeName}
                    onChange={(e) => setFormData({...formData, payeeName: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount (₹) *</label>
                    <input required type="number" placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type *</label>
                    <select required
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all appearance-none">
                      <option value="PAYABLE">PAYABLE (Outcome)</option>
                      <option value="RECEIVABLE">RECEIVABLE (Income)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Issue Date *</label>
                    <input required type="date"
                      value={formData.issueDate}
                      onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Due Date *</label>
                    <input required type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Franchise / Branch *</label>
                  <select required
                    value={formData.franchiseId}
                    onChange={(e) => setFormData({...formData, franchiseId: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all">
                    {franchises.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-white/5 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-4 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-[2] py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-orange-500/20 transition-all">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {saving ? "Recording..." : "Record Cheque"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CLEAR CHEQUE MODAL ── */}
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
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 transition-all">
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
                className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all">
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
