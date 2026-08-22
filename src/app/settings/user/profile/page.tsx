"use client";

import { useEffect, useState } from "react";
import UserAccountLayout from "@/components/modules/settings/UserAccountLayout";
import { Camera, Pencil, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

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
          <Loader2 className="animate-spin text-[#7C3AED]" />
        </div>
      </UserAccountLayout>
    );
  }

  return (
    <UserAccountLayout>
      <div className="space-y-12">
        <div className="space-y-1">
           <h2 className="text-[17px] font-black text-[#1A1A1A] dark:text-white">Personal Information</h2>
        </div>

        <div className="space-y-8 max-w-5xl">
           {/* Profile Header */}
           <div className="flex items-center gap-6">
              <div className="relative w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center border-4 border-white shadow-sm overflow-hidden group">
                 <div className="text-[10px] text-[#999] font-black uppercase">
                    {user?.fullName?.charAt(0) || "U"}
                 </div>
                 {/* <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    <Camera size={20} className="text-white" />
                 </div> */}
              </div>
              <div className="space-y-0.5">
                 <h3 className="text-[15px] font-black text-[#1A1A1A] dark:text-white">{user?.fullName || "User"}</h3>
                 <p className="text-[12px] font-bold text-[#999] uppercase">{(user?.role || "").toString().replace(/_/g, ' ') || "No Role"}</p>
                 <p className="text-[11px] font-medium text-[#7C3AED]">{user?.email}</p>
              </div>
           </div>

           {/* Form Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Name</label>
                    <input 
                      type="text" 
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 dark:border-slate-800 rounded-xl text-sm font-semibold focus:ring-1 focus:ring-purple-400" 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Country</label>
                    <div className="relative">
                       <select 
                         value={formData.country}
                         disabled
                         className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 dark:border-slate-800 rounded-xl text-sm font-semibold appearance-none cursor-not-allowed opacity-60"
                       >
                          <option>India</option>
                       </select>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <input 
                       type="email" 
                       value={user?.email || ""}
                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 dark:border-slate-800 rounded-xl text-sm font-semibold text-[#999] cursor-not-allowed" 
                       disabled
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                    <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 dark:border-slate-800 rounded-xl">
                       <span className="text-[14px] opacity-70">🇮🇳</span>
                       <span className="text-[14px] font-bold text-[#999]">+91</span>
                       <input 
                         type="text" 
                         value={formData.phone}
                         onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 10); setFormData({ ...formData, phone: val }); }}
                         placeholder="10 digits"
                         className="flex-1 bg-transparent border-none p-0 text-sm font-semibold focus:ring-0" 
                       />
                    </div>
                 </div>
              </div>
           </div>

           {/* <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-[#666] flex items-center gap-2">
                 Active Refrens Key 
                 <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-[#999]">?</span>
              </label>
              <select className="w-full px-4 py-3 bg-white border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold appearance-none">
                 <option>ikasle-business-group725538</option>
              </select>
           </div> */}

           <div className="flex justify-end pt-4">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="px-10 py-3 bg-[#7C3AED] text-white rounded-xl font-black text-[13px] hover:bg-[#6D28D9] transition-all disabled:opacity-50 shadow-lg shadow-purple-200"
              >
                 {saving ? "Saving..." : "Save Changes"}
              </button>
           </div>

           {/* Public Identity Section */}
           {/* <div className="pt-10 space-y-6 border-t border-[#F0EAF0]">
              <div className="space-y-1">
                 <h4 className="text-[14px] font-black text-[#1A1A1A]">Your Public Identity</h4>
                 <p className="text-[11px] font-medium text-[#999]">Choose how your activity - new follows, shares and more will be shown to your followers. Hide any business association that you don't want to be shown publicly.</p>
              </div>

              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <p className="text-[12px] font-bold text-[#666]">Default Identity</p>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full">
                       <div className="w-6 h-6 bg-slate-200 rounded-full" />
                       <span className="text-[12px] font-black text-[#1A1A1A]">Ikasle</span>
                    </div>
                 </div>
                 <button className="flex items-center gap-2 text-[12px] font-bold text-[#7C3AED] group">
                    <Pencil size={14} className="group-hover:scale-110 transition-transform" />
                    Edit
                 </button>
              </div>
           </div> */}
        </div>
      </div>
    </UserAccountLayout>
  );
}

