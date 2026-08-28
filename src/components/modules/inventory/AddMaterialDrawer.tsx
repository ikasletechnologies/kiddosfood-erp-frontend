"use client";

import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { SlideOver } from "@/components/ui/SlideOver";
import { rawMaterialsApi } from "@/lib/api";
import { toast } from "react-hot-toast";

interface AddMaterialDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdMaterial?: any) => void;
  initialName?: string;
}

export default function AddMaterialDrawer({ isOpen, onClose, onSuccess, initialName = "" }: AddMaterialDrawerProps) {
  const [materialList, setMaterialList] = useState<{ id: string; name: string; unit: string }[]>([{ id: "1", name: "", unit: "kg" }]);
  const [savingMaterial, setSavingMaterial] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMaterialList([{ id: Math.random().toString(36).slice(2), name: initialName, unit: "kg" }]);
    }
  }, [isOpen, initialName]);

  const handleCreateMaterial = async () => {
    const validMaterials = materialList.filter(m => m.name.trim());
    if (validMaterials.length === 0) return;
    setSavingMaterial(true);
    try {
      let lastRes: any = null;
      for (const mat of validMaterials) {
        lastRes = await rawMaterialsApi.create({
          name: mat.name.trim(),
          unit: mat.unit,
          costPrice: 0,
          category: "RAW_MATERIAL",
          minimumStock: 10,
          reorderQty: 50,
          initialStock: 0,
          gstRate: 5
        });
      }
      
      toast.success(validMaterials.length > 1 ? "Materials created successfully!" : "Material created successfully!");
      onSuccess(lastRes?.data);
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.error ?? "Failed to create material");
    } finally {
      setSavingMaterial(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setMaterialList([{ id: "1", name: "", unit: "kg" }]);
      }}
      title="Add New Material"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Material Name *</label>
          <button
            type="button"
            onClick={() => setMaterialList(prev => [...prev, { id: Math.random().toString(36).slice(2), name: "", unit: "kg" }])}
            className="text-xs font-bold text-[#f58220] hover:text-[#e8740e] flex items-center gap-1 transition-colors"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="space-y-4">
          {materialList.map((item, idx) => (
            <div key={item.id} className="space-y-3 pt-1 pb-3 border-b border-gray-100 dark:border-white/5 last:border-0 last:pb-0">
              <div className="space-y-1.5">
                {materialList.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Item #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => setMaterialList(prev => prev.filter(m => m.id !== item.id))}
                      className="text-gray-400 dark:text-slate-500 hover:text-red-500 text-xs transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <input
                  value={item.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaterialList(prev => prev.map(m => m.id === item.id ? { ...m, name: val } : m));
                  }}
                  placeholder="e.g. Black Grams"
                  autoFocus={idx === 0}
                  className="w-full h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white outline-none focus:border-[#f58220] transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">Unit</label>
                <select
                  value={item.unit}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaterialList(prev => prev.map(m => m.id === item.id ? { ...m, unit: val } : m));
                  }}
                  className="w-full h-9 bg-white dark:bg-[#13151f] border border-gray-200 dark:border-white/10 px-3 rounded-lg font-medium text-xs text-gray-800 dark:text-white uppercase outline-none focus:border-[#f58220] transition-all"
                >
                  <option value="kg">KG</option>
                  <option value="g">G</option>
                  <option value="L">L</option>
                  <option value="ml">ML</option>
                  <option value="units">UNITS</option>
                  <option value="pcs">PCS</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleCreateMaterial}
          disabled={savingMaterial || !materialList.some(m => m.name.trim())}
          className="w-full bg-[#f58220] hover:bg-[#e8740e] text-white px-4 py-2 rounded-lg font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingMaterial ? "Saving..." : "Create Material"}
        </button>
      </div>
    </SlideOver>
  );
}