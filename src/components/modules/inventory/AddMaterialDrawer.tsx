"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Save, Sparkles, ChevronDown,
  AlertCircle, CheckCircle2, Package, Info, Barcode
} from "lucide-react";
import { rawMaterialsApi, franchiseApi, vendorsApi } from "@/lib/api";
import { ITEM_CATEGORIES, UNITS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { clsx } from "clsx";
import {
  generateEnterpriseSKU, getGSTByHSN
} from "@/lib/utils/erp";
import { toast } from "react-hot-toast";

interface AddMaterialDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddMaterialDrawer({ isOpen, onClose, onSuccess }: AddMaterialDrawerProps) {
  const { user } = useAuth();
  const [franchises, setFranchises] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [existingMaterials, setExistingMaterials] = useState<any[]>([]);
  const [matchingMaterials, setMatchingMaterials] = useState<any[]>([]);
  useEffect(() => { setMounted(true); }, []);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    unit: "kg",
    minimumStock: 10,
    reorderQty: 50,
    category: "RAW_MATERIAL",
    initialStock: 0,
    reconciliationValue: 0,
    reconciliationDate: new Date().toISOString().split('T')[0],
    vendorId: "",
    hsnCode: "",
    gstRate: 5,
    franchiseId: user?.franchiseId || "hq-001",
    storageType: "DRY",
    shelfLife: 180,
    batchTracking: true,
    qcRequired: true,
    valuationMethod: "FIFO",
    barcode: "",
    defaultWarehouse: "Main Stores",
    storageZone: "Zone A",
    binLocation: "",
    status: "PENDING_APPROVAL",
    notes: "",
  });

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [fRes, vRes] = await Promise.all([
            franchiseApi.getAll().catch(() => ({ data: [] })),
            vendorsApi.getAll().catch(() => ({ data: [] }))
          ]);
          const fetchedFranchises = fRes.data || [];
          setFranchises(fetchedFranchises);
          setVendors(vRes.data || []);

          const defaultFranchise = user?.franchiseId || (fetchedFranchises.length > 0 ? fetchedFranchises[0].id : "hq-001");
          setForm(prev => ({ ...prev, franchiseId: prev.franchiseId || defaultFranchise }));

          // Fetch all materials for duplicate detection
          const mRes = await rawMaterialsApi.getAll().catch(() => ({ data: [] }));
          setExistingMaterials(mRes.data || []);
        } catch (e) {
          console.error("Failed to fetch data", e);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    const sku = generateEnterpriseSKU(form.category, form.name);
    setForm((f) => ({ ...f, sku }));

    // Detect almost matches
    if (form.name.length >= 2) {
      const normalized = form.name.toLowerCase().trim();
      const matches = existingMaterials.filter(m => 
        m.name.toLowerCase().includes(normalized) || 
        normalized.includes(m.name.toLowerCase())
      );
      setMatchingMaterials(matches);
    } else {
      setMatchingMaterials([]);
    }
  }, [form.category, form.name, existingMaterials]);

  useEffect(() => {
    if (form.hsnCode.length >= 4) {
      const suggestedGst = getGSTByHSN(form.hsnCode);
      if (suggestedGst !== null) {
        setForm(f => ({ ...f, gstRate: suggestedGst }));
      }
    }
  }, [form.hsnCode]);

  const handleSave = async () => {
    if (!form.name) {
      setError("Material designation is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await rawMaterialsApi.create({
        ...form,
        franchiseId: form.franchiseId || user?.franchiseId || "hq-001",
        initialStock: Number(form.initialStock) || 0,
        createdBy: user?.id,
        requestedAt: new Date().toISOString(),
      });
      toast.success("Material request submitted successfully!");
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      const msg = e.response?.data?.error || "Failed to submit material request.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[20000] flex justify-end overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-500"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0f1117] h-full shadow-[-20px_0_50px_rgba(0,0,0,0.1)] animate-in slide-in-from-right duration-500 flex flex-col">
        {/* Header */}
        <div className="bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-xl border-b border-slate-100 dark:border-white/5 p-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[2rem] bg-orange-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/20">
              <Package size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Add New Material</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Item Master Registration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all text-slate-300 hover:text-slate-500">
            <X size={28} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          {error && (
            <div className="p-5 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 flex items-center gap-4 text-red-600 dark:text-red-400 text-[11px] font-black uppercase tracking-widest animate-in zoom-in-95">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Section: Core Identification */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Material Name *</label>
              <input
                type="text"
                placeholder="e.g. Organic Basmati Rice"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-8 py-5 text-base font-black bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-orange-500/20 rounded-[1.5rem] outline-none dark:text-white transition-all shadow-sm"
              />

              {matchingMaterials.length > 0 && (
                <div className="mx-2 p-4 bg-orange-50/50 dark:bg-orange-500/5 rounded-2xl border border-orange-100 dark:border-orange-500/10 space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <AlertCircle size={14} className="animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Potential matches found</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {matchingMaterials.map(m => (
                      <div key={m.id} className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-500/20 rounded-lg shadow-sm">
                        <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate max-w-[150px]">{m.name}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">{m.category} · {m.unit}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] font-bold text-orange-400 italic">Please ensure you are not creating a duplicate item.</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Category</label>
                <div className="relative">
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full appearance-none bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-orange-500/20 rounded-[1.2rem] px-6 py-4 text-xs font-black dark:text-white transition-all shadow-sm"
                  >
                    {ITEM_CATEGORIES.filter((c) => c !== "FINISHED_GOOD" && c !== "SEMI_FINISHED").map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                  </select>
                  <ChevronDown size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Sourcing Unit</label>
                <div className="relative">
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-full appearance-none bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-orange-500/20 rounded-[1.2rem] px-6 py-4 text-xs font-black dark:text-white transition-all shadow-sm"
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u.toUpperCase()}</option>)}
                  </select>
                  <ChevronDown size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                  <Barcode size={12} className="text-indigo-500" /> HSN Code
                </label>
                <input
                  type="text"
                  placeholder="4 or 8 digits"
                  value={form.hsnCode}
                  onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))}
                  className="w-full px-6 py-4 text-xs font-black bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-indigo-500/20 rounded-[1.2rem] outline-none dark:text-white transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Tax Rate (GST)</label>
                <div className="relative">
                  <select
                    value={form.gstRate}
                    onChange={(e) => setForm((f) => ({ ...f, gstRate: Number(e.target.value) }))}
                    className="w-full appearance-none bg-slate-50 dark:bg-white/5 border-2 border-transparent focus:border-indigo-500/20 rounded-[1.2rem] px-6 py-4 text-xs font-black dark:text-white transition-all"
                  >
                    {[0, 5, 12, 18, 28].map((rate) => <option key={rate} value={rate}>{rate}% GST Standard</option>)}
                  </select>
                  <ChevronDown size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-2xl border-t border-slate-100 dark:border-white/5 p-10 flex gap-6 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-5 border-2 border-slate-100 dark:border-white/5 text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-[2rem] transition-all"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-[2] py-5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-orange-500/40 transition-all flex items-center justify-center gap-4 active:scale-95"
          >
            {saving ? (
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 size={22} />
            )}
            {saving ? "Processing..." : "Submit For Approval"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}