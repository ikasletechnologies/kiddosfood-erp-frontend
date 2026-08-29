"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { SlideOver } from "@/components/ui/SlideOver";
import {
  Building2,
  Plus,
  X,
  MapPin,
  User,
  Phone,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Shield,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Power,
  Sparkles,
  MoreVertical,
  Activity,
  Users
} from "lucide-react";
import { clsx } from "clsx";
import { franchiseApi, userGovernanceApi, default as api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "react-hot-toast";

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  ACTIVE: {
    label: "Active",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  INACTIVE: {
    label: "Inactive",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-500/20",
    dot: "bg-slate-400",
  },
  PENDING: {
    label: "Pending Setup",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
    dot: "bg-amber-500",
  },
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
    fullName: "",
  },
};

export default function FranchisePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = useAuth();
  const [franchises, setFranchises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!loading && currentUser && currentUser.role === "FRANCHISE_ADMIN") {
      router.push("/franchise/dashboard");
    }
  }, [currentUser, loading, router]);

  const [activeTab, setActiveTab] = useState<"info" | "users">("info");
  const [selectedFranchiseUsers, setSelectedFranchiseUsers] = useState<any[]>([]);
  const [notification, setNotification] = useState<{
    type: "error" | "success" | "info";
    title: string;
    message: string;
  } | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    roleId: "FRANCHISE_ADMIN",
  });
  const [roles, setRoles] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const fetchFranchises = useCallback(async () => {
    setLoading(true);
    try {
      const res = await franchiseApi.getAll();
      // Franchise.isHQ is the one real definition of HQ (see
      // FranchiseService.getHqFranchise) — not a name/id guess. The
      // "Distribution Center" name exclusion is a separate, unrelated
      // demo-data filter and is left as-is.
      const cleanList = (res.data ?? []).filter(
        (f: any) =>
          !f.isHQ &&
          !f.name.includes("Distribution Center")
      );
      setFranchises(cleanList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFranchises();
  }, [fetchFranchises]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setActiveTab("info");
    setShowForm(true);
  };

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      router.replace("/franchise");
    }
  }, [searchParams, router]);

  const fetchUsers = useCallback(async (fId: string) => {
    setLoadingUsers(true);
    try {
      const res = await userGovernanceApi.getAll();
      setSelectedFranchiseUsers(res.data.filter((u: any) => u.franchiseId === fId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
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
      adminUser: { email: "", password: "", fullName: "" },
    });
    setActiveTab("info");
    setShowForm(true);
    setShowAddUser(false);
    fetchUsers(f.id);

    if (roles.length === 0) {
      try {
        const rRes = await api.get("/api/roles");
        setRoles(rRes.data || []);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const isValidContactNum = (v: string) => /^\d{10}$/.test(v);

  const handleSave = async () => {
    if (!form.name || !form.location) return;
    if (!isValidContactNum(form.contactNum)) {
      setNotification({
        type: "error",
        title: "Invalid Contact Number",
        message: "Enter a valid 10-digit mobile number.",
      });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { adminUser, ...updateData } = form;
        await franchiseApi.update(editing.id, updateData);
      } else {
        const payload = { ...form };
        if (payload.adminUser.email) {
          const email = payload.adminUser.email;
          payload.adminUser.email = email.includes("@") ? email : `${email}@gmail.com`;
        } else {
          payload.adminUser.email = "";
        }
        await franchiseApi.create(payload);
      }
      setShowForm(false);
      fetchFranchises();
      setNotification({
        type: "success",
        title: editing ? "Update Successful" : "Franchise Created",
        message: `${form.name} has been ${editing ? "updated" : "registered"} successfully.`,
      });
    } catch (e: any) {
      setNotification({
        type: "error",
        title: "Save Failed",
        message: e.response?.data?.error || "Failed to save franchise",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyAndRedirect = async (f: any) => {
    if (currentUser?.role === "SUPER_ADMIN") {
      const pass = prompt(`Enter Dashboard Access Password for ${f.name}:`);
      if (pass === null) return;

      try {
        const res = await franchiseApi.verifyPassword(f.id, pass);
        if (res.data.isValid) {
          window.location.href = `/franchise/dashboard?id=${f.id}`;
        } else {
          toast.error("Incorrect Dashboard Password");
        }
      } catch (e) {
        console.error(e);
        toast.error("Verification failed. Please try again.");
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
        type: "success",
        title: "Franchise Deleted",
        message: "The franchise record has been permanently removed.",
      });
    } catch (e: any) {
      setNotification({
        type: "error",
        title: "Deletion Error",
        message: e?.response?.data?.error ?? "Failed to delete franchise",
      });
    }
  };

  const handleCreateUser = async () => {
    if (!userForm.fullName || !userForm.email || (!editingUser && !userForm.password)) return;
    setSaving(true);
    try {
      const emailWithDomain = userForm.email.includes("@") ? userForm.email : `${userForm.email}@gmail.com`;
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
        type: "success",
        title: editingUser ? "User Updated" : "Admin Added",
        message: `Account for ${userForm.fullName} has been ${editingUser ? "updated" : "created"}.`,
      });
    } catch (e: any) {
      setNotification({
        type: "error",
        title: "Operation Failed",
        message: e.response?.data?.error || "Failed to process user request",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (f: any) => {
    const newStatus = f.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await franchiseApi.update(f.id, { status: newStatus });
      fetchFranchises();
      setNotification({
        type: "success",
        title: "Status Updated",
        message: `${f.name} is now ${newStatus.toLowerCase()}.`,
      });
    } catch (e: any) {
      setNotification({
        type: "error",
        title: "Toggle Failed",
        message: e.response?.data?.error || "Failed to update status",
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
        type: "success",
        title: "Password Reset",
        message: "User password has been updated successfully.",
      });
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || e.response?.data?.message || "Failed to reset password";
      setNotification({
        type: "error",
        title: "Reset Failed",
        message: errorMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = franchises.filter(
    (f) =>
      !search ||
      f.name?.toLowerCase().includes(search.toLowerCase()) ||
      f.location?.toLowerCase().includes(search.toLowerCase()) ||
      f.ownerName?.toLowerCase().includes(search.toLowerCase())
  );

  if (!currentUser || currentUser.role === "FRANCHISE_ADMIN") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center animate-pulse">
          <Shield size={40} className="mx-auto text-orange-400 mb-4" />
          <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">
            Authenticating Permissions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100 print:bg-white print:p-0 w-full min-w-0">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end items-start sm:items-center print:hidden border-b border-slate-200 dark:border-slate-800 pb-4 w-full min-w-0">

        {currentUser.role === "SUPER_ADMIN" && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm">
              <div className="flex items-center px-2 text-slate-400">
                <Search size={14} />
              </div>
              <input
                type="text"
                placeholder="Search branches..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none text-slate-700 dark:text-slate-200 focus:ring-0 p-1 font-semibold text-sm outline-none w-44"
              />
              {search && (
                <button onClick={() => setSearch("")} className="px-2 text-slate-400 hover:text-orange-500">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={fetchFranchises}
              title="Refresh Data"
              className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-150 active:scale-95"
            >
              <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-sm shadow-sm transition-all duration-150 active:scale-95 flex items-center gap-2"
            >
              <Plus size={16} /> Add Branch
            </button>
          </div>
        )}
      </div>

      {/* Stats Summary Row */}
      <div className="flex flex-col lg:flex-row gap-4 print:hidden">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {[
            {
              label: "Total Outlets",
              value: franchises.length,
              icon: Building2,
              color: "text-indigo-600",
              bg: "bg-indigo-50 dark:bg-indigo-950/20",
              borderColor: "border-indigo-200 dark:border-indigo-900/30",
            },
            {
              label: "Active Branches",
              value: franchises.filter((f) => f.status === "ACTIVE").length,
              icon: Activity,
              color: "text-emerald-600",
              bg: "bg-emerald-50 dark:bg-emerald-950/20",
              borderColor: "border-emerald-200 dark:border-emerald-900/30",
            },
            {
              label: "Planned Setup",
              value: franchises.filter((f) => f.status === "PENDING").length,
              icon: AlertTriangle,
              color: "text-amber-600",
              bg: "bg-amber-50 dark:bg-amber-950/20",
              borderColor: "border-amber-200 dark:border-amber-900/30",
            },
            {
              label: "Administrators",
              value: franchises.reduce((acc, f) => acc + (f._count?.users || 0), 0),
              icon: Users,
              color: "text-violet-600",
              bg: "bg-violet-50 dark:bg-violet-950/20",
              borderColor: "border-violet-200 dark:border-violet-900/30",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-sm bg-white dark:bg-slate-800 flex-1 min-w-[200px]",
                s.borderColor
              )}
            >
              <div className={clsx("p-2 rounded-lg", s.bg)}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {s.label}
                </p>
                <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight">
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
            Loading branches...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
          <Building2 size={40} className="text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-400">
            {search ? "No branches match your search." : "No branches found."}
          </p>
          {!search && (
            <button
              onClick={openCreate}
              className="text-orange-500 font-bold hover:underline text-sm"
            >
              Register your first branch
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full min-w-0">
          {filtered.map((f) => {
            const isActive = f.status === "ACTIVE";
            const conf = STATUS_STYLES[f.status ?? "ACTIVE"] ?? STATUS_STYLES.ACTIVE;

            return (
              <div
                key={f.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 leading-tight">
                      {f.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                      <MapPin size={12} className="text-orange-500" />
                      {f.location}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(f)}
                      className={clsx(
                        "p-1.5 rounded-lg transition-colors",
                        isActive
                          ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          : "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      )}
                      title={isActive ? "Deactivate" : "Activate"}
                    >
                      <Power size={14} />
                    </button>
                    {currentUser.role === "SUPER_ADMIN" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(f)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(f)}
                          disabled={isActive}
                          className={clsx(
                            "p-1.5 rounded-lg transition-colors",
                            isActive
                              ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                              : "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                          )}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center shrink-0">
                        <User size={14} className="text-orange-600 dark:text-orange-400" />
                      </div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {f.ownerName || "No Owner"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center shrink-0">
                        <Phone size={14} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {f.contactNum || "No Contact"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                  <span
                    className={clsx(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                      conf.bg,
                      conf.color,
                      conf.border
                    )}
                  >
                    <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", conf.dot)} />
                    {conf.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerifyAndRedirect(f)}
                      className="px-2 py-1 text-[11px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 rounded transition-colors uppercase tracking-wider"
                    >
                      Dashboard
                    </button>
                    <div className="flex items-center gap-1.5 ml-2 text-slate-500">
                      <Users size={14} />
                      <span className="text-xs font-bold tabular-nums">
                        {f._count?.users || 0}
                      </span>
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
        onClose={() => {
          setShowForm(false);
          setShowAddUser(false);
          setEditingUser(null);
        }}
        title={editing ? "Branch Settings" : "Add New Branch"}
        size="lg"
      >
        {showForm && (
          <div className="flex flex-col min-h-[calc(100vh-8rem)]">
            <p className="text-sm text-slate-500 font-medium mb-6">
              Configure branch details and primary administrators.
            </p>

            <div className="flex-1 space-y-6">
              {editing && (
                <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab("info")}
                    className={clsx(
                      "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all",
                      activeTab === "info"
                        ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    Branch Details
                  </button>
                  <button
                    onClick={() => setActiveTab("users")}
                    className={clsx(
                      "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all",
                      activeTab === "users"
                        ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    )}
                  >
                    Administrators
                  </button>
                </div>
              )}

              {activeTab === "info" ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      Branch Name
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                      placeholder="e.g. Coimbatore Main"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                      Location
                    </label>
                    <input
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                      placeholder="City / Area"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                        Owner Name
                      </label>
                      <input
                        value={form.ownerName}
                        onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                        placeholder="Owner Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                        Contact Number
                      </label>
                      <input
                        value={form.contactNum}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            contactNum: e.target.value.replace(/\D/g, "").slice(0, 10),
                          }))
                        }
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                        placeholder="10-digit mobile number"
                      />
                    </div>
                  </div>

                  {!editing && (
                    <div className="mt-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
                        Primary Admin Account
                      </h4>
                      <div className="space-y-4 pt-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                            Full Name
                          </label>
                          <input
                            value={form.adminUser.fullName}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                adminUser: { ...f.adminUser, fullName: e.target.value },
                              }))
                            }
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all"
                            placeholder="Full Name"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                              Login ID / Email
                            </label>
                            <input
                              value={form.adminUser.email}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  adminUser: { ...f.adminUser, email: e.target.value },
                                }))
                              }
                              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all"
                              placeholder="Email or Username"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                              Password
                            </label>
                            <div className="relative">
                              <input
                                type={showAdminPassword ? "text" : "password"}
                                value={form.adminUser.password}
                                onChange={(e) => {
                                  const pass = e.target.value;
                                  setForm((prev) => ({
                                    ...prev,
                                    dashboardPassword: pass,
                                    adminUser: { ...prev.adminUser, password: pass },
                                  }));
                                }}
                                className="w-full px-4 py-2 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all"
                                placeholder="Password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowAdminPassword((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-orange-500 transition-colors"
                                tabIndex={-1}
                              >
                                {showAdminPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {showAddUser ? (
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          {editingUser ? "Edit Branch Admin" : "New Branch Admin"}
                        </h4>
                        <button
                          onClick={() => {
                            setShowAddUser(false);
                            setEditingUser(null);
                            setUserForm({
                              fullName: "",
                              email: "",
                              password: "",
                              roleId: "FRANCHISE_ADMIN",
                            });
                          }}
                          className="text-xs font-bold text-orange-500 hover:underline"
                        >
                          Back to List
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                            Full Name
                          </label>
                          <input
                            value={userForm.fullName}
                            onChange={(e) => setUserForm((u) => ({ ...u, fullName: e.target.value }))}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all"
                            placeholder="e.g. John Doe"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                            Email / Login ID
                          </label>
                          <input
                            value={userForm.email}
                            onChange={(e) => setUserForm((u) => ({ ...u, email: e.target.value }))}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all"
                            placeholder="e.g. johndoe"
                          />
                        </div>

                        {!editingUser && (
                          <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                              Password
                            </label>
                            <input
                              type="password"
                              value={userForm.password}
                              onChange={(e) => setUserForm((u) => ({ ...u, password: e.target.value }))}
                              className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all"
                              placeholder="Choose account password"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          Branch Administrators
                        </h4>
                        <button
                          onClick={() => {
                            setEditingUser(null);
                            setUserForm({
                              fullName: "",
                              email: "",
                              password: "",
                              roleId: "FRANCHISE_ADMIN",
                            });
                            setShowAddUser(true);
                          }}
                          className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-3 py-1.5 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-colors"
                        >
                          + New Admin
                        </button>
                      </div>

                      <div className="space-y-3">
                        {loadingUsers ? (
                          <p className="text-sm font-semibold text-slate-400 text-center py-6">
                            Loading admins...
                          </p>
                        ) : selectedFranchiseUsers.length === 0 ? (
                          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <Users size={24} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-sm font-semibold text-slate-500">
                              No branch admins configured yet.
                            </p>
                          </div>
                        ) : (
                          selectedFranchiseUsers.map((u) => {
                            const isResetting = resettingPassword === u.id;
                            return (
                              <div
                                key={u.id}
                                className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3"
                              >
                                <div className="flex justify-between items-center w-full">
                                  <div>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">
                                      {u.fullName}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                      {u.email}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingUser(u);
                                        setUserForm({
                                          fullName: u.fullName,
                                          email: u.email,
                                          password: "",
                                          roleId: u.role || "FRANCHISE_ADMIN",
                                        });
                                        setShowAddUser(true);
                                      }}
                                      className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
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
                                        className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                                        title="Reset Password"
                                      >
                                        <Key size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {isResetting && (
                                  <div className="flex gap-2 items-center mt-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                                    <input
                                      type="password"
                                      placeholder="New password"
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                                    />
                                    <button
                                      onClick={() => handlePasswordReset(u.id)}
                                      disabled={saving || !newPassword}
                                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition-all"
                                    >
                                      {saving ? "..." : "Save"}
                                    </button>
                                    <button
                                      onClick={() => setResettingPassword(null)}
                                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold transition-all"
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

            <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
              <button
                onClick={() => {
                  if (showAddUser) {
                    setShowAddUser(false);
                    setEditingUser(null);
                  } else {
                    setShowForm(false);
                  }
                }}
                className="px-5 py-2.5 font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={showAddUser ? handleCreateUser : handleSave}
                disabled={
                  saving ||
                  (showAddUser
                    ? !userForm.fullName || !userForm.email || (!editingUser && !userForm.password)
                    : !form.name || !form.location || !isValidContactNum(form.contactNum))
                }
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-lg font-bold text-sm transition-all shadow-sm"
              >
                {saving
                  ? "Saving..."
                  : showAddUser
                  ? editingUser
                    ? "Update Admin"
                    : "Create Admin"
                  : "Save Branch"}
              </button>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 p-6 text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
              <Trash2 size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Branch</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Are you sure you want to delete{" "}
              <span className="font-bold text-slate-700 dark:text-slate-300">
                "{confirmDelete.name}"
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      <Modal
        isOpen={!!notification}
        onClose={() => setNotification(null)}
        title={notification?.title || "Notification"}
        size="sm"
      >
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div
            className={clsx(
              "w-16 h-16 rounded-full flex items-center justify-center",
              notification?.type === "success"
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
            )}
          >
            {notification?.type === "success" ? (
              <CheckCircle2 size={32} />
            ) : (
              <AlertTriangle size={32} />
            )}
          </div>
          <p className="text-slate-700 dark:text-slate-300 text-sm font-medium px-4">
            {notification?.message}
          </p>
          <div className="w-full pt-4">
            <button
              onClick={() => setNotification(null)}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-sm transition-all shadow-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
