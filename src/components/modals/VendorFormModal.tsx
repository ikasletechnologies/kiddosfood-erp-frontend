"use client";

import { useState } from "react";
import { X, Loader2, User, Phone, Mail, MapPin, Tag, ShieldCheck } from "lucide-react";
import { vendorsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

interface VendorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newVendor: any) => void;
}

const EMPTY_FORM = {
  name: "",
  contact: "",
  email: "",
  address: "",
  remark: "",
  gstNumber: "",
  category: "General",
  paymentTerms: "IMMEDIATE" as const,
  status: "ACTIVE" as const
};

export default function VendorFormModal({ isOpen, onClose, onSuccess }: VendorFormModalProps) {
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [fetchingGst, setFetchingGst] = useState(false);

  if (!isOpen) return null;

  // Auto-fetch GST details from Next.js server-side route
  const fetchGstDetails = async (gstin: string) => {
    const cleanGst = gstin.trim().toUpperCase();
    // Standard 15-character GSTIN regex validation
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGst)) {
      return;
    }

    setFetchingGst(true);
    try {
      const res = await fetch(`/api/gst-verify/${cleanGst}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch GST details");
      }
      
      const data = await res.json();
      if (data.success) {
        setForm((prev) => ({
          ...prev,
          name: data.legalName || prev.name,
          address: data.address || prev.address
        }));
        showToast(
          `Successfully auto-filled details for "${data.legalName}"${data.mocked ? " (Demo Mode)" : ""}`,
          "success"
        );
      }
    } catch (err: any) {
      console.error("Auto-fetch GST details failed:", err);
      showToast(err.message || "Could not auto-fetch GST details. Please enter manually.", "warning");
    } finally {
      setFetchingGst(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      showToast("Vendor Name is required.", "error");
      return;
    }

    const nameRegex = /^[A-Za-z0-9\s&.,\-()]+$/;
    if (!nameRegex.test(trimmedName)) {
      showToast("Vendor Name must only contain alphanumeric characters, spaces, and standard symbols (& . , - ()).", "error");
      return;
    }

    if (!form.contact) {
      showToast("Contact Number is required.", "error");
      return;
    }

    if (!/^\d{10}$/.test(form.contact)) {
      showToast("Contact Number must be a valid 10-digit number.", "error");
      return;
    }

    if (form.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        showToast("Please enter a valid email address.", "error");
        return;
      }
    }

    if (!form.address || !form.address.trim()) {
      showToast("Business Address is required.", "error");
      return;
    }

    if (form.gstNumber && form.gstNumber.trim()) {
      const cleanGst = form.gstNumber.trim().toUpperCase();
      try {
        const res = await vendorsApi.getAll();
        const allVendors = res.data?.vendors || res.data || [];
        const duplicate = allVendors.find((v: any) => 
          (v.gstNumber || v.gstin || "").trim().toUpperCase() === cleanGst
        );
        if (duplicate) {
          showToast("GST Number already exists.", "error");
          return;
        }
      } catch (err) {
        console.error("Duplicate GST check failed:", err);
      }
    }

    setSaving(true);
    try {
      const response = await vendorsApi.create({
        ...form,
        name: trimmedName
      });
      const v = response.data;
      
      // Map to context-friendly structure
      const mappedVendor = {
        id: v.id,
        name: v.name,
        phone: v.phone || v.mobile || v.contact,
        email: v.email,
        gstNumber: v.gstNumber,
        advanceBalance: v.advanceBalance || 0,
        balanceDue: v.balanceDue || 0,
        vendorCode: v.vendorCode,
        suppliedMaterials: [] 
      };

      showToast("New vendor registered successfully", "success");
      onSuccess(mappedVendor);
      onClose();
      setForm(EMPTY_FORM);
    } catch (error: any) {
      console.error("Failed to save vendor", error);
      const errMsg = error.response?.data?.error || error.response?.data?.message || "";
      if (errMsg.toLowerCase().includes("gst") && (errMsg.toLowerCase().includes("exist") || errMsg.toLowerCase().includes("duplicate") || errMsg.toLowerCase().includes("unique"))) {
        showToast("GST Number already exists.", "error");
      } else {
        showToast(errMsg || "Failed to create vendor", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-300">
      <div 
        className="bg-white dark:bg-[#0A0D14] rounded-2xl sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 dark:border-white/5 animate-in zoom-in-95 duration-300 max-h-[92vh] sm:max-h-[90vh] flex flex-col min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-900/50 px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between gap-3">
           <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2 truncate">
                 <User className="text-[#7C3AED] shrink-0" size={20} /> <span className="truncate">New Vendor Identity</span>
              </h2>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">Onboard a new supplier to the ERP ecosystem</p>
           </div>
           <button 
             onClick={onClose}
             className="p-1.5 sm:p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all shrink-0"
           >
              <X size={18} />
           </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-8 space-y-4 sm:space-y-8 overflow-y-auto custom-scrollbar flex-1 min-w-0">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 min-w-0">
              {/* Primary Info */}
              <div className="space-y-4 sm:space-y-6 min-w-0">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                       <User size={12} /> Vendor Legal Name
                    </label>
                    <input 
                       autoFocus
                       placeholder="e.g. Reliance Fresh"
                       value={form.name}
                       onChange={(e) => setForm({...form, name: e.target.value})}
                       className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none focus:ring-2 ring-[#7C3AED]/20 focus:bg-white transition-all"
                    />
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                       <Phone size={12} /> Contact Number
                    </label>
                    <input 
                       placeholder="10 digit mobile..."
                       maxLength={10}
                       value={form.contact}
                       onChange={(e) => setForm({...form, contact: e.target.value.replace(/\D/g, "")})}
                       className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none focus:ring-2 ring-[#7C3AED]/20 focus:bg-white transition-all"
                    />
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                       <Mail size={12} /> Email Address
                    </label>
                    <input 
                       placeholder="vendor@company.com"
                       value={form.email}
                       onChange={(e) => setForm({...form, email: e.target.value})}
                       className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none focus:ring-2 ring-[#7C3AED]/20 focus:bg-white transition-all"
                    />
                 </div>
              </div>

              {/* Advanced Info */}
              <div className="space-y-4 sm:space-y-6 min-w-0">
                 <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <ShieldCheck size={12} /> GST Registration
                       </label>
                       {fetchingGst && (
                          <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider animate-pulse flex items-center gap-1">
                             <Loader2 size={10} className="animate-spin" /> Fetching...
                          </span>
                       )}
                    </div>
                    <div className="relative">
                       <input 
                          placeholder="22AAAAA0000A1Z5"
                          value={form.gstNumber}
                          maxLength={15}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
                            setForm({...form, gstNumber: val});
                            if (val.length === 15) {
                              fetchGstDetails(val);
                            }
                          }}
                          className="w-full pl-3.5 sm:pl-4 pr-16 py-2.5 sm:py-3 bg-slate-50 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none focus:ring-2 ring-[#7C3AED]/20 focus:bg-white transition-all font-mono tracking-wider"
                       />
                       <span className="absolute left-3.5 sm:left-4 bottom-[-16px] text-[9px] font-bold text-slate-400">{form.gstNumber.length}/15</span>
                       {form.gstNumber.length === 15 && !fetchingGst && (
                          <button
                             type="button"
                             onClick={() => fetchGstDetails(form.gstNumber)}
                             className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-[#7C3AED] hover:text-[#6D28D9] bg-purple-50 dark:bg-purple-950/40 px-2 py-1 rounded-lg border border-purple-100 dark:border-purple-900 transition-all active:scale-95"
                          >
                             Fetch
                          </button>
                       )}
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                       <Tag size={12} /> Payment Cycle
                    </label>
                    <select 
                       value={form.paymentTerms}
                       onChange={(e) => setForm({...form, paymentTerms: e.target.value as any})}
                       className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none focus:ring-2 ring-[#7C3AED]/20 focus:bg-white transition-all"
                    >
                       <option value="IMMEDIATE">Immediate</option>
                       <option value="NET_7">Net 7 Days</option>
                       <option value="NET_30">Net 30 Days</option>
                       <option value="ADVANCE">Advance Required</option>
                    </select>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                       <MapPin size={12} /> Business Address
                    </label>
                    <textarea 
                       placeholder="Full registered address..."
                       rows={2}
                       value={form.address}
                       onChange={(e) => setForm({...form, address: e.target.value})}
                       className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none focus:ring-2 ring-[#7C3AED]/20 focus:bg-white transition-all resize-none"
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-8 py-3.5 sm:py-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-4">
           <button 
             onClick={onClose}
             className="px-4 sm:px-6 py-2.5 sm:py-3 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-white rounded-xl transition-all text-center"
           >
              Discard
           </button>
           <button 
             onClick={handleSave}
             disabled={saving}
             className="w-full sm:w-auto sm:min-w-[180px] bg-[#7C3AED] text-white py-2.5 sm:py-3 px-6 rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-purple-200 active:scale-95 transition-all flex items-center justify-center gap-2"
           >
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Confirm Registration"}
           </button>
        </div>
      </div>
    </div>
  );
}
