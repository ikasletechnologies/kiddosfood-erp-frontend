"use client";

import { useEffect, useState } from "react";
import UserAccountLayout from "@/components/modules/settings/UserAccountLayout";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { clsx } from "clsx";

export default function UserProfileSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    country: "India"
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/api/me");
      setUser(res.data);
      setFormData({
        fullName: res.data.fullName || "",
        phone: res.data.phone || "",
        country: "India"
      });
    } catch (error) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/api/me/update", {
        fullName: formData.fullName,
        phone: formData.phone
      });
      toast.success("Profile updated successfully");
      fetchProfile();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <UserAccountLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-orange-500" />
        </div>
      </UserAccountLayout>
    );
  }

  return (
    <UserAccountLayout>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-10 space-y-10">
        <div className="space-y-1 border-b border-slate-200 dark:border-slate-700 pb-5">
           <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Personal Information</h2>
           <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Update your account details and public profile.</p>
        </div>

        <div className="space-y-10 max-w-3xl">
           {/* Profile Header */}
           <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 bg-orange-50 dark:bg-orange-500/20 rounded-2xl flex items-center justify-center border border-orange-100 dark:border-orange-500/30 overflow-hidden">
                 <div className="text-2xl text-orange-500 font-black uppercase">
                    {user?.fullName?.charAt(0) || "U"}
                 </div>
              </div>
              <div className="space-y-1.5">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white">{user?.fullName || "User"}</h3>
                 <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {(user?.role || "").toString().replace(/_/g, ' ') || "No Role"}
                    </span>
                    <p className="text-sm font-medium text-slate-500">{user?.email}</p>
                 </div>
              </div>
           </div>

           {/* Form Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Name</label>
                  <input 
                    type="text" 
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all shadow-sm" 
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                  <input 
                     type="email" 
                     value={user?.email || ""}
                     className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed shadow-sm" 
                     disabled
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Country</label>
                  <select 
                    value={formData.country}
                    disabled
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-500 cursor-not-allowed appearance-none shadow-sm"
                  >
                     <option>India</option>
                  </select>
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone</label>
                  <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500 transition-all">
                     <span className="text-sm opacity-70">🇮🇳</span>
                     <span className="text-sm font-bold text-slate-400">+91</span>
                     <input 
                       type="text" 
                       value={formData.phone}
                       onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 10); setFormData({ ...formData, phone: val }); }}
                       placeholder="10 digits"
                       className="flex-1 bg-transparent border-none p-0 text-sm font-semibold text-slate-900 dark:text-white focus:ring-0 outline-none" 
                     />
                  </div>
               </div>
           </div>

           <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all disabled:opacity-50 shadow-sm"
              >
                 {saving ? "Saving..." : "Save Changes"}
              </button>
           </div>
        </div>
      </div>
    </UserAccountLayout>
  );
}
