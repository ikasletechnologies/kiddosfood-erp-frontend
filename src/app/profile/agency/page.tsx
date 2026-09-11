"use client";

import { useEffect, useState } from "react";
import { 
  Camera, 
  Pencil, 
  Loader2, 
  MapPin, 
  Building2, 
  Phone as PhoneIcon, 
  Mail, 
  User as UserIcon, 
  IndianRupee, 
  Wallet, 
  CreditCard,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Globe
} from "lucide-react";
import { clsx } from "clsx";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

type TabType = "PERSONAL" | "BRANCH" | "FINANCIALS" | "SECURITY";

export default function AgencyProfilePage() {
  const [activeTab, setActiveTab] = useState<TabType>("PERSONAL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Form states
  const [personalForm, setPersonalForm] = useState({
    fullName: "",
    phone: "",
    country: "India"
  });

  const [branchForm, setBranchForm] = useState({
    name: "",
    location: "",
    ownerName: "",
    contactNum: "",
    status: "ACTIVE"
  });

  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: ""
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/me");
      setUser(res.data);
      
      setPersonalForm({
        fullName: res.data.fullName || "",
        phone: res.data.phone || "",
        country: "India"
      });

      if (res.data.franchise) {
        setBranchForm({
          name: res.data.franchise.name || "",
          location: res.data.franchise.location || "",
          ownerName: res.data.franchise.ownerName || "",
          contactNum: res.data.franchise.contactNum || "",
          status: res.data.franchise.status || "ACTIVE"
        });
      }
    } catch (error) {
      toast.error("Failed to load profile details");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonal = async () => {
    setSaving(true);
    try {
      await api.patch("/api/me/update", {
        fullName: personalForm.fullName,
        phone: personalForm.phone
      });
      toast.success("Personal information updated successfully");
      await fetchProfile();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update personal information");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranch = async () => {
    if (!user?.franchiseId) {
      toast.error("No active franchise associated with this user");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/api/franchise/${user.franchiseId}`, {
        name: branchForm.name,
        location: branchForm.location,
        ownerName: branchForm.ownerName,
        contactNum: branchForm.contactNum
      });
      toast.success("Branch profile details updated successfully");
      await fetchProfile();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update branch profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!passwordForm.password) {
      toast.error("Password cannot be empty");
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      await api.patch("/api/me/password", {
        password: passwordForm.password
      });
      toast.success("Password updated successfully");
      setPasswordForm({ password: "", confirmPassword: "" });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader2 className="animate-spin text-[#7C3AED]" size={32} />
      </div>
    );
  }

  const menuItems = [
    { id: "PERSONAL" as TabType, label: "Personal Information", icon: UserIcon },
    { id: "BRANCH" as TabType, label: "Branch Profile", icon: Building2 },
    { id: "FINANCIALS" as TabType, label: "Financials & Wallet", icon: Wallet },
    { id: "SECURITY" as TabType, label: "Password & Security", icon: Lock },
  ];

  return (
    <div className="flex bg-[#FDFCFD] dark:bg-slate-950 min-h-screen -m-8 relative">
      
      {/* Left Settings Sidebar */}
      <div className="w-80 border-r border-[#F0EAF0] dark:border-slate-800 p-8 flex flex-col justify-between bg-[#FDFCFD] dark:bg-slate-950">
        <div>
          <h2 className="text-[17px] font-black text-[#1A1A1A] dark:text-white mb-8 px-4 uppercase tracking-tight">
            Branch Settings
          </h2>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[13px] font-bold transition-all text-left uppercase tracking-wider",
                    isActive 
                      ? "bg-[#FAF9FA] dark:bg-slate-900 text-[#7C3AED] shadow-sm border border-slate-100 dark:border-white/5" 
                      : "text-[#666] hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-[#111] dark:hover:text-white"
                  )}
                >
                  <Icon size={16} className={clsx(isActive ? "text-[#7C3AED]" : "text-slate-400")} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* System ID / Version */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logged User</p>
          <p className="text-xs font-black text-slate-700 dark:text-slate-300 truncate mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Right Content Pane */}
      <div className="flex-1 p-12 max-w-5xl space-y-12 overflow-y-auto">
        
        {/* Render Tab 1: Personal Information */}
        {activeTab === "PERSONAL" && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="space-y-1">
              <h2 className="text-[17px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight">Personal Information</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Update your user identity and phone details</p>
            </div>

            <div className="space-y-8">
              {/* Profile Header Block */}
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 bg-[#7C3AED]/10 rounded-3xl flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-md overflow-hidden group">
                  <span className="text-3xl text-[#7C3AED] font-black uppercase">
                    {user?.fullName?.charAt(0) || "U"}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-[15px] font-black text-[#1A1A1A] dark:text-white">{user?.fullName || "User"}</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{user?.role?.replace('_', ' ') || "FRANCHISE ADMIN"}</p>
                  <p className="text-[11px] font-medium text-[#7C3AED]">{user?.email}</p>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Name</label>
                    <input 
                      type="text" 
                      value={personalForm.fullName}
                      onChange={(e) => setPersonalForm({ ...personalForm, fullName: e.target.value })}
                      className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED] dark:text-white" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Country</label>
                    <select 
                      value={personalForm.country}
                      disabled
                      className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold appearance-none cursor-not-allowed opacity-60 dark:text-white"
                    >
                      <option>India</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <input 
                      type="email" 
                      value={user?.email || ""}
                      className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold text-[#999] cursor-not-allowed" 
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                    <div className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <span className="text-[14px]">🇮🇳</span>
                      <span className="text-[14px] font-bold text-[#999]">+91</span>
                      <input 
                        type="text" 
                        value={personalForm.phone}
                        onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 10); setPersonalForm({ ...personalForm, phone: val }); }}
                        placeholder="10 digits"
                        className="flex-1 bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 focus:border-none dark:text-white outline-none" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="flex justify-end pt-8">
                <button 
                  onClick={handleSavePersonal}
                  disabled={saving}
                  className="px-10 py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-purple-200 dark:shadow-none active:scale-98 flex items-center gap-2"
                >
                  {saving && <Loader2 className="animate-spin" size={14} />}
                  Save Personal Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Render Tab 2: Branch Profile */}
        {activeTab === "BRANCH" && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="space-y-1">
              <h2 className="text-[17px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight">Branch Profile</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modify your physical franchise outlet location and owner metadata</p>
            </div>

            <div className="space-y-8">
              {!user?.franchise ? (
                <div className="p-8 text-center bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-3xl">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">No active branch profile details are currently linked to your login session.</p>
                </div>
              ) : (
                <>
                  {/* Branch Code Status Block */}
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                      <Building2 className="text-indigo-500" size={32} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-black text-[#1A1A1A] dark:text-white uppercase">{branchForm.name || "Unnamed Branch"}</h3>
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Branch ID: {user?.franchiseId}</p>
                    </div>
                  </div>

                  {/* Form Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Branch Name</label>
                        <input 
                          type="text" 
                          value={branchForm.name}
                          onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                          className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED] dark:text-white" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Owner Full Name</label>
                        <input 
                          type="text" 
                          value={branchForm.ownerName}
                          onChange={(e) => setBranchForm({ ...branchForm, ownerName: e.target.value })}
                          className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED] dark:text-white" 
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Physical Location/Address</label>
                        <input 
                          type="text" 
                          value={branchForm.location}
                          onChange={(e) => setBranchForm({ ...branchForm, location: e.target.value })}
                          className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED] dark:text-white" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Contact Phone Number</label>
                        <input 
                          type="text" 
                          value={branchForm.contactNum}
                          onChange={(e) => setBranchForm({ ...branchForm, contactNum: e.target.value })}
                          className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED] dark:text-white" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex justify-end pt-8">
                    <button 
                      onClick={handleSaveBranch}
                      disabled={saving}
                      className="px-10 py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-purple-200 dark:shadow-none active:scale-98 flex items-center gap-2"
                    >
                      {saving && <Loader2 className="animate-spin" size={14} />}
                      Save Branch Profile
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Render Tab 3: Financials & Wallet */}
        {activeTab === "FINANCIALS" && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="space-y-1">
              <h2 className="text-[17px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight">Financials & Wallet Limits</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">View branch accounting boundaries, outstanding bills, and digital balances</p>
            </div>

            <div className="space-y-8">
              {!user?.franchise ? (
                <div className="p-8 text-center bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-3xl">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">No accounting information is linked to your current login status.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Financial Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { 
                        label: "Wallet Balance", 
                        value: user.franchise.walletBalance || 0, 
                        icon: Wallet, 
                        color: "text-emerald-500", 
                        bg: "bg-emerald-500/10", 
                        border: "border-emerald-500/20" 
                      },
                      { 
                        label: "Outstanding Balance", 
                        value: user.franchise.outstandingAmount || 0, 
                        icon: CreditCard, 
                        color: "text-orange-500", 
                        bg: "bg-orange-500/10", 
                        border: "border-orange-500/20" 
                      },
                      { 
                        label: "HQ Credit Limit", 
                        value: user.franchise.creditLimit || 0, 
                        icon: ShieldCheck, 
                        color: "text-indigo-500", 
                        bg: "bg-indigo-500/10", 
                        border: "border-indigo-500/20" 
                      },
                    ].map((item, i) => (
                      <div key={i} className={clsx("bg-white dark:bg-slate-900 p-6 rounded-[28px] border shadow-md flex flex-col items-center text-center", item.border)}>
                        <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center mb-4", item.bg, item.color)}>
                          <item.icon size={26} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                        <div className={clsx("text-2xl font-black tabular-nums tracking-tight", item.color)}>
                          ₹{(item.value).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Financial Advice */}
                  <div className="p-8 bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 rounded-3xl space-y-4">
                    <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Franchise Accounting Scope</h3>
                    <div className="space-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <p className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Wallet Balance is used to instantly clear dispatch and purchase orders with Kiddos HQ.
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        Outstanding Balance shows your total payable credit to the Headquarters.
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Credit Limit represents the maximum stock amount you can order on credit before payments are halted.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Render Tab 4: Password & Security */}
        {activeTab === "SECURITY" && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="space-y-1">
              <h2 className="text-[17px] font-black text-[#1A1A1A] dark:text-white uppercase tracking-tight">Password & Security</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ensure your login credentials and operational access points are highly secure</p>
            </div>

            <div className="space-y-8">
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                    <input 
                      type="password" 
                      value={passwordForm.password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED] dark:text-white" 
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                    <input 
                      type="password" 
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-1 focus:ring-[#7C3AED] focus:border-[#7C3AED] dark:text-white" 
                    />
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="flex justify-end pt-8">
                <button 
                  onClick={handleSavePassword}
                  disabled={saving}
                  className="px-10 py-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-purple-200 dark:shadow-none active:scale-98 flex items-center gap-2"
                >
                  {saving && <Loader2 className="animate-spin" size={14} />}
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
