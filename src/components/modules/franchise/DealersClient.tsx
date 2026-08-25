"use client";

import { useState, useEffect } from "react";
import { X, 
  Users, 
  Plus, 
  Search, 
  Store, 
  Mail, 
  Phone,
  MapPin,
  Trash2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Building2
} from "lucide-react";
import { toast } from "react-hot-toast";
import api, { franchiseApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const dealerSectionLabelClass = "block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3 pb-2 border-b border-gray-100";

interface Dealer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  franchiseId: string;
  franchise?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export default function DealersClient() {
  const { user } = useAuth();
  const isSuper = user?.role === "SUPER_ADMIN";

  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  // HQ / Franchise scope — Super Admin only. Franchise Admin is always
  // implicitly scoped to their own franchiseId (see effectiveFranchiseId below).
  const [scope, setScope] = useState<"HQ" | "FRANCHISE">("HQ");
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    franchiseId: ""
  });

  // Fetch franchises if SUPER_ADMIN — includes HQ, since HQ Dealers are a
  // real, selectable scope now (resolved via franchise.isHQ, never by name/id).
  useEffect(() => {
    if (isSuper) {
      franchiseApi.getAll()
        .then((res) => setFranchises(res.data ?? []))
        .catch((err) => console.error("Failed to load franchises list", err));
    }
  }, [isSuper]);

  // HQ is resolved from the real Franchise row where isHQ === true — never a
  // hardcoded id or name.
  const hqFranchiseId = franchises.find((f: any) => f.isHQ)?.id;
  const effectiveFranchiseId = isSuper
    ? (scope === "HQ" ? hqFranchiseId : selectedFranchiseId)
    : (user as any)?.franchiseId;

  useEffect(() => {
    fetchDealers();
  }, [user, isSuper, scope, selectedFranchiseId, effectiveFranchiseId]);

  const fetchDealers = async () => {
    // Super Admin: wait for the franchise list (and therefore HQ resolution)
    // before fetching, and require an explicit franchise pick when scope is
    // FRANCHISE — never silently fall back to "all".
    if (isSuper && franchises.length === 0) return;
    if (isSuper && scope === "FRANCHISE" && !selectedFranchiseId) {
      setDealers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fId = effectiveFranchiseId;
      const url = fId ? `/api/dealers?franchiseId=${fId}` : `/api/dealers`;
      const res = await api.get(url);
      setDealers(res.data);
    } catch (error) {
      toast.error("Failed to fetch dealers");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Dealer Name is required.");
      return;
    }

    const finalFranchiseId = isSuper ? effectiveFranchiseId : (user as any)?.franchiseId;

    if ((isSuper && scope === "FRANCHISE" && !finalFranchiseId) || (!isSuper && !finalFranchiseId)) {
      toast.error(isSuper ? "Select a franchise branch first." : "Please select a franchise branch.");
      return;
    }

    try {
      await api.post(`/api/dealers`, {
        ...formData,
        franchiseId: finalFranchiseId || null
      });
      toast.success("Dealer added successfully");
      setShowAddModal(false);
      setFormData({ name: "", email: "", phone: "", address: "", franchiseId: "" });
      fetchDealers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add dealer");
    }
  };

  const filteredDealers = dealers.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.franchise?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="text-blue-500" size={24} />
            Dealer Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSuper ? "Global oversight of B2B partners across all franchises" : "Manage your franchise's B2B distribution network"}
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({
              name: "",
              email: "",
              phone: "",
              address: "",
              franchiseId: isSuper ? "" : (user as any)?.franchiseId || ""
            });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus size={18} />
          Add New Dealer
        </button>
      </div>

      {/* Filters Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search dealers by name, email, or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold"
          />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
        </div>

        {/* HQ / Franchise Scope Selector for Super Admin */}
        {isSuper && (
          <div className="space-y-2">
            <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => setScope("HQ")}
                className={`flex-1 text-xs font-bold py-2 rounded-xl transition-colors ${scope === "HQ" ? "bg-blue-600 text-white" : "text-slate-500"}`}
              >
                HQ
              </button>
              <button
                type="button"
                onClick={() => setScope("FRANCHISE")}
                className={`flex-1 text-xs font-bold py-2 rounded-xl transition-colors ${scope === "FRANCHISE" ? "bg-blue-600 text-white" : "text-slate-500"}`}
              >
                Franchise
              </button>
            </div>
            {scope === "FRANCHISE" && (
              <select
                value={selectedFranchiseId}
                onChange={(e) => setSelectedFranchiseId(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="">Select Franchise Branch</option>
                {franchises.filter((f: any) => !f.isHQ).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 rounded-2xl p-4 flex items-center justify-between md:col-span-1">
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Total network size</span>
          <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{dealers.length}</span>
        </div>
      </div>

      {/* Grid List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Dealer Name</th>
                {isSuper && <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Franchise Branch</th>}
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Contact Info</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Address</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={isSuper ? 5 : 4} className="px-6 py-4 h-16 bg-slate-50/50 dark:bg-slate-800/20" />
                  </tr>
                ))
              ) : filteredDealers.length === 0 ? (
                <tr>
                  <td colSpan={isSuper ? 5 : 4} className="px-6 py-12 text-center text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    No B2B dealers registered.
                  </td>
                </tr>
              ) : (
                filteredDealers.map((dealer) => (
                  <tr key={dealer.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 font-bold shrink-0">
                          {dealer.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{dealer.name}</p>
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mt-1 inline-block">
                            {dealer.status}
                          </span>
                        </div>
                      </div>
                    </td>
                    {isSuper && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 font-bold">
                          <Building2 size={13} className="text-slate-400" />
                          <span>{dealer.franchise?.name || "Independent"}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Mail size={12} className="text-slate-400" /> {dealer.email || 'N/A'}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-2 font-medium">
                          <Phone size={12} className="text-slate-400" /> {dealer.phone || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{dealer.address || 'No address provided'}</span>
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-blue-500 transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Dealer Modal — same visual language as the Vendor/Customer Add
          modal (AddPartyModal): black/50 overlay, rounded-[2rem] panel,
          uppercase section labels, orange Save button. Kept as its own
          component since Dealer's field set is much smaller and shouldn't be
          forced through AddPartyModal's vendor/customer-specific logic. */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-800">ADD DEALER</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Target scope — driven entirely by the HQ/Franchise selector
                  above, read only, not a second independent picker. */}
              {isSuper && (
                <div>
                  <label className={dealerSectionLabelClass}>Target Scope</label>
                  <div className="w-full border border-orange-200 bg-orange-50 rounded-lg px-3 py-2.5 text-sm font-semibold text-orange-700">
                    {scope === "HQ"
                      ? `HQ — ${franchises.find((f: any) => f.isHQ)?.name || "Main Headquarters"}`
                      : (franchises.find((f: any) => f.id === selectedFranchiseId)?.name ? `Franchise — ${franchises.find((f: any) => f.id === selectedFranchiseId)?.name}` : "No franchise selected — pick one above")}
                  </div>
                </div>
              )}

              {/* SECTION: Business Information */}
              <div>
                <label className={dealerSectionLabelClass}>Business Information</label>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Dealer Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Acme Distribution"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
                      <input
                        type="email"
                        placeholder="dealer@example.com"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
                      <input
                        type="tel"
                        placeholder="Contact Number"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: Address — the Dealer model only has a single free-text
                  address field today (no shippingAddress/GST/commercial fields),
                  so those sections from the Customer modal are intentionally
                  omitted here rather than inventing new fields. */}
              <div>
                <label className={dealerSectionLabelClass}>Address</label>
                <textarea
                  rows={3}
                  placeholder="Enter shop/office address..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors resize-none"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 flex items-center justify-between shrink-0 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Save Dealer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
