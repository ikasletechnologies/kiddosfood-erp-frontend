"use client";

import { useState, useEffect } from "react";
import { X, 
  Users, 
  Plus, 
  Search, 
  UserCheck, 
  Mail, 
  Phone,
  Tag,
  Trash2,
  XCircle,
  MoreVertical,
  Briefcase
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Partner {
  id: string;
  name: string;
  type: 'RETAILER' | 'DISTRIBUTOR' | 'BUSINESS_OWNER';
  email: string;
  phone: string;
  address: string;
  status: string;
  createdAt: string;
}

export default function BusinessPartnersClient({ defaultType }: { defaultType?: 'RETAILER' | 'DISTRIBUTOR' | 'BUSINESS_OWNER' }) {
  const { user } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    type: defaultType || "RETAILER",
    email: "",
    phone: "",
    address: "",
    franchiseId: (user as any)?.franchiseId || ""
  });

  useEffect(() => {
    if ((user as any)?.franchiseId) {
      fetchPartners();
    }
  }, [user]);

  const fetchPartners = async () => {
    try {
      const res = await api.get(`/api/business-partners?franchiseId=${(user as any).franchiseId}${defaultType ? `&type=${defaultType}` : ""}`);
      setPartners(res.data);
    } catch (error) {
      toast.error("Failed to fetch business partners");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/business-partners`, {
        ...formData,
        franchiseId: (user as any).franchiseId
      });
      toast.success(`${formData.type === 'RETAILER' ? 'Retailer' : 'Distributor'} added successfully`);
      setShowAddModal(false);
      setFormData({ name: "", type: "RETAILER", email: "", phone: "", address: "", franchiseId: (user as any).franchiseId });
      fetchPartners();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add partner");
    }
  };

  const filteredPartners = partners.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end pb-2 border-b border-slate-200 dark:border-white/10">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95"
        >
          <Plus size={18} />
          Add New Partner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search partners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
          />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
        </div>
        <div className="bg-purple-50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/10 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-purple-600 dark:text-purple-400">Total Partners</span>
          <span className="text-2xl font-black text-purple-700 dark:text-purple-300">{partners.length}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Partner Name</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Contact</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-4 h-16 bg-slate-50/50 dark:bg-slate-800/20" />
                  </tr>
                ))
              ) : filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No business partners found.
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 font-bold shrink-0">
                          {partner.name.charAt(0)}
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white">{partner.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        partner.type === 'BUSINESS_OWNER' 
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' 
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                      }`}>
                        <Tag size={10} />
                        {partner.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{partner.email || 'No Email'}</p>
                        <p className="text-[11px] text-slate-500">{partner.phone || 'No Phone'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-purple-500 transition-colors">
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

      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Add Partner</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Partner Name</label>
                <input
                  required
                  type="text"
                  placeholder="Full name or Company name"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Partner Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'RETAILER'})}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      formData.type === 'RETAILER' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Retailer
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: 'BUSINESS_OWNER'})}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      formData.type === 'BUSINESS_OWNER' 
                        ? 'bg-amber-500 text-white' 
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Distributor
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Email</label>
                  <input
                    type="email"
                    placeholder="partner@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="Contact Number"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Address</label>
                <textarea
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none"
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
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
