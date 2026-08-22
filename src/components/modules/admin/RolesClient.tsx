"use client";

import { useState, useEffect } from "react";
import {
  UserCheck,
  Plus,
  Shield,
  Trash2,
  Pencil,
  XCircle,
  Lock,
  Info,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { rolesApi, permissionsApi } from "@/lib/api";

interface Permission {
  id: string;
  key: string;
  module: string;
  action: string;
  label: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: Permission[];
}

const ACCOUNT_TIERS = [
  { name: "Super Admin (HQ)", desc: "Full system access. Bypasses every permission check; overrides on approval workflows are recorded in the audit log." },
  { name: "Franchise Admin", desc: "Branch operator tier. Effective access within a franchise is narrowed by any department role (below) assigned to the user." },
];

export default function RolesClient() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", permissionIds: [] as string[] });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([rolesApi.getAll(), permissionsApi.getAll()]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
    } catch (error) {
      toast.error("Failed to fetch roles/permissions");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingRole(null);
    setFormData({ name: "", description: "", permissionIds: [] });
    setShowModal(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissionIds: role.permissions.map((p) => p.id),
    });
    setShowModal(true);
  };

  const togglePermission = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(id)
        ? prev.permissionIds.filter((p) => p !== id)
        : [...prev.permissionIds, id],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRole) {
        await rolesApi.update(editingRole.id, formData);
        toast.success("Role updated successfully");
      } else {
        await rolesApi.create(formData);
        toast.success("Role created successfully");
      }
      setShowModal(false);
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to save role");
    }
  };

  const handleDelete = async (role: Role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await rolesApi.delete(role.id);
      toast.success("Role deleted successfully");
      fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete role");
    }
  };

  const permissionsByModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="text-orange-500" size={24} />
            Roles Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Department-level roles and the permissions they carry
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20 active:scale-95"
        >
          <Plus size={18} />
          New Role
        </button>
      </div>

      {/* Account Tiers (read-only, system-level) */}
      <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-800 rounded-3xl p-5">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
          <Lock size={12} /> Account Tiers (system-level, non-editable)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ACCOUNT_TIERS.map((t) => (
            <div key={t.name} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-sm font-black text-slate-800 dark:text-white">{t.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-40 bg-slate-50 dark:bg-slate-800/30 rounded-3xl animate-pulse" />
          ))
        ) : roles.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">No roles found.</div>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-900 dark:text-white">{role.name}</p>
                    {role.isSystem && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">System</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{role.description || "No description"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                <span className="flex items-center gap-1"><Shield size={12} /> {role.permissions.length} permissions</span>
                <span>{role.userCount} user{role.userCount === 1 ? "" : "s"}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button onClick={() => openEdit(role)} className="p-2 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg text-slate-400 hover:text-orange-500 transition-colors">
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(role)}
                  disabled={role.isSystem || role.userCount > 0}
                  title={role.isSystem ? "System roles cannot be deleted" : role.userCount > 0 ? "Reassign users before deleting" : "Delete role"}
                  className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingRole ? "Edit Role" : "New Role"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Role Name</label>
                <input
                  required
                  disabled={!!editingRole?.isSystem}
                  type="text"
                  placeholder="e.g. Regional Auditor"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none disabled:opacity-50"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                {editingRole?.isSystem && (
                  <p className="text-[10px] text-slate-400 ml-1">System roles cannot be renamed.</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Description</label>
                <input
                  type="text"
                  placeholder="What this role is for"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase text-slate-500 ml-1">Permissions</label>
                <div className="space-y-3 max-h-72 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                  {Object.entries(permissionsByModule).map(([mod, perms]) => (
                    <div key={mod}>
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5">{mod}</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {perms.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.permissionIds.includes(p.id)}
                              onChange={() => togglePermission(p.id)}
                              className="accent-orange-500"
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20">
                  {editingRole ? "Save Changes" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
