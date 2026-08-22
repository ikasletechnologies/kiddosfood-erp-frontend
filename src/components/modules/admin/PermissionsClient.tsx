"use client";

import { useState, useEffect } from "react";
import { Lock, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import { permissionsApi } from "@/lib/api";

interface Permission {
  id: string;
  key: string;
  module: string;
  action: string;
  label: string;
  roles: { id: string; name: string }[];
}

export default function PermissionsClient() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await permissionsApi.getAll();
      setPermissions(res.data);
    } catch (error) {
      toast.error("Failed to fetch permissions");
    } finally {
      setLoading(false);
    }
  };

  const byModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Lock className="text-orange-500" size={24} />
          Permissions
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The full catalog of application capabilities, grouped by module. To change which role holds a
          permission, edit the assignment from <span className="font-bold">Roles</span>.
        </p>
      </div>

      <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 rounded-2xl p-4 flex items-start gap-2.5">
        <Info size={16} className="text-orange-500 shrink-0 mt-0.5" />
        <p className="text-xs text-orange-700 dark:text-orange-300">
          Permissions are defined in code and are read-only here; assigning them to a role is what actually
          takes effect server-side.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-slate-50 dark:bg-slate-800/30 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byModule).map(([mod, perms]) => (
            <div key={mod} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">{mod}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="py-2 pr-4">Capability</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2">Assigned To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {perms.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-4 text-sm font-bold text-slate-800 dark:text-slate-200">{p.label}</td>
                        <td className="py-2.5 pr-4 text-xs font-bold text-slate-500 uppercase">{p.action}</td>
                        <td className="py-2.5">
                          {p.roles.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Unassigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {p.roles.map((r) => (
                                <span key={r.id} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {r.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
