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

  // Fetch franchises if SUPER_ADMIN
  useEffect(() => {
    if (isSuper) {
      franchiseApi.getAll()
        .then((res) => {
          // Filter out main Headquarters/DC to focus on active franchise branches
          const branches = (res.data ?? []).filter((f: any) => 
            !f.name.includes("Headquarters (HQ)") && 
            f.id !== "hq-001"
          );
          setFranchises(branches);
        })
        .catch((err) => console.error("Failed to load franchises list", err));
    }
  }, [isSuper]);

  useEffect(() => {
    fetchDealers();
  }, [user, selectedFranchiseId]);

  const fetchDealers = async () => {
    setLoading(true);
    try {
      const fId = isSuper ? selectedFranchiseId : (user as any)?.franchiseId;
      const url = fId ? `/api/dealers?franchiseId=${fId}` : `/api/dealers`;
      const res = await api.get(url);
      setDealers(res.data);
    } catch (error) {
      toast.error("Failed to fetch dealers");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalFranchiseId = isSuper ? formData.franchiseId : (user as any)?.franchiseId;

    if (!finalFranchiseId) {
      toast.error("Please select a franchise branch.");
      return;
    }

    try {
      await api.post(`/api/dealers`, {
        ...formData,
        franchiseId: finalFranchiseId
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

        {/* Franchise Dropdown for Super Admin */}
        {isSuper && (
          <div>
            <select
              value={selectedFranchiseId}
              onChange={(e) => setSelectedFranchiseId(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-bold text-slate-700 dark:text-slate-300"
            >
              <option value="">All Franchise Branches</option>
              {franchises.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
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

      {/* Add Dealer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Add New B2B Dealer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              
              {/* Franchise Select Dropdown for Super Admin in Create Modal */}
              {isSuper && (
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Franchise Branch *</label>
                  <select
                    required
                    value={formData.franchiseId}
                    onChange={(e) => setFormData({...formData, franchiseId: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-700 dark:text-slate-300"
                  >
                    <option value="">Select Target Branch...</option>
                    {franchises.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Dealer Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Acme Distribution"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Email</label>
                  <input
                    type="email"
                    placeholder="dealer@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="Contact Number"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Full Address</label>
                <textarea
                  rows={3}
                  placeholder="Enter shop/office address..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm font-semibold"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  Save Dealer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
