"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Info } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "react-hot-toast";

export interface AddPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
  title?: string;
  partyType?: 'vendor' | 'customer';
}

const getEmptyForm = (partyType?: 'vendor' | 'customer') => ({
  name: "",
  contact: "",
  email: "",
  category: "",
  paymentTerms: "IMMEDIATE",
  status: "ACTIVE",
  
  // GST & Address Tab
  gstNumber: "",
  gstType: "Unregistered/Consumer",
  state: "",
  district: "",
  city: "",
  pincode: "",
  billingAddress: "",
  shippingAddressEnabled: false,
  shippingAddress: "",
  
  // Credit & Balance Tab
  openingBalance: "",
  openingBalanceType: partyType === 'customer' ? "receive" : "pay", // "pay" or "receive"
  asOfDate: new Date().toISOString().split("T")[0],
  noCreditLimit: true,
  customCreditLimit: "",
});

export default function AddPartyModal({ isOpen, onClose, onSave, initialData, title, partyType = "vendor" }: AddPartyModalProps) {
  const displayTitle = title || (partyType === 'customer' ? 'ADD PARTY' : 'ADD VENDOR');
  const [form, setForm] = useState(getEmptyForm(partyType));
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"GST" | "CREDIT">("GST");
  const [fetchingGst, setFetchingGst] = useState(false);

  // Auto-fetch GST details from Next.js server-side route
  const fetchGstDetails = async (gstin: string) => {
    const cleanGst = gstin.trim().toUpperCase();
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
          billingAddress: data.address || prev.billingAddress,
          shippingAddress: prev.shippingAddress || data.address || prev.billingAddress,
          state: data.state || prev.state,
          district: data.district || prev.district,
          city: data.city || prev.city,
          pincode: data.pinCode || prev.pincode,
          gstType: "Registered Business"
        }));
        toast.success(`Successfully auto-filled details for "${data.legalName}"${data.mocked ? " (Demo Mode)" : ""}`);
      }
    } catch (err: any) {
      console.error("Auto-fetch GST details failed:", err);
      toast.error(err.message || "Could not auto-fetch GST details. Please enter manually.");
    } finally {
      setFetchingGst(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const bal = Number(initialData.openingBalance) || 0;
        let mappedBalanceType = partyType === 'customer' ? "receive" : "pay";
        
        if (partyType === 'vendor') {
           mappedBalanceType = bal < 0 ? "receive" : "pay";
        } else {
           mappedBalanceType = bal < 0 ? "pay" : "receive";
        }

        setForm({ 
          ...getEmptyForm(partyType), 
          ...initialData,
          name: initialData.name || "",
          contact: initialData.contact || initialData.phone || "",
          billingAddress: initialData.address || initialData.billingAddress || "",
          shippingAddress: initialData.shippingAddress || initialData.address || initialData.billingAddress || "",
          pincode: initialData.pinCode || initialData.pincode || "",
          openingBalance: Math.abs(bal) || "",
          openingBalanceType: mappedBalanceType,
          category: initialData.category || "",
          paymentTerms: initialData.paymentTerms || "IMMEDIATE",
          status: initialData.status || "ACTIVE",
        });
      } else {
        setForm(getEmptyForm(partyType));
      }
      setActiveTab("GST");
    }
  }, [isOpen, initialData, partyType]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error(partyType === 'vendor' ? "Vendor Name is required." : "Party Name is required.");
      return;
    }

    const nameRegex = /^[A-Za-z0-9\s&.,\-()]+$/;
    if (!nameRegex.test(trimmedName)) {
      toast.error(
        partyType === 'vendor'
          ? "Vendor Name must only contain alphanumeric characters, spaces, and standard symbols (& . , - ())."
          : "Party Name must only contain alphanumeric characters, spaces, and standard symbols (& . , - ())."
      );
      return;
    }

    if (!form.contact) {
      if (partyType === 'vendor') {
        toast.error("Contact Number is required.");
        return;
      }
    } else {
      if (!/^\d{10}$/.test(form.contact)) {
        toast.error("Contact Number must be a valid 10-digit number.");
        return;
      }
    }

    if (form.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        toast.error("Please enter a valid email address.");
        return;
      }
    }

    if (!form.billingAddress || !form.billingAddress.trim()) {
      toast.error("Billing Address is required.");
      setActiveTab("GST");
      return;
    }

    if (!form.shippingAddress || !form.shippingAddress.trim()) {
      toast.error("Shipping Address is required.");
      setActiveTab("GST");
      return;
    }

    // Opening Balance validation (must be non-negative)
    if (form.openingBalance !== "") {
      const openingBalNum = Number(form.openingBalance);
      if (isNaN(openingBalNum) || openingBalNum < 0) {
        toast.error("Opening Balance must be a non-negative number.");
        return;
      }
    }

    // As Of Date validation (must not be in the future)
    if (form.asOfDate) {
      const selectedDate = new Date(form.asOfDate);
      const today = new Date();
      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        toast.error("As Of Date cannot be in the future.");
        return;
      }
    }

    // Credit Limit validation (must be non-negative and is required if Custom Limit is selected)
    if (!form.noCreditLimit) {
      const limitStr = String(form.customCreditLimit).trim();
      if (limitStr === "") {
        toast.error("Credit Limit is required when Custom Limit is selected.");
        return;
      }
      const limitNum = Number(limitStr);
      if (isNaN(limitNum) || limitNum < 0) {
        toast.error("Credit Limit must be a non-negative number.");
        return;
      }
    }

    setSaving(true);
    try {
      let finalOpeningBalance = Number(form.openingBalance) || 0;
      if (partyType === 'vendor') {
        if (form.openingBalanceType === 'receive') finalOpeningBalance = -Math.abs(finalOpeningBalance);
        else finalOpeningBalance = Math.abs(finalOpeningBalance);
      } else {
        if (form.openingBalanceType === 'pay') finalOpeningBalance = -Math.abs(finalOpeningBalance);
        else finalOpeningBalance = Math.abs(finalOpeningBalance);
      }

      const payload = {
        name: trimmedName,
        contact: form.contact,
        email: form.email,
        address: form.billingAddress.trim(),
        billingAddress: form.billingAddress.trim(),
        shippingAddress: form.shippingAddress.trim(),
        state: form.state,
        district: form.district,
        city: form.city,
        pincode: form.pincode,
        gstNumber: form.gstNumber,
        gstType: form.gstType,
        openingBalance: finalOpeningBalance,
        openingBalanceType: form.openingBalanceType,
        asOfDate: form.asOfDate,
        creditLimit: form.noCreditLimit ? null : (Number(form.customCreditLimit) || 0),
        category: form.category,
        paymentTerms: form.paymentTerms,
        status: form.status,
      };
      
      await onSave(payload);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">{displayTitle}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          
          {/* Top Always-Visible Fields */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-xs font-semibold text-orange-500 mb-1.5 flex items-center gap-1">
                GST Number
                <span className="text-[10px] bg-orange-100 text-[#f58220] px-1.5 py-0.5 rounded font-normal font-sans">Priority</span>
              </label>
              <div className="relative">
                <input 
                  placeholder="e.g. 29ABCDE1234F1Z5" 
                  value={form.gstNumber} 
                  maxLength={15}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                    setForm({...form, gstNumber: val});
                    if (val.length === 15) {
                      fetchGstDetails(val);
                    }
                  }} 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors uppercase font-mono pr-12" 
                />
                {fetchingGst ? (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500 animate-spin" />
                ) : (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">{form.gstNumber.length}/15</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{partyType === 'customer' ? 'Party Name *' : 'Vendor Name *'}</label>
              <input 
                placeholder="Enter name..." 
                value={form.name} 
                onChange={(e) => setForm({...form, name: e.target.value})} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Contact Number</label>
              <input 
                placeholder="10 digits..." 
                value={form.contact} 
                maxLength={10} 
                onChange={(e) => setForm({...form, contact: e.target.value.replace(/\D/g, "")})} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors" 
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">GST Type</label>
              <select 
                value={form.gstType} 
                onChange={(e) => setForm({...form, gstType: e.target.value})} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors"
              >
                <option>Unregistered/Consumer</option>
                <option>Registered Business</option>
                <option>Composition Scheme</option>
              </select>
            </div>
            <div className={partyType === 'customer' ? "col-span-2" : ""}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Email Address</label>
              <input 
                placeholder="optional@gmail.com" 
                value={form.email} 
                onChange={(e) => setForm({...form, email: e.target.value})} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors" 
              />
            </div>
            {partyType === 'vendor' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Material Category</label>
                  <input 
                    placeholder="e.g. Raw Material, Packaging" 
                    value={form.category} 
                    onChange={(e) => setForm({...form, category: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Credit Period (Payment Terms)</label>
                  <select 
                    value={form.paymentTerms} 
                    onChange={(e) => setForm({...form, paymentTerms: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors"
                  >
                    <option value="IMMEDIATE">Immediate (0 Days)</option>
                    <option value="NET_7">7 Days (Net 7)</option>
                    <option value="NET_30">30 Days (Net 30)</option>
                    <option value="ADVANCE">Advance Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({...form, status: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="BLACKLISTED">Blacklisted</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Tabs Navigation */}
          <div className="flex items-center gap-8 border-b border-gray-200 mb-6">
            <button 
              type="button"
              onClick={() => setActiveTab("GST")}
              className={clsx(
                "pb-3 text-sm font-semibold transition-all",
                activeTab === "GST" ? "border-b-2 border-orange-500 text-orange-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              GST & Address
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab("CREDIT")}
              className={clsx(
                "pb-3 text-sm font-semibold transition-all flex items-center gap-2",
                activeTab === "CREDIT" ? "border-b-2 border-orange-500 text-orange-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Credit & Balance
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[360px]">
            {activeTab === "GST" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Billing Address *</label>
                      <textarea 
                        rows={3}
                        placeholder="Address..." 
                        value={form.billingAddress} 
                        onChange={(e) => setForm({...form, billingAddress: e.target.value})} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors resize-none h-[88px]" 
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-gray-500">Shipping Address *</label>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, shippingAddress: prev.billingAddress }))}
                          className="text-[11px] text-orange-600 hover:text-orange-700 font-medium hover:underline"
                        >
                          Same as Billing Address
                        </button>
                      </div>
                      <textarea 
                        rows={3}
                        placeholder="Shipping Address..." 
                        value={form.shippingAddress} 
                        onChange={(e) => setForm({...form, shippingAddress: e.target.value})} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors resize-none h-[88px]" 
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Pincode</label>
                      <input 
                        placeholder="Pincode"
                        value={form.pincode} 
                        onChange={(e) => setForm({...form, pincode: e.target.value.replace(/\D/g, "")})} 
                        maxLength={6}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">State</label>
                        <input 
                          placeholder="State"
                          value={form.state} 
                          onChange={(e) => setForm({...form, state: e.target.value})} 
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">City</label>
                        <input 
                          placeholder="City"
                          value={form.city} 
                          onChange={(e) => setForm({...form, city: e.target.value})} 
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">District</label>
                      <input 
                        placeholder="District"
                        value={form.district} 
                        onChange={(e) => setForm({...form, district: e.target.value})} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) }

            {activeTab === "CREDIT" && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 w-1/2">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-blue-500 mb-1.5">Opening Balance</label>
                      <input 
                        type="number"
                        placeholder="0.00" 
                        value={form.openingBalance} 
                        onChange={(e) => setForm({...form, openingBalance: e.target.value})} 
                        className="w-full border-2 border-blue-500 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-4 ring-blue-500/10 bg-white placeholder-gray-400 transition-colors" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">As Of Date</label>
                      <input 
                        type="date"
                        value={form.asOfDate} 
                        onChange={(e) => setForm({...form, asOfDate: e.target.value})} 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white transition-colors" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={clsx(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        form.openingBalanceType === "pay" ? "border-blue-500" : "border-gray-300 group-hover:border-blue-300"
                      )}>
                        {form.openingBalanceType === "pay" && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                      </div>
                      <input 
                        type="radio" 
                        name="balanceType" 
                        className="hidden"
                        checked={form.openingBalanceType === "pay"}
                        onChange={() => setForm({...form, openingBalanceType: "pay"})}
                      />
                      <span className="text-sm font-medium text-gray-700">To Pay</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={clsx(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        form.openingBalanceType === "receive" ? "border-emerald-500" : "border-gray-300 group-hover:border-emerald-300"
                      )}>
                        {form.openingBalanceType === "receive" && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                      </div>
                      <input 
                        type="radio" 
                        name="balanceType" 
                        className="hidden"
                        checked={form.openingBalanceType === "receive"}
                        onChange={() => setForm({...form, openingBalanceType: "receive"})}
                      />
                      <span className="text-sm font-medium text-gray-700">To Receive</span>
                    </label>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-1">
                      <label className="block text-xs font-medium text-gray-500">Credit Limit</label>
                      <Info size={12} className="text-gray-400" />
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <span className={clsx("text-sm transition-colors", form.noCreditLimit ? "text-blue-500 font-medium" : "text-gray-400")}>No Limit</span>
                      <button 
                        onClick={() => setForm({...form, noCreditLimit: !form.noCreditLimit})}
                        className={clsx("w-9 h-5 rounded-full relative transition-colors", form.noCreditLimit ? "bg-blue-500" : "bg-gray-300")}
                      >
                        <div className={clsx("w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all shadow-sm", form.noCreditLimit ? "left-5" : "left-1")} />
                      </button>
                      <span className={clsx("text-sm transition-colors", !form.noCreditLimit ? "text-gray-700 font-medium" : "text-gray-400")}>Custom Limit</span>
                    </div>
                    
                    {!form.noCreditLimit && (
                      <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                        <input 
                          type="number"
                          placeholder="Enter limit amount..." 
                          value={form.customCreditLimit} 
                          onChange={(e) => setForm({...form, customCreditLimit: e.target.value})} 
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-orange-400 bg-white placeholder-gray-400 transition-colors" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0 border-t border-gray-200 bg-gray-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          
          <button 
            onClick={handleConfirm}
            disabled={saving}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
