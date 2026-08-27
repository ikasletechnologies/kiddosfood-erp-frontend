"use client";

import { useState, useEffect, Suspense } from "react";
import { 
  ArrowLeft, Save, Trash2, Info, X,
  IndianRupee, Sparkles, ChevronDown, 
  AlertCircle, CheckCircle2 
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { productsFullApi } from "@/lib/api";

function EditProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  
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

  useEffect(() => {
    if (!id) {
      setError("No product ID provided.");
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        const res = await productsFullApi.getById(id as string);
        const p = res.data;
        setForm({
          name: p.name,
          sku: p.sku ?? "",
          description: p.description ?? "",
          basePrice: p.basePrice,
          category: p.category ?? "BATTER",
          taxPercent: p.taxPercent ?? 5,
          hsnCode: p.hsnCode ?? "",
          productType: p.productType ?? "FINISHED_GOOD",
          is_menu_item: p.is_menu_item ?? true,
          isVeg: p.isVeg ?? true,
          isActive: p.isActive ?? true,
          shelfLifeDays: p.shelfLifeDays ?? null,
        });
      } catch (e) {
        console.error(e);
        setError("Failed to fetch product details.");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    if (!form.name) {
      setError("Product name is required");
      return;
    }
    if (form.basePrice <= 0) {
      setError("Base price must be greater than 0");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await productsFullApi.update(id as string, form);
      router.push("/products");
    } catch (e: any) {
      console.error(e);
      setError(e.response?.data?.message || "Failed to update product. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return;
    try {
      await productsFullApi.delete(id as string);
      router.push("/products");
    } catch (e) {
      console.error(e);
      setError("Failed to delete product.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-3 mb-2">
            <Link 
              href="/products" 
              className="p-2 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 text-gray-500 hover:text-orange-500 transition-all hover:shadow-md"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Edit Product
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-2">
            <Sparkles size={14} className="text-orange-500" />
            Refining the masterpiece: {form.name}
          </p>
        </div>

        <div className="hidden md:flex gap-3">
          <button 
            onClick={handleDelete}
            className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 transition-all"
            title="Delete Product"
          >
            <Trash2 size={20} />
          </button>
          <Link 
            href="/products" 
            className="px-6 py-3 rounded-2xl border border-gray-200 dark:border-white/10 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
          >
            Discard
          </Link>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 transition-all active:scale-95"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {saving ? "Saving..." : "Update Strategy"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-card rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-gray-400">
              <Info size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Essential Identity</h2>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Traditional Idly Batter" 
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-6 py-4 text-base font-bold bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 ring-orange-500/10 dark:text-white transition-all placeholder:text-gray-300 dark:placeholder:text-white/10" 
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Visual Narrative (Description)</label>
                <textarea 
                  placeholder="Tell the story of this product..." 
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-6 py-4 text-base font-bold bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 ring-orange-500/10 dark:text-white transition-all placeholder:text-gray-300 dark:placeholder:text-white/10 resize-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU Identification</label>
                  <input 
                    type="text" 
                    placeholder="SKU-001" 
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    className="w-full px-6 py-4 text-base font-bold bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 ring-orange-500/10 dark:text-white transition-all placeholder:text-gray-300 dark:placeholder:text-white/10" 
                  />
                </div>
                  <div className="space-y-4">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Category Classification</label>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, category: "BATTER" }))}
                        className={clsx(
                          "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all",
                          form.category === "BATTER" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "bg-slate-50 dark:bg-white/5 text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10"
                        )}
                      >
                        Batter
                      </button>
                      {form.category !== "BATTER" ? (
                        <div className="flex-1 min-w-[200px] flex items-center gap-3 bg-white dark:bg-slate-800 border-2 border-orange-500 rounded-2xl px-4 py-2 animate-in slide-in-from-left-2">
                          <input 
                            autoFocus
                            value={form.category === "OTHER" ? "" : form.category}
                            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value.toUpperCase() }))}
                            placeholder="New Category..."
                            className="flex-1 bg-transparent border-none outline-none font-black text-xs uppercase tracking-widest text-orange-600 dark:text-orange-400 placeholder:text-orange-200"
                          />
                          <button 
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, category: "BATTER" }))}
                            className="p-1.5 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl text-orange-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, category: "OTHER" }))}
                          className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-dashed border-gray-200 dark:border-white/10 text-gray-400 hover:border-orange-500 hover:text-orange-500"
                        >
                          + Add New
                        </button>
                      )}
                    </div>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">HSN Code (GST)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 2106" 
                    value={form.hsnCode}
                    onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))}
                    className="w-full px-6 py-4 text-base font-bold bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 ring-orange-500/10 dark:text-white transition-all placeholder:text-gray-300 dark:placeholder:text-white/10" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Type</label>
                  <div className="relative">
                    <select 
                      value={form.productType} 
                      onChange={(e) => setForm((f) => ({ ...f, productType: e.target.value }))}
                      className="w-full appearance-none bg-slate-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-base font-bold focus:outline-none focus:ring-4 ring-orange-500/10 dark:text-white transition-all"
                    >
                      <option value="FINISHED_GOOD">Finished Good (Stocked)</option>
                      <option value="MADE_TO_ORDER">Made to Order (Fresh)</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-card rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-gray-400">
              <IndianRupee size={16} />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em]">Financial Architecture</h2>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Base Price (₹) *</label>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</div>
                  <input 
                    type="number" 
                    min={0} 
                    step={0.01} 
                    value={form.basePrice}
                    onChange={(e) => setForm((f) => ({ ...f, basePrice: Number(e.target.value) }))}
                    className="w-full pl-12 pr-6 py-4 text-base font-bold bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 ring-orange-500/10 dark:text-white transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tax Protocol (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min={0} 
                    max={100} 
                    value={form.taxPercent}
                    onChange={(e) => setForm((f) => ({ ...f, taxPercent: Number(e.target.value) }))}
                    className="w-full px-6 py-4 text-base font-bold bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 ring-orange-500/10 dark:text-white transition-all" 
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Shelf Life (Days)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 7"
                  value={form.shelfLifeDays ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, shelfLifeDays: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) }))}
                  className="w-full px-6 py-4 text-base font-bold bg-slate-50 dark:bg-white/5 border-none rounded-2xl outline-none focus:ring-4 ring-orange-500/10 dark:text-white transition-all placeholder:text-gray-300 dark:placeholder:text-white/10"
                />
                <p className="text-[10px] font-bold text-gray-400 ml-1">Batch expiry = Production Date + Shelf Life. Blank uses the default (7 days).</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-card rounded-[2.5rem] border border-gray-100 dark:border-white/5 p-8 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Market Status</h3>
            
            <div className="space-y-6">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-sm font-black text-gray-900 dark:text-white block">Active Status</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Visible to everyone</span>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.isActive} 
                    onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-white/5 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                </div>
              </label>

              <div className="h-px bg-gray-100 dark:bg-white/5" />

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-sm font-black text-gray-900 dark:text-white block">Menu Visibility</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Show in POS Menu</span>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.is_menu_item} 
                    onChange={(e) => setForm(f => ({ ...f, is_menu_item: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-white/5 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                </div>
              </label>

              <div className="h-px bg-gray-100 dark:bg-white/5" />

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-sm font-black text-gray-900 dark:text-white block">Dietary Profile</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    {form.isVeg ? "🟢 Vegetarian" : "🔴 Non-Veg"}
                  </span>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.isVeg} 
                    onChange={(e) => setForm(f => ({ ...f, isVeg: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-white/5 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-orange-500/5 dark:bg-orange-500/10 rounded-[2.5rem] border border-orange-500/10 p-8">
            <div className="flex gap-4 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center text-white shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-orange-600 dark:text-orange-400">Update Settings</h4>
                <p className="text-xs font-bold text-orange-900/40 dark:text-orange-400/40 mt-0.5">Changes take effect immediately across all platforms.</p>
              </div>
            </div>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 transition-all active:scale-95"
            >
              {saving ? "Processing..." : "Confirm & Update"}
            </button>
          </div>

          <button 
            onClick={handleDelete}
            className="w-full py-4 rounded-2xl border border-red-200 dark:border-red-900/20 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
          >
            Archive Product
          </button>
        </div>
      </div>
      
      {/* Mobile Actions */}
      <div className="fixed bottom-6 left-6 right-6 md:hidden flex gap-3">
        <button 
          onClick={handleDelete}
          className="p-5 bg-red-500 text-white rounded-[2rem] shadow-2xl shadow-red-500/40"
        >
          <Trash2 size={20} />
        </button>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="flex-1 py-5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-orange-500/40 transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {saving ? "Updating..." : "Update Product"}
        </button>
      </div>
    </div>
  );
}

export default function EditProductPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Editor...</p>
      </div>
    }>
      <EditProductForm />
    </Suspense>
  );
}
