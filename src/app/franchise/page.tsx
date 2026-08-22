"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { SlideOver } from "@/components/ui/SlideOver";
import { 
  Building2, Plus, X, MapPin, User, Phone, Edit2, Trash2, 
  RefreshCw, Search, Shield, Key, Eye, EyeOff, MoreVertical,
  AlertTriangle, CheckCircle2, Info, Power, Terminal
} from "lucide-react";
import { clsx } from "clsx";
import { franchiseApi, userGovernanceApi, default as api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  INACTIVE: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-slate-400",
  PENDING:  "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
};

const EMPTY_FORM = { 
  name: "", 
  location: "", 
  ownerName: "", 
  contactNum: "", 
  status: "ACTIVE",
  dashboardPassword: "",
  adminUser: {
    email: "",
    password: "",
    fullName: ""
  }
};

export default function FranchisePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<any>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  
  // Role Protection
  useEffect(() => {
    if (!loading && currentUser && currentUser.role === 'FRANCHISE_ADMIN') {
      router.push('/franchise/dashboard');
    }
  }, [currentUser, loading, router]);
  
  const [activeTab, setActiveTab] = useState<'info' | 'users'>('info');
  const [selectedFranchiseUsers, setSelectedFranchiseUsers] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ type: 'error' | 'success' | 'info', title: string, message: string } | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({ fullName: "", email: "", password: "", roleId: "FRANCHISE_ADMIN" });
  const [roles, setRoles] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const fetchFranchises = useCallback(async () => {
    setLoading(true);
    try {
      const res = await franchiseApi.getAll();
      // Filter out internal HQ and confusing duplicates to maintain 2-level hierarchy
      const cleanList = (res.data ?? []).filter((f: any) => 
        !f.name.includes("Headquarters (HQ)") && 
        !f.name.includes("Distribution Center") &&
        f.id !== "hq-001" // Main HQ is managed as Super Admin, not as a franchise branch
      );
      setFranchises(cleanList);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFranchises(); }, [fetchFranchises]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setActiveTab('info');
    setShowForm(true);
  };

  // Auto-open the create form when arriving via a "+ Add Franchise" shortcut link
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreate();
      router.replace('/franchise');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchUsers = useCallback(async (fId: string) => {
    setLoadingUsers(true);
    try {
      const res = await userGovernanceApi.getAll();
      setSelectedFranchiseUsers(res.data.filter((u: any) => u.franchiseId === fId));
    } catch (e) { console.error(e); }
    finally { setLoadingUsers(false); }
  }, []);

  const openEdit = async (f: any) => {
    setEditing(f);
    setForm({ 
      name: f.name, 
      location: f.location, 
      ownerName: f.ownerName, 
      contactNum: f.contactNum, 
      status: f.status ?? "ACTIVE",
      dashboardPassword: f.dashboardPassword || "",
      adminUser: { email: "", password: "", fullName: "" }
    });
    setActiveTab('info');
    setShowForm(true);
    setShowAddUser(false);
    fetchUsers(f.id);

    // Fetch roles if not already loaded
    if (roles.length === 0) {
      try {
        const rRes = await api.get("/api/roles");
        setRoles(rRes.data || []);
      } catch (e) { console.error(e); }
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.location) return;
    setSaving(true);
    try {
      if (editing) {
        const { adminUser, ...updateData } = form;
        await franchiseApi.update(editing.id, updateData);
      } else {
        const payload = { ...form };
        if (payload.adminUser.email) {
          const email = payload.adminUser.email;
          payload.adminUser.email = email.includes('@') ? email : `${email}@gmail.com`;
        } else {
          payload.adminUser.email = ""; 
        }
        await franchiseApi.create(payload);
      }
      setShowForm(false);
      fetchFranchises();
      setNotification({
        type: 'success',
        title: editing ? 'Update Successful' : 'Franchise Created',
        message: `${form.name} has been ${editing ? 'updated' : 'registered'} successfully.`
      });
    } catch (e: any) { 
      setNotification({
        type: 'error',
        title: 'Save Failed',
        message: e.response?.data?.error || "Failed to save franchise"
      });
    }
    finally { setSaving(false); }
  };

  const handleVerifyAndRedirect = async (f: any) => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      const pass = prompt(`Enter Dashboard Access Password for ${f.name}:`);
      if (pass === null) return; // User cancelled

      try {
        const res = await franchiseApi.verifyPassword(f.id, pass);
        if (res.data.isValid) {
          window.location.href = `/franchise/dashboard?id=${f.id}`;
        } else {
          toast.error('Incorrect Dashboard Password');
        }
      } catch (e) {
        console.error(e);
        toast.error('Verification failed. Please try again.');
      }
    } else {
      window.location.href = `/franchise/dashboard`;
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await franchiseApi.delete(confirmDelete.id);
      setConfirmDelete(null);
      fetchFranchises();
      setNotification({
        type: 'success',
        title: 'Franchise Deleted',
        message: 'The franchise record has been permanently removed.'
      });
    } catch (e: any) {
      setNotification({
        type: 'error',
        title: 'Deletion Error',
        message: e?.response?.data?.error ?? "Failed to delete franchise"
      });
    }
  };

  const handleCreateUser = async () => {
    if (!userForm.fullName || !userForm.email || (!editingUser && !userForm.password)) return;
    setSaving(true);
    try {
      const emailWithDomain = userForm.email.includes('@') ? userForm.email : `${userForm.email}@gmail.com`;
      const payload: any = { ...userForm, email: emailWithDomain };
      if (!payload.password) delete payload.password;

      if (editingUser) {
        await userGovernanceApi.update(editingUser.id, payload);
      } else {
        await userGovernanceApi.create({ ...payload, franchiseId: editing.id });
      }

      setShowAddUser(false);
      setEditingUser(null);
      setUserForm({ fullName: "", email: "", password: "", roleId: "FRANCHISE_ADMIN" });
      fetchUsers(editing.id);
      setNotification({
        type: 'success',
        title: editingUser ? 'User Updated' : 'Admin Added',
        message: `Account for ${userForm.fullName} has been ${editingUser ? 'updated' : 'created'}.`
      });
    } catch (e: any) {
      setNotification({
        type: 'error',
        title: 'Operation Failed',
        message: e.response?.data?.error || "Failed to process user request"
      });
    } finally {
      setSaving(false);
    }
  };
  
  const handleToggleStatus = async (f: any) => {
    const newStatus = f.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await franchiseApi.update(f.id, { status: newStatus });
      fetchFranchises();
      setNotification({
        type: 'success',
        title: 'Status Updated',
        message: `${f.name} is now ${newStatus.toLowerCase()}.`
      });
    } catch (e: any) {
      setNotification({
        type: 'error',
        title: 'Toggle Failed',
        message: e.response?.data?.error || "Failed to update status"
      });
    }
  };

  const handlePasswordReset = async (userId: string) => {
    if (!newPassword) return;
    setSaving(true);
    try {
      await userGovernanceApi.resetPassword(userId, { password: newPassword });
      setResettingPassword(null);
      setNewPassword("");
      setNotification({
        type: 'success',
        title: 'Password Reset',
        message: 'User password has been updated successfully.'
      });
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || e.response?.data?.message || "Failed to reset password";
      setNotification({
        type: 'error',
        title: 'Reset Failed',
        message: errorMsg
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = franchises.filter((f) =>
    !search ||
    f.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.location?.toLowerCase().includes(search.toLowerCase()) ||
    f.ownerName?.toLowerCase().includes(search.toLowerCase())
  );

  if (!currentUser || currentUser.role === 'FRANCHISE_ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-pulse">
          <Shield size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Authenticating Permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Redesigned Header — matching the premium EOD Settlement layout */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 border-b border-slate-200/60 dark:border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500 rounded-2xl shadow-xl shadow-orange-500/20">
              <Building2 size={24} className="text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              Franchise <span className="text-slate-400 font-medium ml-1 tracking-tighter italic">Management</span>
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium ml-16 uppercase tracking-widest text-[10px]">
            Master Oversight: Create branches and manage their primary administrators
          </p>
        </div>

        {currentUser.role === 'SUPER_ADMIN' && (
          <div className="flex gap-3">
            <button 
              onClick={fetchFranchises} 
              className="p-3.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all shadow-sm"
              title="Sync Branches"
            >
              <RefreshCw size={18} />
            </button>
            <button 
              onClick={openCreate} 
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all active:scale-95"
            >
              <Plus size={18} /> Add New Branch
            </button>
          </div>
        )}
      </header>

      {/* Stats Section — Harmonized colors */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Outlets", val: franchises.length, color: "bg-blue-500" },
          { label: "Active Branches", val: franchises.filter(f => f.status === 'ACTIVE').length, color: "bg-orange-500" },
          { label: "Planned Setup", val: franchises.filter(f => f.status === 'PENDING').length, color: "bg-amber-500" },
          { label: "Branch Administrators", val: franchises.reduce((acc, f) => acc + (f._count?.users || 0), 0), color: "bg-purple-500" },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-card rounded-2xl border border-slate-100 dark:border-white/5 p-6 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">{stat.val}</p>
              <div className={`w-1.5 h-6 rounded-full ${stat.color} opacity-20`} />
            </div>
          </div>
        ))}
      </div>

      {/* Search Input — Indigo focus indicators */}
      <div className="relative group">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
        <input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          placeholder="Filter by branch name, location, or owner..."
          className="w-full pl-12 pr-6 py-4 text-sm bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all shadow-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400" 
        />
            {search && (
              <X 
                size={14} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors" 
                onClick={() => setSearch("")} 
              />
            )}
      </div>

      {/* Franchise Grid */}
      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-bold tracking-widest uppercase">Fetching Data...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-32 text-center bg-slate-50 dark:bg-white/[0.02] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/5">
          <Building2 size={64} strokeWidth={1} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">No franchises found</p>
          <button onClick={openCreate} className="mt-4 text-orange-500 font-black hover:underline">Register your first outlet now</button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => {
            const isActive = f.status === 'ACTIVE';

            return (
              <div 
                key={f.id} 
                className="group rounded-[32px] border border-slate-100 dark:border-white/5 bg-white dark:bg-card/40 p-7 hover:shadow-2xl hover:shadow-orange-500/5 transition-all duration-500 relative overflow-hidden"
              >
                {/* Subtle back decorative glow */}
                <div className="absolute top-[-10%] right-[-10%] w-48 h-48 rounded-full blur-3xl opacity-20 transition-all duration-700 bg-slate-100 group-hover:bg-orange-100 dark:group-hover:bg-orange-950/20" />
                
                <div className="flex items-start justify-between relative z-10 mb-8">
                  {/* Clean standard icon container using orange shadow/gradient */}
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 bg-gradient-to-br from-orange-500 to-orange-600 shadow-orange-500/30 text-white">
                    <Building2 size={28} />
                  </div>
                  
                  {/* Interactive Options list */}
                  <div className="flex gap-2 p-1.5 bg-white/40 backdrop-blur-xl border border-white/50 dark:bg-white/5 dark:border-white/10 rounded-2xl shadow-sm">
                    <button 
                      onClick={() => handleToggleStatus(f)}
                      className={clsx(
                        "p-2.5 rounded-xl transition-all active:scale-90",
                        isActive 
                          ? "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20" 
                          : "text-red-500 bg-red-500/10 hover:bg-red-500/20"
                      )}
                      title={isActive ? "Deactivate Branch" : "Activate Branch"}
                    >
                      <Power size={16} />
                    </button>
                    <button 
                      onClick={() => handleVerifyAndRedirect(f)} 
                      className="p-2.5 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all active:scale-90"
                      title="View Dashboard"
                    >
                      <Eye size={18} />
                    </button>
                    {currentUser.role === 'SUPER_ADMIN' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => openEdit(f)} 
                          className="p-2.5 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all active:scale-90" 
                          title="Edit Branch Settings"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setConfirmDelete(f)} 
                          disabled={isActive}
                          className={clsx(
                            "p-2.5 rounded-xl transition-all active:scale-90",
                            isActive 
                              ? "text-slate-200 dark:text-slate-800 cursor-not-allowed" 
                              : "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                          )}
                          title="Delete Branch"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 relative z-10">
                  <div>
                    <h3 className="font-black text-xl tracking-tight transition-colors text-slate-900 dark:text-white group-hover:text-orange-500">
                      {f.name}
                    </h3>
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest pl-0.5 mt-2">
                      <MapPin size={14} className="text-orange-500" /> {f.location}
                    </div>
                  </div>

                  {/* Clean secondary info cards inside */}
                  <div className="p-5 rounded-2xl space-y-3 transition-all duration-500 border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 shadow-sm group-hover:shadow-md">
                    <div className="flex items-center gap-4 text-sm">
                      <User size={14} className="text-orange-500" />
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-base">{f.ownerName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <Phone size={14} className="text-blue-500" />
                      <span className="text-slate-500 dark:text-slate-400 font-bold tracking-tight">{f.contactNum}</span>
                    </div>
                  </div>

                  <div className="pt-6 flex items-center justify-between border-t border-slate-100/50 dark:border-white/5">
                    <span className={clsx(
                      "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em]",
                      STATUS_STYLES[f.status ?? "ACTIVE"] ?? STATUS_STYLES.ACTIVE
                    )}>
                      {f.status ?? "ACTIVE"}
                    </span>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Team</span>
                       <div className="flex items-center -space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white/10 border-2 border-white dark:border-card flex items-center justify-center text-[10px] font-black text-white">
                          {f._count?.users || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SlideOver Form */}
      <SlideOver
        isOpen={showForm}
        onClose={() => { setShowForm(false); setShowAddUser(false); setEditingUser(null); }}
        title={editing ? "Franchise Settings" : "Add New Franchise"}
        size="lg"
      >
        {showForm && (
          <div className="flex flex-col min-h-[calc(100vh-8rem)]">
            <p className="text-sm text-slate-500 font-medium mb-6">Configure branch details and primary admin.</p>

            <div className="flex-1 space-y-6">
              {editing && (
                <div className="flex gap-4 mb-8">
                  <button 
                    onClick={() => setActiveTab('info')} 
                    className={clsx(
                      "flex-1 py-3 rounded-2xl text-sm font-black transition-all border", 
                      activeTab === 'info' 
                        ? "bg-orange-50 border-orange-500 text-orange-600 dark:bg-orange-950/20 dark:border-orange-500 dark:text-orange-400" 
                        : "bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 border-transparent"
                    )}
                  >
                    Branch Details
                  </button>
                  <button 
                    onClick={() => setActiveTab('users')} 
                    className={clsx(
                      "flex-1 py-3 rounded-2xl text-sm font-black transition-all border", 
                      activeTab === 'users' 
                        ? "bg-orange-50 border-orange-500 text-orange-600 dark:bg-orange-950/20 dark:border-orange-500 dark:text-orange-400" 
                        : "bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 border-transparent"
                    )}
                  >
                    Administrators
                  </button>
                </div>
              )}

              {activeTab === 'info' ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Franchise Name</label>
                    <input 
                      value={form.name} 
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} 
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all" 
                      placeholder="Branch Name" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Location</label>
                    <input 
                      value={form.location} 
                      onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} 
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all" 
                      placeholder="City / Area" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Owner</label>
                      <input 
                        value={form.ownerName} 
                        onChange={(e) => setForm(f => ({ ...f, ownerName: e.target.value }))} 
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all" 
                        placeholder="Name" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Contact</label>
                      <input 
                        value={form.contactNum} 
                        onChange={(e) => setForm(f => ({ ...f, contactNum: e.target.value }))} 
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all" 
                        placeholder="Phone" 
                      />
                    </div>
                  </div>

                  {!editing && (
                    <div className="mt-8 p-6 bg-orange-50/50 dark:bg-orange-950/10 rounded-[2rem] border border-orange-100 dark:border-orange-900/30 space-y-4">
                      <h4 className="font-black text-sm uppercase tracking-wider text-orange-700 dark:text-orange-400">Primary Admin Account</h4>
                      <input 
                        value={form.adminUser.fullName} 
                        onChange={(e) => setForm(f => ({ ...f, adminUser: { ...f.adminUser, fullName: e.target.value } }))} 
                        className="w-full px-4 py-3 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all" 
                        placeholder="Full Name" 
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input 
                          value={form.adminUser.email} 
                          onChange={(e) => setForm(f => ({ ...f, adminUser: { ...f.adminUser, email: e.target.value } }))} 
                          className="w-full px-4 py-3 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all" 
                          placeholder="Login ID / Email" 
                        />
                        <div className="relative">
                          <input
                            type={showAdminPassword ? "text" : "password"}
                            value={form.adminUser.password}
                            onChange={(e) => {
                              const pass = e.target.value;
                              setForm(prev => ({ ...prev, dashboardPassword: pass, adminUser: { ...prev.adminUser, password: pass } }));
                            }}
                            className="w-full px-4 py-3 pr-11 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all"
                            placeholder="Password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
                            tabIndex={-1}
                          >
                            {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  {showAddUser ? (
                    /* Inline Admin Add/Edit Form inputs */
                    <div className="p-6 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-3xl space-y-4 animate-in slide-in-from-top-4 duration-300">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {editingUser ? "Edit Branch Admin" : "Create New Branch Admin"}
                        </h4>
                        <button 
                          onClick={() => {
                            setShowAddUser(false);
                            setEditingUser(null);
                            setUserForm({ fullName: "", email: "", password: "", roleId: "FRANCHISE_ADMIN" });
                          }} 
                          className="text-xs font-bold text-orange-500 hover:underline"
                        >
                          Back to List
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                          <input 
                            value={userForm.fullName} 
                            onChange={(e) => setUserForm(u => ({ ...u, fullName: e.target.value }))} 
                            className="w-full px-4 py-3 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all" 
                            placeholder="e.g. John Doe" 
                          />
                        </div>
                        
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Email / Login ID</label>
                          <input 
                            value={userForm.email} 
                            onChange={(e) => setUserForm(u => ({ ...u, email: e.target.value }))} 
                            className="w-full px-4 py-3 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all" 
                            placeholder="e.g. johndoe" 
                          />
                        </div>
                        
                        {!editingUser && (
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Password</label>
                            <input 
                              type="password"
                              value={userForm.password} 
                              onChange={(e) => setUserForm(u => ({ ...u, password: e.target.value }))} 
                              className="w-full px-4 py-3 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all" 
                              placeholder="Choose account password" 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Personnel</h4>
                        <button 
                          onClick={() => {
                            setEditingUser(null);
                            setUserForm({ fullName: "", email: "", password: "", roleId: "FRANCHISE_ADMIN" });
                            setShowAddUser(true);
                          }} 
                          className="text-xs font-black text-orange-500 hover:underline"
                        >
                          + New Admin
                        </button>
                      </div>
                      
                      {/* Admin User List Logic */}
                      <div className="space-y-3">
                        {loadingUsers ? (
                          <p className="text-xs font-bold text-slate-400 animate-pulse text-center py-4">Loading admins...</p>
                        ) : selectedFranchiseUsers.length === 0 ? (
                          <p className="text-xs font-bold text-slate-400 text-center py-4">No branch admins configured yet.</p>
                        ) : (
                          selectedFranchiseUsers.map(u => {
                            const isResetting = resettingPassword === u.id;
                            return (
                              <div key={u.id} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col gap-3 transition-all duration-300">
                                <div className="flex justify-between items-center w-full">
                                  <div>
                                    <p className="font-black text-sm text-slate-900 dark:text-white">{u.fullName}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => {
                                        setEditingUser(u);
                                        setUserForm({ fullName: u.fullName, email: u.email, password: "", roleId: u.role || "FRANCHISE_ADMIN" });
                                        setShowAddUser(true);
                                      }}
                                      className="p-2 text-slate-400 hover:text-orange-500 transition-colors"
                                      title="Edit Admin"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    {!isResetting && (
                                      <button 
                                        onClick={() => {
                                          setResettingPassword(u.id);
                                          setNewPassword("");
                                        }} 
                                        className="p-2 text-slate-400 hover:text-orange-500 transition-colors"
                                        title="Reset Password"
                                      >
                                        <Key size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                {isResetting && (
                                  /* Inline Password Reset form inputs */
                                  <div className="flex gap-2 items-center mt-2 pt-2 border-t border-slate-100 dark:border-white/5 animate-in slide-in-from-top-2 duration-300">
                                    <input
                                      type="password"
                                      placeholder="New password"
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      className="flex-1 px-3 py-2 bg-white dark:bg-card border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                                    />
                                    <button
                                      onClick={() => handlePasswordReset(u.id)}
                                      disabled={saving || !newPassword}
                                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-100 dark:disabled:bg-white/5 disabled:text-slate-400 text-white rounded-xl text-xs font-black uppercase transition-all"
                                    >
                                      {saving ? "..." : "Save"}
                                    </button>
                                    <button
                                      onClick={() => setResettingPassword(null)}
                                      className="px-3 py-2 bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-black uppercase hover:bg-slate-300 transition-all"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Context aware buttons in footer */}
            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-white/5 flex gap-3 justify-end pb-2">
              <button 
                onClick={() => {
                  if (showAddUser) {
                    setShowAddUser(false);
                    setEditingUser(null);
                  } else {
                    setShowForm(false);
                  }
                }} 
                className="px-6 py-3 font-black uppercase text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={showAddUser ? handleCreateUser : handleSave} 
                disabled={saving || (showAddUser ? (!userForm.fullName || !userForm.email || (!editingUser && !userForm.password)) : (!form.name || !form.location))} 
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-100 dark:disabled:bg-white/5 disabled:text-slate-400 text-white rounded-2xl font-black uppercase text-sm shadow-xl shadow-orange-500/20 transition-all active:scale-95"
              >
                {saving ? "..." : (showAddUser ? (editingUser ? "Update Admin" : "Create Admin") : "Save")}
              </button>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Delete Confirmation Modal — Redesigned */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-card rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-white/10 p-8 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
              <Trash2 size={40} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Confirm Delete</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
              Are you sure you want to delete <span className="text-orange-500 font-bold">&quot;{confirmDelete.name}&quot;</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-6 py-4 rounded-2xl text-sm font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-sm font-black shadow-xl shadow-red-500/20 transition-all active:scale-95">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      <Modal isOpen={!!notification} onClose={() => setNotification(null)} title={notification?.title || "Notification"} size="sm">
        <div className="flex flex-col items-center text-center space-y-6 py-4">
          <div className={clsx("w-20 h-20 rounded-full flex items-center justify-center", notification?.type === 'success' ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")}>
            {notification?.type === 'success' ? <CheckCircle2 size={40} /> : <AlertTriangle size={40} />}
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-medium">{notification?.message}</p>
          <button onClick={() => setNotification(null)} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black uppercase text-sm shadow-xl shadow-orange-500/10">Dismiss</button>
        </div>
      </Modal>
    </div>
  );
}
