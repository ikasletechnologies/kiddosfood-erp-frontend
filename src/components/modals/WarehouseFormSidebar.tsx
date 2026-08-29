"use client";

import { useState, useEffect } from "react";
import { X, Warehouse, MapPin, Tag, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { inventoryApi } from "@/lib/api";
import toast from "react-hot-toast";
import { clsx } from "clsx";

interface WarehouseFormSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (warehouse: any) => void;
  warehouseToEdit?: any;
}

export default function WarehouseFormSidebar({ isOpen, onClose, onSuccess, warehouseToEdit }: WarehouseFormSidebarProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    type: "MAIN"
  });

  useEffect(() => {
    if (warehouseToEdit) {
      setFormData({
        name: warehouseToEdit.name || "",
        location: warehouseToEdit.location || "",
        type: warehouseToEdit.type || "MAIN"
      });
    } else {
      setFormData({ name: "", location: "", type: "MAIN" });
    }
  }, [warehouseToEdit, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Warehouse name is required");
      return;
    }

    setLoading(true);
    try {
      if (warehouseToEdit) {
        const response = await inventoryApi.updateWarehouse(warehouseToEdit.id, formData);
        toast.success("Warehouse updated successfully");
        onSuccess(response.data);
      } else {
        const response = await inventoryApi.createWarehouse(formData);
        toast.success("Warehouse created successfully");
        onSuccess(response.data);
      }
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || "Failed to create warehouse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={clsx(
          "fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-500",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div 
        className={clsx(
          "fixed inset-y-0 right-0 z-[110] w-full max-w-full sm:max-w-md bg-white dark:bg-[#0B0D14] shadow-2xl transition-transform duration-500 ease-in-out transform border-l border-slate-200 dark:border-slate-800 min-w-0",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-full flex flex-col min-w-0">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0D14] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 bg-orange-100 dark:bg-orange-950/30 text-orange-600 rounded-xl shrink-0">
                <Warehouse size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate">
                  {warehouseToEdit ? "Update Warehouse" : "Add Warehouse"}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                  {warehouseToEdit ? "Modify storage or production unit details" : "Configure a new storage or production unit"}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
            <div className="space-y-3.5 sm:space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Tag size={14} className="text-orange-500" /> Warehouse Name *
                </label>
                <input 
                  autoFocus
                  type="text"
                  required
                  placeholder="e.g. Central Distribution Hub"
                  className="w-full text-xs sm:text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 outline-none focus:border-orange-500 transition-colors placeholder:text-slate-400"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin size={14} className="text-orange-500" /> Physical Location
                </label>
                <textarea 
                  placeholder="Street address, City, Region..."
                  className="w-full min-h-[90px] sm:min-h-[100px] text-xs sm:text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 outline-none focus:border-orange-500 transition-colors placeholder:text-slate-400 resize-none"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="p-3.5 sm:p-4 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/50">
                <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-1">
                  Quick Tips
                </h4>
                <ul className="space-y-1.5 sm:space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Name should be unique to avoid confusion in stock transfers.</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Location helps in calculating lead times for procurement.</p>
                  </li>
                </ul>
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors text-center"
            >
              Cancel
            </button>
            <button 
              disabled={loading}
              onClick={handleSubmit}
              className="px-5 sm:px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm hover:shadow active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={16} /> {warehouseToEdit ? "Update Warehouse" : "Save Warehouse"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
