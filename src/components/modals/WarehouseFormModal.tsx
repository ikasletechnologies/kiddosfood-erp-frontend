"use client";

import { useState } from "react";
import { X, Warehouse, MapPin, Tag, CheckCircle2, Loader2 } from "lucide-react";
import { inventoryApi } from "@/lib/api";
import toast from "react-hot-toast";

interface WarehouseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (warehouse: any) => void;
}

export default function WarehouseFormModal({ isOpen, onClose, onSuccess }: WarehouseFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    type: "MAIN"
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Warehouse name is required");
      return;
    }

    setLoading(true);
    try {
      const response = await inventoryApi.createWarehouse(formData);
      toast.success("Warehouse created successfully");
      onSuccess(response.data);
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Failed to create warehouse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0A0D14] w-full max-w-md rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 min-w-0">
        <div className="p-4 sm:p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="p-2.5 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl shrink-0">
              <Warehouse size={20} className="text-purple-600 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">Add Warehouse</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 font-bold truncate">Register new storage unit</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Tag size={12} /> Warehouse Name *
            </label>
            <input 
              autoFocus
              type="text"
              required
              placeholder="e.g. Main Warehouse"
              className="w-full text-xs sm:text-sm font-bold bg-slate-50 dark:bg-slate-900 border-none rounded-xl sm:rounded-2xl p-3 sm:p-4 outline-none focus:ring-2 ring-purple-500/20 transition-all"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <MapPin size={12} /> Location / Address
            </label>
            <input 
              type="text"
              placeholder="e.g. Industrial Area, Block B"
              className="w-full text-xs sm:text-sm font-bold bg-slate-50 dark:bg-slate-900 border-none rounded-xl sm:rounded-2xl p-3 sm:p-4 outline-none focus:ring-2 ring-purple-500/20 transition-all"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div className="pt-2 sm:pt-4">
            <button 
              disabled={loading}
              type="submit"
              className="w-full py-3 sm:py-4 bg-[#7C3AED] text-white text-xs font-black rounded-xl sm:rounded-2xl shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={16} /> Create Warehouse
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
