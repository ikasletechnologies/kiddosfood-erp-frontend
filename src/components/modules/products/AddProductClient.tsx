"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Save, ArrowLeft, Sparkles, CheckCircle2, AlertCircle, Info, IndianRupee, ChevronDown, Package, X, Tag, Layers, Scale, Hash, Copy, ListFilter, RefreshCw
} from "lucide-react";
import { productsFullApi } from "@/lib/api";
import Link from "next/link";
import { clsx } from "clsx";
import { PREDEFINED_SIZES, getCategoryDefaults, generateSKU } from "@/lib/utils/erp";

export default function AddProductClient() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    basePrice: 0,
    category: "BATTER",
    taxPercent: 5,
    hsnCode: "",
    productType: "FINISHED_GOOD",
    is_menu_item: true,
    isVeg: true,
    isActive: true,
    shelfLifeDays: null as number | null,
  });

  const [size, setSize] = useState("1KG");
  
  const prevCategory = useRef(form.category);

  useEffect(() => {
    if (form.category !== prevCategory.current) {
      const defs = getCategoryDefaults(form.category);
      setForm((f) => ({ ...f, hsnCode: defs.hsnCode, taxPercent: defs.taxPercent }));
      prevCategory.current = form.category;
    }
  }, [form.category]);

  useEffect(() => {
    const sku = generateSKU(form.category, form.name, size);
    setForm((f) => ({ ...f, sku }));
  }, [form.category, form.name, size]);

  const handleSave = async () => {
    if (!form.name) {
      setError("Product name is required");
      return;
    }
    if (form.productType === "FINISHED_GOOD" && !(form.basePrice > 0)) {
      setError("Set a valid selling price before launching this item — franchises can't be offered a product with no price.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await productsFullApi.create(form);
      router.push("/products");
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to create product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-6 animate-in fade-in duration-700">
      {/* Elegant Header */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/products" 
            className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-all flex items-center justify-center active:scale-90"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Register Item</h1>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-1">Catalog Expansion Project</p>
          </div>
        </div>
        <Link href="/products" className="text-[10px] font-black text-slate-300 hover:text-slate-900 transition-colors uppercase tracking-widest">
          Quit Session
        </Link>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-100/50 text-red-600 text-xs font-bold flex items-center gap-3">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Modern Integrated Form */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 p-6 space-y-8">
        
        {/* Section: Core Identity */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-5 bg-orange-500 rounded-full" />
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.15em]">Core Identity</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Designation</label>
              <input 
                placeholder="Product Name (e.g. Masala Podi)" 
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50/50 rounded-xl font-bold text-slate-900 border-none outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-300"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Narrative Description</label>
              <textarea 
                placeholder="Short description... (Optional)" 
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-5 py-3.5 bg-slate-50/50 rounded-xl font-bold text-slate-900 border-none outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all resize-none placeholder:text-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Section: Specification & Logic */}
        <div className="pt-2 space-y-6 border-t border-slate-50">
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-5 bg-slate-900 rounded-full" />
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.15em]">Specification</h3>
            </div>
            <div className="bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-slate-500 tracking-tighter">
                {form.sku || "GENERATING..."}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Category */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Primary Category
              </label>
              <div className="flex flex-wrap gap-2">
                {["BATTER", "SNACK", "BEVERAGE"].map((cat) => (
                  <button 
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className={clsx(
                      "px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                      form.category === cat 
                        ? "bg-slate-900 text-white shadow-lg" 
                        : "bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input 
                placeholder="Custom Category..."
                value={!["BATTER", "SNACK", "BEVERAGE"].includes(form.category) ? form.category : ""}
                onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2.5 bg-slate-50/30 border border-slate-100 rounded-xl font-bold text-xs text-orange-600 focus:bg-white outline-none transition-all placeholder:text-slate-300"
              />
            </div>

            {/* Size */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Pack Dimension
              </label>
              <div className="flex flex-wrap gap-2">
                {["1KG", "500G", "250G"].map((s) => (
                  <button 
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={clsx(
                      "px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                      size === s 
                        ? "bg-slate-900 text-white shadow-lg" 
                        : "bg-slate-50 text-slate-400 hover:bg-slate-100 active:scale-95"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input 
                placeholder="Custom Size..."
                value={!["1KG", "500G", "250G"].includes(size) ? size : ""}
                onChange={(e) => setSize(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 bg-slate-50/30 border border-slate-100 rounded-xl font-bold text-xs text-slate-900 focus:bg-white outline-none transition-all placeholder:text-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Section: Commercials */}
        <div className="pt-2 space-y-6 border-t border-slate-50">
          <div className="flex items-center gap-3 mt-6">
            <div className="w-1.5 h-5 bg-emerald-500 rounded-full" />
            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.15em]">Commercials</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Base Valuation (₹)
              </label>
              <input 
                type="number" 
                value={form.basePrice} 
                onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} 
                className="w-full px-6 py-4 bg-slate-50/50 rounded-xl font-black text-2xl text-slate-900 border-none outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-300" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Tax Obligation (%)
              </label>
              <div className="flex gap-2">
                {[0, 5, 12, 18].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setForm({ ...form, taxPercent: rate })}
                    className={clsx(
                      "flex-1 py-3 rounded-lg font-black text-[10px] transition-all",
                      form.taxPercent === rate 
                        ? "bg-slate-900 text-white shadow-lg" 
                        : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    {rate === 0 ? "Without Tax (0%)" : `${rate}%`}
                  </button>
                ))}
                <input 
                  type="number"
                  placeholder="Custom"
                  value={![0, 5, 12, 18].includes(form.taxPercent) ? form.taxPercent : ""}
                  onChange={(e) => setForm({ ...form, taxPercent: Number(e.target.value) })}
                  className="w-16 py-3 px-2 bg-slate-50 rounded-lg font-black text-[10px] text-center border-none outline-none focus:bg-white transition-all placeholder:text-slate-300"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Shelf Life (Days)
              </label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 7"
                value={form.shelfLifeDays ?? ""}
                onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                className="w-full px-6 py-4 bg-slate-50/50 rounded-xl font-black text-2xl text-slate-900 border-none outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-300"
              />
              <p className="text-[10px] font-bold text-slate-400 ml-1">Batch expiry = Production Date + Shelf Life. Blank uses the default (7 days).</p>
            </div>
          </div>
        </div>

        {/* Section: Flags & Action */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-slate-50">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({...form, isVeg: !form.isVeg})}
              className={clsx(
                "flex items-center gap-2.5 px-5 py-3.5 rounded-xl border transition-all",
                form.isVeg 
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700" 
                  : "border-slate-50 bg-slate-50 text-slate-400"
              )}
            >
              <div className={clsx("w-2 h-2 rounded-full", form.isVeg ? "bg-emerald-500" : "bg-slate-300")} />
              <span className="text-[9px] font-black tracking-widest uppercase">{form.isVeg ? "Pure Veg" : "Non-Veg"}</span>
            </button>

            <button
              type="button"
              onClick={() => setForm({...form, is_menu_item: !form.is_menu_item})}
              className={clsx(
                "flex items-center gap-2.5 px-5 py-3.5 rounded-xl border transition-all",
                form.is_menu_item 
                  ? "border-orange-100 bg-orange-50 text-orange-700" 
                  : "border-slate-50 bg-slate-50 text-slate-400"
              )}
            >
              <div className={clsx("w-2 h-2 rounded-full", form.is_menu_item ? "bg-orange-500" : "bg-slate-300")} />
              <span className="text-[9px] font-black tracking-widest uppercase">{form.is_menu_item ? "Visible" : "Hidden"}</span>
            </button>
          </div>

          <button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-slate-900/10 hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles size={14} className="text-orange-400" />
                <span>Launch Item</span>
              </>
            )}
          </button>
        </div>
      </div>

      <p className="text-center mt-12 text-[9px] font-bold text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2">
        <Info size={12} /> Items are published immediately to the digital catalog
      </p>
    </div>
  );
}
