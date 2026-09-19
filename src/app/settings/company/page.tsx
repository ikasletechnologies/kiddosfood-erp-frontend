"use client";

import { useState, useEffect } from "react";
import UserAccountLayout from "@/components/modules/settings/UserAccountLayout";
import { settingsApi } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";

export default function CompanySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [profile, setProfile] = useState({
    name: "",
    gstin: "",
    address: "",
    phone: "",
    email: "",
    state: ""
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await settingsApi.getCompanyProfile();
      if (res.data) {
        setProfile({
          name: res.data.companyName || res.data.name || "",
          gstin: res.data.gstNumber || res.data.gstin || "",
          address: res.data.address || "",
          phone: res.data.phone || "",
          email: res.data.email || "",
          state: res.data.state || "",
        });
      }
    } catch (e) {
      toast.error("Failed to load company profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (!profile.name?.trim()) newErrors.name = "Company Name is required.";
    if (!profile.gstin?.trim()) {
      newErrors.gstin = "GSTIN is required.";
    } else if (profile.gstin.trim().length !== 15) {
      newErrors.gstin = "GSTIN must be 15 characters.";
    }
    if (!profile.address?.trim()) newErrors.address = "Address is required.";
    if (!profile.phone?.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (!/^\d{10}$/.test(profile.phone.trim())) {
      newErrors.phone = "Phone must be exactly 10 digits.";
    }
    if (!profile.state?.trim()) newErrors.state = "State is required.";
    if (profile.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      newErrors.email = "Enter a valid email address.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix the validation errors");
      return;
    }

    setSaving(true);
    setErrors({});
    
    try {
      await settingsApi.updateCompanyProfile({
        ...profile,
        name: profile.name.trim(),
        gstin: profile.gstin.trim().toUpperCase(),
        address: profile.address.trim(),
        phone: profile.phone.trim(),
        email: profile.email?.trim() || null,
        state: profile.state.trim(),
      });
      toast.success("Company settings updated successfully");
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || "Failed to save profile. Please try again.";
      setErrors({ _api: msg });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <UserAccountLayout>
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Company Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage your company's core details, used across invoices, challans, and orders.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {errors._api && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-sm text-red-600 dark:text-red-400 font-medium">
                {errors._api}
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    placeholder="My Company"
                    onChange={(e) => { setProfile({ ...profile, name: e.target.value }); setErrors({ ...errors, name: "" }); }}
                    className={clsx(
                      "w-full h-12 bg-slate-50 dark:bg-slate-900/50 px-4 rounded-xl font-medium text-sm border outline-none transition-colors",
                      errors.name ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-slate-700 focus:border-orange-500"
                    )}
                  />
                  {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    GSTIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profile.gstin}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                    onChange={(e) => { setProfile({ ...profile, gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) }); setErrors({ ...errors, gstin: "" }); }}
                    className={clsx(
                      "w-full h-12 bg-slate-50 dark:bg-slate-900/50 px-4 rounded-xl font-medium text-sm border font-mono tracking-widest outline-none transition-colors",
                      errors.gstin ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-slate-700 focus:border-orange-500"
                    )}
                  />
                  {errors.gstin && <p className="text-xs text-red-500 font-medium">{errors.gstin}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Registered Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={profile.address}
                  placeholder="Full registered address..."
                  onChange={(e) => { setProfile({ ...profile, address: e.target.value }); setErrors({ ...errors, address: "" }); }}
                  className={clsx(
                    "w-full h-24 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl font-medium text-sm border resize-none outline-none transition-colors",
                    errors.address ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-slate-700 focus:border-orange-500"
                  )}
                />
                {errors.address && <p className="text-xs text-red-500 font-medium">{errors.address}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={profile.phone}
                    placeholder="10-digit mobile"
                    maxLength={10}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); setProfile({ ...profile, phone: v }); setErrors({ ...errors, phone: "" }); }}
                    className={clsx(
                      "w-full h-12 bg-slate-50 dark:bg-slate-900/50 px-4 rounded-xl font-medium text-sm border outline-none transition-colors",
                      errors.phone ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-slate-700 focus:border-orange-500"
                    )}
                  />
                  {errors.phone && <p className="text-xs text-red-500 font-medium">{errors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    placeholder="company@example.com"
                    onChange={(e) => { setProfile({ ...profile, email: e.target.value }); setErrors({ ...errors, email: "" }); }}
                    className={clsx(
                      "w-full h-12 bg-slate-50 dark:bg-slate-900/50 px-4 rounded-xl font-medium text-sm border outline-none transition-colors",
                      errors.email ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-slate-700 focus:border-orange-500"
                    )}
                  />
                  {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profile.state}
                  placeholder="Tamil Nadu"
                  onChange={(e) => { setProfile({ ...profile, state: e.target.value }); setErrors({ ...errors, state: "" }); }}
                  className={clsx(
                    "w-full h-12 bg-slate-50 dark:bg-slate-900/50 px-4 rounded-xl font-medium text-sm border outline-none transition-colors md:w-1/2",
                    errors.state ? "border-red-400 focus:ring-red-200" : "border-slate-200 dark:border-slate-700 focus:border-orange-500"
                  )}
                />
                {errors.state && <p className="text-xs text-red-500 font-medium">{errors.state}</p>}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </UserAccountLayout>
  );
}
