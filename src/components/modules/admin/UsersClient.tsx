"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Search, 
  MoreHorizontal, 
  Shield, 
  Building2, 
  Mail, 
  Phone,
  Trash2,
  Pencil,
  Lock,
  CheckCircle2,
  XCircle,
  X
} from "lucide-react";
import { toast } from "react-hot-toast";
import axios from "axios";
import { userGovernanceApi, franchiseApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  franchiseId?: string | null;
  franchise?: { name: string };
  is_active: boolean;
  createdAt: string;
}

export default function UsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    franchiseId: "",
    roleName: "FRANCHISE_ADMIN", // Fixed for this view
  });

  const [franchises, setFranchises] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchFranchises();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await userGovernanceApi.getAll();
      setUsers(res.data);
    } catch (error) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchFranchises = async () => {
    try {
      const res = await franchiseApi.getAll();
      setFranchises(res.data);
    } catch (error) {
      console.error("Failed to fetch franchises");
    }
  };

  const resetForm = () =>
    setFormData({ fullName: "", email: "", phone: "", password: "", franchiseId: "", roleName: "FRANCHISE_ADMIN" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await userGovernanceApi.create({ ...formData, role: formData.roleName });
      toast.success("User created successfully");
      setShowAddModal(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to create user");
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      password: "",
      franchiseId: user.franchiseId || "",
      roleName: user.role,
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await userGovernanceApi.update(editingUser.id, {
        fullName: formData.fullName,
        franchiseId: formData.franchiseId,
        role: formData.roleName,
      });
      toast.success("User updated successfully");
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update user");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await userGovernanceApi.delete(id);
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete user");
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await userGovernanceApi.update(id, { is_active: !currentStatus });
      toast.success("User status updated");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex items-center justify-end pb-2 border-b border-slate-200 dark:border-white/10">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20 active:scale-95"
        >
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      {/* Stats & Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
          />
            {searchQuery && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearchQuery("")} 
              />
            )}
        </div>
        <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-orange-600 dark:text-orange-400">Total Users</span>
          <span className="text-2xl font-black text-orange-700 dark:text-orange-300">{users.length}</span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">User Details</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Franchise</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">Joined Date</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-4 h-16 bg-slate-50/50 dark:bg-slate-800/20" />
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 font-bold shrink-0">
                          {user.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{user.fullName}</p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1"><Mail size={10} /> {user.email}</span>
                            <span className="flex items-center gap-1"><Phone size={10} /> {user.phone || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                        <Building2 size={14} className="text-slate-400" />
                        {user.franchise?.name || <span className="text-orange-500 text-[10px] uppercase">Global Admin</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="w-fit px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {user.role === "SUPER_ADMIN" ? "Super Admin" : "Franchise Admin"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleStatus(user.id, user.is_active)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                          user.is_active 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                        }`}
                      >
                        {user.is_active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-2 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg text-slate-400 hover:text-orange-500 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">New System User</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Email</label>
                  <input
                    required
                    type="email"
                    placeholder="john@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="1234567890"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Account Role</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-sm"
                    value={formData.roleName}
                    onChange={e => setFormData({...formData, roleName: e.target.value, franchiseId: e.target.value === 'SUPER_ADMIN' ? "" : formData.franchiseId})}
                  >
                    <option value="FRANCHISE_ADMIN">Franchise Admin</option>
                    <option value="SUPER_ADMIN">HQ Super Admin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Assign Franchise</label>
                  <select
                    required={formData.roleName === 'FRANCHISE_ADMIN'}
                    disabled={formData.roleName === 'SUPER_ADMIN'}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-30 font-bold text-sm"
                    value={formData.franchiseId}
                    onChange={e => setFormData({...formData, franchiseId: e.target.value})}
                  >
                    <option value="">{formData.roleName === 'SUPER_ADMIN' ? "N/A (Global)" : "Select a Franchise"}</option>
                    {franchises.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Initial Password</label>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
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
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Edit User</h3>
              <button onClick={() => { setEditingUser(null); resetForm(); }} className="text-slate-400 hover:text-rose-500 transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Full Name</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Account Tier</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-sm"
                    value={formData.roleName}
                    onChange={e => setFormData({...formData, roleName: e.target.value, franchiseId: e.target.value === 'SUPER_ADMIN' ? "" : formData.franchiseId})}
                  >
                    <option value="FRANCHISE_ADMIN">Franchise Admin</option>
                    <option value="SUPER_ADMIN">HQ Super Admin</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Assign Franchise</label>
                  <select
                    disabled={formData.roleName === 'SUPER_ADMIN'}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-30 font-bold text-sm"
                    value={formData.franchiseId}
                    onChange={e => setFormData({...formData, franchiseId: e.target.value})}
                  >
                    <option value="">{formData.roleName === 'SUPER_ADMIN' ? "N/A (Global)" : "Select a Franchise"}</option>
                    {franchises.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setEditingUser(null); resetForm(); }}
                  className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
