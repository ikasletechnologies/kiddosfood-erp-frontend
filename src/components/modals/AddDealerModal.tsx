"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";
import api, { gstApi } from "@/lib/api";

export interface AddDealerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
  title?: string;
  scopeLabel?: string;
}

const sectionLabelClass = "block text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-3 pb-2 border-b border-gray-100 dark:border-white/5";

const getEmptyForm = () => ({
  name: "",
  phone: "",
  email: "",
  status: "ACTIVE",
  
  // Tax Information
  gstin: "",
  gstType: "Unregistered/Consumer",
  
  // Address Information
  billingAddress: "",
  shippingAddress: "",
  pincode: "",
  state: "",
  city: "",
  district: "",

  // Credit & Balance
  openingBalance: "",
  openingBalanceType: "receive", // "pay" or "receive"
  asOfDate: new Date().toISOString().split("T")[0],
  noCreditLimit: true,
  customCreditLimit: "",
});

export default function AddDealerModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title,
  scopeLabel = "HQ — Kiddos Food Headquarters"
}: AddDealerModalProps) {
  const isEdit = Boolean(initialData && initialData.id);
  const displayTitle = title || (isEdit ? "EDIT HQ DEALER" : "ADD HQ DEALER");
  const saveLabel = isEdit ? "Update Dealer" : "Save Dealer";

  const [form, setForm] = useState(getEmptyForm());
  const [saving, setSaving] = useState(false);
  const [fetchingGst, setFetchingGst] = useState(false);

  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [gstError, setGstError] = useState("");

  // Populate form on open/edit
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const bal = Number(initialData.openingBalance) || 0;
        let mappedBalanceType = initialData.openingBalanceType || (bal < 0 ? "pay" : "receive");
        const hasCustomCredit = initialData.creditLimit !== null && initialData.creditLimit !== undefined && Number(initialData.creditLimit) > 0;

        let asOfDateStr = new Date().toISOString().split("T")[0];
        if (initialData.asOfDate) {
          try {
            asOfDateStr = new Date(initialData.asOfDate).toISOString().split("T")[0];
          } catch {}
        } else if (initialData.createdAt) {
          try {
            asOfDateStr = new Date(initialData.createdAt).toISOString().split("T")[0];
          } catch {}
        }

        setForm({
          name: initialData.name || "",
          phone: initialData.phone || initialData.contact || "",
          email: initialData.email || "",
          status: initialData.status || "ACTIVE",
          gstin: initialData.gstin || initialData.taxNumber || initialData.gstNumber || "",
          gstType: initialData.gstType || "Unregistered/Consumer",
          billingAddress: initialData.address || initialData.billingAddress || "",
          shippingAddress: initialData.shippingAddress || initialData.address || initialData.billingAddress || "",
          pincode: initialData.pincode || initialData.pinCode || "",
          state: initialData.state || "",
          city: initialData.city || "",
          district: initialData.district || "",
          openingBalance: Math.abs(bal) > 0 ? String(Math.abs(bal)) : "",
          openingBalanceType: mappedBalanceType,
          asOfDate: asOfDateStr,
          noCreditLimit: !hasCustomCredit,
          customCreditLimit: hasCustomCredit ? String(initialData.creditLimit) : "",
        });
      } else {
        setForm(getEmptyForm());
      }
      setPhoneError("");
      setEmailError("");
      setGstError("");
    }
  }, [isOpen, initialData]);

  // Real-time duplicate validation against existing dealers
  const validateFieldUniqueness = async (field: 'phone' | 'email', value: string) => {
    if (!value || !value.trim()) {
      if (field === 'phone') setPhoneError("");
      if (field === 'email') setEmailError("");
      return;
    }

    try {
      const res = await api.get('/api/dealers');
      const allDealers = res.data || [];
      const duplicate = allDealers.find((d: any) => {
        if (d.id === initialData?.id) return false;
        if (field === 'phone') {
          const dPhone = (d.phone || d.contact || "").trim();
          return dPhone === value.trim();
        }
        if (field === 'email') {
          return (d.email || "").trim().toLowerCase() === value.trim().toLowerCase();
        }
        return false;
      });

      if (duplicate) {
        if (field === 'phone') setPhoneError("A dealer with this contact number already exists.");
        if (field === 'email') setEmailError("A dealer with this email address already exists.");
      } else {
        if (field === 'phone' && (!phoneError || phoneError.includes('already exists'))) setPhoneError("");
        if (field === 'email' && (!emailError || emailError.includes('already exists'))) setEmailError("");
      }
    } catch (err) {
      console.error(`Unique check failed for ${field}:`, err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      validateFieldUniqueness('phone', form.phone);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.phone, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      validateFieldUniqueness('email', form.email);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.email, isOpen]);

  // Real-time phone format check
  useEffect(() => {
    if (!form.phone) {
      if (!phoneError || phoneError.includes('digits') || phoneError.includes('numeric')) {
        setPhoneError("");
      }
      return;
    }
    if (form.phone.length > 0 && form.phone.length < 10) {
      setPhoneError("Phone number must be exactly 10 digits.");
    } else if (form.phone.length === 10 && !/^\d{10}$/.test(form.phone)) {
      setPhoneError("Phone number must contain only numeric digits.");
    }
  }, [form.phone]);

  // Real-time email format check
  useEffect(() => {
    if (!form.email || !form.email.trim()) {
      if (!emailError || emailError.includes('valid email')) {
        setEmailError("");
      }
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setEmailError("Please enter a valid email address.");
    }
  }, [form.email]);

  // Auto-fetch GST details via our backend proxy
  const fetchGstDetails = async (gstin: string) => {
    const cleanGst = gstin.trim().toUpperCase();
    if (cleanGst.length !== 15 || !/^[A-Z0-9]{15}$/.test(cleanGst)) {
      return;
    }

    setFetchingGst(true);
    try {
      const { data } = await gstApi.verify(cleanGst);
      if (data.success) {
        setForm((prev) => ({
          ...prev,
          name: prev.name || data.legalName || "",
          billingAddress: data.address || prev.billingAddress,
          shippingAddress: prev.shippingAddress || data.address || prev.billingAddress,
          state: data.state || prev.state,
          city: data.city || prev.city,
          pincode: data.pinCode || prev.pincode,
          gstType: "Registered Business"
        }));
        toast.success(`Auto-filled details for "${data.legalName || cleanGst}"`);
        setGstError("");
      }
    } catch (err: any) {
      console.error("Auto-fetch GST details failed:", err);
    } finally {
      setFetchingGst(false);
    }
  };

  const handleConfirm = async () => {
    if (saving) return;

    if (phoneError || emailError || gstError) {
      toast.error(phoneError || emailError || gstError || "Please resolve form errors before saving.");
      return;
    }

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error("Dealer Name is required.");
      return;
    }

    const nameRegex = /^[A-Za-z0-9\s&.,\-()]+$/;
    if (!nameRegex.test(trimmedName)) {
      toast.error("Dealer Name must only contain alphanumeric characters, spaces, and standard symbols (& . , - ()).");
      return;
    }

    // Phone number validation: exactly 10 numeric digits if provided
    if (form.phone && form.phone.trim()) {
      const cleanPhone = form.phone.trim();
      if (!/^\d{10}$/.test(cleanPhone)) {
        setPhoneError("Contact Number must be exactly 10 digits.");
        toast.error("Contact Number must be a valid 10-digit number.");
        return;
      }
    }

    // Email validation
    if (form.email && form.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setEmailError("Please enter a valid email address.");
        toast.error("Please enter a valid email address.");
        return;
      }
    }

    // GSTIN validation: 15-character valid GST format if provided
    if (form.gstin && form.gstin.trim()) {
      const cleanGst = form.gstin.trim().toUpperCase();
      if (cleanGst.length !== 15 || !/^[A-Z0-9]{15}$/.test(cleanGst)) {
        setGstError("GST Number must be a valid 15-character alphanumeric GSTIN.");
        toast.error("Please enter a valid 15-character GSTIN.");
        return;
      }
    }

    // Billing Address validation
    if (!form.billingAddress || !form.billingAddress.trim()) {
      toast.error("Billing Address is required.");
      return;
    }

    // Pincode validation: exactly 6 numeric digits
    const cleanPincode = form.pincode ? form.pincode.replace(/\D/g, "") : "";
    if (!cleanPincode || cleanPincode.length !== 6) {
      toast.error("Pincode must be exactly 6 digits.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        phone: form.phone && form.phone.trim() ? form.phone.trim() : null,
        email: form.email && form.email.trim() ? form.email.trim().toLowerCase() : null,
        address: form.billingAddress.trim(),
        billingAddress: form.billingAddress.trim(),
        shippingAddress: form.shippingAddress && form.shippingAddress.trim() ? form.shippingAddress.trim() : form.billingAddress.trim(),
        pincode: cleanPincode,
        state: form.state && form.state.trim() ? form.state.trim() : null,
        city: form.city && form.city.trim() ? form.city.trim() : null,
        district: form.district && form.district.trim() ? form.district.trim() : null,
        gstin: form.gstin && form.gstin.trim() ? form.gstin.trim().toUpperCase() : null,
        gstNumber: form.gstin && form.gstin.trim() ? form.gstin.trim().toUpperCase() : null,
        gstType: form.gstType || "Unregistered/Consumer",
        openingBalance: initialData?.openingBalance !== undefined ? Number(initialData.openingBalance) : 0,
        openingBalanceType: initialData?.openingBalanceType || null,
        asOfDate: initialData?.asOfDate || null,
        creditLimit: initialData?.creditLimit ?? null,
        status: form.status || "ACTIVE"
      };

      await onSave(payload);
      onClose();
    } catch (e: any) {
      console.error(e);
      const errMsg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Failed to save dealer";
      if (errMsg.toLowerCase().includes('email')) {
        setEmailError(errMsg);
      }
      if (errMsg.toLowerCase().includes('phone') || errMsg.toLowerCase().includes('contact')) {
        setPhoneError(errMsg);
      }
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#13151f] rounded-2xl sm:rounded-[2rem] shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] border border-slate-200 dark:border-white/10 min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#13151f] gap-3">
          <h2 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white truncate flex-1 uppercase tracking-tight">
            {displayTitle}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0">

          {/* Target Scope — read-only */}
          {scopeLabel && (
            <div>
              <label className={sectionLabelClass}>Target Scope</label>
              <div className="w-full border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/30 rounded-lg px-3 py-2.5 text-sm font-semibold text-orange-700 dark:text-orange-400">
                {scopeLabel}
              </div>
            </div>
          )}

          {/* SECTION: Basic Information */}
          <div>
            <label className={sectionLabelClass}>Basic Information</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                  Dealer Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter dealer name..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                  Contact Number
                </label>
                <input
                  type="text"
                  placeholder="10 digits..."
                  value={form.phone}
                  maxLength={10}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setForm({ ...form, phone: clean });
                  }}
                  className={clsx(
                    "w-full border rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none transition-colors dark:bg-white/5 font-mono",
                    phoneError 
                      ? "border-rose-500 focus:border-rose-500 bg-white dark:bg-white/5 placeholder-gray-400" 
                      : "border-gray-300 dark:border-white/10 focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500"
                  )}
                />
                {phoneError && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{phoneError}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="optional@gmail.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={clsx(
                    "w-full border rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none transition-colors dark:bg-white/5",
                    emailError 
                      ? "border-rose-500 focus:border-rose-500 bg-white dark:bg-white/5 placeholder-gray-400" 
                      : "border-gray-300 dark:border-white/10 focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500"
                  )}
                />
                {emailError && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{emailError}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 transition-colors cursor-pointer"
                >
                  <option value="ACTIVE" className="dark:bg-[#13151f]">ACTIVE</option>
                  <option value="INACTIVE" className="dark:bg-[#13151f]">INACTIVE</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION: Tax Information */}
          <div>
            <label className={sectionLabelClass}>Tax Information</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-orange-500 mb-1.5 flex items-center gap-1">
                  GST Number
                  <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-[#f58220] px-1.5 py-0.5 rounded font-normal font-sans">Priority</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    value={form.gstin}
                    maxLength={15}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
                      setForm({ ...form, gstin: val });
                      if (val.length === 15) {
                        fetchGstDetails(val);
                      }
                    }}
                    className={clsx(
                      "w-full border rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none transition-colors uppercase font-mono pr-12 dark:bg-white/5",
                      gstError 
                        ? "border-rose-500 focus:border-rose-500 bg-white dark:bg-white/5 placeholder-gray-400" 
                        : "border-gray-300 dark:border-white/10 focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500"
                    )}
                  />
                  {fetchingGst ? (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500 animate-spin" />
                  ) : (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                      {form.gstin.length}/15
                    </span>
                  )}
                </div>
                {gstError && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{gstError}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                  GST Type
                </label>
                <select
                  value={form.gstType}
                  onChange={(e) => setForm({ ...form, gstType: e.target.value })}
                  className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 transition-colors cursor-pointer"
                >
                  <option className="dark:bg-[#13151f]">Unregistered/Consumer</option>
                  <option className="dark:bg-[#13151f]">Registered Business</option>
                  <option className="dark:bg-[#13151f]">Composition Scheme</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION: Address */}
          <div>
            <label className={sectionLabelClass}>Address</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column - Addresses */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                    Billing Address *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter billing address..."
                    value={form.billingAddress}
                    onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500 transition-colors resize-none h-[88px]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400">
                      Shipping Address
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, shippingAddress: prev.billingAddress }))}
                      className="text-[11px] text-orange-600 dark:text-orange-400 hover:text-orange-700 font-medium hover:underline cursor-pointer"
                    >
                      Same as Billing Address
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Enter shipping delivery address (optional)..."
                    value={form.shippingAddress}
                    onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 placeholder-gray-400 dark:placeholder-slate-500 transition-colors resize-none h-[88px]"
                  />
                </div>
              </div>

              {/* Right Column - Location Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    placeholder="6-digit Pincode"
                    value={form.pincode}
                    maxLength={6}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setForm({ ...form, pincode: val });
                    }}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 transition-colors font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      placeholder="State"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="City"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                    District
                  </label>
                  <input
                    type="text"
                    placeholder="District"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                    className="w-full border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-white outline-none focus:border-orange-400 bg-white dark:bg-white/5 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shrink-0 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0e1017]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors text-center cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="px-6 py-2.5 sm:py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
